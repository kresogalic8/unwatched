# Learning from consequences

The first implemented learning domain is food purchasing. This is persistent experiential learning, not model-weight training or self-modifying code.

## Narrative memory and evidence

Model-authored decision memories and conversation interpretations are stored as `reflect`, not `obs`. Dialogue transcripts retain attribution and are stored as `rumor`: evidence that something was said does not establish its truth. Retrieval for decisions, conversations, planning, reflection and life summaries includes the existing memory kind and simulation minute. These kinds already survive file/Postgres persistence and island travel; no database migration is required.

When a citizen thinks or converses, the engine remembers the public damage/construction condition of their current place, at most once per identical condition per simulation day. It does not inspect remote locations or expose workplace stock. Perception explicitly distinguishes active damage from no active damage. Neither condition supplies unmodeled details about beams or roofs.

Nightly reflection receives up to 24 recent personal action records with event IDs, including rejected actions. Plans are explicitly described as intentions: the current scheduler's `done` flag means the step was reached or considered, not that its work was executed. A model's personal-goal completion remains self-reported; its public notice says so and includes `reported: true`. Real construction retains its separate engine-controlled completion.

This prevents new decision claims and dialogue summaries from being stored as observations by those paths; it is not a semantic truth verifier. Models can still generate incorrect interpretations. Existing legacy `obs` entries are retained and may contain old unsupported claims, so prompts explicitly warn that repetition is not corroboration. No old memories are silently rewritten or upgraded into verified evidence. The food-learning receipt rules below remain unchanged.

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

This deliberately isolated scenario proves a causal behavior difference. It does not claim improved survival or economics across arbitrary worlds. Future domains should add similarly verifiable outcomes before claiming broader self-evolution. Social food advice is implemented below. Invented routines, general skill acquisition and model-weight updates are not implemented here.


## Knowledge shared between citizens

`teach: {to, place, item}` shares the speaker's recent firsthand food-purchase experience with an awake citizen at the same location. The engine derives confidence and the source time; a model cannot manufacture receipts or turn received advice into personal experience. The same source observation cannot be shared to the same listener again. New observations may be shared at most once per source/item/listener each simulation day.

Received tips remain separate from purchase evidence. Up to 24 are retained per citizen; source evidence older than seven days cannot be taught or influence routines. Repetition does not refresh the source date. Among equally near affordable stocked counters, the most trusted current untested tip contributes less than one observation, with a two-day half-life. Trust at or below 0.2 gives it no influence. Duplicate speakers do not stack evidence. Existing own-brain messages remain valid; `self.food_advice` and the new action are additive.

A later personal purchase or local availability failure tests the most recently received current tip about that source. Agreement nudges trust by +0.04; disagreement by -0.06. A checked tip does not repeat its reward or penalty. Other pending tips about that source are retired without stacking trust changes. Insufficient money does not test availability. These are fallible availability tips: stock can change, and disagreement does not prove dishonesty. A listener who checks a tip now has their own experience they may teach onward.

Public profiles show what was explicitly shared, with the shared event ID and source date. Check results and trust changes from this mechanic remain owner-only. Both file and Postgres stores preserve personal evidence, advice and checks.

Run `pnpm --filter @unwatched/engine exec vitest run test/teaching.test.ts` for a controlled executed-route comparison, stale evidence, duplication, personal checks, trust, onward teaching and restart coverage.
