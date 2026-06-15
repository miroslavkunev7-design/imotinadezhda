-- Team chat for brokers
CREATE TABLE IF NOT EXISTS public.team_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_name text,
  content text NOT NULL CHECK (length(content) > 0 AND length(content) <= 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.team_messages TO authenticated;
GRANT ALL ON public.team_messages TO service_role;

ALTER TABLE public.team_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read team chat"
  ON public.team_messages FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can send team messages"
  ON public.team_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Sender can delete own team message"
  ON public.team_messages FOR DELETE TO authenticated
  USING (sender_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_team_messages_created_at ON public.team_messages(created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.team_messages;

-- Task reminders
ALTER TABLE public.broker_tasks
  ADD COLUMN IF NOT EXISTS reminder_minutes integer NOT NULL DEFAULT 180,
  ADD COLUMN IF NOT EXISTS reminded_at timestamptz;