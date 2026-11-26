-- Календарът е личен: всеки брокер вижда само своите задачи (които е създал) и възложените на него (data.assignee).
-- Никой друг – и другите брокери – не ги вижда, не ги променя и не ги трие. Тед и сайтът работят с токена на служителя, затова важи и за тях.
drop policy if exists "nd staff all" on public.nd_events;
drop policy if exists "nd events own read" on public.nd_events;
drop policy if exists "nd events own insert" on public.nd_events;
drop policy if exists "nd events own update" on public.nd_events;
drop policy if exists "nd events own delete" on public.nd_events;
create policy "nd events own read" on public.nd_events for select to authenticated
  using (nd_is_staff() and (created_by = auth.uid() or data ->> 'assignee' = auth.uid()::text));
create policy "nd events own insert" on public.nd_events for insert to authenticated
  with check (nd_is_staff() and created_by = auth.uid());
create policy "nd events own update" on public.nd_events for update to authenticated
  using (nd_is_staff() and (created_by = auth.uid() or data ->> 'assignee' = auth.uid()::text))
  with check (nd_is_staff() and (created_by = auth.uid() or data ->> 'assignee' = auth.uid()::text));
create policy "nd events own delete" on public.nd_events for delete to authenticated
  using (nd_is_staff() and (created_by = auth.uid() or data ->> 'assignee' = auth.uid()::text));
