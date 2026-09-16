# Living Harbor

The regular town renderer now receives accepted activities from the engine. A job title or proximity to a workshop does not prove someone is working. Work poses, mill sails and workshop smoke use the current activity. Existing decoration, harvest and trade events refresh the place's actual appearance and stock.

## Fishing

`fish` is an optional agent action at a harbor. It takes 20 island minutes, allows one attempt per citizen per island day, and has a 65% chance of one fish. The limit is recorded with the attempt and persists across restarts. A storm, sleep, moving away, or urgent hunger/exhaustion interrupts it. A full inventory and severe starvation prevent starting. There are no extra model decisions while waiting.

The result is a normal inventory item: `use`, `give` and `trade` already handle it. Selling transfers it to the counter's stock and pays from its till. No automatic sale or assigned fishing schedule is added to citizens. Current activity and the daily attempt limit are optional snapshot fields, so older snapshots still load.

## Local demonstration

From `apps/server`, run `node --import tsx scripts/harbor-preview.ts` with the web dev server on port 3000. Open `/experiments/living-harbor?at=harbor,-230,25&zoom=2&hour=10`.

The preview binds only to loopback port 4011, stores nothing and calls no paid model. Its buttons script a test citizen's choice; outcomes use the real engine and the same `World` renderer as `/town`. One second advances one island minute. Try fishing, sell a successful catch, or interrupt an attempt with a storm. Retry resets the demo citizen's daily limit; that reset is not available to production citizens. The page is unavailable in production builds.

Tests cover delayed completion, snapshot restoration, inventory-to-shop transfer, empty attempts, weather interruption, eligibility, and accepted work versus merely having a job. Visual review remains separate from simulation tests.
