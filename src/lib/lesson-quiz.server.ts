// Gera atividade de aula chamando Gemini direto no Google AI Studio.
// O Gemini tem suporte nativo a URLs do YouTube (áudio + vídeo), então
// não dependemos de scraping de legenda (que o YouTube bloqueia por IP).

const GOOGLE_MODEL = "gemini-2.5-flash";
const GOOGLE_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GOOGLE_MODEL}:generateContent`;

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

export interface EssayTask {
  title: string;
  prompt: string;
  focusSkill: string;
  rubric: string[];
  minWords: number;
  maxWords: number;
}

export interface LessonQuizPayload {
  questions: QuizQuestion[];
  skipped: { youtubeId: string; title: string; reason: string }[];
  essayTask: EssayTask | null;
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

interface GoogleGenerateContentResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
  error?: { code?: number; message?: string; status?: string };
}

async function callGemini(
  apiKey: string,
  parts: Array<Record<string, unknown>>,
): Promise<string> {
  const res = await fetch(`${GOOGLE_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.4,
      },
    }),
  });

  const raw = await res.text();
  let body: GoogleGenerateContentResponse = {};
  try {
    body = JSON.parse(raw) as GoogleGenerateContentResponse;
  } catch {
    // fallback: leave body empty
  }

  if (!res.ok) {
    const msg = body.error?.message ?? raw.slice(0, 200);
    if (res.status === 429) throw new Error("rate_limit");
    if (res.status === 403) throw new Error(`google_forbidden: ${msg}`);
    if (res.status === 400) throw new Error(`google_bad_request: ${msg}`);
    throw new Error(`google_${res.status}: ${msg}`);
  }

  if (body.promptFeedback?.blockReason) {
    throw new Error(`google_blocked: ${body.promptFeedback.blockReason}`);
  }

  const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text.trim()) {
    const reason = body.candidates?.[0]?.finishReason ?? "sem retorno";
    throw new Error(`google_empty: ${reason}`);
  }
  return text;
}

async function summarizeVideo(
  apiKey: string,
  youtubeId: string,
  videoTitle: string,
  topicCtx: string,
  supabaseAdmin: SupabaseAdmin,
): Promise<VideoSummary> {
  const cacheKey = `video-summary:gemini-yt:v1:${youtubeId}`;
  const { data: cached } = await supabaseAdmin
    .from("ai_response_cache")
    .select("response")
    .eq("cache_key", cacheKey)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (cached) return cached.response as unknown as VideoSummary;

  const youtubeUrl = `https://www.youtube.com/watch?v=${youtubeId}`;
  const prompt = `Você é um assistente que analisa vídeos-aula do YouTube para gerar atividades de estudo.

Assista ao vídeo (áudio e imagem) e resuma o que foi ensinado.

Aula: "${topicCtx}"
Vídeo: "${videoTitle}"

Devolva JSON puro nesta estrutura:
{
  "keyConcepts": ["conceito ensinado no vídeo", "..."],
  "definitions": ["definição ou distinção conceitual explicada", "..."],
  "examples": ["exemplo, exercício resolvido ou caso citado", "..."],
  "timestamps": [{"at": "MM:SS", "note": "conceito explicado nesse momento"}]
}

Regras:
- Inclua 3 a 8 conceitos-chave realmente presentes no vídeo.
- Timestamps devem refletir momentos reais do vídeo (formato "MM:SS" ou "H:MM:SS").
- Se o vídeo não ensinar conteúdo útil sobre "${topicCtx}", devolva arrays vazios.
- Responda em português.`;

  let text: string;
  try {
    text = await callGemini(apiKey, [
      { file_data: { file_uri: youtubeUrl, mime_type: "video/*" } },
      { text: prompt },
    ]);
  } catch (error) {
    throw error instanceof Error ? error : new Error("falha ao analisar vídeo");
  }

  const parsed = parseJsonLoose<VideoSummary>(text);
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
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Chave do Google AI Studio não configurada. Adicione o secret GOOGLE_AI_API_KEY.",
    );
  }

  const summaryResults = await Promise.allSettled(
    videos.map((v) =>
      summarizeVideo(apiKey, v.youtube_id, v.title ?? "Vídeo", topicCtx, supabaseAdmin).then(
        (summary) => ({ video: v, summary }),
      ),
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

    const rawReason =
      result.status === "rejected"
        ? result.reason instanceof Error
          ? result.reason.message
          : "erro"
        : "vídeo sem conteúdo analisável";

    if (rawReason.startsWith("google_forbidden")) {
      throw new Error(
        "Chave do Google AI Studio inválida ou sem permissão. Verifique a GOOGLE_AI_API_KEY.",
      );
    }

    const friendly =
      rawReason === "rate_limit"
        ? "Gemini sobrecarregado — tente de novo em instantes"
        : rawReason.startsWith("google_bad_request")
          ? "Gemini recusou o vídeo (formato não suportado)"
          : rawReason.startsWith("google_blocked")
            ? "Vídeo bloqueado por política de segurança"
            : rawReason.startsWith("google_empty")
              ? "Gemini não conseguiu processar o vídeo"
              : rawReason.startsWith("google_")
                ? "Erro temporário no Gemini"
                : rawReason;

    skipped.push({
      youtubeId: video.youtube_id,
      title: video.title ?? "Vídeo",
      reason: friendly,
    });
  }

  if (successfulSummaries.length === 0) {
    throw new Error(
      "Nenhum vídeo da aula pôde ser analisado pelo Gemini. Sugira novos vídeos e tente novamente.",
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

  const targetCount = successfulSummaries.length;

  const quizPrompt = `Você é professor(a) preparando uma atividade ENEM sobre o tópico "${topicCtx}".

Abaixo estão RESUMOS EXTRAÍDOS DIRETAMENTE dos vídeos-aula que o aluno acabou de assistir. Sua resposta deve conter DUAS partes: um quiz de múltipla escolha E, quando fizer sentido, uma tarefa de escrita focada.

PARTE 1 — QUIZ:
- Gere EXATAMENTE ${targetCount} questões — uma para cada vídeo analisado (na ordem apresentada), cobrindo o conceito principal daquele vídeo.
- Cada questão DEVE indicar qual vídeo a inspirou no campo "videoId" (id EXATO mostrado no resumo).
- Use SOMENTE informações presentes nos resumos. Não invente.
- Se houver timestamp relevante, inclua no campo "timestamp" (formato "MM:SS").
- Nível ENEM: contextualizada, autocontida, testando compreensão.
- Alternativas plausíveis; distratores baseados em erros conceituais comuns.
- A explicação deve citar o conceito/exemplo do vídeo que justifica a resposta.

PARTE 2 — TAREFA DE ESCRITA (essayTask):
- Devolva "essayTask": null SE o conteúdo dos vídeos NÃO se pratica escrevendo (ex.: matemática pura, química de reações, biologia celular sem contextualização, geografia física, física de fórmulas).
- Devolva uma essayTask SEMPRE que o conteúdo se praticar escrevendo: redação, gramática aplicada (pontuação, coesão, concordância em produção), tipologia textual, análise linguística de texto, argumentação, interpretação para escrita, literatura para dissertar, filosofia/sociologia dissertativas, história para dissertação, geografia humana dissertativa.
- A essayTask deve pedir um texto CURTO (60-180 palavras) que EXERCITE ESPECIFICAMENTE o que o vídeo ensinou.
- "focusSkill": frase curta descrevendo a habilidade específica praticada (ex.: "uso de vírgula em orações intercaladas").
- "rubric": 2 a 4 critérios OBJETIVOS e VERIFICÁVEIS SÓ dessa habilidade — não incluir ortografia, acentuação, concordância ou coesão geral, a menos que a habilidade ensinada seja exatamente essa.
- "prompt": enunciado da tarefa (o que escrever e sobre o quê), garantindo que o aluno terá como aplicar a habilidade.

Responda APENAS com JSON válido no formato:
{
  "questions": [
    {"videoId":"...","timestamp":"MM:SS","question":"...","options":["a","b","c","d"],"correctIndex":0,"explanation":"..."}
  ],
  "essayTask": null
}
OU com essayTask preenchida:
{
  "questions": [...],
  "essayTask": {
    "title": "Praticar pontuação em orações intercaladas",
    "prompt": "Escreva um parágrafo de 8 a 12 linhas contando uma experiência marcante, usando pelo menos 2 orações intercaladas isoladas por vírgulas.",
    "focusSkill": "Uso de vírgulas em orações intercaladas e apostos",
    "rubric": [
      "Isolar corretamente ao menos 2 orações intercaladas com vírgulas",
      "Usar aposto explicativo entre vírgulas ao menos uma vez",
      "Não separar sujeito de verbo com vírgula"
    ],
    "minWords": 80,
    "maxWords": 150
  }
}

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
    essayTask?: {
      title?: string;
      prompt?: string;
      focusSkill?: string;
      rubric?: unknown;
      minWords?: number;
      maxWords?: number;
    } | null;
  } = {};


  try {
    const text = await callGemini(apiKey, [{ text: quizPrompt }]);
    quizJson = parseJsonLoose(text);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "erro";
    throw new Error(`Falha ao gerar questões: ${msg}`);
  }

  const rawQuestions = Array.isArray(quizJson.questions) ? quizJson.questions : [];
  const questions: QuizQuestion[] = [];

  for (let i = 0; i < rawQuestions.length && questions.length < targetCount; i++) {
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
    throw new Error("O Gemini não gerou questões válidas. Tente novamente em instantes.");
  }

  // Valida e normaliza essayTask
  let essayTask: EssayTask | null = null;
  const et = quizJson.essayTask;
  if (
    et &&
    typeof et.title === "string" &&
    typeof et.prompt === "string" &&
    typeof et.focusSkill === "string" &&
    Array.isArray(et.rubric) &&
    et.rubric.every((r) => typeof r === "string" && r.trim().length > 0) &&
    et.rubric.length >= 2 &&
    et.rubric.length <= 6
  ) {
    const min = typeof et.minWords === "number" && et.minWords > 0 ? Math.floor(et.minWords) : 60;
    const max =
      typeof et.maxWords === "number" && et.maxWords > min ? Math.floor(et.maxWords) : 180;
    essayTask = {
      title: et.title.trim(),
      prompt: et.prompt.trim(),
      focusSkill: et.focusSkill.trim(),
      rubric: (et.rubric as string[]).map((r) => r.trim()),
      minWords: min,
      maxWords: max,
    };
  }

  return { questions, skipped, essayTask };
}

