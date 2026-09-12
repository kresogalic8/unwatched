# Projects citizens choose together

The first shared construction type is a garden. Existing privately owned houses, shops and paid construction promises still work. No project is automatically seeded in the live island and no citizen is assigned a donation or membership.

## Choosing and contributing

An agent standing on an unclaimed plot can use `start_project: {at, name, why}`. The name and public reason come from the agent; the engine reserves the plot and records the proposal. Each proposer may have one unfinished shared project. Public proposals are available in `town.projects` and morning planning. The local project also appears in `place.community`.

At the project, `contribute_project: {at, coins, help}` transfers actual coins to its fund and optionally volunteers labor. Zero coins can volunteer work; donating does not require volunteering. The target is 18 coins. Four planks are consumed from the sawpit, paid four coins; the remaining 14 go to the council for the plot. A fully funded project waits if planks are unavailable; `work` retries starting it when material arrives. This follows the existing construction convention of purchasing sawpit materials rather than simulating physical delivery.

`withdraw_project: {at}` stops volunteering. Before construction starts, the person's unspent contribution is refunded. Once materials have been purchased it cannot be refunded. If everyone withdraws an unfunded proposal, the plot is released. Departed contributors' unspent donations remain in the shared fund, available to complete the project; they are not inherited as personal coins.

## Work and harvest

Six person-mornings of validated `work` complete the garden. Each person contributes at most once per day, including across restarts. Volunteers' routines return to their chosen work outside shifts and urgent hunger or sleep needs. The mind can override the routine. Others may work voluntarily without joining. The site and its recorded construction replay become a garden in the live drawing. It has no private owner.

A completed garden starts empty. After two simulation days, tending with `work` during daylight produces up to three vegetables per person per day. Rain or snow reduces the yield to one; winter and storms prevent it. A broken garden cannot produce. The counter holds at most 24 vegetables. No automatic harvest is generated at midnight. Food can be obtained with the existing trade action for zero coins and eaten with use. The garden does not buy back its free vegetables.

This is an explicit simulation rule set, not an agricultural model or unconstrained invention. Agents choose names, reasons, contributions, cooperation and timing within these capabilities. A declaration in reflection cannot replace payment, labor or growing time.

## Inspect and reproduce

`/built` shows live proposals, funding, contributors, construction and cumulative food production. Click the plot in the world for the same project details. `/built/garden-demo` is separately labeled as a scripted engine scenario with no live model. Regenerate its public record with:

```sh
node --import tsx scripts/community-demo.ts
pnpm --filter @unwatched/engine exec vitest run test/community.test.ts test/teaching.test.ts
pnpm --filter @unwatched/store test
```

The scenario executes actual actions: three people fund and build a garden, tend nine vegetables, take one free meal, and propose a second garden. It also demonstrates advice relayed after a personal check. It proves the mechanics, not that arbitrary personas will independently make these choices. Tests cover coin conservation, finite materials and harvests, withdrawal, invalid actions, unforced membership, weather, actual route changes and file/Postgres persistence. Existing snapshots need no migration; new fields are optional.
