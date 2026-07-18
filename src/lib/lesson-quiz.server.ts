// Gera atividade de aula em duas etapas:
// 1) Resumo por vídeo — Gemini via URL do YouTube. Se falhar, fallback:
//    transcrição via Supadata → Gemini resume o texto.
// 2) Geração das questões e da tarefa de escrita — DeepSeek chat completions.

import { fetchSupadataTranscript } from "./youtube-transcripts.server";
import {
  classifyErrorType,
  logStep,
  logSummary,
  maskYoutubeId,
  newTrace,
  type TraceCounters,
} from "./lesson-quiz-trace.server";

const GOOGLE_MODEL = "gemini-2.5-flash";
const GOOGLE_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GOOGLE_MODEL}:generateContent`;

const DEEPSEEK_MODEL = "deepseek-chat";
const DEEPSEEK_ENDPOINT = "https://api.deepseek.com/v1/chat/completions";

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
  {
    retries = 2,
    timeoutMs = 60_000,
    trace,
    step,
    youtubeId,
  }: {
    retries?: number;
    timeoutMs?: number;
    trace?: TraceCounters;
    step?: string;
    youtubeId?: string;
  } = {},
): Promise<string> {
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (trace && attempt > 0) trace.totalRetries += 1;
    const attemptStart = performance.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(`${GOOGLE_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.4,
          },
        }),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof Error && err.name === "AbortError") {
        const timeoutErr = new Error(`google_timeout_${timeoutMs}ms`);
        if (trace && step) {
          logStep({
            traceId: trace.traceId,
            step,
            status: "error",
            durationMs: performance.now() - attemptStart,
            model: GOOGLE_MODEL,
            attempt,
            errorType: classifyErrorType(timeoutErr),
            youtubeId: maskYoutubeId(youtubeId),
          });
        }
        // Timeout: não tenta de novo (evita multiplicar o tempo pendurado).
        throw timeoutErr;
      }
      if (trace && step) {
        logStep({
          traceId: trace.traceId,
          step,
          status: "error",
          durationMs: performance.now() - attemptStart,
          model: GOOGLE_MODEL,
          attempt,
          errorType: "network",
          youtubeId: maskYoutubeId(youtubeId),
        });
      }
      throw err;
    }
    clearTimeout(timer);

    const raw = await res.text();
    let body: GoogleGenerateContentResponse = {};
    try {
      body = JSON.parse(raw) as GoogleGenerateContentResponse;
    } catch {
      // fallback: leave body empty
    }

    if (!res.ok) {
      const msg = body.error?.message ?? raw.slice(0, 200);
      if (res.status === 429 || res.status === 503) {
        lastErr = new Error("rate_limit");
        if (trace && step) {
          logStep({
            traceId: trace.traceId,
            step,
            status: "error",
            durationMs: performance.now() - attemptStart,
            model: GOOGLE_MODEL,
            attempt,
            errorType: "rate_limit",
            youtubeId: maskYoutubeId(youtubeId),
          });
        }
        if (attempt < retries) {
          const wait = 1500 * (attempt + 1) + Math.random() * 500;
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
        throw lastErr;
      }
      const httpErr =
        res.status === 403
          ? new Error(`google_forbidden: ${msg}`)
          : res.status === 400
            ? new Error(`google_bad_request: ${msg}`)
            : new Error(`google_${res.status}: ${msg}`);
      if (trace && step) {
        logStep({
          traceId: trace.traceId,
          step,
          status: "error",
          durationMs: performance.now() - attemptStart,
          model: GOOGLE_MODEL,
          attempt,
          errorType: classifyErrorType(httpErr),
          youtubeId: maskYoutubeId(youtubeId),
        });
      }
      throw httpErr;
    }

    if (body.promptFeedback?.blockReason) {
      const blockedErr = new Error(`google_blocked: ${body.promptFeedback.blockReason}`);
      if (trace && step) {
        logStep({
          traceId: trace.traceId,
          step,
          status: "error",
          durationMs: performance.now() - attemptStart,
          model: GOOGLE_MODEL,
          attempt,
          errorType: "google_blocked",
          youtubeId: maskYoutubeId(youtubeId),
        });
      }
      throw blockedErr;
    }

    const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    if (!text.trim()) {
      const reason = body.candidates?.[0]?.finishReason ?? "sem retorno";
      const emptyErr = new Error(`google_empty: ${reason}`);
      if (trace && step) {
        logStep({
          traceId: trace.traceId,
          step,
          status: "error",
          durationMs: performance.now() - attemptStart,
          model: GOOGLE_MODEL,
          attempt,
          errorType: "google_empty",
          youtubeId: maskYoutubeId(youtubeId),
        });
      }
      throw emptyErr;
    }
    if (trace && step) {
      logStep({
        traceId: trace.traceId,
        step,
        status: "ok",
        durationMs: performance.now() - attemptStart,
        model: GOOGLE_MODEL,
        attempt,
        youtubeId: maskYoutubeId(youtubeId),
      });
    }
    return text;
  }
  throw lastErr ?? new Error("rate_limit");
}

interface DeepSeekResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string; type?: string };
}

async function callDeepSeek(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  {
    retries = 2,
    temperature = 0.5,
    trace,
    step,
  }: {
    retries?: number;
    temperature?: number;
    trace?: TraceCounters;
    step?: string;
  } = {},
): Promise<string> {
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (trace && attempt > 0) trace.totalRetries += 1;
    const attemptStart = performance.now();
    let res: Response;
    try {
      res = await fetch(DEEPSEEK_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: DEEPSEEK_MODEL,
          temperature,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      });
    } catch (error) {
      lastErr = new Error(
        `deepseek_network: ${error instanceof Error ? error.message : "erro"}`,
      );
      if (trace && step) {
        logStep({
          traceId: trace.traceId,
          step,
          status: "error",
          durationMs: performance.now() - attemptStart,
          model: DEEPSEEK_MODEL,
          attempt,
          errorType: "deepseek_network",
        });
      }
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
      throw lastErr;
    }

    const raw = await res.text();
    let body: DeepSeekResponse = {};
    try {
      body = JSON.parse(raw) as DeepSeekResponse;
    } catch {
      // empty
    }

    if (!res.ok) {
      const msg = body.error?.message ?? raw.slice(0, 200);
      if (res.status === 429 || res.status === 503) {
        lastErr = new Error("deepseek_rate_limit");
        if (trace && step) {
          logStep({
            traceId: trace.traceId,
            step,
            status: "error",
            durationMs: performance.now() - attemptStart,
            model: DEEPSEEK_MODEL,
            attempt,
            errorType: "deepseek_rate_limit",
          });
        }
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
          continue;
        }
        throw lastErr;
      }
      const httpErr =
        res.status === 401 || res.status === 403
          ? new Error(`deepseek_forbidden: ${msg}`)
          : res.status === 402
            ? new Error("deepseek_insufficient_balance: DeepSeek sem créditos")
            : new Error(`deepseek_${res.status}: ${msg}`);
      if (trace && step) {
        logStep({
          traceId: trace.traceId,
          step,
          status: "error",
          durationMs: performance.now() - attemptStart,
          model: DEEPSEEK_MODEL,
          attempt,
          errorType: classifyErrorType(httpErr),
        });
      }
      throw httpErr;
    }

    const text = body.choices?.[0]?.message?.content ?? "";
    if (!text.trim()) {
      const emptyErr = new Error("deepseek_empty");
      if (trace && step) {
        logStep({
          traceId: trace.traceId,
          step,
          status: "error",
          durationMs: performance.now() - attemptStart,
          model: DEEPSEEK_MODEL,
          attempt,
          errorType: "deepseek_empty",
        });
      }
      throw emptyErr;
    }
    if (trace && step) {
      logStep({
        traceId: trace.traceId,
        step,
        status: "ok",
        durationMs: performance.now() - attemptStart,
        model: DEEPSEEK_MODEL,
        attempt,
      });
    }
    return text;
  }
  throw lastErr ?? new Error("deepseek_rate_limit");
}

async function summarizeVideoFromTranscript(
  apiKey: string,
  transcript: string,
  topicCtx: string,
  videoTitle: string,
  opts?: { trace?: TraceCounters; youtubeId?: string },
): Promise<VideoSummary> {
  const prompt = `Você é um assistente que analisa vídeos-aula para gerar atividades de estudo.

Abaixo está a TRANSCRIÇÃO de um vídeo-aula (com timestamps MM:SS quando disponíveis).
Resuma o que foi ensinado.

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
- Inclua 3 a 8 conceitos-chave realmente presentes na transcrição.
- Timestamps devem refletir momentos reais da transcrição (formato "MM:SS" ou "H:MM:SS").
- Se a transcrição não ensinar conteúdo útil sobre "${topicCtx}", devolva arrays vazios.
- Responda em português.

TRANSCRIÇÃO:
${transcript}`;

  const text = await callGemini(apiKey, [{ text: prompt }], {
    trace: opts?.trace,
    step: "gemini-text",
    youtubeId: opts?.youtubeId,
  });
  const parsed = parseJsonLoose<VideoSummary>(text);
  return {
    keyConcepts: Array.isArray(parsed.keyConcepts) ? parsed.keyConcepts : [],
    definitions: Array.isArray(parsed.definitions) ? parsed.definitions : [],
    examples: Array.isArray(parsed.examples) ? parsed.examples : [],
    timestamps: Array.isArray(parsed.timestamps) ? parsed.timestamps : [],
  };
}

async function summarizeVideo(
  apiKey: string,
  youtubeId: string,
  videoTitle: string,
  topicCtx: string,
  supabaseAdmin: SupabaseAdmin,
): Promise<{ summary: VideoSummary; source: "gemini-yt" | "supadata" }> {
  // 1) Try Gemini with direct YouTube URL (cheapest, best quality when it works)
  const cacheKeyYt = `video-summary:gemini-yt:v1:${youtubeId}`;
  const { data: cachedYt } = await supabaseAdmin
    .from("ai_response_cache")
    .select("response")
    .eq("cache_key", cacheKeyYt)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (cachedYt) return { summary: cachedYt.response as unknown as VideoSummary, source: "gemini-yt" };

  const cacheKeySd = `video-summary:supadata:v1:${youtubeId}`;
  const { data: cachedSd } = await supabaseAdmin
    .from("ai_response_cache")
    .select("response")
    .eq("cache_key", cacheKeySd)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (cachedSd) return { summary: cachedSd.response as unknown as VideoSummary, source: "supadata" };

  const youtubeUrl = `https://www.youtube.com/watch?v=${youtubeId}`;
  const geminiPrompt = `Você é um assistente que analisa vídeos-aula do YouTube para gerar atividades de estudo.

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

  let firstError: Error | null = null;
  try {
    const text = await callGemini(
      apiKey,
      [
        { file_data: { file_uri: youtubeUrl, mime_type: "video/*" } },
        { text: geminiPrompt },
      ],
      { retries: 0, timeoutMs: 8_000 },
    );
    const parsed = parseJsonLoose<VideoSummary>(text);
    const summary: VideoSummary = {
      keyConcepts: Array.isArray(parsed.keyConcepts) ? parsed.keyConcepts : [],
      definitions: Array.isArray(parsed.definitions) ? parsed.definitions : [],
      examples: Array.isArray(parsed.examples) ? parsed.examples : [],
      timestamps: Array.isArray(parsed.timestamps) ? parsed.timestamps : [],
    };
    if (summary.keyConcepts.length > 0) {
      await supabaseAdmin.from("ai_response_cache").insert({
        cache_key: cacheKeyYt,
        prompt_type: "video-summary",
        response: JSON.parse(JSON.stringify(summary)),
      });
      return { summary, source: "gemini-yt" };
    }
    firstError = new Error("gemini_no_content");
  } catch (error) {
    firstError = error instanceof Error ? error : new Error("gemini_failed");
    if (firstError.message.startsWith("google_timeout_")) {
      console.warn(
        `[lesson-quiz] Gemini multimodal timeout em ${youtubeId}, fallback Supadata`,
      );
      // segue pra Supadata
    } else {
      // rate_limit e forbidden não devem cair pra fallback — são bloqueios da conta
      if (firstError.message === "rate_limit") throw firstError;
      if (firstError.message.startsWith("google_forbidden")) throw firstError;
    }
  }

  // 2) Fallback: Supadata → Gemini resume o texto
  const transcript = await fetchSupadataTranscript(youtubeId);
  const summary = await summarizeVideoFromTranscript(
    apiKey,
    transcript.text,
    topicCtx,
    videoTitle,
  );

  if (summary.keyConcepts.length === 0) {
    throw firstError ?? new Error("sem conteúdo útil no vídeo");
  }

  await supabaseAdmin.from("ai_response_cache").insert({
    cache_key: cacheKeySd,
    prompt_type: "video-summary",
    response: JSON.parse(JSON.stringify(summary)),
  });

  return { summary, source: "supadata" };
}

function buildQuizSystemPrompt(topicCtx: string, targetCount: number): string {
  return `Você é professor(a) preparando uma atividade ENEM sobre o tópico "${topicCtx}".

Sua resposta deve conter DUAS partes: um quiz de múltipla escolha E, quando fizer sentido, uma tarefa de escrita focada.

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
- Devolva uma essayTask SEMPRE que o conteúdo se praticar escrevendo: redação, gramática aplicada, tipologia textual, análise linguística, argumentação, interpretação para escrita, literatura para dissertar, filosofia/sociologia dissertativas, história para dissertação, geografia humana dissertativa.
- A essayTask deve pedir um texto CURTO (60-180 palavras) que EXERCITE ESPECIFICAMENTE o que o vídeo ensinou.
- "focusSkill": frase curta descrevendo a habilidade específica praticada.
- "rubric": 2 a 4 critérios OBJETIVOS e VERIFICÁVEIS SÓ dessa habilidade.
- "prompt": enunciado da tarefa (o que escrever e sobre o quê).

Responda APENAS com JSON válido no formato exato:
{
  "questions": [
    {"videoId":"...","timestamp":"MM:SS","question":"...","options":["a","b","c","d"],"correctIndex":0,"explanation":"..."}
  ],
  "essayTask": null
}`;
}

interface QuizJson {
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
  const googleKey = process.env.GOOGLE_AI_API_KEY;
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  if (!googleKey) {
    throw new Error(
      "Chave do Google AI Studio não configurada. Adicione o secret GOOGLE_AI_API_KEY.",
    );
  }
  if (!deepseekKey) {
    throw new Error("DEEPSEEK_API_KEY não configurado.");
  }

  const summaryResults = await Promise.allSettled(
    videos.map((v) =>
      summarizeVideo(googleKey, v.youtube_id, v.title ?? "Vídeo", topicCtx, supabaseAdmin).then(
        ({ summary }) => ({ video: v, summary }),
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
    if (rawReason.startsWith("supadata_forbidden")) {
      throw new Error(
        "Chave do Supadata inválida ou sem permissão. Verifique a SUPADATA_API_KEY.",
      );
    }

    const friendly =
      rawReason === "rate_limit"
        ? "Gemini sobrecarregado — tente de novo em instantes"
        : rawReason === "supadata_rate_limit"
          ? "Supadata sobrecarregado — tente de novo em instantes"
          : rawReason.startsWith("supadata_not_found")
            ? "Sem transcrição disponível para esse vídeo"
            : rawReason.startsWith("supadata_empty")
              ? "Vídeo sem legenda utilizável"
              : rawReason.startsWith("supadata_network")
                ? "Falha de rede ao buscar transcrição"
                : rawReason.startsWith("supadata_")
                  ? "Erro no serviço de transcrição"
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
      "Nenhum vídeo da aula pôde ser analisado. Sugira novos vídeos e tente novamente.",
    );
  }

  const buildCombined = (
    summaries: { video: LessonVideo; summary: VideoSummary }[],
  ): string =>
    summaries
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
  const combined = buildCombined(successfulSummaries);

  // Chamada principal — DeepSeek gera todas as questões + essayTask
  let quizJson: QuizJson = {};
  try {
    const systemPrompt = buildQuizSystemPrompt(topicCtx, targetCount);
    const userPrompt = `RESUMOS DOS VÍDEOS:\n${combined}`;
    const text = await callDeepSeek(deepseekKey, systemPrompt, userPrompt);
    quizJson = parseJsonLoose(text);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "erro";
    const friendly =
      msg === "deepseek_rate_limit"
        ? "DeepSeek está sobrecarregado. Aguarde alguns segundos e tente de novo."
        : msg.startsWith("deepseek_insufficient_balance")
          ? "DeepSeek sem créditos. Recarregue sua conta."
          : msg.startsWith("deepseek_forbidden")
            ? "DEEPSEEK_API_KEY inválida. Verifique a chave."
            : `Falha ao gerar questões: ${msg}`;
    throw new Error(friendly);
  }

  const rawQuestions = Array.isArray(quizJson.questions) ? quizJson.questions : [];
  const questions: QuizQuestion[] = [];
  const usedVideoIds = new Set<string>();

  for (const q of rawQuestions) {
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
    const matched =
      successfulSummaries.find((s) => s.video.id === q.videoId) ??
      successfulSummaries.find((s) => !usedVideoIds.has(s.video.id)) ??
      successfulSummaries[questions.length % successfulSummaries.length];
    usedVideoIds.add(matched.video.id);
    questions.push({
      id: `q${questions.length + 1}`,
      question: q.question,
      options: q.options,
      correctIndex: q.correctIndex,
      explanation: q.explanation,
      videoRef: {
        videoId: matched.video.id,
        youtubeId: matched.video.youtube_id,
        videoTitle: matched.video.title ?? "Vídeo",
        timestamp: typeof q.timestamp === "string" ? q.timestamp : undefined,
      },
    });
    if (questions.length >= targetCount) break;
  }

  // Reforço: se DeepSeek entregou menos questões que vídeos, gera 1 questão
  // extra por vídeo órfão em chamada secundária.
  const orphanSummaries = successfulSummaries.filter((s) => !usedVideoIds.has(s.video.id));
  if (orphanSummaries.length > 0) {
    try {
      const systemPrompt = buildQuizSystemPrompt(topicCtx, orphanSummaries.length);
      const userPrompt = `RESUMOS DOS VÍDEOS (gere UMA questão por vídeo, use o id exato no campo videoId; não inclua essayTask):\n${buildCombined(orphanSummaries)}`;
      const text = await callDeepSeek(deepseekKey, systemPrompt, userPrompt, {
        temperature: 0.6,
      });
      const extra = parseJsonLoose<QuizJson>(text);
      const rawExtra = Array.isArray(extra.questions) ? extra.questions : [];
      for (const q of rawExtra) {
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
        const matched =
          orphanSummaries.find((s) => s.video.id === q.videoId && !usedVideoIds.has(s.video.id)) ??
          orphanSummaries.find((s) => !usedVideoIds.has(s.video.id));
        if (!matched) break;
        usedVideoIds.add(matched.video.id);
        questions.push({
          id: `q${questions.length + 1}`,
          question: q.question,
          options: q.options,
          correctIndex: q.correctIndex,
          explanation: q.explanation,
          videoRef: {
            videoId: matched.video.id,
            youtubeId: matched.video.youtube_id,
            videoTitle: matched.video.title ?? "Vídeo",
            timestamp: typeof q.timestamp === "string" ? q.timestamp : undefined,
          },
        });
      }
    } catch {
      // se a chamada de reforço falhar, seguimos com o que temos
    }
  }

  if (questions.length === 0) {
    throw new Error("O DeepSeek não gerou questões válidas. Tente novamente em instantes.");
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
