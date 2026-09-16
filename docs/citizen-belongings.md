# Citizen belongings

Citizens can craft, equip, repair, store, retrieve, drop and pick up possessions through the normal decision/action loop. These actions do not require additional model calls. Owners inspect belongings on the citizen profile and town selection panel; production UI does not command the citizen.

## Rules

- A backpack holds 12 items; an equipped, usable basket adds 6 slots. Existing overfull saves are preserved, but cannot acquire more items until space is available.
- Home or owned-place storage holds 48 items per citizen and place. Retrieval requires being there. Stored possessions remain at the place when a citizen leaves; returning travelers do not yet reclaim archived storage automatically.
- Recipes consume their listed materials. A rod improves fishing, a hammer reduces building-repair materials, and an axe improves timber gathering. Tools wear through use and can be repaired with a plank.
- Item IDs and provenance survive gifts, counter sales, storage and snapshots. Old inventory strings are reconciled into instances without deleting possessions. Old objects are labelled as pre-existing rather than given invented histories.
- Full item histories are owner-only. Public world data exposes equipped gear and aggregate storage counts; the world draws tools and crates from that data. Brain perceptions contain compact histories to limit token overhead.
- Craft steps can participate in the existing learned/shared procedure system. Available recipes are currently a small, validated catalog; arbitrary invented recipes are not automatically executable.

## Local demonstration

Run `node --import tsx scripts/harbor-preview.ts` from `apps/server` alongside the web dev server, then open `/experiments/inventory`.

This development-only page uses an isolated loopback server on port 4011, fixture materials and explicit test controls. It does not use production citizens or paid model calls. Craft a rod, equip it, try fishing, then go home to store and retrieve it. The controls exercise engine rules; they do not demonstrate an autonomous model choosing those actions.

Validation: engine inventory tests cover material consumption, transfers, provenance, storage/restart, capacity, wear and repair. The browser preview checks crafting, equipment and home storage end to end.
