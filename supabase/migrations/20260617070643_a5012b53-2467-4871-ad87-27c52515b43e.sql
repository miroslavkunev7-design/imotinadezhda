DROP POLICY IF EXISTS "Team members can subscribe to team realtime" ON realtime.messages;
DROP POLICY IF EXISTS "Admins can subscribe to customer chat realtime" ON realtime.messages;
DROP POLICY IF EXISTS "Admins can subscribe to property matches realtime" ON realtime.messages;

CREATE POLICY "Team members can subscribe to team realtime"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() IN ('team_messages', 'team-chat')
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'broker'::public.app_role)
  )
);

CREATE POLICY "Admins can subscribe to customer chat realtime"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() IN ('admin-chats', 'customer_chats', 'customer_chat_messages')
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Admins can subscribe to property matches realtime"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() = 'property_matches'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);