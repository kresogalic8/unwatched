create or replace function public.resume_waiting_citizen(p_agent jsonb)
returns void language plpgsql security invoker set search_path=public as $$
declare a public.agents%rowtype; saved jsonb;
begin
 a := jsonb_populate_record(null::public.agents,p_agent);
 select snapshot into saved from public.waiting_citizens where agent_id=a.id and owner_id=a.owner_id and town_id=a.town_id for update;
 if saved is null then raise exception 'Citizen is not waiting for this owner'; end if;
 insert into public.memories(agent_id,town_id,t,kind,text,importance)
 select a.id,a.town_id,(m->>'t')::bigint,m->>'kind',m->>'text',(m->>'importance')::real
 from jsonb_array_elements(saved->'memory') m
 where not exists(select 1 from public.memories x where x.agent_id=a.id and x.t=(m->>'t')::bigint and x.kind=m->>'kind' and x.text=m->>'text');
 insert into public.relationships(agent_id,town_id,other_id,trust,affection,last_seen,opinion)
 select a.id,a.town_id,r->>'other',(r->>'trust')::real,(r->>'affection')::real,(r->>'lastSeen')::bigint,r->>'opinion'
 from jsonb_array_elements(saved->'relationships') r where exists(select 1 from public.agents x where x.id=r->>'other')
 on conflict(agent_id,other_id) do update set trust=excluded.trust,affection=excluded.affection,last_seen=excluded.last_seen,opinion=excluded.opinion;
 update public.agents set state=a.state,brain=a.brain,funded=a.funded,appearance=a.appearance where id=a.id and owner_id=a.owner_id and town_id=a.town_id;
 delete from public.waiting_citizens where agent_id=a.id;
end;
$$;
revoke all on function public.resume_waiting_citizen(jsonb) from public,anon,authenticated;
grant execute on function public.resume_waiting_citizen(jsonb) to service_role;
