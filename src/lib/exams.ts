export type ExamId = "enem" | "fuvest" | "unicamp" | "uerj" | "pas-unb" | "ita" | "custom";

export interface ExamOption {
  id: ExamId;
  label: string;
  date: string;
  note: string;
}

export const DEFAULT_EXAM_ID: ExamId = "enem";

export const EXAM_OPTIONS: ExamOption[] = [
  {
    id: "enem",
    label: "ENEM 2026",
    date: "2026-11-08",
    note: "1º dia em 08/11 · 2º dia em 15/11",
  },
  {
    id: "fuvest",
    label: "Fuvest 2027",
    date: "2026-11-23",
    note: "1ª fase",
  },
  {
    id: "unicamp",
    label: "Unicamp 2027",
    date: "2026-11-08",
    note: "1ª fase",
  },
  {
    id: "uerj",
    label: "UERJ 2027",
    date: "2026-09-20",
    note: "1º exame de qualificação",
  },
  {
    id: "pas-unb",
    label: "PAS UnB 2026",
    date: "2026-11-29",
    note: "Etapa anual",
  },
  {
    id: "ita",
    label: "ITA 2027",
    date: "2026-10-26",
    note: "Início da semana de provas",
  },
  {
    id: "custom",
    label: "Outra prova",
    date: "2026-11-08",
    note: "Escolha a data manualmente",
  },
];

export function getExamOption(id?: string | null): ExamOption {
  return EXAM_OPTIONS.find((exam) => exam.id === id) ?? EXAM_OPTIONS[0];
}

export function examDateToIso(date: string): string {
  return new Date(`${date}T00:00:00`).toISOString();
}

export function defaultExamDate(): string {
  return examDateToIso(getExamOption(DEFAULT_EXAM_ID).date);
}

export function isLegacyDefaultExamDate(iso?: string | null): boolean {
  if (!iso) return false;
  const date = new Date(iso);
  return date.getFullYear() === 2026 && date.getMonth() === 10 && date.getDate() === 9;
}