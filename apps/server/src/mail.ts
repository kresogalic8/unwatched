/**
 * The morning mail. One letter a day with the written digest, and a note when a citizen writes home, sent through Resend's HTTP API.
 * Without RESEND_API_KEY nothing is sent and the log says so, so a clone of the repo runs the island with no inbox at all.
 */
import { emailLayout, escapeHtml as esc, paragraph } from "./email/layout.ts";

export function mailEnabled(): boolean { return !!process.env.RESEND_API_KEY; }

export interface Mail { to: string; subject: string; html: string; text: string }
/** True when the letter went. False, with a line in the log, when it did not or could not. */
export async function sendMail(m: Mail, log: (l: string) => void = () => {}, fetcher: typeof fetch = fetch): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) { log(`mail not sent (no RESEND_API_KEY): "${m.subject}" to ${m.to}`); return false; }
  try {
    const res = await fetcher("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: process.env.MAIL_FROM ?? "Unwatched <noreply@unwatched.world>", to: [m.to], subject: m.subject, html: m.html, text: m.text }), signal: AbortSignal.timeout(10000) });
    if (!res.ok) { log(`mail refused (${res.status}): ${(await res.text()).slice(0, 160)}`); return false; }
    return true;
  } catch (err) { log(`mail failed: ${(err as Error).message}`); return false; }
}

function notificationFooter(url: string): { html:string; text:string } {
 const settings = new URL("/account", url).href;
 return { html: `You receive this because email notifications are enabled for your citizen. <a href="${esc(settings)}" style="color:#20291F;text-underline-offset:3px">Manage email preferences</a>.`, text: `Manage email preferences: ${settings}` };
}
export function digestMail(o: { to:string; name:string; day:number; headline:string; text:string; lines:string[]; url:string }):Mail {
 const footer=notificationFooter(o.url);
 const body=paragraph(o.text)+(o.lines.length?`<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${o.lines.map(line=>`<tr><td style="padding:14px 0;border-top:1px solid #CDD0C4;font-size:14px;line-height:1.6">${esc(line)}</td></tr>`).join("")}</table>`:"");
 return {to:o.to,subject:o.headline,html:emailLayout({kicker:`Day ${o.day} · ${o.name}`,headline:o.headline,preview:o.text.slice(0,160),body,action:{text:"Read the digest",url:o.url},footer:footer.html}),text:`${o.headline}\n\n${o.text}\n\n${o.lines.join("\n")}\n\nRead the digest: ${o.url}\n\n${footer.text}`};
}
export function letterMail(o: { to:string; name:string; day:number; text:string; url:string }):Mail {
 const subject=`A letter from ${o.name}`; const footer=notificationFooter(o.url);
 return {to:o.to,subject,html:emailLayout({kicker:`Letters from the island · Day ${o.day}`,headline:subject,preview:`${o.name} wrote to you.`,body:`<div style="border-left:2px solid #E4572E;padding-left:22px">${paragraph(`“${o.text}”`)}</div>`,action:{text:"Write back",url:o.url},footer:footer.html}),text:`${subject}\n\n“${o.text}”\n\nWrite back: ${o.url}\n\n${footer.text}`};
}

/**
 * Whether this owner's morning mail is still owed. Seven is when it goes, but a clock caught up after downtime can
 * step from six to nine in one tick, so the day is what decides, not the exact hour.
 */
export function mailDue(hour: number, day: number, lastMailedDay: number | null): boolean { return hour >= 7 && lastMailedDay !== day; }
