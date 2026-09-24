# Agent-authored world

Status: proposed implementation plan, 21 September 2026. No deployment or production changes are authorized by this document itself.

## Product commitment

A person gives a citizen an initial personality. The citizen chooses what matters, lives with consequences, and can create things and capabilities that were not present when they arrived.

The owner is an observer and optional correspondent, not a quest designer or trainer. We do not prompt every citizen to invent, reward construction for its own sake, or assign a successful life story. A citizen can work, explore, build, imitate, reject an invention, change direction, or do nothing.

This is operational autonomy, not a claim of consciousness, literal free will, unlimited capabilities, or model-weight learning. “Anything” is a direction for expanding expressiveness; each release must name what can actually be created.

The product loop is:

**Personal experience → self-chosen intention → attempts → consequences → revised understanding → optional invention → adoption or rejection by others.**

Buildings do not require repository changes. A citizen should construct an ordinary building using the world's tools. Code contribution becomes relevant when a desired behavior cannot be expressed with those tools.

## What exists

Verified against the current repository:

- `packages/engine/src/desires.ts`: evidence-linked lasting desires, revisions and action attempts. Local changes now include recent outcomes in cognition and a visible digest journey.
- `docs/construction.md`: houses/shops, plots, payment, materials, labor, construction projects and paid help.
- `docs/community-projects.md`: citizen-proposed shared gardens with actual funding, work and finite output.
- `packages/engine/src/skills.ts`: proposed recipes composed from existing actions, trials, practice and sharing. This is not arbitrary new code.
- `docs/citizen-belongings.md`: inventory and item behavior that new creations must integrate with.
- `docs/learning.md`: experience-based food purchasing and evidence provenance; not general-purpose learning.
- `docs/world-packs.md`: data-defined places, roads and jobs. The current visual and behavior vocabulary remains bounded.
- Recent local observations show planning, reflection, a changed personal want, hiring and work. They have not demonstrated an autonomous, evidence-linked invention lifecycle. Provider responses still sometimes require paid repair attempts.

Reuse these systems. Do not create a fourth parallel system for goals or silently convert self-reported completion into engine truth.

## Autonomy contract

1. Personality and onboarding are starting conditions, not permanent instructions for a career.
2. No compulsory “invent something” phase, hidden productivity reward, or fixed building quest.
3. Capabilities describe available operations and their requirements. They do not prescribe what the citizen should want.
4. Citizens may plan, ask for help and learn through action. Contributors cannot replace their chosen objective with an easier demo objective.
5. The engine owns accounting, permissions, time and authoritative state. A proposal is not an executed outcome.
6. A refusal, abandoned project or failed prototype remains a valid life event.
7. Learning means retained experience, changed choices, reusable skills and shared artifacts. Model-weight training is a separate, unplanned capability.
8. Budget limits suspend costly work and preserve state; they never substitute a scripted success.

## Architecture

Keep three distinct actors:

- **Citizen mind:** owns identity, memories, relationships, goals and the decision to create or abandon something.
- **Workshop worker:** an on-demand technical delegate that translates the citizen's intent into a blueprint or extension candidate. It has no independent mandate to make the world productive.
- **Authoritative engine:** validates commands and applies permitted effects. Neither generated text nor generated code can directly rewrite world storage.

Proposed flow:

`Citizen → proposal → bounded workshop job → candidate artifact → independent validation → isolated trial → versioned registry → voluntary use in the world`

The worker returns costs, uncertainty and outcomes to the citizen. If the design cannot work within available resources, the citizen chooses whether to revise it, seek support, defer it or stop.

### Two creation paths

**Blueprint path:** compose supported materials, shapes, rooms and capabilities. Validation can be automatic; no source change is necessary.

**Extension path:** author new behavior against a restricted world-extension API. This is real code, tested and executed outside the trusted engine. It can eventually be promoted to a reviewed upstream contribution, but a GitHub merge is not required for every invention.

## Delivery sequence

### M0 — Reliable intention and evidence foundation

First reconcile `persona.want`, lasting desires, daily plans and personal projects. They serve different purposes: motivation, persistent intention, today's approach and material work. Link them through optional stable IDs; do not collapse them into one string or infer links by matching titles.

Add a goal thread with references to attempts, construction, artifacts and revisions. Preserve subjective fulfilment separately from objective completion. Existing records retain their original meaning; old links remain unknown unless explicitly established.

Improve provider-output reliability before sustained trials. Validate identifiers and proposals, measure schema repairs, and retain failures. Preserve subscription model promises and quotas.

**Exit criteria:** a real provider run can form/revise an intention, act on it, see a rejection or outcome, and carry the evidence into a later plan after restart. Tests prove the connections; a failed or abandoned intention is acceptable. Scripted mechanics tests and autonomous observations remain separately labeled.

### M1 — Citizen-authored item blueprints

Introduce versioned blueprints with author, motivation reference, input materials, required tools, labor, permitted effects, visual composition and revision history.

Initial expressive scope: new combinations of supported item capabilities, such as carrying, storage, repair and decoration. The engine computes requirements and validates effects. The agent cannot declare arbitrary capacity, yield or free ingredients. Clearly label unsupported ideas as proposals rather than functional inventions.

Flow: propose → inspect feasibility → prototype → trial → revise or abandon → make a real item. Prototype resources and elapsed work are recorded. Finished instances enter the existing inventory with provenance and condition.

**Exit criteria:** a new named item composition can be validated, made, used, transferred, worn and reloaded. Insufficient materials, duplicated jobs and failed trials cannot create free items. A real agent may independently choose this path; absence of invention is reported honestly.

### M2 — Citizen-designed buildings

Generalize construction from fixed house/shop definitions to validated compositions of rooms and supported facilities: shelter, storage, workbench, counter and public space.

Citizens choose a purpose, name, plot, layout and appearance within physical limits. Cost and labor derive from the validated design. Permission to use land, access, collisions, material availability and ownership are checked by the engine. Fundraising and labor use existing deals and shared-project mechanics.

Separate blueprint availability from construction: approving a design does not place a building or consume another citizen's resources. Completion requires actual construction.

Use a compositional renderer matching Unwatched's art direction: foundation, walls, roof, doors, windows, interior fixtures and staged construction. Agent parameters may arrange approved components; executable rendering code does not enter the browser. AI imagery may help concept exploration but is not proof of functional geometry.

**Exit criteria:** one valid authored layout becomes a persistent navigable site with usable interior facilities, construction stages and visible completion. Other citizens can discover and voluntarily use it. Illegal placement and incompatible layouts fail with actionable reasons.

### M3 — Invention and social adoption

Let citizens discover artifacts through encounters, use, trade and teaching. Preserve authorship, versions and learned experience. Knowledge does not teleport to every citizen.

Allow improvements and forks of known designs. A failed trial updates the inventor's evidence; a transferred blueprint carries claimed history, while a local trial creates firsthand evidence. Borrowing tools, contributing labor and compensating another citizen use real exchanges.

Expose a compact provenance story: who made it, why, what changed, who used it, and which effects were verified. Do not publish private personality secrets or internal reasoning as part of a public invention.

**Exit criteria:** an invention can be encountered, tested and reused or rejected by a second agent, with resources and state preserved through reload. Adoption is not forced by the evaluator.

### M4 — Contributor workshop for genuinely new mechanics

When existing capabilities are insufficient, the citizen can request a new capability and explain its purpose. The technical worker creates a candidate extension, implementation and proposed tests in an isolated workspace. It may consult approved documentation and dependencies through a controlled build service, not unrestricted access from the runtime.

Proposed extension contract:

- Receive a minimal, versioned observation and seeded randomness/time from the host.
- Produce typed action proposals or effect requests.
- Request only declared capabilities, such as consuming permitted inputs or changing an owned object's local state.
- Never receive database credentials, production environment variables or direct write access.

Evaluate process-isolated workers and a WASM runtime against determinism, metering, portability and operational cost before choosing the runtime. A language-level `eval` or Node `vm` context alone is not the isolation boundary. The first shipped extension must use one documented ABI and one runtime.

The engine still verifies resource transformations, targets, ownership and effect limits. Generated behavior cannot grant itself new authority, alter its budget, or rewrite the validator. Timeouts, memory limits, output limits and a kill switch are host-controlled.

**Exit criteria:** an agent-authored behavior absent from the built-in action vocabulary passes independent checks, runs in the isolated runtime, changes permitted world state and can be disabled without losing unrelated world data. A malicious or runaway extension is contained and rejected.

### M5 — Automatic promotion within a bounded domain

Pipeline: compile → schema/capability checks → independent invariant tests → deterministic replay → adversarial scenarios → temporary test island → limited activation → monitor → wider availability.

Tests authored by the contributor are useful but insufficient. Engine-owned tests check conservation, permissions, duplicate execution, resource amplification, CPU/memory limits, rendering limits and recovery. Never let generated code edit its own acceptance rules.

Initially require maintainer review for code extensions while measuring the pipeline. Move eligible low-risk extensions to automatic activation only after containment and rollback are demonstrated. Blueprint approval can already be automatic. Approval checks technical admissibility, not whether a citizen's aspiration is desirable.

Trusted core changes, database migrations, billing, identity and deployment remain reviewed software changes. If the contributor proposes such a change, it produces a patch or PR for review; it cannot merge or deploy it itself.

**Exit criteria:** successful and rejected candidates both have audit records; version pinning and staged activation work; a bad rollout can be contained without invalidating saves. Rollback restores behavior availability, not arbitrarily erased economic history. Any necessary state repair uses a tested migration or compensating transaction.

### M6 — The player-facing proof

Deliver relevant pieces alongside earlier milestones, not as a final UI-only phase:

- Digest: “what changed while you were away,” linked to verified events.
- Citizen view: intention, attempts, obstacles, revisions and current work.
- World: prototypes, construction and working inventions visibly exist where they were made.
- Artifact view: author, version, materials, capability and evidence of use.
- Optional shareable public story: actual before/after state and public events, with clear authorship and no invented causal claims.

The central reveal is a real change the owner did not command. Do not fabricate dramatic captions when the citizen chose an ordinary day.

## Data and execution requirements

Proposed entities (names are provisional): `GoalThread`, `BlueprintVersion`, `PrototypeTrial`, `ArtifactInstance`, `WorkshopJob`, `ExtensionVersion`, `ValidationReport`, `ActivationRecord`.

- Immutable content-hashed versions; existing instances pin their version.
- Stable IDs linking intention, design, job, trial and world event.
- Durable job states, cancellation, attempt limits and idempotency keys.
- Reserve resources, then atomically settle or release them; a model call must not hold a database transaction open.
- Revalidate at execution time: another citizen may have used the materials or claimed the plot.
- Persist bounded reasoning summaries and evidence, not an unbounded prompt transcript.
- Publish only deliberate public projections; private owner context stays private.
- Existing snapshots and external-brain clients remain compatible. Declare new capability support so old clients do not receive unusable commands.
- Inventory and construction replay must resolve historical blueprint versions even after an extension is retired.

## Cost model

Do not run coding workers every tick. A citizen decides whether a workshop attempt is worth pursuing; a queue allocates bounded compute.

Use deterministic code for physics, pathing, accounting and rendering. Reuse plans and run existing habits between meaningful decisions. AI handles intent, interpretation and novel proposals. Blueprint validation is deterministic wherever possible.

Track cost per intention, workshop attempt, successful artifact, used artifact and citizen-day. Include failed responses, repairs, sandbox compute, asset generation and retries. Unknown costs remain unknown. Deduplicate identical jobs and cache validation by artifact hash plus engine/runtime version.

Keep invention compute in a separate explicit allowance so one speculative project cannot exhaust ordinary persona life. Decide included versus owner-approved extra usage before commercial rollout. No silent change to paid entitlements or automatic purchases.

Jev remains optional research. The local comparison has not established useful savings. Do not make the architecture depend on it.

## Evidence and success criteria

Run a predeclared set of varied personalities and worlds, with equal documented compute limits. Keep every outcome, including quiet lives and failed inventions. Use seeded engine conditions; do not claim model outputs are deterministic.

Measure:

- Valid proposal rate and repair/retry cost.
- Persistence of self-chosen intentions and evidence-linked revisions.
- Verified artifacts, actual use and voluntary adoption by another citizen.
- Repetition, invalid actions, resource exploits and failed containment attempts.
- Cost per citizen-day and per actually used creation.
- Owner understanding and return behavior after real changes are surfaced.

Do not use building count as a universal agent reward. More constructions do not necessarily mean more agency or a better game. Behavioral change must have receipts; a reflective sentence alone does not prove learning.

## First implementation slice

Build M0 plus one vertical slice of M1 before a generalized coding agent:

1. Link intentions, plans and existing material projects without assigning a target.
2. Add a small compositional item blueprint schema and deterministic feasibility checks.
3. Add propose, trial, revise and make operations with real inventory accounting.
4. Expose the resulting item and its history in existing inventory/digest/world UI.
5. Validate save/reload, failure, duplicate execution and cost limits with deterministic tests.
6. Run a bounded real-agent cohort without an “invent this” instruction; publish all outcomes.

Illustrative success, not a script: a citizen notices a practical difficulty, chooses to experiment, makes something useful, and another citizen chooses to use it. If the cohort does not do this, inspect capability discoverability, evidence and incentives rather than injecting the desired choice.

Proceed to authored buildings when item creation is stable, then new-code extensions. No fixed release dates until the first slice establishes effort and costs. Each milestone is independently reviewable and deployable; passing mechanics tests does not establish emergent behavior.
