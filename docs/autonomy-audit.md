# Unscripted autonomy observation

## First live run: 13 September 2026

**Incomplete.** Six citizens were observed from day 1 at 06:00 to day 2 at 00:00: 1,080 simulated minutes (18 hours), including their first nightly reflections. The requested three days did not finish. The newspaper model timed out after two 30-second attempts; the observer refused its fallback and stopped. This is a partial observation, not a successful multi-day autonomy test.

The run used the engine at commit `b0a50ee0d120f175a69b121270e4fd583f884070`, seed 7, the first six standard personas, and real OpenRouter responses. No owner letters, project seeding, assigned actions or altered world stock were used. Routine, stakes and reflection models were respectively `anthropic/claude-haiku-4.5`, `anthropic/claude-sonnet-5` and `anthropic/claude-opus-5` (configured slots, not evidence that every slot handled a decision).

To bound spending, daily thought budgets were **8 routine / 2 stakes**, versus engine defaults of 50 / 5. The initial world was winter, Sunday, with stocked food, 40 coins per citizen and three prepaid inn nights. Those conditions and the short duration limit conclusions about work, scarcity, building and harvests. Conversations also use the routine budget.

## What actually happened

| Observation | Count |
| --- | ---: |
| Successful model decision responses | 46 |
| Accepted decision actions | 44 |
| Rejected decision actions (listener out of earshot) | 2 |
| Model-selected moves / speech / purchases / job applications | 33 / 8 / 2 / 1 |
| Generated conversations / nightly reflections | 5 / 6 |
| All successful food purchases, including habits | 12 |
| Citizens with jobs at the end | 1 of 6 |
| Shared garden proposals | 0 |
| Decisions offering `start_project` | 0 |
| Decisions offering `teach` | 7 |
| Explicit teaching / checked advice / changed food-route records | 0 / 0 / 0 |

An option appearing in perception is not proof that every target would validate. Zero garden proposals is especially inconclusive: no recorded model decision offered that action. Zero changed routes also does not invalidate the separate controlled learning tests.

All six citizens ate, slept at the inn and ended with 38 coins and no accumulated starvation. Ivana took the chandlery clerk job (event 66). The council selected Luka as mayor (event 136); this is an engine election outcome, not a model-invented public office. Citizens generated personal project descriptions overnight, but these are intentions and reported progress, not evidence of completed construction.

The run made 64 logical Brain calls: 6 plans, 46 decisions, 5 conversations, 6 reflections and 1 unsuccessful newspaper call. Provider usage recorded 64 successful HTTP responses, 407,797 prompt tokens and 27,134 completion tokens; response counts can differ from logical calls because schema repairs and retries exist. This is not a dollar-cost estimate.

## Main finding: narrative can become unsupported memory

Petar and Luka discussed repairing the mill roof and paying for planks. In his first nightly reflection (event 528), Luka then described personally seeing soft beams and holes large enough for an arm. His personal project's progress repeated that he had seen the damage.

The initial mill had no `brokenUntil` flag. The ending mill still had no such flag, held 24 flour and 12 grain, and had no construction site. The action record contains no repair or accepted labor offer. Thus the purported physical observation is unsupported by this run's state and events.

The starter personas already describe a broken mill roof as a desire and backstory. The conversation prompt includes personalities, today's intentions, memories and trust, but does not supply the mill's actual condition. Nightly reflection stores generated summaries and project progress as memory. This provides a plausible path from inconsistent backstory through dialogue into apparent experience; it does not establish that all narrative inaccuracies have this cause.

Characters may lie or hold false beliefs. The issue is keeping those statements distinct from verified observations. Food receipts already have engine-derived evidence; general narrative memories do not have equivalent grounding. This run demonstrates retained purchase experience, but does not demonstrate social knowledge transfer, successful self-directed construction or broader improvement from experience. None of these mechanisms trains model weights.

## Next priorities

1. Reconcile starter backstories with world state and distinguish witnessed events, reported speech, beliefs and intentions in reflection context. Require evidence before reporting physical work as completed. Preserve the ability to lie and be mistaken.
2. Examine why intentions fail to reach executable actions. Existing `offer` / `accept` / `settle` actions should remain voluntary; do not silently turn dialogue into binding promises or assign projects to manufacture success.
3. Complete a longer observation after addressing the newspaper timeout. Then compare ordinary and reduced thought budgets, measuring where decision opportunities arise. A second seed and longer window are necessary before generalizing about emergent cooperation.

## Reproduction and evidence

From the repository root, with existing OpenRouter configuration available:

```sh
node --import tsx apps/headless/src/autonomy-audit.ts --live --days 3 --agents 6 --seed 7 --max-calls 400 --out out/autonomy-live-new
```

This calls paid models. The cap bounds logical Brain calls, not HTTP attempts or cost. Use a new, empty output directory. Omit `--live` for a mock instrumentation check; mock runs are never evidence of live-model autonomy. The utility stops on a reported model fallback or call cap and returns exit code 2. In-flight calls can finish before the current tick ends.

Local evidence is retained under `out/autonomy-live-7/`: `decisions.jsonl`, `events.jsonl`, `snapshot.json`, `report.json` and `report-corrected.json`. These ignored artifacts are not committed public fixtures. The original report mislabeled absolute simulation minute 1440 as elapsed time; the corrected report subtracts the known starting minute 360. The original is preserved, and no simulation behavior was changed by that metadata correction. The utility now records start time and elapsed minutes separately and freezes initial persona metadata before reflections can change it.

Validation: the headless TypeScript check passed; a three-day mock instrumentation run completed; a one-call cap check stopped with explicit incomplete status. These checks validate the observer, not autonomous behavior. No production behavior, deployment or release was changed for this audit.
