import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText } from "ai";
import { createGateway, CHAT_MODEL } from "./ai-gateway.server";

const NOTE_STYLES = ["post-it", "notinha", "notepad", "notebook"] as const;

interface SupadataSegment {
  text: string;
  offset: number; // ms
  duration: number; // ms
}

async function fetchSegments(youtubeId: string): Promise<SupadataSegment[]> {
  const apiKey = process.env.SUPADATA_API_KEY;
  if (!apiKey) return [];
  try {
    const url = new URL("https://api.supadata.ai/v1/youtube/transcript");
    url.searchParams.set("videoId", youtubeId);
    url.searchParams.set("lang", "pt");
    url.searchParams.set("text", "false");
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 12_000);
    const res = await fetch(url.toString(), {
      headers: { "x-api-key": apiKey },
      signal: controller.signal,
    });
    clearTimeout(t);
    if (!res.ok) return [];
    const body: any = await res.json().catch(() => ({}));
    if (!Array.isArray(body.content)) return [];
    return body.content
      .map((s: any) => ({
        text: typeof s.text === "string" ? s.text : "",
        offset: typeof s.offset === "number" ? s.offset : 0,
        duration: typeof s.duration === "number" ? s.duration : 0,
      }))
      .filter((s: SupadataSegment) => s.text.trim().length > 0);
  } catch {
    return [];
  }
}

function sliceWindow(segments: SupadataSegment[], seconds: number, windowSec = 10) {
  if (segments.length === 0) return "";
  const startMs = Math.max(0, (seconds - windowSec / 2) * 1000);
  const endMs = (seconds + windowSec / 2) * 1000;
  const inside = segments.filter((s) => s.offset + s.duration >= startMs && s.offset <= endMs);
  return inside.map((s) => s.text.trim()).join(" ").slice(0, 2000);
}

function fmt(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export const listVideoNotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ videoId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("video_notes")
      .select("id, timestamp_seconds, style, ai_explanation, user_note, created_at")
      .eq("video_id", data.videoId)
      .order("timestamp_seconds", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createVideoNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        videoId: z.string().uuid(),
        youtubeId: z.string().min(1),
        videoTitle: z.string().optional().default(""),
        topicTitle: z.string().optional().default(""),
        timestampSeconds: z.number().int().nonnegative(),
        style: z.enum(NOTE_STYLES).default("post-it"),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    // Fetch transcript window (best-effort).
    const segments = await fetchSegments(data.youtubeId);
    const contextText = sliceWindow(segments, data.timestampSeconds, 10);

    // AI explanation.
    let explanation = "";
    try {
      const gateway = createGateway();
      const prompt = contextText
        ? `Você é um professor do ENEM. Explique de forma clara, direta e didática o trecho abaixo (aprox. 10 segundos por volta de ${fmt(data.timestampSeconds)}) do vídeo "${data.videoTitle}"${data.topicTitle ? ` (tópico: ${data.topicTitle})` : ""}.\n\nTrecho da fala:\n"""${contextText}"""\n\nResponda em português, em 2-4 frases curtas, focando no conceito principal desse momento. Não repita o texto literal.`
        : `Você é um professor do ENEM. O aluno marcou o momento ${fmt(data.timestampSeconds)} do vídeo "${data.videoTitle}"${data.topicTitle ? ` (tópico: ${data.topicTitle})` : ""}.\nSem transcrição desse trecho, faça uma nota curta (2-3 frases) sobre o que provavelmente está sendo explicado neste ponto do tópico, para servir de referência de estudo.`;

      const { text } = await generateText({
        model: gateway(CHAT_MODEL),
        prompt,
      });
      explanation = text.trim();
    } catch {
      explanation = "Anotação salva. (Explicação automática indisponível no momento — adicione suas próprias observações abaixo.)";
    }

    const { data: inserted, error } = await context.supabase
      .from("video_notes")
      .insert({
        user_id: context.userId,
        video_id: data.videoId,
        youtube_id: data.youtubeId,
        timestamp_seconds: data.timestampSeconds,
        style: data.style,
        ai_explanation: explanation,
        user_note: "",
      })
      .select("id, timestamp_seconds, style, ai_explanation, user_note, created_at")
      .single();
    if (error) throw new Error(error.message);
    return inserted;
  });

export const updateVideoNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        userNote: z.string().max(4000).optional(),
        style: z.enum(NOTE_STYLES).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const patch: { user_note?: string; style?: string } = {};
    if (data.userNote !== undefined) patch.user_note = data.userNote;
    if (data.style !== undefined) patch.style = data.style;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await context.supabase
      .from("video_notes")
      .update(patch)
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteVideoNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("video_notes")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
