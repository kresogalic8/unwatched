-- What the operator has spent since a moment, by model: what providers billed, and the tokens of calls they did not price
-- (the server prices those from its list). The engine reads it at start, so a restart does not reset the daily ceiling.
-- Owners' own keys are left out: they are not the operator's to cap.
create or replace function public.provider_spend_since(p_since timestamptz)
returns table(model text, billed numeric, unbilled_prompt bigint, unbilled_cached bigint, unbilled_completion bigint)
language sql stable security invoker set search_path=public as $$
 select u.model, coalesce(sum(u.cost_usd), 0),
   coalesce(sum(u.prompt_tokens) filter (where u.cost_usd is null), 0)::bigint,
   coalesce(sum(u.cached_tokens) filter (where u.cost_usd is null), 0)::bigint,
   coalesce(sum(u.completion_tokens) filter (where u.cost_usd is null), 0)::bigint
 from public.provider_usage u where u.created_at >= p_since and u.funding <> 'user_key' group by u.model;
$$;
revoke all on function public.provider_spend_since(timestamptz) from public, anon, authenticated;
grant execute on function public.provider_spend_since(timestamptz) to service_role;
