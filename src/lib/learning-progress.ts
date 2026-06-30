import { useEffect, useSyncExternalStore } from "react";
import type { Area } from "./storage";
import { SUBJECTS, type Subject } from "./subjects";

/**
 * Sistema de "Etapas de Aprendizado" por assunto.
 *
 * Cada assunto estudado pelo aluno tem um progresso próprio entre as 7 etapas:
 *   1. Introdução
 *   2. Teoria
 *   3. Questões guiadas
 *   4. Questões independentes
 *   5. Revisão de erros
 *   6. Mini simulado
 *   7. Assunto dominado
 *
 * Persistência: localStorage (chave LP_KEY), com fallback seguro em SSR.
 * Aditivo — não substitui nem altera nenhuma estrutura existente.
 */

export type LearningStageId = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface LearningStage {
  id: LearningStageId;
  label: string;
  short: string;
  description: string;
}

export const LEARNING_STAGES: LearningStage[] = [
  { id: 1, label: "Introdução", short: "Intro", description: "Visão geral do assunto e por que ele cai no ENEM." },
  { id: 2, label: "Teoria", short: "Teoria", description: "Estudo do conteúdo teórico essencial." },
  { id: 3, label: "Questões guiadas", short: "Guiadas", description: "Resolução acompanhada, passo a passo." },
  { id: 4, label: "Questões independentes", short: "Indep.", description: "Você resolve sozinho, sem auxílio." },
  { id: 5, label: "Revisão de erros", short: "Revisão", description: "Volta nas questões erradas e entende o porquê." },
  { id: 6, label: "Mini simulado", short: "Simulado", description: "Bloco cronometrado no estilo ENEM." },
  { id: 7, label: "Assunto dominado", short: "Dominado", description: "Pronto para revisão espaçada de longo prazo." },
];

export interface StageStats {
  /** Etapa 1: explicação inicial concluída. */
  introConcluida: boolean;
  /** Etapa 2: teoria concluída + perguntas rápidas. */
  teoriaConcluida: boolean;
  perguntasRapidas: number;
  /** Etapa 3: questões guiadas. */
  guidedTotal: number;
  guidedAcertos: number;
  /** Etapa 4: questões independentes. */
  indepTotal: number;
  indepAcertos: number;
  /** Etapa 5: revisão de erros. */
  revisaoTotal: number;
  revisaoAcertos: number;
  /** Etapa 6: mini simulado. */
  simuladoFeito: boolean;
  simuladoTotal: number;
  simuladoAcertos: number;
}

export interface SubjectLearningProgress {
  /** id do assunto (mesmo de SUBJECTS) */
  subjectId: string;
  area: Area | "redacao";
  materia: string;
  assunto: string;
  etapaAtual: LearningStageId;
  /** 0–100 — progresso total considerando todas as etapas */
  progressoPercentual: number;
  questoesRespondidas: number;
  acertos: number;
  erros: number;
  /** 0–100 */
  taxaDeAcerto: number;
  revisoesPendentes: number;
  /** epoch ms, ou null se nunca estudado */
  ultimaAtividade: number | null;
  prontoParaAvancar: boolean;
  /** etapas concluídas (em ordem). */
  etapasConcluidas: LearningStageId[];
  /** Contadores por etapa usados pelas regras de avanço. */
  stageStats: StageStats;
}

export interface AdvanceCriteria {
  ready: boolean;
  /** Lista de critérios faltantes em linguagem natural. Vazio = pronto. */
  faltam: string[];
  /** Texto curto: a próxima exigência mais relevante. */
  proximoPasso: string;
}

interface StoreShape {
  bySubject: Record<string, SubjectLearningProgress>;
  activeSubjectId?: string | null;
}

const LP_KEY = "exame:learning-progress:v1";

const empty: StoreShape = { bySubject: {}, activeSubjectId: null };

function safeRead(): StoreShape {
  if (typeof window === "undefined") return empty;
  try {
    const raw = window.localStorage.getItem(LP_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as StoreShape;
    return parsed && typeof parsed === "object" && parsed.bySubject ? parsed : empty;
  } catch {
    return empty;
  }
}

function safeWrite(s: StoreShape) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LP_KEY, JSON.stringify(s));
  } catch {
    /* ignore quota errors */
  }
}

// --- pub/sub simples para reatividade ---------------------------------
const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === LP_KEY) emit();
  });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): StoreShape {
  return safeRead();
}
function getServerSnapshot(): StoreShape {
  return empty;
}

// --- helpers de cálculo ----------------------------------------------

function findSubject(subjectId: string): Subject | undefined {
  return SUBJECTS.find((s) => s.id === subjectId);
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function computeProgressoPercentual(etapaAtual: LearningStageId, etapasConcluidas: LearningStageId[]): number {
  const total = LEARNING_STAGES.length; // 7
  const done = Math.min(total, etapasConcluidas.length);
  // bônus parcial pela etapa atual em andamento
  const partial = etapaAtual > done ? 0.5 : 0;
  return clamp01(((done + partial) / total) * 100);
}

// Metas/regras por etapa (parametrizadas para fácil ajuste).
export const STAGE_TARGETS = {
  /** Etapa 2 → 3: perguntas rápidas mínimas após a teoria. */
  perguntasRapidasMin: 3,
  /** Etapa 3 → 4 */
  guiadasMin: 5,
  guiadasTaxaMin: 60,
  /** Etapa 4 → 5 */
  indepMin: 10,
  /** Etapa 5 → 6 */
  revisaoTaxaMin: 70,
  /** Etapa 6 → 7 */
  simuladoTaxaMin: 75,
} as const;

function emptyStageStats(): StageStats {
  return {
    introConcluida: false,
    teoriaConcluida: false,
    perguntasRapidas: 0,
    guidedTotal: 0,
    guidedAcertos: 0,
    indepTotal: 0,
    indepAcertos: 0,
    revisaoTotal: 0,
    revisaoAcertos: 0,
    simuladoFeito: false,
    simuladoTotal: 0,
    simuladoAcertos: 0,
  };
}

function pct(acertos: number, total: number): number {
  return total > 0 ? clamp01((acertos / total) * 100) : 0;
}

/**
 * Avalia as regras de avanço da etapa atual e devolve o que falta.
 * Implementa exatamente as regras 1→2 … 6→7.
 */
export function evaluateAdvance(p: SubjectLearningProgress): AdvanceCriteria {
  const ss = p.stageStats;
  const faltam: string[] = [];

  switch (p.etapaAtual) {
    case 1: {
      if (!ss.introConcluida) faltam.push("Concluir a explicação inicial do assunto.");
      break;
    }
    case 2: {
      if (!ss.teoriaConcluida) faltam.push("Concluir a teoria do assunto.");
      const faltamQ = Math.max(0, STAGE_TARGETS.perguntasRapidasMin - ss.perguntasRapidas);
      if (faltamQ > 0) {
        faltam.push(
          `Responder mais ${faltamQ} ${faltamQ === 1 ? "pergunta rápida" : "perguntas rápidas"} (mínimo ${STAGE_TARGETS.perguntasRapidasMin}).`,
        );
      }
      break;
    }
    case 3: {
      const faltamQ = Math.max(0, STAGE_TARGETS.guiadasMin - ss.guidedTotal);
      if (faltamQ > 0) {
        faltam.push(
          `Fazer mais ${faltamQ} ${faltamQ === 1 ? "questão guiada" : "questões guiadas"} (mínimo ${STAGE_TARGETS.guiadasMin}).`,
        );
      }
      const taxa = pct(ss.guidedAcertos, ss.guidedTotal);
      if (ss.guidedTotal >= STAGE_TARGETS.guiadasMin && taxa < STAGE_TARGETS.guiadasTaxaMin) {
        faltam.push(
          `Elevar a taxa de acerto nas guiadas para ${STAGE_TARGETS.guiadasTaxaMin}% (atual: ${taxa}%).`,
        );
      }
      break;
    }
    case 4: {
      const faltamQ = Math.max(0, STAGE_TARGETS.indepMin - ss.indepTotal);
      if (faltamQ > 0) {
        faltam.push(
          `Fazer mais ${faltamQ} ${faltamQ === 1 ? "questão independente" : "questões independentes"} (mínimo ${STAGE_TARGETS.indepMin}).`,
        );
      }
      // Erros são enviados para Revisar Erros automaticamente (revisoesPendentes++).
      // Não bloqueia o avanço aqui — o bloqueio acontece na etapa 5.
      break;
    }
    case 5: {
      if (p.revisoesPendentes > 0) {
        faltam.push(
          `Revisar ${p.revisoesPendentes} ${p.revisoesPendentes === 1 ? "erro pendente" : "erros pendentes"} deste assunto.`,
        );
      }
      const taxa = pct(ss.revisaoAcertos, ss.revisaoTotal);
      if (ss.revisaoTotal === 0) {
        faltam.push("Fazer ao menos uma rodada de revisão dos erros.");
      } else if (taxa < STAGE_TARGETS.revisaoTaxaMin) {
        faltam.push(
          `Atingir ${STAGE_TARGETS.revisaoTaxaMin}% de acerto nas revisões (atual: ${taxa}%).`,
        );
      }
      break;
    }
    case 6: {
      if (!ss.simuladoFeito || ss.simuladoTotal === 0) {
        faltam.push("Fazer um mini simulado deste assunto.");
      } else {
        const taxa = pct(ss.simuladoAcertos, ss.simuladoTotal);
        if (taxa < STAGE_TARGETS.simuladoTaxaMin) {
          faltam.push(
            `Atingir ${STAGE_TARGETS.simuladoTaxaMin}% de acerto no mini simulado (atual: ${taxa}%).`,
          );
        }
      }
      break;
    }
    case 7:
    default:
      // Já dominado — não há mais o que avançar.
      break;
  }

  const ready = p.etapaAtual < 7 && faltam.length === 0;
  const proximoPasso =
    p.etapaAtual >= 7
      ? "Assunto dominado. Mantenha com revisões espaçadas."
      : ready
      ? "Pronto para avançar para a próxima etapa."
      : faltam[0];

  return { ready, faltam, proximoPasso };
}

function computeProntoParaAvancar(p: SubjectLearningProgress): boolean {
  return evaluateAdvance(p).ready;
}

function ensure(subjectId: string, s: StoreShape): SubjectLearningProgress {
  const existing = s.bySubject[subjectId];
  if (existing) {
    // Migração suave: garantir stageStats em registros antigos.
    if (!existing.stageStats) {
      existing.stageStats = emptyStageStats();
    }
    return existing;
  }
  const subj = findSubject(subjectId);
  const created: SubjectLearningProgress = {
    subjectId,
    area: subj?.area ?? "linguagens",
    materia: subj ? areaLabel(subj.area) : "",
    assunto: subj?.name ?? subjectId,
    etapaAtual: 1,
    progressoPercentual: 0,
    questoesRespondidas: 0,
    acertos: 0,
    erros: 0,
    taxaDeAcerto: 0,
    revisoesPendentes: 0,
    ultimaAtividade: null,
    prontoParaAvancar: false,
    etapasConcluidas: [],
    stageStats: emptyStageStats(),
  };
  s.bySubject[subjectId] = created;
  return created;
}

function areaLabel(area: Subject["area"]): string {
  switch (area) {
    case "linguagens": return "Linguagens & Códigos";
    case "humanas": return "Ciências Humanas";
    case "natureza": return "Ciências da Natureza";
    case "matematica": return "Matemática";
    case "redacao": return "Redação";
    default: return String(area);
  }
}

function recompute(p: SubjectLearningProgress): SubjectLearningProgress {
  const total = p.questoesRespondidas;
  const taxa = total > 0 ? (p.acertos / total) * 100 : 0;
  p.taxaDeAcerto = clamp01(taxa);
  p.progressoPercentual = computeProgressoPercentual(p.etapaAtual, p.etapasConcluidas);
  p.prontoParaAvancar = computeProntoParaAvancar(p);
  return p;
}

function mutate(fn: (s: StoreShape) => void) {
  const s = safeRead();
  const next: StoreShape = {
    bySubject: { ...s.bySubject },
    activeSubjectId: s.activeSubjectId ?? null,
  };
  fn(next);
  safeWrite(next);
  emit();
}

/** Texto curto descrevendo o próximo passo (primeiro item de `faltam`). */
export function nextStepHint(p: SubjectLearningProgress): string {
  return evaluateAdvance(p).proximoPasso;
}

/** Status curto e amigável. */
export function studentStatus(p: SubjectLearningProgress | null): string {
  if (!p) return "Escolha um assunto para começar.";
  if (p.etapaAtual >= 7) return "Dominado";
  if (p.prontoParaAvancar) return "Pronto para avançar";
  if (p.revisoesPendentes > 0) return "Revisando erros";
  if (p.questoesRespondidas > 0) return "Em prática";
  return "Iniciando";
}

// --- API pública -----------------------------------------------------

export function getAllLearningProgress(): SubjectLearningProgress[] {
  return Object.values(safeRead().bySubject);
}

export function getLearningProgress(subjectId: string): SubjectLearningProgress | null {
  return safeRead().bySubject[subjectId] ?? null;
}

export function startSubject(subjectId: string) {
  mutate((s) => {
    const p = { ...ensure(subjectId, s) };
    p.ultimaAtividade = Date.now();
    if (p.etapaAtual < 1) p.etapaAtual = 1;
    s.bySubject[subjectId] = recompute(p);
  });
}

export function setStage(subjectId: string, stage: LearningStageId) {
  mutate((s) => {
    const p = { ...ensure(subjectId, s) };
    p.etapaAtual = stage;
    p.ultimaAtividade = Date.now();
    s.bySubject[subjectId] = recompute(p);
  });
}

/**
 * Avança a etapa atual respeitando as regras automáticas.
 * Por padrão NÃO avança se `prontoParaAvancar` for false — retorna `{ ok: false, faltam }`.
 * Use `{ force: true }` apenas em contextos administrativos (ex.: reset/import).
 */
export function advanceStage(
  subjectId: string,
  opts?: { force?: boolean },
): { ok: boolean; faltam: string[] } {
  let result: { ok: boolean; faltam: string[] } = { ok: false, faltam: [] };
  mutate((s) => {
    const p = { ...ensure(subjectId, s) };
    const crit = evaluateAdvance(p);
    if (!opts?.force && !crit.ready) {
      result = { ok: false, faltam: crit.faltam };
      return;
    }
    const concluida = p.etapaAtual;
    if (!p.etapasConcluidas.includes(concluida)) {
      p.etapasConcluidas = [...p.etapasConcluidas, concluida];
    }
    if (p.etapaAtual < 7) {
      p.etapaAtual = (p.etapaAtual + 1) as LearningStageId;
    }
    p.ultimaAtividade = Date.now();
    s.bySubject[subjectId] = recompute(p);
    result = { ok: true, faltam: [] };
  });
  return result;
}

// --- Eventos das regras automáticas ---------------------------------

/** Etapa 1: marca a explicação inicial como concluída. */
export function markIntroConcluida(subjectId: string) {
  mutate((s) => {
    const p = { ...ensure(subjectId, s) };
    p.stageStats = { ...p.stageStats, introConcluida: true };
    p.ultimaAtividade = Date.now();
    s.bySubject[subjectId] = recompute(p);
  });
}

/** Etapa 2: marca a teoria como concluída. */
export function markTeoriaConcluida(subjectId: string) {
  mutate((s) => {
    const p = { ...ensure(subjectId, s) };
    p.stageStats = { ...p.stageStats, teoriaConcluida: true };
    p.ultimaAtividade = Date.now();
    s.bySubject[subjectId] = recompute(p);
  });
}

/** Etapa 2: registra uma pergunta rápida respondida. */
export function recordQuickQuestion(subjectId: string, correct: boolean) {
  mutate((s) => {
    const p = { ...ensure(subjectId, s) };
    p.stageStats = { ...p.stageStats, perguntasRapidas: p.stageStats.perguntasRapidas + 1 };
    p.questoesRespondidas += 1;
    if (correct) p.acertos += 1;
    else p.erros += 1;
    p.ultimaAtividade = Date.now();
    s.bySubject[subjectId] = recompute(p);
  });
}

/** Etapa 3: registra uma questão guiada respondida. */
export function recordGuidedAnswer(subjectId: string, correct: boolean) {
  mutate((s) => {
    const p = { ...ensure(subjectId, s) };
    const ss = { ...p.stageStats };
    ss.guidedTotal += 1;
    if (correct) ss.guidedAcertos += 1;
    p.stageStats = ss;
    p.questoesRespondidas += 1;
    if (correct) p.acertos += 1;
    else p.erros += 1;
    p.ultimaAtividade = Date.now();
    s.bySubject[subjectId] = recompute(p);
  });
}

/**
 * Etapa 4: registra uma questão independente. Se errar, vai para "Revisar Erros"
 * (revisoesPendentes++), o que bloqueará o avanço na etapa 5 enquanto houver erros.
 */
export function recordIndepAnswer(subjectId: string, correct: boolean) {
  mutate((s) => {
    const p = { ...ensure(subjectId, s) };
    const ss = { ...p.stageStats };
    ss.indepTotal += 1;
    if (correct) ss.indepAcertos += 1;
    p.stageStats = ss;
    p.questoesRespondidas += 1;
    if (correct) p.acertos += 1;
    else {
      p.erros += 1;
      p.revisoesPendentes += 1; // envia para Revisar Erros
    }
    p.ultimaAtividade = Date.now();
    s.bySubject[subjectId] = recompute(p);
  });
}

/** Etapa 5: registra uma resposta de revisão (e decrementa revisões pendentes em 1). */
export function recordReviewAnswer(subjectId: string, correct: boolean) {
  mutate((s) => {
    const p = { ...ensure(subjectId, s) };
    const ss = { ...p.stageStats };
    ss.revisaoTotal += 1;
    if (correct) ss.revisaoAcertos += 1;
    p.stageStats = ss;
    if (p.revisoesPendentes > 0) p.revisoesPendentes -= 1;
    p.questoesRespondidas += 1;
    if (correct) p.acertos += 1;
    else p.erros += 1;
    p.ultimaAtividade = Date.now();
    s.bySubject[subjectId] = recompute(p);
  });
}

/** Etapa 6: registra o resultado final do mini simulado do assunto. */
export function recordMiniSimuladoResult(subjectId: string, acertos: number, total: number) {
  mutate((s) => {
    const p = { ...ensure(subjectId, s) };
    p.stageStats = {
      ...p.stageStats,
      simuladoFeito: true,
      simuladoAcertos: Math.max(0, Math.min(total, acertos)),
      simuladoTotal: Math.max(0, total),
    };
    p.questoesRespondidas += total;
    p.acertos += Math.max(0, Math.min(total, acertos));
    p.erros += Math.max(0, total - acertos);
    p.ultimaAtividade = Date.now();
    s.bySubject[subjectId] = recompute(p);
  });
}

/**
 * Genérico (compatibilidade) — usa o contador apropriado da etapa atual.
 * Mantido para chamadas antigas; prefira as funções específicas acima.
 */
export function recordSubjectAnswer(
  subjectId: string,
  correct: boolean,
  opts?: { addPendingReview?: boolean },
) {
  const cur = getLearningProgress(subjectId)?.etapaAtual ?? 1;
  if (cur === 2) return recordQuickQuestion(subjectId, correct);
  if (cur === 3) return recordGuidedAnswer(subjectId, correct);
  if (cur === 5) return recordReviewAnswer(subjectId, correct);
  if (cur === 4) {
    if (opts?.addPendingReview === false) {
      // comportamento legado: não adicionar revisão
      mutate((s) => {
        const p = { ...ensure(subjectId, s) };
        const ss = { ...p.stageStats };
        ss.indepTotal += 1;
        if (correct) ss.indepAcertos += 1;
        p.stageStats = ss;
        p.questoesRespondidas += 1;
        if (correct) p.acertos += 1;
        else p.erros += 1;
        p.ultimaAtividade = Date.now();
        s.bySubject[subjectId] = recompute(p);
      });
      return;
    }
    return recordIndepAnswer(subjectId, correct);
  }
  // demais etapas (1, 6, 7): apenas contabiliza no agregado.
  mutate((s) => {
    const p = { ...ensure(subjectId, s) };
    p.questoesRespondidas += 1;
    if (correct) p.acertos += 1;
    else {
      p.erros += 1;
      if (opts?.addPendingReview !== false) p.revisoesPendentes += 1;
    }
    p.ultimaAtividade = Date.now();
    s.bySubject[subjectId] = recompute(p);
  });
}

export function resolveReview(subjectId: string, count: number = 1) {
  mutate((s) => {
    const p = { ...ensure(subjectId, s) };
    p.revisoesPendentes = Math.max(0, p.revisoesPendentes - count);
    p.ultimaAtividade = Date.now();
    s.bySubject[subjectId] = recompute(p);
  });
}

export function resetSubject(subjectId: string) {
  mutate((s) => {
    delete s.bySubject[subjectId];
  });
}

export function resetAllLearningProgress() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LP_KEY);
  } catch {
    /* ignore */
  }
  emit();
}

// --- Hooks -----------------------------------------------------------

export function useLearningProgress(): SubjectLearningProgress[] {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  useEffect(() => {
    emit();
  }, []);
  return Object.values(snap.bySubject);
}

export function useSubjectLearning(subjectId: string): SubjectLearningProgress | null {
  const all = useLearningProgress();
  return all.find((p) => p.subjectId === subjectId) ?? null;
}

export function stageById(id: LearningStageId): LearningStage {
  return LEARNING_STAGES.find((s) => s.id === id) ?? LEARNING_STAGES[0];
}

// --- Assunto ativo ---------------------------------------------------

export function getActiveSubjectId(): string | null {
  return safeRead().activeSubjectId ?? null;
}

export function setActiveSubject(subjectId: string | null) {
  mutate((s) => {
    s.activeSubjectId = subjectId;
    if (subjectId) ensure(subjectId, s);
  });
}

export function useActiveLearning(): SubjectLearningProgress | null {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  useEffect(() => {
    emit();
  }, []);
  const id = snap.activeSubjectId;
  if (!id) return null;
  return snap.bySubject[id] ?? null;
}

