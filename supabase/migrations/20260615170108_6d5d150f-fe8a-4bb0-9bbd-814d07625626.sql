GRANT SELECT ON public.page_backgrounds TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.page_backgrounds TO authenticated;
GRANT ALL ON public.page_backgrounds TO service_role;

GRANT SELECT ON public.page_designs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.page_designs TO authenticated;
GRANT ALL ON public.page_designs TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.design_revisions TO authenticated;
GRANT ALL ON public.design_revisions TO service_role;

GRANT SELECT ON public.page_layouts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.page_layouts TO authenticated;
GRANT ALL ON public.page_layouts TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.page_layout_revisions TO authenticated;
GRANT ALL ON public.page_layout_revisions TO service_role;

GRANT SELECT ON public.theme_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.theme_settings TO authenticated;
GRANT ALL ON public.theme_settings TO service_role;

GRANT SELECT ON public.cities TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cities TO authenticated;
GRANT ALL ON public.cities TO service_role;

GRANT SELECT ON public.quarters TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quarters TO authenticated;
GRANT ALL ON public.quarters TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

GRANT SELECT, INSERT, DELETE ON public.team_messages TO authenticated;
GRANT ALL ON public.team_messages TO service_role;

DROP POLICY IF EXISTS "Authenticated can read team chat" ON public.team_messages;
DROP POLICY IF EXISTS "Authenticated can send team messages" ON public.team_messages;
DROP POLICY IF EXISTS "Sender can delete own team message" ON public.team_messages;

CREATE POLICY "Team members can read team chat"
ON public.team_messages
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'broker')
);

CREATE POLICY "Team members can send team messages"
ON public.team_messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'broker')
  )
);

CREATE POLICY "Team members can delete own team messages"
ON public.team_messages
FOR DELETE
TO authenticated
USING (
  sender_id = auth.uid()
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'broker')
  )
);

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team members can subscribe to team realtime" ON realtime.messages;

CREATE POLICY "Team members can subscribe to team realtime"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() IN ('team_messages', 'team-chat')
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'broker')
  )
);