-- Public customer chat RPCs: allow widget/API to persist chats without service_role on edge,
-- scoped strictly by visitor_token (SECURITY DEFINER).

CREATE OR REPLACE FUNCTION public.customer_chat_open(
  p_visitor_token text,
  p_property_id uuid DEFAULT NULL,
  p_page_url text DEFAULT NULL,
  p_visitor_name text DEFAULT NULL,
  p_visitor_phone text DEFAULT NULL,
  p_visitor_email text DEFAULT NULL,
  p_chat_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_visitor_token IS NULL OR char_length(p_visitor_token) < 8 OR char_length(p_visitor_token) > 128 THEN
    RAISE EXCEPTION 'invalid visitor_token';
  END IF;

  IF p_chat_id IS NOT NULL THEN
    SELECT c.id INTO v_id
    FROM public.customer_chats c
    WHERE c.id = p_chat_id AND c.visitor_token = p_visitor_token
    LIMIT 1;
    IF v_id IS NOT NULL THEN
      RETURN v_id;
    END IF;
  END IF;

  INSERT INTO public.customer_chats (
    visitor_token, property_id, page_url, visitor_name, visitor_phone, visitor_email
  )
  VALUES (
    p_visitor_token, p_property_id, p_page_url, p_visitor_name, p_visitor_phone, p_visitor_email
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.customer_chat_append_message(
  p_chat_id uuid,
  p_visitor_token text,
  p_role text,
  p_content text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_role NOT IN ('user', 'assistant') THEN
    RAISE EXCEPTION 'invalid role';
  END IF;
  IF p_content IS NULL OR char_length(p_content) < 1 OR char_length(p_content) > 2000 THEN
    RAISE EXCEPTION 'invalid content';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.customer_chats c
    WHERE c.id = p_chat_id AND c.visitor_token = p_visitor_token
  ) THEN
    RAISE EXCEPTION 'chat not found';
  END IF;

  INSERT INTO public.customer_chat_messages (chat_id, role, content)
  VALUES (p_chat_id, p_role, p_content);

  UPDATE public.customer_chats
  SET last_message_at = now()
  WHERE id = p_chat_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.customer_chat_list_messages(
  p_chat_id uuid,
  p_visitor_token text,
  p_limit int DEFAULT 40
)
RETURNS TABLE(role text, content text, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.customer_chats c
    WHERE c.id = p_chat_id AND c.visitor_token = p_visitor_token
  ) THEN
    RAISE EXCEPTION 'chat not found';
  END IF;

  RETURN QUERY
  SELECT m.role, m.content, m.created_at
  FROM public.customer_chat_messages m
  WHERE m.chat_id = p_chat_id
  ORDER BY m.created_at ASC
  LIMIT LEAST(GREATEST(p_limit, 1), 40);
END;
$$;

REVOKE ALL ON FUNCTION public.customer_chat_open(text, uuid, text, text, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.customer_chat_append_message(uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.customer_chat_list_messages(uuid, text, int) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.customer_chat_open(text, uuid, text, text, text, text, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.customer_chat_append_message(uuid, text, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.customer_chat_list_messages(uuid, text, int) TO anon, authenticated, service_role;
