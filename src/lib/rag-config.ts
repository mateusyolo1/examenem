// RAG Fase 0 — configuração central.
//
// BLOCO 1 (neutralização): enquanto RAG_IS_CALIBRATED=false, `getRagMinSimilarity()`
// retorna null. Callers DEVEM tratar null como "sem filtro / não calibrado" e
// preservar o comportamento legado da RPC v1 (top-K puro). O valor
// RAG_MIN_SIMILARITY_PROVISIONAL fica registrado apenas como referência para
// a calibração futura — não é usado em produção.

// Referência para a calibração (Gate B). NÃO é lida no fluxo de produção.
export const RAG_MIN_SIMILARITY_PROVISIONAL = 0.55;

// Limites duros compartilhados entre backend e (futura) RPC v2.
export const RAG_MATCH_COUNT_DEFAULT = 6;
export const RAG_MATCH_COUNT_MIN = 1;
export const RAG_MATCH_COUNT_MAX = 20;
export const RAG_THRESHOLD_MIN = -1;
export const RAG_THRESHOLD_MAX = 1;

// Flag que gateia todo caminho novo dependente de threshold.
export const RAG_IS_CALIBRATED = false;

/**
 * Retorna o threshold vigente.
 * - Em produção com RAG_IS_CALIBRATED=false → `null` (sem filtro).
 * - Em NODE_ENV === "test" aceita override numérico via TEST_RAG_MIN_SIMILARITY
 *   (usado exclusivamente pelos testes de calibração).
 * Qualquer outro override é ignorado.
 */
export function getRagMinSimilarity(): number | null {
  if (process.env.NODE_ENV === "test") {
    const override = Number(process.env.TEST_RAG_MIN_SIMILARITY);
    if (Number.isFinite(override)) return override;
  }
  if (!RAG_IS_CALIBRATED) return null;
  return RAG_MIN_SIMILARITY_PROVISIONAL;
}

/**
 * Valida match_count antes de chamar a RPC. Espelha o CHECK que a v2
 * fará em plpgsql.
 */
export function clampMatchCount(n: number | undefined): number {
  const raw = typeof n === "number" && Number.isFinite(n) ? n : RAG_MATCH_COUNT_DEFAULT;
  return Math.min(RAG_MATCH_COUNT_MAX, Math.max(RAG_MATCH_COUNT_MIN, Math.floor(raw)));
}

/**
 * Valida threshold. Fora do intervalo [-1, 1] → lança. Usada só quando um
 * threshold numérico está sendo passado explicitamente (Gate B em diante).
 */
export function assertValidThreshold(t: number): void {
  if (!Number.isFinite(t) || t < RAG_THRESHOLD_MIN || t > RAG_THRESHOLD_MAX) {
    throw new Error(
      `RAG threshold inválido: ${t} (esperado entre ${RAG_THRESHOLD_MIN} e ${RAG_THRESHOLD_MAX})`,
    );
  }
}

// Dimensão vetorial esperada — a RPC exige 3072.
export const RAG_EMBEDDING_DIMS = 3072;
