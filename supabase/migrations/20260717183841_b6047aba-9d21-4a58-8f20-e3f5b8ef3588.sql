-- Recreate match_library_chunks joining library_books so bookTitle is always present
CREATE OR REPLACE FUNCTION public.match_library_chunks(
  query_embedding vector,
  target_user_id uuid,
  active_book_ids uuid[],
  match_count integer DEFAULT 6
)
RETURNS TABLE(
  id uuid,
  book_id uuid,
  chunk_index integer,
  content text,
  metadata jsonb,
  similarity double precision
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
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
    1 - (e.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)) AS similarity
  FROM public.library_embeddings e
  LEFT JOIN public.library_books b ON b.id = e.book_id
  WHERE e.user_id = target_user_id
    AND (
      active_book_ids IS NULL
      OR array_length(active_book_ids, 1) IS NULL
      OR e.book_id = ANY(active_book_ids)
    )
  ORDER BY e.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)
  LIMIT match_count;
$function$;

-- Backfill bookTitle in metadata for embeddings that don't have one
UPDATE public.library_embeddings e
SET metadata = COALESCE(e.metadata, '{}'::jsonb)
  || jsonb_build_object('bookTitle', b.title)
FROM public.library_books b
WHERE b.id = e.book_id
  AND (e.metadata IS NULL OR NOT (e.metadata ? 'bookTitle') OR (e.metadata->>'bookTitle') = '');

-- Backfill approximate page number (heuristic: 4 chunks per page) where missing
UPDATE public.library_embeddings
SET metadata = COALESCE(metadata, '{}'::jsonb)
  || jsonb_build_object('page', GREATEST(1, (chunk_index / 4) + 1))
WHERE metadata IS NULL OR NOT (metadata ? 'page') OR (metadata->>'page') = '';
