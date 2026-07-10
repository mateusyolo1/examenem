
CREATE TABLE IF NOT EXISTS public.channel_subject_signal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_name text NOT NULL,
  subject text NOT NULL,
  hits integer NOT NULL DEFAULT 0,
  misses integer NOT NULL DEFAULT 0,
  last_hit_at timestamptz,
  last_miss_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (channel_name, subject)
);

GRANT SELECT ON public.channel_subject_signal TO authenticated;
GRANT ALL ON public.channel_subject_signal TO service_role;
ALTER TABLE public.channel_subject_signal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "channel_subject_signal_read_all_authenticated"
  ON public.channel_subject_signal FOR SELECT
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_channel_subject_signal_subject
  ON public.channel_subject_signal (subject);

CREATE TRIGGER update_channel_subject_signal_updated_at
  BEFORE UPDATE ON public.channel_subject_signal
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.study_videos
  ADD COLUMN IF NOT EXISTS relevance_confidence numeric,
  ADD COLUMN IF NOT EXISTS relevance_reason text,
  ADD COLUMN IF NOT EXISTS pedagogical_intent text,
  ADD COLUMN IF NOT EXISTS subject_detected text,
  ADD COLUMN IF NOT EXISTS lexicon_score numeric;
