
CREATE TABLE public.video_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES public.study_videos(id) ON DELETE CASCADE,
  youtube_id TEXT NOT NULL,
  timestamp_seconds INTEGER NOT NULL DEFAULT 0,
  style TEXT NOT NULL DEFAULT 'post-it',
  ai_explanation TEXT NOT NULL DEFAULT '',
  user_note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX video_notes_user_video_idx ON public.video_notes(user_id, video_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_notes TO authenticated;
GRANT ALL ON public.video_notes TO service_role;

ALTER TABLE public.video_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own video notes"
  ON public.video_notes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_video_notes_updated_at
  BEFORE UPDATE ON public.video_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
