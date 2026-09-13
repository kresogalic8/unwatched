# Back office and feedback

Open `/ops` using a verified Supabase account listed in `public.ops_members`.
`viewer` can inspect records; `operator` and `admin` can triage reports, reply, retry eligible mail and use world controls. Membership is provisioned by a database administrator. The shared `UW_OPS_TOKEN` no longer grants access.

Apply `0013_backoffice.sql` and `0014_cognition_attempts.sql` before deploying the server. All seven tables are RLS-enabled and deny direct access to anon/authenticated database roles; API routes check staff membership or report ownership. The service-role key stays on the server.

## Screens

- Overview: world status, configuration and process version.
- Users: paginated email/name lookup, wallet and credit ledger, live read-only Stripe subscription/invoice comparison. No billing writes.
- Citizens: funding, allowances, external-brain status, recorded cognition attempts, recent events, projects and learned food choices. `lastThought` is engine scheduling state, not proof of provider success. A completed brain method can return a fallback; street events show what actually happened.
- Usage: public-world and subscriber provider response totals since process start; the legacy hourly estimate is explicitly limited to island time/public-world usage. External brain spending is unknown, not zero.
- Feedback: private reports, status, severity, assignee, duplicate reference, reviewed GitHub issue URL, internal notes and replies visible in the reporter's account. Guest follow-up uses the provided email via the operator's mail application. GitHub publishing is manual.
- Deliveries: durable email/Telegram attempts. `accepted` means provider acceptance, not inbox delivery. Supabase SMTP authentication emails remain in Supabase/Resend logs.
- Operations: explicit target-state controls, snapshot, moderation review and attributable request/outcome audit. Audit storage must work before mutations proceed.

Feedback is available through the fixed Feedback link, account navigation and shared error states. Screenshots accept PNG/JPEG up to 1 MiB. Page context removes query strings/fragments. Reports never automatically include session tokens, keys, letters or private memories. Signed-in owners see their reports and public replies. Anonymous reports receive a reference and can supply contact email; they do not get an account inbox. Initial abuse limit is five reports per account per hour; anonymous intake shares five per hour.

## Mail retries

Email jobs keep the original body privately for retries, with deterministic daily notification IDs and Resend `Idempotency-Key` headers. Accepted jobs erase their payload and cannot be resent. Failed jobs can be retried for 23 hours; recipient, ownership and notification preferences are rechecked. Payloads expire after 24 hours (hourly cleanup). A sending job interrupted by process shutdown is left for investigation rather than blindly replayed. Telegram retries are not automated because its send API does not provide equivalent idempotency guarantees.

Provider reference: https://resend.com/docs/dashboard/emails/idempotency-keys

## Deployment

`app-maintenance.yml` deploys main's exact commit to both services without publishing a release. It preserves existing DigitalOcean settings, requires the single town instance, and verifies both public version endpoints. `web-maintenance.yml` remains available for web-only updates.

Historical cognition/delivery records are not reconstructed. New records start after deployment. The back office does not fabricate missing billing, delivery or provider data.
