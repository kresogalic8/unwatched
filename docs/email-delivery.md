# Unwatched transactional email

## Delivery paths

| Flow | Sender | Template source | Status |
| --- | --- | --- | --- |
| Morning digest | Server → Resend HTTP | `apps/server/src/mail.ts` | Existing scheduler, redesigned template |
| Citizen letter | Server → Resend HTTP | `apps/server/src/mail.ts` | Existing notification trigger, redesigned template |
| Signup, magic link, invite, email change | Supabase Auth → Resend SMTP | `apps/server/src/email/auth.ts` | Installed in Supabase; Resend SMTP verified |
| Recovery and reauthentication | Supabase Auth → Resend SMTP | Same | Installed for these Supabase flows; no new password UI added |
| Seven account security notices | Supabase Auth → Resend SMTP | Same | Installed; existing notification switches remain off |
| Receipts, billing and payment notices | Stripe | Stripe settings | Leave with Stripe; do not duplicate payment emails |

All templates share `apps/server/src/email/layout.ts`: inline CSS, presentation tables, cream paper, coral CTA, no remote fonts/images/scripts. Citizen text is escaped. Digest and letter messages have HTML and plain-text bodies and an account-preferences link. Auth messages retain Supabase's `{{ .ConfirmationURL }}` so localhost and production redirects follow the existing auth flow. Sign-in copy explains the same-browser requirement for PKCE. No authentication link is reconstructed or sent through the app mail scheduler.

## Generate and preview

Run `node --import tsx scripts/email-templates.mts` from the repository root. It generates:

- `packages/store/supabase/templates/*.html`: deployable Supabase templates.
- `packages/store/supabase/templates/auth-email-config.json`: a Management API patch containing only subjects and template HTML; it does not enable security notices or alter redirects, authentication methods, or SMTP settings.
- `artifacts/email-preview/index.html`: a local gallery using fictional content and inactive auth buttons. This command sends no email.

## Sender setup

Sender: **Unwatched <noreply@unwatched.world>**. Verify `unwatched.world` in Resend first, using the DNS records Resend supplies. Disable click tracking for authentication mail so confirmation links are not rewritten.

Server secrets (local `.env` / production DigitalOcean environment):

```
RESEND_API_KEY=<secret>
MAIL_FROM="Unwatched <noreply@unwatched.world>"
```

The root `.env` is ignored by Git. The API key must never be a `NEXT_PUBLIC_*` variable or included in generated previews. Changing local `.env` alone does not configure the deployed server.

Supabase project `vfslnaoiournsechmqos`, Authentication → Email → SMTP:

- Host: `smtp.resend.com`
- Port: `465`
- Username: `resend`
- Password: Resend API key
- Sender address: `noreply@unwatched.world`
- Sender name: `Unwatched`

Prefer the official Resend/Supabase integration or configure these fields through the dashboard. Install the generated templates in Supabase's email template editor or patch the project auth config with `auth-email-config.json`. Keep existing Site URL, redirect allowlist, secure-email-change settings and rate limits intact. The app's callbacks already use the request origin. Review each email type in the dashboard before enabling any previously disabled notification category.

## Verification before reporting live

1. Resend reports the sender domain verified.
2. Production server has `RESEND_API_KEY` and `MAIL_FROM` configured.
3. Supabase SMTP and template configuration are saved.
4. With explicit recipient authorization, send a test auth email; open it in the requesting browser and confirm sign-in completes.
5. Check Resend delivery status for the test; test representative digest and letter mail to the authorized test inbox without triggering real citizen actions.

Sources: [Resend SMTP integration](https://resend.com/docs/send-with-supabase-smtp), [Supabase email templates](https://supabase.com/docs/guides/auth/auth-email-templates).

## Verified on 2026-09-13

- Resend reports `unwatched.world` verified.
- Supabase SMTP configured with the verified sender, port 465, username resend; all 13 templates installed through the dashboard.
- The authorized sign-in, fictional digest, and fictional letter tests each reported `delivered` in Resend. This verifies email delivery, not completion of a new sign-in session.
- Eight email unit tests passed; server typecheck and web production build passed.
- Production DigitalOcean service `town` has no `RESEND_API_KEY` or `MAIL_FROM` configured yet. The new application email rendering is local code and must be deployed together with these server secrets. Do not report the automated digest/letter rollout as complete until that deployment is verified.
