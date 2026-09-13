# Cognition costs

Paid plans retain their published daily thought counts and models. Patron careful decisions and included reflections still use Opus. Reading summaries use the configured stakes model (Sonnet by default), rather than inheriting the Patron decision upgrade.

World-owned NPC routine plan thoughts have a 15-minute minimum interval. Urgent decisions and body/calendar interruptions still trigger normally. Their reflections and world writing use the stakes model; subscriber reflections are unchanged. These are usage reductions, not a dollar spending guarantee. Provider key limits remain separate from the legacy soft model-routing ceiling.

Digest generation coalesces simultaneous reads, caches successful results for the island hour, and backs off failures for a minute. Updating the last-read cursor does not invalidate the current hourly summary. Explicit historical ranges retain distinct cache entries but share a five-minute generation guard per citizen; the chronological record is available while generation is deferred.

Provider daily-limit errors back off for one hour; other authentication/credit errors retain a five-minute cooldown. Transport timeouts are not immediately replayed because the provider may already have processed the request. Allowances are refunded on failed hosted thoughts.

Migration 0018 records provider-reported tokens, cache hits and USD per response, including successful HTTP responses that later require schema repair. No prompts, answers, keys or contact details are recorded. Ops → Usage groups the last 24 hours by citizen and funding source. Costs missing from provider responses stay unknown. Timed-out requests may have incurred provider charges without reporting usage; the provider invoice remains authoritative. External-brain costs are outside Unwatched. Historical thought allowances cannot be converted into a measured dollar bill.

The database records survive deployments; in-process legacy estimates do not. Existing provider spending caps are not changed by this update.

## Subscription controls (migration 0019)

A subscription is assigned to one citizen. Existing additional hosted citizens retain a grandfathered assignment. New boarding and reactivation claim a seat in the same database transaction that admits the citizen. Brain switching and adoption also require an available seat. Departed ordinary citizens release their slot on a subsequent claim; existing waiting citizens retain theirs. This implements one hosted subscription per account plus preserved legacy assignments; purchasing multiple hosted seats per account is not supported yet. Existing subscription changes open Stripe's billing portal instead of creating a duplicate subscription. Webhooks reconcile the current Stripe subscription state rather than replaying stale event status.

Purchased-credit spending has an explicit on/off control and optional account-wide daily credit limit. New accounts default off. The migration preserves automatic spending for existing wallets. Limits use midnight UTC; included thought allowances still reset at island midnight, Europe/Zagreb. Turning off extra spending never reduces included daily allowances. The cap is in credits, not provider dollars, and never purchases more credits automatically.

Debits, daily-limit checks and ledger writes share a database transaction and wallet row lock. Refunds identify their original debit and apply once, including refunds after midnight. Payment grants deduplicate by checkout session. Wallet metadata updates cannot overwrite concurrent credit balances. A process crash after a debit but before inference completion still needs reconciliation; no automatic provider-outcome reconstruction is claimed.

Routine subscriber plan reconsideration and unsolicited conversations are paced against remaining allowance and waking time. Urgent decisions, hunger, gatherings and owner letters can interrupt that pacing. Explicit conversation requests remain responsive. The payer selects the conversation provider and receives its usage attribution. Morning plans, reflections, model selection and promised daily quotas are unchanged. Visitor copy now includes its existing morning plan. Pacing does not guarantee that every thought creates a visible event or that every allowance will be consumed.

Validation includes unit tests, temporary local PostgreSQL migration/rollback tests, a 16-request concurrent debit check, and production SQL tests wrapped in rollback. Complete monthly cost certification still needs representative provider data plus image/voice/infrastructure costs.
