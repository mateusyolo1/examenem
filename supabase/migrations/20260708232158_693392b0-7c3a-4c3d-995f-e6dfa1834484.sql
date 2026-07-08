
-- 1. study_plan_days
CREATE TABLE public.study_plan_days (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  plan_date DATE NOT NULL,
  kind TEXT NOT NULL DEFAULT 'regular' CHECK (kind IN ('regular','reforco')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','done')),
  unlocked_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, plan_date, kind)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_plan_days TO authenticated;
GRANT ALL ON public.study_plan_days TO service_role;
ALTER TABLE public.study_plan_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own days" ON public.study_plan_days FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER study_plan_days_updated BEFORE UPDATE ON public.study_plan_days FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX study_plan_days_user_date_idx ON public.study_plan_days(user_id, plan_date);

-- 2. study_plan_activities
CREATE TABLE public.study_plan_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  day_id UUID NOT NULL REFERENCES public.study_plan_days ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  order_index INT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('videos','lousa','treino','flashcards','simulado')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','done','failed')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  score NUMERIC,
  passed BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_plan_activities TO authenticated;
GRANT ALL ON public.study_plan_activities TO service_role;
ALTER TABLE public.study_plan_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own activities" ON public.study_plan_activities FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER study_plan_activities_updated BEFORE UPDATE ON public.study_plan_activities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX study_plan_activities_day_idx ON public.study_plan_activities(day_id, order_index);

-- 3. user_pressure_level
CREATE TABLE public.user_pressure_level (
  user_id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  level INT NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 5),
  wins_streak INT NOT NULL DEFAULT 0,
  last_result NUMERIC,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_pressure_level TO authenticated;
GRANT ALL ON public.user_pressure_level TO service_role;
ALTER TABLE public.user_pressure_level ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own pressure" ON public.user_pressure_level FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER user_pressure_level_updated BEFORE UPDATE ON public.user_pressure_level FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. user_study_settings
CREATE TABLE public.user_study_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  lousa_pass_threshold INT NOT NULL DEFAULT 60 CHECK (lousa_pass_threshold BETWEEN 30 AND 100),
  weekly_pattern JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_study_settings TO authenticated;
GRANT ALL ON public.user_study_settings TO service_role;
ALTER TABLE public.user_study_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own settings" ON public.user_study_settings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER user_study_settings_updated BEFORE UPDATE ON public.user_study_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. lousa_questions
CREATE TABLE public.lousa_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id UUID NOT NULL REFERENCES public.study_plan_activities ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  order_index INT NOT NULL,
  enunciado TEXT NOT NULL,
  gabarito TEXT NOT NULL,
  topico TEXT,
  user_answer TEXT,
  correct BOOLEAN,
  feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lousa_questions TO authenticated;
GRANT ALL ON public.lousa_questions TO service_role;
ALTER TABLE public.lousa_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own lousa questions" ON public.lousa_questions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER lousa_questions_updated BEFORE UPDATE ON public.lousa_questions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX lousa_questions_activity_idx ON public.lousa_questions(activity_id, order_index);
