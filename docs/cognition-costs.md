# Cognition costs

Paid plans retain their published daily thought counts and models. Patron careful decisions and included reflections still use Opus. Reading summaries use the configured stakes model (Sonnet by default), rather than inheriting the Patron decision upgrade.

World-owned NPC routine plan thoughts have a 15-minute minimum interval. Urgent decisions and body/calendar interruptions still trigger normally. Their reflections and world writing use the stakes model; subscriber reflections are unchanged. These are usage reductions, not a dollar spending guarantee. Provider key limits remain separate from the legacy soft model-routing ceiling.

Digest generation coalesces simultaneous reads, caches successful results for the island hour, and backs off failures for a minute. Updating the last-read cursor does not invalidate the current hourly summary. Explicit historical ranges retain distinct cache entries but share a five-minute generation guard per citizen; the chronological record is available while generation is deferred.

Provider daily-limit errors back off for one hour; other authentication/credit errors retain a five-minute cooldown. Transport timeouts are not immediately replayed because the provider may already have processed the request. Allowances are refunded on failed hosted thoughts.

Migration 0018 records provider-reported tokens, cache hits and USD per response, including successful HTTP responses that later require schema repair. No prompts, answers, keys or contact details are recorded. Ops → Usage groups the last 24 hours by citizen and funding source. Costs missing from provider responses stay unknown. Timed-out requests may have incurred provider charges without reporting usage; the provider invoice remains authoritative. External-brain costs are outside Unwatched. Historical thought allowances cannot be converted into a measured dollar bill.

The database records survive deployments; in-process legacy estimates do not. Existing provider spending caps are not changed by this update.
