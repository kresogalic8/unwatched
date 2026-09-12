# Watch what they built

`/built` replays construction recorded on the current island. `/built/:place?through=N` opens a specific building through a fixed milestone, starting on that milestone. `/built/demo` plays the committed 30-day **mock** recording without an API server, account or model key. The landing page and a building's map panel link to the record.

The player has play/pause, keyboard-accessible scrubbing, a single-building illustration, an overview of recorded plots, chapter links and an SVG picture download. Playback compresses gaps between events, targeting roughly a minute for a recording with many milestones. It starts paused. The drawings are architectural reconstructions of measured labor, not footage of historical citizen positions or a simulation rerun. The overview uses current map coordinates and shows only plots with a construction record.

## What survives

Each newly started building gets `Place.history`, with its public name, project title, builder name, land/material cost, plank count and needed labor. The engine appends numbered milestones for starting, actual work (including the final morning), formal construction offers, acceptance/refusal, payment and broken promises. Payment at another location follows the construction deal back to its site. Participant names are captured when events happen, so departure cannot rewrite a caption.

The history is saved in the existing place snapshot by both FileStore and Postgres. It does not rely on the rolling event log, database event ids or current agent names. `through=N` excludes later milestones; published chapter content stays the same as work continues. The archive lasts as long as the island's snapshots/backups. Deleting or resetting an island deletes its record; there is no independent external archive.

The public endpoint `/api/construction` lists recorded buildings. `/api/construction/:place?through=N` returns a bounded chapter; invalid bounds return 400 and absent records/moments return 404. This archive explicitly collects only construction event kinds and selected facts. It never copies event payloads, private intentions, persona secrets, reflections or letters. Ordinary prose promises are not treated as verified building work.

Older sites have no recoverable labor history. No retrospective scenes are invented for them. Histories start with new buildings after this release; they describe construction, not subsequent fire damage, ownership changes or demolition.

## Reproduce the demo

From the repository root:

```sh
node --import tsx apps/headless/src/soak.ts --days 30 --seed 3 --tick 1 --out /tmp/unwatched-replay
cp /tmp/unwatched-replay/construction.json apps/web/public/demo/construction.json
pnpm --filter @unwatched/web dev
```

Open `http://localhost:3000/built/demo`. The committed recording has six started houses, four finished, across 32 milestones. Its source is explicitly labeled mock. Do not present it as a live-model experiment. Keep this recording fixed once shared: replacing the demo would change its chapter links.

## Model opportunity probe

```sh
node --import tsx apps/headless/src/construction-probe.ts --out /tmp/unwatched-probe
# Opt in to at most eight decisions through the configured OpenRouter routine model:
node --import tsx apps/headless/src/construction-probe.ts --live --out /tmp/unwatched-probe-live
```

The probe creates two synthetic citizens and a prestarted house, with no production snapshot, user data or owner instructions. These are controlled initial conditions: it tests whether citizens recognize an opportunity, not whether an entire society emerges unaided. The probe stops at the first provider fallback and never applies fallback actions as model decisions. Reports include decisions, fallback reasons, token usage and structured offers/acceptances.

On 2026-09-12, the instrumented live run returned four model decisions (three speech actions and one work action), then OpenRouter returned HTTP 402. No structured offer was established. An earlier run returned two speech actions before fallbacks; fallback actions were excluded in both runs. The resulting prompt update makes voluntary work, formal offers and already-worked-today status explicit. That update has not yet been verified in a completed live-model run. Funding/provider access must be resolved before continuing; do not claim autonomous collaboration has been demonstrated.

## Release validation

87 tests passed, including public archive filtering, fixed chapter bounds, final labor, off-site payment, FileStore restoration and Postgres snapshot payloads. Mock soaks completed for 10 days (seed 7) and 30 days (seed 3). The web production build passed with `next build --webpack`; the local Turbopack worker could not bind a port in the execution environment. The player was checked in the browser at desktop and 390px mobile width, including playback, pause, scrubbing, chapter navigation, copying links and SVG export.
