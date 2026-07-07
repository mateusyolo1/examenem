// Client-side cache of the most recent aula essayTask, keyed by area.
// Lets the /plano redação CTA propose "escrever sobre a última aula" when
// the topic came from a video lesson.
import { useEffect, useState } from "react";

const KEY = "exame:last-essay-task:v1";
const EVT = "exame:last-essay-task";

export interface CachedEssayEntry {
  topicId: string;
  topicTitle: string;
  area: string;
  essayTitle: string;
  focusSkill: string;
  savedAt: number;
}

type Store = Record<string, CachedEssayEntry>; // key: area

function read(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

function write(s: Store) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new Event(EVT));
}

export function saveLastEssayTask(entry: CachedEssayEntry) {
  const s = read();
  s[entry.area] = entry;
  write(s);
}

export function getLastEssayTaskByArea(area: string): CachedEssayEntry | null {
  return read()[area] ?? null;
}

export function getMostRecentEssayTask(): CachedEssayEntry | null {
  const s = read();
  const list = Object.values(s);
  if (!list.length) return null;
  return list.sort((a, b) => b.savedAt - a.savedAt)[0];
}

export function useLastEssayTasks(): Store {
  const [store, setStore] = useState<Store>({});
  useEffect(() => {
    setStore(read());
    const h = () => setStore(read());
    window.addEventListener(EVT, h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener(EVT, h);
      window.removeEventListener("storage", h);
    };
  }, []);
  return store;
}
