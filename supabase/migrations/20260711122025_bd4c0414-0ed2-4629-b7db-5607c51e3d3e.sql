ALTER TABLE public.user_video_suggestion_history
  ADD COLUMN IF NOT EXISTS dismissed_at timestamptz;

CREATE INDEX IF NOT EXISTS user_video_suggestion_history_visible_idx
  ON public.user_video_suggestion_history (user_id, topic_id, dismissed_at);
