import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/* =========================================================
 * Tipos do conteúdo pedagógico gerado
 * ======================================================= */
export type LousaExercise = {
  enunciado: string;
  resposta: string;
  comentario: string;
};

export type LousaFigure = {
  bookId: string;
  bookTitle: string;
  page: number;
  storagePath: string;
  caption?: string;
  url?: string; // preenchido no read (signed URL 1h)
};

export type LousaLessonContent = {
  materia: string;
  tema: string;
  resumo: string[];
  exercicios: LousaExercise[];
  desafioEnsinar: { pergunta: string; respostaModelo: string };
  referencias?: string[];
  figures?: LousaFigure[];
};

export type LousaContextSnapshot = {
  topicSlug: string | null;
  topicArea: string | null;
  masteryPct: number | null;
  recentErrors: string[];
  watchedVideos: { title: string; channel: string | null }[];
  planTaskTitle: string | null;
  planDate: string | null;
  taskId?: string | null;
};

type PlanTask = {
  id: string;
  date: string;
  title: string;
  area: string;
  type: string;
  minutes: number;
  status: string;
  topicSlug?: string;
  topicArea?: string;
};

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function extractJSON(text: string): string {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  return start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
}

/* =========================================================
 * getLatestLousaSession — última aula ativa do usuário
 * ======================================================= */
export const getLatestLousaSession = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("lousa_sessions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { session: data ?? null };
  });

/* =========================================================
 * getLousaSession — carrega sessão específica
 * ======================================================= */
export const getLousaSession = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ sessionId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("lousa_sessions")
      .select("*")
      .eq("id", data.sessionId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Sessão não encontrada");
    return { session: row };
  });

/* =========================================================
 * generateLousaLesson — cria uma aula personalizada
 *
 * Contexto usado:
 *  - Tópico do dia (user_study_plan.cronograma.tasks) OU parâmetro
 *  - topic_mastery (domínio atual)
 *  - focus_topics recentes (erros)
 *  - vídeos assistidos recentes
 * ======================================================= */
export const generateLousaLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        topicSlug: z.string().optional(),
        topicArea: z.string().optional(),
        tema: z.string().optional(),
        taskId: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    // ---- 0. persistência: se já existe sessão para este taskId, reaproveita ----
    if (data.taskId) {
      const { data: existing } = await supabase
        .from("lousa_sessions")
        .select("*")
        .eq("user_id", userId)
        .contains("context_snapshot", { taskId: data.taskId } as never)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existing) return { session: existing };
    }


    // ---- 1. resolver tópico (parâmetro OU plano do dia) ----
    let topicSlug = data.topicSlug ?? null;
    let topicArea = data.topicArea ?? null;
    let planTaskTitle: string | null = null;
    let planDate: string | null = null;

    if (!topicSlug) {
      const { data: plan } = await supabase
        .from("user_study_plan")
        .select("cronograma")
        .eq("user_id", userId)
        .maybeSingle();
      const tasks = ((plan?.cronograma as { tasks?: PlanTask[] } | null)?.tasks ?? []) as PlanTask[];
      const today = todayISO();
      // prioridade: teoria/videos de hoje com topicSlug
      const todays = tasks.filter((t) => t.date === today && t.topicSlug);
      const pick = todays.find((t) => t.type === "teoria" || t.type === "videos") ?? todays[0];
      if (pick) {
        topicSlug = pick.topicSlug ?? null;
        topicArea = pick.topicArea ?? pick.area ?? null;
        planTaskTitle = pick.title;
        planDate = pick.date;
      }
    }

    // ---- 2. domínio do aluno neste tópico + fracos gerais ----
    let masteryPct: number | null = null;
    if (topicSlug) {
      const { data: m } = await supabase
        .from("topic_mastery")
        .select("last_score")
        .eq("user_id", userId)
        .eq("topic_slug", topicSlug)
        .maybeSingle();
      if (m?.last_score != null) masteryPct = Math.round(Number(m.last_score) * 100);
    }
    const { data: weakList } = await supabase
      .from("topic_mastery")
      .select("topic_slug, last_score")
      .eq("user_id", userId)
      .order("last_score", { ascending: true })
      .limit(6);
    const weakSummary = (weakList ?? [])
      .map((m) => `${m.topic_slug} (${Math.round(Number(m.last_score ?? 0) * 100)}%)`)
      .join(", ");

    // ---- 3. erros recentes (focus_topics em atividades lousa_failure) ----
    const { data: recentActs } = await supabase
      .from("study_plan_activities")
      .select("payload, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    const errorsSet = new Set<string>();
    for (const a of recentActs ?? []) {
      const p = (a.payload ?? {}) as { source?: string; focus_topics?: unknown };
      if (p.source === "lousa_failure" && Array.isArray(p.focus_topics)) {
        for (const t of p.focus_topics) if (typeof t === "string") errorsSet.add(t);
      }
      if (errorsSet.size >= 6) break;
    }
    const recentErrors = Array.from(errorsSet);

    // ---- 4. vídeos assistidos recentemente (opcionalmente do tópico) ----
    const { data: watched } = await supabase
      .from("user_video_progress")
      .select("video_id, last_watched_at, watched, study_videos(title, channel_name, subject_detected)")
      .eq("user_id", userId)
      .eq("watched", true)
      .order("last_watched_at", { ascending: false })
      .limit(8);
    type WatchedRow = {
      study_videos:
        | { title: string | null; channel_name: string | null; subject_detected: string | null }
        | null;
    };
    const watchedVideos = ((watched ?? []) as unknown as WatchedRow[])
      .map((w) => ({
        title: w.study_videos?.title ?? "",
        channel: w.study_videos?.channel_name ?? null,
      }))
      .filter((v) => v.title)
      .slice(0, 5);

    // ---- 5. prompt para IA ----
    const contextSnapshot: LousaContextSnapshot = {
      topicSlug,
      topicArea,
      masteryPct,
      recentErrors,
      watchedVideos,
      planTaskTitle,
      planDate,
      taskId: data.taskId ?? null,
    };

    const domainoDesc =
      masteryPct == null
        ? "sem histórico neste tópico"
        : masteryPct >= 70
          ? `domínio ALTO (${masteryPct}%)`
          : masteryPct >= 40
            ? `domínio MÉDIO (${masteryPct}%)`
            : `domínio BAIXO (${masteryPct}%)`;

    const temaHint = data.tema ?? topicSlug ?? planTaskTitle ?? "Revisão geral ENEM";
    const areaHint = topicArea ?? "Multidisciplinar";

    // RAG: trechos da biblioteca ativa do aluno para embasar a aula
    const { retrieveLibraryContext, libraryMatchesToPrompt } = await import(
      "./library-rag.server"
    );
    const ragQuery = [temaHint, areaHint, ...recentErrors].filter(Boolean).join(" · ");
    const libraryMatches = await retrieveLibraryContext(supabase, userId, ragQuery, 5);
    const libraryCtx = libraryMatchesToPrompt(libraryMatches);

    const prompt = `Você é um professor particular de ENEM montando uma AULA na Lousa Interativa personalizada para este aluno.

CONTEXTO DO ALUNO:
- Tópico do dia (do plano de estudos): ${temaHint}
- Área: ${areaHint}
- Nível de domínio neste tópico: ${domainoDesc}
- Tópicos mais fracos (histórico): ${weakSummary || "sem dados"}
- Erros recentes (lousas passadas): ${recentErrors.join(", ") || "nenhum registrado"}
- Vídeos que o aluno JÁ ASSISTIU: ${
      watchedVideos.length
        ? watchedVideos.map((v) => `"${v.title}"${v.channel ? ` (${v.channel})` : ""}`).join(" | ")
        : "nenhum recente"
    }${libraryCtx}


REGRAS DE AULA:
- Se domínio BAIXO ou sem histórico → aula introdutória, resumo com conceitos-chave (4-5 bullets).
- Se domínio MÉDIO → resumo + foco nos pontos que o aluno costuma errar.
- Se domínio ALTO → aprofundamento, casos avançados, pegadinhas de prova.
- Sempre que possível, REFERENCIE os vídeos assistidos ("como vimos no vídeo X…") para conectar com o histórico.
- Se houver TRECHOS DA BIBLIOTECA DO ALUNO acima, use-os como fonte primária e cite o livro/página no campo "referencias".
- Nível de linguagem: ENEM, direto, sem enrolação.


FORMATO — retorne APENAS JSON válido:
{
  "materia": "string curta (ex: Matemática, Biologia, Redação)",
  "tema": "string curta e específica do tema desta aula",
  "resumo": ["bullet 1", "bullet 2", "bullet 3", "bullet 4"],
  "exercicios": [
    { "enunciado": "questão dissertativa curta", "resposta": "resposta esperada (1-2 frases)", "comentario": "dica pedagógica curta" }
  ],
  "desafioEnsinar": {
    "pergunta": "peça para o aluno explicar o conceito com as próprias palavras",
    "respostaModelo": "resposta ideal do professor"
  },
  "referencias": ["opcional: título de vídeo ou material que o aluno consultou"]
}

Gere 3 exercícios. Não escreva NADA fora do JSON.`;

    const { generateText } = await import("ai");
    const { createGateway, CHAT_MODEL } = await import("./ai-gateway.server");
    const gateway = createGateway();

    const models = ["google/gemini-2.5-flash", CHAT_MODEL, "google/gemini-2.5-flash-lite"];
    let lessonRaw = "";
    let lastErr: unknown = null;
    for (const m of models) {
      try {
        const { text } = await generateText({ model: gateway(m), prompt });
        lessonRaw = text;
        break;
      } catch (e) {
        console.error(`[lousa] modelo ${m} falhou`, e);
        lastErr = e;
      }
    }
    if (!lessonRaw) {
      throw new Error(
        `IA não conseguiu montar a aula (${lastErr instanceof Error ? lastErr.message : "erro desconhecido"}). Tente novamente.`,
      );
    }

    let parsed: LousaLessonContent;
    try {
      parsed = JSON.parse(extractJSON(lessonRaw)) as LousaLessonContent;
    } catch {
      throw new Error("IA retornou JSON inválido. Tente novamente.");
    }

    // sanitização mínima
    const lesson: LousaLessonContent = {
      materia: String(parsed.materia ?? areaHint),
      tema: String(parsed.tema ?? temaHint),
      resumo: Array.isArray(parsed.resumo) ? parsed.resumo.slice(0, 6).map(String) : [],
      exercicios: Array.isArray(parsed.exercicios)
        ? parsed.exercicios.slice(0, 4).map((e) => ({
            enunciado: String(e.enunciado ?? ""),
            resposta: String(e.resposta ?? ""),
            comentario: String(e.comentario ?? ""),
          }))
        : [],
      desafioEnsinar: {
        pergunta: String(parsed.desafioEnsinar?.pergunta ?? "Explique o conceito com suas palavras."),
        respostaModelo: String(parsed.desafioEnsinar?.respostaModelo ?? ""),
      },
      referencias: Array.isArray(parsed.referencias)
        ? parsed.referencias.slice(0, 5).map(String)
        : [],
    };

    if (!lesson.resumo.length || !lesson.exercicios.length) {
      throw new Error("A IA gerou conteúdo incompleto. Tente novamente.");
    }

    // ---- 6. persiste a sessão ----
    const { data: inserted, error: insErr } = await supabase
      .from("lousa_sessions")
      .insert({
        user_id: userId,
        topic_slug: topicSlug,
        topic_area: topicArea,
        materia: lesson.materia,
        tema: lesson.tema,
        content: lesson as never,
        context_snapshot: contextSnapshot as never,
        status: "active",
      })
      .select()
      .single();
    if (insErr) throw new Error(insErr.message);

    return { session: inserted };
  });
