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
