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

/**
 * Mapeia uma questão (área + matéria + tópico) para o id do Subject
 * correspondente, usado pelo sistema de Etapas de Aprendizado.
 * Estratégia: filtra subjects pela área e tenta casar o nome do subject
 * com o tópico ou a matéria da questão. Fallback: primeiro subject da área.
 */
export function subjectIdForQuestion(
  area: Area | "redacao",
  materia: string,
  topico: string,
): string | null {
  const pool = SUBJECTS.filter((s) => s.area === area);
  if (pool.length === 0) return null;
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  const t = norm(topico);
  const m = norm(materia);
  // 1) match exato/contém pelo tópico
  let hit = pool.find((s) => {
    const n = norm(s.name);
    return n === t || t.includes(n) || n.includes(t);
  });
  if (hit) return hit.id;
  // 2) match pela matéria
  hit = pool.find((s) => {
    const n = norm(s.name);
    return n === m || m.includes(n) || n.includes(m);
  });
  if (hit) return hit.id;
  // 3) fallback: primeiro subject da área
  return pool[0].id;
}
