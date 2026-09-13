create table public.provider_usage (
 id uuid primary key default gen_random_uuid(),
 created_at timestamptz not null default now(),
 agent_id text,
 funding text not null check(funding in ('world','subscriber','user_key')),
 kind text not null,
 model text not null,
 prompt_tokens integer not null,
 completion_tokens integer not null,
 cached_tokens integer not null,
 cost_usd numeric
);
create index provider_usage_time on public.provider_usage(created_at desc);
create index provider_usage_agent_time on public.provider_usage(agent_id,created_at desc);
alter table public.provider_usage enable row level security;
revoke all on public.provider_usage from anon,authenticated;
grant all on public.provider_usage to service_role;

create or replace function public.provider_usage_summary()
returns table(agent_id text,funding text,calls bigint,cost_usd numeric,unknown_cost_calls bigint,prompt_tokens bigint,completion_tokens bigint,cached_tokens bigint)
language sql stable security invoker set search_path=public as $$
 select u.agent_id,u.funding,count(*),sum(u.cost_usd),count(*) filter(where u.cost_usd is null),sum(u.prompt_tokens)::bigint,sum(u.completion_tokens)::bigint,sum(u.cached_tokens)::bigint
 from public.provider_usage u where u.created_at>=now()-interval '24 hours'
 group by u.agent_id,u.funding order by sum(u.cost_usd) desc nulls last;
$$;
revoke all on function public.provider_usage_summary() from public,anon,authenticated;
grant execute on function public.provider_usage_summary() to service_role;
