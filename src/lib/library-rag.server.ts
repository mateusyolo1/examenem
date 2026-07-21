// Helper server-only: recupera contexto da biblioteca do aluno para injetar
// em prompts (Lousa, Tutor, Redação, HintCoach).
//
// BLOCO 1 (neutralização):
//   - Threshold provisório NÃO é aplicado. Enquanto RAG_IS_CALIBRATED=false o
//     comportamento é o LEGADO da RPC v1: top-K puro, sem filtro cliente.
//   - Nenhum status `no_relevant_matches` é produzido.
//   - Log interno marca `[uncalibrated]` para rastreio.
//   - API pública renomeada: `retrieveLibraryContextDetailed` (contrato, não versão).
//   - `retrieveLibraryContext` legado é mantido como wrapper com JSDoc @deprecated.
//     Call sites legados: src/lib/lousa.functions.ts (não migrar nesta rodada).

import type { SupabaseClient } from "@supabase/supabase-js";
import { clampMatchCount, getRagMinSimilarity, RAG_EMBEDDING_DIMS, RAG_IS_CALIBRATED } from "./rag-config";

const EMBED_MODEL = "google/gemini-embedding-2";
const EMBED_URL = "https://ai.gateway.lovable.dev/v1/embeddings";

export interface LibraryMatch {
  book_id: string;
  chunk_index: number;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

export interface LibraryFigure {
  bookId: string;
  bookTitle: string;
  page: number;
  url: string;
  storagePath: string;
  width?: number | null;
  height?: number | null;
  caption?: string | null;
}

export type LibraryRetrievalStatus =
  | "ok"
  | "no_active_books"
  | "embedding_auth_error"
  | "embedding_upstream_error"
  | "no_embedding"
  | "rpc_error"
  | "unknown_error";

export interface LibraryRetrievalTimings {
  embedMs: number;
  rpcMs: number;
  totalMs: number;
}

export interface LibraryRetrievalResult {
  status: LibraryRetrievalStatus;
  matches: LibraryMatch[];
  /** Pares (bookId, page) dos matches cujas páginas têm figura gravada em
   *  library_figures. Não contém URLs — usar `retrieveLibraryFigures` para
   *  assinar. Sempre presente (pode ser array vazio). */
  hasFigurePages: Array<{ bookId: string; page: number }>;
  /** true enquanto RAG_IS_CALIBRATED=false; consumidores não devem filtrar por score. */
  uncalibrated: boolean;
  timings: LibraryRetrievalTimings;
  traceId: string;
  /** Mensagem curta para logs internos (nunca exibir cru ao usuário). */
  detail?: string;
}


function newTraceId(): string {
  const rnd = Math.random().toString(36).slice(2, 8);
  return `rag_${Date.now().toString(36)}_${rnd}`;
}

interface EmbedOk { ok: true; embedding: number[]; ms: number }
interface EmbedErr { ok: false; status: LibraryRetrievalStatus; ms: number; detail: string }

async function embedQuery(query: string): Promise<EmbedOk | EmbedErr> {
  const start = Date.now();
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      status: "embedding_auth_error",
      ms: Date.now() - start,
      detail: "LOVABLE_API_KEY ausente no ambiente do servidor",
    };
  }
  try {
    const res = await fetch(EMBED_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({ model: EMBED_MODEL, input: query }),
    });
    const ms = Date.now() - start;
    if (res.status === 401 || res.status === 403) {
      return { ok: false, status: "embedding_auth_error", ms, detail: `HTTP ${res.status}` };
    }
    if (!res.ok) {
      return {
        ok: false,
        status: "embedding_upstream_error",
        ms,
        detail: `HTTP ${res.status}`,
      };
    }
    const json = (await res.json()) as { data?: { embedding?: number[] }[] };
    const embedding = json.data?.[0]?.embedding ?? [];
    if (embedding.length === 0) {
      return { ok: false, status: "no_embedding", ms, detail: "resposta vazia" };
    }
    if (embedding.length !== RAG_EMBEDDING_DIMS) {
      return {
        ok: false,
        status: "no_embedding",
        ms,
        detail: `dim inesperada ${embedding.length}`,
      };
    }
    return { ok: true, embedding, ms };
  } catch (e) {
    return {
      ok: false,
      status: "embedding_upstream_error",
      ms: Date.now() - start,
      detail: e instanceof Error ? e.message : "erro desconhecido",
    };
  }
}

/**
 * Contrato Fase 0 — retorna objeto estruturado; nunca lança.
 * Comportamento neutralizado: preserva top-K puro da RPC v1 enquanto
 * RAG_IS_CALIBRATED=false. Não aplica threshold nem envia threshold à RPC.
 */
export async function retrieveLibraryContextDetailed(
  supabase: SupabaseClient,
  userId: string,
  query: string,
  matchCount?: number,
): Promise<LibraryRetrievalResult> {
  const traceId = newTraceId();
  const t0 = Date.now();
  const k = clampMatchCount(matchCount);
  const uncalibrated = getRagMinSimilarity() === null;

  const empty = (
    status: LibraryRetrievalStatus,
    embedMs: number,
    rpcMs: number,
    detail?: string,
  ): LibraryRetrievalResult => ({
    status,
    matches: [],
    uncalibrated,
    timings: { embedMs, rpcMs, totalMs: Date.now() - t0 },
    traceId,
    detail,
  });

  try {
    const { data: settings } = await supabase
      .from("user_study_settings")
      .select("rag_book_ids")
      .eq("user_id", userId)
      .maybeSingle();
    const activeIds = (settings?.rag_book_ids as string[] | null) ?? [];
    if (activeIds.length === 0) {
      return empty("no_active_books", 0, 0, "usuário sem livros ativos no toggle");
    }

    const embed = await embedQuery(query);
    if (!embed.ok) return empty(embed.status, embed.ms, 0, embed.detail);

    const rpcStart = Date.now();
    const { data, error } = await supabase.rpc("match_library_chunks", {
      query_embedding: embed.embedding as unknown as string,
      target_user_id: userId,
      active_book_ids: activeIds,
      match_count: k,
    });
    const rpcMs = Date.now() - rpcStart;
    if (error) {
      console.warn(`[library-rag ${traceId}] rpc_error`, error.message);
      return empty("rpc_error", embed.ms, rpcMs, error.message);
    }
    const raw = (data ?? []) as LibraryMatch[];

    // BLOCO 1: sem filtro cliente. Devolve o top-K puro.
    if (uncalibrated && raw.length > 0) {
      const scores = raw.map((m) => Number(m.similarity ?? 0).toFixed(3)).join(",");
      console.info(
        `[library-rag ${traceId}] uncalibrated top-K=${raw.length} scores=${scores} embedMs=${embed.ms} rpcMs=${rpcMs}`,
      );
    }

    return {
      status: "ok",
      matches: raw,
      uncalibrated,
      timings: { embedMs: embed.ms, rpcMs, totalMs: Date.now() - t0 },
      traceId,
    };
  } catch (e) {
    return empty(
      "unknown_error",
      0,
      0,
      e instanceof Error ? e.message : "erro desconhecido",
    );
  }
}

/**
 * @deprecated Use `retrieveLibraryContextDetailed` para obter status,
 * matches e diagnóstico. Este wrapper é mantido apenas por compatibilidade
 * com callers legados.
 *
 * Call sites legados (não migrar no Bloco 1):
 *   - src/lib/lousa.functions.ts (`retrieveLibraryContext(...)`)
 *
 * `src/lib/library.functions.ts::searchLibrary` NÃO usa este helper; ela
 * chama a RPC diretamente para busca exploratória e não é migrada.
 */
export async function retrieveLibraryContext(
  supabase: SupabaseClient,
  userId: string,
  query: string,
  matchCount = 5,
): Promise<LibraryMatch[]> {
  const r = await retrieveLibraryContextDetailed(supabase, userId, query, matchCount);
  return r.matches;
}

/**
 * Dado um conjunto de matches (book_id + página no metadata), busca as figuras
 * gravadas na tabela library_figures para aquelas páginas e gera signed URLs.
 */
export async function retrieveLibraryFigures(
  supabase: SupabaseClient,
  userId: string,
  matches: LibraryMatch[],
  maxFigures = 3,
): Promise<LibraryFigure[]> {
  try {
    if (matches.length === 0) return [];
    const seen = new Set<string>();
    const pairs: { bookId: string; page: number; bookTitle: string }[] = [];
    for (const m of matches) {
      const page = Number(m.metadata?.page ?? 0);
      if (!page) continue;
      const key = `${m.book_id}:${page}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push({
        bookId: m.book_id,
        page,
        bookTitle: (m.metadata?.bookTitle as string | undefined) ?? "livro",
      });
    }
    if (pairs.length === 0) return [];

    const bookIds = Array.from(new Set(pairs.map((p) => p.bookId)));
    const pages = Array.from(new Set(pairs.map((p) => p.page)));
    const { data: figures, error } = await supabase
      .from("library_figures")
      .select("book_id, page, storage_path, width, height, caption")
      .eq("user_id", userId)
      .in("book_id", bookIds)
      .in("page", pages);
    if (error || !figures?.length) return [];

    const out: LibraryFigure[] = [];
    for (const p of pairs) {
      if (out.length >= maxFigures) break;
      const fig = figures.find(
        (f) => f.book_id === p.bookId && f.page === p.page,
      );
      if (!fig) continue;
      const { data: signed } = await supabase.storage
        .from("books")
        .createSignedUrl(fig.storage_path, 60 * 60);
      if (!signed?.signedUrl) continue;
      out.push({
        bookId: p.bookId,
        bookTitle: p.bookTitle,
        page: p.page,
        url: signed.signedUrl,
        storagePath: fig.storage_path,
        width: fig.width,
        height: fig.height,
        caption: fig.caption,
      });
    }
    return out;
  } catch (e) {
    console.warn("[library-rag] falha ao recuperar figuras", e);
    return [];
  }
}

/**
 * Converte matches em bloco de texto para injetar em prompts.
 * Mantém título, página e índice — score NÃO é exposto no prompt.
 */
export function libraryMatchesToPrompt(matches: LibraryMatch[]): string {
  if (matches.length === 0) return "";
  const lines: string[] = [
    "",
    "═══ TRECHOS DA BIBLIOTECA DO ALUNO ═══",
    "Use como FONTE PRIMÁRIA. Quando usar um trecho, cite-o explicitamente no",
    'formato: "(trecho [N] — «Livro», p.X)". NÃO invente conteúdo fora desses trechos.',
    "",
  ];
  matches.forEach((m, i) => {
    const page = (m.metadata?.page as number | undefined) ?? null;
    const bookTitle = (m.metadata?.bookTitle as string | undefined) ?? "livro";
    lines.push(
      `[${i + 1}] «${bookTitle}»${page ? ` — p.${page}` : ""}:`,
      m.content.slice(0, 800),
      "",
    );
  });
  return lines.join("\n");
}

/**
 * Instrução textual sobre as figuras enviadas como anexos multimodais.
 */
export function libraryFiguresToPrompt(figures: LibraryFigure[]): string {
  if (figures.length === 0) return "";
  const lines: string[] = [
    "",
    `═══ IMAGENS ANEXADAS DA BIBLIOTECA (${figures.length}) ═══`,
    "São páginas dos livros ativos com figuras/gráficos relevantes.",
    'Ao referenciar uma figura, cite no formato: "(figura [N] — «Livro», p.X)".',
    "",
  ];
  figures.forEach((f, i) => {
    lines.push(`[figura ${i + 1}] «${f.bookTitle}» — p.${f.page}`);
  });
  return lines.join("\n");
}

/**
 * Mensagem UI amigável (curta) para cada status. Nunca vaza detail interno.
 * Não expõe threshold nem "no_relevant_matches" enquanto uncalibrated.
 */
export function libraryStatusUiMessage(status: LibraryRetrievalStatus): string {
  switch (status) {
    case "ok":
      return "";
    case "no_active_books":
      return "Nenhum livro ativo na sua biblioteca. Ative um livro em «Minha Biblioteca IA» para receber respostas baseadas nele.";
    case "embedding_auth_error":
    case "embedding_upstream_error":
    case "no_embedding":
      return "Não consegui consultar a sua biblioteca agora (falha no serviço de embeddings). Tente novamente em instantes.";
    case "rpc_error":
      return "Não consegui consultar a sua biblioteca agora (erro na busca). Tente novamente.";
    default:
      return "Não consegui consultar a sua biblioteca agora.";
  }
}

// Exportação nomeada de compatibilidade para código que ainda referencia o
// nome antigo dentro deste módulo. Novos callers DEVEM usar
// `retrieveLibraryContextDetailed`.
export { RAG_IS_CALIBRATED };
