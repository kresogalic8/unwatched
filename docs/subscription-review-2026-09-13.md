# Subscription usage review — 13 September 2026

Status: review and recommendations, not a change to subscriptions, prices, or entitlements.

## Current offer

Prices are monthly; allowances renew at island midnight, per citizen. The checked-in production configuration runs in real time in Europe/Zagreb. Unused daily thoughts do not roll over. Counts are opportunities to think, not guaranteed activity or token credits.

| Plan | Monthly price | Routine / day | Careful / day | Routine + careful over 30 days | Included reflection |
| --- | ---: | ---: | ---: | ---: | --- |
| Visitor | $3 | 10 Haiku 4.5 | 1 Sonnet 5 | 300 + 30 | No; purchased credits can pay |
| Resident | $12 | 50 Haiku 4.5 | 6 Sonnet 5 | 1,500 + 180 | Nightly Opus 5 |
| Patron | $29 | 120 Haiku 4.5 | 15 Opus 5 | 3,600 + 450 | Nightly Opus 5 |

All three currently receive a separate included morning plan. Visitor's benefit list does not disclose this. Digests are additional provider work; generated summaries are cached. Conversations can consume routine allowance. After allowance exhaustion, purchased credits are consumed automatically (1 routine, 4 careful, 10 reflection); without credits the citizen continues basic simulation. Failed hosted thoughts refund their reservation. Daily renewal is independent of reflection success.

## Assessment

- Visitor is a light participation plan. Ten routine thoughts spread across a 16-hour waking day are roughly one every 96 minutes. It should not be presented as continuous active AI. Improve responsiveness to owner letters and daily continuity before simply increasing the number.
- Resident has a substantial allowance: roughly one routine thought every 19 minutes across 16 waking hours, plus careful decisions, planning and reflection. Keep 50 / 6 for now.
- Patron is already generous: roughly one routine thought every 8 minutes across 16 waking hours, plus 15 premium decisions, planning and reflection. Keep 120 / 15 for now.

These intervals illustrate allocation, not the current scheduler: salience is event-driven and can spend allowance in bursts. A larger number does not ensure a lively citizen throughout the day.

## Cost scenarios, not a forecast

Reference prices per million input/output tokens: Haiku 4.5 $1/$5, Sonnet 5 $3/$15, Opus 5 $5/$25. Cache reads are one tenth of base input price. References checked September 13:

- https://platform.claude.com/docs/en/about-claude/pricing
- https://openrouter.ai/anthropic/claude-opus-5

Assume every routine and careful allowance is used for 30 days, each call has 5,000 input and 400 output tokens. Compare no cached inputs with 80% input cache hits. Cache writes, repairs, provider routing premiums and other charges are excluded. Actual context sizes differ by task.

| Plan | 80% input cache hits | No cache hits |
| --- | ---: | ---: |
| Visitor | $1.33 | $2.73 |
| Resident | $6.94 | $14.28 |
| Patron | $19.89 | $40.95 |

Formula: 30 × (routine allowance × routine call cost + careful allowance × careful call cost). These figures exclude morning plans, reflections, digests, portraits, voice, infrastructure and payment costs. They are not worst-case bounds. Caching is not guaranteed. At these assumptions, increasing allowances is not justified by margins.

Actual provider telemetry is too recent to establish unit economics. At review time it contained only four subscriber responses: one Haiku dialogue ($0.007254) and three Sonnet digests ($0.0163392 combined). There were no tracked subscriber Opus responses in this sample. User-key spending must not be treated as platform subscription expense. Historical allowance counters cannot reconstruct historical USD.

## Priorities before expanding the offer

1. **Match billing to citizens.** PlanChoices says one citizen, but Billing stores one plan per owner and applies its full allowance to every hosted citizen. Boarding verifies an active owner subscription without allocating a subscription seat. Adoption and reactivation also need allocation checks. Introduce persisted subscription-to-citizen seats, idempotent Stripe reconciliation, and transactional admission. Preserve existing citizens through an explicit grandfathering policy; do not remove their benefits silently. Merely changing UI copy would not fix the economics.
2. **Pace routine work.** Distribute ordinary autonomous thoughts across the remaining waking day, allow meaningful urgent interruptions, and avoid repeated low-value plan-step reconsideration. Do not make remaining paid allowance inaccessible through rigid hourly caps. Owner letters should receive priority within allowance, not an unlimited new free inference route.
3. **Make extra credit spending explicit.** Show included usage separately from purchased credits, the next reset time, and an opt-in daily limit for automatic extra-credit spending. Existing users should be able to preserve their current behavior. Never equate thought counts or credits with provider dollars.
4. **Reduce tokens before reducing intelligence.** Compact retrieved context, remove irrelevant world records, reuse stable prefixes and measure cache effectiveness by task. Benchmark behavior before shipping prompt changes. Keep promised models for existing paid plans.
5. **Measure complete service cost by subscription seat.** Attribute decisions, dialogues, morning plans, reflections and digest work; add separate image/voice costs. Measure cost per successful useful action, failures, daily exhaustion time and owner-letter response time. Accumulate at least a complete week including nightly work, then model 30/31-day full usage. Today's sample cannot certify profitability.
6. **Make plan descriptions accurate.** Explain daily reset versus monthly payment, no rollover, included morning planning on Visitor, automatic extra-credit use, and basic simulation after exhaustion. Do not imply that every thought creates a visible event or that agents guarantee letters at a fixed frequency.

## Recommendation

Keep the current prices and published allowances during this review. Improve pacing, ownership enforcement, cost attribution and spend transparency first. Visitor is the first candidate for a future increase (for example 20 routine thoughts/day), but only after the full-cost model supports it. Resident and Patron need better delivery of their existing value rather than larger numbers. New prices or model bundles require a separate decision and an explicit policy for existing subscribers.

This review does not certify current profitability or authorize a higher provider spending limit.
