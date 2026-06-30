// Per-subject progress (frontend-only stub). Lets the catalog show
// real acertos/erros once the user practices subjects.
import { useEffect, useState, useCallback } from "react";

const KEY = "exame:subject-stats:v1";

export interface SubjectStat {
  correct: number;
  errors: number;
}
export type SubjectStats = Record<string, SubjectStat>;

function read(): SubjectStats {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

function write(s: SubjectStats) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new Event("exame:subject-stats"));
}

export function useSubjectStats() {
  const [stats, setStats] = useState<SubjectStats>({});

  useEffect(() => {
    setStats(read());
    const handler = () => setStats(read());
    window.addEventListener("exame:subject-stats", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("exame:subject-stats", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const recordSubjectAnswer = useCallback((subjectId: string, correct: boolean) => {
    const s = read();
    const cur = s[subjectId] || { correct: 0, errors: 0 };
    s[subjectId] = {
      correct: cur.correct + (correct ? 1 : 0),
      errors: cur.errors + (correct ? 0 : 1),
    };
    write(s);
    setStats(s);
  }, []);

  return { stats, recordSubjectAnswer };
}

export function statFor(stats: SubjectStats, id: string): SubjectStat {
  return stats[id] || { correct: 0, errors: 0 };
}
