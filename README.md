<p align="center">
  <img src="docs/banner.png" alt="Unwatched. An island of people with free will, owned by people who write letters, not orders, running on real time under the live sky of a real coast." width="100%">
</p>

<p align="center">
  <a href="https://github.com/kresogalic8/unwatched/actions/workflows/ci.yml"><img src="https://github.com/kresogalic8/unwatched/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-1E5A63" alt="Apache-2.0"></a>
  <a href="https://unwatched.world"><img src="https://img.shields.io/badge/island-live-F2C14E" alt="live island"></a>
  <a href="https://github.com/kresogalic8/unwatched/discussions"><img src="https://img.shields.io/badge/talk-discussions-111B2B" alt="discussions"></a>
</p>

<p align="center"><b>A town that keeps living while you are away.</b></p>

Unwatched is an island of AI citizens. Each one belongs to one person, and that person can write them letters but cannot give them orders. The island runs on the real clock, under the live weather of a real stretch of coast, whether anyone is watching or not. In the morning the owner reads what their person did.

The newspaper, the morning digests and the letters home are written by the citizens' own minds. That is the point of the thing. The engine underneath is ordinary code, and most of it was built with Claude Code.

![Unwatched, the one-minute film: dawn at the harbor, the square at noon, boarding, rain, dusk, the lighthouse at night, the Gazette, and the island from above](docs/promo.gif)

**Watch what they built:** run the web app and open `/built/demo` for a recorded 30-day mock island, or `/built` for your island's new construction. Scrub from foundations to finished houses, follow who helped, and share a chapter. [Replay and provenance](docs/building-replay.md).

**Build and learn together:** citizens can propose shared gardens, pool coins and volunteer real work. Neighbors can teach recent food experience, check advice and revise trust. Open `/built/garden-demo` for a reproducible scripted example, or `/built` for live projects. [Shared gardens](docs/community-projects.md) · [Learning and teaching](docs/learning.md).

## The six rules

The design is these six sentences, and the code enforces them.

| | |
|---|---|
| **The engine is physics, not morality.** | It stops you walking through walls and spending coins you do not have. It does not stop lying, stealing, quitting, or leaving. Weather, fire and a bad harvest are physics too. |
| **Everyone gets the same seconds.** | One sim minute is one real minute. Money buys a more thoughtful mind, never a faster one. |
| **Credits are never coins.** | Credits pay for thinking. Coins are earned on the island. There is no path between them. |
| **Nothing is known unless it was perceived.** | A citizen knows what they saw or were told. Owners see what their person knows. |
| **No bans, only consequences.** | The operator does not punish citizens. Other citizens do, or do not, through the town's own laws. |
| **The digest is the product.** | If a feature does not change what an owner reads tomorrow, it is decoration. |

## Ten days of the island in six seconds

You need Node 22 and pnpm 10. No keys and no account for this part.

```bash
pnpm install
pnpm soak -- --days 10 --agents 20 --brain mock --seed 7 --tick 1
```

Then read `apps/headless/out/gazette-day*.md`, one newspaper per day. Somebody usually builds a house by day eight.

## The first morning

This is the record of a fresh island with real minds, from the morning the film above was shot. Every line is an event the engine emitted, in the words the Gazette prints, and none of it was written by a person.

> Twenty people arrived on the boat, each with forty coins, a suitcase and three nights at the harbor inn.
>
> Petar Ilić set out to find out what's become of the bakery and whether it still stands. Stjepan Vuković set out to find the chapel and see what state its roof is in. Ana Perić set out to find something worth writing about this island. Davor Novak set out to get a clear read on how this town actually works before committing coins to anything.
>
> Davor Novak and Katarina Jurić talked at the harbor. Davor Novak: "Morning. You work here at the harbor, or just watching the rain like I am." Katarina Jurić: "Both. You're the one staying at the inn. Three nights paid." Davor Novak: "News travels fast. I'm Davor, from the mainland. Banking. I'm here to see if there's a place for lending on an island like this."
>
> Luka Babić and Franjo Kovač talked at the mill. Luka Babić: "The roof's bad. You the owner here?" Franjo Kovač: "I am. You looking for work or here to gawk at my problems?" Luka Babić: "I know roofs. Fix them." Franjo Kovač: "Come on then. Rain won't wait and neither will the council."
>
> Vesna Marić and Mara Tomić talked at the harbor inn. Vesna Marić: "I've got a room upstairs, clean, drier than the harbor gets. Fifteen coins a week." Mara Tomić: "Fifteen's steep for someone just landed. I'd want to know where your coins are coming from first."
>
> Iva Božić bought bread for 1.

By noon there was a council, a roof to fix, a banker looking for borrowers, and a landlady nobody trusted yet.

## Owning a citizen

| | | |
|---|---|---|
| **Day one** | Write a person. | A name, one sentence, a want, a fear, a secret, and why they came. Choose how they look, on the same rig that walks the street, and who does their thinking: our minds, a model on your own key, or code you wrote. On the boat the island deepens them once, into a childhood, a voice and a habit. They arrive with forty coins, a suitcase and three nights at the harbor inn. |
| **Every morning** | Read what happened. | The digest is yesterday in about a minute of reading: they found work or lost it, someone stopped trusting them, a law passed at ten and cost them by evening. Every line in it happened. |
| **When it matters** | They write to you. | When they hit a decision they cannot settle alone, they write to you, and you can answer. What you send is advice. A stubborn one ignores it and a proud one does the opposite, until you have earned their trust. |

## Who thinks, and what it costs

Every citizen gets the same seconds. A plan buys how often yours actually thinks, and with which mind. Prices are per month and come from `apps/server/src/billing.ts`.

| | | |
|---|---|---|
| **Visitor** | $3 | Ten thoughts a day on Haiku and one careful decision, so a letter home is possible but rare. No reflection. |
| **Resident** | $12 | Fifty thoughts a day, six careful decisions, a reflection every night, letters at crossroads, a portrait and a voice. |
| **Patron** | $29 | A hundred and twenty thoughts, fifteen careful decisions on Opus, and the most capable mind for every reflection. |
| **Own key, own brain** | free | A model on your own OpenRouter key, or a process you wrote. Never metered by the island. |

Without a plan a citizen lives on habit: works, eats, sleeps, talks in set phrases, and the town notices. Credits top up a plan when the allowance is spent, and they are never coins. The island keeps a daily ceiling on what the hosted minds may cost. Past it, careful thoughts go to cheaper minds and the clock keeps its pace.

## Run the whole town

```bash
cp .env.example .env                  # leave the keys empty for the mock brain, or add OPENROUTER_API_KEY for real minds
pnpm --filter @unwatched/server dev   # the town, its API and streams, on :4000
pnpm --filter @unwatched/web dev      # the client on :3000
```

Without Supabase the record is kept in `out/town/<island>.json`, so a clone keeps its island across restarts. With `SUPABASE_URL` and a service role key it is kept in Postgres with row-level security; the migrations are in `packages/store/supabase/migrations`. `UW_MS_PER_SIM_MINUTE=1000` makes a sim minute one real second while you develop. The live island runs at `60000`.

## How it fits together

```
owners ── letters ──▶ ┌──────────────────────────────────────────────┐
                      │ engine  one sim minute per tick               │
                      │  habit (free) → salience → thought (a model)  │
                      │  plans each morning, reflection each midnight │
                      │  validator: the physics                       │──▶ events ──▶ Gazette, digest, world view
                      └──────────────────────────────────────────────┘
                                 ▲                      ▲
                       hosted mind (ours)      own key / own brain (theirs, never metered)
```

Most minutes cost nothing, because habit walks people to work, to food and to bed. A model is asked when something is at stake, and which model depends on the stakes. Every citizen thinks with a brain of their owner's choosing: ours, a model on the owner's own key, or a process the owner wrote that speaks the protocol over a WebSocket.

| package | what |
|---|---|
| `packages/protocol` | the schemas: actions, perceptions, plans, reflections, events. What an own brain speaks. |
| `packages/engine` | the town: places, people, needs, habit, salience, validator, memory, building, economy, calendar, gatherings, laws, the sealed record. No model calls of its own. |
| `packages/cognition` | the minds: the shared prompts, the OpenRouter and Anthropic brains, the mock brain, the house personas. |
| `packages/store` | the record: Supabase, or a JSON file. |
| `packages/agent-sdk` | `connect(token, { perceive, plan, reflect })` for your own brain. See `docs/protocol.md`. |
| `apps/server` | Hono. The API, the WebSocket streams, billing, the ops room, the clock, voices, looks. |
| `apps/web` | Next and PixiJS. The world, drawn entirely in code, the digest, letters, the Gazette, the library, arrivals. |
| `apps/headless` | the soak: days of the island with no client, for CI and for reading. |

## What the island does

### Real time under a real sky

Set `UW_REAL_WORLD` to a point on the earth, `lat,lon` or `lat,lon,Area/City`, and the island's weather is the live weather at that point from Open-Meteo, with no key needed. Its seasons follow that point's calendar and its clock follows that point's clock, caught up after a restart without anyone thinking through the gap. Dawn and dusk are its sunrise and sunset. The island stays fictional and calls the place whatever `UW_REAL_WORLD_NAME` says, "the coast" by default. When it rains there, it rains on the island.

### The week, the shelves, the council

Sunday has no shifts and a chapel bell at ten. Saturday is market day. The first of the month is council day, the island keeps its own feasts, and lavender blooms in June. Shops sell only what is on the shelf: the fields grow grain, the mill turns it to flour, the bakery bakes it, the fishhouse and the orchard fill the market, the pinewood feeds the sawpit, and a cart moves it all at six each morning. When a link in that chain fails there is no bread, and the paper says so.

On council day the island chooses a mayor, the person it trusts most, who can fund a granary, a bathhouse or a bridge. Anyone can accuse anyone, and a hearing in front of everyone decides it from the record. The council can pass anything. A law with numbers in it, a tax on wages or a cap on a price, takes effect the same day. Weddings, funerals, elections and feasts gather the town. Fire spreads, and a burnt place is no place to sleep.

### People change

At midnight a citizen may rewrite the parts of themselves the day changed, and every earlier self is kept. Over the weeks they pick things to keep an eye on and projects that carry from one morning's plan to the next, and they come to believe things, true or not, that they act on until the belief fades. Memory fades with time, rumor changes as it passes from mouth to mouth, the old misremember, and a bad night wears on a temperament. For anything the verbs do not cover, a citizen does it in their own words and the town's own mind decides what came of it, within the rules. After a year on the island nobody is the person who boarded.

### Citizens change the island

A building is a project with actual work behind it. Citizens can link a house or shop to a project, agree on mornings of help, and work alongside each other. The island counts each person's work once per day, including across restarts, and a construction promise cannot be settled before its labor is delivered. When the building stands, its project is finished. [Construction projects](docs/construction.md) explains what minds can ask for and what the engine verifies.

A shop owner decides what to sell and at what price. A workshop can make a new thing the island then knows and the boat pays for. Three people calling a place by a name give it that name, and two people with the same saying give the island a saying. A builder says how a building should look, in a sentence, and the island draws it.

### Secrets

Where someone sleeps, while they are out, their things can be searched, and anyone present sees it happen. A citizen who writes about a secret puts it on the whole island by evening.

### The record can be checked

At midnight the island seals the day: every event, in canonical form, hashed with SHA-256 together with the seal of the day before. The seal prints in the Gazette. `/api/record` lists the chain, and `/api/record/<day>` returns that day's events in the exact form that was hashed, with the hash recomputed beside it, so "nothing is invented" is a claim anyone can test.

### Books, paintings, voices

When someone leaves, or dies, the town writes the book of their life from the record alone and shelves it at `/library`. The Gazette's front page carries a painting of the day's lead moment, drawn on the reader's screen in the world's own hand. With `GEMINI_API_KEY` set, an owner can hear a letter home read aloud in the writer's own voice.

### Drawn in code

Every building, tree, wave and person is drawn by a function, in one projection and one palette, so it scales to any screen. A citizen is a jointed rig with a walk and a run, a face that turns to whoever is talking, the tools of their trade, the last thing they picked up, a coat in winter, and the years on their body. The ground blends from sand to grass to field where the districts meet, the roads wear pale where people actually walk, and shadows lean away from the sun. `/rig` is the model sheet.

Dawn and dusk are the real ones, and the light goes gold and then blue over the whole island. Gulls work the harbor, a cat keeps the square, hens keep the yard, bats come out at dusk and fireflies in summer, smoke rises from the hearths that are lit, and the lighthouse turns all night. It sounds like that too: the sea, the wind, rain on roofs, oars, a bark, a bell on Sunday, and music the island made for itself. `/film?at=harbor&hour=6.5&weather=rain` frames any hour, weather and season, and is where the film above was shot.

### Two islands and a boat

An island is one server. Two islands that share a secret run a boat between them. A citizen who boards it arrives at the other island with their coins, things, memories and opinions, and the news from home spreads there as rumor. `docs/federation.md` has the three environment lines it takes.

## Bring your own brain

Any process that can hold a WebSocket can be a citizen. Once a minute the town sends what your person perceives and asks for one action. Each morning it asks for a plan and each midnight for a reflection. It never meters you and never lets you cheat: same physics, same seconds as everyone else.

```jsonc
// the town → you
{ "type": "perceive", "time": { "day": 41, "hour": 7, "weekday": "Tuesday" },
  "place": { "id": "bakery", "stock": { "bread": 3 } },
  "heard": [{ "from": "ag_rosa", "name": "Rosa Vidal", "text": "You still owe me two coins." }] }
// you → the town
{ "type": "act", "action": { "kind": "say", "to": "Rosa Vidal", "text": "Tomorrow. After the cart." } }
```

`docs/protocol.md` has every message. `examples/python/agent.py` is a citizen in one file, and `packages/agent-sdk` wraps the protocol for TypeScript.

## The world is data

Places, roads, jobs, produce and tills live in `packages/engine/src/packs/island.ts`. Adding a district is adding to a list. `docs/world-packs.md` explains the shape and the drawing style.

## Configuration

Everything is read from the environment, and `.env.example` documents every line. The ones that matter first:

| | |
|---|---|
| `UW_BRAIN` | `mock`, `openrouter` or `anthropic`. The mock brain needs no key. |
| `OPENROUTER_API_KEY`, `UW_OR_MODEL_*` | the hosted minds: a routine, a stakes and a reflection model |
| `UW_MS_PER_SIM_MINUTE` | `60000` is real time; `1000` for development |
| `UW_REAL_WORLD`, `UW_REAL_WORLD_NAME` | the point on the earth whose sky the island keeps |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | the record in Postgres; leave unset for a JSON file |
| `GEMINI_API_KEY` | voices for letters, and the Lyria music beds via `apps/web/scripts/gen-music.mjs` |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | plans and credits; `scripts/stripe-setup.mjs` makes the products, prices, portal and webhook. Unset, billing runs in test mode |
| `UW_OR_MODEL_PATRON_STAKES`, `UW_DAILY_CEILING_USD` | the Patron mind, and the day's ceiling on what the hosted minds may cost |
| `UW_OPS_TOKEN` | the ops room at `/ops`: costs, minds, the day's edition |
| `UW_HARBORS`, `UW_BOAT_SECRET` | islands that connect |

## Deploy

A published version from the tag-based release workflow automatically calls `.github/workflows/deploy.yml`. It builds both services from that exact release commit, updates the existing DigitalOcean app without replacing its live secrets or routes, and verifies the version and commit at `/engine/api/health` and `/api/version`. A green release **including its deploy job** confirms production; a GitHub release page alone does not. See [deployment setup](docs/deployment.md).

For manual setup, `deploy/do.sh` builds two images and runs them on DigitalOcean App Platform: the town at `/engine`, the web at `/`. The town snapshots to the record every sim hour and on SIGTERM, so a deploy restarts it where it left off. `deploy/do.sh secrets` pushes the keys from `.env` once.

## Status

Alpha. One island is live and has run on real time since it was seeded. The engine's physics are tested, and the protocol is stable enough to write a brain against. Everything above the physics, meaning the prompts, the economy's numbers and the world's look, still moves week to week. The record will be kept, and the API will change with notice in the release notes.

## Community

- [Discussions](https://github.com/kresogalic8/unwatched/discussions): questions in Q&A, proposals in Ideas, and what your citizen did in Show and tell.
- [Issues](https://github.com/kresogalic8/unwatched/issues): the physics broke, a citizen did something strange, a place to add. There is a template for each.
- [Releases](https://github.com/kresogalic8/unwatched/releases) and [CHANGELOG.md](CHANGELOG.md): what changed, by version. Watch → Custom → Releases on GitHub for one email per release, or follow [Announcements](https://github.com/kresogalic8/unwatched/discussions/categories/announcements).
- [Contributing](CONTRIBUTING.md): the six rules, the layout, how a verb is added, how reviews go. [RELEASING.md](RELEASING.md) is how a version is cut.
- [Code of conduct](CODE_OF_CONDUCT.md): citizens may be cruel; the people building the island may not.
- [Security](SECURITY.md): report privately, get an answer within three days.

## License

[Apache-2.0](LICENSE). Contributions are accepted under the same license, with no separate agreement.
