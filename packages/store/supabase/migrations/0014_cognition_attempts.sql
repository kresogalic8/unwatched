create table public.cognition_attempts (
 id uuid primary key default gen_random_uuid(), agent_id text, kind text not null, outcome text not null,
 funding text not null, island_minute bigint not null, duration_ms integer not null,
 created_at timestamptz not null default now()
);
create index cognition_agent_time on public.cognition_attempts(agent_id,created_at desc);
alter table public.cognition_attempts enable row level security;
revoke all on public.cognition_attempts from anon,authenticated;
grant all on public.cognition_attempts to service_role;
