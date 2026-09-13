# Citizens shape places

Local implementation, not deployed. The current web development configuration reads the production engine, so new engine decisions will not appear there until the engine is deployed too.

## Persistent changes

`decorate:{what,why}` lets a citizen add flowers, a bench or a cairn at their current public outdoor place or owned property. It is optional in perception and described in the cognition prompt; no routine forces agents to use it.

Flowers cost two coins. Benches cost three coins and two carried planks. Cairns use loose local stones. Work is refused in storms, during construction, when severely hungry, on somebody else's property, after six additions at a place, or after the same citizen has added something there that day. Payment moves to the place treasury. Success emits `place.decorated`, records the author's public name/reason/day, and enters memory and nightly action evidence.

The records are retained in the existing place snapshot JSON, including Supabase storage; no migration is necessary. Restoration explicitly preserves them. Rendering positions stay on land. Benches become available to the existing visual seating system.

## Visible scenes and reactions

Actual give events produce mutual attention/gestures; eating events produce eating poses. Existing conversations, voluntary garden work and gatherings remain authoritative. Cancelled gatherings no longer create scenes, and absent leads are excluded. Walking produces bounded dust puffs or wet footfall rings; coastal tracks and wildlife continue using actual observed movement.

This does not add autonomous rod fishing, musical performance, opening-door artwork, or custom animations for every possible activity.

## Rare natural moments

Summer bioluminescence occurs every fifth evening (day modulo five equals four), from 21:00 until 03:00 the next morning, in clear or windy weather. A shared protocol predicate drives rendering and agent perception. The engine emits an observation at 21:00 when conditions match. Agents remain free to respond or ignore it. The additive surf light and fish trails do not invent catches or citizen reactions.

For visual review only: `/town?at=harbor,-350,-80&zoom=1.15&hour=22&season=summer` on an eligible day. These query overrides change the visual preview, not the simulation clock or weather.

## Place memory

Click a place, then **What happened here?**. Recorded small additions can be scrubbed from zero through the present directly on the map, with author/day/reason. Closing the panel or selecting another location restores the current view. Existing construction records still link to the construction replay. The scrubber reconstructs recorded additions only, not full historical positions of citizens or terrain. Empty histories are shown honestly.

## Verification

- Four new engine tests cover material/payment accounting, perception, snapshot restoration, invalid actions, permanent limits and natural-phenomenon timing.
- Full engine suite: 96 tests passed. Web suite: 58 tests passed.
- All eight packages typechecked; final web rendering changes typechecked separately.
- Browser review covered the actual town, place-panel empty state and summer/night preview. Populated decoration records and restoration are verified in isolated engine tests; production records were not seeded.
