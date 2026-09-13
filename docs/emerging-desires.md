# Emerging desires — v0.13

A citizen can develop a lasting want during their existing nightly reflection. Onboarding remains their starting personality; no career, romance, quest, or successful outcome is assigned by this feature.

## From experience to choice

1. The engine supplies up to 24 personal event records to the existing reflection call. Private letters, reflections, self-rewrites and self-reported notices are excluded as grounding sources.
2. The citizen may propose at most two changes with a title, reason, state and one to three event IDs. All references must resolve to supplied personal experiences. Events establish experiences, not the truth of the citizen's interpretation.
3. At most three desires can be active. Omission preserves a desire. A citizen can set one aside, return to it, or report feeling fulfilled. An existing desire can change at most once per island day.
4. Morning planning and ordinary decision prompts receive a compact summary. The citizen may pursue a desire or prioritize something else. External brains receive the same optional context.
5. An action proposal can include `desire_id`. The engine records whether the actual chosen action was accepted and retains its associated event text. This never bypasses validation or treats an accepted action as fulfillment.
6. The owner can inspect desires, reasons, recorded experiences and attempts in the digest. They are absent from the public citizen view.

`fulfilled` means the citizen feels fulfilled; it is not engine verification of a goal, building, skill, mutual affection, or other world change. No new emotion engine or expanded skill system is claimed in this release.

## Compatibility and cost

- Additive optional fields: `Reflection.desires`, `ActionProposal.desire_id`, `Perception.self.desires`; external reflection messages include `desires` and `desire_evidence`, and planning messages include `desires`.
- Reflection update: `{ id?, title, why, state: "active" | "set_aside" | "fulfilled", evidence: number[] }`. Omit `id` only for a new desire; unknown IDs are rejected. Existing titles match case-insensitively when no ID is supplied.
- Old brain responses remain valid. Old snapshots restore with no desires. Desires persist in existing agent state JSON, requiring no database migration.
- No added model calls, cadence changes, plan allowances or provider spending limits. Prompt additions are bounded; they can still increase tokens per existing call.
- Up to eight retained desires, eight revisions per desire, eight attempts per desire. When full, an inactive desire is removed before adding a new one. This is a bounded recent history, not a permanent biography.
- Desires are private to the current island and do not yet transfer between islands.
- Citizens develop these only when their brain returns a valid update during an eligible reflection. Existing citizens are not retroactively given invented wants. Mock fallback retains existing desires and does not synthesize new ones.

## Validation

Engine tests cover evidence rejection, one-change-per-day, active limits, persistence and old snapshots, optional protocol fields, real rejected actions and reflection without extra calls. Server tests verify public views do not expose private desires or evidence.
