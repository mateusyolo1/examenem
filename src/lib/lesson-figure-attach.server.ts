/**
 * Anexa 1 figura da biblioteca do aluno a um enunciado (quiz / redação / lousa).
 *
 * Regra de negócio:
 *  - Roda RAG (retrieveLibraryContextDetailed) usando o enunciado como query.
 *  - Chama retrieveLibraryFigures para materializar a top-1 figura (signed URL 1h).
 *  - Retorna apenas metadados persistíveis + url temporária. Consumidores devem
 *    re-assinar via storagePath quando o cache/persistência expirar (1h).
 *  - Nunca lança: erros retornam null.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface AttachedFigure {
  bookTitle: string;
  page: number;
  storagePath: string;
  url: string; // signed URL 1h — re-sign no read se necessário
}

export async function attachFigureForStatement(
  supabase: SupabaseClient,
  userId: string,
  statement: string,
): Promise<AttachedFigure | null> {
  try {
    const q = (statement ?? "").trim();
    if (q.length < 8) return null;

    const { retrieveLibraryContextDetailed, retrieveLibraryFigures } =
      await import("./library-rag.server");

    const rag = await retrieveLibraryContextDetailed(supabase, userId, q, 4);
    if (rag.status !== "ok" || rag.matches.length === 0) return null;
    if (!rag.hasFigurePages || rag.hasFigurePages.length === 0) return null;

    const figs = await retrieveLibraryFigures(
      supabase,
      userId,
      rag.matches,
      1,
      rag.hasFigurePages,
    );
    if (figs.length === 0) return null;
    const f = figs[0];
    return {
      bookTitle: f.bookTitle,
      page: f.page,
      storagePath: f.storagePath,
      url: f.url,
    };
  } catch (e) {
    console.warn("[lesson-figure-attach] falha", e);
    return null;
  }
}

/**
 * Re-assina uma lista de storagePaths → mapa { storagePath: signedUrl }.
 * Usado quando o payload vem do cache e as URLs expiraram.
 */
export async function signFigureUrls(
  supabase: SupabaseClient,
  storagePaths: string[],
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const uniq = Array.from(new Set(storagePaths.filter(Boolean)));
  for (const p of uniq) {
    try {
      const { data } = await supabase.storage
        .from("books")
        .createSignedUrl(p, 60 * 60);
      if (data?.signedUrl) out[p] = data.signedUrl;
    } catch {
      /* ignore */
    }
  }
  return out;
}
