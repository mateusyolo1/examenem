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
    const topics = data ?? [];

    // Anexa duração do menor vídeo (heurístico: introdutório) por tópico,
    // usado pelo gerador de plano para calibrar `minutes` de videoaula.
    const topicIds = topics.map((t) => t.id);
    const durationByTopic = new Map<string, number>();
    if (topicIds.length > 0) {
      const { data: vids } = await context.supabase
        .from("study_videos")
        .select("topic_id, duration_seconds")
        .in("topic_id", topicIds)
        .not("duration_seconds", "is", null)
        .order("duration_seconds", { ascending: true });
      for (const v of vids ?? []) {
        if (v.topic_id && typeof v.duration_seconds === "number" && v.duration_seconds > 0) {
          if (!durationByTopic.has(v.topic_id)) {
            durationByTopic.set(v.topic_id, v.duration_seconds);
          }
        }
      }
    }
    const enriched = topics.map((t) => ({
      ...t,
      video_duration_seconds: durationByTopic.get(t.id) ?? null,
    }));
    return { topics: enriched };
  });

// ============================================================
// Resolve a study topic by slug (preferred) or by area (fallback).
// Used by the study plan CTA "Estudar" to open /aula/$topicId for a
// task generated in the schedule.
// ============================================================
export const resolveStudyTopic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        slug: z.string().min(1).max(80).optional(),
        area: z.enum(["linguagens", "humanas", "natureza", "matematica"]).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    if (data.slug) {
      const { data: bySlug, error } = await context.supabase
        .from("study_topics")
        .select("id, title, area, subject")
        .eq("slug", data.slug)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (bySlug) return bySlug;
    }
    if (data.area) {
      const { data: byArea, error } = await context.supabase
        .from("study_topics")
        .select("id, title, area, subject")
        .eq("area", data.area)
        .not("parent_id", "is", null)
        .order("sort_order", { ascending: true })
        .limit(1);
      if (error) throw new Error(error.message);
      if (byArea && byArea.length) return byArea[0];
    }
    throw new Error("Nenhum tópico correspondente foi encontrado.");
  });

// ============================================================
// Topic mastery (Abordagem 3) — grava desempenho por tópico e alimenta
// o cronograma para pular dominados, injetar revisões espaçadas e ajustar
// pesos por área.
// ============================================================
const MASTERY_AREA = z.enum(["linguagens", "humanas", "natureza", "matematica"]);

function nextReviewFromScore(score: number): { nextReviewAt: string; mastered: boolean } {
  const now = new Date();
  let days = 3;
  let mastered = false;
  if (score >= 0.8) {
    days = 14;
    mastered = true;
  } else if (score >= 0.6) {
    days = 7;
  }
  const next = new Date(now);
  next.setDate(next.getDate() + days);
  return { nextReviewAt: next.toISOString(), mastered };
}

export const recordTopicMastery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        topicSlug: z.string().min(1).max(80),
        area: MASTERY_AREA,
        score: z.number().min(0).max(1),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { nextReviewAt, mastered } = nextReviewFromScore(data.score);
    const nowIso = new Date().toISOString();
    // Upsert: se existe, incrementa attempts.
    const { data: existing } = await context.supabase
      .from("topic_mastery")
      .select("id, attempts")
      .eq("user_id", context.userId)
      .eq("topic_slug", data.topicSlug)
      .maybeSingle();

    if (existing) {
      const { error } = await context.supabase
        .from("topic_mastery")
        .update({
          area: data.area,
          last_score: data.score,
          attempts: (existing.attempts ?? 0) + 1,
          last_seen_at: nowIso,
          next_review_at: nextReviewAt,
          mastered,
        })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase.from("topic_mastery").insert({
        user_id: context.userId,
        topic_slug: data.topicSlug,
        area: data.area,
        last_score: data.score,
        attempts: 1,
        last_seen_at: nowIso,
        next_review_at: nextReviewAt,
        mastered,
      });
      if (error) throw new Error(error.message);
    }
    return { ok: true, mastered, nextReviewAt };
  });

export const listTopicMastery = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("topic_mastery")
      .select("topic_slug, area, last_score, attempts, last_seen_at, next_review_at, mastered")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { mastery: data ?? [] };
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
      .select("id, youtube_id, title, channel_name, thumbnail_url, duration_seconds, source, sort_order, suggested_at, pedagogical_intent")
      .eq("topic_id", data.topicId)
      .order("source", { ascending: true }) // 'ai' > 'curated' alphabetically so curated first
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);

    // Per-user isolation: AI-suggested videos are stored in the shared
    // study_videos table (to dedupe across topics/users), but the list
    // shown to each user must be filtered to what THIS user has been
    // suggested — tracked in user_video_suggestion_history. Curated
    // videos remain visible to everyone.
    const aiYoutubeIds = (videos ?? [])
      .filter((v) => v.source === "ai")
      .map((v) => v.youtube_id);
    let allowedAi = new Set<string>();
    if (aiYoutubeIds.length > 0) {
      const { data: history } = await supabase
        .from("user_video_suggestion_history")
        .select("youtube_id")
        .eq("user_id", userId)
        .eq("topic_id", data.topicId)
        .is("dismissed_at", null)
        .in("youtube_id", aiYoutubeIds);
      allowedAi = new Set((history ?? []).map((h) => h.youtube_id));
    }
    const scoped = (videos ?? []).filter(
      (v) => v.source !== "ai" || allowedAi.has(v.youtube_id),
    );

    const ids = scoped.map((v) => v.id);
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
      videos: scoped.map((v) => ({
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
  topicId: z.string().min(1),
  maxMinutes: z.number().int().min(5).max(720).optional(),
  forceRefresh: z.boolean().optional(),
});

// Resolves either a UUID or a slug to a topic row.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface AiVideoSuggestion {
  youtube_id: string;
  title: string;
  channel_name: string;
  duration_seconds: number | null;
  view_count?: number | null;
  style?: VideoStyle;
  // filter metadata (from youtube-filter pipeline)
  relevance_confidence?: number;
  relevance_reason?: string;
  pedagogical_intent?: "introducao" | "teoria" | "exercicios" | "aplicacao" | "revisao";
  subject_detected?: string;
  lexicon_score?: number;
  confidence?: number;
  reason?: string;
  transcript_sample?: string;
  channel_reputation?: number;
  relevant?: boolean;
}

// Estilos didáticos que queremos GARANTIR na lista final (diversidade).
type VideoStyle =
  | "aula_completa"    // explicação teórica aprofundada
  | "macete"           // dicas, bizus, atalhos, mnemônicos
  | "exercicio"        // resolução de questões/ENEM
  | "resumo"           // revisão rápida, "em X minutos"
  | "mapa_mental"      // esquema, mapa mental, quadro-resumo
  | "aplicacao";       // caso real, exemplo prático, curiosidade

// Ângulos de busca — cada um puxa um estilo diferente de conteúdo.
// A ordem também vira "peso": os primeiros costumam render mais volume.
const SEARCH_ANGLES: Array<{ style: VideoStyle; suffix: string }> = [
  { style: "aula_completa", suffix: "aula completa explicação professor" },
  { style: "macete", suffix: "macete dica bizu ENEM rápido" },
  { style: "exercicio", suffix: "questão ENEM resolvida passo a passo" },
  { style: "resumo", suffix: "resumo revisão em 10 minutos ENEM" },
  { style: "mapa_mental", suffix: "mapa mental esquema resumo visual" },
  { style: "aplicacao", suffix: "exemplo prático aplicação vestibular" },
];

// Regex que classifica um vídeo por estilo a partir do título.
const STYLE_PATTERNS: Array<{ style: VideoStyle; re: RegExp }> = [
  { style: "macete", re: /\b(macete|macetes|bizu|bizus|dica|dicas|truque|truques|hack|hacks|mnem[oô]nic\w*|atalho|atalhos|infal[íi]vel|segredo)\b/i },
  { style: "exercicio", re: /\b(quest[ãa]o|quest[õo]es|exerc[íi]cio|exerc[íi]cios|resolvid\w*|corre[çc][ãa]o|gabarito|prova comentada)\b/i },
  { style: "resumo", re: /\b(resumo|resum[ãa]o|revis[ãa]o|em\s*\d+\s*(min|minutos)|r[áa]pido|rapid[íi]nho|tudo sobre)\b/i },
  { style: "mapa_mental", re: /\b(mapa mental|mapa\s+mental|esquema|quadro resumo|infogr[áa]fico|resumo visual)\b/i },
  { style: "aplicacao", re: /\b(exemplo|na pr[áa]tica|aplica[çc][ãa]o|caso real|curiosidade|hist[óo]ria da|por que|voc[eê] sabia)\b/i },
  { style: "aula_completa", re: /\b(aula|explica[çc][ãa]o|introdu[çc][ãa]o a|completa|do zero|entenda)\b/i },
];

function classifyStyle(title: string, channel: string): VideoStyle {
  const hay = `${title} ${channel}`;
  for (const { style, re } of STYLE_PATTERNS) if (re.test(hay)) return style;
  return "aula_completa";
}

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
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

// "1,2 mi de visualizações" / "532 mil" / "12.345 views" → number
function parseViewCount(text: string | undefined | null): number | null {
  if (!text) return null;
  const t = text.toLowerCase().replace(/\./g, "").replace(",", ".");
  const m = t.match(/([\d.]+)\s*(mi|mil|k|m|bi|b)?/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n)) return null;
  const unit = m[2];
  const mult =
    unit === "mi" || unit === "m" ? 1_000_000 :
    unit === "bi" || unit === "b" ? 1_000_000_000 :
    unit === "mil" || unit === "k" ? 1_000 : 1;
  return Math.round(n * mult);
}

async function fetchYoutubeSearch(query: string): Promise<AiVideoSuggestion[]> {
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
    return [];
  }
  const out: AiVideoSuggestion[] = [];
  const match = html.match(/var ytInitialData\s*=\s*(\{.*?\});\s*<\/script>/s);
  if (!match) return out;
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
        if (!/^[A-Za-z0-9_-]{11}$/.test(v.videoId)) continue;
        const title = v.title?.runs?.[0]?.text ?? v.title?.simpleText ?? "";
        const channel =
          v.ownerText?.runs?.[0]?.text ??
          v.longBylineText?.runs?.[0]?.text ??
          "";
        const lengthText: string | undefined =
          v.lengthText?.simpleText ?? v.lengthText?.runs?.[0]?.text;
        const duration = parseLengthText(lengthText);
        if (duration == null || duration <= 0) continue;
        // Descarta shorts (< 90s) — não servem como material de estudo.
        if (duration < 90) continue;
        const viewText: string | undefined =
          v.viewCountText?.simpleText ?? v.shortViewCountText?.simpleText;
        out.push({
          youtube_id: v.videoId,
          title,
          channel_name: channel,
          duration_seconds: duration,
          view_count: parseViewCount(viewText),
        });
        if (out.length >= 25) break;
      }
      if (out.length >= 25) break;
    }
  } catch {
    /* ignore parse errors */
  }
  return out;
}


export const suggestVideosForTopic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => suggestInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const maxMinutes = data.maxMinutes ?? 120;
    const maxSeconds = maxMinutes * 60;
    const forceRefresh = !!data.forceRefresh;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const topicQuery = supabase
      .from("study_topics")
      .select("id, title, area, subject");
    const { data: topic, error: tErr } = await (
      UUID_RE.test(data.topicId)
        ? topicQuery.eq("id", data.topicId)
        : topicQuery.eq("slug", data.topicId)
    ).single();
    if (tErr) throw new Error(tErr.message);
    if (!topic) throw new Error("Tópico não encontrado.");

    const cacheKey = `video-suggestions:${topic.id}:${maxMinutes}`;

    // C) forceRefresh: pula leitura de cache; senão tenta cache antes.
    let suggestions: AiVideoSuggestion[] | null = null;
    if (!forceRefresh) {
      const { data: cached } = await supabaseAdmin
        .from("ai_response_cache")
        .select("response")
        .eq("cache_key", cacheKey)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      if (cached) {
        suggestions = (cached.response as unknown as { suggestions: AiVideoSuggestion[] })
          .suggestions;
        const cachedIds = suggestions.map((s) => s.youtube_id);
        if (cachedIds.length > 0) {
          const { data: previousRows } = await supabase
            .from("user_video_suggestion_history")
            .select("youtube_id")
            .eq("user_id", userId)
            .eq("topic_id", topic.id)
            .in("youtube_id", cachedIds);
          const previousIds = new Set((previousRows ?? []).map((row) => row.youtube_id));
          suggestions = suggestions.filter((s) => !previousIds.has(s.youtube_id));
          if (suggestions.length === 0) suggestions = null;
        }
      }
    }

    if (!suggestions) {
      // 1) BUSCA MULTI-ÂNGULO — dispara N queries em paralelo, cada uma focada
      // num estilo didático (aula, macete, exercício, resumo, mapa mental,
      // aplicação prática). Assim a lista final não fica "tudo cara falando
      // a mesma coisa".
      const base = `${topic.title} ${topic.subject ?? ""}`.trim();
      const angles = forceRefresh
        ? shuffleInPlace([...SEARCH_ANGLES])
        : SEARCH_ANGLES;

      const perAngle = await Promise.all(
        angles.map(async ({ style, suffix }) => {
          const list = await fetchYoutubeSearch(`${base} ${suffix}`);
          return list.map((v) => ({ ...v, style }));
        }),
      );

      // Também rodamos uma busca "aberta" pra pegar vídeos populares que não
      // caem em nenhum ângulo.
      const openQuery = `"${topic.title}" ${topic.subject ?? ""} ENEM`.trim();
      const open = (await fetchYoutubeSearch(openQuery)).map((v) => ({
        ...v,
        style: classifyStyle(v.title, v.channel_name),
      }));

      // Mescla e deduplica por youtube_id, preservando o style do primeiro
      // ângulo que descobriu o vídeo (o ângulo é a "intenção" da busca).
      const parsedMap = new Map<string, AiVideoSuggestion>();
      for (const list of [...perAngle, open]) {
        for (const v of list) {
          if (!parsedMap.has(v.youtube_id)) parsedMap.set(v.youtube_id, v);
        }
      }
      const parsed = Array.from(parsedMap.values());

      // De-dup contra vídeos AI já usados em OUTROS tópicos (global).
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

      // Exclui vídeos que já apareceram para ESTE usuário neste tópico.
      const historyIds = new Set<string>();
      if (candidateIds.length > 0) {
        const { data: history } = await supabase
          .from("user_video_suggestion_history")
          .select("youtube_id")
          .eq("user_id", userId)
          .eq("topic_id", topic.id)
          .in("youtube_id", candidateIds);
        for (const row of history ?? []) historyIds.add(row.youtube_id);
      }

      let unique = parsed.filter(
        (p) => !usedIds.has(p.youtube_id) && !historyIds.has(p.youtube_id),
      );

      // 2) FILTRA CLICKBAIT ÓBVIO — títulos 100% em CAIXA ALTA gritando,
      // excesso de emojis, palavras de isca sem sinal didático.
      const CLICKBAIT_RE = /(🔥|😱|🚨|⚠️|❌){2,}|!!{2,}/;
      const isClickbait = (v: AiVideoSuggestion) => {
        const t = v.title ?? "";
        if (CLICKBAIT_RE.test(t)) return true;
        const letters = t.replace(/[^A-Za-zÀ-ÿ]/g, "");
        if (letters.length > 20) {
          const upper = letters.replace(/[^A-ZÀ-Ý]/g, "").length;
          if (upper / letters.length > 0.75) return true;
        }
        return false;
      };
      const clean = unique.filter((v) => !isClickbait(v));
      if (clean.length >= 6) unique = clean;

      // ============================================================
      // FILTRO POTENTE — Camadas 2→6 (léxico, transcrição, IA, reputação, jornada)
      // ============================================================
      const {
        scoreLexicon, fetchTranscriptSample, verifyRelevanceBatch,
        loadChannelReputation, pickPedagogicalJourney, recordChannelSignal,
      } = await import("./youtube-filter");
      type FilterCandidate = import("./youtube-filter").FilterCandidate;

      const area = (topic.area ?? "linguagens") as
        "linguagens" | "humanas" | "natureza" | "matematica";
      const subjectKey = (topic.subject ?? topic.area ?? "geral").toLowerCase();

      // Camada 2 — léxico bidirecional (sem transcrição ainda)
      let scored: FilterCandidate[] = unique.map((v) => ({
        ...v,
        lexicon_score: scoreLexicon({ ...v }, area),
      }));
      // Descarta apenas quem é MUITO negativo — não zera nichos
      const lexKept = scored.filter((c) => (c.lexicon_score ?? 0) > -3);
      if (lexKept.length >= 6) scored = lexKept;

      // Reduz o batch antes da transcrição para economizar
      scored.sort((a, b) => (b.lexicon_score ?? 0) - (a.lexicon_score ?? 0));
      scored = scored.slice(0, 18);

      // Camada 3 — amostragem de transcrição (paralelo, ignora falhas)
      const withTranscripts = await Promise.all(
        scored.map(async (c) => ({
          ...c,
          transcript_sample: await fetchTranscriptSample(c.youtube_id),
        })),
      );
      // Rescoreia léxico agora que temos texto real
      for (const c of withTranscripts) {
        c.lexicon_score = scoreLexicon(c, area);
      }

      // Camada 4 — IA verificadora em batch (Gemini)
      const verifyCacheKey = `video-verify:${topic.id}:${withTranscripts
        .map((c) => c.youtube_id).sort().join(",").slice(0, 200)}`;
      let verifyMap: Awaited<ReturnType<typeof verifyRelevanceBatch>> | null = null;
      const { data: verifyCached } = await supabaseAdmin
        .from("ai_response_cache")
        .select("response")
        .eq("cache_key", verifyCacheKey)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      if (verifyCached) {
        try {
          const raw = (verifyCached.response as unknown as {
            items: Array<{ id: string; [k: string]: unknown }>;
          }).items;
          verifyMap = new Map(raw.map((it) => [it.id, it as never]));
        } catch { verifyMap = null; }
      }
      if (!verifyMap) {
        verifyMap = await verifyRelevanceBatch(withTranscripts, {
          topicTitle: topic.title,
          area,
          subject: topic.subject,
        });
        if (verifyMap.size > 0) {
          await supabaseAdmin.from("ai_response_cache").upsert(
            {
              cache_key: verifyCacheKey,
              prompt_type: "video-verify",
              response: JSON.parse(JSON.stringify({
                items: Array.from(verifyMap.values()),
              })),
            },
            { onConflict: "cache_key" },
          );
        }
      }

      // Aplica veredito da IA
      let verified: FilterCandidate[] = withTranscripts.map((c) => {
        const v = verifyMap!.get(c.youtube_id);
        if (!v) return c; // sem veredito: mantém, mas sem confidence
        return {
          ...c,
          relevant: v.relevant,
          confidence: v.confidence,
          subject_detected: v.subject_detected,
          pedagogical_intent: v.pedagogical_intent,
          reason: v.reason,
        };
      });
      // Corta: relevant=false, confidence baixa, ou matéria detectada muito
      // diferente da área do tópico (pega o caso Curió-em-Linguagens).
      const areaWords: Record<typeof area, string[]> = {
        linguagens: ["linguagens", "portugues", "literatura", "gramatica", "redacao", "ingles", "espanhol", "arte"],
        humanas: ["humanas", "historia", "geografia", "filosofia", "sociologia"],
        natureza: ["natureza", "biologia", "quimica", "fisica"],
        matematica: ["matematica"],
      };
      const areaKeywords = areaWords[area];
      const isCompatible = (detected: string | undefined) => {
        if (!detected) return true;
        const d = detected.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return areaKeywords.some((k) => d.includes(k));
      };
      const afterAi = verified.filter((c) => {
        if (c.relevant === false) return false;
        if (typeof c.confidence === "number" && c.confidence < 0.55) return false;
        if (!isCompatible(c.subject_detected)) return false;
        return true;
      });
      if (afterAi.length >= 4) verified = afterAi;

      // Camada 5 — reputação de canal (decay temporal)
      const channelList = Array.from(new Set(verified.map((c) => c.channel_name)));
      const repMap = await loadChannelReputation(supabase, channelList, subjectKey);
      for (const c of verified) {
        c.channel_reputation = repMap.get(c.channel_name.toLowerCase().trim()) ?? 0;
      }

      // Camada 6 — jornada pedagógica (substitui a seleção anterior)
      const TARGET = 6;
      const picked = pickPedagogicalJourney(verified, TARGET, maxSeconds);

      // Registra hits em background para os aprovados (só os que a IA verificou)
      for (const p of picked) {
        if (p.relevant === true) {
          void recordChannelSignal(supabaseAdmin, p.channel_name, subjectKey, "hit");
        }
      }

      suggestions = picked;

      // Atualiza cache (upsert para permitir a chamada com forceRefresh
      // sobrescrever o cache antigo).
      if (suggestions.length > 0) {
        await supabaseAdmin.from("ai_response_cache").upsert(
          {
            cache_key: cacheKey,
            prompt_type: "video-suggestions",
            response: JSON.parse(JSON.stringify({ suggestions })),
          },
          { onConflict: "cache_key" },
        );
      }
    }

    // NOTE: previously deleted shared study_videos rows on forceRefresh,
    // but the per-user list is now scoped by user_video_suggestion_history,
    // so accumulation in the shared table is harmless — and deleting shared
    // rows would break other users' history references.


    if (suggestions.length > 0) {
      const suggestionIds = suggestions.map((s) => s.youtube_id);
      const { data: previousRows } = await supabase
        .from("user_video_suggestion_history")
        .select("youtube_id")
        .eq("user_id", userId)
        .eq("topic_id", topic.id)
        .in("youtube_id", suggestionIds);
      const previousIds = new Set((previousRows ?? []).map((row) => row.youtube_id));
      suggestions = suggestions.filter((s) => !previousIds.has(s.youtube_id));
    }

    if (suggestions.length > 0) {
      // Ordena INTERCALANDO estilos: macete → aula → exercício → resumo →
      // mapa mental → aplicação. Assim a lista renderizada nunca tem 4
      // vídeos seguidos do mesmo formato didático.
      const ORDER: VideoStyle[] = [
        "macete", "aula_completa", "exercicio", "resumo", "mapa_mental", "aplicacao",
      ];
      const bucketed = new Map<VideoStyle, AiVideoSuggestion[]>();
      for (const s of suggestions) {
        const style = (s.style ?? classifyStyle(s.title, s.channel_name)) as VideoStyle;
        const arr = bucketed.get(style) ?? [];
        arr.push(s);
        bucketed.set(style, arr);
      }
      const ordered: AiVideoSuggestion[] = [];
      let added = true;
      while (added) {
        added = false;
        for (const style of ORDER) {
          const arr = bucketed.get(style);
          if (arr && arr.length) { ordered.push(arr.shift()!); added = true; }
        }
      }
      const rows = ordered.map((s, i) => ({
        topic_id: topic.id,
        youtube_id: s.youtube_id,
        title: s.title,
        channel_name: s.channel_name,
        duration_seconds: s.duration_seconds ?? null,
        source: "ai" as const,
        sort_order: 100 + i,
        suggested_at: new Date().toISOString(),
        relevance_confidence: s.confidence ?? null,
        relevance_reason: s.reason ?? null,
        pedagogical_intent: s.pedagogical_intent ?? null,
        subject_detected: s.subject_detected ?? null,
        lexicon_score: s.lexicon_score ?? null,
      }));
      await supabaseAdmin
        .from("study_videos")
        .upsert(rows, { onConflict: "topic_id,youtube_id", ignoreDuplicates: true });

      // D) registra no histórico do usuário (idempotente por unique constraint).
      const historyRows = suggestions.map((s) => ({
        user_id: userId,
        topic_id: topic.id,
        youtube_id: s.youtube_id,
        title: s.title,
        channel_name: s.channel_name,
        duration_seconds: s.duration_seconds ?? null,
      }));
      await supabase
        .from("user_video_suggestion_history")
        .upsert(historyRows, {
          onConflict: "user_id,topic_id,youtube_id",
          ignoreDuplicates: true,
        });
    }

    const totalSeconds = suggestions.reduce((s, v) => s + (v.duration_seconds ?? 0), 0);
    return {
      added: suggestions.length,
      totalMinutes: Math.round(totalSeconds / 60),
      maxMinutes,
      refreshed: forceRefresh,
    };
  });

// ============================================================
// Suggestion history — vídeos já sugeridos pelo usuário no tópico
// ============================================================
export const listSuggestionHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ topicId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("user_video_suggestion_history")
      .select("youtube_id, title, channel_name, duration_seconds, suggested_at")
      .eq("user_id", userId)
      .eq("topic_id", data.topicId)
      .order("suggested_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return { history: rows ?? [] };
  });

export const clearSuggestionHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ topicId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("user_video_suggestion_history")
      .delete()
      .eq("user_id", userId)
      .eq("topic_id", data.topicId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// Clear AI-suggested videos for a topic (per-user only).
// SECURITY: previously deleted shared study_videos + ai_response_cache
// rows via supabaseAdmin, which let any authenticated user wipe content
// visible to everyone. Now this only hides the CURRENT user's
// active suggestion rows so their next fetch re-ranks fresh suggestions,
// without touching shared data.
// ============================================================
export const clearSuggestedVideos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ topicId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: clearedRows, error } = await supabaseAdmin
      .from("user_video_suggestion_history")
      .update({ dismissed_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("topic_id", data.topicId)
      .is("dismissed_at", null)
      .select("youtube_id");
    if (error) throw new Error(error.message);
    return { ok: true, cleared: clearedRows?.length ?? 0 };
  });

// ============================================================
// Report irrelevant video: user flags a video as off-topic.
// SECURITY: previously deleted the shared study_videos row and cache
// entries via supabaseAdmin, letting any authenticated user remove
// curated content for everyone. Now this only records the channel
// signal (aggregated across users) — shared rows are never deleted.
// ============================================================
export const reportIrrelevantVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      topicId: z.string().uuid(),
      videoId: z.string().uuid(),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { recordChannelSignal } = await import("./youtube-filter");

    const [{ data: video }, { data: topic }] = await Promise.all([
      supabase
        .from("study_videos")
        .select("id, channel_name, youtube_id")
        .eq("id", data.videoId)
        .maybeSingle(),
      supabase
        .from("study_topics")
        .select("id, subject, area")
        .eq("id", data.topicId)
        .maybeSingle(),
    ]);

    if (video?.channel_name) {
      const subjectKey = (topic?.subject ?? topic?.area ?? "geral").toLowerCase();
      await recordChannelSignal(supabaseAdmin, video.channel_name, subjectKey, "miss");
    }

    return { ok: true };
  });


// ============================================================
// Lesson Mode: playlist + quiz generated from real transcripts
// ============================================================
const lessonInput = z.object({
  topicId: z.string().min(1),
  taskId: z.string().optional(),
  maxMinutes: z.number().int().min(5).max(240).optional(),
});

export const getLessonPlaylist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => lessonInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const topicQuery = supabase
      .from("study_topics")
      .select("id, slug, title, subject, area");
    const { data: topic, error: tErr } = await (
      UUID_RE.test(data.topicId)
        ? topicQuery.eq("id", data.topicId)
        : topicQuery.eq("slug", data.topicId)
    ).single();
    if (tErr) throw new Error(tErr.message);
    if (!topic) throw new Error("Tópico não encontrado.");

    // Determina duração máxima da playlist:
    // 1) parâmetro explícito, 2) minutes da atividade do plano se taskId, 3) 120 min.
    let maxMinutes = data.maxMinutes ?? null;
    if (!maxMinutes && data.taskId) {
      const { data: plan } = await supabase
        .from("user_study_plan")
        .select("cronograma")
        .eq("user_id", context.userId)
        .maybeSingle();
      const tasks =
        ((plan?.cronograma as { tasks?: Array<{ id: string; minutes?: number }> } | null)
          ?.tasks) ?? [];
      const t = tasks.find((x) => x.id === data.taskId);
      if (t?.minutes && t.minutes > 0) maxMinutes = t.minutes;
    }
    const cap = maxMinutes ?? 120;
    const maxSeconds = cap * 60;

    const { data: videos, error } = await supabase
      .from("study_videos")
      .select("id, youtube_id, title, channel_name, sort_order, duration_seconds")
      .eq("topic_id", topic.id)
      .eq("source", "ai")
      .order("sort_order", { ascending: true })
      .limit(6);
    if (error) throw new Error(error.message);


    const youtubeIds = (videos ?? []).map((v) => v.youtube_id);
    let activeYoutubeIds = new Set<string>();
    if (youtubeIds.length > 0) {
      const { data: history } = await supabase
        .from("user_video_suggestion_history")
        .select("youtube_id")
        .eq("user_id", context.userId)
        .eq("topic_id", topic.id)
        .is("dismissed_at", null)
        .in("youtube_id", youtubeIds);
      activeYoutubeIds = new Set((history ?? []).map((h) => h.youtube_id));
    }

    const scopedVideos = (videos ?? []).filter((v) => activeYoutubeIds.has(v.youtube_id));

    // Trim por duração cumulativa — respeita o tempo planejado da tarefa.
    // Sempre inclui pelo menos 1 vídeo, mesmo que ultrapasse o cap.
    const trimmed: typeof scopedVideos = [];
    let accSeconds = 0;
    for (const v of scopedVideos) {
      const dur = (v as { duration_seconds?: number | null }).duration_seconds ?? 0;
      if (trimmed.length === 0) {
        trimmed.push(v);
        accSeconds += dur;
        continue;
      }
      if (accSeconds + dur > maxSeconds) break;
      trimmed.push(v);
      accSeconds += dur;
    }

    const ids = trimmed.map((v) => v.id);
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
      maxMinutes: cap,
      videos: trimmed.map((v) => ({
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

export interface LessonEssayTask {
  title: string;
  prompt: string;
  focusSkill: string;
  rubric: string[];
  minWords: number;
  maxWords: number;
}

interface LessonQuizPayload {
  questions: QuizQuestion[];
  skipped: { youtubeId: string; title: string; reason: string }[];
  essayTask: LessonEssayTask | null;
}


export const buildLessonQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => lessonInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const cacheKey = `lesson-quiz:v6-essay:${data.topicId}`;
    const { data: cached } = await supabaseAdmin
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

    const { buildLessonQuizPayload } = await import("./lesson-quiz.server");
    const payload = await buildLessonQuizPayload({ topicCtx, videos, supabaseAdmin });

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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const cacheKey = `lesson-quiz:v6-essay:${data.topicId}`;
    const { data: cached } = await supabaseAdmin
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


// ============================================================
// Lesson essay practice (redação focada no que o vídeo ensinou)
// ============================================================

const getEssayTaskInput = z.object({ topicId: z.string().uuid() });

export const getLessonEssayTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => getEssayTaskInput.parse(data))
  .handler(async ({ data, context: _context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cacheKey = `lesson-quiz:v6-essay:${data.topicId}`;
    const { data: cached } = await supabaseAdmin
      .from("ai_response_cache")
      .select("response")
      .eq("cache_key", cacheKey)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (!cached) throw new Error("Atividade não encontrada. Faça a atividade primeiro.");
    const quiz = cached.response as unknown as LessonQuizPayload;
    return { essayTask: quiz.essayTask };
  });

const submitEssayInput = z.object({
  topicId: z.string().uuid(),
  essayText: z.string().min(20).max(5000),
});

interface EssayFeedback {
  score: number;
  overall: string;
  criteria: {
    criterion: string;
    status: "atendido" | "parcial" | "nao_atendido";
    evidence: string;
    suggestion?: string;
  }[];
  tips: string[];
  rewriteExample?: { original: string; improved: string };
}

export const submitLessonEssay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => submitEssayInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Busca a essayTask do cache do quiz
    const cacheKey = `lesson-quiz:v6-essay:${data.topicId}`;
    const { data: cached } = await supabaseAdmin
      .from("ai_response_cache")
      .select("response")
      .eq("cache_key", cacheKey)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (!cached) throw new Error("Tarefa expirou. Volte à aula e refaça a atividade.");
    const quiz = cached.response as unknown as LessonQuizPayload;
    const task = quiz.essayTask;
    if (!task) throw new Error("Esta aula não tem tarefa de escrita.");

    // Chama Gemini para avaliar SOMENTE pela rubrica
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) throw new Error("GOOGLE_AI_API_KEY não configurada.");

    const rubricList = task.rubric.map((r, i) => `${i + 1}. ${r}`).join("\n");
    const prompt = `Você é professor(a) corrigindo um exercício de escrita FOCADO. Avalie o texto do aluno SOMENTE pelos critérios da rubrica abaixo.

REGRAS ABSOLUTAS:
- NÃO comente ortografia, acentuação, concordância, coesão geral, estilo, criatividade ou qualquer aspecto FORA da rubrica.
- Cada critério recebe status: "atendido", "parcial" ou "nao_atendido".
- Para cada critério, cite trecho literal do texto do aluno como evidência (campo "evidence").
- Se "parcial" ou "nao_atendido", inclua uma "suggestion" curta e específica.
- Nota final 0.0 a 10.0 calculada SOMENTE pela rubrica (atendido=1, parcial=0.5, nao_atendido=0), normalizada.
- "tips": 1 a 3 dicas objetivas SÓ sobre a habilidade "${task.focusSkill}".
- Se conseguir mostrar uma reescrita curta de UM trecho do próprio aluno melhorando exatamente essa habilidade, preencha "rewriteExample". Senão, omita.
- "overall": 1 frase resumindo o desempenho SÓ na habilidade.

HABILIDADE PRATICADA: ${task.focusSkill}
TAREFA DADA AO ALUNO: ${task.prompt}

RUBRICA (avalie APENAS estes itens):
${rubricList}

TEXTO DO ALUNO:
"""
${data.essayText}
"""

Responda APENAS com JSON válido:
{
  "score": 7.5,
  "overall": "...",
  "criteria": [
    {"criterion": "texto exato do critério", "status": "atendido|parcial|nao_atendido", "evidence": "trecho citado", "suggestion": "opcional"}
  ],
  "tips": ["..."],
  "rewriteExample": {"original": "trecho do aluno", "improved": "versão corrigida"}
}`;

    // Reusa o helper interno chamando Gemini direto
    const GOOGLE_MODEL = "gemini-2.5-flash";
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GOOGLE_MODEL}:generateContent`;
    const res = await fetch(`${endpoint}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
      }),
    });
    const raw = await res.text();
    if (!res.ok) {
      throw new Error(`Falha na correção (Gemini ${res.status}): ${raw.slice(0, 200)}`);
    }
    let text = "";
    try {
      const body = JSON.parse(raw) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      text =
        body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    } catch {
      throw new Error("Resposta inválida do Gemini.");
    }
    if (!text.trim()) throw new Error("Gemini não retornou correção.");

    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    const slice = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;

    let parsed: EssayFeedback;
    try {
      const j = JSON.parse(slice) as Partial<EssayFeedback>;
      if (
        typeof j.score !== "number" ||
        typeof j.overall !== "string" ||
        !Array.isArray(j.criteria) ||
        !Array.isArray(j.tips)
      ) {
        throw new Error("shape inválido");
      }
      parsed = {
        score: Math.max(0, Math.min(10, j.score)),
        overall: j.overall,
        criteria: j.criteria.map((c) => ({
          criterion: String(c.criterion ?? ""),
          status:
            c.status === "atendido" || c.status === "parcial" || c.status === "nao_atendido"
              ? c.status
              : "parcial",
          evidence: String(c.evidence ?? ""),
          suggestion: c.suggestion ? String(c.suggestion) : undefined,
        })),
        tips: j.tips.map((t) => String(t)).filter(Boolean).slice(0, 3),
        rewriteExample:
          j.rewriteExample &&
          typeof j.rewriteExample.original === "string" &&
          typeof j.rewriteExample.improved === "string"
            ? j.rewriteExample
            : undefined,
      };
    } catch {
      throw new Error("Não foi possível interpretar a correção do Gemini.");
    }

    // Persiste
    const { data: inserted, error: insErr } = await supabase
      .from("lesson_essay_attempts")
      .insert({
        user_id: userId,
        topic_id: data.topicId,
        task: JSON.parse(JSON.stringify(task)),
        essay_text: data.essayText,
        score: parsed.score,
        feedback: JSON.parse(JSON.stringify(parsed)),
      })
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);

    return { id: inserted.id, task, feedback: parsed };
  });

export const listLessonEssayAttempts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => getEssayTaskInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("lesson_essay_attempts")
      .select("id, essay_text, score, feedback, created_at")
      .eq("user_id", userId)
      .eq("topic_id", data.topicId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return { attempts: rows ?? [] };
  });

