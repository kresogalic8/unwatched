import { randomUUID, createHash } from "node:crypto";
import { recordDelivery, deliveryDatabase } from "./delivery-log.ts";
/**
 * The morning mail. One letter a day with the written digest, and a note when a citizen writes home, sent through Resend's HTTP API.
 * Without RESEND_API_KEY nothing is sent and the log says so, so a clone of the repo runs the island with no inbox at all.
 */
import { emailLayout, escapeHtml as esc, paragraph } from "./email/layout.ts";

export function mailEnabled(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export interface Mail {
  to: string;
  subject: string;
  html: string;
  text: string;
  ownerId?: string;
  agentId?: string;
  kind?: string;
  jobId?: string;
  from?: string;
  deliveryKey?: string;
}
/** True when the letter went. False, with a line in the log, when it did not or could not. */
export async function sendMail(
  m: Mail,
  log: (l: string) => void = () => {},
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  const db = deliveryDatabase();
  const hash = m.deliveryKey
    ? createHash("sha256").update(m.deliveryKey).digest("hex").slice(0, 32)
    : null;
  const jobId =
    m.jobId ??
    (hash
      ? `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(
          12,
          16,
        )}-${hash.slice(16, 20)}-${hash.slice(20)}`
      : randomUUID());
  let from =
    m.from ?? process.env.MAIL_FROM ?? "Unwatched <noreply@unwatched.world>";
  if (db && !m.jobId) {
    const existing = await db
      .from("delivery_jobs")
      .select("*")
      .eq("id", jobId)
      .maybeSingle();
    if (existing.error) {
      log("Mail queue unavailable; send deferred.");
      return false;
    }
    if (existing.data) {
      if (existing.data.status === "accepted") return true;
      if (
        existing.data.status !== "failed" ||
        Date.now() - Date.parse(existing.data.created_at) > 23 * 3600000 ||
        existing.data.payload.to !== m.to
      )
        return false;
      const claim = await db
        .from("delivery_jobs")
        .update({ status: "sending", updated_at: new Date().toISOString() })
        .eq("id", jobId)
        .eq("status", "failed")
        .select("id");
      if (claim.error || !claim.data?.length) return false;
      m = existing.data.payload as Mail;
      from = m.from ?? from;
    } else {
      const saved = await db
        .from("delivery_jobs")
        .insert({
          id: jobId,
          payload: { ...m, from },
          owner_id: m.ownerId ?? null,
          agent_id: m.agentId ?? null,
          status: "sending",
        });
      if (saved.error) {
        log("Mail queue could not be saved; send deferred.");
        return false;
      }
    }
  }
  const delivery = (status: string, error?: string, provider_id?: string) =>
    recordDelivery({
      ...(db ? { job_id: jobId } : {}),
      channel: "email",
      kind: m.kind ?? "notification",
      status,
      ...(m.ownerId ? { owner_id: m.ownerId } : {}),
      ...(m.agentId ? { agent_id: m.agentId } : {}),
      ...(error ? { error } : {}),
      ...(provider_id ? { provider_id } : {}),
    });
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    await delivery("skipped", "Email not configured");
    if (db)
      await db
        .from("delivery_jobs")
        .update({ status: "failed" })
        .eq("id", jobId);
    log(`mail not sent (no RESEND_API_KEY): "${m.subject}" to ${m.to}`);
    return false;
  }
  try {
    const res = await fetcher("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "Idempotency-Key": jobId,
      },
      body: JSON.stringify({
        from,
        to: [m.to],
        subject: m.subject,
        html: m.html,
        text: m.text,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      await delivery("failed", `Provider HTTP ${res.status}`);
      if (db)
        await db
          .from("delivery_jobs")
          .update({ status: "failed" })
          .eq("id", jobId);
      log(`mail refused (${res.status}): ${(await res.text()).slice(0, 160)}`);
      return false;
    }
    const receipt = (await res.json().catch(() => ({}))) as { id?: string };
    await delivery("accepted", undefined, receipt.id);
    if (db)
      await db
        .from("delivery_jobs")
        .update({
          status: "accepted",
          payload: {},
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId);
    return true;
  } catch (err) {
    await delivery("failed", "Network or provider failure");
    if (db)
      await db
        .from("delivery_jobs")
        .update({ status: "failed" })
        .eq("id", jobId);
    log(`mail failed: ${(err as Error).message}`);
    return false;
  }
}

function notificationFooter(url: string): { html: string; text: string } {
  const settings = new URL("/account", url).href;
  return {
    html: `You receive this because email notifications are enabled for your citizen. <a href="${esc(
      settings,
    )}" style="color:#20291F;text-underline-offset:3px">Manage email preferences</a>.`,
    text: `Manage email preferences: ${settings}`,
  };
}
export function digestMail(o: {
  to: string;
  name: string;
  day: number;
  headline: string;
  text: string;
  lines: string[];
  url: string;
}): Mail {
  const footer = notificationFooter(o.url);
  const body =
    paragraph(o.text) +
    (o.lines.length
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${o.lines
          .map(
            (line) =>
              `<tr><td style="padding:14px 0;border-top:1px solid #CDD0C4;font-size:14px;line-height:1.6">${esc(
                line,
              )}</td></tr>`,
          )
          .join("")}</table>`
      : "");
  return {
    to: o.to,
    subject: o.headline,
    html: emailLayout({
      kicker: `Day ${o.day} · ${o.name}`,
      headline: o.headline,
      preview: o.text.slice(0, 160),
      body,
      action: { text: "Read the digest", url: o.url },
      footer: footer.html,
    }),
    text: `${o.headline}\n\n${o.text}\n\n${o.lines.join(
      "\n",
    )}\n\nRead the digest: ${o.url}\n\n${footer.text}`,
  };
}
export function letterMail(o: {
  to: string;
  name: string;
  day: number;
  text: string;
  url: string;
}): Mail {
  const subject = `A letter from ${o.name}`;
  const footer = notificationFooter(o.url);
  return {
    to: o.to,
    subject,
    html: emailLayout({
      kicker: `Letters from the island · Day ${o.day}`,
      headline: subject,
      preview: `${o.name} wrote to you.`,
      body: `<div style="border-left:2px solid #E4572E;padding-left:22px">${paragraph(
        `“${o.text}”`,
      )}</div>`,
      action: { text: "Write back", url: o.url },
      footer: footer.html,
    }),
    text: `${subject}\n\n“${o.text}”\n\nWrite back: ${o.url}\n\n${footer.text}`,
  };
}

/**
 * Whether this owner's morning mail is still owed. Seven is when it goes, but a clock caught up after downtime can
 * step from six to nine in one tick, so the day is what decides, not the exact hour.
 */
export function mailDue(
  hour: number,
  day: number,
  lastMailedDay: number | null,
): boolean {
  return hour >= 7 && lastMailedDay !== day;
}
