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
const suggestInput = z.object({ topicId: z.string().uuid() });

interface AiVideoSuggestion {
  youtube_id: string;
  title: string;
  channel_name: string;
}

export const suggestVideosForTopic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => suggestInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: topic, error: tErr } = await supabase
      .from("study_topics")
      .select("id, title, area, subject")
      .eq("id", data.topicId)
      .single();
    if (tErr) throw new Error(tErr.message);

    const cacheKey = `video-suggestions:${topic.id}`;
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
      // Build a good search query for YouTube — use the topic itself, biased for ENEM
      const query = `${topic.title} ${topic.subject ?? ""} ENEM aula`.trim();

      // Scrape YouTube search results (no API key needed)
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

      // Extract ytInitialData JSON blob and find videoRenderer entries
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
              parsed.push({
                youtube_id: v.videoId,
                title,
                channel_name: channel,
              });
              if (parsed.length >= 8) break;
            }
            if (parsed.length >= 8) break;
          }
        } catch {
          /* ignore parse errors */
        }
      }

      suggestions = parsed.slice(0, 6);

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
        source: "ai" as const,
        sort_order: 100 + i,
        suggested_at: new Date().toISOString(),
      }));
      await supabaseAdmin
        .from("study_videos")
        .upsert(rows, { onConflict: "topic_id,youtube_id", ignoreDuplicates: true });
    }

    return { added: suggestions.length };
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
      .eq("cache_key", `video-suggestions:${data.topicId}`);
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

    return { topic, videos: videos ?? [] };
  });

interface QuizQuestion {
  videoId: string;
  youtubeId: string;
  videoTitle: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface LessonQuizPayload {
  questions: QuizQuestion[];
  skipped: { youtubeId: string; title: string; reason: string }[];
}

async function fetchYoutubeTranscript(youtubeId: string): Promise<string | null> {
  try {
    const watchRes = await fetch(`https://www.youtube.com/watch?v=${youtubeId}&hl=pt-BR`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
      },
    });
    const html = await watchRes.text();
    const m = html.match(/ytInitialPlayerResponse\s*=\s*(\{.*?\})\s*;\s*(?:var|<\/script>)/s);
    if (!m) return null;
    const player = JSON.parse(m[1]);
    const tracks: Array<{ baseUrl: string; languageCode: string; kind?: string }> =
      player?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
    if (tracks.length === 0) return null;

    const preferred =
      tracks.find((t) => t.languageCode === "pt-BR" && !t.kind) ??
      tracks.find((t) => t.languageCode === "pt" && !t.kind) ??
      tracks.find((t) => t.languageCode === "pt-BR") ??
      tracks.find((t) => t.languageCode === "pt") ??
      tracks.find((t) => t.languageCode?.startsWith("en") && !t.kind) ??
      tracks[0];
    if (!preferred?.baseUrl) return null;

    const capRes = await fetch(`${preferred.baseUrl}&fmt=json3`);
    if (!capRes.ok) return null;
    const capJson = (await capRes.json()) as {
      events?: { segs?: { utf8?: string }[] }[];
    };
    const text = (capJson.events ?? [])
      .flatMap((e) => e.segs ?? [])
      .map((s) => s.utf8 ?? "")
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    return text.length > 50 ? text : null;
  } catch {
    return null;
  }
}

export const buildLessonQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => lessonInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const cacheKey = `lesson-quiz:${data.topicId}`;
    const { data: cached } = await supabase
      .from("ai_response_cache")
      .select("response")
      .eq("cache_key", cacheKey)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (cached) {
      return cached.response as unknown as LessonQuizPayload;
    }

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

    const { generateText } = await import("ai");
    const { createGateway, CHAT_MODEL } = await import("./ai-gateway.server");
    const gateway = createGateway();

    const questions: QuizQuestion[] = [];
    const skipped: LessonQuizPayload["skipped"] = [];

    for (const v of videos) {
      const transcript = await fetchYoutubeTranscript(v.youtube_id);
      if (!transcript) {
        skipped.push({
          youtubeId: v.youtube_id,
          title: v.title ?? "Vídeo",
          reason: "Sem legendas disponíveis",
        });
        continue;
      }

      const truncated = transcript.slice(0, 8000);
      const prompt = `Você é professor preparando questões para o ENEM.

Abaixo está a TRANSCRIÇÃO de uma aula em vídeo. Gere UMA questão de múltipla escolha (4 alternativas, apenas uma correta) sobre um conceito ESPECÍFICO ensinado NESTE texto.

REGRAS OBRIGATÓRIAS:
- Use APENAS informações presentes na transcrição. Não invente dados fora dela.
- A pergunta deve ser clara, autocontida e testar compreensão real do conteúdo (não literal do texto).
- As 4 alternativas devem ser plausíveis; apenas uma correta.
- A explicação deve citar o trecho/conceito da transcrição que justifica a resposta.
- Responda APENAS com JSON válido, sem cercas de código, no formato:
{"question":"...","options":["a","b","c","d"],"correctIndex":0,"explanation":"..."}

TRANSCRIÇÃO:
"""
${truncated}
"""`;

      try {
        const { text } = await generateText({
          model: gateway(CHAT_MODEL),
          prompt,
        });
        const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
        const start = cleaned.indexOf("{");
        const end = cleaned.lastIndexOf("}");
        const slice = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
        const parsed = JSON.parse(slice) as {
          question?: string;
          options?: string[];
          correctIndex?: number;
          explanation?: string;
        };
        if (
          typeof parsed.question === "string" &&
          Array.isArray(parsed.options) &&
          parsed.options.length === 4 &&
          typeof parsed.correctIndex === "number" &&
          parsed.correctIndex >= 0 &&
          parsed.correctIndex < 4 &&
          typeof parsed.explanation === "string"
        ) {
          questions.push({
            videoId: v.id,
            youtubeId: v.youtube_id,
            videoTitle: v.title ?? "Vídeo",
            question: parsed.question,
            options: parsed.options,
            correctIndex: parsed.correctIndex,
            explanation: parsed.explanation,
          });
        } else {
          skipped.push({
            youtubeId: v.youtube_id,
            title: v.title ?? "Vídeo",
            reason: "IA não gerou questão válida",
          });
        }
      } catch {
        skipped.push({
          youtubeId: v.youtube_id,
          title: v.title ?? "Vídeo",
          reason: "Erro ao gerar questão",
        });
      }
    }

    const payload: LessonQuizPayload = { questions, skipped };

    if (questions.length > 0) {
      await supabaseAdmin.from("ai_response_cache").insert({
        cache_key: cacheKey,
        prompt_type: "lesson-quiz",
        response: JSON.parse(JSON.stringify(payload)),
      });
    }

    return payload;
  });

const submitInput = z.object({
  topicId: z.string().uuid(),
  answers: z.array(
    z.object({
      videoId: z.string().uuid(),
      chosenIndex: z.number().int().min(0).max(3),
    }),
  ),
});

export const submitLessonAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => submitInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const cacheKey = `lesson-quiz:${data.topicId}`;
    const { data: cached } = await supabase
      .from("ai_response_cache")
      .select("response")
      .eq("cache_key", cacheKey)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (!cached) throw new Error("Atividade expirou. Volte e gere de novo.");
    const quiz = cached.response as unknown as LessonQuizPayload;

    const graded = data.answers.map((a) => {
      const q = quiz.questions.find((x) => x.videoId === a.videoId);
      const correct = q ? a.chosenIndex === q.correctIndex : false;
      return { videoId: a.videoId, chosenIndex: a.chosenIndex, correct };
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



