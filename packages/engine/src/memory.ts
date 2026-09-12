import type { Memory } from "./types.ts";
import { embed, cosine } from "./embed.ts";

/** Preserve the source when a memory is retrieved; remembering a claim does not verify it. */
export function memoryForMind(m: Memory): string {
  const source = { obs: "recorded observation; quoted claims remain claims", reflect: "personal interpretation, not verified experience", rumor: "reported speech, not verified experience", letter: "letter, not verified experience", plan: "intention, not completed work" }[m.kind] ?? "unknown source, not verified experience";
  return `[minute ${m.t}; ${source}] ${m.text}`;
}

const STOP = new Set(["the", "a", "an", "and", "to", "of", "at", "in", "on", "for", "with", "is", "was", "it", "she", "he", "they", "i", "me", "my", "her", "his"]);
function keywords(s: string): Set<string> {
  return new Set(s.toLowerCase().replace(/[^a-zà-ž0-9 ]/gi, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)));
}

/** Retrieval by recency, importance, and relevance: the Generative Agents recipe, with a local embedding for relevance. */
export function retrieve(memories: Memory[], query: string, now: number, n = 8): Memory[] {
  const q = keywords(query); const qv = embed(query);
  const scored = memories.map((m) => {
    const ageHours = Math.max(0, (now - m.t) / 60);
    const recency = Math.exp(-ageHours / 48);
    const kw = keywords(m.text);
    let overlap = 0;
    for (const w of q) if (kw.has(w)) overlap++;
    m.vec ??= embed(m.text);
    const relevance = 0.5 * (q.size ? overlap / q.size : 0) + 0.5 * Math.max(0, cosine(qv, m.vec));
    return { m, score: 0.35 * recency + 0.35 * m.importance + 0.3 * relevance };
  });
  scored.sort((x, y) => y.score - x.score);
  return scored.slice(0, n).map((x) => x.m);
}

/** Nights wear memories down. What was not important fades and, in time, is gone; what one thought about oneself, and letters from home, wear slowest. */
export function age(memories: Memory[], now: number): Memory[] {
  const out: Memory[] = [];
  for (const m of memories) {
    const days = (now - m.t) / 1440;
    if (days > 7) m.importance *= m.kind === "reflect" || m.kind === "letter" ? 0.995 : m.kind === "rumor" ? 0.975 : 0.985;
    if (days > 14 && m.importance < 0.04) continue; // forgotten
    out.push(m);
  }
  return out;
}

/** What happens to a story between one mouth and the next: numbers slip, days blur, the teller drops out. Small, and one-way. */
export function drift(text: string, chance: () => number): string {
  let t = text;
  t = t.replace(/\b(\d{1,3})\b/g, (m) => { if (chance() > 0.4) return m; const n = Number(m); const d = 1 + Math.floor(chance() * 3); return String(Math.max(0, chance() < 0.5 ? n - d : n + d)); });
  if (chance() < 0.3) t = t.replace(/\byesterday\b/i, "the other day").replace(/\bthis morning\b/i, "earlier").replace(/\blast night\b/i, "one night");
  if (chance() < 0.25) t = t.replace(/^I (saw|heard|found)\b/, "Someone $1").replace(/\bI think\b/, "they say");
  return t;
}

/** Nightly: keep the important, drop the rest, cap the stream. */
export function compress(memories: Memory[], cap = 240): Memory[] {
  if (memories.length <= cap) return memories;
  const sorted = [...memories].sort((a, b) => (b.importance - a.importance) || (b.t - a.t));
  const kept = sorted.slice(0, cap);
  kept.sort((a, b) => a.t - b.t);
  return kept;
}
