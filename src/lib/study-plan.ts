// Frontend-only study plan generator + persistence.
import { useCallback, useEffect, useState } from "react";
import type { Area } from "./storage";
import { AREAS } from "./storage";
import { ESSAY_THEMES } from "./essay-themes";
import { SUBJECTS, type Subject } from "./subjects";

const KEY = "exame:study-plan:v1";

export type TaskType = "teoria" | "questoes" | "revisao" | "simulado" | "redacao";
export type TaskStatus = "pendente" | "concluida" | "atrasada";
export type Focus = Area | "redacao" | "balanced";

export interface StudyPlanConfig {
  examDate: string; // ISO date
  hoursPerDay: number; // e.g. 2
  weekdays: number[]; // 0=Sun..6=Sat
  hardAreas: Area[];
  targetScore: number; // 0-1000
  focus: Focus;
  subjects?: string[]; // opcional: IDs de matérias específicas a priorizar
}

export interface StudyTask {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  area: Area | "redacao" | "geral";
  type: TaskType;
  minutes: number;
  status: TaskStatus;
  note?: string;
  // Integração com "Estudar": para teoria, apontamos para um tópico
  // específico (slug de study_topics) ou pelo menos a área, para o
  // CTA "Estudar" resolver e abrir /aula/$topicId.
  topicSlug?: string;
  topicArea?: Area;
}

// Mapeamento parcial de subject id (SUBJECTS) → slug em study_topics.
// Quando o plano é gerado com matérias específicas, se houver
// correspondência aqui a tarefa de teoria abre exatamente aquele tópico.
// Fora daqui o CTA cai no fallback por área.
const SUBJECT_TO_TOPIC_SLUG: Record<string, string> = {
  "ling-interp": "lin-interpretacao",
  "ling-gram": "lin-gramatica",
  "ling-lit": "lin-literatura",
  "ling-ingles": "lin-ingles",
};

export interface StudyPlan {
  id: string;
  createdAt: number;
  config: StudyPlanConfig;
  tasks: StudyTask[];
}

const TYPE_LABEL: Record<TaskType, string> = {
  teoria: "Teoria",
  questoes: "Questões",
  revisao: "Revisão",
  simulado: "Simulado",
  redacao: "Redação",
};

const AREA_LABEL: Record<Area | "redacao" | "geral", string> = {
  linguagens: "Linguagens",
  humanas: "Humanas",
  natureza: "Natureza",
  matematica: "Matemática",
  redacao: "Redação",
  geral: "Geral",
};

export function typeLabel(t: TaskType): string {
  return TYPE_LABEL[t];
}
export function areaLabel(a: StudyTask["area"]): string {
  return AREA_LABEL[a];
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayIso(): string {
  return isoDate(new Date());
}

function rid(): string {
  return Math.random().toString(36).slice(2, 10);
}

// Build a weighted rotation of areas (hard + focus areas first).
function buildAreaQueue(cfg: StudyPlanConfig): Area[] {
  const all = AREAS.map((a) => a.id);
  const weight: Record<Area, number> = {
    linguagens: 1,
    humanas: 1,
    natureza: 1,
    matematica: 1,
  };
  cfg.hardAreas.forEach((a) => (weight[a] += 2));
  if (cfg.focus !== "balanced" && cfg.focus !== "redacao") {
    weight[cfg.focus] += 2;
  }
  const queue: Area[] = [];
  all.forEach((a) => {
    for (let i = 0; i < weight[a]; i++) queue.push(a);
  });
  return queue;
}

interface Slot {
  type: TaskType;
  area: StudyTask["area"];
  minutes: number;
  title: (label: string) => string;
  topicArea?: Area;
  topicSlug?: string;
}

type Pick = { area: StudyTask["area"]; label: string; subjectId?: string };

function buildSubjectQueue(cfg: StudyPlanConfig): Subject[] | null {
  if (!cfg.subjects?.length) return null;
  const chosen = SUBJECTS.filter(
    (s) => cfg.subjects!.includes(s.id) && s.area !== "redacao",
  );
  if (!chosen.length) return null;
  const queue: Subject[] = [];
  chosen.forEach((s) => {
    const w = cfg.hardAreas.includes(s.area as Area) ? 3 : 1;
    for (let i = 0; i < w; i++) queue.push(s);
  });
  return queue;
}

function makePicker(cfg: StudyPlanConfig): () => Pick {
  const subjectQueue = buildSubjectQueue(cfg);
  if (subjectQueue) {
    let i = 0;
    return () => {
      const s = subjectQueue[i % subjectQueue.length];
      i += 1;
      return { area: s.area as Area, label: s.name, subjectId: s.id };
    };
  }
  const areaQueue = buildAreaQueue(cfg);
  let i = 0;
  return () => {
    const a = areaQueue[i % areaQueue.length];
    i += 1;
    return { area: a, label: AREA_LABEL[a] };
  };
}

function dayTemplate(
  weekday: number,
  pick: () => Pick,
  focus: Focus,
): Slot[] {
  const wantsRedacao = focus === "redacao";

  // Base templates (sum ~120min); they get scaled to hoursPerDay later.
  switch (weekday) {
    case 6: // Sat — simulado
      return [
        {
          type: "simulado",
          area: "geral",
          minutes: 90,
          title: () => "Simulado rápido (10 questões)",
        },
        {
          type: "revisao",
          area: "geral",
          minutes: 30,
          title: () => "Revisar erros do simulado",
        },
      ];
    case 0: // Sun — redação + revisão
      return [
        {
          type: "redacao",
          area: "redacao",
          minutes: 70,
          title: () => "Redação completa cronometrada",
        },
        {
          type: "revisao",
          area: "geral",
          minutes: 50,
          title: () => "Revisão da semana",
        },
      ];
    default: {
      const p1 = pick();
      const p2 = pick();
      const slots: Slot[] = [
        {
          type: "teoria",
          area: p1.area,
          minutes: 50,
          title: () => `Teoria de ${p1.label}`,
          topicArea: p1.area === "geral" || p1.area === "redacao" ? undefined : (p1.area as Area),
          topicSlug: p1.subjectId ? SUBJECT_TO_TOPIC_SLUG[p1.subjectId] : undefined,
        },
        {
          type: "questoes",
          area: p2.area,
          minutes: 50,
          title: () => `10 questões de ${p2.label}`,
        },
      ];
      slots.push(
        wantsRedacao && weekday % 2 === 0
          ? {
              type: "redacao",
              area: "redacao",
              minutes: 30,
              title: () => "Treino de parágrafo dissertativo",
            }
          : {
              type: "revisao",
              area: "geral",
              minutes: 30,
              title: () => "Revisão espaçada (flashcards/erros)",
            },
      );
      return slots;
    }
  }
}

export function generatePlan(cfg: StudyPlanConfig): StudyPlan {
  const tasks: StudyTask[] = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(cfg.examDate);
  end.setHours(0, 0, 0, 0);

  const pick = makePicker(cfg);
  const themes = [...ESSAY_THEMES];
  let themeIdx = 0;

  const targetMinPerDay = Math.max(30, Math.round(cfg.hoursPerDay * 60));

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const wd = d.getDay();
    if (!cfg.weekdays.includes(wd)) continue;
    const slots = dayTemplate(wd, pick, cfg.focus);
    const base = slots.reduce((s, x) => s + x.minutes, 0);
    const scale = targetMinPerDay / base;
    const dateStr = isoDate(d);
    slots.forEach((s) => {
      let title = s.title("");
      if (s.type === "redacao" && s.area === "redacao" && !title.includes(":")) {
        const t = themes[themeIdx % themes.length];
        themeIdx += 1;
        title = `Redação: ${t.titulo}`;
      } else if (s.type === "redacao") {
        const t = themes[themeIdx % themes.length];
        themeIdx += 1;
        title = `Redação: ${t.titulo}`;
      }
      tasks.push({
        id: rid(),
        date: dateStr,
        title,
        area: s.area,
        type: s.type,
        minutes: Math.max(15, Math.round(s.minutes * scale)),
        status: "pendente",
        topicSlug: s.topicSlug,
        topicArea: s.topicArea,
      });
    });
  }

  return {
    id: rid(),
    createdAt: Date.now(),
    config: cfg,
    tasks,
  };
}

// ---- persistence + hook ----

function read(): StudyPlan | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StudyPlan) : null;
  } catch {
    return null;
  }
}

function write(p: StudyPlan | null) {
  if (typeof window === "undefined") return;
  if (p) localStorage.setItem(KEY, JSON.stringify(p));
  else localStorage.removeItem(KEY);
  window.dispatchEvent(new Event("exame:study-plan"));
}

export function resolvedStatus(t: StudyTask): TaskStatus {
  if (t.status === "concluida") return "concluida";
  if (t.date < todayIso()) return "atrasada";
  return "pendente";
}

export function useStudyPlan() {
  const [plan, setPlan] = useState<StudyPlan | null>(null);

  useEffect(() => {
    setPlan(read());
    const h = () => setPlan(read());
    window.addEventListener("exame:study-plan", h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener("exame:study-plan", h);
      window.removeEventListener("storage", h);
    };
  }, []);

  const savePlan = useCallback((cfg: StudyPlanConfig) => {
    const p = generatePlan(cfg);
    write(p);
    setPlan(p);
    return p;
  }, []);

  const clearPlan = useCallback(() => {
    write(null);
    setPlan(null);
  }, []);

  const updateTask = useCallback(
    (id: string, patch: Partial<StudyTask>) => {
      const cur = read();
      if (!cur) return;
      const next: StudyPlan = {
        ...cur,
        tasks: cur.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      };
      write(next);
      setPlan(next);
    },
    [],
  );

  const toggleDone = useCallback(
    (id: string) => {
      const cur = read();
      if (!cur) return;
      const next: StudyPlan = {
        ...cur,
        tasks: cur.tasks.map((t) =>
          t.id === id
            ? { ...t, status: t.status === "concluida" ? "pendente" : "concluida" }
            : t,
        ),
      };
      write(next);
      setPlan(next);
    },
    [],
  );

  return { plan, savePlan, clearPlan, updateTask, toggleDone };
}

// Pick today's most important task: first non-concluída of today, else first atrasada.
export function topTaskFor(plan: StudyPlan | null): StudyTask | null {
  if (!plan) return null;
  const today = todayIso();
  const todays = plan.tasks
    .filter((t) => t.date === today && t.status !== "concluida")
    .sort((a, b) => priority(b) - priority(a));
  if (todays.length) return todays[0];
  const late = plan.tasks
    .filter((t) => t.date < today && t.status !== "concluida")
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  return late[0] ?? null;
}

function priority(t: StudyTask): number {
  // simulado > redação > questões > teoria > revisão
  const order: Record<TaskType, number> = {
    simulado: 5,
    redacao: 4,
    questoes: 3,
    teoria: 2,
    revisao: 1,
  };
  return order[t.type];
}

export function tasksForDate(plan: StudyPlan, date: string): StudyTask[] {
  return plan.tasks.filter((t) => t.date === date);
}

export function weekDates(from: Date = new Date()): string[] {
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  // Start on Monday
  const day = start.getDay();
  const diff = (day + 6) % 7;
  start.setDate(start.getDate() - diff);
  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    out.push(isoDate(d));
  }
  return out;
}

export function dateLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
}

export const WEEKDAYS = [
  { id: 0, label: "Dom" },
  { id: 1, label: "Seg" },
  { id: 2, label: "Ter" },
  { id: 3, label: "Qua" },
  { id: 4, label: "Qui" },
  { id: 5, label: "Sex" },
  { id: 6, label: "Sáb" },
];
