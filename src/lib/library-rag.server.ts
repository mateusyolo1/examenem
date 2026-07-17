// Helper server-only: recupera contexto da biblioteca do aluno para injetar
// em prompts (Lousa, Tutor, Redação, HintCoach). Só é chamado dentro de
// handlers autenticados que já validaram o usuário.

import type { SupabaseClient } from "@supabase/supabase-js";

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
  url: string; // signed URL (1h)
  storagePath: string;
  width?: number | null;
  height?: number | null;
  caption?: string | null;
}

async function embedQuery(query: string): Promise<number[]> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");
  const res = await fetch(EMBED_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: query }),
  });
  if (!res.ok) throw new Error(`Embedding falhou (${res.status})`);
  const json = (await res.json()) as { data: { embedding: number[] }[] };
  return json.data[0]?.embedding ?? [];
}

/**
 * Busca trechos relevantes na biblioteca do aluno. Silenciosa em caso de erro
 * (retorna [] para não bloquear o fluxo de geração).
 */
export async function retrieveLibraryContext(
  supabase: SupabaseClient,
  userId: string,
  query: string,
  matchCount = 5,
): Promise<LibraryMatch[]> {
  try {
    const { data: settings } = await supabase
      .from("user_study_settings")
      .select("rag_book_ids")
      .eq("user_id", userId)
      .maybeSingle();
    const activeIds = (settings?.rag_book_ids as string[] | null) ?? [];
    if (activeIds.length === 0) return [];

    const embedding = await embedQuery(query);
    if (embedding.length === 0) return [];

    const { data, error } = await supabase.rpc("match_library_chunks", {
      query_embedding: embedding as unknown as string,
      target_user_id: userId,
      active_book_ids: activeIds,
      match_count: matchCount,
    });
    if (error) {
      console.warn("[library-rag] rpc failed", error.message);
      return [];
    }
    return (data ?? []) as LibraryMatch[];
  } catch (e) {
    console.warn("[library-rag] falha ao recuperar contexto", e);
    return [];
  }
}

/**
 * Dado um conjunto de matches (book_id + página no metadata), busca as figuras
 * gravadas na tabela library_figures para aquelas páginas e gera signed URLs.
 * Retorna no máximo `maxFigures` (padrão 3).
 */
export async function retrieveLibraryFigures(
  supabase: SupabaseClient,
  userId: string,
  matches: LibraryMatch[],
  maxFigures = 3,
): Promise<LibraryFigure[]> {
  try {
    if (matches.length === 0) return [];
    // Coleta pares únicos book_id+page dos top matches
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

    // Busca todas as figuras dessas páginas em uma query só
    const bookIds = Array.from(new Set(pairs.map((p) => p.bookId)));
    const pages = Array.from(new Set(pairs.map((p) => p.page)));
    const { data: figures, error } = await supabase
      .from("library_figures")
      .select("book_id, page, storage_path, width, height, caption")
      .eq("user_id", userId)
      .in("book_id", bookIds)
      .in("page", pages);
    if (error || !figures?.length) return [];

    // Casa figuras com pairs (mesmo book+page) preservando ordem dos matches
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
 */
export function libraryMatchesToPrompt(matches: LibraryMatch[]): string {
  if (matches.length === 0) return "";
  const lines: string[] = [
    "",
    "TRECHOS DA BIBLIOTECA DO ALUNO (use como fonte primária; cite página quando referenciar):",
  ];
  matches.forEach((m, i) => {
    const page = (m.metadata?.page as number | undefined) ?? null;
    const bookTitle = (m.metadata?.bookTitle as string | undefined) ?? "livro";
    lines.push(
      `[${i + 1}] "${bookTitle}"${page ? ` — p.${page}` : ""}: ${m.content.slice(0, 800)}`,
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
    `IMAGENS ANEXADAS DA BIBLIOTECA DO ALUNO (${figures.length}): são páginas dos livros ativos que contêm figuras/gráficos relevantes ao tema. Descreva brevemente o que vê e, quando fizer sentido pedagógico, cite o livro e página no campo "referencias".`,
  ];
  figures.forEach((f, i) => {
    lines.push(`[fig ${i + 1}] "${f.bookTitle}" — p.${f.page}`);
  });
  return lines.join("\n");
}
