-- ============================================================
-- ENEM Exams (provas oficiais)
-- ============================================================
CREATE TABLE public.enem_exams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  year INTEGER NOT NULL,
  day INTEGER NOT NULL CHECK (day IN (1, 2)),
  title TEXT NOT NULL,
  total_questions INTEGER NOT NULL DEFAULT 0,
  duration_minutes INTEGER NOT NULL DEFAULT 330,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (year, day)
);

GRANT SELECT ON public.enem_exams TO authenticated;
GRANT ALL ON public.enem_exams TO service_role;

ALTER TABLE public.enem_exams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enem exams readable by authenticated"
  ON public.enem_exams FOR SELECT TO authenticated USING (true);

CREATE TRIGGER update_enem_exams_updated_at
  BEFORE UPDATE ON public.enem_exams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- ENEM Questions
-- ============================================================
CREATE TABLE public.enem_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exam_id UUID NOT NULL REFERENCES public.enem_exams(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  day INTEGER NOT NULL,
  question_index INTEGER NOT NULL,
  discipline TEXT NOT NULL,
  area TEXT NOT NULL,
  language TEXT,
  context TEXT,
  files JSONB NOT NULL DEFAULT '[]'::jsonb,
  alternative_introduction TEXT,
  alternatives JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_alternative TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (year, day, question_index, language)
);

CREATE INDEX enem_questions_exam_idx ON public.enem_questions(exam_id);
CREATE INDEX enem_questions_area_idx ON public.enem_questions(area);
CREATE INDEX enem_questions_year_day_idx ON public.enem_questions(year, day);

GRANT SELECT ON public.enem_questions TO authenticated;
GRANT ALL ON public.enem_questions TO service_role;

ALTER TABLE public.enem_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enem questions readable by authenticated"
  ON public.enem_questions FOR SELECT TO authenticated USING (true);

-- ============================================================
-- Simulado Sessions
-- ============================================================
CREATE TABLE public.simulado_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('full_day', 'by_area')),
  year INTEGER,
  day INTEGER,
  area TEXT,
  question_ids UUID[] NOT NULL DEFAULT '{}',
  total_questions INTEGER NOT NULL,
  duration_minutes INTEGER NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  finished_at TIMESTAMP WITH TIME ZONE,
  time_spent_seconds INTEGER,
  correct_count INTEGER,
  score_tri NUMERIC(6, 2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX simulado_sessions_user_idx ON public.simulado_sessions(user_id, started_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulado_sessions TO authenticated;
GRANT ALL ON public.simulado_sessions TO service_role;

ALTER TABLE public.simulado_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own simulado sessions"
  ON public.simulado_sessions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_simulado_sessions_updated_at
  BEFORE UPDATE ON public.simulado_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Simulado Answers
-- ============================================================
CREATE TABLE public.simulado_answers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.simulado_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.enem_questions(id) ON DELETE CASCADE,
  selected_alternative TEXT,
  is_correct BOOLEAN,
  time_spent_seconds INTEGER,
  answered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (session_id, question_id)
);

CREATE INDEX simulado_answers_session_idx ON public.simulado_answers(session_id);
CREATE INDEX simulado_answers_user_idx ON public.simulado_answers(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulado_answers TO authenticated;
GRANT ALL ON public.simulado_answers TO service_role;

ALTER TABLE public.simulado_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own simulado answers"
  ON public.simulado_answers FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Study Topics (árvore de assuntos)
-- ============================================================
CREATE TABLE public.study_topics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_id UUID REFERENCES public.study_topics(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  area TEXT NOT NULL,
  subject TEXT,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX study_topics_parent_idx ON public.study_topics(parent_id);
CREATE INDEX study_topics_area_idx ON public.study_topics(area);

GRANT SELECT ON public.study_topics TO authenticated;
GRANT ALL ON public.study_topics TO service_role;

ALTER TABLE public.study_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Study topics readable by authenticated"
  ON public.study_topics FOR SELECT TO authenticated USING (true);

CREATE TRIGGER update_study_topics_updated_at
  BEFORE UPDATE ON public.study_topics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Study Videos
-- ============================================================
CREATE TABLE public.study_videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  topic_id UUID NOT NULL REFERENCES public.study_topics(id) ON DELETE CASCADE,
  youtube_id TEXT NOT NULL,
  title TEXT NOT NULL,
  channel_name TEXT,
  channel_id TEXT,
  thumbnail_url TEXT,
  duration_seconds INTEGER,
  source TEXT NOT NULL DEFAULT 'curated' CHECK (source IN ('curated', 'ai')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  suggested_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (topic_id, youtube_id)
);

CREATE INDEX study_videos_topic_idx ON public.study_videos(topic_id);

GRANT SELECT ON public.study_videos TO authenticated;
GRANT ALL ON public.study_videos TO service_role;

ALTER TABLE public.study_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Study videos readable by authenticated"
  ON public.study_videos FOR SELECT TO authenticated USING (true);

CREATE TRIGGER update_study_videos_updated_at
  BEFORE UPDATE ON public.study_videos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- User Video Progress
-- ============================================================
CREATE TABLE public.user_video_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES public.study_videos(id) ON DELETE CASCADE,
  watched BOOLEAN NOT NULL DEFAULT false,
  watch_seconds INTEGER NOT NULL DEFAULT 0,
  last_watched_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, video_id)
);

CREATE INDEX user_video_progress_user_idx ON public.user_video_progress(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_video_progress TO authenticated;
GRANT ALL ON public.user_video_progress TO service_role;

ALTER TABLE public.user_video_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own video progress"
  ON public.user_video_progress FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_user_video_progress_updated_at
  BEFORE UPDATE ON public.user_video_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();