-- Preserve existing credit behavior; new accounts must enable extra spending explicitly.
create table public.credit_settings (
 owner_id text primary key,
 auto_spend boolean not null default false,
 daily_limit integer check(daily_limit >= 0),
 updated_at timestamptz not null default now()
);
insert into public.credit_settings(owner_id,auto_spend) select owner_id,true from public.owner_wallets;
alter table public.credit_settings enable row level security;
revoke all on public.credit_settings from anon,authenticated;
grant all on public.credit_settings to service_role;
alter table public.credit_ledger add column operation_id uuid;
alter table public.credit_ledger add column refund_of uuid;
create unique index credit_operation_once on public.credit_ledger(operation_id) where operation_id is not null;
create unique index credit_refund_once on public.credit_ledger(refund_of) where refund_of is not null;

create function public.change_credits(p_owner text,p_delta integer,p_reason text,p_ref text,p_operation uuid,p_refund uuid default null)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare w public.owner_wallets%rowtype; settings public.credit_settings%rowtype; previous public.credit_ledger%rowtype; spent integer; amount integer;
begin
 if p_operation is null or p_owner is null or p_delta is null or p_delta=0 then raise exception 'Invalid credit operation'; end if;
 insert into public.owner_wallets(owner_id,plan,credits) values(p_owner,'none',0) on conflict do nothing;
 select * into w from public.owner_wallets where owner_id=p_owner for update;
 select * into previous from public.credit_ledger where operation_id=p_operation;
 if found then
  if previous.owner_id<>p_owner or previous.delta<>p_delta or previous.reason<>p_reason or previous.ref is distinct from p_ref or previous.refund_of is distinct from p_refund then raise exception 'Credit operation mismatch'; end if;
  return jsonb_build_object('ok',true,'credits',w.credits);
 end if;
 -- Stripe delivery can use a different event ID for the same paid checkout.
 if p_reason='purchase' and p_ref is not null and exists(select 1 from public.credit_ledger where owner_id=p_owner and reason='purchase' and ref=p_ref) then
  return jsonb_build_object('ok',true,'credits',w.credits);
 end if;
 amount:=p_delta;
 if p_refund is not null then
  select * into previous from public.credit_ledger where operation_id=p_refund and owner_id=p_owner and delta<0;
  if not found or p_delta<>-previous.delta or p_reason<>'failed-thought-refund' then raise exception 'Invalid credit refund'; end if;
  if exists(select 1 from public.credit_ledger where refund_of=p_refund) then return jsonb_build_object('ok',true,'credits',w.credits); end if;
 elsif amount<0 then
  select * into settings from public.credit_settings where owner_id=p_owner;
  if not coalesce(settings.auto_spend,false) then return jsonb_build_object('ok',false,'credits',w.credits); end if;
  -- Refunds reverse the original debit's day, including refunds after midnight.
  select coalesce(-sum(l.delta),0) into spent from public.credit_ledger l
   where l.owner_id=p_owner and l.delta<0 and l.created_at >= date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'
   and not exists(select 1 from public.credit_ledger r where r.refund_of=l.operation_id);
  if w.credits+amount<0 or (settings.daily_limit is not null and spent-amount>settings.daily_limit) then
   return jsonb_build_object('ok',false,'credits',w.credits);
  end if;
 end if;
 update public.owner_wallets set credits=credits+amount,updated_at=now() where owner_id=p_owner returning * into w;
 insert into public.credit_ledger(owner_id,delta,reason,ref,operation_id,refund_of) values(p_owner,amount,p_reason,p_ref,p_operation,p_refund);
 return jsonb_build_object('ok',true,'credits',w.credits);
end;
$$;
revoke all on function public.change_credits(text,integer,text,text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.change_credits(text,integer,text,text,uuid,uuid) to service_role;

create function public.credit_spending(p_owner text) returns jsonb language sql security invoker set search_path=public as $$
 select jsonb_build_object('autoSpend',coalesce((select auto_spend from credit_settings where owner_id=p_owner),false),
 'dailyLimit',(select daily_limit from credit_settings where owner_id=p_owner),
 'spentToday',coalesce((select -sum(l.delta) from credit_ledger l where l.owner_id=p_owner and l.delta<0 and l.created_at >= date_trunc('day',now() at time zone 'UTC') at time zone 'UTC' and not exists(select 1 from credit_ledger r where r.refund_of=l.operation_id)),0),
 'resetsAt',date_trunc('day',now() at time zone 'UTC') at time zone 'UTC' + interval '1 day');
$$;
revoke all on function public.credit_spending(text) from public,anon,authenticated;
grant execute on function public.credit_spending(text) to service_role;

-- One ordinary citizen per account subscription. Existing additional citizens retain their benefit.
create table public.subscription_citizens (
 agent_id text primary key,
 owner_id text not null,
 grandfathered boolean not null default false,
 subscription_id text,
 created_at timestamptz not null default now()
);
create unique index subscription_single_citizen on public.subscription_citizens(owner_id) where not grandfathered;
insert into public.subscription_citizens(agent_id,owner_id,grandfathered)
 select id,owner_id,n>1 from (
 select a.id,a.owner_id::text, row_number() over(partition by a.owner_id order by a.arrived_t nulls last,a.id) n
 from public.agents a join public.owner_wallets w on a.owner_id::text=w.owner_id
 where w.plan<>'none' and a.brain='hosted' and a.left_t is null
 and not exists(select 1 from public.waiting_citizens x where x.agent_id=a.id)
 ) current_citizens;
alter table public.subscription_citizens enable row level security;
revoke all on public.subscription_citizens from anon,authenticated;
grant all on public.subscription_citizens to service_role;
create function public.claim_subscription_citizen(p_owner text,p_agent text,p_subscription text default null)
returns void language plpgsql security invoker set search_path=public as $$
declare bound public.subscription_citizens%rowtype;
begin
 perform 1 from public.owner_wallets where owner_id=p_owner and plan<>'none' for update;
 if not found then raise exception 'An active subscription is required'; end if;
 select * into bound from public.subscription_citizens where agent_id=p_agent;
 if found then
  if bound.owner_id<>p_owner then raise exception 'Citizen belongs to another subscription'; end if;
  update public.subscription_citizens set subscription_id=coalesce(p_subscription,subscription_id) where agent_id=p_agent;
  return;
 end if;
 delete from public.subscription_citizens s using public.agents a where s.agent_id=a.id and s.owner_id=p_owner and not s.grandfathered and a.left_t is not null and not exists(select 1 from public.waiting_citizens w where w.agent_id=a.id);
 if exists(select 1 from public.subscription_citizens where owner_id=p_owner and not grandfathered) then
  raise exception 'Your subscription is already assigned to a citizen. Use your own key or external brain for another citizen.';
 end if;
 insert into public.subscription_citizens(agent_id,owner_id,subscription_id) values(p_agent,p_owner,p_subscription);
end;
$$;
revoke all on function public.claim_subscription_citizen(text,text,text) from public,anon,authenticated;
grant execute on function public.claim_subscription_citizen(text,text,text) to service_role;

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
 if a.brain='hosted' and a.owner_id is not null then perform public.claim_subscription_citizen(a.owner_id::text,a.id); end if;
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

create or replace function public.resume_waiting_citizen(p_agent jsonb)
returns void language plpgsql security invoker set search_path=public as $$
declare a public.agents%rowtype; saved jsonb;
begin
 a := jsonb_populate_record(null::public.agents,p_agent);
 select snapshot into saved from public.waiting_citizens where agent_id=a.id and owner_id=a.owner_id and town_id=a.town_id for update;
 if saved is null then
  if exists(select 1 from public.agents where id=a.id and owner_id=a.owner_id and town_id=a.town_id and brain=a.brain and funded) then return; end if;
  raise exception 'Citizen is not waiting for this owner';
 end if;
 if a.brain='hosted' and a.owner_id is not null then perform public.claim_subscription_citizen(a.owner_id::text,a.id); end if;
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

create function public.subscription_available(p_owner text,p_agent text) returns boolean language sql security invoker set search_path=public as $$
 select exists(select 1 from subscription_citizens where owner_id=p_owner and agent_id=p_agent)
 or not exists(select 1 from subscription_citizens s where s.owner_id=p_owner and not s.grandfathered
 and not exists(select 1 from agents a where a.id=s.agent_id and a.left_t is not null and not exists(select 1 from waiting_citizens w where w.agent_id=a.id)));
$$;
revoke all on function public.subscription_available(text,text) from public,anon,authenticated;
grant execute on function public.subscription_available(text,text) to service_role;
