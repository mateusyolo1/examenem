import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  computeStageWeek,
  stageLoadFactor,
  updateDifficultyAfterActivity,
  type Effort,
} from "./difficulty-engine.server";

const effortSchema = z.enum(["facil", "medio", "dificil"]);

/**
 * logEffort — grava telemetria de esforço + score e dispara o motor
 * de dificuldade. Chamado pelo <EffortPrompt/> após concluir uma
 * atividade (vídeo, lousa, treino, simulado).
 */
export const logEffort = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        activityKind: z.enum(["video", "lousa", "treino", "simulado", "flashcards"]),
        activityRef: z.string().uuid().optional(),
        topicSlug: z.string().optional(),
        topicArea: z.string().optional(),
        effort: effortSchema,
        score: z.number().min(0).max(1).optional(),
        durationMin: z.number().int().min(0).max(720).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    await supabase.from("learning_telemetry").insert({
      user_id: userId,
      activity_kind: data.activityKind,
      activity_ref: data.activityRef ?? null,
      topic_slug: data.topicSlug ?? null,
      topic_area: data.topicArea ?? null,
      effort: data.effort,
      score: data.score ?? null,
      duration_min: data.durationMin ?? null,
    });

    const engineOut = await updateDifficultyAfterActivity(supabase, {
      userId,
      topicSlug: data.topicSlug,
      topicArea: data.topicArea,
      score: data.score ?? null,
      effort: data.effort as Effort,
    });

    return { ok: true, ...engineOut };
  });

/**
 * getStageInfo — devolve estágio atual + semana + fator de carga.
 * Usado no <Nav/Badge de Plano> e no gerador de cronograma.
 */
export const getStageInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("user_study_settings")
      .select("stage_level, stage_week, stage_started_at, hours_per_day, target_score")
      .eq("user_id", userId)
      .maybeSingle();

    const week = data ? computeStageWeek(data.stage_started_at) : 1;
    const level = data?.stage_level ?? 1;
    const hoursPerDay = data?.hours_per_day ?? 2;
    const targetScore = data?.target_score ?? 700;

    // Sincroniza stage_week no banco se mudou (uma vez por semana)
    if (data && data.stage_week !== week) {
      await supabase
        .from("user_study_settings")
        .update({ stage_week: week })
        .eq("user_id", userId);
    }

    return {
      level,
      week,
      loadFactor: stageLoadFactor(week),
      hoursPerDay: Number(hoursPerDay),
      targetScore,
    };
  });

/**
 * updateUserStudySettings — atualiza campos editáveis pelo usuário
 * (horas/dia, meta de nota, lousa threshold).
 */
export const updateUserStudySettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        hoursPerDay: z.number().min(0.5).max(16).optional(),
        targetScore: z.number().int().min(300).max(1000).optional(),
        lousaPassThreshold: z.number().int().min(30).max(100).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const patch: Record<string, number> = {};
    if (data.hoursPerDay != null) patch.hours_per_day = data.hoursPerDay;
    if (data.targetScore != null) patch.target_score = data.targetScore;
    if (data.lousaPassThreshold != null)
      patch.lousa_pass_threshold = data.lousaPassThreshold;
    if (!Object.keys(patch).length) return { ok: true, changed: 0 };

    const { error } = await supabase
      .from("user_study_settings")
      .upsert({ user_id: userId, ...patch }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true, changed: Object.keys(patch).length };
  });
