# Live harbor polish

Implemented in the existing `/town` renderer, not a study route:

- `harbor-detail.ts` adds deterministic limestone paving, edge moss and rubble around existing harbor-area buildings. All ground details are clipped to land and have no collisions or changed elevation.
- Ground puddles respond to the renderer's existing accumulated wetness. Ripple geometry updates at 8 Hz while wet.
- A spatially shared breeze drives decorative rowboats, tree sway and laundry. New motion uses elapsed time and honors reduced motion. The ferry, passenger positions and agent locomotion are unchanged.
- Decorative rowboats near an actual pier receive tether lines that follow their bobbing.
- The existing building atlas now bakes limewash grain and worn foundation stones directly from the editable SVG source. The older pattern was removed by the atlas exporter.
- Atlas URLs carry content hashes so changed drawings aren't hidden by browser caching.

Local review: `/town?at=harbor,-90,-30&zoom=1.45&hour=16`. The hour parameter changes rendering light only; town data remains live. This is an incremental material/detail pass, not the complete handmade-art replacement.

Validation: web typecheck and 58 existing web tests passed. No production deployment or simulation data writes.
