// Spaced review store (frontend-only).
import { useEffect, useState, useCallback } from "react";

const KEY = "exame:review:v1";
const DAY = 86400000;

// Intervals indexed by errorCount (1st wrong → 1d, 2nd → 3d, ...).
export const INTERVALS_DAYS = [1, 3, 7, 15, 30];

export interface ReviewEntry {
  questionId: string;
  errorCount: number;
  lastWrongAt: number;
  nextReviewAt: number;
  history: number[]; // timestamps of wrong answers
  mastered: boolean;
}

export type ReviewMap = Record<string, ReviewEntry>;

function read(): ReviewMap {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

function write(m: ReviewMap) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(m));
  window.dispatchEvent(new Event("exame:review"));
}

function intervalFor(errorCount: number): number {
  const idx = Math.min(Math.max(errorCount, 1), INTERVALS_DAYS.length) - 1;
  return INTERVALS_DAYS[idx] * DAY;
}

/** Record an answer against the review schedule. */
export function recordReviewAnswer(questionId: string, correct: boolean) {
  const m = read();
  const cur = m[questionId];
  const now = Date.now();

  if (correct) {
    // If it was scheduled and the user got it right during a review, push out
    // to the next interval but don't increment errorCount; if untouched, ignore.
    if (cur && !cur.mastered) {
      m[questionId] = {
        ...cur,
        nextReviewAt: now + intervalFor(Math.min(cur.errorCount + 1, INTERVALS_DAYS.length)),
      };
      write(m);
    }
    return;
  }

  const errorCount = (cur?.errorCount ?? 0) + 1;
  m[questionId] = {
    questionId,
    errorCount,
    lastWrongAt: now,
    nextReviewAt: now + intervalFor(errorCount),
    history: [...(cur?.history ?? []), now],
    mastered: false,
  };
  write(m);
}

export function markMastered(questionId: string, mastered = true) {
  const m = read();
  const cur = m[questionId];
  if (!cur && !mastered) return;
  m[questionId] = {
    questionId,
    errorCount: cur?.errorCount ?? 0,
    lastWrongAt: cur?.lastWrongAt ?? 0,
    nextReviewAt: cur?.nextReviewAt ?? Date.now(),
    history: cur?.history ?? [],
    mastered,
  };
  write(m);
}

export function useReviews() {
  const [reviews, setReviews] = useState<ReviewMap>({});
  useEffect(() => {
    setReviews(read());
    const h = () => setReviews(read());
    window.addEventListener("exame:review", h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener("exame:review", h);
      window.removeEventListener("storage", h);
    };
  }, []);

  const pendingToday = useCallback((map = reviews) => {
    const now = Date.now();
    return Object.values(map).filter((r) => !r.mastered && r.nextReviewAt <= now);
  }, [reviews]);

  return { reviews, pendingToday };
}

export function nextIntervalLabel(errorCount: number): string {
  const days = INTERVALS_DAYS[Math.min(errorCount, INTERVALS_DAYS.length) - 1] ?? 30;
  return `${days} ${days === 1 ? "dia" : "dias"}`;
}
