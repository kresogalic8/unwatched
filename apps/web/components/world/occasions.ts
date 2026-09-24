/**
 * What a gathering puts up on the street, so the moment reads from across the island: bunting strung over a wedding or a feast,
 * with lanterns in it after dark and petals over the couple, fireworks over the harbour on a feast night, and for a funeral the
 * coffin on its trestles with a wreath and two candles. Drawn while the world stages the gathering; gone when it ends.
 */
import { Container, Graphics } from "pixi.js";
import type { LightSource } from "./fx";

export type Staging = { kind: string; x: number; y: number; w: number; night: number; /** a point over the water off the harbour, where the fireworks go up */ over: { x: number; y: number }; couple: { x: number; y: number } | null } | null;

const OUTLINE = { width: 1, color: 0x2f302a, alpha: 0.85, join: "round" as const, cap: "round" as const };
const FLAGS = [0xc4503f, 0xf1e6c8, 0x3f7f78, 0xd9a441, 0x3f6a8c];
const SPARKS = [0xffd27a, 0xff8f6b, 0xbfe3ff, 0xf6f0ff, 0x9fe0b0, 0xffb3d1];
const LAMP = 0xffd89a;

type Burst = { x: number; y: number; born: number; color: number; seed: number; big: boolean };

export class Occasions {
  /** the dressing on the ground, sorted with the people */
  readonly root = new Container();
  /** the fireworks, over everything and added to the light */
  readonly sky = new Container();
  /** lanterns and candles, for the night's lighting */
  lights: LightSource[] = [];
  /** a burst went up this frame, for the sound */
  popped = false;
  private ground = new Graphics();
  private high = new Graphics();
  private sparks = new Graphics();
  private bursts: Burst[] = [];
  private nextBurst = 0;
  private kindNow = "";

  constructor() {
    this.root.addChild(this.ground); this.high.zIndex = 1; this.root.addChild(this.high); this.root.sortableChildren = true;
    this.sparks.blendMode = "add"; this.sky.addChild(this.sparks);
  }

  /** secs is wall time in seconds; still is reduced motion (no flutter, no fireworks, the petals at rest) */
  update(s: Staging, secs: number, still: boolean): void {
    this.popped = false; this.lights = [];
    const kind = s?.kind ?? "";
    if (kind !== this.kindNow) { this.kindNow = kind; this.bursts = []; this.nextBurst = secs + 1.5; }
    this.ground.clear(); this.high.clear();
    if (s && (kind === "wedding" || kind === "feast")) this.festoon(s, secs, still);
    if (s && kind === "wedding" && s.couple && !still) this.petals(s.couple, secs);
    if (s && kind === "funeral") this.bier(s, secs);
    this.fireworks(s && (kind === "feast" || kind === "wedding") && s.night > 0.45 && !still ? s : null, secs);
    this.root.zIndex = s ? s.y + 40 : 0;
  }

  /** two strings of flags over the gathering, on a pole at each end; lanterns hung between the flags light up after dark */
  private festoon(s: NonNullable<Staging>, secs: number, still: boolean): void {
    const g = this.high, x0 = s.x - 26, x1 = s.x + s.w + 26;
    for (const [px, back] of [[x0, 0], [x1, 0], [x0 + 30, -34], [x1 - 30, -34]] as const) g.moveTo(px, s.y + back).lineTo(px, s.y + back - 96).stroke({ width: 3, color: 0x7a5a3c, cap: "round" });
    for (const back of [0, -34]) {
      const ax = back ? x0 + 30 : x0, bx = back ? x1 - 30 : x1, ay = s.y + back - 94, sag = 26;
      const at = (t: number) => [ax + (bx - ax) * t, ay + sag * 4 * t * (1 - t)] as const;
      g.moveTo(ax, ay); for (let t = 0.05; t <= 1.001; t += 0.05) { const [x, y] = at(t); g.lineTo(x, y); } g.stroke({ width: 1.2, color: 0x4a4a42 });
      const n = Math.round((bx - ax) / 17);
      for (let i = 1; i < n; i++) {
        const [x, y] = at(i / n); const sway = still ? 0 : Math.sin(secs * 2.4 + i * 0.9 + back) * 2.2;
        if (i % 3 === 0) { const lit = s.night > 0.25; g.circle(x, y + 7, 3.4).fill(lit ? LAMP : 0xf1e6c8).stroke({ ...OUTLINE, width: 0.8 }); if (lit) this.lights.push({ x, y: y + 7, r: 38, color: LAMP, strength: 0.55 * s.night, flicker: 0.04 }); }
        else g.moveTo(x - 5, y).lineTo(x + 5, y).lineTo(x + sway, y + 12).closePath().fill(FLAGS[(i + (back ? 2 : 0)) % FLAGS.length]!).stroke({ ...OUTLINE, width: 0.7 });
      }
    }
  }

  /** petals over the couple, drifting down and round, the same few again and again */
  private petals(c: { x: number; y: number }, secs: number): void {
    const g = this.high;
    for (let i = 0; i < 26; i++) {
      const life = 3.2, t = ((secs + i * 0.37) % life) / life, ang = i * 2.4;
      const x = c.x + Math.cos(ang) * (14 + i % 5 * 7) + Math.sin(secs * 1.7 + i) * 8, y = c.y - 110 + t * 104;
      g.ellipse(x, y, 2.4, 1.4).fill({ color: i % 3 ? 0xf6c9cf : 0xfff7ef, alpha: 0.9 * Math.min(1, (1 - t) * 3) });
    }
  }

  /** the coffin on its trestles, a wreath on the lid, flowers at its foot and a candle at each end */
  private bier(s: NonNullable<Staging>, secs: number): void {
    const g = this.ground, cx = s.x + s.w / 2, cy = s.y + 6;
    g.ellipse(cx, cy + 6, 40, 9).fill({ color: 0x1b1f1c, alpha: 0.18 });
    for (const dx of [-24, 24]) g.moveTo(cx + dx - 6, cy + 4).lineTo(cx + dx, cy - 14).lineTo(cx + dx + 6, cy + 4).stroke({ width: 2.2, color: 0x5d4330, cap: "round" });
    g.poly([cx - 36, cy - 16, cx + 32, cy - 16, cx + 38, cy - 12, cx + 32, cy - 6, cx - 36, cy - 6, cx - 40, cy - 11]).fill(0x5a3b28).stroke(OUTLINE);
    g.poly([cx - 34, cy - 22, cx + 30, cy - 22, cx + 36, cy - 17, cx + 32, cy - 16, cx - 36, cy - 16, cx - 38, cy - 18]).fill(0x7a5238).stroke(OUTLINE);
    g.moveTo(cx - 20, cy - 20).lineTo(cx - 8, cy - 20).moveTo(cx - 14, cy - 23).lineTo(cx - 14, cy - 17).stroke({ width: 1.6, color: 0xe9dcc0, cap: "round" });
    g.ellipse(cx + 12, cy - 21, 9, 4).stroke({ width: 3, color: 0x4f7a5a }); for (let i = 0; i < 6; i++) g.circle(cx + 12 + Math.cos(i) * 9, cy - 21 + Math.sin(i) * 4, 1.4).fill(i % 2 ? 0xf1e6c8 : 0xc4503f);
    for (let i = 0; i < 7; i++) g.circle(cx - 18 + i * 6, cy + 10 + (i % 2) * 2, 2).fill(FLAGS[i % 3 === 0 ? 1 : i % 3 === 1 ? 0 : 3]!);
    for (const dx of [-50, 50]) {
      g.rect(cx + dx - 2, cy - 18, 4, 18).fill(0xf4efe2).stroke({ ...OUTLINE, width: 0.7 });
      const fl = 1 + Math.sin(secs * 9 + dx) * 0.15; g.ellipse(cx + dx, cy - 22, 2.2 * fl, 4 * fl).fill(0xffd27a);
      if (s.night > 0.15) this.lights.push({ x: cx + dx, y: cy - 22, r: 46, color: LAMP, strength: 0.6 * s.night, flicker: 0.08 });
    }
  }

  /** a burst every couple of seconds over the water off the harbour: it climbs, opens, falls and fades */
  private fireworks(s: Staging, secs: number): void {
    const g = this.sparks; g.clear();
    if (s && secs >= this.nextBurst) {
      const seed = Math.floor(secs * 1000) % 997, big = seed % 4 === 0;
      this.bursts.push({ x: s.over.x - 220 + (seed * 7.3) % 440, y: s.over.y - (seed * 3.1) % 160, born: secs, color: SPARKS[seed % SPARKS.length]!, seed, big });
      this.nextBurst = secs + 1.4 + (seed % 10) / 6; this.popped = true;
    }
    this.bursts = this.bursts.filter((b) => secs - b.born < 2.6);
    for (const b of this.bursts) {
      const age = secs - b.born;
      if (age < 0.6) { const k = age / 0.6; g.circle(b.x, b.y + 220 * (1 - k), 2.2).fill({ color: 0xffe6b0, alpha: 0.9 }); continue; } // the rocket climbing
      const t = age - 0.6, n = b.big ? 34 : 22, r = (b.big ? 150 : 105) * (1 - Math.exp(-t * 2.6)), fade = Math.max(0, 1 - t / 2);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + b.seed, x = b.x + Math.cos(a) * r, y = b.y + Math.sin(a) * r * 0.85 + t * t * 26;
        g.moveTo(x - Math.cos(a) * 9 * fade, y - Math.sin(a) * 8 * fade).lineTo(x, y).stroke({ width: 3, color: b.color, alpha: fade, cap: "round" }); g.circle(x, y, 1.6).fill({ color: 0xffffff, alpha: fade * 0.9 });
      }
      if (t < 0.25) g.circle(b.x, b.y, 26 * (1 - t * 4)).fill({ color: 0xfff3d6, alpha: 0.5 * (1 - t * 4) });
    }
    if (this.bursts.length) for (const b of this.bursts) if (secs - b.born > 0.6 && secs - b.born < 1.6) this.lights.push({ x: b.x, y: b.y + 160, r: 260, color: b.color, strength: 0.25 * (1.6 - (secs - b.born)), noHole: true });
  }
}
