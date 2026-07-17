
CREATE TABLE public.library_figures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  book_id UUID NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  page INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  caption TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX library_figures_book_page_idx ON public.library_figures(book_id, page);
CREATE INDEX library_figures_user_idx ON public.library_figures(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_figures TO authenticated;
GRANT ALL ON public.library_figures TO service_role;

ALTER TABLE public.library_figures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own figures"
  ON public.library_figures FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
