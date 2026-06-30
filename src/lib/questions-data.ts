import type { Area } from "./storage";

export interface Question {
  id: string;
  area: Area;
  year: number;
  subject: string;
  statement: string;
  alternatives: { key: "A" | "B" | "C" | "D" | "E"; text: string }[];
  correct: "A" | "B" | "C" | "D" | "E";
  explanation: string;
}

// Curated set of real-style ENEM questions for demo/local use.
// In a future iteration we can mix in live questions from enem.dev and AI-generated drills.
export const QUESTIONS: Question[] = [
  {
    id: "nat-2023-142",
    area: "natureza",
    year: 2023,
    subject: "Física — Trabalho e Potência",
    statement:
      "Um guindaste utilizado em uma construção civil eleva cargas pesadas verticalmente. O motor realiza um trabalho de 1,2 × 10⁶ J para elevar uma carga de 2,0 × 10³ kg a uma altura de 50 m em 20 s. Considere g = 10 m/s². Sobre essa situação, é correto afirmar que:",
    alternatives: [
      { key: "A", text: "A potência média útil do motor é de 60 kW." },
      { key: "B", text: "O rendimento do sistema é de aproximadamente 83%." },
      { key: "C", text: "A energia potencial gravitacional da carga aumentou 1,0 × 10⁶ J." },
      { key: "D", text: "A velocidade média de subida da carga é de 5 m/s." },
      { key: "E", text: "A força aplicada pelo motor é de 4,0 × 10³ N." },
    ],
    correct: "B",
    explanation:
      "Energia útil = m·g·h = 2000·10·50 = 1,0×10⁶ J. Rendimento = útil/total = 1,0/1,2 ≈ 0,833 → 83%.",
  },
  {
    id: "mat-2022-158",
    area: "matematica",
    year: 2022,
    subject: "Matemática — Porcentagem",
    statement:
      "Em uma loja, um produto custa R$ 240,00 à vista. No cartão, o preço sofre um acréscimo de 12,5%. Qual o valor pago no cartão?",
    alternatives: [
      { key: "A", text: "R$ 252,00" },
      { key: "B", text: "R$ 260,00" },
      { key: "C", text: "R$ 270,00" },
      { key: "D", text: "R$ 275,00" },
      { key: "E", text: "R$ 280,00" },
    ],
    correct: "C",
    explanation: "240 × 1,125 = 270.",
  },
  {
    id: "lin-2021-112",
    area: "linguagens",
    year: 2021,
    subject: "Português — Interpretação",
    statement:
      "“O sertão vai virar mar, e o mar vai virar sertão.” A frase, atribuída a Antônio Conselheiro, é amplamente associada ao romance Os Sertões, de Euclides da Cunha. O efeito de sentido produzido pela construção paralelística é de:",
    alternatives: [
      { key: "A", text: "ironia em relação às mudanças geográficas do Nordeste." },
      { key: "B", text: "anúncio profético baseado na inversão da ordem natural." },
      { key: "C", text: "descrição neutra do ciclo das águas no semiárido." },
      { key: "D", text: "crítica científica ao determinismo geográfico." },
      { key: "E", text: "elogio à miscigenação cultural do povo sertanejo." },
    ],
    correct: "B",
    explanation:
      "A construção em quiasmo reforça o tom profético/messiânico da fala, apoiada na inversão dos elementos naturais.",
  },
  {
    id: "hum-2023-067",
    area: "humanas",
    year: 2023,
    subject: "História — República Velha",
    statement:
      "A política do café com leite, vigente durante a Primeira República, caracterizou-se principalmente por:",
    alternatives: [
      { key: "A", text: "alternância no poder federal entre as oligarquias de São Paulo e Minas Gerais." },
      { key: "B", text: "centralização administrativa imposta pelo poder militar." },
      { key: "C", text: "ampliação dos direitos políticos das mulheres e dos trabalhadores urbanos." },
      { key: "D", text: "criação de um sistema parlamentarista de governo." },
      { key: "E", text: "independência econômica das regiões Norte e Nordeste." },
    ],
    correct: "A",
    explanation:
      "São Paulo (café) e Minas Gerais (leite) revezavam a indicação do presidente, sustentando a hegemonia oligárquica.",
  },
  {
    id: "nat-2022-130",
    area: "natureza",
    year: 2022,
    subject: "Química — Estequiometria",
    statement:
      "Na combustão completa do metano (CH₄ + 2 O₂ → CO₂ + 2 H₂O), quantos mols de O₂ são necessários para queimar completamente 4 mols de metano?",
    alternatives: [
      { key: "A", text: "2 mols" },
      { key: "B", text: "4 mols" },
      { key: "C", text: "6 mols" },
      { key: "D", text: "8 mols" },
      { key: "E", text: "16 mols" },
    ],
    correct: "D",
    explanation: "Proporção 1:2. Para 4 mols de CH₄, são 8 mols de O₂.",
  },
  {
    id: "mat-2023-176",
    area: "matematica",
    year: 2023,
    subject: "Matemática — Função do 1º grau",
    statement:
      "Uma empresa cobra R$ 50,00 de taxa fixa mais R$ 2,00 por quilômetro rodado. Qual o valor cobrado por uma corrida de 35 km?",
    alternatives: [
      { key: "A", text: "R$ 85,00" },
      { key: "B", text: "R$ 105,00" },
      { key: "C", text: "R$ 115,00" },
      { key: "D", text: "R$ 120,00" },
      { key: "E", text: "R$ 130,00" },
    ],
    correct: "D",
    explanation: "C(x) = 50 + 2·35 = 120.",
  },
  {
    id: "lin-2023-008",
    area: "linguagens",
    year: 2023,
    subject: "Literatura — Modernismo",
    statement:
      "A Semana de Arte Moderna de 1922, realizada em São Paulo, marcou no Brasil:",
    alternatives: [
      { key: "A", text: "o auge do Realismo brasileiro." },
      { key: "B", text: "a ruptura com padrões acadêmicos e a valorização da cultura nacional." },
      { key: "C", text: "a chegada oficial do Romantismo europeu." },
      { key: "D", text: "o início do movimento Parnasiano." },
      { key: "E", text: "uma exposição exclusivamente de pintura abstrata." },
    ],
    correct: "B",
    explanation:
      "A Semana inaugurou o Modernismo no Brasil, rompendo com o academicismo e valorizando temas nacionais.",
  },
  {
    id: "hum-2022-045",
    area: "humanas",
    year: 2022,
    subject: "Geografia — Globalização",
    statement:
      "A formação de blocos econômicos, como o Mercosul e a União Europeia, é uma característica marcante da globalização porque:",
    alternatives: [
      { key: "A", text: "impede totalmente o comércio entre países de blocos distintos." },
      { key: "B", text: "elimina as fronteiras políticas entre os países-membros." },
      { key: "C", text: "facilita a circulação de mercadorias, capitais e pessoas entre os países-membros." },
      { key: "D", text: "obriga todos os membros a adotarem a mesma moeda." },
      { key: "E", text: "garante igualdade total de renda entre as nações participantes." },
    ],
    correct: "C",
    explanation:
      "Blocos econômicos visam reduzir barreiras comerciais e facilitar fluxos entre os países-membros.",
  },
  {
    id: "nat-2021-099",
    area: "natureza",
    year: 2021,
    subject: "Biologia — Ecologia",
    statement:
      "Em uma cadeia alimentar formada por capim → gafanhoto → sapo → cobra, o gafanhoto ocupa qual nível trófico?",
    alternatives: [
      { key: "A", text: "Produtor" },
      { key: "B", text: "Consumidor primário" },
      { key: "C", text: "Consumidor secundário" },
      { key: "D", text: "Consumidor terciário" },
      { key: "E", text: "Decompositor" },
    ],
    correct: "B",
    explanation: "O gafanhoto se alimenta do capim (produtor), sendo consumidor primário (herbívoro).",
  },
  {
    id: "mat-2021-150",
    area: "matematica",
    year: 2021,
    subject: "Matemática — Geometria",
    statement:
      "Um terreno retangular tem 20 m de largura e 35 m de comprimento. Qual é a sua área em metros quadrados?",
    alternatives: [
      { key: "A", text: "55 m²" },
      { key: "B", text: "110 m²" },
      { key: "C", text: "550 m²" },
      { key: "D", text: "700 m²" },
      { key: "E", text: "7000 m²" },
    ],
    correct: "D",
    explanation: "Área = 20 × 35 = 700 m².",
  },
  {
    id: "lin-2022-021",
    area: "linguagens",
    year: 2022,
    subject: "Inglês — Reading",
    statement:
      "Read: \"Climate change is no longer a distant threat; it is happening now.\" The author's main intention is to:",
    alternatives: [
      { key: "A", text: "deny the existence of climate change." },
      { key: "B", text: "stress the urgency of climate change." },
      { key: "C", text: "describe the history of the climate." },
      { key: "D", text: "list scientific data about temperature." },
      { key: "E", text: "compare climates of different countries." },
    ],
    correct: "B",
    explanation: "The phrase “happening now” emphasizes urgency.",
  },
  {
    id: "hum-2021-080",
    area: "humanas",
    year: 2021,
    subject: "Filosofia — Iluminismo",
    statement:
      "O Iluminismo, movimento intelectual do século XVIII, defendia principalmente:",
    alternatives: [
      { key: "A", text: "o absolutismo monárquico e o direito divino dos reis." },
      { key: "B", text: "a razão, a liberdade individual e a crítica aos privilégios." },
      { key: "C", text: "o retorno aos valores feudais." },
      { key: "D", text: "a teocracia como modelo ideal de governo." },
      { key: "E", text: "a manutenção da escravidão como base social." },
    ],
    correct: "B",
    explanation:
      "Os iluministas defendiam a razão como guia, a liberdade individual e a crítica aos privilégios do Antigo Regime.",
  },
];

export const QUESTION_AREA_MAP: Record<string, Area> = Object.fromEntries(
  QUESTIONS.map((q) => [q.id, q.area]),
);

export function questionsByArea(area: Area | "todas", year?: number) {
  return QUESTIONS.filter((q) => (area === "todas" || q.area === area) && (!year || q.year === year));
}

export const YEARS = Array.from(new Set(QUESTIONS.map((q) => q.year))).sort((a, b) => b - a);

export type Difficulty = "Fácil" | "Médio" | "Difícil";

const HARD_HINTS = ["Estequiometria", "Trabalho", "Iluminismo", "Modernismo", "Função"];
const EASY_HINTS = ["Porcentagem", "Geometria", "Reading", "Globalização", "Ecologia"];

export function questionDifficulty(q: Question): Difficulty {
  const s = q.subject;
  if (HARD_HINTS.some((h) => s.includes(h))) return "Difícil";
  if (EASY_HINTS.some((h) => s.includes(h))) return "Fácil";
  return "Médio";
}

export function questionMateria(q: Question): string {
  // "Física — Trabalho e Potência" → "Física"
  const parts = q.subject.split(/\s[—–-]\s/);
  return parts[0]?.trim() || q.subject;
}

export function questionTopic(q: Question): string {
  const parts = q.subject.split(/\s[—–-]\s/);
  return (parts[1] || parts[0] || "").trim();
}

export const MATERIAS = Array.from(new Set(QUESTIONS.map(questionMateria))).sort();

