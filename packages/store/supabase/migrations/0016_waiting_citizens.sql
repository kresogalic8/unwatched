create table if not exists public.waiting_citizens (
  agent_id text primary key references public.agents(id) on delete cascade,
  town_id text not null references public.towns(id),
  owner_id uuid not null,
  snapshot jsonb not null,
  parked_at timestamptz not null default now()
);
alter table public.waiting_citizens enable row level security;
revoke all on public.waiting_citizens from anon,authenticated;
grant all on public.waiting_citizens to service_role;
create or replace function public.resume_waiting_citizen(p_agent jsonb)
returns void language plpgsql security invoker set search_path=public as $$
declare a public.agents%rowtype;
begin
 a := jsonb_populate_record(null::public.agents,p_agent);
 if not exists(select 1 from public.waiting_citizens where agent_id=a.id and owner_id=a.owner_id and town_id=a.town_id) then raise exception 'Citizen is not waiting for this owner'; end if;
 update public.agents set state=a.state,brain=a.brain,funded=a.funded,appearance=a.appearance where id=a.id and owner_id=a.owner_id and town_id=a.town_id;
 delete from public.waiting_citizens where agent_id=a.id;
end;
$$;
revoke all on function public.resume_waiting_citizen(jsonb) from public,anon,authenticated;
grant execute on function public.resume_waiting_citizen(jsonb) to service_role;
