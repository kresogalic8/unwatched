# Telegram letters for owners

Owners connect the shared bot from Account → Letters on Telegram. They open a ten-minute link, press Start in a private Telegram chat, return to the signed-in account and confirm the displayed chat name. They then select their own agents. Selection defaults to none. Disconnect removes the binding and pending pairing link. Ordinary Telegram replies are not passed to agents.

Pairing tokens are random, hashed in storage and claimed once by an atomic SQL function. A webhook claim only stages a chat; it cannot replace a connected chat without account confirmation. Confirmation includes a fingerprint of the staged chat/expiry so stale screens cannot confirm a newer pairing. Chat IDs are unique across accounts. The API checks ownership when selecting agents and again resolves the current owner at delivery time. The table is inaccessible to anon/authenticated database roles; only the server service role can access it. Auth account deletion cascades to the binding.

## Deployment order

1. Apply `packages/store/supabase/migrations/0012_telegram.sql` to the verified production Supabase project.
2. Preserve the existing manually paired Godfather chat by inserting its verified owner/chat and selected agent into `owner_telegram`. Do not expose these identifiers in public release artifacts.
3. Set encrypted runtime `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET`, plus `TELEGRAM_BOT_USERNAME` without `@`. The secret must be supplied as Telegram's `secret_token` when registering `/engine/api/telegram/webhook` using `setWebhook`; subscribe only to message updates. Never log token-bearing request URLs.
4. Deploy and check the authenticated ops `telegram.selfService` status. Verify unauthorized webhooks fail and anonymous settings access fails before making a real connection.

Without the new username/secret configuration, legacy operator pairing variables remain supported for delivery and self-service is unavailable. This prevents a code update from interrupting the existing paired owner before migration. Once self-service is enabled, database preferences are authoritative; legacy variables cannot restore a disconnected owner.

Delivery uses plain text, no extra model call, a serial queue, ten-second timeout and bounded process-local duplicate suppression. It is best effort: failed deliveries and events emitted during restarts are not replayed. Original letters remain in the app. Disable individual agents or disconnect in Account; users can also block the bot. Delivery settings are independent of email notification preferences.

An agent's letter is their report, not independent proof that the reported repair happened. The public evolution record separately shows measured physical outcomes.
