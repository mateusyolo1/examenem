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

// Catálogo de tópicos vindo do banco (`study_topics`), usado pelo gerador
// para rotacionar as tarefas de teoria em tópicos concretos (ex: "Funções",
// "Geometria Plana") em vez de só nomes de área.
export interface TopicCatalogEntry {
  slug: string;
  area: Area;
  title: string;
  subject: string | null;
  sort_order: number;
}

// Desempenho por tópico (Abordagem 3) — alimentado por `topic_mastery`.
export interface TopicMastery {
  topic_slug: string;
  area: Area;
  last_score: number; // 0..1
  attempts: number;
  last_seen_at: string;
  next_review_at: string;
  mastered: boolean;
}






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
// Mastery increases weight for areas whose average score is low (< 0.6).
function buildAreaQueue(
  cfg: StudyPlanConfig,
  mastery?: TopicMastery[],
): Area[] {
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
  if (mastery && mastery.length) {
    const byArea: Record<Area, number[]> = {
      linguagens: [], humanas: [], natureza: [], matematica: [],
    };
    for (const m of mastery) {
      if (m.area in byArea) byArea[m.area].push(m.last_score);
    }
    (Object.keys(byArea) as Area[]).forEach((a) => {
      const scores = byArea[a];
      if (!scores.length) return;
      const avg = scores.reduce((s, x) => s + x, 0) / scores.length;
      if (avg < 0.6) weight[a] += 2; // reforço
      else if (avg >= 0.85) weight[a] = Math.max(1, weight[a] - 1); // já domina
    });
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

type Pick = {
  area: StudyTask["area"];
  label: string;
  subjectId?: string;
  topicSlug?: string;
  topicTitle?: string;
  topicArea?: Area;
};

function buildTopicQueuesByArea(
  catalog: TopicCatalogEntry[] | undefined,
  mastery?: TopicMastery[],
): Record<Area, TopicCatalogEntry[]> {
  const out: Record<Area, TopicCatalogEntry[]> = {
    linguagens: [],
    humanas: [],
    natureza: [],
    matematica: [],
  };
  if (!catalog) return out;
  // Skip tópicos dominados cujo next_review_at ainda é no futuro.
  const now = Date.now();
  const skip = new Set<string>();
  if (mastery) {
    for (const m of mastery) {
      if (m.mastered && new Date(m.next_review_at).getTime() > now) {
        skip.add(m.topic_slug);
      }
    }
  }
  for (const t of catalog) {
    if (!(t.area in out)) continue;
    if (skip.has(t.slug)) continue;
    out[t.area].push(t);
  }
  (Object.keys(out) as Area[]).forEach((a) =>
    out[a].sort((x, y) => x.sort_order - y.sort_order),
  );
  // Se todos os tópicos de uma área foram pulados, cai no catálogo cheio
  // dessa área (o aluno ainda precisa estudar algo lá).
  (Object.keys(out) as Area[]).forEach((a) => {
    if (out[a].length === 0) {
      const fallback = catalog
        .filter((t) => t.area === a)
        .sort((x, y) => x.sort_order - y.sort_order);
      out[a] = fallback;
    }
  });
  return out;
}

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

function makePicker(
  cfg: StudyPlanConfig,
  catalog: TopicCatalogEntry[] | undefined,
  mastery: TopicMastery[] | undefined,
): () => Pick {
  const topicsByArea = buildTopicQueuesByArea(catalog, mastery);
  const topicIdx: Record<Area, number> = {
    linguagens: 0,
    humanas: 0,
    natureza: 0,
    matematica: 0,
  };

  function nextTopicFor(area: Area): TopicCatalogEntry | undefined {
    const list = topicsByArea[area];
    if (!list.length) return undefined;
    const t = list[topicIdx[area] % list.length];
    topicIdx[area] += 1;
    return t;
  }

  const subjectQueue = buildSubjectQueue(cfg);
  if (subjectQueue) {
    let i = 0;
    return () => {
      const s = subjectQueue[i % subjectQueue.length];
      i += 1;
      const area = s.area as Area;
      const topic = nextTopicFor(area);
      return {
        area,
        label: s.name,
        subjectId: s.id,
        topicSlug: topic?.slug,
        topicTitle: topic?.title,
        topicArea: area,
      };
    };
  }
  const areaQueue = buildAreaQueue(cfg, mastery);
  let i = 0;
  return () => {
    const a = areaQueue[i % areaQueue.length];
    i += 1;
    const topic = nextTopicFor(a);
    return {
      area: a,
      label: AREA_LABEL[a],
      topicSlug: topic?.slug,
      topicTitle: topic?.title,
      topicArea: a,
    };
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
      const teoriaTitle = p1.topicTitle
        ? `Teoria: ${p1.topicTitle}`
        : `Teoria de ${p1.label}`;
      const slots: Slot[] = [
        {
          type: "teoria",
          area: p1.area,
          minutes: 50,
          title: () => teoriaTitle,
          topicArea: p1.topicArea,
          topicSlug: p1.topicSlug,
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


export function generatePlan(
  cfg: StudyPlanConfig,
  catalog?: TopicCatalogEntry[],
  mastery?: TopicMastery[],
): StudyPlan {
  const tasks: StudyTask[] = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(cfg.examDate);
  end.setHours(0, 0, 0, 0);

  const pick = makePicker(cfg, catalog, mastery);

  const themes = [...ESSAY_THEMES];
  let themeIdx = 0;

  const targetMinPerDay = Math.max(30, Math.round(cfg.hoursPerDay * 60));

  // Revisões devidas: para cada mastery cujo next_review_at <= hoje,
  // criamos uma tarefa `revisao` com topicSlug apontando pra aula.
  // Distribuímos ao longo dos primeiros dias úteis do plano.
  const dueReviews: TopicMastery[] = [];
  if (mastery && catalog) {
    const now = Date.now();
    const catalogBySlug = new Map(catalog.map((t) => [t.slug, t]));
    for (const m of mastery) {
      if (new Date(m.next_review_at).getTime() > now) continue;
      if (!catalogBySlug.has(m.topic_slug)) continue;
      dueReviews.push(m);
    }
    // Reforço primeiro (score baixo antes de score alto)
    dueReviews.sort((a, b) => a.last_score - b.last_score);
  }
  const reviewCatalog = new Map(
    (catalog ?? []).map((t) => [t.slug, t] as const),
  );
  let reviewIdx = 0;

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const wd = d.getDay();
    if (!cfg.weekdays.includes(wd)) continue;
    const slots = dayTemplate(wd, pick, cfg.focus);
    const base = slots.reduce((s, x) => s + x.minutes, 0);
    const scale = targetMinPerDay / base;
    const dateStr = isoDate(d);
    slots.forEach((s) => {
      let title = s.title("");
      let topicSlug = s.topicSlug;
      let topicArea = s.topicArea;
      let area: StudyTask["area"] = s.area;
      let type = s.type;

      // Se houver revisão devida e o slot atual é "revisao geral",
      // troca por uma revisão focada num tópico.
      if (s.type === "revisao" && reviewIdx < dueReviews.length) {
        const due = dueReviews[reviewIdx++];
        const t = reviewCatalog.get(due.topic_slug);
        if (t) {
          title = `Revisão: ${t.title}`;
          topicSlug = t.slug;
          topicArea = t.area;
          area = t.area;
          type = "revisao";
        }
      } else if (s.type === "redacao" && s.area === "redacao" && !title.includes(":")) {
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
        area,
        type,
        minutes: Math.max(15, Math.round(s.minutes * scale)),
        status: "pendente",
        topicSlug,
        topicArea,
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

/**
 * Reagenda tarefas atrasadas: move as pendentes com data no passado para
 * os próximos dias válidos (weekdays) do plano, respeitando o limite de
 * minutos por dia. Retorna um novo StudyPlan.
 */
export function rescheduleOverdue(plan: StudyPlan): StudyPlan {
  const today = todayIso();
  const targetMin = Math.max(30, Math.round(plan.config.hoursPerDay * 60));
  // Minutos já ocupados por dia (contando pendentes + concluídas no futuro).
  const perDay = new Map<string, number>();
  for (const t of plan.tasks) {
    if (t.date < today) continue;
    perDay.set(t.date, (perDay.get(t.date) ?? 0) + t.minutes);
  }
  const isWeekday = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return plan.config.weekdays.includes(new Date(y, m - 1, d).getDay());
  };
  const nextSlotFor = (mins: number): string | null => {
    const d = new Date(today);
    for (let i = 0; i < 120; i++) {
      const iso = isoDate(d);
      if (isWeekday(iso) && (perDay.get(iso) ?? 0) + mins <= targetMin * 1.25) {
        perDay.set(iso, (perDay.get(iso) ?? 0) + mins);
        return iso;
      }
      d.setDate(d.getDate() + 1);
    }
    return null;
  };

  const nextTasks = plan.tasks.map((t) => {
    if (t.status !== "pendente" || t.date >= today) return t;
    const dst = nextSlotFor(t.minutes);
    if (!dst) return t;
    return { ...t, date: dst };
  });
  const next: StudyPlan = { ...plan, tasks: nextTasks };
  write(next);
  return next;
}

/** Conta quantas tarefas estão atrasadas (pendentes com data < hoje). */
export function countOverdue(plan: StudyPlan): number {
  const today = todayIso();
  return plan.tasks.filter((t) => t.status === "pendente" && t.date < today).length;
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

// Standalone helper (não precisa do hook) — usado por outras telas
// (aula, prática) para marcar a tarefa vinculada como concluída assim
// que o aluno termina a atividade que veio do cronograma.
export function markPlanTaskDone(id: string) {
  const cur = read();
  if (!cur) return;
  const target = cur.tasks.find((t) => t.id === id);
  if (!target || target.status === "concluida") return;
  const next: StudyPlan = {
    ...cur,
    tasks: cur.tasks.map((t) =>
      t.id === id ? { ...t, status: "concluida" as const } : t,
    ),
  };
  write(next);
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

  const savePlan = useCallback(
    (
      cfg: StudyPlanConfig,
      catalog?: TopicCatalogEntry[],
      mastery?: TopicMastery[],
    ) => {
      const p = generatePlan(cfg, catalog, mastery);
      write(p);
      setPlan(p);
      return p;
    },
    [],
  );



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
