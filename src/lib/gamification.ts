// Frontend-only gamification: XP, levels, achievements.
// All values derive from existing Progress + ReviewState — no extra storage.
import type { Progress, EssayRecord } from "./storage";
import { AREAS, areaStats, type Area } from "./storage";
import { QUESTION_AREA_MAP } from "./questions-data";

export const XP = {
  perAnswer: 10,
  perCorrect: 15, // bonus on top of perAnswer
  perEssay: 100,
  perSimulado: 50,
  perSimuladoCorrect: 5,
  perStreakDay: 20,
};

export interface XPBreakdown {
  answers: number;
  correct: number;
  essays: number;
  simulados: number;
  streak: number;
  total: number;
}

export function computeXP(progress: Progress): XPBreakdown {
  const ans = Object.values(progress.answers);
  const correct = ans.filter((a) => a.correct).length;
  const answers = ans.length * XP.perAnswer;
  const correctXp = correct * XP.perCorrect;
  const essays = progress.essays.length * XP.perEssay;
  const simXp = progress.simulados.reduce(
    (s, x) => s + XP.perSimulado + (x.score || 0) * XP.perSimuladoCorrect,
    0,
  );
  const streak = progress.streakDays * XP.perStreakDay;
  return {
    answers,
    correct: correctXp,
    essays,
    simulados: simXp,
    streak,
    total: answers + correctXp + essays + simXp + streak,
  };
}

// Level curve: gentle quadratic. Level N requires N*(N-1)*150 XP total.
// L1: 0, L2: 300, L3: 900, L4: 1800, L5: 3000, L6: 4500, L7: 6300, L8: 8400.
export function xpForLevel(level: number): number {
  return level * (level - 1) * 150;
}

export interface LevelInfo {
  level: number;
  title: string;
  xpInLevel: number;
  xpToNext: number;
  progress: number; // 0-100
}

const TITLES = [
  "Iniciante",
  "Aprendiz",
  "Estudante",
  "Dedicado",
  "Avançado",
  "Veterano",
  "Especialista",
  "Mestre",
  "Lenda",
];

export function levelFor(totalXp: number): LevelInfo {
  let level = 1;
  while (xpForLevel(level + 1) <= totalXp) level += 1;
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const span = Math.max(1, next - base);
  const into = totalXp - base;
  return {
    level,
    title: TITLES[Math.min(level - 1, TITLES.length - 1)],
    xpInLevel: into,
    xpToNext: next - totalXp,
    progress: Math.min(100, Math.round((into / span) * 100)),
  };
}

// ---------- Achievements ----------

export interface AchievementCtx {
  progress: Progress;
  reviewsCompleted: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  category: "estudo" | "redacao" | "simulado" | "consistencia" | "dominio";
  check: (ctx: AchievementCtx) => { unlocked: boolean; progress?: number; target?: number };
}

function countAnswers(progress: Progress) {
  return Object.values(progress.answers).length;
}
function countAnswersToday(progress: Progress) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return Object.values(progress.answers).filter((a) => a.at >= start.getTime()).length;
}
function bestEssay(essays: EssayRecord[]): number {
  return essays.reduce((m, e) => {
    const f = (e.feedback ?? {}) as { notaFinal?: number };
    return Math.max(m, f.notaFinal ?? 0);
  }, 0);
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: "first-question",
    title: "Primeira questão",
    description: "Responda sua primeira questão.",
    category: "estudo",
    check: ({ progress }) => {
      const n = countAnswers(progress);
      return { unlocked: n >= 1, progress: Math.min(n, 1), target: 1 };
    },
  },
  {
    id: "streak-7",
    title: "7 dias de streak",
    description: "Estude por 7 dias consecutivos.",
    category: "consistencia",
    check: ({ progress }) => ({
      unlocked: progress.streakDays >= 7,
      progress: Math.min(progress.streakDays, 7),
      target: 7,
    }),
  },
  {
    id: "streak-30",
    title: "30 dias de streak",
    description: "Mantenha o ritmo por um mês inteiro.",
    category: "consistencia",
    check: ({ progress }) => ({
      unlocked: progress.streakDays >= 30,
      progress: Math.min(progress.streakDays, 30),
      target: 30,
    }),
  },
  {
    id: "thirty-in-a-day",
    title: "Maratonista",
    description: "Responda 30 questões em um único dia.",
    category: "estudo",
    check: ({ progress }) => {
      const n = countAnswersToday(progress);
      return { unlocked: n >= 30, progress: Math.min(n, 30), target: 30 };
    },
  },
  {
    id: "hundred-answers",
    title: "Centena",
    description: "Acumule 100 questões respondidas.",
    category: "estudo",
    check: ({ progress }) => {
      const n = countAnswers(progress);
      return { unlocked: n >= 100, progress: Math.min(n, 100), target: 100 };
    },
  },
  {
    id: "first-essay",
    title: "Primeira redação corrigida",
    description: "Envie uma redação para correção.",
    category: "redacao",
    check: ({ progress }) => ({
      unlocked: progress.essays.length >= 1,
      progress: Math.min(progress.essays.length, 1),
      target: 1,
    }),
  },
  {
    id: "essay-800",
    title: "Acima de 800",
    description: "Tire 800+ em uma redação.",
    category: "redacao",
    check: ({ progress }) => {
      const top = bestEssay(progress.essays);
      return { unlocked: top >= 800, progress: Math.min(top, 800), target: 800 };
    },
  },
  {
    id: "first-simulado",
    title: "Primeiro simulado",
    description: "Conclua um simulado do início ao fim.",
    category: "simulado",
    check: ({ progress }) => ({
      unlocked: progress.simulados.length >= 1,
      progress: Math.min(progress.simulados.length, 1),
      target: 1,
    }),
  },
  {
    id: "five-simulados",
    title: "Veterano de prova",
    description: "Conclua 5 simulados.",
    category: "simulado",
    check: ({ progress }) => ({
      unlocked: progress.simulados.length >= 5,
      progress: Math.min(progress.simulados.length, 5),
      target: 5,
    }),
  },
  {
    id: "math-80",
    title: "80% em Matemática",
    description: "Atinja 80% de acerto em Matemática com pelo menos 10 questões.",
    category: "dominio",
    check: ({ progress }) => {
      const s = areaStats(progress, "matematica", QUESTION_AREA_MAP);
      const ok = s.total >= 10 && s.accuracy >= 80;
      return { unlocked: ok, progress: s.accuracy, target: 80 };
    },
  },
  {
    id: "all-areas",
    title: "Explorador",
    description: "Responda ao menos 1 questão em cada uma das 4 áreas.",
    category: "estudo",
    check: ({ progress }) => {
      const n = (AREAS as { id: Area }[]).filter(
        (a) => areaStats(progress, a.id, QUESTION_AREA_MAP).total > 0,
      ).length;
      return { unlocked: n >= 4, progress: n, target: 4 };
    },
  },
  {
    id: "reviews-5",
    title: "Revisor",
    description: "Conclua 5 revisões espaçadas.",
    category: "consistencia",
    check: ({ reviewsCompleted }) => ({
      unlocked: reviewsCompleted >= 5,
      progress: Math.min(reviewsCompleted, 5),
      target: 5,
    }),
  },
];

export function categoryLabel(c: Achievement["category"]): string {
  return {
    estudo: "Estudo",
    redacao: "Redação",
    simulado: "Simulado",
    consistencia: "Consistência",
    dominio: "Domínio",
  }[c];
}
