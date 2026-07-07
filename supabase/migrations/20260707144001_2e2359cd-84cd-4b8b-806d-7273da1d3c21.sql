CREATE TABLE public.lesson_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES public.study_topics(id) ON DELETE CASCADE,
  score int NOT NULL,
  total int NOT NULL,
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  completed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX lesson_attempts_user_topic_idx ON public.lesson_attempts (user_id, topic_id, completed_at DESC);

GRANT SELECT, INSERT ON public.lesson_attempts TO authenticated;
GRANT ALL ON public.lesson_attempts TO service_role;

ALTER TABLE public.lesson_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own lesson attempts"
  ON public.lesson_attempts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own lesson attempts"
  ON public.lesson_attempts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);