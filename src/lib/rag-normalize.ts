// RAG Fase 0 — normalização para checagem de literalness/paráfrase.
//
// Ressalva #4: overlap de tokens não é único critério para "paráfrase".
// Este módulo expõe helpers usados por múltiplos sinais:
//   - normalize()      → base para overlap Jaccard
//   - trigrams()       → shingles p/ similaridade de sequência
//   - jaccard()        → 0..1
//   - trigramOverlap() → 0..1
// A decisão de "paráfrase suficiente" combina AMBOS sinais + limiar de
// n-grams contíguos (verificado pelo caller).

const STOPWORDS_PT = new Set([
  "a","o","os","as","um","uma","uns","umas","de","do","da","dos","das",
  "em","no","na","nos","nas","por","para","com","sem","que","se","é","ao",
  "aos","à","às","e","ou","mas","como","este","esta","isso","isto","essa",
  "esse","eles","elas","ele","ela","não","sim","seu","sua","seus","suas",
  "eu","você","voce","meu","minha","nós","nos","vos","lhe","lhes",
]);

export function normalize(text: string): string {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokens(text: string, dropStopwords = true): string[] {
  const arr = normalize(text).split(" ").filter(Boolean);
  return dropStopwords ? arr.filter((t) => !STOPWORDS_PT.has(t)) : arr;
}

export function jaccard(a: string, b: string): number {
  const setA = new Set(tokens(a));
  const setB = new Set(tokens(b));
  if (setA.size === 0 || setB.size === 0) return 0;
  let inter = 0;
  for (const t of setA) if (setB.has(t)) inter++;
  const union = setA.size + setB.size - inter;
  return union === 0 ? 0 : inter / union;
}

export function trigrams(text: string): Set<string> {
  const toks = tokens(text, false);
  const out = new Set<string>();
  for (let i = 0; i <= toks.length - 3; i++) {
    out.add(`${toks[i]} ${toks[i + 1]} ${toks[i + 2]}`);
  }
  return out;
}

export function trigramOverlap(a: string, b: string): number {
  const ga = trigrams(a);
  const gb = trigrams(b);
  if (ga.size === 0 || gb.size === 0) return 0;
  let inter = 0;
  for (const g of ga) if (gb.has(g)) inter++;
  const union = ga.size + gb.size - inter;
  return union === 0 ? 0 : inter / union;
}

/**
 * Combina múltiplos sinais para decidir se `answer` é "paráfrase suficiente"
 * de `source` (ressalva #4). Nenhum sinal isolado é suficiente.
 * Retorna true se AMBOS jaccard>=0.35 E trigramOverlap<=0.5
 * (reescreveu, não colou), OU jaccard>=0.5 com trigramOverlap<=0.65.
 */
export function isSufficientParaphrase(answer: string, source: string): boolean {
  const j = jaccard(answer, source);
  const t = trigramOverlap(answer, source);
  if (j >= 0.5 && t <= 0.65) return true;
  if (j >= 0.35 && t <= 0.5) return true;
  return false;
}
