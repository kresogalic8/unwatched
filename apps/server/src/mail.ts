/**
 * The morning mail. One letter a day with the written digest, and a note when a citizen writes home, sent through Resend's HTTP API.
 * Without RESEND_API_KEY nothing is sent and the log says so, so a clone of the repo runs the island with no inbox at all.
 */
const FROM = process.env.MAIL_FROM ?? "Unwatched <island@unwatched.world>";
const PAPER = "#F7F6F3", INK = "#14161A", CORAL = "#E4572E", TEAL = "#1E5A63", DRIFT = "#6B6E73";
const FONT = "'Familjen Grotesk', -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";

export function mailEnabled(): boolean { return !!process.env.RESEND_API_KEY; }

export interface Mail { to: string; subject: string; html: string; text: string }
/** True when the letter went. False, with a line in the log, when it did not or could not. */
export async function sendMail(m: Mail, log: (l: string) => void = () => {}, fetcher: typeof fetch = fetch): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) { log(`mail not sent (no RESEND_API_KEY): "${m.subject}" to ${m.to}`); return false; }
  try {
    const res = await fetcher("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: FROM, to: [m.to], subject: m.subject, html: m.html, text: m.text }), signal: AbortSignal.timeout(10000) });
    if (!res.ok) { log(`mail refused (${res.status}): ${(await res.text()).slice(0, 160)}`); return false; }
    return true;
  } catch (err) { log(`mail failed: ${(err as Error).message}`); return false; }
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** Plain HTML, no images, no outside assets: paper, ink, a coral dot for what changed, one teal button. */
function frame(kicker: string, headline: string, body: string, button: { text: string; url: string }): string {
  return `<!doctype html><html><body style="margin:0;padding:0;background:${PAPER};color:${INK};font-family:${FONT}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER}"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:20px">
<tr><td style="padding:32px 32px 8px;font-size:13px;letter-spacing:0.02em;color:${DRIFT}">${esc(kicker)}</td></tr>
<tr><td style="padding:0 32px 12px;font-size:26px;line-height:1.2;font-weight:700"><span style="display:inline-block;width:10px;height:10px;border-radius:5px;background:${CORAL};margin-right:10px;vertical-align:middle"></span>${esc(headline)}</td></tr>
${body}
<tr><td style="padding:8px 32px 32px"><a href="${esc(button.url)}" style="display:inline-block;background:${TEAL};color:#FFFFFF;text-decoration:none;font-weight:600;font-size:15px;padding:12px 20px;border-radius:8px">${esc(button.text)}</a></td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px"><tr><td style="padding:16px 32px;font-size:12px;color:${DRIFT}">The island runs whether or not you are here. Turn these letters off on your account page.</td></tr></table>
</td></tr></table></body></html>`;
}

/** The morning digest: the headline, the paragraph, the three lines that mattered most, and the way to the rest. */
export function digestMail(o: { to: string; name: string; day: number; headline: string; text: string; lines: string[]; url: string }): Mail {
  const first = o.name.split(" ")[0]!;
  const body = `<tr><td style="padding:0 32px 16px;font-size:17px;line-height:1.5">${esc(o.text)}</td></tr>` +
    (o.lines.length ? `<tr><td style="padding:0 32px 16px">${o.lines.map((l) => `<div style="padding:8px 0;border-top:1px solid rgba(20,22,26,0.10);font-size:15px;line-height:1.4">${esc(l)}</div>`).join("")}</td></tr>` : "");
  return { to: o.to, subject: o.headline, html: frame(`Day ${o.day} on the island · ${first}`, o.headline, body, { text: "Read the digest", url: o.url }), text: `${o.headline}\n\n${o.text}\n\n${o.lines.join("\n")}\n\nRead the digest: ${o.url}` };
}

/** A letter home, as it was written, with the way to write back. */
export function letterMail(o: { to: string; name: string; day: number; text: string; url: string }): Mail {
  const subject = `A letter from ${o.name}`;
  const body = `<tr><td style="padding:0 32px 16px;font-size:17px;line-height:1.5;font-style:italic">“${esc(o.text)}”</td></tr>`;
  return { to: o.to, subject, html: frame(`Day ${o.day} on the island`, subject, body, { text: "Write back", url: o.url }), text: `${subject}\n\n“${o.text}”\n\nWrite back: ${o.url}` };
}

/**
 * Whether this owner's morning mail is still owed. Seven is when it goes, but a clock caught up after downtime can
 * step from six to nine in one tick, so the day is what decides, not the exact hour.
 */
export function mailDue(hour: number, day: number, lastMailedDay: number | null): boolean { return hour >= 7 && lastMailedDay !== day; }
