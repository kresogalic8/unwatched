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

## Outcome continuity (local update)

The next decision, morning plan and reflection now receive up to three recent attempts per desire, with two recorded outcomes each (240 characters per outcome). Older `last_attempt` clients remain compatible. Event kinds are optional in saved attempts, so old snapshots still load. No goal is marked fulfilled by the engine.

The owner digest displays a visible journey: the desire's origin, recent obstacles, and recorded actions/results. Its existing narrative prompt receives the same bounded context, explicitly distinguishing older attempts from events within the digest window. New event kinds label concrete changes; older records retain neutral action wording. No extra model calls are introduced, though existing calls carry additional bounded context.

`/experiments/life-story` is a development-only, interactive walkthrough using the actual digest component. Its choices and initial desire are explicitly scripted fixtures, not an autonomous-agent demonstration. Generate its engine-validated snapshots from `apps/server` with `node --import tsx scripts/life-story-preview.ts`. It does not change production citizens or call any provider.

## Real-provider observation — 21 September 2026

A bounded fictional-persona run is available at `/experiments/life-story/autonomous`, with its first run at `/experiments/life-story/autonomous/before`. Both used Haiku 4.5 for one reflection and six decisions, with no synthetic fallback. The persona did not form a desire in either run. First run: six movement actions, including repeated travel between council and market; 10 physical requests, $0.04318035 reported. Second run: three moves to the council, then three waits; 9 requests, $0.0280963 reported. Neither proves a completed goal, learning, retention or production cost savings. Calls are stochastic, and this is not a statistical comparison. Total reported cost of these two runs: $0.07127665.

The perception now carries six recent concrete personal outcomes from the last island day, including travel, independently of desire linkage. This covers a gap where semantic memory retrieval could omit repetitive movement. The decision prompt invites reconsideration without assigning a goal or forbidding waiting. No new paid calls are added. Large Anthropic schemas retain the prompt-only compatibility path with an explicit final output contract; malformed responses can still require repair or fail.

The runner uses controlled starting resources and defers free-form adjudication and conversations. It is not a full production tick/day scheduler. `node --env-file=../../.env --import tsx scripts/life-story-autonomous.ts` from `apps/server` makes real provider calls, at most 12 attempts with a $0.10 reported-cost cutoff before the next request (not an invoice ceiling). It overwrites the latest local report. Unknown billing remains unknown.

## Full engine observation harness

`apps/server/scripts/life-day-autonomous.ts` runs actual one-minute `Town.tick()` updates from 05:00 on day one through two midnights, including planning, needs, habits, action validation, nightly reflection, and the town paper. It uses one fictional citizen, four routine and one higher-priority thought per day, included planning/reflection, and Haiku in every slot. These are experimental allowances, not changes to subscriptions. There are no other citizens, so it cannot evaluate relationships.

The runner saves six-hour checkpoints to the development-only `/experiments/life-story/day` report. It stops on provider failure, unknown reported cost, 24 API attempts, or $0.10 reported cost before the next call. A final in-flight call can cross that cost threshold. A stopped run is shown explicitly and is never presented as a completed lifecycle.

Action schemas now offer `desire_id` only when active desires exist and constrain it to those exact IDs. An invented linkage returned when there are no desires is discarded as an unknown optional field, while the action itself must still pass its full schema. This avoids rejecting a valid action solely because the model invented a long desire title in an inapplicable linkage field.

### Full-engine result

The initial full-engine attempt stopped at minute 541 on a malformed action response ($0.0361046). After constraining desire linkage, the next run reached minute 1981 (day 2, 09:01), with 19 physical requests and $0.1003398 reported. The spending guard stopped the next request; the two-midnight target was not completed. Combined reported cost for these two full-engine attempts was $0.1364444.

Day one included exploration, buying/eating bread, sleep and reflection. In that reflection Mara changed her persona's `want` toward finding someone needing her skills. Day two included a revised plan, an unsuccessful attempt to speak to someone out of earshot, travel, hiring as a quarryman, and engine-recorded work. No persistent `desires` entries were created. This distinguishes a changed self-description and a verified job from an evidence-linked desire lifecycle. Wages and longer-term progress were not observed before the stop. Several model replies still needed JSON repair; response reliability remains a cost concern.
