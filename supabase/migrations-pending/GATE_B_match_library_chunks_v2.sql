-- ============================================================================
-- PENDING — NÃO APLICAR ATÉ GATE B APROVADO
-- ============================================================================
-- RAG Fase 0 → v2 da RPC de retrieval com threshold em plpgsql.
--
-- Alvos:
--   1) Adiciona `match_library_chunks_v2(query_embedding, target_user_id,
--      active_book_ids, match_count, match_threshold)`.
--   2) Valida parâmetros em plpgsql (ressalva #2 do usuário).
--   3) Mantém `match_library_chunks` (v1) inalterada até o Gate B trocar o
--      caller no backend para v2.
--
-- Observações:
--   - v2 aplica o filtro `similarity >= match_threshold` DENTRO da CTE, antes
--     do LIMIT, para que o top-K devolvido já respeite o corte.
--   - Se `match_threshold` for NULL/omitido, exige valor no chamador (RAISE).
--   - Reforça CHECK em match_count [1..50].
-- ============================================================================

CREATE OR REPLACE FUNCTION public.match_library_chunks_v2(
  query_embedding vector,
  target_user_id uuid,
  active_book_ids uuid[],
  match_count integer,
  match_threshold double precision
)
RETURNS TABLE(
  id uuid,
  book_id uuid,
  chunk_index integer,
  content text,
  metadata jsonb,
  similarity double precision
)
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
BEGIN
  IF match_threshold IS NULL THEN
    RAISE EXCEPTION 'match_threshold é obrigatório em match_library_chunks_v2';
  END IF;
  IF match_threshold < -1.0 OR match_threshold > 1.0 THEN
    RAISE EXCEPTION 'match_threshold fora do intervalo [-1,1]: %', match_threshold;
  END IF;
  IF match_count IS NULL OR match_count < 1 OR match_count > 50 THEN
    RAISE EXCEPTION 'match_count fora do intervalo [1,50]: %', match_count;
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT
      e.id,
      e.book_id,
      e.chunk_index,
      e.content,
      COALESCE(e.metadata, '{}'::jsonb)
        || jsonb_build_object(
          'bookTitle',
          COALESCE(NULLIF(e.metadata->>'bookTitle', ''), b.title, 'livro')
        ) AS metadata,
      1 - (e.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)) AS similarity,
      e.embedding::halfvec(3072) <=> query_embedding::halfvec(3072) AS distance
    FROM public.library_embeddings e
    LEFT JOIN public.library_books b ON b.id = e.book_id
    WHERE e.user_id = target_user_id
      AND (
        active_book_ids IS NULL
        OR array_length(active_book_ids, 1) IS NULL
        OR e.book_id = ANY(active_book_ids)
      )
  )
  SELECT id, book_id, chunk_index, content, metadata, similarity
  FROM candidates
  WHERE similarity >= match_threshold
  ORDER BY distance
  LIMIT match_count;
END;
$$;

-- (não aplicar) COMMENT ON FUNCTION public.match_library_chunks_v2 IS
--   'RAG v2 — threshold-aware retrieval. Substitui match_library_chunks no caller a partir do Gate B.';
