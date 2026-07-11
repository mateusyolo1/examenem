
CREATE TABLE public.lousa_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_slug TEXT,
  topic_area TEXT,
  materia TEXT NOT NULL,
  tema TEXT NOT NULL,
  content JSONB NOT NULL,
  context_snapshot JSONB,
  homework_activity_id UUID REFERENCES public.study_plan_activities(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lousa_sessions_user_created ON public.lousa_sessions(user_id, created_at DESC);
CREATE INDEX idx_lousa_sessions_user_topic ON public.lousa_sessions(user_id, topic_slug);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lousa_sessions TO authenticated;
GRANT ALL ON public.lousa_sessions TO service_role;

ALTER TABLE public.lousa_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own lousa sessions"
  ON public.lousa_sessions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_lousa_sessions_updated_at
  BEFORE UPDATE ON public.lousa_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
