ALTER TABLE public.library_books ADD COLUMN IF NOT EXISTS folder TEXT;
CREATE INDEX IF NOT EXISTS library_books_user_folder_idx ON public.library_books (user_id, folder);