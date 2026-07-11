// "Ensinar com vídeo" — gera um ciclo curto de micro-aprendizado a partir
// do trecho do vídeo em que o(a) aluno(a) travou. Não persiste recursos:
// gera on-the-fly (questões, flashcards, mini-mapa) e apenas registra o
// evento na tabela `micro_learning_events` para o Cronograma contar como
// revisão contextual e detectar fraquezas recorrentes.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAiAccess } from "@/lib/ai-access.middleware";
import { generateText, NoObjectGeneratedError, Output } from "ai";
import { createGateway, CHAT_MODEL } from "./ai-gateway.server";

const input = z.object({
  topicId: z.string().min(1),
  youtubeId: z.string().min(4).max(20),
  timestamp: z.number().int().min(0).max(60 * 60 * 6),
  mainTopic: z.string().min(2).max(200),
  subject: z.string().min(2).max(80),
  // Trecho opcional já capturado no cliente. Se vier vazio, tentamos Supadata.
  subtitleSnippet: z.string().max(2000).optional(),
});

export interface MicroLearningQuestion {
  id: string;
  statement: string;
  choices: Array<{ key: "A" | "B" | "C" | "D" | "E"; text: string }>;
  correct: "A" | "B" | "C" | "D" | "E";
  explanation: string;
}

export interface MicroLearningFlashcard {
  front: string;
  back: string;
}

export interface MicroLearningMap {
  central: string;
  branches: Array<{ label: string; children: string[] }>;
}

export interface MicroLearningAnalysis {
  subConcept: string;
  subConceptTerm: string;
  difficulty: "easy" | "medium" | "hard";
  estimatedStudyTime: string;
  tutorPrompt: string;
}

export interface MicroLearningVideo {
  id: string;
  youtubeId: string;
  title: string;
  channelName: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
}

export interface MicroLearningCycle {
  analysis: MicroLearningAnalysis;
  questions: MicroLearningQuestion[];
  flashcards: MicroLearningFlashcard[];
  mindMap: MicroLearningMap;
  videos: MicroLearningVideo[];
  transcriptSource: "client" | "supadata" | "none";
}

// Slice ±10s around the timestamp using Supadata segment offsets (ms).
async function fetchSubtitleSnippet(
  youtubeId: string,
  timestampSec: number,
): Promise<string | null> {
  const apiKey = process.env.SUPADATA_API_KEY;
  if (!apiKey) return null;
  const url = new URL("https://api.supadata.ai/v1/youtube/transcript");
  url.searchParams.set("videoId", youtubeId);
  url.searchParams.set("lang", "pt");
  url.searchParams.set("text", "false");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: { "x-api-key": apiKey },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const body = (await res.json().catch(() => ({}))) as {
      content?:
        | string
        | Array<{ text?: string; offset?: number; duration?: number }>;
    };
    if (typeof body.content === "string") return body.content.slice(0, 800);
    if (!Array.isArray(body.content)) return null;
    const centerMs = timestampSec * 1000;
    const windowMs = 10_000;
    const nearby = body.content.filter((seg) => {
      const off = typeof seg.offset === "number" ? seg.offset : 0;
      return off >= centerMs - windowMs && off <= centerMs + windowMs;
    });
    const text = nearby.map((s) => (s.text ?? "").trim()).filter(Boolean).join(" ");
    return text.length > 0 ? text.slice(0, 800) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const generateMicroLearningCycle = createServerFn({ method: "POST" })
  .middleware([requireAiAccess])
  .inputValidator((data: unknown) => input.parse(data))
  .handler(async ({ data, context }) => {
    // Extraído para variável tipada — o middleware requireAiAccess herda o
    // contexto de requireSupabaseAuth (supabase + userId).
    const { supabase, userId } = context as {
      supabase: import("@supabase/supabase-js").SupabaseClient;
      userId: string;
    };

    // 1) Legenda
    let snippet = (data.subtitleSnippet ?? "").trim();
    let transcriptSource: MicroLearningCycle["transcriptSource"] =
      snippet.length > 0 ? "client" : "none";
    if (!snippet) {
      const fetched = await fetchSubtitleSnippet(data.youtubeId, data.timestamp);
      if (fetched) {
        snippet = fetched;
        transcriptSource = "supadata";
      }
    }

    // 2) Chamada única ao Gemini gerando análise + questões + flashcards + mapa.
    const gateway = createGateway();
    const cycleSchema = z.object({
      subConcept: z.string().min(2).max(160),
      subConceptTerm: z.string().min(2).max(120),
      difficulty: z.enum(["easy", "medium", "hard"]),
      estimatedStudyTime: z.string().min(2).max(40),
      tutorPrompt: z.string().min(10).max(600),
      mindMap: z.object({
        central: z.string().min(2).max(80),
        branches: z
          .array(
            z.object({
              label: z.string().min(2).max(60),
              children: z.array(z.string().min(2).max(60)).max(4),
            }),
          )
          .min(3)
          .max(5),
      }),
      questions: z
        .array(
          z.object({
            statement: z.string().min(10).max(600),
            choices: z
              .array(
                z.object({
                  key: z.enum(["A", "B", "C", "D", "E"]),
                  text: z.string().min(1).max(240),
                }),
              )
              .length(5),
            correct: z.enum(["A", "B", "C", "D", "E"]),
            explanation: z.string().min(5).max(600),
          }),
        )
        .length(3),
      flashcards: z
        .array(
          z.object({
            front: z.string().min(3).max(200),
            back: z.string().min(3).max(400),
          }),
        )
        .length(2),
    });

    const prompt = `Você é um(a) professor(a) brasileiro(a) especialista em ENEM.

O(a) aluno(a) pausou a videoaula no segundo ${data.timestamp} e disse "não entendi isso".
Identifique o SUB-CONCEITO exato que está sendo explicado nesse momento e monte um
ciclo curto de estudo focado APENAS nele (não no tópico inteiro).

CONTEXTO:
- Matéria: ${data.subject}
- Tópico da aula: ${data.mainTopic}
- Trecho da legenda em torno do segundo ${data.timestamp}: "${snippet || "(legenda indisponível — infira pelo tópico)"}"

REGRAS:
- Sub-conceito específico (ex.: "vírgula em apostos explicativos"), NUNCA o tópico inteiro.
- 3 questões objetivas (A–E), no estilo ENEM, focadas SÓ no sub-conceito.
- 2 flashcards curtos (frente = pergunta, verso = resposta objetiva).
- Mini mapa mental: 1 nó central (o sub-conceito) e 3–5 ramos, cada um com até 4 filhos.
- "tutorPrompt" pronto para colar no Tutor IA, começando por "Estou vendo uma aula de ${data.subject} sobre '${data.mainTopic}' e não entendi...".
- Português brasileiro, sem markdown, sem emojis.`;

    let cycle: z.infer<typeof cycleSchema>;
    try {
      const { output } = await generateText({
        model: gateway(CHAT_MODEL),
        output: Output.object({ schema: cycleSchema }),
        prompt,
      });
      cycle = output;
    } catch (err) {
      if (NoObjectGeneratedError.isInstance(err)) {
        throw new Error("A IA não conseguiu montar o ciclo. Tente novamente.");
      }
      throw err;
    }

    // 3) Vídeos curtos do próprio tópico (reaproveita catálogo já indexado).
    let videos: MicroLearningVideo[] = [];
    try {
      const { data: rows } = await supabase
        .from("study_videos")
        .select(
          "id, youtube_id, title, channel_name, thumbnail_url, duration_seconds",
        )
        .eq("topic_id", data.topicId)
        .not("youtube_id", "eq", data.youtubeId)
        .order("sort_order", { ascending: true })
        .limit(30);
      const short = (rows ?? []).filter((v) => {
        const d = v.duration_seconds ?? 0;
        return d > 0 && d <= 8 * 60; // <= 8 min
      });
      videos = short.slice(0, 2).map((v) => ({
        id: v.id,
        youtubeId: v.youtube_id,
        title: v.title ?? "Vídeo do YouTube",
        channelName: v.channel_name,
        thumbnailUrl: v.thumbnail_url,
        durationSeconds: v.duration_seconds,
      }));
    } catch {
      videos = [];
    }

    // 4) Log do evento para o Cronograma contar como "revisão contextual".
    try {
      await supabase.from("micro_learning_events").insert({
        user_id: userId,
        topic_id: data.topicId,
        youtube_id: data.youtubeId,
        timestamp_sec: data.timestamp,
        sub_concept: cycle.subConcept,
        sub_concept_term: cycle.subConceptTerm,
        resources: {
          questions: cycle.questions.length,
          flashcards: cycle.flashcards.length,
          videos: videos.length,
          hasMap: (cycle.mindMap.branches ?? []).length > 0,
        } as never,
      });
    } catch {
      // Não bloqueia a UX se o log falhar.
    }

    const result: MicroLearningCycle = {
      analysis: {
        subConcept: cycle.subConcept,
        subConceptTerm: cycle.subConceptTerm,
        difficulty: cycle.difficulty,
        estimatedStudyTime: cycle.estimatedStudyTime,
        tutorPrompt: cycle.tutorPrompt,
      },
      questions: cycle.questions.map((q, i) => ({ id: `mlq-${i}`, ...q })),
      flashcards: cycle.flashcards,
      mindMap: cycle.mindMap,
      videos,
      transcriptSource,
    };

    return result;
  });
