
-- Public visitor chat via SECURITY DEFINER (works without service role key on Vercel)

CREATE OR REPLACE FUNCTION public.visitor_prepare_customer_chat(
  p_visitor_token text,
  p_chat_id uuid DEFAULT NULL,
  p_property_id uuid DEFAULT NULL,
  p_page_url text DEFAULT NULL,
  p_visitor_name text DEFAULT NULL,
  p_visitor_phone text DEFAULT NULL,
  p_visitor_email text DEFAULT NULL,
  p_message text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chat_id uuid;
  v_history jsonb;
BEGIN
  IF p_visitor_token IS NULL OR length(p_visitor_token) < 8 OR length(p_visitor_token) > 128 THEN
    RAISE EXCEPTION 'invalid visitor token';
  END IF;

  IF p_chat_id IS NOT NULL THEN
    SELECT id INTO v_chat_id
    FROM public.customer_chats
    WHERE id = p_chat_id AND visitor_token = p_visitor_token;
  END IF;

  IF v_chat_id IS NULL THEN
    INSERT INTO public.customer_chats (
      visitor_token, property_id, page_url, visitor_name, visitor_phone, visitor_email
    ) VALUES (
      p_visitor_token, p_property_id, p_page_url, p_visitor_name, p_visitor_phone, p_visitor_email
    )
    RETURNING id INTO v_chat_id;
  END IF;

  IF p_message IS NOT NULL AND length(trim(p_message)) > 0 THEN
    INSERT INTO public.customer_chat_messages (chat_id, role, content)
    VALUES (v_chat_id, 'user', left(trim(p_message), 2000));
    UPDATE public.customer_chats SET last_message_at = now() WHERE id = v_chat_id;
  END IF;

  SELECT coalesce(jsonb_agg(row ORDER BY ord), '[]'::jsonb)
  INTO v_history
  FROM (
    SELECT jsonb_build_object('role', role, 'content', content) AS row, created_at AS ord
    FROM public.customer_chat_messages
    WHERE chat_id = v_chat_id
    ORDER BY created_at ASC
    LIMIT 40
  ) sub;

  RETURN jsonb_build_object('chat_id', v_chat_id, 'history', v_history);
END;
$$;

CREATE OR REPLACE FUNCTION public.visitor_save_customer_reply(
  p_visitor_token text,
  p_chat_id uuid,
  p_reply text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_visitor_token IS NULL OR length(p_visitor_token) < 8 THEN
    RAISE EXCEPTION 'invalid visitor token';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.customer_chats
    WHERE id = p_chat_id AND visitor_token = p_visitor_token
  ) THEN
    RAISE EXCEPTION 'chat not found';
  END IF;

  INSERT INTO public.customer_chat_messages (chat_id, role, content)
  VALUES (p_chat_id, 'assistant', left(trim(p_reply), 8000));

  UPDATE public.customer_chats SET last_message_at = now() WHERE id = p_chat_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.visitor_prepare_customer_chat TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.visitor_save_customer_reply TO anon, authenticated, service_role;
