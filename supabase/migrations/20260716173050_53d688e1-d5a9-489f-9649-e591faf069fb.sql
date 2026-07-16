
CREATE EXTENSION IF NOT EXISTS vector;

-- Books
CREATE TABLE public.library_books (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title TEXT NOT NULL,
  author TEXT,
  subject TEXT,
  storage_path TEXT,
  page_count INT,
  chunk_count INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | extracting | embedding | ready | error
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_books TO authenticated;
GRANT ALL ON public.library_books TO service_role;

ALTER TABLE public.library_books ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own books" ON public.library_books
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_library_books_updated_at
  BEFORE UPDATE ON public.library_books
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX library_books_user_idx ON public.library_books(user_id, created_at DESC);

-- Embeddings
CREATE TABLE public.library_embeddings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.library_books ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  content TEXT NOT NULL,
  embedding vector(3072) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_embeddings TO authenticated;
GRANT ALL ON public.library_embeddings TO service_role;

ALTER TABLE public.library_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own embeddings" ON public.library_embeddings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX library_embeddings_book_idx ON public.library_embeddings(book_id, chunk_index);
CREATE INDEX library_embeddings_user_idx ON public.library_embeddings(user_id);
CREATE INDEX library_embeddings_hnsw_idx
  ON public.library_embeddings
  USING hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops);

-- Add rag_book_ids to user settings
ALTER TABLE public.user_study_settings
  ADD COLUMN IF NOT EXISTS rag_book_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[];

-- Similarity search function (scoped to user + active books)
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
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
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
