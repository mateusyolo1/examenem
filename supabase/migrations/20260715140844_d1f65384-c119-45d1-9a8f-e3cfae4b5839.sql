
-- Extend user_study_settings with contract/stage/target fields
ALTER TABLE public.user_study_settings
  ADD COLUMN IF NOT EXISTS hours_per_day numeric(3,1) NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS target_score int NOT NULL DEFAULT 700,
  ADD COLUMN IF NOT EXISTS stage_level int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS stage_week int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS stage_started_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.user_study_settings
  DROP CONSTRAINT IF EXISTS user_study_settings_stage_level_check;
ALTER TABLE public.user_study_settings
  ADD CONSTRAINT user_study_settings_stage_level_check CHECK (stage_level BETWEEN 1 AND 4);

ALTER TABLE public.user_study_settings
  DROP CONSTRAINT IF EXISTS user_study_settings_hours_per_day_check;
ALTER TABLE public.user_study_settings
  ADD CONSTRAINT user_study_settings_hours_per_day_check CHECK (hours_per_day > 0 AND hours_per_day <= 16);

-- Track max level reached per topic (for fast-track)
ALTER TABLE public.topic_mastery
  ADD COLUMN IF NOT EXISTS level_reached int NOT NULL DEFAULT 1;

ALTER TABLE public.topic_mastery
  DROP CONSTRAINT IF EXISTS topic_mastery_level_reached_check;
ALTER TABLE public.topic_mastery
  ADD CONSTRAINT topic_mastery_level_reached_check CHECK (level_reached BETWEEN 1 AND 4);

-- New telemetry table for effort feedback
CREATE TABLE IF NOT EXISTS public.learning_telemetry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_kind text NOT NULL CHECK (activity_kind IN ('video','lousa','treino','simulado','flashcards')),
  activity_ref uuid,
  topic_slug text,
  topic_area text,
  effort text CHECK (effort IN ('facil','medio','dificil')),
  score numeric(4,3),
  duration_min int,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS learning_telemetry_user_created_idx
  ON public.learning_telemetry (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.learning_telemetry TO authenticated;
GRANT ALL ON public.learning_telemetry TO service_role;

ALTER TABLE public.learning_telemetry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own telemetry" ON public.learning_telemetry;
CREATE POLICY "Own telemetry" ON public.learning_telemetry
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
