-- AI chat sessions & messages (idempotent).
-- Stores per-user AI assistant conversation history so brokers can resume
-- a chat weeks later and the assistant retains full context.

CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Нов разговор',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_conversations_user_updated_idx
  ON public.ai_conversations(user_id, updated_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_conversations TO authenticated;
GRANT ALL ON public.ai_conversations TO service_role;

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_conversations_owner_select ON public.ai_conversations;
CREATE POLICY ai_conversations_owner_select ON public.ai_conversations
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS ai_conversations_owner_insert ON public.ai_conversations;
CREATE POLICY ai_conversations_owner_insert ON public.ai_conversations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS ai_conversations_owner_update ON public.ai_conversations;
CREATE POLICY ai_conversations_owner_update ON public.ai_conversations
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS ai_conversations_owner_delete ON public.ai_conversations;
CREATE POLICY ai_conversations_owner_delete ON public.ai_conversations
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','system','tool')),
  content text NOT NULL,
  tool_calls jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_messages_conversation_created_idx
  ON public.ai_messages(conversation_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_messages TO authenticated;
GRANT ALL ON public.ai_messages TO service_role;

ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_messages_owner_select ON public.ai_messages;
CREATE POLICY ai_messages_owner_select ON public.ai_messages
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.ai_conversations c
            WHERE c.id = ai_messages.conversation_id AND c.user_id = auth.uid())
  );

DROP POLICY IF EXISTS ai_messages_owner_insert ON public.ai_messages;
CREATE POLICY ai_messages_owner_insert ON public.ai_messages
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.ai_conversations c
            WHERE c.id = ai_messages.conversation_id AND c.user_id = auth.uid())
  );

DROP POLICY IF EXISTS ai_messages_owner_delete ON public.ai_messages;
CREATE POLICY ai_messages_owner_delete ON public.ai_messages
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.ai_conversations c
            WHERE c.id = ai_messages.conversation_id AND c.user_id = auth.uid())
  );

NOTIFY pgrst, 'reload schema';