/**
 * The town's ties, drawn over it: an arc from head to head for every two people the public record has seen together lately, thicker the
 * more they have had to do with each other, cream for talk, green for something given, rose for a wedding, a broken red for a theft or a
 * charge before the council; the fresher, the brighter. A spark runs along an arc when the two speak or trade now. Picking someone lights
 * their ties and lets the rest fall back.
 */
import { Graphics } from "pixi.js";

export type Tie = { a: string; b: string; talk: number; give: number; take: number; accuse: number; wed: boolean; last: number };
type Spot = { x: number; y: number };

const TALK = 0xf1e6c8, GIVE = 0x9fd08a, WED = 0xf29bb0, FEUD = 0xe0604a;

export class Ties {
  readonly g = new Graphics();
  private ties = new Map<string, Tie>();
  private sparks: { a: string; b: string; at: number }[] = [];

  set(list: Tie[]): void { this.ties = new Map(list.map((t) => [key(t.a, t.b), t])); }

  /** something passed between two people just now: count it, and send a spark along their arc */
  touch(kind: string, x: string, y: string, t: number, wedding = false): void {
    const k = key(x, y); let tie = this.ties.get(k); if (!tie) { const [a, b] = x < y ? [x, y] : [y, x]; tie = { a, b, talk: 0, give: 0, take: 0, accuse: 0, wed: false, last: t }; this.ties.set(k, tie); }
    tie.last = t; if (kind === "agent.give") tie.give++; else if (kind === "agent.take") tie.take++; else if (kind === "town.verdict") tie.accuse++; else if (wedding) tie.wed = true; else tie.talk++;
    this.sparks.push({ a: x, b: y, at: performance.now() });
  }

  /** draw every arc between people who are on the island now; `now` is the island's minute, `pick` the one chosen, if anyone */
  draw(where: (id: string) => Spot | null, now: number, pick: string | null, zoom: number): void {
    const g = this.g; g.clear(); const w = 1 / Math.max(0.5, zoom);
    const arc = (p: Spot, q: Spot) => { const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2 - Math.min(160, Math.hypot(q.x - p.x, q.y - p.y) * 0.28); return { mx, my }; };
    for (const t of this.ties.values()) {
      const p = where(t.a), q = where(t.b); if (!p || !q) continue;
      const mine = !pick || t.a === pick || t.b === pick; const feud = t.take + t.accuse > 0;
      const weight = t.talk + t.give * 2 + (t.wed ? 6 : 0) + (t.take + t.accuse) * 2;
      const fresh = Math.max(0.35, 1 - (now - t.last) / (4 * 1440));
      const color = t.wed ? WED : feud ? FEUD : t.give ? GIVE : TALK;
      const alpha = (pick ? (mine ? 0.95 : 0.08) : 0.55) * fresh, width = (1.2 + Math.min(5, Math.log2(1 + weight) * 1.25) + (pick && mine ? 1 : 0)) * w;
      const { mx, my } = arc(p, q);
      if (feud) { for (let s = 0; s < 1; s += 0.08) { const a = bez(p, mx, my, q, s), b = bez(p, mx, my, q, Math.min(1, s + 0.045)); g.moveTo(a.x, a.y).lineTo(b.x, b.y); } g.stroke({ width, color, alpha, cap: "round" }); }
      else g.moveTo(p.x, p.y).quadraticCurveTo(mx, my, q.x, q.y).stroke({ width, color, alpha, cap: "round" });
      if (pick && mine) for (const e of [p, q]) g.circle(e.x, e.y, 3.5 * w).fill({ color, alpha: 0.9 });
    }
    const ms = performance.now(); this.sparks = this.sparks.filter((s) => ms - s.at < 1600);
    for (const s of this.sparks) { const p = where(s.a), q = where(s.b); if (!p || !q) continue; const { mx, my } = arc(p, q); const k = (ms - s.at) / 1600, pt = bez(p, mx, my, q, k); g.circle(pt.x, pt.y, 6 * w).fill({ color: 0xfff3d6, alpha: 0.35 * (1 - k) }).circle(pt.x, pt.y, 3 * w).fill({ color: 0xffffff, alpha: 0.95 * (1 - k * 0.6) }); }
  }
}

const key = (x: string, y: string) => (x < y ? `${x}|${y}` : `${y}|${x}`);
const bez = (p: Spot, mx: number, my: number, q: Spot, s: number): Spot => ({ x: (1 - s) * (1 - s) * p.x + 2 * (1 - s) * s * mx + s * s * q.x, y: (1 - s) * (1 - s) * p.y + 2 * (1 - s) * s * my + s * s * q.y });
