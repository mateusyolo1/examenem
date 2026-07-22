ALTER TABLE public.lousa_questions
  ADD COLUMN IF NOT EXISTS figure_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS figure_book_title TEXT,
  ADD COLUMN IF NOT EXISTS figure_page INT;