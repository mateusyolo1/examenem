import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ============================================================
// List topics (full tree)
// ============================================================
export const listStudyTopics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("study_topics")
      .select("id, parent_id, slug, title, area, subject, description, sort_order")
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return { topics: data ?? [] };
  });

// ============================================================
// User-owned videos (per topic, saved to the user's account)
// ============================================================
function extractYoutubeId(input: string): string | null {
  const trimmed = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = url.pathname.slice(1);
      return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
    }
    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      const v = url.searchParams.get("v");
      if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;
      const parts = url.pathname.split("/").filter(Boolean);
      const marker = parts.findIndex((p) => p === "embed" || p === "shorts" || p === "live");
      if (marker >= 0 && parts[marker + 1] && /^[A-Za-z0-9_-]{11}$/.test(parts[marker + 1])) {
        return parts[marker + 1];
      }
    }
  } catch {
    // not a URL
  }
  return null;
}

export const listUserVideos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ topicId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("user_study_videos")
      .select("id, youtube_id, title, created_at")
      .eq("user_id", userId)
      .eq("topic_id", data.topicId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { videos: rows ?? [] };
  });

export const addUserVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        topicId: z.string().uuid(),
        url: z.string().min(1).max(500),
        title: z.string().trim().max(200).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const youtubeId = extractYoutubeId(data.url);
    if (!youtubeId) throw new Error("URL do YouTube inválida. Cole o link completo do vídeo.");
    const { data: row, error } = await supabase
      .from("user_study_videos")
      .upsert(
        {
          user_id: userId,
          topic_id: data.topicId,
          youtube_id: youtubeId,
          title: data.title?.trim() || null,
        },
        { onConflict: "user_id,topic_id,youtube_id" },
      )
      .select("id, youtube_id, title, created_at")
      .single();
    if (error) throw new Error(error.message);
    return { video: row };
  });

export const deleteUserVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("user_study_videos")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// List videos for a topic (+ user's watched status)
// ============================================================
const videosInput = z.object({ topicId: z.string().uuid() });

export const listVideosForTopic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => videosInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: videos, error } = await supabase
      .from("study_videos")
      .select("id, youtube_id, title, channel_name, thumbnail_url, duration_seconds, source, sort_order, suggested_at")
      .eq("topic_id", data.topicId)
      .order("source", { ascending: true }) // 'ai' > 'curated' alphabetically so curated first
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);

    const ids = (videos ?? []).map((v) => v.id);
    let watched = new Set<string>();
    if (ids.length > 0) {
      const { data: progress } = await supabase
        .from("user_video_progress")
        .select("video_id")
        .eq("user_id", userId)
        .eq("watched", true)
        .in("video_id", ids);
      watched = new Set((progress ?? []).map((p) => p.video_id));
    }

    return {
      videos: (videos ?? []).map((v) => ({
        ...v,
        watched: watched.has(v.id),
      })),
    };
  });

// ============================================================
// Mark video as watched (toggles)
// ============================================================
const markWatchedInput = z.object({
  videoId: z.string().uuid(),
  watched: z.boolean(),
});

export const markVideoWatched = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => markWatchedInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("user_video_progress")
      .upsert(
        {
          user_id: userId,
          video_id: data.videoId,
          watched: data.watched,
          last_watched_at: data.watched ? new Date().toISOString() : null,
        },
        { onConflict: "user_id,video_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// AI: Suggest more videos for a topic
// Uses Gemini via Lovable AI Gateway to return YouTube video IDs from
// known BR education channels. Cached in ai_response_cache to save credits.
// ============================================================
const suggestInput = z.object({
  topicId: z.string().uuid(),
  maxMinutes: z.number().int().min(5).max(720).optional(),
});

interface AiVideoSuggestion {
  youtube_id: string;
  title: string;
  channel_name: string;
  duration_seconds: number | null;
}

// Parses YouTube length strings like "10:32" or "1:02:15" → seconds.
function parseLengthText(text: string | undefined | null): number | null {
  if (!text) return null;
  const parts = text.split(":").map((p) => parseInt(p, 10));
  if (parts.some((n) => !Number.isFinite(n))) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0];
  return null;
}

export const suggestVideosForTopic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => suggestInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const maxMinutes = data.maxMinutes ?? 120;
    const maxSeconds = maxMinutes * 60;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: topic, error: tErr } = await supabase
      .from("study_topics")
      .select("id, title, area, subject")
      .eq("id", data.topicId)
      .single();
    if (tErr) throw new Error(tErr.message);

    const cacheKey = `video-suggestions:${topic.id}:${maxMinutes}`;
    const { data: cached } = await supabase
      .from("ai_response_cache")
      .select("response")
      .eq("cache_key", cacheKey)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    let suggestions: AiVideoSuggestion[];
    if (cached) {
      suggestions = (cached.response as unknown as { suggestions: AiVideoSuggestion[] }).suggestions;
    } else {
      // Query prioritizes the specific topic title (in quotes) so YouTube
      // doesn't fall back to generic subject-level videos that overlap with
      // sibling topics under the same subject.
      const query = `"${topic.title}" ${topic.subject ?? ""} ENEM aula explicação`.trim();

      const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&hl=pt-BR&gl=BR`;
      let html = "";
      try {
        const res = await fetch(searchUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
          },
        });
        html = await res.text();
      } catch {
        html = "";
      }

      // Extract up to ~20 candidates so we still have 6 after de-duplication
      const parsed: AiVideoSuggestion[] = [];
      const match = html.match(/var ytInitialData\s*=\s*(\{.*?\});\s*<\/script>/s);
      if (match) {
        try {
          const json = JSON.parse(match[1]);
          const sections =
            json?.contents?.twoColumnSearchResultsRenderer?.primaryContents
              ?.sectionListRenderer?.contents ?? [];
          for (const section of sections) {
            const items = section?.itemSectionRenderer?.contents ?? [];
            for (const item of items) {
              const v = item?.videoRenderer;
              if (!v?.videoId) continue;
              const title = v.title?.runs?.[0]?.text ?? v.title?.simpleText ?? "";
              const channel =
                v.ownerText?.runs?.[0]?.text ??
                v.longBylineText?.runs?.[0]?.text ??
                "";
              if (!/^[A-Za-z0-9_-]{11}$/.test(v.videoId)) continue;
              const lengthText: string | undefined =
                v.lengthText?.simpleText ?? v.lengthText?.runs?.[0]?.text;
              const duration = parseLengthText(lengthText);
              // Skip live streams / unknown-length entries — they can't be
              // budgeted against the daily study time.
              if (duration == null || duration <= 0) continue;
              parsed.push({
                youtube_id: v.videoId,
                title,
                channel_name: channel,
                duration_seconds: duration,
              });
              if (parsed.length >= 30) break;
            }
            if (parsed.length >= 30) break;
          }
        } catch {
          /* ignore parse errors */
        }
      }

      // De-duplicate against videos already used by AI in any other topic —
      // avoids the same video appearing in "Interpretação de Texto" and
      // "Gramática" just because both share the Português subject.
      const candidateIds = parsed.map((p) => p.youtube_id);
      const usedIds = new Set<string>();
      if (candidateIds.length > 0) {
        const { data: existing } = await supabaseAdmin
          .from("study_videos")
          .select("youtube_id")
          .neq("topic_id", topic.id)
          .in("youtube_id", candidateIds);
        for (const row of existing ?? []) usedIds.add(row.youtube_id);
      }

      const unique = parsed.filter((p) => !usedIds.has(p.youtube_id));

      // Budget selection: fit as many videos as possible under maxSeconds,
      // skipping any single video that already exceeds the daily budget.
      // Always try to keep at least 3 to unlock "Iniciar aula".
      const fits: AiVideoSuggestion[] = [];
      let running = 0;
      for (const v of unique) {
        const d = v.duration_seconds ?? 0;
        if (d > maxSeconds) continue;
        if (running + d > maxSeconds) break;
        fits.push(v);
        running += d;
        if (fits.length >= 6) break;
      }
      // Fallback: if the budget is very tight and we got <3, take the 3
      // shortest videos so the lesson can still be started.
      if (fits.length < 3) {
        const shortest = [...unique]
          .filter((v) => (v.duration_seconds ?? Infinity) <= maxSeconds)
          .sort((a, b) => (a.duration_seconds ?? 0) - (b.duration_seconds ?? 0))
          .slice(0, 3);
        suggestions = shortest;
      } else {
        suggestions = fits;
      }

      if (suggestions.length > 0) {
        await supabaseAdmin.from("ai_response_cache").insert({
          cache_key: cacheKey,
          prompt_type: "video-suggestions",
          response: JSON.parse(JSON.stringify({ suggestions })),
        });
      }
    }


    if (suggestions.length > 0) {
      const rows = suggestions.map((s, i) => ({
        topic_id: topic.id,
        youtube_id: s.youtube_id,
        title: s.title,
        channel_name: s.channel_name,
        duration_seconds: s.duration_seconds ?? null,
        source: "ai" as const,
        sort_order: 100 + i,
        suggested_at: new Date().toISOString(),
      }));
      await supabaseAdmin
        .from("study_videos")
        .upsert(rows, { onConflict: "topic_id,youtube_id", ignoreDuplicates: true });
    }

    const totalSeconds = suggestions.reduce((s, v) => s + (v.duration_seconds ?? 0), 0);
    return {
      added: suggestions.length,
      totalMinutes: Math.round(totalSeconds / 60),
      maxMinutes,
    };
  });

// ============================================================
// Clear AI-suggested videos for a topic (also clears cache)
// ============================================================
export const clearSuggestedVideos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ topicId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: delErr } = await supabaseAdmin
      .from("study_videos")
      .delete()
      .eq("topic_id", data.topicId)
      .eq("source", "ai");
    if (delErr) throw new Error(delErr.message);
    await supabaseAdmin
      .from("ai_response_cache")
      .delete()
      .like("cache_key", `video-suggestions:${data.topicId}%`);
    return { ok: true };
  });

// ============================================================
// Lesson Mode: playlist + quiz generated from real transcripts
// ============================================================
const lessonInput = z.object({ topicId: z.string().uuid() });

export const getLessonPlaylist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => lessonInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: topic, error: tErr } = await supabase
      .from("study_topics")
      .select("id, title, subject")
      .eq("id", data.topicId)
      .single();
    if (tErr) throw new Error(tErr.message);

    const { data: videos, error } = await supabase
      .from("study_videos")
      .select("id, youtube_id, title, channel_name, sort_order")
      .eq("topic_id", data.topicId)
      .eq("source", "ai")
      .order("sort_order", { ascending: true })
      .limit(6);
    if (error) throw new Error(error.message);

    const ids = (videos ?? []).map((v) => v.id);
    const progressMap = new Map<string, { watched: boolean; watch_seconds: number }>();
    if (ids.length > 0) {
      const { data: progress } = await supabase
        .from("user_video_progress")
        .select("video_id, watched, watch_seconds")
        .eq("user_id", context.userId)
        .in("video_id", ids);
      for (const p of progress ?? []) {
        progressMap.set(p.video_id, {
          watched: !!p.watched,
          watch_seconds: p.watch_seconds ?? 0,
        });
      }
    }

    return {
      topic,
      videos: (videos ?? []).map((v) => ({
        ...v,
        watched: progressMap.get(v.id)?.watched ?? false,
        watch_seconds: progressMap.get(v.id)?.watch_seconds ?? 0,
      })),
    };
  });

// ============================================================
// Save current playback position (for resume)
// ============================================================
export const saveVideoPosition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        videoId: z.string().uuid(),
        watchSeconds: z.number().int().min(0).max(60 * 60 * 24),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("user_video_progress").upsert(
      {
        user_id: userId,
        video_id: data.videoId,
        watch_seconds: data.watchSeconds,
        last_watched_at: new Date().toISOString(),
      },
      { onConflict: "user_id,video_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// Lesson Quiz — 3 questões baseadas nas legendas reais dos vídeos
// Etapa 1: captura a legenda automática/manual de cada vídeo e resume o conteúdo.
// Etapa 2: gera 3 questões cobrindo o conjunto dos resumos.
// Caches por youtube_id e por topicId para economizar créditos.
// ============================================================

// Modelo mais barato do catálogo para resumo e geração de questões em texto.
const VIDEO_MODEL = "google/gemini-2.5-flash-lite";

interface VideoSummary {
  keyConcepts: string[];
  definitions: string[];
  examples: string[];
  timestamps: { at: string; note: string }[];
}

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  videoRef: {
    videoId: string;
    youtubeId: string;
    videoTitle: string;
    timestamp?: string;
  };
}

interface LessonQuizPayload {
  questions: QuizQuestion[];
  skipped: { youtubeId: string; title: string; reason: string }[];
}

function parseJsonLoose<T>(text: string): T {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const slice = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
  return JSON.parse(slice) as T;
}

type SupabaseAdmin = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];

async function summarizeVideo(
  youtubeId: string,
  videoTitle: string,
  topicCtx: string,
  supabaseAdmin: SupabaseAdmin,
): Promise<VideoSummary> {
  const cacheKey = `video-summary:transcript:v1:${youtubeId}`;
  const { data: cached } = await supabaseAdmin
    .from("ai_response_cache")
    .select("response")
    .eq("cache_key", cacheKey)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (cached) return cached.response as unknown as VideoSummary;

  const { fetchYoutubeTranscriptText } = await import("./youtube-transcripts.server");
  const transcript = await fetchYoutubeTranscriptText(youtubeId);
  const { generateText } = await import("ai");
  const { createGateway } = await import("./ai-gateway.server");
  const gateway = createGateway();

  const prompt = `Você é um assistente que resume vídeos-aula para gerar atividades de estudo.

Use APENAS a transcrição real abaixo. Não use o título para inventar conteúdo.

Aula: "${topicCtx}"
Vídeo: "${videoTitle}"
Idioma da legenda: ${transcript.lang ?? "desconhecido"}
Trechos da transcrição com timestamps:
${transcript.text}

Devolva JSON puro, sem cercas de código, nesta estrutura:

{
  "keyConcepts": ["conceito explicado na transcrição", "..."],
  "definitions": ["definição ou distinção conceitual presente na fala", "..."],
  "examples": ["exemplo, exercício, caso ou comparação citado", "..."],
  "timestamps": [{"at": "MM:SS", "note": "conceito dito nesse momento"}]
}

Regras:
- Inclua 3 a 8 conceitos-chave.
- Inclua exemplos concretos quando existirem.
- Timestamps devem existir apenas se aparecerem nos trechos acima.
- Se a transcrição não ensinar conteúdo útil sobre "${topicCtx}", devolva arrays vazios.
- Responda em português.`;

  let parsed: VideoSummary;
  try {
    const { text } = await generateText({
      model: gateway(VIDEO_MODEL),
      prompt,
    });
    parsed = parseJsonLoose<VideoSummary>(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : "erro desconhecido";
    if (message.includes("429") || message.toLowerCase().includes("rate")) throw new Error("rate_limit");
    if (message.includes("402") || message.toLowerCase().includes("credit")) {
      throw new Error("credits_exhausted");
    }
    throw error;
  }

  const summary: VideoSummary = {
    keyConcepts: Array.isArray(parsed.keyConcepts) ? parsed.keyConcepts : [],
    definitions: Array.isArray(parsed.definitions) ? parsed.definitions : [],
    examples: Array.isArray(parsed.examples) ? parsed.examples : [],
    timestamps: Array.isArray(parsed.timestamps) ? parsed.timestamps : [],
  };

  if (summary.keyConcepts.length > 0) {
    await supabaseAdmin.from("ai_response_cache").insert({
      cache_key: cacheKey,
      prompt_type: "video-summary",
      response: JSON.parse(JSON.stringify(summary)),
    });
  }

  return summary;
}

export const buildLessonQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => lessonInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const cacheKey = `lesson-quiz:v3:${data.topicId}`;
    const { data: cached } = await supabase
      .from("ai_response_cache")
      .select("response")
      .eq("cache_key", cacheKey)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (cached) return cached.response as unknown as LessonQuizPayload;

    const { data: topic } = await supabase
      .from("study_topics")
      .select("title, subject, area")
      .eq("id", data.topicId)
      .single();

    const { data: videos, error } = await supabase
      .from("study_videos")
      .select("id, youtube_id, title")
      .eq("topic_id", data.topicId)
      .eq("source", "ai")
      .order("sort_order", { ascending: true })
      .limit(6);
    if (error) throw new Error(error.message);
    if (!videos || videos.length === 0) {
      throw new Error("Nenhum vídeo encontrado para gerar a atividade.");
    }

    const topicCtx = topic
      ? `${topic.title}${topic.subject ? ` (${topic.subject})` : ""}${topic.area ? ` — ${topic.area}` : ""}`
      : "ENEM";

    // Etapa 1: resume cada vídeo em paralelo. Falha num vídeo não derruba o resto.
    const summaryResults = await Promise.allSettled(
      videos.map((v) =>
        summarizeVideo(v.youtube_id, v.title ?? "Vídeo", topicCtx, supabaseAdmin).then(
          (summary) => ({ video: v, summary }),
        ),
      ),
    );

    const successfulSummaries: { video: (typeof videos)[number]; summary: VideoSummary }[] = [];
    const skipped: LessonQuizPayload["skipped"] = [];

    for (let i = 0; i < summaryResults.length; i++) {
      const r = summaryResults[i];
      const v = videos[i];
      if (r.status === "fulfilled" && r.value.summary.keyConcepts.length > 0) {
        successfulSummaries.push(r.value);
      } else {
        const reason =
          r.status === "rejected"
            ? r.reason instanceof Error
              ? r.reason.message
              : "erro"
            : "legenda sem conteúdo analisável";
        if (reason === "credits_exhausted") {
          throw new Error(
            "Créditos de IA esgotados neste mês. Adicione créditos ou tente novamente no próximo ciclo.",
          );
        }
        skipped.push({
          youtubeId: v.youtube_id,
          title: v.title ?? "Vídeo",
          reason:
            reason === "rate_limit"
              ? "IA sobrecarregada — tente de novo em instantes"
              : reason.startsWith("gateway_")
                ? "Legenda não pôde ser processada"
                : reason,
        });
      }
    }

    if (successfulSummaries.length === 0) {
      throw new Error(
        "Nenhum vídeo da aula possui legenda analisável. Sugira novos vídeos e tente novamente.",
      );
    }

    // Etapa 2: 3 questões cobrindo os resumos.
    const { generateText } = await import("ai");
    const { createGateway } = await import("./ai-gateway.server");
    const gateway = createGateway();

    const combined = successfulSummaries
      .map(
        ({ video, summary }, idx) =>
          `[Vídeo ${idx + 1}] "${video.title ?? "Vídeo"}" (id: ${video.id}, youtube: ${video.youtube_id})
Conceitos-chave: ${summary.keyConcepts.join("; ")}
Definições: ${summary.definitions.join("; ")}
Exemplos: ${summary.examples.join("; ")}
Momentos: ${summary.timestamps.map((t) => `${t.at} — ${t.note}`).join(" | ")}`,
      )
      .join("\n\n");

    const quizPrompt = `Você é professor(a) preparando uma atividade ENEM sobre o tópico "${topicCtx}".

Abaixo estão RESUMOS EXTRAÍDOS DIRETAMENTE dos vídeos-aula que o aluno acabou de assistir. Gere EXATAMENTE 3 questões de múltipla escolha (4 alternativas cada, apenas uma correta) baseadas RIGOROSAMENTE no conteúdo desses resumos.

REGRAS OBRIGATÓRIAS:
- As 3 questões devem cobrir conceitos DIFERENTES apresentados nos vídeos (não repetir o mesmo tema).
- Use SOMENTE informações presentes nos resumos abaixo. Não invente conteúdo.
- Cada questão deve indicar qual vídeo a inspirou (campo "videoId" com o id EXATO mostrado).
- Se houver timestamp relevante, inclua no campo "timestamp" (formato "MM:SS").
- Nível ENEM: contextualizada, autocontida, testando compreensão (não memorização literal).
- Alternativas plausíveis; distratores baseados em erros conceituais comuns.
- A explicação deve citar o conceito/exemplo do vídeo que justifica a resposta.
- Responda APENAS com JSON válido, sem cercas de código, no formato:
{"questions":[
  {"videoId":"...","timestamp":"MM:SS","question":"...","options":["a","b","c","d"],"correctIndex":0,"explanation":"..."},
  {...},
  {...}
]}

RESUMOS DOS VÍDEOS:
${combined}`;

    let quizJson: {
      questions?: Array<{
        videoId?: string;
        timestamp?: string;
        question?: string;
        options?: string[];
        correctIndex?: number;
        explanation?: string;
      }>;
    } = {};

    try {
      const { text } = await generateText({
        model: gateway(VIDEO_MODEL),
        prompt: quizPrompt,
      });
      quizJson = parseJsonLoose(text);
    } catch (e) {
      throw new Error(
        `Falha ao gerar questões: ${e instanceof Error ? e.message : "erro desconhecido"}`,
      );
    }

    const rawQuestions = Array.isArray(quizJson.questions) ? quizJson.questions : [];
    const questions: QuizQuestion[] = [];

    for (let i = 0; i < rawQuestions.length && questions.length < 3; i++) {
      const q = rawQuestions[i];
      if (
        typeof q.question !== "string" ||
        !Array.isArray(q.options) ||
        q.options.length !== 4 ||
        typeof q.correctIndex !== "number" ||
        q.correctIndex < 0 ||
        q.correctIndex > 3 ||
        typeof q.explanation !== "string"
      ) {
        continue;
      }
      const ref =
        successfulSummaries.find((s) => s.video.id === q.videoId) ??
        successfulSummaries[i % successfulSummaries.length];
      questions.push({
        id: `q${questions.length + 1}`,
        question: q.question,
        options: q.options,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
        videoRef: {
          videoId: ref.video.id,
          youtubeId: ref.video.youtube_id,
          videoTitle: ref.video.title ?? "Vídeo",
          timestamp: typeof q.timestamp === "string" ? q.timestamp : undefined,
        },
      });
    }

    if (questions.length === 0) {
      throw new Error("A IA não gerou questões válidas. Tente novamente em instantes.");
    }

    const payload: LessonQuizPayload = { questions, skipped };

    await supabaseAdmin.from("ai_response_cache").insert({
      cache_key: cacheKey,
      prompt_type: "lesson-quiz",
      response: JSON.parse(JSON.stringify(payload)),
    });

    return payload;
  });

const submitInput = z.object({
  topicId: z.string().uuid(),
  answers: z.array(
    z.object({
      questionId: z.string(),
      chosenIndex: z.number().int().min(0).max(3),
    }),
  ),
});

export const submitLessonAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => submitInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const cacheKey = `lesson-quiz:v3:${data.topicId}`;
    const { data: cached } = await supabase
      .from("ai_response_cache")
      .select("response")
      .eq("cache_key", cacheKey)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (!cached) throw new Error("Atividade expirou. Volte e gere de novo.");
    const quiz = cached.response as unknown as LessonQuizPayload;

    const graded = data.answers.map((a) => {
      const q = quiz.questions.find((x) => x.id === a.questionId);
      const correct = q ? a.chosenIndex === q.correctIndex : false;
      return { questionId: a.questionId, chosenIndex: a.chosenIndex, correct };
    });
    const score = graded.filter((g) => g.correct).length;
    const total = quiz.questions.length;

    const { error: insErr } = await supabase.from("lesson_attempts").insert({
      user_id: userId,
      topic_id: data.topicId,
      score,
      total,
      answers: graded,
    });
    if (insErr) throw new Error(insErr.message);

    return { score, total, graded, quiz };
  });




