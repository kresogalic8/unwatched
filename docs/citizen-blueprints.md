# Citizen-authored item blueprints

Local first implementation slice of the [agent-authored world plan](agent-authored-world-plan.md). Not deployed. This composes existing capabilities; it is not arbitrary code generation or autonomous buildings.

Citizens may choose `design_item` with `{spec:{name,purpose,modules},parent?,desire_id?}`. A proposal grants no object. Modules are distinct and limited to:

- `carry`: timber + two ropes; adds three backpack slots while equipped.
- `repair`: timber + stone; lets an equipped usable item repair a building with one plank instead of two. Each repair costs ten condition points.

A combined design pays both ingredient sets and combines the effects. Only one item can be equipped. Names and purpose are agent-authored; effects and costs are fixed by the engine. This is a bounded vocabulary, not unrestricted invention.

`prototype_item:{blueprint:ID}` consumes the exact material multiset, increases rest need by 0.1, and creates one usable prototype. The assembly occupies the ordinary action opportunity; no multi-hour labor simulation is claimed. `craft_design:{blueprint:ID}` requires an assembled prototype and pays the same materials for every subsequent copy. Assembly does not prove usefulness. Equipping and actually using it produce separate events. Prototypes cannot be repeatedly assembled for free; a second prototype call fails and another copy requires `craft_design` plus its materials.

Revisions use `parent` to create a separate content-hashed version. A citizen retains up to eight versions; there is no archive/delete workflow yet. Existing item instances retain their original spec. Materials cannot be spoofed by choosing a resource name: authored items carry a `[crafted]` suffix and are not interchangeable with raw ingredients. Ordinary trade rules still apply; a custom object does not acquire a guaranteed resale price or food value.

An optional `desire_id` must name the citizen's active desire. During normal thinking, design and assembly attempts inherit that link when the action proposal has no explicit link. An explicit proposal link can instead describe the citizen's current intent. Material completion never marks the desire fulfilled. General reconciliation of daily plans and legacy personal projects remains future M0 work.

Designs are stored in existing agent snapshot state; old snapshots default to no designs. Inventory instances carry author, version, spec and prototype provenance through gift, storage, drop/pickup and reload. The owner's existing Crafting tab shows personal designs; item details show capabilities and provenance. Perception exposes designs through `self.belongings.blueprints`; the ordinary cognition prompt explains operations without instructing citizens to invent. No added background model calls or changed subscription budgets.

## Verification and demonstration

`pnpm --filter @unwatched/engine exec vitest run test/blueprints.test.ts` verifies proposals versus real items, material conservation, insufficient supplies, duplicate proposals, valid capability effects, wear, revisions, giving, reload, old snapshots and intention-linked normal ticks. The full engine suite also covers existing inventory behavior.

The development-only `/experiments/blueprints` displays six engine-generated checkpoints using the production Inventory component. Regenerate from `apps/server` with `node --import tsx scripts/blueprint-preview.ts`. Choices are scripted and labeled; it proves mechanics, not emergent creativity. It uses no provider calls.

Next: evaluate bounded real-agent use without a requested invention; add cross-citizen blueprint learning with firsthand trials; reconcile goal references across plans/projects; then extend the capability vocabulary and authored buildings. Generated-code execution, rollout automation, new art assets and production release are not implemented by this slice.
