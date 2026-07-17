// RAG Fase 0 — configuração central (Gate A / Gate B).
//
// Ressalva #1 do usuário: em PRODUÇÃO o threshold é uma constante congelada
// em código. Override livre por variável de ambiente NÃO é aceito.
// Override apenas em NODE_ENV === "test".
//
// Ressalva #2 (RPC v2 exigirá threshold): o valor abaixo é PROVISIONAL.
// Ele será substituído no Gate B pelo valor calibrado registrado na
// fixture src/lib/__tests__/fixtures/rag-calibration.json.

// PROVISIONAL — calibração pendente. Ajuste no Gate B.
// Escolhido conservadoramente para reduzir falsos positivos no interim.
export const RAG_MIN_SIMILARITY = 0.55;

// Limites duros compartilhados entre backend e SQL da RPC v2.
export const RAG_MATCH_COUNT_DEFAULT = 6;
export const RAG_MATCH_COUNT_MIN = 1;
export const RAG_MATCH_COUNT_MAX = 20;
export const RAG_THRESHOLD_MIN = -1;
export const RAG_THRESHOLD_MAX = 1;

// Marca `false` até o Gate B validar a calibração empírica.
export const RAG_IS_CALIBRATED = false;

/**
 * Threshold vigente. Em produção retorna a constante congelada.
 * Em NODE_ENV === "test" aceita override via TEST_RAG_MIN_SIMILARITY.
 * Qualquer outro override é silenciosamente ignorado (ressalva #1).
 */
export function getRagMinSimilarity(): number {
  if (process.env.NODE_ENV === "test") {
    const override = Number(process.env.TEST_RAG_MIN_SIMILARITY);
    if (Number.isFinite(override)) return override;
  }
  return RAG_MIN_SIMILARITY;
}

/**
 * Valida match_count antes de chamar a RPC. Espelha o CHECK que a v2
 * fará em plpgsql — validação em profundidade (ressalva #2).
 */
export function clampMatchCount(n: number | undefined): number {
  const raw = typeof n === "number" && Number.isFinite(n) ? n : RAG_MATCH_COUNT_DEFAULT;
  return Math.min(RAG_MATCH_COUNT_MAX, Math.max(RAG_MATCH_COUNT_MIN, Math.floor(raw)));
}

/**
 * Valida threshold. Fora do intervalo [-1, 1] → lança (ressalva #2).
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
