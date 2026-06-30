import type { Area } from "./storage";

export type Difficulty = "Fácil" | "Médio" | "Difícil";

export interface Subject {
  id: string;
  name: string;
  area: Area | "redacao";
  difficulty: Difficulty;
  totalQuestions: number;
}

export const SUBJECT_AREAS: { id: Area | "redacao"; label: string; short: string }[] = [
  { id: "linguagens", label: "Linguagens & Códigos", short: "Linguagens" },
  { id: "humanas", label: "Ciências Humanas", short: "Humanas" },
  { id: "natureza", label: "Ciências da Natureza", short: "Natureza" },
  { id: "matematica", label: "Matemática", short: "Matemática" },
  { id: "redacao", label: "Redação", short: "Redação" },
];

export const SUBJECTS: Subject[] = [
  // Linguagens
  { id: "ling-interp", name: "Interpretação de texto", area: "linguagens", difficulty: "Médio", totalQuestions: 40 },
  { id: "ling-gram", name: "Gramática", area: "linguagens", difficulty: "Médio", totalQuestions: 30 },
  { id: "ling-lit", name: "Literatura", area: "linguagens", difficulty: "Difícil", totalQuestions: 25 },
  { id: "ling-artes", name: "Artes", area: "linguagens", difficulty: "Fácil", totalQuestions: 15 },
  { id: "ling-edfis", name: "Educação física", area: "linguagens", difficulty: "Fácil", totalQuestions: 12 },
  { id: "ling-ingles", name: "Inglês / Espanhol", area: "linguagens", difficulty: "Médio", totalQuestions: 20 },

  // Humanas
  { id: "hum-hist", name: "História", area: "humanas", difficulty: "Médio", totalQuestions: 35 },
  { id: "hum-geo", name: "Geografia", area: "humanas", difficulty: "Médio", totalQuestions: 30 },
  { id: "hum-filo", name: "Filosofia", area: "humanas", difficulty: "Difícil", totalQuestions: 20 },
  { id: "hum-socio", name: "Sociologia", area: "humanas", difficulty: "Médio", totalQuestions: 20 },
  { id: "hum-atual", name: "Atualidades", area: "humanas", difficulty: "Fácil", totalQuestions: 18 },

  // Natureza
  { id: "nat-bio", name: "Biologia", area: "natureza", difficulty: "Médio", totalQuestions: 35 },
  { id: "nat-quim", name: "Química", area: "natureza", difficulty: "Difícil", totalQuestions: 30 },
  { id: "nat-fis", name: "Física", area: "natureza", difficulty: "Difícil", totalQuestions: 30 },

  // Matemática
  { id: "mat-arit", name: "Aritmética", area: "matematica", difficulty: "Fácil", totalQuestions: 20 },
  { id: "mat-alg", name: "Álgebra", area: "matematica", difficulty: "Médio", totalQuestions: 25 },
  { id: "mat-geo", name: "Geometria", area: "matematica", difficulty: "Difícil", totalQuestions: 25 },
  { id: "mat-est", name: "Estatística", area: "matematica", difficulty: "Médio", totalQuestions: 18 },
  { id: "mat-prob", name: "Probabilidade", area: "matematica", difficulty: "Difícil", totalQuestions: 15 },
  { id: "mat-func", name: "Funções", area: "matematica", difficulty: "Médio", totalQuestions: 22 },
  { id: "mat-perc", name: "Porcentagem", area: "matematica", difficulty: "Fácil", totalQuestions: 18 },
  { id: "mat-razao", name: "Razão e proporção", area: "matematica", difficulty: "Fácil", totalQuestions: 18 },

  // Redação
  { id: "red-rep", name: "Repertório sociocultural", area: "redacao", difficulty: "Médio", totalQuestions: 10 },
  { id: "red-estr", name: "Estrutura dissertativo-argumentativa", area: "redacao", difficulty: "Médio", totalQuestions: 10 },
  { id: "red-intro", name: "Introdução", area: "redacao", difficulty: "Fácil", totalQuestions: 8 },
  { id: "red-desenv", name: "Desenvolvimento", area: "redacao", difficulty: "Médio", totalQuestions: 8 },
  { id: "red-conc", name: "Conclusão", area: "redacao", difficulty: "Fácil", totalQuestions: 6 },
  { id: "red-prop", name: "Proposta de intervenção", area: "redacao", difficulty: "Difícil", totalQuestions: 10 },
  { id: "red-comp", name: "Competências do ENEM", area: "redacao", difficulty: "Difícil", totalQuestions: 10 },
];

export function subjectsByArea(area: Subject["area"]) {
  return SUBJECTS.filter((s) => s.area === area);
}
