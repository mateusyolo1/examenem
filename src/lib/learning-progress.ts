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
}

interface StoreShape {
  bySubject: Record<string, SubjectLearningProgress>;
}

const LP_KEY = "exame:learning-progress:v1";

const empty: StoreShape = { bySubject: {} };

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

function computeProntoParaAvancar(p: SubjectLearningProgress): boolean {
  const minQuestoes = p.etapaAtual >= 3 ? 5 : 0;
  const taxaOk = p.taxaDeAcerto >= 70;
  const semRevisoes = p.revisoesPendentes === 0;
  if (p.etapaAtual >= 7) return false;
  if (p.etapaAtual <= 2) return p.ultimaAtividade !== null; // basta ter iniciado
  return p.questoesRespondidas >= minQuestoes && taxaOk && semRevisoes;
}

function ensure(subjectId: string, s: StoreShape): SubjectLearningProgress {
  const existing = s.bySubject[subjectId];
  if (existing) return existing;
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
  // shallow clone só do necessário
  const next: StoreShape = { bySubject: { ...s.bySubject } };
  fn(next);
  safeWrite(next);
  emit();
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

export function advanceStage(subjectId: string) {
  mutate((s) => {
    const p = { ...ensure(subjectId, s) };
    const concluida = p.etapaAtual;
    if (!p.etapasConcluidas.includes(concluida)) {
      p.etapasConcluidas = [...p.etapasConcluidas, concluida];
    }
    if (p.etapaAtual < 7) {
      p.etapaAtual = (p.etapaAtual + 1) as LearningStageId;
    }
    p.ultimaAtividade = Date.now();
    s.bySubject[subjectId] = recompute(p);
  });
}

export function recordSubjectAnswer(
  subjectId: string,
  correct: boolean,
  opts?: { addPendingReview?: boolean },
) {
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
  // garante reidratação no client se SSR retornou vazio
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
