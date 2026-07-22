import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAiAccess } from "./ai-access.middleware";
import { inferSubjectFromQuery, SUBJECT_BOOK_PATTERNS, LEGAL_RE } from "./library-rag.server";
import { z } from "zod";

const EMBED_MODEL = "google/gemini-embedding-2";
const EMBED_URL = "https://ai.gateway.lovable.dev/v1/embeddings";
const MAX_BATCH = 90; // gemini-embedding limit is 100

async function callEmbeddings(inputs: string[]): Promise<number[][]> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");
  const res = await fetch(EMBED_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: inputs }),
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 429)
      throw new Error("Limite de uso da IA atingido. Tente novamente em instantes.");
    if (res.status === 402)
      throw new Error("Créditos de IA esgotados. Adicione créditos para continuar.");
    throw new Error(`Falha ao gerar embeddings (${res.status}): ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    data: { index: number; embedding: number[] }[];
  };
  return json.data
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}

/* ================= listBooks ================= */
export const listBooks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [booksRes, settingsRes] = await Promise.all([
      supabase
        .from("library_books")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("user_study_settings")
        .select("rag_book_ids")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);
    if (booksRes.error) throw new Error(booksRes.error.message);
    return {
      books: booksRes.data ?? [],
      activeBookIds: (settingsRes.data?.rag_book_ids as string[] | null) ?? [],
    };
  });

/* ================= createBook ================= */
export const createBook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        title: z.string().min(1).max(300),
        author: z.string().max(200).optional(),
        subject: z.string().max(120).optional(),
        pageCount: z.number().int().positive().optional(),
        folder: z.string().max(200).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const folder = data.folder?.trim().replace(/^\/+|\/+$/g, "") || null;
    const { data: row, error } = await supabase
      .from("library_books")
      .insert({
        user_id: userId,
        title: data.title,
        author: data.author ?? null,
        subject: data.subject ?? null,
        page_count: data.pageCount ?? null,
        folder,
        status: "extracting",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { book: row };
  });

/* ================= embedChunks =================
 * Recebe um lote de trechos já extraídos no cliente.
 * Gera embeddings via Lovable AI Gateway e persiste.
 */
export const embedChunks = createServerFn({ method: "POST" })
  .middleware([requireAiAccess])
  .inputValidator((d: unknown) =>
    z
      .object({
        bookId: z.string().uuid(),
        chunks: z
          .array(
            z.object({
              index: z.number().int().nonnegative(),
              content: z.string().min(1).max(6000),
              metadata: z.record(z.string(), z.unknown()).optional(),
            }),
          )
          .min(1)
          .max(MAX_BATCH),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    // valida propriedade do livro
    const { data: book, error: bookErr } = await supabase
      .from("library_books")
      .select("id,status")
      .eq("id", data.bookId)
      .eq("user_id", userId)
      .maybeSingle();
    if (bookErr) throw new Error(bookErr.message);
    if (!book) throw new Error("Livro não encontrado");

    await supabase
      .from("library_books")
      .update({ status: "embedding" })
      .eq("id", data.bookId)
      .eq("user_id", userId);

    const embeddings = await callEmbeddings(data.chunks.map((c) => c.content));

    const rows = data.chunks.map((c, i) => ({
      user_id: userId,
      book_id: data.bookId,
      chunk_index: c.index,
      content: c.content,
      embedding: embeddings[i] as unknown as string,
      metadata: (c.metadata ?? {}) as never,
    }));

    const { error: insErr } = await supabase
      .from("library_embeddings")
      .insert(rows);
    if (insErr) throw new Error(insErr.message);

    // atualiza contagem
    const { count } = await supabase
      .from("library_embeddings")
      .select("id", { count: "exact", head: true })
      .eq("book_id", data.bookId)
      .eq("user_id", userId);

    await supabase
      .from("library_books")
      .update({ chunk_count: count ?? 0 })
      .eq("id", data.bookId)
      .eq("user_id", userId);

    return { inserted: rows.length, total: count ?? 0 };
  });

/* ================= saveFigures =================
 * Registra páginas do PDF que já foram enviadas ao Storage como imagens
 * (o upload é feito no cliente com o supabase-js). Isso permite que o RAG
 * anexe essas páginas como figuras multimodais.
 */
export const saveFigures = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        bookId: z.string().uuid(),
        figures: z
          .array(
            z.object({
              page: z.number().int().positive(),
              storagePath: z.string().min(3).max(500),
              width: z.number().int().positive().optional(),
              height: z.number().int().positive().optional(),
            }),
          )
          .min(1)
          .max(200),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    // valida propriedade
    const { data: book, error: bookErr } = await supabase
      .from("library_books")
      .select("id")
      .eq("id", data.bookId)
      .eq("user_id", userId)
      .maybeSingle();
    if (bookErr) throw new Error(bookErr.message);
    if (!book) throw new Error("Livro não encontrado");

    // Substitui figuras existentes deste livro (idempotente para reprocessamento)
    await supabase
      .from("library_figures")
      .delete()
      .eq("book_id", data.bookId)
      .eq("user_id", userId);

    const rows = data.figures.map((f) => ({
      user_id: userId,
      book_id: data.bookId,
      page: f.page,
      storage_path: f.storagePath,
      width: f.width ?? null,
      height: f.height ?? null,
    }));
    const { error } = await supabase.from("library_figures").insert(rows);
    if (error) throw new Error(error.message);
    return { inserted: rows.length };
  });

/* ================= finalizeBook ================= */
export const finalizeBook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        bookId: z.string().uuid(),
        status: z.enum(["ready", "error"]),
        errorMessage: z.string().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("library_books")
      .update({
        status: data.status,
        error_message: data.errorMessage ?? null,
      })
      .eq("id", data.bookId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);

    // se este é o primeiro livro pronto, ativa por padrão
    if (data.status === "ready") {
      const { data: settings } = await supabase
        .from("user_study_settings")
        .select("rag_book_ids")
        .eq("user_id", userId)
        .maybeSingle();
      const current = (settings?.rag_book_ids as string[] | null) ?? [];
      if (!current.includes(data.bookId)) {
        const next = [...current, data.bookId];
        await supabase
          .from("user_study_settings")
          .upsert(
            { user_id: userId, rag_book_ids: next },
            { onConflict: "user_id" },
          );
      }
    }

    return { ok: true };
  });

/* ================= deleteBook ================= */
export const deleteBook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ bookId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("library_books")
      .delete()
      .eq("id", data.bookId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);

    // remove do rag_book_ids se estiver ativo
    const { data: settings } = await supabase
      .from("user_study_settings")
      .select("rag_book_ids")
      .eq("user_id", userId)
      .maybeSingle();
    const current = (settings?.rag_book_ids as string[] | null) ?? [];
    if (current.includes(data.bookId)) {
      await supabase
        .from("user_study_settings")
        .update({ rag_book_ids: current.filter((id) => id !== data.bookId) })
        .eq("user_id", userId);
    }
    return { ok: true };
  });

/* ================= toggleActiveBook ================= */
export const toggleActiveBook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ bookId: z.string().uuid(), active: z.boolean() })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: settings } = await supabase
      .from("user_study_settings")
      .select("rag_book_ids")
      .eq("user_id", userId)
      .maybeSingle();
    const current = (settings?.rag_book_ids as string[] | null) ?? [];
    const next = data.active
      ? Array.from(new Set([...current, data.bookId]))
      : current.filter((id) => id !== data.bookId);
    const { error } = await supabase
      .from("user_study_settings")
      .upsert(
        { user_id: userId, rag_book_ids: next },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(error.message);
    return { activeBookIds: next };
  });

/* ================= searchLibrary (debug/preview) ================= */
export const searchLibrary = createServerFn({ method: "POST" })
  .middleware([requireAiAccess])
  .inputValidator((d: unknown) =>
    z
      .object({ query: z.string().min(2).max(1000), matchCount: z.number().int().min(1).max(12).optional() })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: settings } = await supabase
      .from("user_study_settings")
      .select("rag_book_ids")
      .eq("user_id", userId)
      .maybeSingle();
    const activeIds = (settings?.rag_book_ids as string[] | null) ?? [];
    if (activeIds.length === 0) return { matches: [] };

    const [embedding] = await callEmbeddings([data.query]);
    const { data: matches, error } = await supabase.rpc("match_library_chunks", {
      query_embedding: embedding as unknown as string,
      target_user_id: userId,
      active_book_ids: activeIds,
      match_count: data.matchCount ?? 6,
    });
    if (error) throw new Error(error.message);
    const list = matches ?? [];
    const inferredSubject = inferSubjectFromQuery(data.query);
    const reranked = inferredSubject
      ? list
          .map((m) => {
            const title = String((m.metadata as Record<string, unknown> | null)?.bookTitle ?? "");
            const bookMatches = SUBJECT_BOOK_PATTERNS[inferredSubject].test(title);
            return bookMatches ? m : { ...m, similarity: Number(m.similarity ?? 0) * 0.6 };
          })
          .sort((a, b) => Number(b.similarity ?? 0) - Number(a.similarity ?? 0))
      : list;
    const filtered = reranked.filter((m) => !LEGAL_RE.test((m.content as string) ?? ""));
    return { matches: filtered };
  });

/* ================= moveBook (mudar pasta) ================= */
export const moveBook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        bookId: z.string().uuid(),
        folder: z.string().max(200).nullable(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const folder =
      data.folder?.trim().replace(/^\/+|\/+$/g, "") || null;
    const { error } = await supabase
      .from("library_books")
      .update({ folder })
      .eq("id", data.bookId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true, folder };
  });

/* ================= renameFolder ================= */
export const renameFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        from: z.string().min(1).max(200),
        to: z.string().max(200).nullable(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const to =
      data.to?.trim().replace(/^\/+|\/+$/g, "") || null;
    const { error } = await supabase
      .from("library_books")
      .update({ folder: to })
      .eq("user_id", userId)
      .eq("folder", data.from);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ================= toggleActiveFolder (ativar/desativar todos os livros de uma pasta) ================= */
export const toggleActiveFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        folder: z.string().max(200).nullable(),
        active: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    let q = supabase
      .from("library_books")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "ready");
    q = data.folder === null ? q.is("folder", null) : q.eq("folder", data.folder);
    const { data: rows, error: selErr } = await q;
    if (selErr) throw new Error(selErr.message);
    const ids = (rows ?? []).map((r) => r.id);
    if (ids.length === 0) return { activeBookIds: [] };

    const { data: settings } = await supabase
      .from("user_study_settings")
      .select("rag_book_ids")
      .eq("user_id", userId)
      .maybeSingle();
    const current = (settings?.rag_book_ids as string[] | null) ?? [];
    const next = data.active
      ? Array.from(new Set([...current, ...ids]))
      : current.filter((id) => !ids.includes(id));
    const { error: upErr } = await supabase
      .from("user_study_settings")
      .upsert(
        { user_id: userId, rag_book_ids: next },
        { onConflict: "user_id" },
      );
    if (upErr) throw new Error(upErr.message);
    return { activeBookIds: next };
  });

