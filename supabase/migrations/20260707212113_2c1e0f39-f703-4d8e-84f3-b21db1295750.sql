CREATE TABLE public.lesson_essay_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES public.study_topics(id) ON DELETE CASCADE,
  task JSONB NOT NULL,
  essay_text TEXT NOT NULL,
  score NUMERIC(4,2),
  feedback JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_essay_attempts TO authenticated;
GRANT ALL ON public.lesson_essay_attempts TO service_role;

ALTER TABLE public.lesson_essay_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own essay attempts"
  ON public.lesson_essay_attempts
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_lesson_essay_attempts_user_topic
  ON public.lesson_essay_attempts(user_id, topic_id, created_at DESC);

CREATE TRIGGER update_lesson_essay_attempts_updated_at
  BEFORE UPDATE ON public.lesson_essay_attempts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();