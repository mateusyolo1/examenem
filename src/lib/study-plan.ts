// Study plan generator + persistence.
// Fonte da verdade: tabela `user_study_plan` no Supabase (server fns em
// `study-plan.functions.ts`). `localStorage` serve apenas como cache leve
// para hidratação inicial rápida enquanto o servidor responde.
import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  saveStudyPlan as saveStudyPlanFn,
  loadStudyPlan as loadStudyPlanFn,
  clearStudyPlan as clearStudyPlanFn,
  markStudyTaskDone as markStudyTaskDoneFn,
} from "./study-plan.functions";
import type { Area } from "./storage";
import { AREAS } from "./storage";
import { ESSAY_THEMES } from "./essay-themes";
import { SUBJECTS, type Subject } from "./subjects";

const KEY = "exame:study-plan:v1";

export type TaskType =
  | "teoria"
  | "questoes"
  | "revisao"
  | "simulado"
  | "redacao"
  | "mapa_mental"
  | "flashcards"
  | "resumo"
  | "prova_antiga"
  | "videoaula"
  | "projeto";
export type TaskStatus = "pendente" | "concluida" | "atrasada";
export type Focus = Area | "redacao" | "balanced";
export type Variation = "baixa" | "media" | "alta";

export interface StudyPlanConfig {
  examDate: string; // ISO date
  examId?: string;
  examName?: string;
  hoursPerDay: number; // e.g. 2
  weekdays: number[]; // 0=Sun..6=Sat
  hardAreas: Area[];
  targetScore: number; // 0-1000
  focus: Focus;
  subjects?: string[];
  variation?: Variation; // opcional, default "media"
}

export interface StudyTask {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  area: Area | "redacao" | "geral";
  type: TaskType;
  minutes: number;
  status: TaskStatus;
  note?: string; // dica curta (usada pela camada de IA)
  aiEnriched?: boolean; // flag: título/note vieram da IA
  topicSlug?: string;
  topicArea?: Area;
}

export interface TopicCatalogEntry {
  slug: string;
  area: Area;
  title: string;
  subject: string | null;
  sort_order: number;
  video_duration_seconds?: number;
}

// Estimativa calibrada de minutos para uma tarefa de videoaula, a partir da
// duração real do vídeo mais curto do tópico. Formula: ceil(dur/60) + 5 min
// de processamento/anotação, com clamp [8, 60]. Sem duração, retorna fallback.
export function videoMinutesFromDuration(
  durationSec?: number,
  fallback = 30,
): number {
  if (!durationSec || durationSec <= 0) return fallback;
  const m = Math.ceil(durationSec / 60) + 5;
  return Math.max(8, Math.min(60, m));
}

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
  seed?: number;
  config: StudyPlanConfig;
  tasks: StudyTask[];
}

const TYPE_LABEL: Record<TaskType, string> = {
  teoria: "Teoria",
  questoes: "Questões",
  revisao: "Revisão",
  simulado: "Simulado",
  redacao: "Redação",
  mapa_mental: "Mapa mental",
  flashcards: "Flashcards",
  resumo: "Resumo",
  prova_antiga: "Prova antiga",
  videoaula: "Videoaula",
  projeto: "Projeto aplicado",
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
  return TYPE_LABEL[t] ?? t;
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

// -------- RNG semeada (LCG determinística) --------
function makeRng(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => {
    // LCG (Numerical Recipes)
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}
function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function pickOne<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}
function hashConfig(cfg: StudyPlanConfig): number {
  const s = JSON.stringify(cfg);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// -------- Filas de área/tópico --------
function buildAreaQueue(
  cfg: StudyPlanConfig,
  mastery: TopicMastery[] | undefined,
  rng: () => number,
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
      if (avg < 0.6) weight[a] += 2;
      else if (avg >= 0.85) weight[a] = Math.max(1, weight[a] - 1);
    });
  }
  const queue: Area[] = [];
  all.forEach((a) => {
    for (let i = 0; i < weight[a]; i++) queue.push(a);
  });
  return shuffle(queue, rng);
}

interface Slot {
  type: TaskType;
  area: StudyTask["area"];
  minutes: number;
  title: string;
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
  videoDurationSeconds?: number;
};

function buildTopicQueuesByArea(
  catalog: TopicCatalogEntry[] | undefined,
  mastery: TopicMastery[] | undefined,
  rng: () => number,
): Record<Area, TopicCatalogEntry[]> {
  const out: Record<Area, TopicCatalogEntry[]> = {
    linguagens: [], humanas: [], natureza: [], matematica: [],
  };
  if (!catalog) return out;
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
  (Object.keys(out) as Area[]).forEach((a) => {
    if (out[a].length === 0) {
      out[a] = catalog.filter((t) => t.area === a);
    }
    out[a] = shuffle(out[a], rng);
  });
  return out;
}

function buildSubjectQueue(
  cfg: StudyPlanConfig,
  rng: () => number,
): Subject[] | null {
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
  return shuffle(queue, rng);
}

function makePicker(
  cfg: StudyPlanConfig,
  catalog: TopicCatalogEntry[] | undefined,
  mastery: TopicMastery[] | undefined,
  rng: () => number,
): () => Pick {
  const topicsByArea = buildTopicQueuesByArea(catalog, mastery, rng);
  const topicIdx: Record<Area, number> = {
    linguagens: 0, humanas: 0, natureza: 0, matematica: 0,
  };

  function nextTopicFor(area: Area): TopicCatalogEntry | undefined {
    const list = topicsByArea[area];
    if (!list.length) return undefined;
    const t = list[topicIdx[area] % list.length];
    topicIdx[area] += 1;
    return t;
  }

  const subjectQueue = buildSubjectQueue(cfg, rng);
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
        videoDurationSeconds: topic?.video_duration_seconds,
      };
    };
  }
  const areaQueue = buildAreaQueue(cfg, mastery, rng);
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

// -------- Templates variados por dia --------

// Helpers para gerar títulos com base em Pick
function topicOr(p: Pick, fallback: (label: string) => string): string {
  return p.topicTitle ? `${fallback("").split(" de ")[0]}: ${p.topicTitle}` : fallback(p.label);
}
function slotFrom(
  p: Pick,
  type: TaskType,
  minutes: number,
  title: string,
): Slot {
  const carryTopic = type === "teoria" || type === "videoaula" ||
    type === "mapa_mental" || type === "resumo" || type === "revisao" ||
    type === "flashcards" || type === "projeto";
  return {
    type,
    area: p.area,
    minutes,
    title,
    topicArea: carryTopic ? p.topicArea : undefined,
    topicSlug: carryTopic ? p.topicSlug : undefined,
  };
}

type WeekdayTemplate = (pick: () => Pick, rng: () => number) => Slot[];

// Dias úteis: bateria de variantes
const WEEKDAY_TEMPLATES: WeekdayTemplate[] = [
  // 1) Teoria + Questões + Revisão espaçada
  (pick) => {
    const p1 = pick(), p2 = pick();
    return [
      slotFrom(p1, "teoria", 50, p1.topicTitle ? `Teoria: ${p1.topicTitle}` : `Teoria de ${p1.label}`),
      slotFrom(p2, "questoes", 50, `10 questões de ${p2.label}`),
      { type: "revisao", area: "geral", minutes: 30, title: "Revisão espaçada (flashcards/erros)" },
    ];
  },
  // 2) Videoaula + Resumo + Questões comentadas
  (pick) => {
    const p1 = pick(), p2 = pick();
    return [
      slotFrom(p1, "videoaula", 40, p1.topicTitle ? `Videoaula: ${p1.topicTitle}` : `Videoaula de ${p1.label}`),
      slotFrom(p1, "resumo", 30, p1.topicTitle ? `Resumo em tópicos: ${p1.topicTitle}` : `Resumo de ${p1.label}`),
      slotFrom(p2, "questoes", 50, `Questões comentadas de ${p2.label}`),
    ];
  },
  // 3) Mapa mental + Flashcards + Questões
  (pick) => {
    const p1 = pick(), p2 = pick();
    return [
      slotFrom(p1, "mapa_mental", 40, p1.topicTitle ? `Mapa mental: ${p1.topicTitle}` : `Mapa mental de ${p1.label}`),
      slotFrom(p1, "flashcards", 30, p1.topicTitle ? `Flashcards: ${p1.topicTitle}` : `Flashcards de ${p1.label}`),
      slotFrom(p2, "questoes", 50, `8 questões de ${p2.label}`),
    ];
  },
  // 4) Prova antiga curta + Análise de erros
  (pick) => {
    const p1 = pick(), p2 = pick();
    return [
      { type: "prova_antiga", area: p1.area, minutes: 50, title: `Prova antiga: 5 questões de ${p1.label}` },
      { type: "revisao", area: p1.area, minutes: 30, title: `Analisar erros de ${p1.label}` },
      slotFrom(p2, "teoria", 40, p2.topicTitle ? `Teoria: ${p2.topicTitle}` : `Teoria de ${p2.label}`),
    ];
  },
  // 5) Teoria profunda + Projeto/aplicação
  (pick) => {
    const p1 = pick(), p2 = pick();
    return [
      slotFrom(p1, "teoria", 60, p1.topicTitle ? `Teoria aprofundada: ${p1.topicTitle}` : `Teoria aprofundada de ${p1.label}`),
      slotFrom(p1, "projeto", 40, p1.topicTitle ? `Aplicação prática: ${p1.topicTitle}` : `Aplicação prática de ${p1.label}`),
      slotFrom(p2, "questoes", 20, `5 questões rápidas de ${p2.label}`),
    ];
  },
  // 6) Videoaula + Flashcards + Mini-simulado por área
  (pick) => {
    const p1 = pick(), p2 = pick();
    return [
      slotFrom(p1, "videoaula", 30, p1.topicTitle ? `Videoaula: ${p1.topicTitle}` : `Videoaula de ${p1.label}`),
      slotFrom(p1, "flashcards", 20, `Flashcards de ${p1.label}`),
      { type: "simulado", area: p2.area, minutes: 70, title: `Mini-simulado (10 q) de ${p2.label}` },
    ];
  },
];

// Sábado: rotaciona simulado x maratona x mini-simulado
const SATURDAY_TEMPLATES: WeekdayTemplate[] = [
  () => [
    { type: "simulado", area: "geral", minutes: 90, title: "Simulado rápido (10 questões)" },
    { type: "revisao", area: "geral", minutes: 30, title: "Revisar erros do simulado" },
  ],
  (pick) => {
    const p = pick();
    return [
      { type: "simulado", area: p.area, minutes: 80, title: `Mini-simulado de ${p.label} (15 questões)` },
      { type: "revisao", area: p.area, minutes: 40, title: `Revisão comentada — ${p.label}` },
    ];
  },
  (pick) => {
    const p1 = pick(), p2 = pick();
    return [
      { type: "questoes", area: p1.area, minutes: 60, title: `Maratona de questões — ${p1.label} (cronometrada)` },
      { type: "questoes", area: p2.area, minutes: 40, title: `Rodada extra de ${p2.label}` },
      { type: "revisao", area: "geral", minutes: 20, title: "Registrar dúvidas para revisar" },
    ];
  },
  () => [
    { type: "prova_antiga", area: "geral", minutes: 90, title: "Prova ENEM antiga: 1 caderno" },
    { type: "revisao", area: "geral", minutes: 30, title: "Corrigir e anotar erros" },
  ],
];

// Domingo: rotaciona redação completa x plano+parágrafo x correção x repertório
const SUNDAY_TEMPLATES: WeekdayTemplate[] = [
  () => [
    { type: "redacao", area: "redacao", minutes: 70, title: "Redação completa cronometrada" },
    { type: "revisao", area: "geral", minutes: 50, title: "Revisão da semana" },
  ],
  () => [
    { type: "redacao", area: "redacao", minutes: 40, title: "Plano de redação + parágrafo introdutório" },
    { type: "redacao", area: "redacao", minutes: 40, title: "Escrever 2 argumentos" },
    { type: "revisao", area: "geral", minutes: 20, title: "Revisão leve" },
  ],
  () => [
    { type: "redacao", area: "redacao", minutes: 50, title: "Correção guiada de redação anterior" },
    { type: "redacao", area: "redacao", minutes: 40, title: "Reescrever parágrafo mais fraco" },
    { type: "revisao", area: "geral", minutes: 20, title: "Consolidar conectivos e repertórios" },
  ],
  () => [
    { type: "redacao", area: "redacao", minutes: 60, title: "Leitura de repertório + fichamento (2 fontes)" },
    { type: "redacao", area: "redacao", minutes: 40, title: "Rascunho de introdução com repertório novo" },
  ],
];

function pickDayTemplate(
  weekday: number,
  focus: Focus,
  rng: () => number,
  weekdayCursor: number,
): WeekdayTemplate {
  if (weekday === 6) {
    // rotação semanal + jitter
    const idx = (weekdayCursor + Math.floor(rng() * SATURDAY_TEMPLATES.length)) %
      SATURDAY_TEMPLATES.length;
    return SATURDAY_TEMPLATES[idx];
  }
  if (weekday === 0) {
    const idx = (weekdayCursor + Math.floor(rng() * SUNDAY_TEMPLATES.length)) %
      SUNDAY_TEMPLATES.length;
    return SUNDAY_TEMPLATES[idx];
  }
  // Dias úteis: se foco é redação e é dia par, injeta template com redação
  if (focus === "redacao" && weekday % 2 === 0) {
    return (pick) => {
      const p1 = pick(), p2 = pick();
      return [
        slotFrom(p1, "teoria", 40, p1.topicTitle ? `Teoria: ${p1.topicTitle}` : `Teoria de ${p1.label}`),
        slotFrom(p2, "questoes", 40, `Questões de ${p2.label}`),
        { type: "redacao", area: "redacao", minutes: 40, title: "Treino de parágrafo dissertativo" },
      ];
    };
  }
  return pickOne(WEEKDAY_TEMPLATES, rng);
}

// -------- Geração --------

export function generatePlan(
  cfg: StudyPlanConfig,
  catalog?: TopicCatalogEntry[],
  mastery?: TopicMastery[],
  seed?: number,
): StudyPlan {
  const actualSeed = seed ?? ((Date.now() ^ hashConfig(cfg)) >>> 0);
  const rng = makeRng(actualSeed);

  const tasks: StudyTask[] = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(cfg.examDate);
  end.setHours(0, 0, 0, 0);

  const pick = makePicker(cfg, catalog, mastery, rng);
  const themes = shuffle(ESSAY_THEMES.slice(), rng);
  let themeIdx = 0;
  const targetMinPerDay = Math.max(30, Math.round(cfg.hoursPerDay * 60));

  // Revisões devidas (SRS): agenda mini-ciclo para score < 0.4
  const catalogBySlug = new Map((catalog ?? []).map((t) => [t.slug, t]));
  const dueReviews: Array<{ mastery: TopicMastery; kind: "srs" | "ciclo" }> = [];
  if (mastery) {
    const now = Date.now();
    for (const m of mastery) {
      if (new Date(m.next_review_at).getTime() > now) continue;
      if (!catalogBySlug.has(m.topic_slug)) continue;
      dueReviews.push({ mastery: m, kind: m.last_score < 0.4 ? "ciclo" : "srs" });
    }
    dueReviews.sort((a, b) => a.mastery.last_score - b.mastery.last_score);
  }
  let reviewIdx = 0;

  let weekdayCursor = Math.floor(rng() * 7);
  let lastKey: string | null = null;

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const wd = d.getDay();
    if (!cfg.weekdays.includes(wd)) continue;

    const template = pickDayTemplate(wd, cfg.focus, rng, weekdayCursor);
    weekdayCursor += 1;

    const slots = template(pick, rng);
    const base = slots.reduce((s, x) => s + x.minutes, 0);
    const scale = targetMinPerDay / base;
    const dateStr = isoDate(d);

    for (const s of slots) {
      let title = s.title;
      let topicSlug = s.topicSlug;
      let topicArea = s.topicArea;
      let area: StudyTask["area"] = s.area;
      let type = s.type;

      // Injetar revisão SRS onde couber
      if (s.type === "revisao" && reviewIdx < dueReviews.length) {
        const due = dueReviews[reviewIdx++];
        const t = catalogBySlug.get(due.mastery.topic_slug);
        if (t) {
          const pct = Math.round(due.mastery.last_score * 100);
          title = due.kind === "ciclo"
            ? `Recuperação: ${t.title} (última nota ${pct}%)`
            : `Revisão: ${t.title}`;
          topicSlug = t.slug;
          topicArea = t.area;
          area = t.area;
        }
      } else if (s.type === "redacao" && s.area === "redacao") {
        const t = themes[themeIdx % themes.length];
        themeIdx += 1;
        title = `${title} — Tema: ${t.titulo}`;
      }

      // Anti-monotonia: se o mesmo (tipo|título) apareceu ontem, rotaciona picker
      const key = `${type}|${title}`;
      if (key === lastKey) {
        // varia a área
        const p = pick();
        area = p.area;
      }
      lastKey = key;

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
    }
  }

  return {
    id: rid(),
    createdAt: Date.now(),
    seed: actualSeed,
    config: cfg,
    tasks,
  };
}

// -------- Merge de progresso ao regerar --------

function progressKey(t: StudyTask): string {
  return `${t.type}|${t.topicSlug ?? t.area}|${t.title.toLowerCase().slice(0, 40)}`;
}

function mergePriorProgress(next: StudyPlan, prior: StudyPlan | null): StudyPlan {
  if (!prior) return next;
  const doneMap = new Map<string, StudyTask>();
  for (const t of prior.tasks) {
    if (t.status === "concluida") doneMap.set(progressKey(t), t);
  }
  if (doneMap.size === 0) return next;
  const seen = new Set<string>();
  const tasks = next.tasks.map((t) => {
    const k = progressKey(t);
    if (seen.has(k)) return t;
    if (doneMap.has(k)) {
      seen.add(k);
      return { ...t, status: "concluida" as const };
    }
    return t;
  });
  return { ...next, tasks };
}

// -------- Reagendamento --------

export function rescheduleOverdue(plan: StudyPlan): StudyPlan {
  const today = todayIso();
  const targetMin = Math.max(30, Math.round(plan.config.hoursPerDay * 60));
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

export function countOverdue(plan: StudyPlan): number {
  const today = todayIso();
  return plan.tasks.filter((t) => t.status === "pendente" && t.date < today).length;
}

// -------- Persistência --------

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
  // sincroniza no servidor (fire-and-forget)
  markStudyTaskDoneFn({ data: { taskId: id } }).catch(() => {});
}

// Marca todas as tarefas de hoje que referenciam um tópico como concluídas.
export function markPlanTaskDoneByTopic(topicSlug: string) {
  const cur = read();
  if (!cur) return;
  const today = todayIso();
  const matching = cur.tasks.filter(
    (t) => t.topicSlug === topicSlug && t.date === today && t.status !== "concluida",
  );
  if (!matching.length) return;
  const matchIds = new Set(matching.map((t) => t.id));
  const next: StudyPlan = {
    ...cur,
    tasks: cur.tasks.map((t) =>
      matchIds.has(t.id) ? { ...t, status: "concluida" as const } : t,
    ),
  };
  write(next);
  markStudyTaskDoneFn({ data: { topicSlug, date: today } }).catch(() => {});
}

/** Aplica atualizações de título/nota vindas da camada de IA. */
export function applyAiEnrichment(
  updates: Array<{ id: string; title?: string; note?: string }>,
) {
  const cur = read();
  if (!cur) return;
  const map = new Map(updates.map((u) => [u.id, u]));
  const next: StudyPlan = {
    ...cur,
    tasks: cur.tasks.map((t) => {
      const u = map.get(t.id);
      if (!u) return t;
      return {
        ...t,
        title: u.title?.trim() ? u.title.trim() : t.title,
        note: u.note?.trim() ? u.note.trim() : t.note,
        aiEnriched: true,
      };
    }),
  };
  write(next);
}

export function useStudyPlan() {
  const [plan, setPlan] = useState<StudyPlan | null>(() => read());
  const qc = useQueryClient();
  const saveFn = useServerFn(saveStudyPlanFn);
  const loadFn = useServerFn(loadStudyPlanFn);
  const clearFn = useServerFn(clearStudyPlanFn);
  const markDoneFn = useServerFn(markStudyTaskDoneFn);
  const hydratedRef = useRef(false);

  // Hidrata do servidor na montagem. Se houver plano local e nenhum no servidor,
  // faz uma migração única (upload) e depois limpa o cache local.
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const res = await loadFn();
        const server = (res?.plan ?? null) as StudyPlan | null;
        if (cancelled) return;
        if (server) {
          write(server);
          setPlan(server);
          return;
        }
        const local = read();
        if (local) {
          try {
            await saveFn({ data: local });
          } catch {
            /* mantém local se falhar; nova tentativa na próxima montagem */
          }
        }
      } catch {
        /* offline: mantém o cache local */
      }
    })();
    const h = () => setPlan(read());
    window.addEventListener("exame:study-plan", h);
    window.addEventListener("storage", h);
    return () => {
      cancelled = true;
      window.removeEventListener("exame:study-plan", h);
      window.removeEventListener("storage", h);
    };
  }, [loadFn, saveFn]);

  const invalidateServerViews = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["today-agenda"] });
  }, [qc]);

  const savePlan = useCallback(
    (
      cfg: StudyPlanConfig,
      catalog?: TopicCatalogEntry[],
      mastery?: TopicMastery[],
    ) => {
      const prior = read();
      const generated = generatePlan(cfg, catalog, mastery);
      const merged = mergePriorProgress(generated, prior);
      write(merged);
      setPlan(merged);
      // dispara persistência no servidor (fire-and-forget com toast em caso de falha)
      saveFn({ data: merged }).then(invalidateServerViews).catch(() => {});
      return merged;
    },
    [saveFn, invalidateServerViews],
  );

  const clearPlan = useCallback(() => {
    write(null);
    setPlan(null);
    clearFn().then(invalidateServerViews).catch(() => {});
  }, [clearFn, invalidateServerViews]);

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
      saveFn({ data: next }).then(invalidateServerViews).catch(() => {});
    },
    [saveFn, invalidateServerViews],
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
      // usa mark server-side (transacional em cima do JSONB)
      markDoneFn({ data: { taskId: id, toggle: true } })
        .then(invalidateServerViews)
        .catch(() => {});
    },
    [markDoneFn, invalidateServerViews],
  );

  return { plan, savePlan, clearPlan, updateTask, toggleDone };
}

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

/**
 * Retorna a próxima tarefa "aula" de hoje (videoaula/teoria com topicSlug),
 * usada pela sidebar para mostrar dinamicamente o item "Sala de Aula".
 * Retorna null se não houver aula ativa no dia.
 */
export function useActiveClassroomTask(): StudyTask | null {
  // Começa null para evitar hydration mismatch — sincroniza no effect.
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
  if (!plan) return null;
  const today = todayIso();
  const candidates = plan.tasks.filter(
    (t) =>
      t.date === today &&
      t.status !== "concluida" &&
      t.topicSlug &&
      (t.type === "videoaula" || t.type === "teoria"),
  );
  return candidates[0] ?? null;
}

function priority(t: StudyTask): number {
  const order: Record<TaskType, number> = {
    simulado: 6,
    prova_antiga: 5,
    redacao: 5,
    questoes: 4,
    projeto: 3,
    videoaula: 3,
    teoria: 3,
    mapa_mental: 2,
    resumo: 2,
    flashcards: 2,
    revisao: 1,
  };
  return order[t.type] ?? 1;
}

export function tasksForDate(plan: StudyPlan, date: string): StudyTask[] {
  return plan.tasks.filter((t) => t.date === date);
}

export function weekDates(from: Date = new Date()): string[] {
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
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
