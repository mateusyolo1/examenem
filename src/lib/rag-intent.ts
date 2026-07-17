// RAG Fase 0 — detecção determinística de intenção do Tutor.
//
// Ressalva #3: intenção documental é decidida ANTES do retrieval e
// independentemente do score. O resultado da busca nunca redefine a intenção.
// Sinais lexicais explícitos + toggle + `mode` do UI. Sem ML.

export type TutorIntent =
  | "documental"
  | "explicacao"
  | "pratica"
  | "planejamento"
  | "redacao"
  | "erro"
  | "conversa";

export interface DetectIntentInput {
  message: string;
  mode?: string;
  /** Toggle explícito futuro do UI ("perguntar à biblioteca"). */
  explicitDocumental?: boolean;
}

const DOCUMENTAL_PATTERNS: RegExp[] = [
  /\bsegundo o livro\b/i,
  /\bde acordo com o livro\b/i,
  /\bno livro\b/i,
  /\bnos livros\b/i,
  /\bcit(e|ar|a)\b.*\b(fonte|livro|p[aá]gina|refer[eê]ncia)\b/i,
  /\bp[aá]gina\b/i,
  /\bda biblioteca\b/i,
  /\bmateri(al|ais) (que|do) subi\b/i,
  /\bmeu pdf\b/i,
  /\bconforme o (livro|material|pdf)\b/i,
];

const MODE_TO_INTENT: Record<string, TutorIntent> = {
  explicar: "explicacao",
  resolver: "pratica",
  questoes: "pratica",
  plano: "planejamento",
  redacao: "redacao",
  revisao: "explicacao",
  erro: "erro",
  livre: "conversa",
};

export function detectTutorIntent(input: DetectIntentInput): TutorIntent {
  const msg = (input.message ?? "").trim();

  // 1) toggle explícito → documental
  if (input.explicitDocumental) return "documental";

  // 2) sinais lexicais fortes → documental
  for (const re of DOCUMENTAL_PATTERNS) {
    if (re.test(msg)) return "documental";
  }

  // 3) mode do UI mapeia direto
  if (input.mode && MODE_TO_INTENT[input.mode]) {
    return MODE_TO_INTENT[input.mode];
  }

  // 4) fallback heurístico leve
  if (msg.length === 0) return "conversa";
  if (/^(oi|ol[aá]|bom dia|boa tarde|boa noite|obrigad[oa]|valeu)\b/i.test(msg)) {
    return "conversa";
  }
  return "explicacao";
}
