// ============================================================
// YouTube video filter — multi-layer relevance pipeline
// ============================================================
// Server-only helper used by suggestVideosForTopic in study.functions.ts.
// Do NOT import from client components — depends on process.env and Gemini.
// ============================================================

export type PedagogicalIntent =
  | "introducao"
  | "teoria"
  | "exercicios"
  | "aplicacao"
  | "revisao";

export interface FilterCandidate {
  youtube_id: string;
  title: string;
  channel_name: string;
  duration_seconds: number | null;
  view_count?: number | null;
  // enrichment
  transcript_sample?: string;
  lexicon_score?: number;
  channel_reputation?: number;
  // verification
  relevant?: boolean;
  confidence?: number;
  subject_detected?: string;
  pedagogical_intent?: PedagogicalIntent;
  reason?: string;
}

// ------------------------------------------------------------
// Layer 2 — Bidirectional lexicon (seed)
// ------------------------------------------------------------
// Cada área do ENEM tem termos característicos. O score é
// hits(area_do_topico) - 0.7 * hits(outras_areas). Termos podem crescer com
// o tempo via tabela subject_lexicon (fase 2).
// ------------------------------------------------------------

type Area = "linguagens" | "humanas" | "natureza" | "matematica";

const LEXICON: Record<Area, string[]> = {
  linguagens: [
    "português", "portuguesa", "gramática", "gramatica", "sintaxe", "morfossintaxe",
    "morfologia", "sujeito", "predicado", "oração", "figura de linguagem",
    "metáfora", "metonimia", "coesão", "coerência", "interpretação de texto",
    "literatura", "modernismo", "romantismo", "realismo", "barroco", "parnasianismo",
    "arcadismo", "trovadorismo", "machado de assis", "clarice lispector", "drummond",
    "redação", "dissertação", "argumentação", "conto", "poesia", "verso", "estrofe",
    "inglês", "english", "espanhol", "spanish", "arte", "artes visuais",
    "educação física", "linguagens e códigos", "gênero textual", "denotação",
    "conotação", "polissemia", "linguagem verbal", "audiobook", "livro",
    "concordância", "regência", "crase", "pontuação", "ortografia",
    "narrador", "personagem", "narrativa", "ensaio", "crônica",
  ],
  humanas: [
    "história", "historia", "geografia", "filosofia", "sociologia",
    "sociedade", "revolução", "revolucao", "guerra", "impérios", "imperios",
    "brasil colônia", "brasil colonia", "brasil império", "brasil imperio",
    "brasil república", "brasil republica", "ditadura", "getúlio", "getulio",
    "vargas", "escravidão", "escravidao", "abolição", "abolicao",
    "iluminismo", "renascimento", "idade média", "idade media", "feudalismo",
    "capitalismo", "socialismo", "marxismo", "weber", "durkheim", "comte",
    "platão", "platao", "aristóteles", "aristoteles", "kant", "nietzsche",
    "geopolítica", "geopolitica", "globalização", "globalizacao",
    "urbanização", "urbanizacao", "clima", "relevo", "hidrografia",
    "movimentos sociais", "cidadania", "democracia", "estado",
    "cultura", "identidade", "etnia", "religião", "religiao",
    "ciências humanas", "ciencias humanas",
  ],
  natureza: [
    "biologia", "célula", "celula", "citologia", "genética", "genetica",
    "dna", "rna", "cromossomo", "mitose", "meiose", "ecologia", "ecossistema",
    "cadeia alimentar", "fotossíntese", "fotossintese", "evolução", "evolucao",
    "darwin", "sistema nervoso", "sistema imunológico", "hormônio", "hormonio",
    "anatomia", "fisiologia",
    "química", "quimica", "átomo", "atomo", "molécula", "molecula", "ligação",
    "ligacao", "orgânica", "organica", "inorgânica", "inorganica", "estequiometria",
    "mol", "reação", "reacao", "ácido", "acido", "base", "ph", "óxido", "oxido",
    "eletroquímica", "eletroquimica",
    "física", "fisica", "cinemática", "cinematica", "dinâmica", "dinamica",
    "força", "forca", "energia", "trabalho", "potência", "potencia", "termodinâmica",
    "termodinamica", "eletricidade", "magnetismo", "ondas", "óptica", "optica",
    "gravitação", "gravitacao", "einstein", "newton",
    "ciências da natureza", "ciencias da natureza",
  ],
  matematica: [
    "matemática", "matematica", "álgebra", "algebra", "aritmética", "aritmetica",
    "função", "funcao", "equação", "equacao", "inequação", "inequacao",
    "logaritmo", "exponencial", "polinômio", "polinomio", "matriz", "determinante",
    "sistema linear", "sequência", "sequencia", "progressão", "progressao",
    "pa ", "pg ", "geometria", "trigonometria", "seno", "cosseno", "tangente",
    "triângulo", "triangulo", "círculo", "circulo", "polígono", "poligono",
    "área", "perímetro", "volume", "prisma", "pirâmide", "piramide", "cone",
    "cilindro", "esfera", "análise combinatória", "combinatoria", "probabilidade",
    "estatística", "estatistica", "média", "mediana", "moda", "desvio padrão",
    "conjunto", "número complexo", "numero complexo", "derivada", "integral",
    "limite", "vetor",
  ],
};

// Termos de "clara outra área" que penalizam sem ambiguidade.
const HARD_NEGATIVES: Record<Area, string[]> = {
  linguagens: ["função quadrática", "logaritmo", "célula", "átomo", "trigonometria"],
  humanas: ["fotossíntese", "logaritmo", "trigonometria", "figura de linguagem"],
  natureza: ["logaritmo puro", "figura de linguagem", "modernismo", "revolução francesa"],
  matematica: ["fotossíntese", "figura de linguagem", "modernismo", "revolução francesa"],
};

function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function countHits(hay: string, terms: string[]): number {
  let n = 0;
  const norm = normalizeText(hay);
  for (const term of terms) {
    const t = normalizeText(term);
    if (t.length < 3) continue;
    // Boundary-ish: whole word or phrase
    const re = new RegExp(`(^|[^a-z0-9])${escapeRegex(t)}([^a-z0-9]|$)`, "g");
    const matches = norm.match(re);
    if (matches) n += matches.length;
  }
  return n;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Score léxico bidirecional. Devolve entre ~-5 e ~+10.
 * Positivo = provavelmente da área do tópico.
 * Muito negativo = quase certeza que é de outra área.
 */
export function scoreLexicon(
  candidate: FilterCandidate,
  area: Area,
): number {
  const hay = `${candidate.title} ${candidate.channel_name} ${candidate.transcript_sample ?? ""}`;
  const own = countHits(hay, LEXICON[area]);
  let other = 0;
  for (const key of Object.keys(LEXICON) as Area[]) {
    if (key === area) continue;
    other += countHits(hay, LEXICON[key]);
  }
  const hardNeg = countHits(hay, HARD_NEGATIVES[area]);
  return own - 0.7 * other - 2 * hardNeg;
}

// ------------------------------------------------------------
// Layer 3 — Transcript sampling
// ------------------------------------------------------------

/**
 * Puxa até 3 janelas (início, meio, fim) da transcrição — ~500 chars cada.
 * Se a transcrição falhar, devolve string vazia (não bloqueia o pipeline).
 * Cache por youtube_id em ai_response_cache (feito pelo caller).
 */
export async function fetchTranscriptSample(
  youtubeId: string,
): Promise<string> {
  try {
    const { fetchTranscriptWithFallback } = await import("./youtube-transcripts.server");
    const t = await Promise.race([
      fetchTranscriptWithFallback(youtubeId),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 3000)),
    ]);
    const full = t.text;
    if (full.length <= 1600) return full;
    const chunk = 500;
    const start = full.slice(0, chunk);
    const midIdx = Math.max(0, Math.floor(full.length / 2) - chunk / 2);
    const middle = full.slice(midIdx, midIdx + chunk);
    const end = full.slice(-chunk);
    return `${start}\n[...]\n${middle}\n[...]\n${end}`;
  } catch {
    return "";
  }
}

// ------------------------------------------------------------
// Layer 4 — AI batch verification
// ------------------------------------------------------------

export interface VerifyContext {
  topicTitle: string;
  area: Area;
  subject: string | null;
}

interface VerifyResultItem {
  id: string;
  relevant: boolean;
  confidence: number;
  subject_detected: string;
  pedagogical_intent: PedagogicalIntent;
  reason: string;
}

const INTENT_GUIDE = `
Categorias de pedagogical_intent (escolha UMA por vídeo):
- "introducao": vídeo curto que apresenta o tópico, dicas rápidas ou visão geral.
- "teoria": explicação teórica aprofundada, conceitos, demonstrações.
- "exercicios": foco em resolver questões, provas, exercícios comentados.
- "aplicacao": mostra o conteúdo em uso real, exemplo prático, curiosidade histórica.
- "revisao": resumo/revisão rápida, mapa mental, "tudo sobre X em N min".
`.trim();

/**
 * Uma chamada Gemini flash em batch. Cache do chamador (por topic_id +
 * hash dos ids). Retorna Map por youtube_id. Se falhar, retorna Map vazio
 * (pipeline degrada elegantemente para o léxico).
 */
export async function verifyRelevanceBatch(
  candidates: FilterCandidate[],
  ctx: VerifyContext,
): Promise<Map<string, VerifyResultItem>> {
  const out = new Map<string, VerifyResultItem>();
  if (candidates.length === 0) return out;
  try {
    const { generateObject } = await import("ai");
    const { createGateway, CHAT_MODEL } = await import("./ai-gateway.server");
    const { z } = await import("zod");

    const schema = z.object({
      items: z.array(
        z.object({
          id: z.string(),
          relevant: z.boolean(),
          confidence: z.number(),
          subject_detected: z.string(),
          pedagogical_intent: z.enum([
            "introducao", "teoria", "exercicios", "aplicacao", "revisao",
          ]),
          reason: z.string(),
        }),
      ),
    });

    const list = candidates
      .map((c, i) => {
        const dur = c.duration_seconds ? `${Math.round(c.duration_seconds / 60)}min` : "?";
        const sample = (c.transcript_sample ?? "").slice(0, 1400);
        return (
          `[${i + 1}] id=${c.youtube_id} | ${dur} | canal="${c.channel_name}"\n` +
          `título: ${c.title}\n` +
          (sample ? `transcrição (amostra):\n${sample}\n` : "transcrição: (indisponível)\n")
        );
      })
      .join("\n---\n");

    const prompt =
      `Você é curador(a) de conteúdo educacional para o ENEM (Brasil).\n\n` +
      `Tópico a estudar: "${ctx.topicTitle}"\n` +
      `Área do ENEM: ${ctx.area}\n` +
      `Matéria: ${ctx.subject ?? "-"}\n\n` +
      `Para CADA vídeo abaixo, decida se ele **ENSINA ou EXEMPLIFICA** ` +
      `esse tópico específico. Vídeo que só *menciona* o tema em passagem NÃO é relevante. ` +
      `Confie mais na transcrição do que no título (títulos são clickbait).\n\n` +
      `IMPORTANTE:\n` +
      `- Se um vídeo é claramente de OUTRA matéria (ex.: aula de matemática num tópico de linguagens), ` +
      `marque relevant=false e coloque a matéria real em subject_detected.\n` +
      `- Exemplo: um vídeo do canal "Prof Curió" com transcrição sobre função quadrática, ` +
      `num tópico de Literatura → relevant=false, subject_detected="matemática".\n` +
      `- Um vídeo de literatura genuíno num tópico de Modernismo → relevant=true.\n\n` +
      `${INTENT_GUIDE}\n\n` +
      `Vídeos:\n${list}\n\n` +
      `Devolva JSON { items: [{ id, relevant, confidence (0..1), subject_detected, pedagogical_intent, reason }] }. ` +
      `Cubra TODOS os vídeos.`;

    const gateway = createGateway();
    const { object } = await generateObject({
      model: gateway(CHAT_MODEL),
      schema,
      prompt,
    });
    for (const item of object.items) out.set(item.id, item);
  } catch {
    // silencia: sem verificação IA, o léxico ainda filtra
  }
  return out;
}

// ------------------------------------------------------------
// Layer 5 — Channel reputation (temporal decay)
// ------------------------------------------------------------

interface SignalRow {
  channel_name: string;
  subject: string;
  hits: number;
  misses: number;
  last_hit_at: string | null;
  last_miss_at: string | null;
}

function decayFactor(iso: string | null): number {
  if (!iso) return 0;
  const days = (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24);
  return Math.pow(0.5, Math.max(0, days) / 60); // meia-vida = 60 dias
}

/**
 * Reputação = hits*decay − misses*decay. Faixa útil: -5..+5.
 */
export function reputationFor(
  row: SignalRow | undefined,
): number {
  if (!row) return 0;
  const h = row.hits * decayFactor(row.last_hit_at);
  const m = row.misses * decayFactor(row.last_miss_at);
  return h - m;
}

/**
 * Busca reputação de todos os canais candidatos para uma matéria.
 */
export async function loadChannelReputation(
  supabase: { from: (t: string) => any },
  channels: string[],
  subject: string,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (channels.length === 0) return out;
  try {
    const { data } = await supabase
      .from("channel_subject_signal")
      .select("channel_name, subject, hits, misses, last_hit_at, last_miss_at")
      .in("channel_name", channels)
      .eq("subject", subject);
    for (const row of (data ?? []) as SignalRow[]) {
      out.set(row.channel_name.toLowerCase().trim(), reputationFor(row));
    }
  } catch {
    // ignora
  }
  return out;
}

/**
 * Registra hit/miss para (canal, matéria) via service role.
 */
export async function recordChannelSignal(
  supabaseAdmin: { from: (t: string) => any },
  channelName: string,
  subject: string,
  kind: "hit" | "miss",
): Promise<void> {
  const nowIso = new Date().toISOString();
  try {
    const { data: existing } = await supabaseAdmin
      .from("channel_subject_signal")
      .select("id, hits, misses")
      .eq("channel_name", channelName)
      .eq("subject", subject)
      .maybeSingle();
    if (existing) {
      await supabaseAdmin
        .from("channel_subject_signal")
        .update({
          hits: kind === "hit" ? existing.hits + 1 : existing.hits,
          misses: kind === "miss" ? existing.misses + 1 : existing.misses,
          last_hit_at: kind === "hit" ? nowIso : undefined,
          last_miss_at: kind === "miss" ? nowIso : undefined,
        })
        .eq("id", existing.id);
    } else {
      await supabaseAdmin.from("channel_subject_signal").insert({
        channel_name: channelName,
        subject,
        hits: kind === "hit" ? 1 : 0,
        misses: kind === "miss" ? 1 : 0,
        last_hit_at: kind === "hit" ? nowIso : null,
        last_miss_at: kind === "miss" ? nowIso : null,
      });
    }
  } catch {
    // silencia
  }
}

// ------------------------------------------------------------
// Layer 6 — Pedagogical journey selection
// ------------------------------------------------------------

const JOURNEY_QUOTA: Array<{ intent: PedagogicalIntent; target: number }> = [
  { intent: "introducao", target: 1 },
  { intent: "teoria", target: 2 },
  { intent: "exercicios", target: 2 },
  { intent: "aplicacao", target: 1 },
  // "revisao" entra no fallback como wildcard
];

/**
 * Seleciona até `total` vídeos cobrindo intenções pedagógicas distintas.
 * Score final = confidence * 2 + lexicon_score * 0.3 + reputation * 0.5.
 * Não repete canal quando possível.
 */
export function pickPedagogicalJourney(
  candidates: FilterCandidate[],
  total: number,
  maxSeconds: number,
): FilterCandidate[] {
  const scoreOf = (c: FilterCandidate) => {
    const conf = c.confidence ?? 0.4;
    const lex = c.lexicon_score ?? 0;
    const rep = c.channel_reputation ?? 0;
    const views = Math.log10((c.view_count ?? 0) + 10) * 0.15;
    return conf * 2 + lex * 0.3 + rep * 0.5 + views;
  };
  const sorted = [...candidates].sort((a, b) => scoreOf(b) - scoreOf(a));

  const picked: FilterCandidate[] = [];
  const seenChannels = new Set<string>();
  const seenIds = new Set<string>();
  let running = 0;

  const norm = (s: string) => s.toLowerCase().trim();
  const tryAdd = (c: FilterCandidate, allowDupChannel: boolean): boolean => {
    if (seenIds.has(c.youtube_id)) return false;
    const d = c.duration_seconds ?? 0;
    if (d > maxSeconds || running + d > maxSeconds) return false;
    const ch = norm(c.channel_name);
    if (!allowDupChannel && ch && seenChannels.has(ch)) return false;
    picked.push(c);
    seenIds.add(c.youtube_id);
    if (ch) seenChannels.add(ch);
    running += d;
    return true;
  };

  // Passada 1: preenche a cota de cada intenção
  for (const { intent, target } of JOURNEY_QUOTA) {
    if (picked.length >= total) break;
    let filled = 0;
    for (const c of sorted) {
      if (filled >= target) break;
      if (c.pedagogical_intent !== intent) continue;
      if (tryAdd(c, false)) filled++;
    }
  }

  // Passada 2: completa com melhores restantes (qualquer intenção),
  // ainda sem repetir canal.
  for (const c of sorted) {
    if (picked.length >= total) break;
    tryAdd(c, false);
  }

  // Passada 3 (fallback): permite repetir canal se ainda falta muito.
  if (picked.length < Math.min(3, total)) {
    for (const c of sorted) {
      if (picked.length >= total) break;
      tryAdd(c, true);
    }
  }
  return picked;
}
