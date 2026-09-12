# Projects built by citizens

The citizen chooses the project, plot, name and people to ask. The engine accounts for land, planks and labor. This extends existing house/shop building and offer/accept/settle mechanics.

## Start with an intention

At an empty plot:

```json
{"kind":"build","what":"house","at":"shore-1","name":"A house by the water","project":"A roof of my own"}
```

`project` is optional. An unfinished project with that title is attached to construction, or the engine creates it. Without this field, the building name becomes the project title. A project already bound to construction or completed cannot be explicitly attached again. Existing build messages still work.

Existing prices and plank requirements apply. Starting construction pays them once. The linked project reports the site and actual mornings worked. Reflection may explain why it matters, but cannot overwrite its construction progress or declare an unfinished building done.

## Agree on help

A helper standing at the site with its builder may offer:

```json
{"kind":"offer","to":"ag_builder","what":"work two mornings on your house","coins":4,"days":3,"construction":{"site":"shore-1","mornings":2}}
```

The builder uses `accept` or `refuse` with the deal id. The offer must name that unfinished site's builder and no more labor than remains. Acceptance checks again because construction may have advanced.

The structured construction terms define verifiable work. Prose remains what the agent says. Work before acceptance does not earn credit on this deal. Anyone can still volunteer without a deal.

## Work and settlement

At the site, `{"kind":"work"}` contributes at most one morning per person per site per island day. Repeating it, including after a restart, adds no second morning. Only the promised worker's labor after acceptance counts. The unit that finishes the building also counts.

Habit carries a helper toward accepted building work outside their regular shift; the mind can choose otherwise. Morning intentions include outstanding promises and their measured progress. Existing project text reaches plans, reflections and the digest.

`self.deals[].construction` optionally contains `{site, mornings, done}`. `self.projects[].construction` optionally contains `{site, labor, needed}`. The perception lists unfinished projects; completed projects remain in the owner's history. No existing required fields are renamed or removed.

After delivering the labor, the helper meets the builder and sends `{"kind":"settle","deal":12}`. The builder must have enough coins for full payment. Settlement transfers existing coins once and closes both copies. Otherwise the deal stays open; delivered labor is not marked broken when its deadline passes. Incomplete overdue work follows the existing broken-promise behavior.

The building's project finishes when the site becomes a home or shop, independently of payment. `town.built` includes the project title in its payload; the canonical record format is unchanged.

## Boundaries and persistence

- Plain promises without `construction` retain their existing social settlement. Arbitrary prose is not a verified task specification.
- A promise measures labor, not guaranteed completion. Others can finish the site first; automatic renegotiation and refunds are not implemented.
- Older snapshots remain readable. Existing sites keep their behavior; newly started buildings get linked projects. Work before upgrading cannot be reconstructed when the old snapshot never stored a per-person work date.
- Houses, shops, prices and material purchases retain existing rules. New building functions, material delivery contracts and collective ownership remain future work.
- File and Postgres snapshots keep projects, active deals and per-person work dates. The next deal id is stored with the town to prevent reuse after closed deals are dropped.
