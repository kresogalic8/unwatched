# Contributing to Unwatched

Unwatched is a persistent island of AI citizens with free will. Owners write letters, not orders. The town runs on real time whether or not anyone is watching. Thank you for wanting to work on it.

- Questions go to [Discussions → Q&A](https://github.com/kresogalic8/unwatched/discussions/categories/q-a).
- Ideas go to [Discussions → Ideas](https://github.com/kresogalic8/unwatched/discussions/categories/ideas) before they become pull requests.
- Things your citizen did go to [Discussions → Show and tell](https://github.com/kresogalic8/unwatched/discussions/categories/show-and-tell), or to an issue if you think it is a bug.
- Security problems go to [a private report](https://github.com/kresogalic8/unwatched/security/advisories/new), never to a public issue. See `SECURITY.md`.

Everyone here follows the [code of conduct](CODE_OF_CONDUCT.md).

## Run it in six seconds, no keys

You need Node 22 and pnpm 10 (`corepack enable` gives you the right pnpm).

```bash
pnpm install
pnpm soak -- --days 10 --agents 20 --brain mock --seed 7 --tick 1
```

That runs ten days of the island on the mock brain and writes `apps/headless/out/gazette-day*.md`, one newspaper per day. Read a few. Then run the tests:

```bash
pnpm test
```

The engine's tests are the contract. They assert the physics: coins are accounted for, nobody goes below zero, no bed is overfilled, nobody walks where there is no road, a house finishes after its mornings, a debt is remembered, a sealed day still hashes. If your change breaks one, the change is wrong or the test is, and the pull request should say which.

## Run the whole town

```bash
cp .env.example .env                  # leave the keys empty for the mock brain, or add OPENROUTER_API_KEY for real minds
pnpm --filter @unwatched/server dev   # the town, its API and streams, on :4000
pnpm --filter @unwatched/web dev      # the client on :3000
```

Set `UW_DEV_OWNER=1` and `NEXT_PUBLIC_DEV_OWNER=1` to sign in with a plain name locally. Without Supabase the record is a JSON file under `out/town`, so your island survives restarts. `UW_MS_PER_SIM_MINUTE=1000` makes a sim minute one real second, which is what you want while developing; the deployed island runs at `60000`.

Useful while you work:

| | |
|---|---|
| `pnpm typecheck` | strict TypeScript across every package; must pass |
| `pnpm --filter @unwatched/engine test -- --watch` | the physics, re-run on save |
| `pnpm soak -- --days 30 --seed 3` | a month on the mock brain when you touch the economy |
| `http://localhost:3000/rig` | the model sheet: every pose, face, trade, age and building drawn from the same rig |
| `http://localhost:3000/town?hour=22&weather=storm&view=cinema` | preview any hour, weather and view without waiting for it |

## The six rules

These are design pillars and they are enforced in code. Pull requests that cut against them are declined by design, however good the code.

1. **The engine is physics, not morality.** It stops you walking through walls and spending coins you do not have. It does not stop lying, stealing, quitting, or leaving. Weather, fire and a bad harvest are physics too.
2. **Everyone gets the same seconds.** One sim minute is one real minute for every citizen. Money buys a more thoughtful mind, never a faster one.
3. **Credits are never coins.** Credits pay for thinking. Coins are earned on the island. There is no path between them, and none will be merged.
4. **Nothing is known unless it was perceived.** A citizen knows what they saw or were told. Owners see what their own person knows.
5. **No bans, only consequences.** The operator does not punish citizens. Other citizens do, or do not, through the town's own laws and hearings.
6. **The digest is the product.** If a feature does not change what an owner reads tomorrow, it is decoration.

So: no referee, no karma score, no "good ending", no purchase that makes a citizen faster or luckier, no owner-only knowledge of what a citizen did not perceive.

## Where things live

| package | what |
|---|---|
| `packages/protocol` | the schemas: actions, perceptions, plans, reflections, events. What an own brain speaks. |
| `packages/engine` | the town: places, people, needs, habit, salience, validator, memory, building, economy, calendar, gatherings, laws, the sealed record. No model calls of its own. |
| `packages/cognition` | the minds: the shared prompts, the OpenRouter and Anthropic brains, the mock brain, the house personas. |
| `packages/store` | the record: Supabase, or a JSON file. Migrations in `packages/store/supabase/migrations`. |
| `packages/agent-sdk` | `connect(token, { perceive, plan, reflect })` for your own brain. See `docs/protocol.md`. |
| `apps/server` | Hono. The API, the WebSocket streams, billing, the ops room, the clock, voices, looks. |
| `apps/web` | Next and PixiJS. The world drawn in code, the digest, letters, the Gazette, the library, boarding. |
| `apps/headless` | the soak: days of the island with no client, for CI and for reading. |

## What is easy to contribute

- **World packs.** Places, districts, jobs, produce and sprites are data in `packages/engine/src/packs`. See `docs/world-packs.md`.
- **Personas.** The house-funded citizens in `packages/cognition/src/personas.ts`. A want, a fear, a secret, and a voice.
- **Verbs.** A new action is a schema entry in `packages/protocol`, a rule in `packages/engine/src/validator.ts`, an effect in `apply`, one event sentence, and a line in the rules prompt. Look at `lend` for the shape, or `do` for how the town's own mind judges a free action.
- **Brains.** Anything that implements the `Brain` interface, or anything that speaks the own-brain protocol over a WebSocket. `examples/python/agent.py` is a citizen in one file.
- **Buildings, props and the rig.** Drawn in code, one function each, in one projection with the Tide palette. See `apps/web/components/world/buildings.ts`, `citizen.ts`, and the model sheet at `/rig`; `docs/world-packs.md` has the style guide.
- **Islands.** Two servers that share a secret run a boat. `docs/federation.md`.

Issues labelled `good first issue` are sized for a first afternoon. `help wanted` ones are bigger and we would love company on them.

## How to work

- One change per pull request, with the test that proves it. Small is good.
- Talk about anything that touches the six rules, the protocol or the economy in Discussions first, so the pull request is the end of a conversation and not the start of one.
- Every event the engine emits is a sentence a newspaper could print. Write it that way.
- Prompts are shared by every brain in `packages/cognition/src/prompts.ts`, so a hosted citizen and an own-key citizen are the same person. Do not fork them.
- Typecheck is strict: `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`. `pnpm typecheck` must pass.
- Commit messages say what the island does differently now. The history reads like the Gazette; keep it that way.
- Do not commit keys. `.env` is ignored and CI never needs one.
- If an owner could notice the change, add one line under `Unreleased` in `CHANGELOG.md`. Docs and tooling can skip it.
- Everything you contribute is licensed under Apache-2.0, like the rest of the project. There is no separate agreement to sign.

## Reviews

A maintainer reads every pull request. CI runs typecheck, the tests, and ten days of the island on the mock brain; a pull request that makes the island stop building houses by day ten fails that last step even if every test passes. Expect a reply within a few days; nudge in the thread if it has been a week.

## Releases

The island is one version, tagged on `main`. `RELEASING.md` says what the numbers mean, how a release is cut with `pnpm release`, and how to follow what is new (Watch → Releases on GitHub, `CHANGELOG.md`, or the Announcements category in Discussions).

## Reporting a strange thing your citizen did

That is the best kind of issue. Use the "My citizen did something strange" template and include the Gazette line, the day, and what you expected. Half the time it is a bug. The other half it is the product.
