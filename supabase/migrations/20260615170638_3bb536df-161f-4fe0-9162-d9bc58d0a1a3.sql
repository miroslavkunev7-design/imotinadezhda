CREATE SCHEMA IF NOT EXISTS app_private;

CREATE OR REPLACE FUNCTION app_private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

REVOKE ALL ON FUNCTION app_private.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM authenticated;

ALTER POLICY "cities admin all" ON public.cities
USING (app_private.has_role(auth.uid(), 'admin'))
WITH CHECK (app_private.has_role(auth.uid(), 'admin'));

ALTER POLICY "design_revisions admin all" ON public.design_revisions
USING (app_private.has_role(auth.uid(), 'admin'))
WITH CHECK (app_private.has_role(auth.uid(), 'admin'));

ALTER POLICY "page_backgrounds admin write" ON public.page_backgrounds
USING (app_private.has_role(auth.uid(), 'admin'))
WITH CHECK (app_private.has_role(auth.uid(), 'admin'));

ALTER POLICY "page_designs admin all" ON public.page_designs
USING (app_private.has_role(auth.uid(), 'admin'))
WITH CHECK (app_private.has_role(auth.uid(), 'admin'));

ALTER POLICY "page_layout_revisions admin all" ON public.page_layout_revisions
USING (app_private.has_role(auth.uid(), 'admin'))
WITH CHECK (app_private.has_role(auth.uid(), 'admin'));

ALTER POLICY "page_layouts admin write" ON public.page_layouts
USING (app_private.has_role(auth.uid(), 'admin'))
WITH CHECK (app_private.has_role(auth.uid(), 'admin'));

ALTER POLICY "quarters admin all" ON public.quarters
USING (app_private.has_role(auth.uid(), 'admin'))
WITH CHECK (app_private.has_role(auth.uid(), 'admin'));

ALTER POLICY "Admins can delete theme" ON public.theme_settings
USING (app_private.has_role(auth.uid(), 'admin'));

ALTER POLICY "Admins can insert theme" ON public.theme_settings
WITH CHECK (app_private.has_role(auth.uid(), 'admin'));

ALTER POLICY "Admins can update theme" ON public.theme_settings
USING (app_private.has_role(auth.uid(), 'admin'))
WITH CHECK (app_private.has_role(auth.uid(), 'admin'));

ALTER POLICY "user_roles admin all" ON public.user_roles
USING (app_private.has_role(auth.uid(), 'admin'))
WITH CHECK (app_private.has_role(auth.uid(), 'admin'));

ALTER POLICY "Team members can read team chat" ON public.team_messages
USING (
  app_private.has_role(auth.uid(), 'admin')
  OR app_private.has_role(auth.uid(), 'broker')
);

ALTER POLICY "Team members can send team messages" ON public.team_messages
WITH CHECK (
  sender_id = auth.uid()
  AND (
    app_private.has_role(auth.uid(), 'admin')
    OR app_private.has_role(auth.uid(), 'broker')
  )
);

ALTER POLICY "Team members can delete own team messages" ON public.team_messages
USING (
  sender_id = auth.uid()
  AND (
    app_private.has_role(auth.uid(), 'admin')
    OR app_private.has_role(auth.uid(), 'broker')
  )
);

ALTER POLICY "Team members can subscribe to team realtime" ON realtime.messages
USING (
  realtime.topic() IN ('team_messages', 'team-chat')
  AND (
    app_private.has_role(auth.uid(), 'admin')
    OR app_private.has_role(auth.uid(), 'broker')
  )
);