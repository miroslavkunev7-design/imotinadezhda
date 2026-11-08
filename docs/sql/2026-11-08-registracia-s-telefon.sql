-- Регистрация на брокер с телефон и SMS код (прилага се в Supabase hyvwfsmjbaynozceookv след одобрение)
-- Само сървърът (service role) има достъп; кодът се пази като хеш, до 4 изпращания, 5 опита, 10 минути.
create table if not exists public.nd_reg_pending (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  name text not null,
  title text,
  user_id uuid,
  code_hash text,
  sent_at timestamptz,
  sends int not null default 0,
  attempts int not null default 0,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists nd_reg_pending_phone on public.nd_reg_pending(phone, created_at desc);
alter table public.nd_reg_pending enable row level security;
revoke all on public.nd_reg_pending from anon, authenticated;

create or replace function public.nd_reg_issue(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare r record; c text; b bytea;
begin
  select * into r from nd_reg_pending where id = p_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'Заявката не е намерена – започнете регистрацията отначало.'); end if;
  if r.verified_at is not null then return jsonb_build_object('ok', false, 'error', 'Профилът вече е потвърден.'); end if;
  if r.created_at < now() - interval '1 hour' then return jsonb_build_object('ok', false, 'error', 'Заявката е изтекла – започнете регистрацията отначало.'); end if;
  if r.sends >= 4 then return jsonb_build_object('ok', false, 'error', 'Изпратени са твърде много кодове. Опитайте по-късно.'); end if;
  if r.sent_at is not null and r.sent_at > now() - interval '45 seconds' then return jsonb_build_object('ok', false, 'error', 'Изчакайте малко преди нов код.', 'wait', 45); end if;
  b := gen_random_bytes(4);
  c := lpad(((get_byte(b, 0)::bigint << 24) + (get_byte(b, 1) << 16) + (get_byte(b, 2) << 8) + get_byte(b, 3)) % 1000000 || '', 6, '0');
  update nd_reg_pending set code_hash = encode(digest(c || ':' || id::text, 'sha256'), 'hex'), sent_at = now(), sends = sends + 1, attempts = 0 where id = p_id;
  return jsonb_build_object('ok', true, 'phone', r.phone, 'name', r.name, 'code', c);
end $$;

create or replace function public.nd_reg_check(p_id uuid, p_code text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare r record;
begin
  select * into r from nd_reg_pending where id = p_id for update;
  if not found or r.code_hash is null then return jsonb_build_object('ok', false, 'error', 'Първо поискайте код.'); end if;
  if r.verified_at is not null then return jsonb_build_object('ok', true, 'user_id', r.user_id, 'phone', r.phone, 'name', r.name, 'title', r.title, 'again', true); end if;
  if r.attempts >= 5 then return jsonb_build_object('ok', false, 'error', 'Твърде много грешни опити – поискайте нов код.'); end if;
  if r.sent_at < now() - interval '10 minutes' then return jsonb_build_object('ok', false, 'error', 'Кодът е изтекъл – поискайте нов.'); end if;
  if encode(digest(regexp_replace(coalesce(p_code, ''), '\D', '', 'g') || ':' || r.id::text, 'sha256'), 'hex') <> r.code_hash then
    update nd_reg_pending set attempts = attempts + 1 where id = p_id;
    return jsonb_build_object('ok', false, 'error', 'Грешен код. Остават ' || (4 - r.attempts) || ' опита.');
  end if;
  update nd_reg_pending set verified_at = now() where id = p_id;
  return jsonb_build_object('ok', true, 'user_id', r.user_id, 'phone', r.phone, 'name', r.name, 'title', r.title);
end $$;
revoke all on function public.nd_reg_issue(uuid) from public, anon, authenticated;
revoke all on function public.nd_reg_check(uuid, text) from public, anon, authenticated;
grant execute on function public.nd_reg_issue(uuid) to service_role;
grant execute on function public.nd_reg_check(uuid, text) to service_role;
