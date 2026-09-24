-- A citizen's record is theirs and their owner's. `agents.persona` carries their secret and `agents.state` their letters,
-- standing instructions, debts and plans; `events` carries private kinds (letters, reflections, plans) with owner ids in
-- their text. Both were readable by anyone holding the public anon key. The web reads the town through the server, which
-- uses the service role, so neither table needs a public policy: owners may read their own citizens, and nobody reads
-- events directly. What the public may see (the paper, the laws, the town) stays public.
drop policy if exists "agents are public" on agents;
drop policy if exists "events are public" on events;
create policy "owners see their own citizens" on agents for select using (owner_id = auth.uid());
