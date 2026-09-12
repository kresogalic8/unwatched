# Learning from consequences

The first implemented learning domain is food purchasing. This is persistent experiential learning, not model-weight training or self-modifying code.

The engine records a successful purchase only after validation, inventory transfer and payment. Each receipt keeps simulation time, paid cost and the public event ID. An attempted local food purchase that fails because the item is not for sale records a private availability observation. Lack of money, remote-shop mistakes and person-to-person trades do not teach a shop-availability lesson. Repeated unavailable attempts within an hour count once.

Each citizen retains up to 24 place/item lessons and 16 observations per lesson. Confidence uses a neutral Beta(1,1) prior with evidence weights halving every seven simulation days. Contrary evidence can reverse a preference. Confidence estimates purchase availability, not skill, intelligence or the probability of overall task success.

## Effect on decisions

The existing food routine still checks hunger, shifts, live stock, affordability and road distance. Among equally near affordable shops it prefers better recent evidence; an unlearned tie retains the previous market-first ordering. Current stock can immediately override experience. The LLM also receives `self.learned_food` in its optional perception fields and may choose differently.

When a habit-driven move actually takes a different road from the learning-off food routine, the engine stores a bounded owner-only decision record: time, origin, actual next step, baseline destination and learned destination. A plan overriding the move does not earn a record. This proves a changed executed step, not arrival or subsequent purchase. Up to 20 such records survive snapshots.

## What visitors see

The agent profile's “Observed routines” section shows only public successful receipts, their times, costs and event IDs. The owner additionally sees unavailable observations and executed decision comparisons. These fields are projected separately: no private model reasoning or rejected-action payload is published. Counts refer to retained recent evidence, not lifetime totals. Event IDs remain provenance references even after the rolling event feed expires.

## Reproduce the comparison

```sh
pnpm --filter @unwatched/engine exec vitest run test/learning.test.ts
pnpm --filter @unwatched/server exec vitest run test/learning.test.ts
```

The controlled route scenario gives one citizen successful bakery receipts, then places them at a junction with equally distant, stocked, affordable market and bakery counters. With `Town({ seed: 7, brain, learning: false })` the actual next location is the market; with learning it is the bakery. Emptying the bakery makes the food routine choose the market again. Tests also cover evidence decay, reversal, bounded storage, restart compatibility, model perception and public privacy.

This deliberately isolated scenario proves a causal behavior difference. It does not claim improved survival or economics across arbitrary worlds. Future domains should add similarly verifiable outcomes before claiming broader self-evolution. Teaching, invented routines, general skill acquisition and model-weight updates are not implemented here.
