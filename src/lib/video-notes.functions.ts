import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText } from "ai";
import { createGateway, CHAT_MODEL } from "./ai-gateway.server";

const NOTE_STYLES = [
  "post-it",
  "notinha",
  "topicos",
  "lembrete",
  "resumo",
  "notepad",
  "notebook",
] as const;
type NoteStyle = (typeof NOTE_STYLES)[number];

// Per-style behavior: how much of the video around the marker to use as
// context, how the AI should phrase the note, and whether to keep bullets.
const STYLE_CONFIG: Record<
  NoteStyle,
  { windowSec: number; keepBullets: boolean; keepLineBreaks: boolean; instruction: string }
> = {
  "post-it": {
    windowSec: 8,
    keepBullets: false,
    keepLineBreaks: false,
    instruction:
      "Escreva UMA única frase curta (máx. 18 palavras) capturando a ideia-chave desse momento. Sem introdução, sem 'nesta parte'.",
  },
  notinha: {
    windowSec: 10,
    keepBullets: false,
    keepLineBreaks: false,
    instruction:
      "Escreva 2-3 frases curtas e diretas, em texto corrido, resumindo o conceito principal.",
  },
  topicos: {
    windowSec: 15,
    keepBullets: true,
    keepLineBreaks: true,
    instruction:
      "Liste 3-5 tópicos objetivos, um por linha, começando com '• '. Cada tópico deve caber em uma linha.",
  },
  lembrete: {
    windowSec: 10,
    keepBullets: false,
    keepLineBreaks: false,
    instruction:
      "Escreva UM lembrete prático de estudo (1-2 frases) começando com 'Lembre-se:'. Foque no que o aluno precisa memorizar ou não esquecer.",
  },
  resumo: {
    windowSec: 25,
    keepBullets: false,
    keepLineBreaks: true,
    instruction:
      "Escreva um resumo em 4-5 frases explicando o conceito, o motivo e um exemplo rápido, se aplicável. Texto corrido em um único parágrafo.",
  },
  notepad: {
    windowSec: 30,
    keepBullets: true,
    keepLineBreaks: true,
    instruction:
      "Estruture as anotações assim (sem markdown pesado): primeira linha em CAIXA ALTA com o tema (máx. 5 palavras); linha em branco; 4-6 tópicos começando com '• '. Direto ao ponto.",
  },
  notebook: {
    windowSec: 60,
    keepBullets: true,
    keepLineBreaks: true,
    instruction:
      "Aja como um professor explicando com maestria ~1 minuto do vídeo. Escreva 4-6 parágrafos aprofundando o conceito, contexto histórico/teórico quando fizer sentido, um exemplo concreto e por que isso cai no ENEM. Ao final, adicione uma linha 'Pontos-chave:' seguida de 3 bullets com '• '. Sem markdown (**, #), mas use quebras de linha entre parágrafos.",
  },
};

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

function sliceWindow(segments: SupadataSegment[], seconds: number, windowSec: number) {
  if (segments.length === 0) return "";
  const startMs = Math.max(0, (seconds - windowSec / 2) * 1000);
  const endMs = (seconds + windowSec / 2) * 1000;
  const inside = segments.filter((s) => s.offset + s.duration >= startMs && s.offset <= endMs);
  return inside.map((s) => s.text.trim()).join(" ").slice(0, 6000);
}

function fmt(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function cleanText(raw: string, cfg: { keepBullets: boolean; keepLineBreaks: boolean }) {
  let out = raw
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(?<!\*)\*(?!\s)([^*\n]+?)(?<!\s)\*(?!\*)/g, "$1")
    .replace(/^#+\s*/gm, "");
  if (cfg.keepBullets) {
    out = out.replace(/^[-*]\s+/gm, "• ");
  } else {
    out = out.replace(/^[-*•]\s+/gm, "");
  }
  if (!cfg.keepLineBreaks) {
    out = out.replace(/\n+/g, " ");
  } else {
    out = out.replace(/\n{3,}/g, "\n\n");
  }
  return out.trim();
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
    const cfg = STYLE_CONFIG[data.style];

    // Fetch transcript window sized by note style.
    const segments = await fetchSegments(data.youtubeId);
    const contextText = sliceWindow(segments, data.timestampSeconds, cfg.windowSec);

    // Greeting only on the FIRST note of the day.
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { count: notesToday } = await context.supabase
      .from("video_notes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .gte("created_at", todayStart.toISOString());

    let greeting = "";
    if ((notesToday ?? 0) === 0) {
      const { data: profile } = await context.supabase
        .from("profiles")
        .select("display_name")
        .eq("id", context.userId)
        .maybeSingle();
      const rawName = (profile?.display_name ?? "").trim();
      const firstName = rawName ? rawName.split(/\s+/)[0] : "";
      const hour = new Date().getHours();
      const period = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
      const openers = firstName
        ? [
            `${period}, ${firstName}! Que bom te ver por aqui de novo.`,
            `Olá, ${firstName}! ${period} — vamos aprender juntos.`,
            `${period}, futuro universitário ${firstName}!`,
          ]
        : [
            `${period}, futuro universitário!`,
            `Olá, futuro universitário! ${period}.`,
            `${period}! Bora estudar juntos.`,
          ];
      greeting = openers[Math.floor(Math.random() * openers.length)];
    }

    // AI explanation, grounded in the exact transcript window.
    let explanation = "";
    try {
      const gateway = createGateway();
      const baseRules =
        "Regras: escreva em português. NÃO use markdown pesado (nada de **, #, tabelas, emojis). Cite fatos apenas do trecho fornecido; se o trecho não disser, mantenha o contexto do tópico do vídeo. Não repita o texto literal — reformule com clareza didática.";

      const header = `Você é um professor do ENEM anotando o momento ${fmt(data.timestampSeconds)} do vídeo "${data.videoTitle}"${data.topicTitle ? ` (tópico: ${data.topicTitle})` : ""}. O aluno escolheu o formato "${data.style}" (janela de ${cfg.windowSec}s ao redor do marcador).`;

      const contextBlock = contextText
        ? `Transcrição do trecho (~${cfg.windowSec}s):\n"""${contextText}"""`
        : `Não há transcrição disponível para esse trecho — use conhecimento geral do tópico "${data.topicTitle || data.videoTitle}" para inferir o conteúdo provável neste momento.`;

      const prompt = `${header}\n\n${baseRules}\n\nInstrução de formato (siga estritamente):\n${cfg.instruction}\n\n${contextBlock}`;

      const { text } = await generateText({
        model: gateway(CHAT_MODEL),
        prompt,
      });
      explanation = cleanText(text, cfg);
    } catch {
      explanation =
        "Anotação salva. (Explicação automática indisponível no momento — adicione suas próprias observações abaixo.)";
    }

    if (greeting) explanation = `${greeting}\n\n${explanation}`;

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
        userNote: z.string().max(8000).optional(),
        style: z.enum(NOTE_STYLES).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const patch: { user_note?: string; style?: string } = {};
    if (data.userNote !== undefined) patch.user_note = data.userNote;
    if (data.style !== undefined) patch.style = data.style;
    if (Object.keys(patch).length === 0) return { ok: true, user_note: undefined, style: undefined };
    const { data: row, error } = await context.supabase
      .from("video_notes")
      .update(patch)
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select("id, user_note, style")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, ...row };
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
