// Metadados compartilhados dos intents pedagógicos (Layer 6 / Gemini classifier).
// Usado por /aula, TodayVideosList e Cronograma para chip + legenda coerente.

export type PedagogicalIntentKey =
  | "introducao"
  | "teoria"
  | "exercicios"
  | "aplicacao"
  | "revisao";

export const INTENT_ORDER: PedagogicalIntentKey[] = [
  "introducao",
  "teoria",
  "exercicios",
  "aplicacao",
  "revisao",
];

export const INTENT_META: Record<
  PedagogicalIntentKey,
  { label: string; short: string; cls: string; description: string }
> = {
  introducao: {
    label: "Introdução",
    short: "intro",
    cls: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
    description: "Contexto e motivação — abre o assunto sem entrar na conta.",
  },
  teoria: {
    label: "Teoria",
    short: "teoria",
    cls: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30",
    description: "Explicação do conceito, fórmulas e propriedades.",
  },
  exercicios: {
    label: "Exercícios",
    short: "ex",
    cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    description: "Resolução guiada de questões, passo a passo.",
  },
  aplicacao: {
    label: "Aplicação",
    short: "apl",
    cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    description: "Onde isso aparece na prova e no mundo real.",
  },
  revisao: {
    label: "Revisão",
    short: "rev",
    cls: "bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-500/30",
    description: "Resumo rápido para recapitular antes da prova.",
  },
};

export function isIntent(v: unknown): v is PedagogicalIntentKey {
  return typeof v === "string" && v in INTENT_META;
}

export function summarizeJourney(
  intents: Array<string | null | undefined>,
): { counts: Record<PedagogicalIntentKey, number>; label: string; total: number } {
  const counts: Record<PedagogicalIntentKey, number> = {
    introducao: 0,
    teoria: 0,
    exercicios: 0,
    aplicacao: 0,
    revisao: 0,
  };
  for (const i of intents) if (isIntent(i)) counts[i] += 1;
  const parts = INTENT_ORDER.filter((k) => counts[k] > 0).map(
    (k) => `${counts[k]} ${INTENT_META[k].short}`,
  );
  return {
    counts,
    label: parts.join(" · "),
    total: intents.filter((i) => !!i).length,
  };
}
