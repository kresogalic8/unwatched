create table public.owner_telegram (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  chat_id text unique,
  chat_name text,
  agent_ids text[] not null default '{}',
  pair_hash text unique,
  pair_expires timestamptz,
  pending_chat text,
  pending_name text
);
alter table public.owner_telegram enable row level security;
revoke all on public.owner_telegram from anon, authenticated;
grant all on public.owner_telegram to service_role;

-- One-time claim, followed by confirmation in the signed-in account.
create function public.claim_telegram_pair(p_hash text, p_chat text, p_name text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update owner_telegram set pending_chat=p_chat, pending_name=left(p_name,120), pair_hash=null
  where pair_hash=p_hash and pair_expires>now();
  return found;
end; $$;
revoke all on function public.claim_telegram_pair(text,text,text) from public, anon, authenticated;
grant execute on function public.claim_telegram_pair(text,text,text) to service_role;
