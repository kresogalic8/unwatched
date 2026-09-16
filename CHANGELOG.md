# Changelog

All notable changes to Unwatched are recorded here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the island is versioned by [Semantic Versioning](https://semver.org/spec/v2.0.0.html): every package and app carries the same number, a major bump means a message in the own-brain protocol changed incompatibly or the sealed record's canonical form changed, a minor bump means the island gained something an owner or a citizen can notice, and a patch is fixes, copy, prompts and tooling.

## [Unreleased]

### Added

### Changed

### Fixed

## [0.16.0] - 2026-09-16
### Added

- The town view answers a tap: click an event or a person in the journal and the camera flies there and marks who it means; the cinema view carries a lower third naming who is on screen and what the record says.
- Desire-lines wear into the grass where people cross off the roads, faint at first and deeper the more they are walked.

### Changed

- The island now reads as raised land, with a living tide line washing the shore and soft light shafts falling through the pinewood at dawn and dusk.
- Trees and props cast the sun's shadow and sit on the ground; the low sun catches the roofs, and at night each lit building spills warm light onto the street.
- The common houses come in colour-and-roof variants, differ a little building to building, and age with moss creeping up their feet.
- Each citizen now walks in their own way — their build, their years and a load in the hands shape the step — leaning into a quickening pace and slowing behind a crowd rather than walking through it.


## [0.15.0] - 2026-09-16
### Added

- Another Life onboarding: create yourself or an imagined citizen through five situations, personal habits, strengths, flaws and aspirations, with a reviewable portrait and saved progress.
- An audited operations preview for reducing ownerless NPCs to a target of 5–10, protecting families, property owners, civic roles, close user relationships and occupied jobs.

### Changed

- Personality, appearance, brain selection and boarding share one animated layout and progress indicator. Answers become the citizen's actual persona; existing brain activation and billing requirements remain in place.
- New islands default to ten seed citizens. Existing populations are unchanged until an administrator reviews and confirms departures.

### Fixed

- Hosted plans appear only for the hosted brain option; feedback no longer overlaps onboarding controls.
- Persona enrichment preserves user-supplied skills and flaws. Population adjustments require successful snapshots and checked departure persistence.

## [0.14.1] - 2026-09-14
### Changed

- Full-window town observation with compact navigation, a collapsible journal, lower citizen details and responsive mobile controls.
- Clickable island minimap, whole-island camera framing and following selected citizens independently of ownership.

### Fixed

- Ultrawide landing headlines retain their text column; hero type scales with viewport height and actions align with the content.
- The landing wordmark stays white over the dark hero. Town feedback moves into the header to avoid overlapping map controls.

## [0.14.0] - 2026-09-13
### Added

- Living coastal details: fish schools react to boats and walkers, shoreline crabs retreat, sea grass follows currents, and shells, mooring floats and fading footprints enrich the actual town.
- Citizen-authored flowers, benches and stone markers with material and coin costs, ownership checks, bounded place capacity, persistent attribution and reasons. New benches participate in visual seating.
- Place-memory controls replay recorded additions on the map; contributions also appear in the evolution record.
- Rare summer bioluminescence shared by rendering and agent perception, plus dust and wet footfall effects grounded in observed movement.
- Direct building-interior view on click, with room-specific furniture, current location occupants, reported activities, stock-aware fish counters and keyboard return to the street.

### Changed

- Harbor architecture and paving gain material detail; boats, laundry and trees share a travelling breeze. Asset URLs include content hashes.
- Character and Spine research is retained under the development-only `/experiments/characters` workspace, with an `/experiments` index. Standalone world-study routes and their image-animation concept are removed.

### Fixed

- Cancelled gatherings no longer produce staged scenes; absent participants are excluded.
- Interior population refreshes with live movement and authoritative snapshots. Co-location alone no longer implies a conversation.

## [0.13.0] - 2026-09-13
### Added

- Emerging desires: citizens can form, reconsider, set aside or report fulfillment of lasting wants during existing nightly reflection, citing personal experience records validated by the engine.
- Compact desire context in planning and decisions, with optional action-to-desire links and recorded accepted/rejected outcomes. No assigned careers, quests or guaranteed outcomes.
- A private “What they want now” section in the owner digest with reasons, bounded revision history, experience records and action attempts.
- Backward-compatible optional external-brain fields and persisted desire state; existing snapshots start without invented desires. No database migration or additional model calls.

### Fixed

## [0.12.0] - 2026-09-13
### Added

- Bounded, reusable agent procedures with isolated local experiments, minute-by-minute real practice, measured outcomes, voluntary teaching and portable unverified recipes between islands.
- Material-consuming building repairs and voluntary, citizen-authored institutions at owned places.
- A public evolution record with separate experiment/success/failure labels, retained story timelines, learning provenance and downloadable records. A clearly labeled scripted demonstration is available separately.
- Self-service Telegram pairing with expiring one-use links, signed-in chat confirmation, per-agent selection, disconnection and server-only database permissions. Requires migration 0012 and a secret-authenticated Telegram webhook.
- Seven-day audit instrumentation with skill-transfer metrics and snapshot round-trip checks; live runs require a dedicated OpenRouter key with a non-resetting provider cap.

### Fixed

## [0.11.0] - 2026-09-13
### Added

- Optional Telegram delivery of an explicitly paired agent's letters to its owner, with ownership checks, plain-text messages and secret-safe failure reporting.

### Fixed

- Preserve daily decision allowances and refund top-up credits after provider failures; renew allowances independently of nightly reflection and back off failed calls.
- Apply purchased plan allowances immediately while preserving usage across reloads and plan changes. Included morning planning no longer consumes the advertised decision quotas; paid nightly reflections retain their advertised model.
- Prepare separate OpenRouter routing for hosted subscribers, outside public-world model downgrades. Production OpenRouter failures no longer deliver synthetic mock answers as paid responses. Deployment requires a separately funded subscriber key.

- Run the server's development command with the free mock brain, no shared store and no paid voice/image providers, even when the repository `.env` contains production credentials. Live model testing must be started explicitly.

## [0.10.2] - 2026-09-12
### Added

- Bounded, unscripted headless autonomy audit with real-model decision records, action/opportunity counts, preserved output and explicit incomplete status on model fallback. Document the first partial live observation and its limits in `docs/autonomy-audit.md`.

### Fixed

- Keep model-authored memories and conversation interpretations separate from observations, including on retrieval after restart. Record the public condition of the currently occupied place and provide personal action event references to nightly reflection.
- Clarify that reaching a planned stop does not verify its proposed work. Report model-completed personal goals as the citizen's claim, rather than verified world construction, and prioritize current state over conflicting persona backstory.

## [0.10.1] - 2026-09-12
### Added

### Fixed

- Keep the scripted garden scenario clock monotonic when construction starts on the proposal day; its generated record now checks event ordering.

## [0.10.0] - 2026-09-12
### Added

- Citizens can propose shared gardens, pool their own coins, volunteer or withdraw, and turn six mornings of work into a public food source. Real planks, growing time, tending, weather and finite shelf capacity determine what the garden produces.
- Citizens can teach recent firsthand food experience to an awake neighbor. Advice stays distinct from receipts, influences food choices according to trust and age, and changes trust only after a later personal check.
- Shared project progress and contributors appear in the building record and world. Profiles show exchanged advice, with private verification results for owners. A reproducible, clearly labeled garden scenario demonstrates the mechanics without altering the live island.

### Changed

- Volunteers follow their chosen projects outside paid shifts and urgent needs. Minds receive public proposals and the tools to join, ignore or leave them.

### Fixed

- Postgres snapshots now retain food lessons, routine comparisons and received advice, matching file snapshots. Shared gardens retain donations, labor and harvest limits through restarts.
- Release instructions now describe the automatic production deployment introduced in v0.9.0.

## [0.9.0] - 2026-09-12
### Added

- Stable tag releases automatically deploy both DigitalOcean services after release checks. Images are tagged with release and commit, live settings are preserved, and public version endpoints verify the rollout. The production workflow can be rerun for the latest published release without creating another release.

- Outcome-backed food-purchase learning: bounded, persistent evidence from validated purchases and unavailable stock, with recency-weighted confidence and repeated-failure deduplication. Learned preferences break ties between equally near affordable food shops and are available to the agent's perception.
- Agent profiles show public purchase receipts separately from owner-only lessons and executed routine changes. Private rejected attempts and counterfactual choices remain owner-only. `Town({ learning: false })` supports controlled comparisons; learning tests verify behavior changes, reversal, restart continuity and public-view privacy.

### Fixed

## [0.8.0] - 2026-09-12
### Added

### Changed

- Street lighting separates the lantern glow from an elliptical pool on the ground. Broader, quieter bloom and reduced window flicker preserve the Harbor material colors after dark.

- Orchards now show pruned trees instead of grain rows. Harbor piers gain plank wear, fasteners and mooring wraps; rowboats gain hull seams and coiled rope. Coastal rocks gain waterlines and quarry terraces gain stone joints.

- Landscape paving is less repetitive, roads gain softer edges and the coast gains shallow water and broken foam. Trees use irregular foliage silhouettes and visible branchwork. Sawmills now have a dedicated workbench; market bins and nets gain details, live stock aligns with the counter, and empty-stock signs clear building names. Interior windows and floors share Harbor materials; construction reveals the actual roof instead of a separate teal triangle.

- Harbor buildings gain recessed window frames, shutter hardware, corner masonry, deeper eaves, drainpipes and individually highlighted roof tiles. Street furniture gains wood grain and fasteners; barrels, lamps, wells, laundry and towers gain material details. Rebuilt shared day/night artwork keeps the town and study consistent.


## [0.7.0] - 2026-09-12
### Added

- Street camera zoom and recenter buttons, usable by touch and keyboard. Character preview can pause and honors reduced-motion preferences.
- Harbor Street visual study with afternoon, blue-hour and coastal-rain views at `/harbor-study`. Its architectural drawings are the canonical source for the live world and building replay.
- Interactive character standard at `/harbor-characters`: appearance components, fourteen animations, directions, age and weather, with a matching portrait. The approved live rig also supplies the Harbor study’s people.
- Reproducible Harbor Street atlas generation: 55 drawings and lighting variants rendered at 3× resolution, including buildings, vegetation, boats, street furniture and working places.

### Changed

- Conversation gestures respond to existing fatigue, hunger, joy and grief, with age-sensitive timing. Tired citizens fidget less; eye movements ease toward their subject, and passing glances decay consistently across refresh rates.

- Eating separates the supported bowl and animated spoon. Reading uses both hands; writing adds a pen moving over the supported page. Kneading and hauling align both wrists to the working object, and unrelated held items hide during meals and reading.

- Live citizens turn over a short staged pivot, passing through a front view when reversing direction, with a subtle shoulder and head movement. Repeated direction updates do not restart the turn; static previews retain immediate facing controls.

- World walking accelerates and brakes before arrival. Step cycles follow actual distance and body size, with a slower everyday pace and faster fire evacuation. A facing dead band prevents flickering between front and profile on diagonal routes.

- Production citizens use more natural illustrated proportions: longer legs and torso, a smaller head, narrower coat hem and a quieter stride. Portrait framing and interior scale follow the new anatomy.
- More natural citizen anatomy: shaped jaw, ear, nose, lips and thumb silhouettes; tonal hair strands, garment seams, collars, pockets, trouser folds and shaped leather shoes. Shared by world, interiors and portraits.
- Articulated ankles keep walking soles level and grounded across body sizes and ages. Smoother sleeves, calmer arm swing and subtler coat folds bring the moving silhouette closer to the Harbor reference.
- Worn paving uses sparse, low-contrast stone fragments over limestone beds instead of a continuous diamond grid. Faces gain cheek light and clearer eyes; beards fit the compact head and necks use the citizen’s skin tone.
- Conversation participants face and look toward their recorded partners while nearby; walking speed is consistent across refresh rates.
- Citizens blend between actions over a short transition instead of snapping between poses. Winter coats, scarves and buttons fit the Harbor proportions; character preview includes expressions.
- Replace the former building and prop drawings throughout the live world with limestone and plaster architecture, clay roofs, wooden shutters, planted balconies and olive trees. Occupied windows light up at night; mill sails, chapel bells and laundry remain animated.
- Rebuild the ground as a continuous landscape with jointed stone streets and a raised limestone coastline. Fine paths replace the former broad road strips.
- Redraw citizen proportions, faces, clothing and articulated limbs across the town, portraits and interiors, retaining personal appearances, poses, carried objects and simulation actions.
- Building replays and live construction use the same Harbor Street house drawings as completed buildings. Future generated illustrations follow this material palette while respecting explicitly described citizen choices; stored illustrations retain their original artwork.

### Fixed

- Seat assignment and release blend smoothly even when the citizen keeps the same action. Mirrored walking preserves ground contact and level shoes for older citizens; cups stay upright when facing left.

- Citizens reserve actual bench and terrace seats, align hips to the seat surface and release seats on departure. Seated conversations stay seated; unsupported eating/drinking stays standing. Bench height fits the new anatomy; interiors draw supporting chairs. Cups remain upright and reach the mouth.
- Bob hair and low cap bands no longer cover the eyes. Glasses and beards follow profile/front views, and aprons end at the coat hem. Shared Harbor curves use explicit smoothing.
- Headscarves leave the face visible instead of covering the entire head.
- Petting faces the animal immediately. Expired speech bubbles stop driving talking poses, and queued dialogue is cancelled when the world unmounts.
- Blinking preserves tired and surprised eyes; tall citizens retain their proportions while sleeping. Paused character previews can inspect a different pose immediately.
- Missing or invalid preview zoom parameters no longer target zero. Street camera coasting is frame-rate independent, does not fight active dragging, and dragging suppresses accidental character or building selection.
- Interior citizens apply age and trade styling consistently with the town; portraits frame children and tall citizens correctly and cache each exact age.
- Building selection uses the new drawings' bounds; failed world artwork loading offers a retry.

## [0.6.0] - 2026-09-12
### Added

- Watch what they built: a public building replay with foundations, rising walls and roofs, a plot overview, time controls, shareable chapters and downloadable SVG pictures. A labeled 30-day mock recording works without an account or API server.
- Every new building keeps its public construction history in the place snapshot: who started it, who worked, what materials cost and whether promised help was paid. Names and chapters survive restarts and the rolling event log; final mornings and off-site payments count. Private thoughts, letters and raw event payloads are excluded.
- A bounded synthetic opportunity probe reports real model decisions separately from provider fallbacks. The soak runner exports construction recordings.

### Changed

- Citizens at a building site see whether they have already worked today. Their decision prompt distinguishes talking about help from making a formal offer, while leaving the choice to them.


## [0.5.0] - 2026-09-12
### Added

- Eviction shows on the person. Anyone without a roof carries their bedding rolled on their back and a strap across the chest, so a night in the open is something a viewer can see from the map rather than something they have to read about.
- Building is a project with work behind it. A citizen can attach a house or shop to a project they named; the island records paid materials and actual labor, and finishes the project only when the building stands. Others can offer mornings of help, work them after acceptance, and collect the agreed coins. The last morning counts even when it finishes the building.

### Changed

- Accepted building work reaches the morning plan and habit. Delivered labor stays payable after its deadline; settlement waits if the builder cannot pay, without calling the worker's promise broken. Plain social promises keep their existing behavior.

### Fixed

- A restart keeps each person's last day of work on a site, so the same morning cannot count twice. Postgres keeps open promises and construction progress, and the town preserves the next promise id after closed promises leave its snapshot.
- Answering or settling a promise by the other person's name validates the same promise that is executed.

## [0.4.0] - 2026-09-12
### Added

- Rent, arrears and eviction. A bed is paid for the night it is slept in, out of what is left after a person has kept enough to eat. A landlord lets it run and the shortfall stands against the tenant; three nights behind and they are put out, with what they owe following them as a debt. The harbor inn gives no credit: the three nights an arrival is given end when they are paid out, and after that it is a bed like any other.
- What is overdue grows: a tenth a day, a coin at the least, and never past twice what was lent. A council that finds against a debtor now pays the creditor out of the fine before the town takes the rest.

### Fixed

## [0.3.0] - 2026-09-12
### Added

- Promises the town remembers. A citizen can offer someone here a thing they will do, for coins if they like and by a day if they name one; the other takes it or turns it down; the one who promised settles it in front of them when it is done, and the coins change hands then. A promise whose day passes unsettled breaks in the open at midnight, and costs more trust than anything else in the engine. What is promised and what is owed shows in the perception, in the morning plan, and in whatever two people have between them when they meet.

### Changed

- Every bed on the island is finite, the free ones in the boat shed included. The bed where a person lives is theirs and nobody else can take it.
- A night with no roof over you wears on the body in any season, not only in a winter cold enough to kill.
- What the island keeps back from the morning boat is the shelf that food keeps to, so a surplus of bread or fish goes to the mainland for coins instead of going stale on the shelf overnight.
- An owner with no plan gets the morning record as the town kept it, without a mind paid to write it up. The plan already said so.
- The hill fields grow grain and no longer sell apples nobody ever grew or carted there. The orchard is the apple shelf.


## [0.2.1] - 2026-09-12
### Added

- The perceive message's six new fields and the reflect message's are documented in docs/protocol.md, and the TypeScript SDK's `ReflectRequest` names them, so a typed own brain can read its projects, beliefs and watch list without casting. Every one is optional; nothing was renamed or removed.

### Changed

- The morning digest reports against the plan the day before was actually lived on, not this morning's unstarted one, and after a long absence the writer is given the most recent sixteen moments instead of the earliest.
- A counter never bids more for a thing than half of what it charges for it, so a council price cap can no longer be turned into a pump out of a shop owner's purse.
- A hungry citizen with nothing they can afford walks to the nearest shelf that at least has food on it, rather than to one that merely sells it.
- A citizen starving through a winter night without a roof is told that the cold is what kills, not the fifth day, which is what the engine has always done.

### Fixed

- An owner with more than one citizen is mailed about every one of them each morning, not only the first.
- The morning mail still goes on a day whose seven o'clock was skipped, which happens when the clock catches up after downtime.
- A letter posted to a citizen is in the record before the reply goes out, and a town rewound to its last snapshot puts any letter delivered after that minute back in the post and strikes any letter home the re-lived day never wrote.
- A restart no longer lets a council vote be cast twice on the same proposal, forgets a letter that asked something but has not been answered, or asks a citizen the same once-a-day question about hunger or a debt again.
- On Postgres, a restart keeps what a citizen was becoming: projects, beliefs, the watch list, earlier selves, convictions, secrets known and the trust log all survive it now.
- A citizen cannot make a thing from two of an ingredient there is only one of, which used to leave a shelf holding less than nothing.
- A plan step at a place the citizen never reached no longer swallows the later steps' thoughts for three hours.
- A letter home that a citizen thought about and chose not to write no longer blocks every later question an owner asks.
- The digest window a browser tab opened on ages out after twelve hours, so a tab left open across the night opens on the new morning; signing out forgets it, and each person in the digest's People card opens on that person.
- Boarding waits for the plans to arrive: with the harbor office silent, nobody is sent over on a plan they never read, and the page offers to ask again.
- The town's mind falls back properly when an answer's headers arrive but its body does not, asks again cleanly when a model returns nothing at all, and does not sleep once it has already decided to fall back.
- A quiet night's reflection is counted at the price of the mind that actually ran it, so the day's ceiling is not tripped early.
- One island no longer takes another island's letters out of a shared record, and a letter id is never reused after an owner is deleted.

## [0.2.0] - 2026-09-12
### Added

- Goods are finite: every shelf carries a count, taking from a shelf removes the item, a theft from an owned shop reaches the owner's digest, a place buys only what it sells or uses and pays half the shelf price, and bread, fish and soup spoil at midnight past a shelf of twelve. The wild can be foraged: timber in the pinewood, stone at the quarry.
- What a citizen perceives: where they last saw the people they know, whether someone in the room with them is asleep, their own shift with its place, wage and hours, how hungry, tired and lonely they feel in words, and how many planks the sawpit holds before they try to build.
- The midnight reflection sees the morning's plan with each step done or missed, the projects, the beliefs, the watch list and the unread letters, and is asked what it did of what it meant to do. Quiet days are marked so a cheaper mind can take them.
- The digest admits what was said to and by the citizen, refused actions, price moves at places they own, and the first and last thing of each day, and leads with the gap between the plan and the day. Trust moves since the owner last looked are shown by name.
- The body and the calendar interrupt the mind: real hunger with coins in pocket, the first day of starving, a debt due today, and a gathering within the hour each draw a thought.
- A letter from an owner that asks something gets an answer within the day, one answer per letter, without spending the citizen's one unprompted letter home.
- The morning email: at seven island time each owner gets their citizen's digest, and a letter home arrives by email the hour it is written. Both can be switched off on the account page. Needs RESEND_API_KEY; without it nothing is sent.
- The digest knows how long you were away: a read watermark per owner and citizen, up to fourteen days of history, day headers over a long absence, and a link to the whole record.
- The relationships page is in the tabs, every important line of the digest can be shared as a moment with a preview card, the profile page shows the portrait and links the book, and the Gazette links the town hall.
- A way in from the town page for a visitor without a citizen, with locked previews of what an owner would see.
- The model layer: one chooser for every call so the daily ceiling and a Patron's mind apply to conversations, digests, the Gazette and the books; quiet reflections on the middle mind; an answer that does not fit the schema is trimmed at a sentence or repaired with one more turn before any canned text stands in, and canned text is marked; a request timeout with one retry; persona depth on the Anthropic brain too.
- Own brains receive the full reflect context (the plan, projects, beliefs, watch list, unread letters and the quiet flag), documented in docs/protocol.md.
- Votes are recorded by name, one per citizen per proposal, and printed as an event. A non-exposé writing stays with its author as a memory.
- Releases: CHANGELOG.md, RELEASING.md, pnpm release, a release workflow on version tags and release notes grouped by label.

### Changed

- The Visitor plan gets one careful decision a day, so a letter home is possible but rare, and the letters and digest pages say plainly when a plan cannot write home.
- The food economy was retuned for finite shelves: the bakery bakes 24 loaves a shift, the fishhouse lands 12 fish, the inn makes soup from fish, and the mainland keeps 30 bread and 20 fish home before buying.
- The jobless take the nearest open post and the hungry walk to the nearest stocked shelf. A broken place no longer sacks people for a shift it could not hold.
- Persona depth may be up to 240 characters a line, and the depth prompt states the limits.
- Leaving on the boat is refused in a storm or while the boat is held.
- The README, the rules page, the landing page and the boarding copy are written plain.

### Fixed

- Another person's letter home, their private opinion of you and their rewritten self could reach your digest and your morning mail.
- An owner buying at their own counter destroyed the coins, and an owner holding a post at their own place was paid a wage out of nothing.
- A workplace with an empty till hired people it could not pay, fired them the same evening and hired them again the next morning until they starved. Thirty days of the island on one seed: four died of hunger before, none now.
- An owner's letter was delivered and remembered twice, once by the API and once by the hourly replay.
- The digest window silently capped at three days and its kicker always said three days.
- A plan step was marked done the moment a thought was spent; steps are now ticked by being at the place at the hour, or marked missed.
- A stale plan could make salience fire and an unfunded citizen could throw inside a tick.
- The gate page overflowed on phones; a failed plan purchase after boarding was swallowed silently.
- The ops room metered conversations and digests at the town's models rather than the chooser's.

## [0.1.0] - 2026-09-12

The first public release. The island went live on unwatched.world and has run on real time since it was seeded.

### Added

- A pnpm monorepo of the protocol schemas, the engine, the minds, a store that keeps the record in Supabase with ten migrations or in a keyless JSON file, an agent SDK, the server, the web client and a headless soak that runs days of the island with no client, with a CI workflow and invariant tests for the engine's physics.
- The engine: places, people, needs, habit that walks citizens to work, food and bed at no cost, salience that decides when a mind is asked, a validator that enforces the physics, memory with local embeddings, job seeking, names resolved to ids from whatever a mind says, a plan each morning that runs in parallel batches and pulls citizens to their place at their hour, and a heading habit that carries a citizen to a far place one road a minute.
- The minds: a mock brain that needs no key, Anthropic and OpenRouter brains with shared prompts and strict structured JSON, a cached prompt prefix shared by every citizen, loud fallbacks when a model fails, a strict-schema adapter for OpenAI-family models, personas deepened once by the town's mind, and a daily cost ceiling past which careful thoughts go to cheaper minds while the clock keeps its pace.
- The web client and server: an API with WebSocket streams, sign-in by magic link through Supabase or a local dev sign-in, boarding, the digest, letters, the Gazette, a PixiJS world, the town hall, moments, farewell, standing instructions, overview and towns pages, forty stroke icons, dark mode and a mobile tab bar; the town restores from the record on restart and snapshots on shutdown.
- Own key and own brain: a per-agent brain router, own keys with a daily cap, a WebSocket protocol that sends what a citizen perceives once a minute and asks for one action, a plan each morning and a reflection each midnight, a setup screen, a TypeScript SDK with connect(token, { perceive, plan, reflect }), a Python citizen in one file, and docs/protocol.md with every message.
- Billing: wallets and a ledger, plan allowances, credit-backed thoughts, a credits screen, Stripe checkout, a webhook that grants credits once per event and sets the plan from the subscription, a billing portal, all created on any account by scripts/stripe-setup.mjs, a test mode when no key is set, and plans priced from a cost audit at $3 for Visitor, $12 for Resident and $29 for Patron, each listing what it buys.
- The ops room at /ops behind UW_OPS_TOKEN: metrics, town health, a moderation queue, own-brain status, cache and fallback figures, kill switches as acts of God, and an edition printed out of hours.
- The bigger island and a closed economy: six districts, some thirty places, thirteen jobs and plots to build on; citizens build houses and shops, owners earn rent and takings and pay wages from tills, the mainland buys real surplus at the harbor each morning, land money goes to the council, a full till pays more, hires more and charges less, a place that cannot pay lets its worker go, and the verbs hire, lend, lodge and leave.
- The week and the supply chain: Sunday rest, market day and council day, twelve months with feast days and six weeks of lavender, stock on every shelf, production per shift, a six o'clock cart with every leg on the record, real shortages the paper reports, and planks for building paid to the sawpit.
- Mortality and fire: two hungry days weaken and five can kill, winter and no roof hasten it, a word is said before the end and an obituary goes on the record; fire starts from a storm at night, a hard-worked forge or oven or a winter lamp, the bell wakes the town, whoever is within four roads runs with buckets, and a burnt place stands dark for days.
- Generations and memory that ages: households under owned roofs, births to settled couples, children raised by the town who come of age as citizens shaped by their parents, inheritance and adoption at boarding; what did not matter fades, a retold story drifts, an old head recalls an old day a little wrong, a bad night wears on a temperament, and the record keeps the truth.
- Institutions and secrets: the council sits on council day and chooses the most trusted person as mayor, who funds a granary, a bathhouse or a bridge from the treasury; anyone can accuse anyone and a hearing in front of everyone decides it from the record; weddings, funerals, feasts and council sittings gather the town; a citizen's things can be searched where they sleep while they are out, witnesses tell, and writing about a secret is an exposé the island reads by evening.
- Free minds and an island its citizens shape: a reflection may rewrite the self with every earlier self kept, a watch-list draws a thought when its subject is near, projects carry across mornings and beliefs grow surer or fade, a free verb, do, is judged by the town's mind within the rules; shop owners set stock and prices, a workshop makes a new thing the island learns, three voices name a place, two people with one saying give the island a saying, and a passed law with numbers in it takes effect the same day.
- Letters home and the digest: a citizen at a crossroads may write to their owner once a day, owners see the why behind every deed, turn-by-turn talks happen when something is at stake, and the digest is written by the middle mind in four to six sentences that quote the citizen's own words and end with what they mean to do next; it also shows what they keep an eye on and every self they rewrote.
- The Gazette, the books, the painting and the voices: the paper prints only what was done or said in public, with standing columns for the shelf, the harbor and tomorrow; the town writes the book of a life when someone leaves or dies and shelves it at /library; the front page carries a scene of the day's lead moment drawn on the reader's screen; and with GEMINI_API_KEY a letter home is read aloud in the writer's own voice, one prebuilt voice per name, made once and kept.
- The record can be checked: at midnight each day is sealed with SHA-256 and chained to the day before, the seal prints in the Gazette, /api/record lists the chain and /api/record/<day> returns that day's events in the exact form that was hashed.
- Real time under a real sky: UW_REAL_WORLD takes any lat,lon with an optional zone and the island keeps that point's live weather, seasons, clock, sunrise and sunset, with a seasonal boat timetable, and calls the place whatever UW_REAL_WORLD_NAME says.
- Two islands and a boat: islands that share a secret run a boat between servers that carries a person with their coins, things, memories and opinions, news from home crosses as rumor, at seven the boat runs one island's surplus to a linked island short of it, far islands show on the towns page, and docs/federation.md has the setup.
- The world drawn in code: every building, prop, tree, wave and person is a function in one dimetric projection and one palette with no image atlas; a ground that blends from sand to grass to field with warped edges, roads worn pale where people walk, shadows cast from the sun, a coast with shallows, wet sand, foam, cliffs and hill contours; stock on the shelves and on the ground, building sites that rise a course per morning, dressing by district, a cutaway interior on click, and buildings a citizen describes in a sentence drawn by Recraft's vector model or picked from a pattern book of thirteen, off by default.
- Citizens drawn from parts: a jointed rig with a walk and a run, a face that turns to whoever is talking, blinks, frowns with hunger and lifts at a wedding, the tool of the trade moving like the trade, the last thing picked up in the other hand, a coat and scarf in winter, bodies that age, beards, glasses, hair colours, wear that shows a roof, a trade or empty pockets, twelve poses, portraits drawn once and kept, and a model sheet at /rig.
- Weather, light and the small life: rain, snow, wind, fog, storms and lightning, hoods and umbrellas, breath in the cold, snow that settles and melts, foliage that follows the season, dawn and dusk grades, stars and a moon with the calendar's phase, lamplight and bloom, a night shade the lamps and lit windows cut through, the sun and the moon lying on the water, embers, sparks, dust and pollen, a post stack with tilt-shift, grain and bars; the mill turns while worked, the chapel bell swings on Sunday, gulls, a cat, a dog, hens, a fishing boat, fireflies, bats and the lighthouse beam turning all night, and people who glance at the animals and kneel to them.
- Sound: procedural ambient sound with a toggle, effects from files under /sound with crossfaded loops and synthesized stand-ins where a file is missing, rain as thousands of scheduled drops, seven Lyria music beds per scene made through the Gemini API, and sounds placed on the island that fade with distance and pan to their side.
- A camera and a film route: drag to look, wheel to zoom, inertia, parallax, a cinema view that cuts on a new moment, a camera that follows the day, hand-lettered captions, a vignette and a minimap; /film shows the world with nothing over it, framed with ?at= and ?zoom= and lit with ?hour=, ?weather= and ?season=, and the one-minute film at docs/promo.mp4 and docs/promo.gif was shot there on an island of real minds.
- The landing page and the brand: the live world as the hero with the real clock and weather line, the six rules, the three beats of owning a citizen, eight rows of what the island does with pictures cut from the island, the frame-and-dot mark and lowercase wordmark in Familjen Grotesk, favicons drawn from the mark, a GitHub button with the live star count, and canonical links, Open Graph cards, robots.txt, sitemap.xml and JSON-LD.
- Boarding: the passenger stands live in the form, drawn by the same rig that walks the street, with a portrait, a skin tone, poses to try and a surprise button, a reason for coming and a line in their own voice, standing instructions, the ticket written before signing in and kept across it, the plan bought right after on Stripe's page, and an own key with models and a daily cap taken inline.
- Deploy: deploy/do.sh builds two images for DigitalOcean App Platform, the town under /engine and the web at /, with unique image tags per build, the web built against UW_PUBLIC_URL, and the keys pushed once from .env with deploy/do.sh secrets.
- The open source surface: the Apache-2.0 license, the protocol spec, world packs as data with docs/world-packs.md, a contributing guide, a code of conduct, a security policy, issue, pull request and discussion templates, code owners, dependabot, and a README with the six rules, a configuration table and the first morning's record quoted line for line.

### Changed

- The island was renamed twice, from Ferry Town to Small Hours and then to Unwatched: the package scope is @unwatched, the environment prefix is UW_, the repository and the app are unwatched, and the address is unwatched.world.
- The product stopped saying ferry: people are sent to the island, they arrive and they leave, the sign-in is the harbor office, and the boat stays a boat in the world; the world was repainted in the brand's family.
- The landing, the rules page, the front page, the README and the boarding copy were rewritten plain, and now say which text the citizens write and which the code does.
- Nobody thinks for free: an account with no plan has a citizen on habit alone, the wallet plan defaults to none (migration 0010), a Patron's careful thoughts and reflection go to Opus, and the portrait and the voice come only with Resident and Patron while house citizens keep both.
- Generated building drawings are off by default and the hand-drawn set is the island's look; the light and weather effects are on by default with ?fx=0 for the plain drawing, and the sea was calmed to the drawn colour that only breathes and catches the light.
- The protocol accepts what a mind is likely to say: people and places may be named as a person would name them, longer strings are allowed, plan steps may leave a field out, a build may carry a look, and apply, say and trade need fewer fields.
- The jobless walk to one place with work instead of re-picking every minute, a gathering about to begin outranks any heading, storms stop the sea and the land and rain and snow halve them, a citizen alone is not told to talk, and the sleeping are indoors and off the street unless they sleep rough.

### Fixed

- The engine and the clock: the nightly re-wake loop, plans that did not survive a restart, the day following the minute counter across skips and restores, an island a minute ahead of the real clock waiting for it instead of skipping a day, and the clock carrying the sky as soon as it is fetched.
- The record: the store probes the service key at startup instead of failing every write, a replayed record is pruned on restore, an island with no people in its record is seeded rather than restored empty, a failed restore stops the server instead of seeding over it, a leaving by boat or by death is written at once so a restart cannot bring them back, agent ids carry the island's name so two islands on one record never collide, and dev owners survive restarts.
- What minds ask for most is no longer rejected: a say with only a name pairs the two for a conversation, a bare trade buys the cheapest food where they stand, asking for work without naming the post takes whatever is open, and a schema mismatch logs the field, the path and the text.
- Sign-in: dev owner names are header-safe slugs so diacritics no longer break every request, the deploy bakes the public sign-in keys in and refuses without them, a keyless build says the office is closed, the gate returns you to where you were, and a refusal is a door to the office instead of a red line.
- Deploy and CI: no env file from any package reaches the image, which had baked the web's dev-owner flag into production; image tags are unique per build so the platform pulls new images; the container runs node directly so SIGTERM reaches the town and it snapshots before a deploy; the CI concurrency group is YAML that parses and pnpm's version comes from package.json.
- Drawing: the world survives a strict-mode mount and fills its frame, rain and snow are sprites after the particle container drew them ten times too large on a retina display, the light filters are bound to the screen after retina filled a world-sized texture every frame, trees are planted in the town's season from the first frame, the hour preview applies only when asked for, portraits are framed on the face, and name tags and place names are ink on paper so they read on any ground and in the dark.
- The boarding form: the fourth step buys the plan chosen and sends an own key or own brain to the page that takes it, button hovers come from theme tokens so a hover on dark no longer flashes light beige, a skin tone picked as an index maps to the palette instead of painting the face black, the mark's frame follows the text colour on dark, and the saved ticket is read after the first paint so the page hydrates clean.

### Breaking

Changes to the own-brain protocol during this release, for a brain written against an earlier commit.

- The perception's place.ferries_to is now place.boats_to, and the event kinds ferry.dock, ferry.depart, ferry.cargo and ferry.news are boat.dock, boat.depart, boat.cargo and boat.news.
- The packages moved from @ferrytown/* to @smallhours/* and then to @unwatched/*, and the SDK and the Python citizen read UW_TOKEN and UW_STREAM_URL where they read FT_ and then SH_ names.
- self.mortal left the perception when everyone became mortal; self.days_hungry and self.weak remain.
- The plan answer is waited for twelve seconds instead of thirty; a slower answer and the day runs on habit.

[Unreleased]: https://github.com/kresogalic8/unwatched/compare/v0.16.0...HEAD
[0.16.0]: https://github.com/kresogalic8/unwatched/compare/v0.15.0...v0.16.0
[0.15.0]: https://github.com/kresogalic8/unwatched/compare/v0.14.1...v0.15.0
[0.14.1]: https://github.com/kresogalic8/unwatched/compare/v0.14.0...v0.14.1
[0.14.0]: https://github.com/kresogalic8/unwatched/compare/v0.13.0...v0.14.0
[0.13.0]: https://github.com/kresogalic8/unwatched/compare/v0.12.0...v0.13.0
[0.12.0]: https://github.com/kresogalic8/unwatched/compare/v0.11.0...v0.12.0
[0.11.0]: https://github.com/kresogalic8/unwatched/compare/v0.10.2...v0.11.0
[0.10.2]: https://github.com/kresogalic8/unwatched/compare/v0.10.1...v0.10.2
[0.10.1]: https://github.com/kresogalic8/unwatched/compare/v0.10.0...v0.10.1
[0.10.0]: https://github.com/kresogalic8/unwatched/compare/v0.9.0...v0.10.0
[0.9.0]: https://github.com/kresogalic8/unwatched/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/kresogalic8/unwatched/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/kresogalic8/unwatched/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/kresogalic8/unwatched/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/kresogalic8/unwatched/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/kresogalic8/unwatched/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/kresogalic8/unwatched/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/kresogalic8/unwatched/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/kresogalic8/unwatched/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/kresogalic8/unwatched/releases/tag/v0.1.0
