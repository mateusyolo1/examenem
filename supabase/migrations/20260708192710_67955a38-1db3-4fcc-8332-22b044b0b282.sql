GRANT SELECT, INSERT, UPDATE, DELETE ON public.flashcards TO authenticated;
GRANT ALL ON public.flashcards TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flashcard_reviews TO authenticated;
GRANT ALL ON public.flashcard_reviews TO service_role;