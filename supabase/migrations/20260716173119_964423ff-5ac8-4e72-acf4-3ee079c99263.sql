
CREATE OR REPLACE FUNCTION public.match_library_chunks(
  query_embedding vector(3072),
  target_user_id UUID,
  active_book_ids UUID[],
  match_count INT DEFAULT 6
)
RETURNS TABLE (
  id UUID,
  book_id UUID,
  chunk_index INT,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT
    e.id,
    e.book_id,
    e.chunk_index,
    e.content,
    e.metadata,
    1 - (e.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)) AS similarity
  FROM public.library_embeddings e
  WHERE e.user_id = target_user_id
    AND (
      active_book_ids IS NULL
      OR array_length(active_book_ids, 1) IS NULL
      OR e.book_id = ANY(active_book_ids)
    )
  ORDER BY e.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)
  LIMIT match_count;
$$;
