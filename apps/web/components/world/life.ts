/**
 * The small life of the island: what moves when no citizen is doing anything.
 * Gulls on the posts that lift off when someone walks the pier, a cat that keeps the benches, a dog that follows whoever
 * is going somewhere, hens in the yard by the fields, a fishing boat out at dawn and back before dark, leaves in autumn,
 * blossom in spring, fireflies on summer nights, butterflies over the lavender, bats round the lighthouse at dusk,
 * a pennant on the pier that tells the wind, and the lighthouse lamp turning over the water once the night comes.
 * None of it is known to the engine; it is weather for the eye.
 */
import { Container, Graphics } from "pixi.js";
import { CORAL, CREAM, DARK, KELP, LIGHT, WOOD_DARK } from "./palette";
import type { LightSource } from "./fx";
/** the comb and wattle on a painted hen */
const RED_COMB = 0xc4503f;
/** a herring gull's colours, as the figurines are painted */
const GULL_WHITE = 0xf6f3ea, GULL_GREY = 0xa9b3b8, GULL_BEAK = 0xe8c24a;

type Pt = { x: number; y: number };
export type LifeSound = "gull" | "flap" | "bark" | "meow" | "cluck" | "oars";
export type LifePlaces = {
  perches: (Pt & { dir: 1 | -1 })[];
  catSpots: Pt[];
  dogHome: Pt;
  yard: Pt & { r: number };
  trees: () => (Pt & { h: number; orchard: boolean })[];
  flag: Pt;
  moor: Pt;
  spot: Pt;
  lantern: Pt;
  meadows: (Pt & { r: number })[];
  roosts: Pt[];
};
export type LifeInput = { tick: number; hour: number; rise: number; set: number; night: number; season: string; weather: string; wind: number; people: Iterable<Pt & { moving?: boolean }>; /** the GPU night is on: the beam cuts the shade and the fireflies bloom */ effects: boolean };

/** A small seeded random, so the island's animals have habits and not a pattern. */
function rnd(seed: number): () => number { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export type Critter = { kind: "cat" | "dog" | "hen"; g: Graphics; x: number; y: number; tx: number; ty: number; facing: 1 | -1; state: "walk" | "sit" | "peck" | "sleep" | "follow" | "hide"; until: number; seed: () => number; speed: number; who?: Pt; /** held by a hand until this tick: it stays, and is not startled */ pinned: number };
type Gull = { perch: Pt & { dir: 1 | -1 }; away: boolean; t0: number; back: number; seed: number; turned: number };
type Leaf = { x: number; y: number; y1: number; vy: number; ph: number; rot: number; color: number; landed: number; born: number; tree: number };

export class Life {
  /** Everything airborne: gulls, leaves, insects, bats, the lighthouse beam. */
  readonly air = new Graphics();
  /** The fishing boat, at sea. */
  readonly boat = new Graphics();
  /** The pennant on the pier. */
  readonly flag = new Graphics();
  /** What shines by night, for the bloom layer: the beam and the fireflies. */
  readonly glow = new Graphics();
  /** The beam's cut through the night shade. */
  readonly cut = new Graphics();
  /** The animals, one drawing each, sorted into the street by their feet. */
  readonly critters: Critter[] = [];
  /** Light the animals and the lamp give off, for the night to take. */
  lights: LightSource[] = [];
  /** What made a sound this tick, and where; the world hands them to the ambience with the camera's distance. */
  sounds: { name: LifeSound; x: number; y: number; level?: number }[] = [];
  /** Gulls that just went up, for whoever is near enough to look. */
  flushes: { x: number; y: number; at: number }[] = [];
  private gulls: Gull[];
  private leaves: Leaf[] = [];
  private bugs: { x: number; y: number; ph: number; speed: number; color: number; zone: number }[] = [];
  private flies: { x: number; y: number; ph: number; f: number; zone: number }[] = [];
  private bats: { ph: number; roost: number; r: number }[] = [];
  private boatX: number; private boatY: number; private boatOut = false; private wake: { x: number; y: number; t: number }[] = []; readonly wakeG = new Graphics();
  private beam = 0;

  constructor(private readonly P: LifePlaces, scene: Container) {
    this.air.zIndex = 185000; scene.addChild(this.air);
    this.boat.zIndex = 0.7; scene.addChild(this.boat); this.wakeG.zIndex = 0.65; scene.addChild(this.wakeG);
    this.flag.zIndex = P.flag.y + 1; scene.addChild(this.flag);
    this.glow.blendMode = "add"; this.cut.blendMode = "erase";
    const r = rnd(4242);
    this.gulls = P.perches.map((perch, i) => ({ perch, away: r() < 0.35, t0: 0, back: Math.floor(r() * 600), seed: i * 37 + Math.floor(r() * 1000), turned: 0 }));
    const mk = (kind: Critter["kind"], x: number, y: number, seed: number, speed: number): Critter => { const g = new Graphics(); g.position.set(x, y); g.zIndex = y; scene.addChild(g); const c: Critter = { kind, g, x, y, tx: x, ty: y, facing: 1, state: "sit", until: 0, seed: rnd(seed), speed, pinned: 0 }; this.critters.push(c); return c; };
    mk("cat", P.catSpots[0]!.x + 18, P.catSpots[0]!.y + 6, 11, 0.75);
    mk("dog", P.dogHome.x, P.dogHome.y, 23, 1.5);
    for (let i = 0; i < 4; i++) mk("hen", P.yard.x + (r() - 0.5) * P.yard.r, P.yard.y + (r() - 0.5) * P.yard.r * 0.6, 100 + i, 0.5);
    for (let i = 0; i < 36; i++) this.flies.push({ x: 0, y: 0, ph: r() * 100, f: 0.04 + r() * 0.05, zone: i % P.meadows.length });
    for (let i = 0; i < 8; i++) this.bugs.push({ x: 0, y: 0, ph: r() * 100, speed: 0.6 + r() * 0.6, color: [0xfff5c2, 0xffffff, 0xcfe3ff, 0xf3b8a0][i % 4]!, zone: i % P.meadows.length });
    for (let i = 0; i < 6; i++) this.bats.push({ ph: r() * 100, roost: i % P.roosts.length, r: 60 + r() * 90 });
    this.boatX = P.moor.x; this.boatY = P.moor.y;
  }

  update(o: LifeInput): void {
    const { tick, P } = { tick: o.tick, P: this.P };
    const day = o.hour > o.rise - 0.5 && o.hour < o.set + 0.5, storm = o.weather === "storm", wet = storm || o.weather === "rain" || o.weather === "snow";
    const cold = o.season === "winter";
    const people = [...o.people];
    const nearest = (x: number, y: number, movingOnly = false): number => { let d = 1e9; for (const p of people) { if (movingOnly && !p.moving) continue; const dd = Math.hypot(p.x - x, p.y - y); if (dd < d) d = dd; } return d; };
    this.flushes = this.flushes.filter((f) => tick - f.at < 90);
    this.lights = []; this.sounds = [];
    // the pennant: it hangs in a calm, lifts and cracks in a blow, and always points where the wind is going
    if (tick % 2 === 0) {
      const f = this.flag; f.clear(); const { x, y } = P.flag; f.moveTo(0, 0).lineTo(0, -48).stroke({ width: 2.2, color: WOOD_DARK }); f.circle(0, -49, 1.8).fill(KELP);
      const lift = 0.2 + 0.8 * Math.min(1, o.wind * 1.4), L = 24, flap = 8 - o.wind * 5;
      const top: [number, number][] = [], bot: [number, number][] = [];
      for (let i = 0; i <= 6; i++) { const s = i / 6; const wx = s * L * lift, wy = s * L * (1 - lift) * 0.9 + Math.sin(tick / flap - i * 0.8) * (0.4 + o.wind * 2.4) * s; top.push([wx, -46 + wy]); bot.push([wx, -46 + wy + 9 * (1 - s)]); }
      f.moveTo(top[0]![0], top[0]![1]); for (const p of top.slice(1)) f.lineTo(p[0], p[1]); for (const p of bot.reverse()) f.lineTo(p[0], p[1]); f.closePath().fill(CORAL);
      f.position.set(x, y);
    }
    if (o.wind > 0.35 && tick % Math.max(8, Math.round(26 / o.wind)) === 0) this.sounds.push({ name: "flap", x: P.flag.x, y: P.flag.y - 40, level: 0.35 + o.wind * 0.3 });
    // the fishing boat: out past the point at sunrise, back before the light goes, and never in a storm
    { const goOut = day && o.hour > o.rise + 0.3 && o.hour < o.set - 1.4 && !storm && !cold; const to = goOut ? P.spot : P.moor;
      const dx = to.x - this.boatX, dy = to.y - this.boatY, d = Math.hypot(dx, dy); const moving = d > 1.5; if (moving) { const st = Math.min(d, 1.3); this.boatX += (dx / d) * st; this.boatY += (dy / d) * st; }
      this.boatOut = goOut; if (moving && tick % 75 === 0) this.sounds.push({ name: "oars", x: this.boatX, y: this.boatY, level: 0.8 });
      // the wake: a trail of rings that widen and fade behind the hull, and two lines of foam off the bow while she moves
      if (moving && tick % 7 === 0) { this.wake.push({ x: this.boatX, y: this.boatY + 3, t: tick }); if (this.wake.length > 18) this.wake.shift(); }
      if (tick % 2 === 0) { const wg = this.wakeG; wg.clear(); for (const r of this.wake) { const age = (tick - r.t) / 130; if (age > 1) continue; wg.ellipse(r.x, r.y, 6 + age * 26, 2.5 + age * 8).stroke({ width: 1.5, color: 0xf7f6f3, alpha: 0.5 * (1 - age) }); } if (moving) { const dir = dx < 0 ? -1 : 1; wg.moveTo(this.boatX + dir * 16, this.boatY + 2).lineTo(this.boatX - dir * 14, this.boatY + 9).stroke({ width: 2, color: 0xf7f6f3, alpha: 0.35 }); wg.moveTo(this.boatX + dir * 16, this.boatY + 2).lineTo(this.boatX - dir * 12, this.boatY - 4).stroke({ width: 1.5, color: 0xf7f6f3, alpha: 0.25 }); } }
      if (tick % 2 === 0) { const b = this.boat; b.clear(); const bob = Math.sin(tick / 38) * 1.4, dir = dx < 0 ? -1 : 1; b.position.set(this.boatX, this.boatY + bob); b.rotation = Math.sin(tick / 52) * 0.02;
        b.moveTo(-18, -4).lineTo(18, -4).lineTo(13, 4).lineTo(-13, 4).closePath().fill(WOOD_DARK).stroke({ width: 1.2, color: KELP, alpha: 0.8 }); b.moveTo(-16, -5).lineTo(16, -5).stroke({ width: 1.5, color: CREAM, alpha: 0.6 });
        b.moveTo(2, -4).lineTo(2, -34).stroke({ width: 1.6, color: KELP });
        if (moving) b.moveTo(3, -33).lineTo(3 - dir * 16 + Math.sin(tick / 9) * 1.5, -20).lineTo(3, -8).closePath().fill(CREAM).stroke({ width: 1, color: KELP, alpha: 0.6 }); else b.roundRect(0, -30, 4, 22, 2).fill(CREAM);
        b.circle(-6, -9, 2.4).fill(CREAM).stroke({ width: 1, color: KELP }); b.roundRect(-8.5, -7, 5, 5, 1).fill(DARK); // whoever is out there, at the oars or the line
        if (!moving && goOut) b.moveTo(-3, -6).lineTo(-3 + 26, -2 + Math.sin(tick / 30) * 2).stroke({ width: 1, color: KELP, alpha: 0.5 }); // the line, out
        if (moving) for (let i = 1; i <= 3; i++) { const wx = -dir * (20 + i * 12); b.moveTo(wx, 2 + i).lineTo(wx - dir * 10, 2 + i).stroke({ width: 1.6, color: CREAM, alpha: 0.5 - i * 0.12, cap: "round" }); }
      } }
    // the gulls: some wheel, some sit on the posts and the rocks, and a walker on the pier sends them up
    for (const gl of this.gulls) {
      if (!gl.away && (nearest(gl.perch.x, gl.perch.y) < 72 || !day || storm)) { gl.away = true; gl.t0 = tick; gl.back = tick + 500 + ((gl.seed * 97) % 900); this.flushes.push({ x: gl.perch.x, y: gl.perch.y, at: tick }); if (day) { this.sounds.push({ name: "flap", x: gl.perch.x, y: gl.perch.y }); if (gl.seed % 3 === 0) this.sounds.push({ name: "gull", x: gl.perch.x, y: gl.perch.y - 40, level: 0.7 }); } }
      if (gl.away && tick > gl.back && day && !storm && nearest(gl.perch.x, gl.perch.y) > 120) { gl.away = false; gl.t0 = tick; }
      if (!gl.away && tick % 180 === gl.seed % 180) gl.turned = tick + 30;
    }
    // the animals: each keeps its own hours
    for (const c of this.critters) {
      const r = c.seed; const nearWalker = nearest(c.x, c.y, true); const held = c.pinned > tick;
      if (held) { if (c.state === "walk" || c.state === "follow") { c.state = "sit"; c.tx = c.x; c.ty = c.y; } c.until = Math.max(c.until, c.pinned + 60); }
      else if (c.kind === "cat") {
        if (wet || !day) { if (c.state !== "hide" && c.state !== "sleep") { const s = P.catSpots[0]!; c.tx = s.x + 18; c.ty = s.y + 6; c.state = "walk"; c.until = tick + 2000; } }
        if (c.state === "sit" && nearWalker < 44) { const s = P.catSpots[1 + Math.floor(r() * (P.catSpots.length - 1))]!; c.tx = s.x + 14; c.ty = s.y + 6; c.state = "walk"; c.until = tick + 2000; if (r() < 0.6) this.sounds.push({ name: "meow", x: c.x, y: c.y, level: 0.8 }); }
        if (tick > c.until && c.state !== "walk") { if (r() < 0.55 && day && !wet) { const s = P.catSpots[Math.floor(r() * P.catSpots.length)]!; c.tx = s.x + 14 + (r() - 0.5) * 20; c.ty = s.y + 6 + (r() - 0.5) * 10; c.state = "walk"; c.until = tick + 3000; } else { c.state = !day || wet ? (Math.hypot(c.x - P.catSpots[0]!.x - 18, c.y - P.catSpots[0]!.y - 6) < 30 ? "sleep" : "hide") : r() < 0.3 ? "sleep" : "sit"; c.until = tick + 300 + r() * 900; } }
      } else if (c.kind === "dog") {
        if (c.state === "sit" && day && tick % 900 === 0 && r() < 0.4) this.sounds.push({ name: "bark", x: c.x, y: c.y, level: 0.7 });
        if (c.state === "follow") { const w = c.who!; if (tick > c.until || wet || !day) { c.state = "walk"; c.tx = P.dogHome.x; c.ty = P.dogHome.y; c.until = tick + 3000; c.who = undefined; } else { c.tx = w.x - 22 * Math.sign(w.x - c.x || 1); c.ty = w.y + 4; } }
        else if (tick > c.until && c.state !== "walk") { if (day && !wet && r() < 0.5) { let pick: Pt | null = null; for (const p of people) if (Math.hypot(p.x - c.x, p.y - c.y) < 220) { pick = p; if (r() < 0.5) break; } if (pick) { c.who = pick; c.state = "follow"; c.until = tick + 500 + r() * 700; this.sounds.push({ name: "bark", x: c.x, y: c.y }); } else { c.state = "sit"; c.until = tick + 200 + r() * 400; } } else { c.state = !day || wet ? "sleep" : "sit"; c.until = tick + 300 + r() * 600; } }
      } else {
        if (!day || wet) { c.state = "hide"; c.until = tick + 60; }
        else if (nearWalker < 40 && c.state !== "walk") { const ax = c.x - people.reduce((b, p) => (Math.hypot(p.x - c.x, p.y - c.y) < 40 ? p : b), { x: c.x + 1, y: c.y }).x; c.tx = Math.max(P.yard.x - P.yard.r, Math.min(P.yard.x + P.yard.r, c.x + Math.sign(ax || 1) * 50)); c.ty = c.y + (r() - 0.5) * 20; c.state = "walk"; c.until = tick + 400; c.speed = 1.6; this.sounds.push({ name: "cluck", x: c.x, y: c.y, level: 1 }); }
        else if (c.state === "peck" && tick % 240 === 0 && r() < 0.5) this.sounds.push({ name: "cluck", x: c.x, y: c.y, level: 0.5 });
        else if (tick > c.until && c.state !== "walk") { if (r() < 0.4) { c.tx = P.yard.x + (r() - 0.5) * 2 * P.yard.r; c.ty = P.yard.y + (r() - 0.5) * 1.2 * P.yard.r; c.state = "walk"; c.until = tick + 600; c.speed = 0.5; } else { c.state = "peck"; c.until = tick + 60 + r() * 200; } }
      }
      const dx = c.tx - c.x, dy = c.ty - c.y, d = Math.hypot(dx, dy);
      if (c.state === "walk" || c.state === "follow") { if (d > 1) { const st = Math.min(d, c.speed); c.x += (dx / d) * st; c.y += (dy / d) * st; if (Math.abs(dx) > 0.5) c.facing = dx < 0 ? -1 : 1; } else if (c.state === "walk") { c.state = c.kind === "hen" ? "peck" : "sit"; c.until = tick + 200 + r() * 600; } }
      c.g.position.set(c.x, c.y); c.g.zIndex = c.y; c.g.visible = c.state !== "hide";
      if (tick % 2 === 0 && c.g.visible) this.drawCritter(c, tick, o.night, d > 1 && (c.state === "walk" || c.state === "follow"));
    }
    // leaves in autumn, blossom in spring: born in the crowns, carried by the wind, gone in a while on the ground
    const fallSeason = o.season === "autumn" ? "leaf" : o.season === "spring" ? "petal" : null;
    if (fallSeason) {
      const trees = P.trees(); const pool = fallSeason === "petal" ? trees.filter((t) => t.orchard) : trees; const want = fallSeason === "petal" ? 30 : storm ? 120 : 70;
      const r = rnd(tick * 7 + 1);
      while (this.leaves.length < want && pool.length) { const ti = Math.floor(r() * pool.length), t = pool[ti]!; const x = t.x + (r() - 0.5) * 44, y = t.y - t.h + (r() - 0.5) * 24; this.leaves.push({ x, y, y1: t.y + 4 + r() * 16, vy: 0.3 + r() * 0.35, ph: r() * 10, rot: r() * 6, color: fallSeason === "petal" ? [0xfff1f0, 0xf6c9cf, 0xffffff][Math.floor(r() * 3)]! : [0xd98a3c, 0xc9663a, 0xe0b24c, 0xb8562e][Math.floor(r() * 4)]!, landed: 0, born: tick, tree: ti }); }
      for (let i = this.leaves.length - 1; i >= 0; i--) { const lf = this.leaves[i]!; if (lf.landed) { if (tick - lf.landed > 420) this.leaves.splice(i, 1); continue; } lf.y += lf.vy * (1 + o.wind * 0.6); lf.x += Math.sin(tick / 14 + lf.ph) * 0.9 + (0.25 + o.wind * 1.6); lf.rot += 0.05 + o.wind * 0.1; if (lf.y >= lf.y1) { lf.y = lf.y1; lf.landed = tick; } }
      if (this.leaves.length > want + 30) this.leaves.splice(0, this.leaves.length - want - 30);
    } else this.leaves.length = 0;
    // the beam: it turns once the night is on, and it is the one light the whole island can see
    const lampOn = o.night > 0.12 || o.weather === "fog" || storm; this.beam += ((lampOn ? 1 : 0) - this.beam) * 0.03;
    if (this.beam > 0.02) this.lights.push({ x: P.lantern.x, y: P.lantern.y, r: 70 + 50 * Math.abs(Math.cos(tick / 140)), color: LIGHT.lamp, strength: (0.35 + 0.65 * Math.abs(Math.cos(tick / 140))) * this.beam, noHole: true });
    if (tick % 2 !== 0) return;
    // everything in the air, drawn fresh
    const a = this.air; a.clear(); const gw = o.effects ? this.glow : a; this.glow.clear(); this.cut.clear();
    if (this.beam > 0.02) { const ang = tick / 140, Lb = 560, half = 0.055, { x: lx, y: ly } = P.lantern; const wedge = (g: Graphics, h: number, al: number, len: number) => { g.moveTo(lx, ly).lineTo(lx + Math.cos(ang - h) * len, ly + Math.sin(ang - h) * len * 0.55).lineTo(lx + Math.cos(ang + h) * len, ly + Math.sin(ang + h) * len * 0.55).closePath().fill({ color: LIGHT.lamp, alpha: al * this.beam }); };
      wedge(gw, half, o.effects ? 0.16 : 0.09, Lb); wedge(gw, half * 0.45, o.effects ? 0.14 : 0.08, Lb * 0.8); gw.circle(lx, ly, 5).fill({ color: LIGHT.star, alpha: 0.9 * this.beam }); gw.circle(lx, ly, 12).fill({ color: LIGHT.lamp, alpha: 0.3 * this.beam });
      if (o.effects) { const cut = (h: number, al: number, len: number) => { this.cut.moveTo(lx, ly).lineTo(lx + Math.cos(ang - h) * len, ly + Math.sin(ang - h) * len * 0.55).lineTo(lx + Math.cos(ang + h) * len, ly + Math.sin(ang + h) * len * 0.55).closePath().fill({ color: 0xffffff, alpha: al * this.beam }); }; cut(half * 1.6, 0.12, Lb * 1.1); cut(half * 1.1, 0.16, Lb); cut(half * 0.7, 0.18, Lb * 0.95); cut(half * 0.35, 0.2, Lb * 0.9); } }
    for (const gl of this.gulls) {
      const { x, y, dir } = gl.perch; const age = tick - gl.t0;
      if (!gl.away) { const land = Math.min(1, age / 90), from = 1 - land; const gx = x + dir * 90 * from, gy = y - 120 * from * (1 + Math.sin(land * Math.PI) * 0.4); if (land < 1) this.flyGull(gx, gy, tick, gl.seed); else this.sitGull(x, y, dir, tick < gl.turned); }
      else if (age < 160) { const s = age / 160; const gx = x - dir * (40 + s * 260) + Math.sin(s * 5) * 12, gy = y - 20 - s * 170 - Math.sin(s * Math.PI) * 60; this.flyGull(gx, gy, tick, gl.seed); }
    }
    for (const lf of this.leaves) { const al = lf.landed ? Math.max(0, 1 - (tick - lf.landed) / 420) : 1; const c = Math.cos(lf.rot), s = Math.sin(lf.rot), w = 4.4, h = 2.4; a.moveTo(lf.x + c * w, lf.y + s * w * 0.5).lineTo(lf.x - s * h, lf.y + c * h * 0.5).lineTo(lf.x - c * w, lf.y - s * w * 0.5).lineTo(lf.x + s * h, lf.y - c * h * 0.5).closePath().fill({ color: lf.color, alpha: 0.9 * al }); }
    // fireflies: summer, after dark, over the fields and under the pines, each on its own slow beat
    if (o.season === "summer" && o.night > 0.18 && !wet) { const k = Math.min(1, (o.night - 0.18) / 0.2); for (const fl of this.flies) { const z = P.meadows[fl.zone]!; const t = tick / 60; fl.x = z.x + Math.sin(t * 0.31 + fl.ph) * z.r * 0.9 + Math.cos(t * 0.77 + fl.ph * 2) * 18; fl.y = z.y + Math.cos(t * 0.23 + fl.ph * 1.3) * z.r * 0.45 - 14 + Math.sin(t * 1.1 + fl.ph) * 9; const gl = Math.pow(Math.max(0, Math.sin(tick * fl.f + fl.ph)), 3) * k; if (gl < 0.02) continue; if (o.effects) { gw.circle(fl.x, fl.y, 9).fill({ color: 0xd7f27a, alpha: 0.45 * gl }); gw.circle(fl.x, fl.y, 3.4).fill({ color: 0xf2ffb0, alpha: gl }); a.circle(fl.x, fl.y, 1.7).fill({ color: 0xf2ffb0, alpha: gl }); } else { a.circle(fl.x, fl.y, 4.5).fill({ color: 0xd7f27a, alpha: 0.22 * gl }); a.circle(fl.x, fl.y, 1.5).fill({ color: 0xf2ffb0, alpha: gl }); } } }
    // butterflies: warm days over the lavender and the orchard
    if ((o.season === "summer" || o.season === "spring") && day && o.night < 0.1 && !wet && o.wind < 0.9) for (const b of this.bugs) { const z = P.meadows[b.zone]!; const t = tick / 50 * b.speed; b.x = z.x + Math.sin(t * 0.5 + b.ph) * z.r * 0.8 + Math.sin(t * 2.3 + b.ph) * 10; b.y = z.y + Math.cos(t * 0.37 + b.ph * 1.7) * z.r * 0.4 - 22 + Math.sin(t * 3.1) * 6; const fl = Math.abs(Math.sin(tick / 2.4 + b.ph)) * 3.2 + 0.6; a.ellipse(b.x - fl * 0.55, b.y - 0.5, fl, 2.2).fill({ color: b.color, alpha: 0.95 }).stroke({ width: 0.6, color: KELP, alpha: 0.5 }); a.ellipse(b.x + fl * 0.55, b.y - 0.5, fl, 2.2).fill({ color: b.color, alpha: 0.95 }).stroke({ width: 0.6, color: KELP, alpha: 0.5 }); }
    // bats: out of the lighthouse and the bell tower at dusk, all elbows
    if (o.night > 0.22 && o.season !== "winter" && !wet) { const k = Math.min(1, (o.night - 0.22) / 0.15); for (const bt of this.bats) { const rs = P.roosts[bt.roost]!; const t = tick / 30; const bx = rs.x + Math.sin(t * 0.9 + bt.ph) * bt.r + Math.sin(t * 4.7 + bt.ph) * 14, by = rs.y - 60 + Math.cos(t * 0.6 + bt.ph * 2) * bt.r * 0.5 + Math.sin(t * 6.1) * 10; const fl = Math.sin(tick / 1.7 + bt.ph) * 4; a.moveTo(bx - 8, by + fl).quadraticCurveTo(bx - 4, by - 3, bx, by).quadraticCurveTo(bx + 4, by - 3, bx + 8, by + fl).stroke({ width: 1.6, color: DARK, alpha: 0.85 * k, cap: "round" }); } }
  }

  /** a gull in flight, painted like the figurines: white body, grey wings with black tips, the beak yellow */
  private flyGull(x: number, y: number, tick: number, seed: number): void {
    const a = this.air; const flap = Math.sin(tick / 5 + seed) * 5; const O = { width: 0.8, color: 0x2f302a, alpha: 0.8, join: "round" as const };
    for (const side of [-1, 1] as const) {
      const tipX = x + side * 13, tipY = y - 2 + flap, elbowX = x + side * 6, elbowY = y - 4 - flap * 0.3;
      a.moveTo(x + side * 2, y - 1).quadraticCurveTo(elbowX, elbowY - 2, tipX, tipY).lineTo(elbowX + side * 1.5, elbowY + 3.2).lineTo(x + side * 2, y + 1.5).closePath().fill(GULL_GREY).stroke(O);
      a.moveTo(tipX, tipY).lineTo(tipX - side * 4, tipY + 0.4).lineTo(tipX - side * 2.6, tipY + 2.2).closePath().fill(0x2a2d30);
    }
    a.ellipse(x, y, 4.6, 2.4).fill(GULL_WHITE).stroke(O); a.circle(x + 4.4, y - 1.2, 1.9).fill(GULL_WHITE).stroke(O); a.moveTo(x + 6, y - 1).lineTo(x + 8.4, y - 0.5).lineTo(x + 6, y + 0.2).closePath().fill(GULL_BEAK);
  }
  /** a gull sat on a post: pink feet, white breast, the grey mantle with its black tip and white spots, a yellow beak with the red spot, a bright eye */
  private sitGull(x: number, y: number, dir: number, turned: boolean): void {
    const a = this.air; const O = { width: 0.85, color: 0x2f302a, alpha: 0.85, join: "round" as const, cap: "round" as const };
    const hx = turned ? 1.2 : 5.2, hy = turned ? -9.5 : -8.5;
    a.moveTo(x - 1.6, y).lineTo(x - 1.4, y - 3).moveTo(x + 1.6, y).lineTo(x + 1.4, y - 3).stroke({ width: 1.2, color: 0xe8a49a, cap: "round" });
    a.moveTo(x - dir * 5.5, y - 5).lineTo(x - dir * 10.5, y - 4).lineTo(x - dir * 5.5, y - 3).closePath().fill(0x2a2d30).stroke({ ...O, width: 0.6 }); a.circle(x - dir * 9, y - 4, 0.6).fill(0xffffff);
    a.ellipse(x, y - 5, 6.6, 4).fill(GULL_WHITE).stroke(O);
    a.moveTo(x - dir * 6, y - 5.4).quadraticCurveTo(x - dir * 1, y - 9.6, x + dir * 3.2, y - 6.6).quadraticCurveTo(x, y - 4.2, x - dir * 6, y - 4).closePath().fill(GULL_GREY).stroke({ ...O, width: 0.6 });
    a.circle(x + dir * hx, y + hy, 2.8).fill(GULL_WHITE).stroke(O);
    a.moveTo(x + dir * (hx + 2.2), y + hy - 0.2).lineTo(x + dir * (hx + 5.4), y + hy + 0.6).lineTo(x + dir * (hx + 2.2), y + hy + 1.3).closePath().fill(GULL_BEAK).stroke({ ...O, width: 0.5 }); a.circle(x + dir * (hx + 4.2), y + hy + 0.8, 0.5).fill(0xc4503f);
    a.circle(x + dir * (hx + 1), y + hy - 0.7, 0.7).fill(0x1f1d1b); a.circle(x + dir * (hx + 1.2), y + hy - 0.95, 0.25).fill(0xffffff);
    a.ellipse(x - dir * 1.5, y - 6.6, 2.4, 1).fill({ color: 0xffffff, alpha: 0.35 }); // varnish
  }
  /** the animals as the people are drawn: painted figurines on a turned base, hopping as they are moved; false keeps the flat silhouettes */
  figurine = true;
  private drawFigurine(c: Critter, tick: number, night: number, moving: boolean): void {
    const g = c.g; g.clear(); g.scale.x = c.facing;
    const O = { width: 0.9, color: 0x2f302a, alpha: 0.85, join: "round" as const, cap: "round" as const };
    const asleep = c.state === "sleep", sit = c.state === "sit" || c.state === "hide";
    const hop = moving ? Math.abs(Math.sin(tick / (c.kind === "dog" ? 4 : c.kind === "hen" ? 3 : 5))) * (c.kind === "hen" ? 1.6 : 2.4) : 0;
    const br = c.kind === "dog" ? 11 : c.kind === "cat" ? 9 : 6;
    g.ellipse(0, 1.2, br + 2, 3.4).fill({ color: KELP, alpha: 0.16 });
    if (!asleep) { g.ellipse(0, 1.2 - hop, br, 3.6).fill(0x2f3a2c); g.ellipse(0, -hop, br, 3.6).fill(0x4f6446).stroke({ width: 0.8, color: 0x2a3326 }); g.ellipse(0, -0.3 - hop, br - 1.4, 2.8).stroke({ width: 0.6, color: 0x8ea07c, alpha: 0.7 }); }
    const y0 = asleep ? 0 : -1.5 - hop;
    const eye = (x: number, y: number) => { if (night > 0.15 && c.kind === "cat") { g.circle(x, y, 0.9).fill(LIGHT.star); return; } g.ellipse(x, y, 0.8, 1).fill(0x1f1d1b); g.circle(x + 0.3, y - 0.3, 0.3).fill(0xffffff); };
    const gloss = (x: number, y: number, rx: number) => g.ellipse(x, y, rx, rx * 0.5).fill({ color: 0xffffff, alpha: 0.28 });
    if (c.kind === "cat") {
      const fur = 0x7d756c, stripe = 0x544d46; const sw = Math.sin(tick / 16) * 2;
      if (asleep) { g.ellipse(0, -4, 9.5, 5.2).fill(fur).stroke(O); g.moveTo(-8, -2).quadraticCurveTo(-1, 3, 7, -0.5).stroke({ width: 2.4, color: stripe, cap: "round" }); g.circle(6, -6.5, 3.8).fill(fur).stroke(O); g.moveTo(3.8, -9).lineTo(4.6, -12.5).lineTo(6.2, -9.6).moveTo(7, -9.6).lineTo(8.6, -12.5).lineTo(9.2, -9).fill(fur).stroke(O); for (const x of [5, 7.4]) g.moveTo(x - 0.8, -6.4).quadraticCurveTo(x, -5.8, x + 0.8, -6.4).stroke({ width: 0.6, color: 0x1f1d1b }); return; }
      if (sit) { g.moveTo(-5, y0 - 2).quadraticCurveTo(-12, y0 - 2 + sw, -11, y0 - 10 + sw * 1.5).stroke({ width: 3, color: fur, cap: "round" }); g.ellipse(0, y0 - 6.5, 6.2, 7).fill(fur).stroke(O); for (const yy of [-9, -6, -3]) g.moveTo(-4, y0 + yy).quadraticCurveTo(-1, y0 + yy + 1.5, 2, y0 + yy).stroke({ width: 1, color: stripe, alpha: 0.7 }); g.ellipse(2.4, y0 - 5, 2.2, 3.4).fill(0xefe4c8); }
      else { const lg = (x: number, k: number) => { const d = moving ? Math.sin(tick / 4 + k * Math.PI / 2) * 1.8 : 0; g.moveTo(x, y0 - 4).lineTo(x + d, y0).stroke({ width: 2.2, color: stripe, cap: "round" }); }; for (let k = 0; k < 4; k++) lg(-6 + k * 4, k); g.moveTo(-9, y0 - 6).quadraticCurveTo(-15, y0 - 9 + sw, -13, y0 - 16 + sw).stroke({ width: 2.8, color: fur, cap: "round" }); g.ellipse(0, y0 - 6, 10, 4.4).fill(fur).stroke(O); for (const x of [-5, -1.5, 2]) g.moveTo(x, y0 - 10).quadraticCurveTo(x + 1, y0 - 6, x, y0 - 2.5).stroke({ width: 1, color: stripe, alpha: 0.7 }); }
      const hx = sit ? 2 : 8.5, hy = sit ? y0 - 14.5 : y0 - 10;
      g.moveTo(hx - 3.6, hy - 1.6).lineTo(hx - 2.8, hy - 7.2).lineTo(hx - 0.2, hy - 3.6).closePath().fill(fur).stroke(O); g.moveTo(hx + 0.6, hy - 3.6).lineTo(hx + 2.8, hy - 7.2).lineTo(hx + 3.9, hy - 1.6).closePath().fill(fur).stroke(O);
      g.circle(hx, hy, 4.3).fill(fur).stroke(O); g.ellipse(hx + 1.6, hy + 1.6, 2.2, 1.6).fill(0xefe4c8); eye(hx - 0.2, hy - 0.6); eye(hx + 2.6, hy - 0.6); g.circle(hx + 1.8, hy + 1, 0.6).fill(0xd98a86); gloss(hx - 1.6, hy - 2.4, 1.4);
    } else if (c.kind === "dog") {
      const coat = 0xb8864f, dark = 0x7a5534, chest = 0xefe4c8; const wag = c.state === "follow" || c.pinned > tick ? Math.sin(tick / 2) * 4 : Math.sin(tick / 12) * 1.5;
      if (asleep) { g.ellipse(0, -4.5, 11.5, 5.6).fill(coat).stroke(O); g.ellipse(-3, -6, 4, 2.4).fill(dark); g.circle(8, -6, 4.4).fill(coat).stroke(O); g.ellipse(6.2, -8.2, 2.2, 3.4).fill(dark).stroke({ ...O, width: 0.6 }); g.ellipse(11, -5, 1.8, 1.4).fill(chest); g.circle(12.3, -5.2, 0.8).fill(0x1f1d1b); g.moveTo(7.4, -6).quadraticCurveTo(8.2, -5.4, 9, -6).stroke({ width: 0.6, color: 0x1f1d1b }); return; }
      if (sit) { g.moveTo(-6, y0 - 2).quadraticCurveTo(-12, y0 - 1 + wag, -14, y0 - 6 + wag).stroke({ width: 2.8, color: coat, cap: "round" }); g.ellipse(0, y0 - 7, 7.4, 8).fill(coat).stroke(O); g.ellipse(2.4, y0 - 6.5, 3, 4.6).fill(chest); g.ellipse(-3, y0 - 9, 3, 2.2).fill(dark); }
      else { const lg = (x: number, k: number) => { const d = moving ? Math.sin(tick / 3 + k * Math.PI / 2) * 2.2 : 0; g.moveTo(x, y0 - 5).lineTo(x + d, y0).stroke({ width: 2.6, color: dark, cap: "round" }); }; for (let k = 0; k < 4; k++) lg(-8 + k * 5, k); g.moveTo(-11, y0 - 8).quadraticCurveTo(-15, y0 - 12 + wag, -16, y0 - 15 + wag).stroke({ width: 2.8, color: coat, cap: "round" }); g.ellipse(0, y0 - 7.5, 12, 5.4).fill(coat).stroke(O); g.ellipse(-4, y0 - 9.5, 4, 2.4).fill(dark); g.ellipse(7, y0 - 6, 3.4, 3).fill(chest); }
      const hx = sit ? 3 : 10.5, hy = sit ? y0 - 16 : y0 - 12;
      g.circle(hx, hy, 4.8).fill(coat).stroke(O); g.ellipse(hx + 4, hy + 1.4, 3, 2.2).fill(chest).stroke({ ...O, width: 0.6 }); g.circle(hx + 6.4, hy + 0.8, 1).fill(0x1f1d1b); eye(hx + 1.6, hy - 1.2);
      g.ellipse(hx - 2.4, hy + 0.4, 2.3, 4).fill(dark).stroke({ ...O, width: 0.6 }); gloss(hx - 0.6, hy - 2.8, 1.6);
      if (c.state === "follow") g.moveTo(hx + 3.6, hy + 3).quadraticCurveTo(hx + 4.6, hy + 5.6, hx + 5.4, hy + 3.2).fill(0xd98a86);
    } else {
      const bob = c.state === "peck" ? Math.max(0, Math.sin(tick / 5)) * 4 : 0;
      for (const [x, k] of [[-1.5, 0], [1.5, 1]] as const) { const d = moving ? Math.sin(tick / 3 + k * Math.PI) * 1.2 : 0; g.moveTo(x, y0 - 3).lineTo(x + d, y0).stroke({ width: 1.2, color: CORAL, cap: "round" }); }
      g.moveTo(-4.5, y0 - 7).lineTo(-8.5, y0 - 12).lineTo(-3, y0 - 9).closePath().fill(0xe9dcc2).stroke(O);
      g.ellipse(0, y0 - 5.8, 5.8, 4).fill(CREAM).stroke(O); g.ellipse(-0.8, y0 - 6.3, 3.2, 1.6).fill({ color: 0xd8cbb0, alpha: 0.9 });
      const hx = 5, hy = y0 - 10 + bob; g.moveTo(3, y0 - 7).lineTo(hx, hy).stroke({ width: 2.6, color: CREAM });
      g.moveTo(hx - 1.6, hy - 2.2).lineTo(hx - 0.8, hy - 4.6).lineTo(hx + 0.2, hy - 3).lineTo(hx + 1.2, hy - 4.8).lineTo(hx + 1.8, hy - 2.2).closePath().fill(RED_COMB);
      g.circle(hx, hy, 2.6).fill(CREAM).stroke(O); g.moveTo(hx + 2.3, hy - 0.4).lineTo(hx + 4.8, hy + 0.3).lineTo(hx + 2.3, hy + 1).closePath().fill(0xd9a441); g.ellipse(hx + 0.6, hy + 2.4, 0.9, 1.3).fill(RED_COMB); eye(hx + 0.8, hy - 0.6); gloss(-2, y0 - 8, 1.8);
    }
  }
  private drawCritter(c: Critter, tick: number, night: number, moving: boolean): void {
    if (this.figurine) { this.drawFigurine(c, tick, night, moving); return; }
    const g = c.g; g.clear(); g.scale.x = c.facing; const leg = (x: number, k: number, len: number, w: number) => { const dx = moving ? Math.sin(tick / (c.kind === "dog" ? 3 : 4) + k * Math.PI / 2) * 2.2 : 0; g.moveTo(x, -len).lineTo(x + dx, 0).stroke({ width: w, color: c.kind === "hen" ? CORAL : c.kind === "dog" ? WOOD_DARK : DARK, cap: "round" }); };
    if (c.kind === "cat") {
      g.ellipse(0, 0.5, 11, 3).fill({ color: KELP, alpha: 0.12 });
      if (c.state === "sleep") { g.ellipse(0, -4, 10, 5.5).fill(DARK); g.circle(6, -6, 3.6).fill(DARK); g.moveTo(-9, -3).quadraticCurveTo(-2, 3, 8, -1).stroke({ width: 2, color: DARK, cap: "round" }); g.moveTo(3.5, -9).lineTo(4.5, -12).lineTo(6, -9).moveTo(7, -9).lineTo(8.5, -12).lineTo(9.5, -9).stroke({ width: 1.4, color: DARK }); return; }
      const sit = c.state === "sit" || c.state === "hide"; const sw = Math.sin(tick / 16) * 2;
      if (sit) { g.ellipse(0, -6, 6.5, 7).fill(DARK); g.moveTo(-6, -2).quadraticCurveTo(-13, -2 + sw, -12, -10 + sw * 1.5).stroke({ width: 2, color: DARK, cap: "round" }); }
      else { for (let k = 0; k < 4; k++) leg(-6 + k * 4, k, 4, 1.6); g.ellipse(0, -5.5, 11, 4.3).fill(DARK); g.moveTo(-10, -6).quadraticCurveTo(-16, -9 + sw, -14, -16 + sw).stroke({ width: 2, color: DARK, cap: "round" }); }
      const hx = sit ? 2 : 9, hy = sit ? -14 : -9; g.circle(hx, hy, 4).fill(DARK); g.moveTo(hx - 3.5, hy - 2).lineTo(hx - 2.5, hy - 7).lineTo(hx, hy - 3.5).moveTo(hx + 0.5, hy - 3.5).lineTo(hx + 2.5, hy - 7).lineTo(hx + 3.8, hy - 2).stroke({ width: 1.5, color: DARK });
      if (night > 0.15) { g.circle(hx + 1.2, hy - 0.5, 0.7).fill(LIGHT.star); g.circle(hx + 3, hy - 0.5, 0.7).fill(LIGHT.star); }
    } else if (c.kind === "dog") {
      g.ellipse(0, 0.5, 13, 3.5).fill({ color: KELP, alpha: 0.12 });
      if (c.state === "sleep") { g.ellipse(0, -4, 12, 5.5).fill(WOOD_DARK); g.circle(8, -6, 4.2).fill(WOOD_DARK); g.ellipse(6, -8, 2.2, 3.2).fill(0x8a7756); return; }
      const sit = c.state === "sit"; const wag = c.state === "follow" || c.pinned > tick ? Math.sin(tick / 2) * 4 : Math.sin(tick / 12) * 1.5;
      if (sit) { g.ellipse(0, -6.5, 7.5, 8).fill(WOOD_DARK); g.moveTo(-7, -2).quadraticCurveTo(-13, -1 + wag, -15, -6 + wag).stroke({ width: 2.2, color: WOOD_DARK, cap: "round" }); }
      else { for (let k = 0; k < 4; k++) leg(-8 + k * 5, k, 5, 2); g.ellipse(0, -7, 13, 5.5).fill(WOOD_DARK); g.moveTo(-12, -8).quadraticCurveTo(-16, -12 + wag, -17, -15 + wag).stroke({ width: 2.2, color: WOOD_DARK, cap: "round" }); }
      const hx = sit ? 3 : 11, hy = sit ? -16 : -11; g.circle(hx, hy, 4.6).fill(WOOD_DARK); g.circle(hx + 4, hy + 1, 2.2).fill(0x8a7756); g.circle(hx + 5.5, hy + 0.6, 0.9).fill(KELP); g.ellipse(hx - 2, hy - 1, 2.2, 3.6).fill(0x8a7756); g.circle(hx + 1.5, hy - 1.2, 0.7).fill(KELP);
    } else {
      g.ellipse(0, 0.5, 6, 2).fill({ color: KELP, alpha: 0.1 });
      const bob = c.state === "peck" ? Math.max(0, Math.sin(tick / 5)) * 4 : moving ? Math.sin(tick / 4) * 1 : 0;
      leg(-1.5, 0, 3, 1.1); leg(1.5, 1, 3, 1.1);
      g.ellipse(0, -5.5, 6, 4).fill(CREAM).stroke({ width: 0.8, color: KELP, alpha: 0.7 }); g.moveTo(-5, -7).lineTo(-9, -12).lineTo(-3.5, -9).closePath().fill(CREAM).stroke({ width: 0.8, color: KELP, alpha: 0.7 });
      const hx = 5.5, hy = -10 + bob; g.moveTo(3, -7).lineTo(hx, hy).stroke({ width: 2.2, color: CREAM }); g.circle(hx, hy, 2.6).fill(CREAM).stroke({ width: 0.8, color: KELP, alpha: 0.7 }); g.moveTo(hx - 1.5, hy - 2.2).lineTo(hx, hy - 4.4).lineTo(hx + 1.5, hy - 2.2).closePath().fill(CORAL); g.moveTo(hx + 2.4, hy - 0.4).lineTo(hx + 5, hy + 0.4).lineTo(hx + 2.4, hy + 1).closePath().fill(CORAL); g.circle(hx + 1, hy - 0.7, 0.55).fill(KELP);
    }
  }
}
