-- Private back-office records. Only the server service role can access these tables.
create table public.ops_members (
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null check(role in ('viewer','operator','admin')),
 created_at timestamptz not null default now()
);
create table public.feedback_reports (
 id uuid primary key default gen_random_uuid(), owner_id uuid references auth.users(id) on delete set null,
 category text not null check(category in ('bug','idea','help','praise')),
 title text not null check(length(title) between 3 and 160), description text not null check(length(description) between 10 and 5000),
 email text, page text not null default '/', version text, browser text, agent_id text,
 screenshot text, status text not null default 'new' check(status in ('new','reviewing','planned','in_progress','resolved','closed')),
 severity text not null default 'normal' check(severity in ('low','normal','high','urgent')),
 assignee uuid references public.ops_members(user_id), duplicate_of uuid references public.feedback_reports(id),
 github_url text, rate_key text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(duplicate_of is null or duplicate_of <> id), check(screenshot is null or length(screenshot)<1500000)
);
create index feedback_created on public.feedback_reports(created_at desc);
create index feedback_owner on public.feedback_reports(owner_id,created_at desc);
create index feedback_rate on public.feedback_reports(rate_key,created_at desc);
create table public.feedback_messages (
 id uuid primary key default gen_random_uuid(), report_id uuid not null references public.feedback_reports(id) on delete cascade,
 author_id uuid references auth.users(id) on delete set null, internal boolean not null default false,
 body text not null check(length(body) between 1 and 5000), created_at timestamptz not null default now()
);
create index feedback_message_report on public.feedback_messages(report_id,created_at);
create table public.ops_audit (
 id uuid primary key default gen_random_uuid(), actor text not null, action text not null, target text,
 detail jsonb not null default '{}', outcome text not null default 'requested', created_at timestamptz not null default now()
);
create table public.delivery_attempts (
 id uuid primary key default gen_random_uuid(), channel text not null, kind text not null,
 owner_id text, agent_id text, status text not null, provider_id text, error text,
 retry_of uuid references public.delivery_attempts(id), created_at timestamptz not null default now()
);
create index delivery_created on public.delivery_attempts(created_at desc);
create index audit_created on public.ops_audit(created_at desc);
do $$ declare t text; begin
 foreach t in array array['ops_members','feedback_reports','feedback_messages','ops_audit','delivery_attempts'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
-- Serialize submissions per identity so parallel requests cannot bypass the rate limit.
create function public.submit_feedback(p jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare report_id uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended(p->>'rate_key',0));
 if (select count(*) from feedback_reports where rate_key=p->>'rate_key' and created_at>now()-interval '1 hour')>=5 then raise exception 'feedback_rate_limit'; end if;
 insert into feedback_reports(owner_id,category,title,description,email,page,version,browser,agent_id,screenshot,rate_key)
 values((p->>'owner_id')::uuid,p->>'category',p->>'title',p->>'description',p->>'email',p->>'page',p->>'version',p->>'browser',p->>'agent_id',p->>'screenshot',p->>'rate_key') returning id into report_id;
 return report_id;
end $$;
revoke all on function public.submit_feedback(jsonb) from public,anon,authenticated;
grant execute on function public.submit_feedback(jsonb) to service_role;
create table public.delivery_jobs (
 id uuid primary key default gen_random_uuid(), payload jsonb not null, status text not null default 'pending',
 owner_id text, agent_id text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.delivery_jobs enable row level security;
revoke all on public.delivery_jobs from anon,authenticated;
grant all on public.delivery_jobs to service_role;
alter table public.delivery_attempts add column job_id uuid references public.delivery_jobs(id);
