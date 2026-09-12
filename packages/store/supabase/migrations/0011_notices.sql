-- The morning mail and the read watermark. What an owner asked to be told, and where their reading of each citizen stands.
create table if not exists owner_prefs (
  owner_id text primary key,                  -- auth user id, or a dev name locally
  notify_digest boolean not null default true,  -- the written digest at seven each island morning
  notify_letters boolean not null default true, -- a note when their citizen writes home
  last_mailed_day integer,                      -- the island day the last morning digest went out, so it never goes twice
  updated_at timestamptz not null default now()
);
create table if not exists owner_reads (
  owner_id text not null,
  agent_id text not null references agents(id) on delete cascade,
  last_digest_t bigint,                         -- the sim minute the owner last opened the digest; the next one starts here
  last_letter_mail_day integer,                 -- the island day a letter notice last went out for this citizen
  updated_at timestamptz not null default now(),
  primary key (owner_id, agent_id)
);
alter table owner_prefs enable row level security;
alter table owner_reads enable row level security;
create policy "prefs are the owner's" on owner_prefs for select using (owner_id = auth.uid()::text);
create policy "reads are the owner's" on owner_reads for select using (owner_id = auth.uid()::text);
-- The engine writes both with the service role.
