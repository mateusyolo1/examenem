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

