// Saved-for-later questions (frontend-only).
import { useEffect, useState, useCallback } from "react";

const KEY = "exame:saved-questions:v1";

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

function write(ids: string[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(ids));
  window.dispatchEvent(new Event("exame:saved-questions"));
}

export function useSavedQuestions() {
  const [saved, setSaved] = useState<string[]>([]);

  useEffect(() => {
    setSaved(read());
    const h = () => setSaved(read());
    window.addEventListener("exame:saved-questions", h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener("exame:saved-questions", h);
      window.removeEventListener("storage", h);
    };
  }, []);

  const toggle = useCallback((id: string) => {
    const cur = read();
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    write(next);
    setSaved(next);
  }, []);

  const isSaved = useCallback((id: string) => saved.includes(id), [saved]);

  return { saved, toggle, isSaved };
}
