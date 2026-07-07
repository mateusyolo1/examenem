import { generateText } from "ai";
import { createGateway } from "./ai-gateway.server";
import { fetchYoutubeTranscriptText } from "./youtube-transcripts.server";

const VIDEO_MODEL = "google/gemini-2.5-flash-lite";

interface VideoSummary {
  keyConcepts: string[];
  definitions: string[];
  examples: string[];
  timestamps: { at: string; note: string }[];
}

interface LessonVideo {
  id: string;
  youtube_id: string;
  title: string | null;
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

export interface LessonQuizPayload {
  questions: QuizQuestion[];
  skipped: { youtubeId: string; title: string; reason: string }[];
}

type SupabaseAdmin = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];

function parseJsonLoose<T>(text: string): T {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const slice = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
  return JSON.parse(slice) as T;
}

function normalizeGatewayError(error: unknown) {
  const message = error instanceof Error ? error.message : "erro desconhecido";
  if (message.includes("429") || message.toLowerCase().includes("rate")) return "rate_limit";
  if (message.includes("402") || message.toLowerCase().includes("credit")) return "credits_exhausted";
  return message;
}

async function summarizeVideo(
  youtubeId: string,
  videoTitle: string,
  topicCtx: string,
  supabaseAdmin: SupabaseAdmin,
): Promise<VideoSummary> {
  const cacheKey = `video-summary:transcript:v2:${youtubeId}`;
  const { data: cached } = await supabaseAdmin
    .from("ai_response_cache")
    .select("response")
    .eq("cache_key", cacheKey)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (cached) return cached.response as unknown as VideoSummary;

  const transcript = await fetchYoutubeTranscriptText(youtubeId);
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
    throw new Error(normalizeGatewayError(error));
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

export async function buildLessonQuizPayload({
  topicCtx,
  videos,
  supabaseAdmin,
}: {
  topicCtx: string;
  videos: LessonVideo[];
  supabaseAdmin: SupabaseAdmin;
}): Promise<LessonQuizPayload> {
  const summaryResults = await Promise.allSettled(
    videos.map((v) =>
      summarizeVideo(v.youtube_id, v.title ?? "Vídeo", topicCtx, supabaseAdmin).then((summary) => ({
        video: v,
        summary,
      })),
    ),
  );

  const successfulSummaries: { video: LessonVideo; summary: VideoSummary }[] = [];
  const skipped: LessonQuizPayload["skipped"] = [];

  for (let i = 0; i < summaryResults.length; i++) {
    const result = summaryResults[i];
    const video = videos[i];
    if (result.status === "fulfilled" && result.value.summary.keyConcepts.length > 0) {
      successfulSummaries.push(result.value);
      continue;
    }

    const reason =
      result.status === "rejected"
        ? result.reason instanceof Error
          ? result.reason.message
          : "erro"
        : "legenda sem conteúdo analisável";

    if (reason === "credits_exhausted") {
      throw new Error(
        "Créditos de IA esgotados neste mês. Adicione créditos ou tente novamente no próximo ciclo.",
      );
    }

    skipped.push({
      youtubeId: video.youtube_id,
      title: video.title ?? "Vídeo",
      reason:
        reason === "rate_limit"
          ? "IA sobrecarregada — tente de novo em instantes"
          : reason.startsWith("gateway_")
            ? "Legenda não pôde ser processada"
            : reason,
    });
  }

  if (successfulSummaries.length === 0) {
    throw new Error(
      "Nenhum vídeo da aula possui legenda analisável. Sugira novos vídeos e tente novamente.",
    );
  }

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

Abaixo estão RESUMOS EXTRAÍDOS DIRETAMENTE das legendas dos vídeos-aula que o aluno acabou de assistir. Gere EXATAMENTE 3 questões de múltipla escolha (4 alternativas cada, apenas uma correta) baseadas RIGOROSAMENTE no conteúdo desses resumos.

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
    const gateway = createGateway();
    const { text } = await generateText({
      model: gateway(VIDEO_MODEL),
      prompt: quizPrompt,
    });
    quizJson = parseJsonLoose(text);
  } catch (error) {
    throw new Error(`Falha ao gerar questões: ${normalizeGatewayError(error)}`);
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

  return { questions, skipped };
}