import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/* =========================================================
 * Ritmo semanal fixo (0=Dom … 6=Sáb)
 * ======================================================= */
export type ActivityKind = "videos" | "lousa" | "treino" | "flashcards" | "simulado";

const WEEK_PATTERN: Record<number, ActivityKind[]> = {
  0: ["simulado"],
  1: ["videos", "lousa"],
  2: ["videos", "treino", "lousa"],
  3: ["videos", "lousa"],
  4: ["videos", "treino", "lousa"],
  5: ["videos", "flashcards"],
  6: ["simulado"],
};

export const PRESSURE_LEVELS = [
  { level: 1, label: "Iniciante", questions: 5, minutes: 10, upThreshold: 80 },
  { level: 2, label: "Básico", questions: 8, minutes: 12, upThreshold: 75 },
  { level: 3, label: "Intermediário", questions: 10, minutes: 12, upThreshold: 70 },
  { level: 4, label: "Avançado", questions: 12, minutes: 10, upThreshold: 65 },
  { level: 5, label: "ENEM", questions: 15, minutes: 9, upThreshold: 100 },
] as const;

const DOWN_THRESHOLD = 40;
const LOUSA_LOCK_MS = 24 * 60 * 60 * 1000;

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/* =========================================================
 * ensureTodayPlan — cria o dia + atividades se ainda não existirem
 * ======================================================= */
export const ensureTodayPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const date = todayISO();
    const weekday = new Date(date + "T00:00:00").getDay();

    // day
    const { data: existing } = await supabase
      .from("study_plan_days")
      .select("*")
      .eq("user_id", userId)
      .eq("plan_date", date)
      .eq("kind", "regular")
      .maybeSingle();

    let day = existing;
    if (!day) {
      const { data: inserted, error } = await supabase
        .from("study_plan_days")
        .insert({ user_id: userId, plan_date: date, kind: "regular", unlocked_at: new Date().toISOString() })
        .select()
        .single();
      if (error) throw new Error(error.message);
      day = inserted;

      const kinds = WEEK_PATTERN[weekday] ?? [];
      if (kinds.length) {
        const rows = kinds.map((kind, i) => ({
          day_id: day!.id,
          user_id: userId,
          order_index: i,
          kind,
          status: "pending",
          payload: {},
        }));
        const { error: aerr } = await supabase.from("study_plan_activities").insert(rows);
        if (aerr) throw new Error(aerr.message);
      }
    }

    return { dayId: day!.id, date };
  });

/* =========================================================
 * getTodayPlan
 * ======================================================= */
export const getTodayPlan = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const date = todayISO();

    // pega TODOS os dias de hoje (regular + reforço) ordenados
    const { data: days, error } = await supabase
      .from("study_plan_days")
      .select("*")
      .eq("user_id", userId)
      .eq("plan_date", date)
      .order("kind", { ascending: false }); // reforco antes de regular (r < g)
    if (error) throw new Error(error.message);

    const dayIds = (days ?? []).map((d) => d.id);
    let activities: Array<{
      id: string;
      day_id: string;
      kind: ActivityKind;
      order_index: number;
      status: string;
      payload: Record<string, unknown>;
      generated_at: string | null;
      submitted_at: string | null;
      score: number | null;
      passed: boolean | null;
    }> = [];
    if (dayIds.length) {
      const { data: acts, error: aerr } = await supabase
        .from("study_plan_activities")
        .select("*")
        .in("day_id", dayIds)
        .order("order_index", { ascending: true });
      if (aerr) throw new Error(aerr.message);
      activities = (acts ?? []) as typeof activities;
    }

    // settings
    const { data: settings } = await supabase
      .from("user_study_settings")
      .select("lousa_pass_threshold")
      .eq("user_id", userId)
      .maybeSingle();

    // pressure
    const { data: pressure } = await supabase
      .from("user_pressure_level")
      .select("level, wins_streak, last_result")
      .eq("user_id", userId)
      .maybeSingle();

    return {
      date,
      days: days ?? [],
      activities,
      lousaThreshold: settings?.lousa_pass_threshold ?? 60,
      pressureLevel: pressure?.level ?? 1,
      pressureStreak: pressure?.wins_streak ?? 0,
      pressureLevels: PRESSURE_LEVELS,
    };
  });

/* =========================================================
 * updateSettings
 * ======================================================= */
export const updateStudySettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ lousaPassThreshold: z.number().int().min(30).max(100) }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("user_study_settings").upsert(
      { user_id: userId, lousa_pass_threshold: data.lousaPassThreshold },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* =========================================================
 * markSimpleActivityDone (videos, flashcards, simulado)
 * ======================================================= */
export const markSimpleActivityDone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ activityId: z.string().uuid(), score: z.number().optional() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("study_plan_activities")
      .update({
        status: "done",
        submitted_at: new Date().toISOString(),
        score: data.score ?? null,
        passed: true,
      })
      .eq("id", data.activityId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* =========================================================
 * submitPressureResult — atualiza nível conforme desempenho
 * ======================================================= */
export const submitPressureResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ activityId: z.string().uuid(), correct: z.number().int().min(0), total: z.number().int().min(1) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const pct = Math.round((data.correct / data.total) * 100);

    const { data: cur } = await supabase
      .from("user_pressure_level")
      .select("level, wins_streak")
      .eq("user_id", userId)
      .maybeSingle();

    let level = cur?.level ?? 1;
    let streak = cur?.wins_streak ?? 0;
    const spec = PRESSURE_LEVELS.find((l) => l.level === level)!;

    let movement: "up" | "down" | "hold" = "hold";
    if (pct < DOWN_THRESHOLD && level > 1) {
      level -= 1;
      streak = 0;
      movement = "down";
    } else if (pct >= spec.upThreshold && level < 5) {
      streak += 1;
      if (streak >= 2) {
        level += 1;
        streak = 0;
        movement = "up";
      }
    } else if (pct >= spec.upThreshold) {
      streak += 1;
    } else {
      streak = 0;
    }

    const { error: perr } = await supabase.from("user_pressure_level").upsert(
      { user_id: userId, level, wins_streak: streak, last_result: pct },
      { onConflict: "user_id" },
    );
    if (perr) throw new Error(perr.message);

    const { error: aerr } = await supabase
      .from("study_plan_activities")
      .update({
        status: "done",
        submitted_at: new Date().toISOString(),
        score: pct,
        passed: pct >= DOWN_THRESHOLD,
      })
      .eq("id", data.activityId)
      .eq("user_id", userId);
    if (aerr) throw new Error(aerr.message);

    return { ok: true, level, streak, movement, pct };
  });

/* =========================================================
 * generateLousa — cria 5 questões via IA
 * ======================================================= */
export const generateLousa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ activityId: z.string().uuid(), reforco: z.boolean().optional() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    const { data: act, error: aerr } = await supabase
      .from("study_plan_activities")
      .select("*")
      .eq("id", data.activityId)
      .eq("user_id", userId)
      .single();
    if (aerr || !act) throw new Error("Atividade não encontrada");
    if (act.kind !== "lousa") throw new Error("Atividade não é uma Lousa");
    if (act.generated_at) {
      const { data: qs } = await supabase
        .from("lousa_questions")
        .select("*")
        .eq("activity_id", act.id)
        .order("order_index");
      return { activity: act, questions: qs ?? [] };
    }

    const numQ = data.reforco ? 3 : 5;

    // contexto do aluno: pega últimos 20 tópicos com pior desempenho
    const { data: mastery } = await supabase
      .from("topic_mastery")
      .select("topic_id, accuracy, attempts")
      .eq("user_id", userId)
      .order("accuracy", { ascending: true })
      .limit(20);

    const contextStr = (mastery ?? [])
      .slice(0, 8)
      .map((m) => `${m.topic_id} (${Math.round((m.accuracy ?? 0) * 100)}%)`)
      .join(", ");

    const { generateText } = await import("ai");
    const { createGateway, CHAT_MODEL } = await import("./ai-gateway.server");
    const gateway = createGateway();

    const prompt = `Você é um professor de ENEM. Gere ${numQ} questões dissertativas curtas (uma frase de enunciado + resposta esperada) para lição de casa da Lousa.
${data.reforco ? "MODO REFORÇO — foque em conceitos que o aluno errou anteriormente." : ""}
Tópicos com pior desempenho do aluno: ${contextStr || "sem histórico"}.

Retorne APENAS JSON válido, no formato:
{"questoes":[{"enunciado":"...","gabarito":"...","topico":"..."}, ...]}

Regras: gabarito objetivo (1-3 frases), variar áreas (Matemática/Linguagens/Humanas/Natureza), nível ENEM.`;

    const { text } = await generateText({ model: gateway(CHAT_MODEL), prompt });
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    const slice = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
    let parsed: { questoes?: Array<{ enunciado: string; gabarito: string; topico?: string }> } = {};
    try {
      parsed = JSON.parse(slice);
    } catch {
      throw new Error("IA retornou JSON inválido. Tente novamente.");
    }
    const list = (parsed.questoes ?? []).slice(0, numQ);
    if (!list.length) throw new Error("IA não gerou questões. Tente novamente.");

    const rows = list.map((q, i) => ({
      activity_id: act.id,
      user_id: userId,
      order_index: i,
      enunciado: q.enunciado,
      gabarito: q.gabarito,
      topico: q.topico ?? null,
    }));
    const { error: qerr } = await supabase.from("lousa_questions").insert(rows);
    if (qerr) throw new Error(qerr.message);

    const nowIso = new Date().toISOString();
    const { error: uerr } = await supabase
      .from("study_plan_activities")
      .update({
        generated_at: nowIso,
        status: "in_progress",
        payload: { ...(act.payload as object), reforco: data.reforco ?? false },
      })
      .eq("id", act.id);
    if (uerr) throw new Error(uerr.message);

    const { data: qs } = await supabase
      .from("lousa_questions")
      .select("*")
      .eq("activity_id", act.id)
      .order("order_index");

    return {
      activity: { ...act, generated_at: nowIso, status: "in_progress" },
      questions: qs ?? [],
    };
  });

/* =========================================================
 * getLousa — leitura para a rota de resposta
 * ======================================================= */
export const getLousa = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ activityId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: act } = await supabase
      .from("study_plan_activities")
      .select("*")
      .eq("id", data.activityId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!act) throw new Error("Atividade não encontrada");
    const { data: qs } = await supabase
      .from("lousa_questions")
      .select("*")
      .eq("activity_id", act.id)
      .order("order_index");
    const { data: settings } = await supabase
      .from("user_study_settings")
      .select("lousa_pass_threshold")
      .eq("user_id", userId)
      .maybeSingle();

    const isReforco = Boolean((act.payload as { reforco?: boolean })?.reforco);
    const generatedAt = act.generated_at ? new Date(act.generated_at).getTime() : null;
    const unlocksAt = !isReforco && generatedAt ? generatedAt + LOUSA_LOCK_MS : null;

    return {
      activity: act,
      questions: qs ?? [],
      threshold: settings?.lousa_pass_threshold ?? 60,
      unlocksAt,
      isReforco,
      nowMs: Date.now(),
    };
  });

/* =========================================================
 * submitLousaAnswers — valida 24h, corrige via IA
 * ======================================================= */
export const submitLousaAnswers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        activityId: z.string().uuid(),
        answers: z.array(z.object({ questionId: z.string().uuid(), answer: z.string().max(3000) })).min(1),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: act } = await supabase
      .from("study_plan_activities")
      .select("*")
      .eq("id", data.activityId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!act) throw new Error("Atividade não encontrada");
    if (act.status === "done") throw new Error("Atividade já concluída");

    const isReforco = Boolean((act.payload as { reforco?: boolean })?.reforco);
    if (!isReforco && act.generated_at) {
      const elapsed = Date.now() - new Date(act.generated_at).getTime();
      if (elapsed < LOUSA_LOCK_MS) {
        const hours = Math.ceil((LOUSA_LOCK_MS - elapsed) / (60 * 60 * 1000));
        throw new Error(`Aguarde ${hours}h para enviar as respostas.`);
      }
    }

    const { data: qs } = await supabase
      .from("lousa_questions")
      .select("*")
      .eq("activity_id", act.id)
      .order("order_index");
    if (!qs?.length) throw new Error("Sem questões");

    // corrige via IA em batch único
    const items = qs.map((q) => {
      const a = data.answers.find((x) => x.questionId === q.id);
      return { id: q.id, enunciado: q.enunciado, gabarito: q.gabarito, resposta: a?.answer ?? "" };
    });

    const { generateText } = await import("ai");
    const { createGateway, CHAT_MODEL } = await import("./ai-gateway.server");
    const gateway = createGateway();

    const prompt = `Você é um corretor rigoroso de ENEM. Para cada questão abaixo, decida se a resposta do aluno demonstra compreensão do gabarito (aceite equivalência conceitual — não exija cópia literal). Devolva APENAS JSON no formato:
{"correcoes":[{"id":"...","correta":true,"feedback":"1 frase explicando por que"}]}

Questões:
${items.map((i, n) => `${n + 1}) [id=${i.id}] Enunciado: ${i.enunciado}\nGabarito: ${i.gabarito}\nResposta do aluno: ${i.resposta || "(em branco)"}`).join("\n\n")}`;

    const { text } = await generateText({ model: gateway(CHAT_MODEL), prompt });
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    const slice = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
    let parsed: { correcoes?: Array<{ id: string; correta: boolean; feedback: string }> } = {};
    try {
      parsed = JSON.parse(slice);
    } catch {
      throw new Error("Correção IA falhou. Tente novamente.");
    }
    const corr = parsed.correcoes ?? [];

    let correctCount = 0;
    for (const q of qs) {
      const ans = data.answers.find((x) => x.questionId === q.id);
      const c = corr.find((x) => x.id === q.id);
      const correct = Boolean(c?.correta);
      if (correct) correctCount += 1;
      await supabase
        .from("lousa_questions")
        .update({
          user_answer: ans?.answer ?? "",
          correct,
          feedback: c?.feedback ?? "",
        })
        .eq("id", q.id);
    }

    const pct = Math.round((correctCount / qs.length) * 100);
    const { data: settings } = await supabase
      .from("user_study_settings")
      .select("lousa_pass_threshold")
      .eq("user_id", userId)
      .maybeSingle();
    const threshold = settings?.lousa_pass_threshold ?? 60;
    const passed = pct >= threshold;

    await supabase
      .from("study_plan_activities")
      .update({
        status: passed ? "done" : "failed",
        submitted_at: new Date().toISOString(),
        score: pct,
        passed,
      })
      .eq("id", act.id);

    // se falhou e NÃO é reforço, cria atividade de reforço no mesmo dia
    let reforcoActivityId: string | null = null;
    if (!passed && !isReforco) {
      const wrongTopics = qs
        .filter((q) => {
          const c = corr.find((x) => x.id === q.id);
          return !c?.correta;
        })
        .map((q) => q.topico)
        .filter(Boolean);

      const { data: nextOrder } = await supabase
        .from("study_plan_activities")
        .select("order_index")
        .eq("day_id", act.day_id)
        .order("order_index", { ascending: false })
        .limit(1);
      const nextIdx = (nextOrder?.[0]?.order_index ?? 0) + 1;

      const { data: inserted } = await supabase
        .from("study_plan_activities")
        .insert({
          day_id: act.day_id,
          user_id: userId,
          order_index: nextIdx,
          kind: "lousa",
          status: "pending",
          payload: { reforco: true, topicos: wrongTopics },
        })
        .select()
        .single();
      reforcoActivityId = inserted?.id ?? null;
    }

    return {
      pct,
      passed,
      threshold,
      correctCount,
      total: qs.length,
      reforcoActivityId,
      corrections: qs.map((q) => {
        const c = corr.find((x) => x.id === q.id);
        return {
          questionId: q.id,
          enunciado: q.enunciado,
          gabarito: q.gabarito,
          resposta: data.answers.find((x) => x.questionId === q.id)?.answer ?? "",
          correta: Boolean(c?.correta),
          feedback: c?.feedback ?? "",
        };
      }),
    };
  });
