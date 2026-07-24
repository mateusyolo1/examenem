ALTER TABLE public.library_figures
  ADD COLUMN IF NOT EXISTS kind text DEFAULT 'figure';

UPDATE public.library_figures SET kind = 'figure' WHERE kind IS NULL;

CREATE INDEX IF NOT EXISTS library_figures_book_page_kind_idx
  ON public.library_figures(book_id, page, kind);