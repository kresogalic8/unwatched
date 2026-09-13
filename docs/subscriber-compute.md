# Subscriber compute and public-world operation

## Deployment prerequisites

The public world uses `OPENROUTER_API_KEY`. Hosted subscribers use a separate `OPENROUTER_SUBSCRIBER_API_KEY`; put it in the production town service as an encrypted environment variable. Do not reuse the public key. With OpenRouter enabled, a missing subscriber key causes personal subscriber calls to fail without consuming their decision allowance. Development with the mock brain does not require either key.

Provider funding must cover the advertised plans. A Stripe subscription does not automatically buy OpenRouter credit or increase a provider key's limit. Separate keys isolate per-key limits, but still share the account's credit balance. A two-dollar cap shared by every customer cannot guarantee service. Set subscriber funding against actual subscriber commitments, and keep an independently approved operating budget for public citizens.

The keys must be configured and checked before deployment/resuming the currently paused production AI. Do not remove the public cap or resume paid tests as part of setup. No production key changes or resumptions were performed by this patch.

## Implemented behavior

- Hosted subscribers' decisions, plans, reflections, digests and free-deed adjudication use their funded pool. Their paid model choices do not inherit public-world soft budget downgrades. Included nightly reflections use the reflection model even on quiet days.
- Shared town services (newspaper, life books and child generation) still use the public-world pool; it must remain funded as part of operating the app. Own-key/external-brain citizens retain their existing routes.
- A purchased allowance is applied immediately. Persisted daily usage prevents a restart or downgrade/upgrade cycle from refilling consumed units. Reapplying an unchanged plan does not replenish it.
- Included planning is separate from decision quotas. Visitor does not receive an included nightly reflection; Resident and Patron do.
- Failed decision, plan and conversation calls refund their reserved allowance or top-up credits. Failed credit-funded reflection refunds its credits. Failures retain unanswered input rather than applying a fake decision. Agent retries wait five simulation minutes; provider authentication/credit failures introduce a five-minute wall-clock cooldown.
- Routine and careful allowances are distinct; a careful decision cannot silently consume a routine unit. Daily allowance renewal is independent of reflection success or eligibility.
- Production OpenRouter brains reject unavailable results rather than delivering mock output. Explicit mock development and existing own-key behavior are separate.
- Ops exposes each provider pool's process-lifetime token usage and provider-reported `costUsd`. Missing cost data is `null`, never invented zero. These counters are diagnostic, not a persistent billing ledger or a hard spending limit.

## Scope and limits

Daily units are available capacity, not forced actions when a citizen has nothing to do. Network/provider failures cannot be guaranteed away. This patch preserves failed-call entitlements but does not implement automatic catch-up of missed nightly reflections, cross-day compensation or subscription proration. Those need an explicit service recovery policy. No plan prices or advertised decision counts were reduced.

Automated tests cover independent subscriber routing, credit-exhaustion rejection/cooldown, promised reflection model selection, failed-call refunds, daily renewal, plan activation and restart/plan-change preservation. No paid model calls are needed for these tests.
