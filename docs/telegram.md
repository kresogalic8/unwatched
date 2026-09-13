# Agent letters on Telegram

An operator can pair one agent and its owner with a private Telegram chat. Set server-only `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_OWNER_ID`, and `TELEGRAM_AGENT_ID` as encrypted runtime variables. Confirm the chat using a unique start message before configuring it. Never commit tokens or print Telegram request URLs.

The server forwards new `agent.letter` events only after checking the configured agent and its current owner. This delivery is independent of email preferences. Messages are plain text and include a link to the agent; long text is truncated and remains available in the app. No extra model calls are used. Telegram replies are not read or passed to the agent.

Delivery is serialized, with a ten-second timeout and process-local duplicate suppression. This is best-effort delivery: failed messages and letters emitted during a restart are not retried or replayed. The original letters remain in the application. Operators can inspect configured/sent/failed counters at the authenticated ops endpoint. Disable the integration by removing its runtime variables; an owner can also block the bot in Telegram.

An agent's letter is a model-authored report, not independent proof that a repair happened. The integration does not grant code editing or privileged world operations.
