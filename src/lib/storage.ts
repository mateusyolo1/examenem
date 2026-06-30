// Local-only progress storage. No backend, no login.
import { useEffect, useState, useCallback } from "react";

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
}

const DEFAULT: Progress = {
  answers: {},
  streakDays: 0,
  lastStudyDate: null,
  simulados: [],
  essays: [],
  dailyGoal: 18,
  // Default: Nov 9 of current or next year
  examDate: defaultExamDate(),
};

function defaultExamDate(): string {
  const now = new Date();
  const y = now.getMonth() > 10 ? now.getFullYear() + 1 : now.getFullYear();
  return new Date(y, 10, 9).toISOString(); // November 9
}

function read(): Progress {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    return { ...DEFAULT, ...JSON.parse(raw) };
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
