-- Run against the migrated database. Fixtures and transactions are rolled back.
-- Nobody holding the public key reads a citizen's record or the event log; an owner reads their own citizen and no one else's.
begin;
insert into towns(id, name, seed) values ('private-test-town', 'Private test', 1);
-- signing up creates the owner, as it does in Supabase
insert into auth.users(id, email) values ('00000000-0000-4000-8000-00000000000a', 'a@test'), ('00000000-0000-4000-8000-00000000000b', 'b@test');
insert into owners(id) values ('00000000-0000-4000-8000-00000000000a'), ('00000000-0000-4000-8000-00000000000b') on conflict do nothing;
insert into agents(id, town_id, owner_id, name, persona, state) values
  ('private-test-mine', 'private-test-town', '00000000-0000-4000-8000-00000000000a', 'Mine', '{"secret":"s"}', '{"letters":["l"]}'),
  ('private-test-theirs', 'private-test-town', '00000000-0000-4000-8000-00000000000b', 'Theirs', '{"secret":"s"}', '{"letters":["l"]}');
insert into events(town_id, t, day, kind, actors, text, importance) values ('private-test-town', 1, 1, 'agent.letter', '{private-test-mine}', 'a letter home', 0.5);
do $$
declare n int;
begin
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename in ('agents', 'events') and qual = 'true') then raise exception 'citizens or events readable by anyone'; end if;
  execute 'set local role anon';
  select count(*) into n from agents; if n <> 0 then raise exception 'anon reads % citizens', n; end if;
  select count(*) into n from events; if n <> 0 then raise exception 'anon reads % events', n; end if;
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000a', true);
  execute 'set local role authenticated';
  select count(*) into n from agents; if n <> 1 then raise exception 'an owner reads % citizens, not just their own', n; end if;
  select count(*) into n from events; if n <> 0 then raise exception 'an owner reads % events directly', n; end if;
  execute 'reset role';
end $$;
rollback;
