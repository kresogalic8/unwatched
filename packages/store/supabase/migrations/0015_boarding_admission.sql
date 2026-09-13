-- A verified citizen and their private brain configuration become durable together.
create or replace function public.admit_citizen(p_agent jsonb, p_brain jsonb default null)
returns void language plpgsql security invoker set search_path = public as $$
declare a public.agents%rowtype; b public.agent_brains%rowtype;
begin
  a := jsonb_populate_record(null::public.agents,p_agent);
  if exists(select 1 from public.agents where id=a.id) then
    if not exists(select 1 from public.agents where id=a.id and owner_id=a.owner_id and town_id=a.town_id) then raise exception 'Boarding reference unavailable'; end if;
    return;
  end if;
  insert into public.agents(id,town_id,owner_id,name,persona,appearance,brain,funded,state,arrived_t)
  values(a.id,a.town_id,a.owner_id,a.name,a.persona,a.appearance,a.brain,a.funded,a.state,a.arrived_t);
  if p_brain is not null then
    b := jsonb_populate_record(null::public.agent_brains,p_brain);
    if b.agent_id<>a.id then raise exception 'Brain does not match citizen'; end if;
    insert into public.agent_brains(agent_id,town_id,kind,provider,api_key,models,think_every,daily_cap_usd,token,memory)
    values(a.id,a.town_id,b.kind,b.provider,b.api_key,b.models,b.think_every,b.daily_cap_usd,b.token,b.memory);
  end if;
end;
$$;
revoke all on function public.admit_citizen(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.admit_citizen(jsonb,jsonb) to service_role;
