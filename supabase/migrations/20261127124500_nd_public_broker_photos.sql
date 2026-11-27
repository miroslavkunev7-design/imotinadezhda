-- Снимката на брокера се вижда в публичния сайт (при имотите му): само текущата снимка от картата му, нищо друго от brokers/.
create or replace function public.nd_is_broker_photo(p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from nd_brokers b where coalesce((b.data ->> 'active')::boolean, true)
                  and (b.data ->> 'photo' = p_name or b.data ->> 'thumb' = p_name))
$$;
grant execute on function public.nd_is_broker_photo(text) to anon, authenticated;
create policy "nd public broker photos" on storage.objects for select to anon, authenticated
  using (bucket_id = 'nd-files' and name like 'brokers/%' and public.nd_is_broker_photo(name));
