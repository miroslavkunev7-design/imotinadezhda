DROP POLICY IF EXISTS "Authenticated can read team chat" ON public.team_messages;
CREATE POLICY "Staff can read team chat"
ON public.team_messages
FOR SELECT
TO authenticated
USING (public.is_crm_staff(auth.uid()));

DROP POLICY IF EXISTS "Authenticated can send team messages" ON public.team_messages;
CREATE POLICY "Staff can send team messages"
ON public.team_messages
FOR INSERT
TO authenticated
WITH CHECK (sender_id = auth.uid() AND public.is_crm_staff(auth.uid()));