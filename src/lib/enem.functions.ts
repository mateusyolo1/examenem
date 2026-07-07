import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ENEM_API_BASE = "https://api.enem.dev/v1";

interface EnemApiExam {
  title: string;
  year: number;
}

// ============================================================
// List local exams
// ============================================================
export const listEnemExams = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("enem_exams")
      .select("id, year, day, title, total_questions, duration_minutes")
      .order("year", { ascending: false })
      .order("day", { ascending: true });
    if (error) throw new Error(error.message);
    return { exams: data ?? [] };
  });

// ============================================================
// Sync exams from api.enem.dev
// ============================================================
export const syncEnemExams = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const res = await fetch(`${ENEM_API_BASE}/exams`);
    if (!res.ok) throw new Error(`ENEM API falhou: ${res.status}`);
    const exams = (await res.json()) as EnemApiExam[];

    const rows = exams
      .filter((e) => e.year >= 2009 && e.year <= 2024)
      .flatMap((e) => [
        {
          year: e.year,
          day: 1,
          title: `ENEM ${e.year} — 1º dia (Linguagens e Humanas)`,
          total_questions: 90,
          duration_minutes: 330,
        },
        {
          year: e.year,
          day: 2,
          title: `ENEM ${e.year} — 2º dia (Natureza e Matemática)`,
          total_questions: 90,
          duration_minutes: 300,
        },
      ]);

    const { error } = await supabaseAdmin
      .from("enem_exams")
      .upsert(rows, { onConflict: "year,day" });
    if (error) throw new Error(error.message);

    return { synced: rows.length };
  });

// ============================================================
// Sync questions for a specific year+day
// ============================================================
const syncQuestionsInput = z.object({
  year: z.number().int().min(2009).max(2024),
  day: z.union([z.literal(1), z.literal(2)]),
});

export const syncEnemQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => syncQuestionsInput.parse(data))
  .handler(async ({ data, context }) => {
    const { syncQuestionsFor } = await import("./enem-sync.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return syncQuestionsFor(context.supabase, supabaseAdmin, data.year, data.day);
  });

// ============================================================
// Start a simulado session
// ============================================================
const startInput = z.object({
  mode: z.enum(["full_day", "by_area"]),
  year: z.number().int().optional(),
  day: z.union([z.literal(1), z.literal(2)]).optional(),
  area: z.enum(["linguagens", "humanas", "natureza", "matematica"]).optional(),
  count: z.number().int().min(5).max(90).optional(),
  years: z.array(z.number().int()).max(15).optional(),
});

export const startSimuladoReal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => startInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let questionIds: string[] = [];
    let durationMinutes = 0;

    if (data.mode === "full_day") {
      if (!data.year || !data.day) throw new Error("year/day obrigatórios no modo full_day");

      const { count } = await supabase
        .from("enem_questions")
        .select("id", { count: "exact", head: true })
        .eq("year", data.year)
        .eq("day", data.day);
      if (!count || count < 45) {
        const { syncQuestionsFor } = await import("./enem-sync.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await syncQuestionsFor(supabase, supabaseAdmin, data.year, data.day);
      }

      const { data: qs, error } = await supabase
        .from("enem_questions")
        .select("id")
        .eq("year", data.year)
        .eq("day", data.day)
        .order("question_index", { ascending: true })
        .limit(90);
      if (error) throw new Error(error.message);
      questionIds = (qs ?? []).map((q) => q.id);
      durationMinutes = data.day === 1 ? 330 : 300;
    } else {
      if (!data.area || !data.count) throw new Error("area/count obrigatórios no modo by_area");
      let query = supabase
        .from("enem_questions")
        .select("id")
        .eq("area", data.area);
      if (data.years && data.years.length > 0) {
        query = query.in("year", data.years);
      }
      const { data: qs, error } = await query.limit(500);
      if (error) throw new Error(error.message);
      const shuffled = [...(qs ?? [])].sort(() => Math.random() - 0.5);
      questionIds = shuffled.slice(0, data.count).map((q) => q.id);
      durationMinutes = Math.max(15, Math.round(data.count * 2));
    }

    if (questionIds.length === 0) {
      throw new Error("Nenhuma questão disponível — sincronize as provas primeiro");
    }

    const { data: session, error: sessionErr } = await supabase
      .from("simulado_sessions")
      .insert({
        user_id: userId,
        mode: data.mode,
        year: data.year ?? null,
        day: data.day ?? null,
        area: data.area ?? null,
        question_ids: questionIds,
        total_questions: questionIds.length,
        duration_minutes: durationMinutes,
      })
      .select("id")
      .single();
    if (sessionErr) throw new Error(sessionErr.message);

    return { sessionId: session.id, questionIds, durationMinutes };
  });

// ============================================================
// Get questions for a session (batch fetch)
// ============================================================
const questionsInput = z.object({
  sessionId: z.string().uuid(),
});

export const getSimuladoQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => questionsInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: session, error: sErr } = await supabase
      .from("simulado_sessions")
      .select("id, user_id, question_ids, duration_minutes, started_at, finished_at, mode, year, day, area")
      .eq("id", data.sessionId)
      .single();
    if (sErr) throw new Error(sErr.message);
    if (session.user_id !== userId) throw new Error("Não autorizado");

    const { data: questions, error: qErr } = await supabase
      .from("enem_questions")
      .select("id, year, day, question_index, area, discipline, language, context, files, alternative_introduction, alternatives, correct_alternative")
      .in("id", session.question_ids);
    if (qErr) throw new Error(qErr.message);

    const map = new Map((questions ?? []).map((q) => [q.id, q]));
    const ordered = session.question_ids
      .map((id: string) => map.get(id))
      .filter((q): q is NonNullable<typeof q> => Boolean(q));

    return { session, questions: ordered };
  });

// ============================================================
// Submit answer
// ============================================================
const submitInput = z.object({
  sessionId: z.string().uuid(),
  questionId: z.string().uuid(),
  selected: z.string().length(1).nullable(),
  timeSpentSeconds: z.number().int().min(0).max(3600).optional(),
});

export const submitSimuladoAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => submitInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: q, error: qErr } = await supabase
      .from("enem_questions")
      .select("correct_alternative")
      .eq("id", data.questionId)
      .single();
    if (qErr) throw new Error(qErr.message);
    const isCorrect = data.selected ? data.selected === q.correct_alternative : null;

    const { error } = await supabase
      .from("simulado_answers")
      .upsert(
        {
          session_id: data.sessionId,
          user_id: userId,
          question_id: data.questionId,
          selected_alternative: data.selected,
          is_correct: isCorrect,
          time_spent_seconds: data.timeSpentSeconds ?? null,
        },
        { onConflict: "session_id,question_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true, isCorrect };
  });

// ============================================================
// Finish simulado & compute results
// ============================================================
const finishInput = z.object({
  sessionId: z.string().uuid(),
  timeSpentSeconds: z.number().int().min(0),
});

export const finishSimuladoReal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => finishInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: answers, error: aErr } = await supabase
      .from("simulado_answers")
      .select("question_id, selected_alternative, is_correct")
      .eq("session_id", data.sessionId)
      .eq("user_id", userId);
    if (aErr) throw new Error(aErr.message);

    const correctCount = (answers ?? []).filter((a) => a.is_correct).length;
    const answeredCount = (answers ?? []).filter((a) => a.selected_alternative).length;
    const scoreTri = answeredCount === 0
      ? 0
      : Math.min(950, Math.max(200, 300 + correctCount * 8));

    const { error } = await supabase
      .from("simulado_sessions")
      .update({
        finished_at: new Date().toISOString(),
        time_spent_seconds: data.timeSpentSeconds,
        correct_count: correctCount,
        score_tri: scoreTri,
      })
      .eq("id", data.sessionId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);

    return { correctCount, scoreTri };
  });

// ============================================================
// List past sessions
// ============================================================
export const listSimuladoSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("simulado_sessions")
      .select("id, mode, year, day, area, total_questions, correct_count, score_tri, started_at, finished_at, time_spent_seconds")
      .eq("user_id", context.userId)
      .order("started_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return { sessions: data ?? [] };
  });
