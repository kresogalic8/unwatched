# Paired workshop decision benchmark

Open `/experiments/workshop` in development. Start the web server, then run from `apps/server`:

```sh
node --env-file=../../.env --env-file=/path/to/private-jev.env --import tsx scripts/workshop-preview.ts
```

Requires `OPENROUTER_API_KEY` and `TYPESAFE_API_KEY`. Keys stay server-side. No production data, subscriber brain, or persistent world is modified.

Two independent towns restore the same initial snapshot, with five fictional personas, inventory and relationships. Identical scheduled inputs occur at each round: additional roof damage, a plank delivery, and the final observation window. Each lane's subsequent state diverges according to its decisions.

Baseline calls the existing `OpenRouterBrain.decide` at tier 1 with the configured routine model. Hybrid uses Jev's constrained small-action choices, escalating low-confidence (<0.65) or open-ended choices to that same brain. The threshold is experimental. There is no synthetic fallback.

This is a **four-round decision benchmark**, not a full simulated day. It does not reproduce production cadence or free habit ticks. Free-form `do` adjudication and `talk` conversations are deferred and counted, rather than silently completed. Their downstream costs are therefore not represented. This limitation prevents drawing conclusions about full-day savings or social quality.

Run starts automatic rounds. Pause stops after the in-flight decision; no overlapping loops. Maximum 40 physical LLM attempts (including retries), 100 Jev attempts, and a stop-before-next-LLM-call threshold of $0.50 in reported LLM usage. That threshold is not a guaranteed invoice ceiling: a call can exceed it, and failed calls may have unknown billing. Jev also has its input-size and conservative reservation guards. Process restarts reset session caps.

UI reports provider LLM usage plus token-priced Jev estimates, waiting/repeated actions, failures/deferred actions, actual gifts, crafting and repairs. An unreported provider attempt makes total cost unknown. API failure stops automatic progression. No blanket savings claim is generated from unknown totals. Event count is not a quality or retention metric.

Typechecks: `pnpm typecheck` and `pnpm exec tsc -p apps/server/scripts/tsconfig.json`. Adapter tests: `pnpm --filter @unwatched/cognition test`.

## First paired run — 21 September 2026

Stopped after three attempted decisions per lane, before completing round one. Baseline: $0.0203542 reported, three executed decisions. Hybrid: $0.0209692 LLM plus $0.000132384 estimated Jev cost; two executed decisions, one schema failure. All three Jev decisions escalated (confidence 55%, 36%, 37%). Neither lane repaired, crafted, or gifted anything. This partial run does not demonstrate savings or better behavior.

The Anthropic structured-output endpoint rejected the current action schema's 31 optional properties (limit 24). The adapter now retains schema prompting and local Zod validation for such large Anthropic schemas; smaller schemas still request structured output. The partial run also exposed remaining model response reliability problems. Fixing those and designing narrower Jev decisions are prerequisites to a useful longer comparison.
