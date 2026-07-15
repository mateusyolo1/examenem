/**
 * Motor de Dificuldade Gradual (server-only)
 *
 * Recalcula o nível do aluno após cada atividade com base em desempenho +
 * feedback de esforço. Segue as regras do documento do Manus:
 *
 *  - Fast Track (score ≥ 95% + effort "facil")  → +2 níveis no tópico
 *  - Crescimento (score ≥ 80%)                  → +1 nível
 *  - Estabilização (60–80%)                     → mantém, agenda revisão
 *  - Recuo (< 50% ou effort "dificil")          → −1 nível
 *
 * Escreve em:
 *  - topic_mastery.level_reached (por tópico)
 *  - user_study_settings.stage_level (nível global agregado)
 *
 * Chamado a partir de handlers protegidos (nunca exportar como server fn).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type Effort = "facil" | "medio" | "dificil";
export type EngineOutcome =
  | "fast_track"
  | "level_up"
  | "hold"
  | "level_down"
  | "noop";

export interface DifficultyInput {
  userId: string;
  topicSlug?: string | null;
  topicArea?: string | null;
  score?: number | null; // 0..1
  effort?: Effort | null;
}

function clampLevel(n: number): number {
  return Math.max(1, Math.min(4, Math.round(n)));
}

function decide(score: number | null | undefined, effort: Effort | null | undefined): EngineOutcome {
  if (score == null && !effort) return "noop";
  const s = score ?? 0.6;
  if (s >= 0.95 && effort === "facil") return "fast_track";
  if (s >= 0.8) return "level_up";
  if (s < 0.5 || effort === "dificil") return "level_down";
  return "hold";
}

/**
 * Atualiza `topic_mastery.level_reached` e recalcula o `stage_level`
 * global do aluno (média dos níveis dos tópicos ativos).
 */
export async function updateDifficultyAfterActivity(
  supabase: SupabaseClient,
  input: DifficultyInput,
): Promise<{ outcome: EngineOutcome; topicLevel: number | null; stageLevel: number }> {
  const outcome = decide(input.score, input.effort);

  let topicLevel: number | null = null;

  if (input.topicSlug && outcome !== "noop") {
    const { data: cur } = await supabase
      .from("topic_mastery")
      .select("level_reached")
      .eq("user_id", input.userId)
      .eq("topic_slug", input.topicSlug)
      .maybeSingle();

    const base = cur?.level_reached ?? 1;
    let next = base;
    if (outcome === "fast_track") next = base + 2;
    else if (outcome === "level_up") next = base + 1;
    else if (outcome === "level_down") next = base - 1;

    topicLevel = clampLevel(next);

    // upsert só se mudou
    if (topicLevel !== base) {
      await supabase
        .from("topic_mastery")
        .update({ level_reached: topicLevel })
        .eq("user_id", input.userId)
        .eq("topic_slug", input.topicSlug);
    }
  }

  // Recalcula stage_level global = média dos level_reached dos tópicos
  const { data: rows } = await supabase
    .from("topic_mastery")
    .select("level_reached")
    .eq("user_id", input.userId);
  const levels = (rows ?? []).map((r) => r.level_reached ?? 1);
  const avg = levels.length ? levels.reduce((a, b) => a + b, 0) / levels.length : 1;
  const stageLevel = clampLevel(Math.floor(avg));

  await supabase
    .from("user_study_settings")
    .upsert(
      { user_id: input.userId, stage_level: stageLevel },
      { onConflict: "user_id" },
    );

  return { outcome, topicLevel, stageLevel };
}

/**
 * Fator de carga por semana do contrato:
 *  - Semana 1 → 70% da carga disponível (dar margem de vitória)
 *  - Semana 2 → 85%
 *  - Semana 3+ → 100%
 */
export function stageLoadFactor(week: number): number {
  if (week <= 1) return 0.7;
  if (week === 2) return 0.85;
  return 1;
}

/**
 * Calcula em qual semana do contrato o aluno está, a partir de stage_started_at.
 */
export function computeStageWeek(startedAt: string | null | undefined): number {
  if (!startedAt) return 1;
  const start = new Date(startedAt).getTime();
  if (Number.isNaN(start)) return 1;
  const days = Math.floor((Date.now() - start) / (24 * 60 * 60 * 1000));
  return Math.max(1, Math.floor(days / 7) + 1);
}
