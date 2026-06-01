
CREATE TABLE public.customer_chats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_token TEXT NOT NULL,
  property_id UUID,
  visitor_name TEXT,
  visitor_phone TEXT,
  visitor_email TEXT,
  page_url TEXT,
  is_handed_off BOOLEAN NOT NULL DEFAULT false,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.customer_chats TO authenticated;
GRANT ALL ON public.customer_chats TO service_role;

ALTER TABLE public.customer_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customer_chats admin all"
ON public.customer_chats FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_customer_chats_token ON public.customer_chats(visitor_token);
CREATE INDEX idx_customer_chats_last_msg ON public.customer_chats(last_message_at DESC);

CREATE TABLE public.customer_chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id UUID NOT NULL REFERENCES public.customer_chats(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system','agent')),
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.customer_chat_messages TO authenticated;
GRANT ALL ON public.customer_chat_messages TO service_role;

ALTER TABLE public.customer_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customer_chat_messages admin read"
ON public.customer_chat_messages FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_ccm_chat_id ON public.customer_chat_messages(chat_id, created_at);
