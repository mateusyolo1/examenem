// Local-only progress storage. No backend, no login.
import { useEffect, useState, useCallback } from "react";
import { DEFAULT_EXAM_ID, defaultExamDate, getExamOption, isLegacyDefaultExamDate } from "./exams";

const KEY = "exame:progress:v1";

export type Area = "linguagens" | "humanas" | "natureza" | "matematica";

export const AREAS: { id: Area; label: string; short: string }[] = [
  { id: "linguagens", label: "Linguagens & Códigos", short: "Linguagens" },
  { id: "humanas", label: "Ciências Humanas", short: "Humanas" },
  { id: "natureza", label: "Ciências da Natureza", short: "Natureza" },
  { id: "matematica", label: "Matemática", short: "Matemática" },
];

export interface EssayRecord {
  id: string;
  theme: string;
  text: string;
  feedback?: unknown; // EssayFeedback shape from ai.functions, kept loose to avoid cycle
  at: number;
}

export interface SimuladoRecord {
  id: string;
  score: number;
  total: number;
  at: number;
  mode?: string;
  durationSec?: number;
  spentSec?: number;
  byArea?: Record<string, { correct: number; total: number }>;
  bySubject?: Record<string, { correct: number; total: number }>;
  wrongIds?: string[];
  unansweredIds?: string[];
}

export interface Progress {
  answers: Record<string, { correct: boolean; answer: string; at: number }>;
  streakDays: number;
  lastStudyDate: string | null;
  simulados: SimuladoRecord[];
  essays: EssayRecord[];
  dailyGoal: number;
  examDate: string; // ISO
  examId?: string;
  examName?: string;
  studentName?: string;
  targetScore?: number; // 0-1000
  dailyMinutes?: number; // available study minutes/day
}

const DEFAULT_EXAM = getExamOption(DEFAULT_EXAM_ID);

const DEFAULT: Progress = {
  answers: {},
  streakDays: 0,
  lastStudyDate: null,
  simulados: [],
  essays: [],
  dailyGoal: 18,
  examDate: defaultExamDate(),
  examId: DEFAULT_EXAM.id,
  examName: DEFAULT_EXAM.label,
  studentName: "",
  targetScore: 700,
  dailyMinutes: 120,
};

function normalizeProgress(parsed: Partial<Progress>): Progress {
  const next = { ...DEFAULT, ...parsed };
  if (!parsed.examId) {
    next.examId = DEFAULT_EXAM.id;
    next.examName = DEFAULT_EXAM.label;
    if (isLegacyDefaultExamDate(parsed.examDate)) next.examDate = DEFAULT.examDate;
  } else {
    const exam = getExamOption(parsed.examId);
    next.examName = parsed.examName || exam.label;
  }
  return next;
}

function read(): Progress {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    return normalizeProgress(JSON.parse(raw));
  } catch {
    return DEFAULT;
  }
}

function write(p: Progress) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(p));
  window.dispatchEvent(new Event("exame:progress"));
}

export function useProgress() {
  const [progress, setProgress] = useState<Progress>(DEFAULT);

  useEffect(() => {
    setProgress(read());
    const handler = () => setProgress(read());
    window.addEventListener("exame:progress", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("exame:progress", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const update = useCallback((fn: (prev: Progress) => Progress) => {
    const next = fn(read());
    write(next);
    setProgress(next);
  }, []);

  return { progress, update };
}

export function recordAnswer(questionId: string, answer: string, correct: boolean) {
  const p = read();
  const today = new Date().toDateString();
  const last = p.lastStudyDate;
  let streak = p.streakDays;
  if (last !== today) {
    const yest = new Date(Date.now() - 86400000).toDateString();
    streak = last === yest ? streak + 1 : 1;
  }
  if (!streak) streak = 1;
  p.answers[questionId] = { answer, correct, at: Date.now() };
  p.streakDays = streak;
  p.lastStudyDate = today;
  write(p);
}

export function daysUntilExam(iso: string): number {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86400000));
}

export function answersToday(p: Progress): number {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return Object.values(p.answers).filter((a) => a.at >= start.getTime()).length;
}

export function areaStats(p: Progress, area: Area, questionAreaMap: Record<string, Area>) {
  const entries = Object.entries(p.answers).filter(([id]) => questionAreaMap[id] === area);
  const total = entries.length;
  const correct = entries.filter(([, a]) => a.correct).length;
  return { total, correct, accuracy: total ? Math.round((correct / total) * 100) : 0 };
}

export function resetProgress() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
  window.dispatchEvent(new Event("exame:progress"));
}

export function exportProgress(): string {
  if (typeof window === "undefined") return JSON.stringify(read(), null, 2);
  const bundle: Record<string, unknown> = {
    version: 1,
    exportedAt: new Date().toISOString(),
    progress: read(),
  };
  try {
    const plan = localStorage.getItem("exame:study-plan:v1");
    if (plan) bundle.studyPlan = JSON.parse(plan);
  } catch {
    /* ignore */
  }
  return JSON.stringify(bundle, null, 2);
}

export function importProgress(json: string): { ok: true } | { ok: false; error: string } {
  if (typeof window === "undefined") return { ok: false, error: "Indisponível" };
  try {
    const parsed = JSON.parse(json);
    // Accept either { progress, studyPlan } bundle or a raw Progress object.
    const prog =
      parsed && typeof parsed === "object" && "progress" in parsed
        ? (parsed as { progress: Progress }).progress
        : (parsed as Progress);
    if (!prog || typeof prog !== "object" || !("answers" in prog)) {
      return { ok: false, error: "Arquivo inválido." };
    }
    write(normalizeProgress(prog));
    if (parsed && typeof parsed === "object" && "studyPlan" in parsed) {
      localStorage.setItem(
        "exame:study-plan:v1",
        JSON.stringify((parsed as { studyPlan: unknown }).studyPlan),
      );
      window.dispatchEvent(new Event("exame:study-plan"));
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao importar." };
  }
}

export function wipeAllData() {
  if (typeof window === "undefined") return;
  // Remove every Exame namespace key (progress, study plan, saved questions, theme, etc.)
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith("exame:")) keys.push(k);
  }
  keys.forEach((k) => localStorage.removeItem(k));
  window.dispatchEvent(new Event("exame:progress"));
  window.dispatchEvent(new Event("exame:study-plan"));
}

