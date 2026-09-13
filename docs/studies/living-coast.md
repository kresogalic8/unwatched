# Living coast — actual town renderer

Implemented locally in `World.tsx` and `world/coastal-life.ts`.

- 18 schools of seven fish follow the island's own shoreline geometry. Boat proximity and moving citizens disperse a school; it settles back toward its coastal route afterward. Fish bodies are excluded from land.
- 26 small crabs patrol the shoreline and retreat when a moving citizen comes close.
- Submerged grass, restrained moving highlights, shells and pebbles give the shallows a readable scale.
- Six bobbing mooring markers have corresponding reflections and water rings.
- Actual citizens leave alternating, fading footprints while walking on the coastal sand. Teleports do not draw tracks. At most 160 footprints remain alive for 24 seconds.
- Existing olive trees and cypresses now participate in the same planting lifecycle and travelling breeze as other trees.

The ecology is visual ambience, not simulation inventory, catches or new citizens. There are no model requests, new network requests or database changes. Fish visibility falls at night and in bad weather. Geometry updates are capped at 30 Hz and elapsed simulation time is clamped; reduced-motion freezes movement while still allowing weather/lighting appearance updates.

Fishing is a separate future simulation feature. The current island has a fish-gutter job and fishhouse production, not an explicit rod-fishing action. Do not force a citizen to fish or show a successful catch without a corresponding real action and result.

Next coherent systems to consider:

1. Voluntary fishing: validated location, equipment, time spent, skill progression, real catch/inventory events, then casting and reeling animation.
2. Visible work: occupational tools and activity driven by actual current actions, distinct from merely having a job.
3. Weather consequences: wet clothes, sheltered gatherings and footprints/material response, grounded in where citizens actually move.
4. Shared spaces: seated conversations, passing goods and local gatherings whose participants come from simulation events.
5. Persistent signs of inhabitants: actual gardens, projects and changing shop stock reflected on the map.

Review: `/town?at=harbor,-350,-80&zoom=1.15&hour=16`. The hour is only a lighting preview; citizen state stays live.
