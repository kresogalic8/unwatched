/**
 * A citizen as a painted miniature: a turned wooden base, a body of rounded pieces, a big head with two painted eyes and a
 * dot of gloss where the light catches the varnish. The same Look a citizen chooses at boarding, and the same rig the town
 * drives for everyone else: every pose, the tools of each trade, what they hold, their mood, the weather on them, a seat.
 * Walking, they hop from step to step the way a figure is moved across a table. The origin is the centre of the base;
 * a figure stands about 52 units tall.
 */
import { Container, Graphics } from "pixi.js";
import { skinOf, type Facing, type Look, type Pose } from "./citizen";

const CLOTH: Record<Look["top"], number> = { Teal: 0x3f7f78, Sage: 0x8fa56a, Cream: 0xefe4c8, Sand: 0xd9b98a, Kelp: 0x3e5548 };
const HAIR: Record<NonNullable<Look["hairColor"]>, number> = { Dark: 0x2e2622, Brown: 0x6b4a33, Fair: 0xd9b56a, Red: 0xb35a32, Grey: 0xbfc6c2 };
const OUTLINE = { width: 0.9, color: 0x2f302a, alpha: 0.85, join: "round" as const, cap: "round" as const };
const RED = 0xc4503f, BOOT = 0x3a2f28, WOOD = 0xb8935f, IRON = 0x3c3f40, INK = 0x2f302a;
const shade = (c: number, k: number) => { const ch = (s: number) => Math.max(0, Math.min(255, Math.round(((c >> s) & 255) * (1 + k)))); return (ch(16) << 16) | (ch(8) << 8) | ch(0); };
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

type WorkStyle = "swing" | "knead" | "haul" | "push" | "sweep" | "angle";
/** Where every moving part sits for a pose at a moment; the rig eases toward it. */
type Stance = { lift: number; tilt: number; lean: number; legL: number; legR: number; legY: number; armL: number; armR: number; head: number; hip: number; lying: number };

/** A figurine stands about 70% of the drawn rig's height; views sized for that rig multiply by this to keep the same presence. */
export const FIGURE_SCALE = 1.3;
/** How far above the base the centre of the head sits, in rig units, for a look and an age: portraits frame on it. */
export function headHeight(look: Look, years: number): number { const tall = look.build === "Tall" ? 1.08 : 1; const k = years < 16 ? 0.62 + (years / 16) * 0.3 : years >= 70 ? 0.95 : 1; return (32 * tall + 9) * k; }

export class Figurine extends Container {
  /** the pose the town last asked for */
  pose: Pose = "idle";
  private shadow = new Graphics();
  private base = new Graphics();
  private body = new Container();
  private legL = new Graphics(); private legR = new Graphics();
  private upper = new Container();
  private torso = new Graphics(); private apron = new Graphics(); private patch = new Graphics(); private scarf = new Graphics();
  private armL = new Container(); private armR = new Container();
  private tool = new Graphics(); private held = new Graphics(); private book = new Graphics();
  private head = new Container(); private faceParts = new Container(); private eyes = new Graphics(); private mouth = new Graphics(); private brows = new Graphics();
  private backHair = new Graphics(); private umbrella = new Graphics(); private hood = new Graphics(); private breath = new Graphics();
  private facing: Facing = "right"; private tall = 1; private wide = 1;
  private workStyle: WorkStyle = "swing"; private tradeName = "\u0000"; private heldItem = "\u0000"; private years = 30;
  private moodNow = { hunger: 0, joy: 0, grief: 0, anger: 0, surprise: 0, tired: 0 };
  private gear = { rain: false, cold: false }; private state = { broke: false, roof: true, roofless: false };
  private seatHeight: number | null = null; private travelDistance: number | null = null; private gait = 0;
  private gaze = 0; private glanceTilt = 0; private lastT: number | null = null; private phase: number;
  private now: Stance = { lift: 0, tilt: 0, lean: 0, legL: 0, legR: 0, legY: 1, armL: 0.08, armR: -0.08, head: 0, hip: 0, lying: 0 };

  constructor(readonly look: Look, phase = Math.random() * 10) {
    super(); this.phase = phase;
    this.addChild(this.shadow, this.base, this.body);
    this.body.addChild(this.legL, this.legR, this.upper);
    this.upper.addChild(this.armL, this.torso, this.apron, this.patch, this.scarf, this.head, this.armR);
    this.draw();
  }

  private draw(): void {
    const L = this.look; const top = CLOTH[L.top], bottom = CLOTH[L.bottom], skin = skinOf(L), hair = HAIR[L.hairColor ?? "Dark"];
    this.wide = L.build === "Sturdy" ? 1.14 : L.build === "Slight" ? 0.9 : L.shape === "Broad" ? 1.08 : 1; this.tall = L.build === "Tall" ? 1.08 : 1;
    const { wide, tall } = this; const hip = 15 * tall;
    // the base: a turned disc, painted, with a pale bevel on its rim
    const b = this.base; b.ellipse(0, 1.5, 12.5, 5).fill(0x2f3a2c); b.ellipse(0, 0, 12.5, 5).fill(0x4f6446).stroke({ width: 0.8, color: 0x2a3326 }); b.ellipse(0, -0.3, 11, 4.1).stroke({ width: 0.7, color: 0x8ea07c, alpha: 0.7 });
    // legs and boots, pivoting at the hip
    for (const [leg, x] of [[this.legL, -3.2 * wide], [this.legR, 3.2 * wide]] as const) { leg.roundRect(-2.4, 0, 4.8, 12 * tall, 2.2).fill(bottom).stroke(OUTLINE); leg.roundRect(-2.7, 10 * tall, 6, 3.2, 1.4).fill(BOOT); leg.position.set(x, -hip); }
    // everything above the hip turns together: it stoops, leans, crouches
    this.upper.position.set(0, -hip);
    const t = this.torso; const tw = 16 * wide, th = 17 * tall;
    t.roundRect(-tw / 2, -th, tw, th, L.shape === "Round" ? 8 : 6).fill(top).stroke(OUTLINE);
    if (L.pattern === "Stripes") for (let y = -th + 3; y < -1; y += 3.4) t.moveTo(-tw / 2 + 1.5, y).lineTo(tw / 2 - 1.5, y).stroke({ width: 1.2, color: shade(top, -0.22), alpha: 0.8 });
    if (L.pattern === "Checks") for (let x = -tw / 2 + 3; x < tw / 2; x += 4) t.moveTo(x, -th + 1).lineTo(x, -1).stroke({ width: 1, color: shade(top, -0.2), alpha: 0.6 });
    t.roundRect(-tw / 2 + 1.5, -3.5, tw - 3, 3, 1.2).fill(shade(bottom, -0.25));
    if (L.coral === "Scarf") { t.roundRect(-6 * wide, -th - 1.5, 12 * wide, 4, 2).fill(RED); t.moveTo(3, -th + 1).lineTo(5, -th + 8).stroke({ width: 2.4, color: RED, cap: "round" }); }
    if (L.coral === "Buttons") for (const y of [-th + 3, -th + 7, -th + 11]) t.circle(0, y, 0.9).fill(RED);
    if (L.carrying === "Satchel") { t.moveTo(-tw / 2 + 2, -th + 1).lineTo(tw / 2 - 2, -4).stroke({ width: 1.3, color: 0x6e4b33 }); t.roundRect(tw / 2 - 5, -6, 6, 5, 1.2).fill(0x8a5f3f).stroke(OUTLINE); }
    t.ellipse(-tw / 4, -th + 4, 2.2, 3.5).fill({ color: 0xffffff, alpha: 0.18 }); // varnish
    this.apron.roundRect(-tw / 2 + 2, -th + 6, tw - 4, th - 4, 2).fill(0xf2ece0).stroke(OUTLINE); this.apron.visible = false;
    this.patch.rect(tw / 2 - 6, -th + 5, 4, 4).fill(shade(top, -0.3)); this.patch.rect(-tw / 2 + 2, -7, 3.5, 3).fill(shade(top, 0.2)); this.patch.visible = false;
    this.scarf.roundRect(-7 * wide, -th - 2, 14 * wide, 4.5, 2).fill(0xb8452f).stroke(OUTLINE); this.scarf.moveTo(-3, -th + 2).lineTo(-4, -th + 9).stroke({ width: 2.6, color: 0xb8452f, cap: "round" }); this.scarf.visible = false;
    // arms, pivoting at the shoulder; the working hand carries the tool or what is held, the other what was brought on the boat
    for (const [arm, x] of [[this.armL, -tw / 2 - 0.5], [this.armR, tw / 2 + 0.5]] as const) {
      const g = new Graphics(); g.roundRect(-2.2, 0, 4.4, 12 * tall, 2.2).fill(shade(top, -0.06)).stroke(OUTLINE); g.circle(0, 12.5 * tall, 2.3).fill(skin).stroke(OUTLINE); arm.addChild(g);
      arm.position.set(x, -th + 2);
    }
    const carry = new Graphics(); const hy = 13 * tall;
    if (L.carrying === "Basket") { carry.roundRect(-4, hy, 8, 6, 2).fill(0xc79a5b).stroke(OUTLINE); carry.moveTo(-3, hy + 1).quadraticCurveTo(0, hy - 5, 3, hy + 1).stroke({ width: 1, color: 0x8a6437 }); }
    if (L.carrying === "Suitcase") carry.roundRect(-5, hy + 0.5, 10, 8, 1.5).fill(0x8e5b3c).stroke(OUTLINE);
    if (L.carrying === "Tool bag") carry.roundRect(-4.5, hy + 0.5, 9, 6, 2).fill(0x5d6b52).stroke(OUTLINE);
    this.armL.addChild(carry);
    this.tool.position.set(0, 12.5 * tall); this.held.position.set(0, 12.5 * tall); this.armR.addChild(this.tool, this.held); this.tool.visible = false;
    this.book.roundRect(-5, -3, 10, 7, 1).fill(0xf2ece0).stroke(OUTLINE); this.book.moveTo(0, -3).lineTo(0, 4).stroke({ width: 0.6, color: INK }); this.book.visible = false; this.upper.addChild(this.book); this.book.position.set(6, -th + 6);
    // the head: big, round, painted
    const h = this.head; h.position.set(0, -th - 9);
    const skull = new Graphics(); skull.circle(0, 0, 9).fill(skin).stroke(OUTLINE); h.addChild(skull);
    const f = this.faceParts; const cheeks = new Graphics(); cheeks.ellipse(-5, 3, 1.8, 1.1).fill({ color: 0xe0736a, alpha: 0.45 }).ellipse(5, 3, 1.8, 1.1).fill({ color: 0xe0736a, alpha: 0.45 }); f.addChild(cheeks, this.eyes, this.brows);
    if (L.glasses) { const gl = new Graphics(); gl.circle(-3.1, -0.3, 2.6).stroke({ width: 0.7, color: 0x2a2a2a }).circle(3.1, -0.3, 2.6).stroke({ width: 0.7, color: 0x2a2a2a }).moveTo(-0.5, -0.3).lineTo(0.5, -0.3).stroke({ width: 0.7, color: 0x2a2a2a }); f.addChild(gl); }
    const beard = L.beard ?? "None"; const bc = shade(hair, 0.05); const bg = new Graphics();
    if (beard === "Moustache") bg.moveTo(-3, 2.6).quadraticCurveTo(0, 1.4, 3, 2.6).stroke({ width: 1.6, color: bc, cap: "round" });
    if (beard === "Short") bg.moveTo(-7, 2).quadraticCurveTo(-6, 9, 0, 10).quadraticCurveTo(6, 9, 7, 2).quadraticCurveTo(5, 6.6, 0, 7.4).quadraticCurveTo(-5, 6.6, -7, 2).fill(bc);
    if (beard === "Full") { bg.moveTo(-7.8, 0.5).quadraticCurveTo(-7.4, 10, 0, 11.2).quadraticCurveTo(7.4, 10, 7.8, 0.5).quadraticCurveTo(4.5, 5.6, 2.6, 5).lineTo(-2.6, 5).quadraticCurveTo(-4.5, 5.6, -7.8, 0.5).fill(bc); bg.moveTo(-3, 3.2).quadraticCurveTo(0, 2, 3, 3.2).stroke({ width: 1.4, color: bc, cap: "round" }); }
    f.addChild(bg, this.mouth); h.addChild(f);
    // turned away, the back of the head is all hair
    const hairOn = L.hair !== "Under a hat"; this.backHair.circle(0, 0, 8.9).fill(hairOn ? hair : skin); this.backHair.visible = false; h.addChild(this.backHair);
    const hr = new Graphics();
    if (hairOn) {
      if (L.hair === "Short dark" || L.hair === "Grey") hr.moveTo(-9, -1).quadraticCurveTo(-9.5, -10.5, 0, -10.5).quadraticCurveTo(9.5, -10.5, 9, -1).quadraticCurveTo(5, -6, 0, -5.5).quadraticCurveTo(-5, -6, -9, -1).fill(hair).stroke(OUTLINE);
      if (L.hair === "Bob") hr.moveTo(-10, 5).quadraticCurveTo(-11, -11, 0, -11).quadraticCurveTo(11, -11, 10, 5).lineTo(7, 5).quadraticCurveTo(7, -4, 0, -5).quadraticCurveTo(-7, -4, -7, 5).closePath().fill(hair).stroke(OUTLINE);
      if (L.hair === "Curls") for (let k = 0; k < 11; k++) { const a = Math.PI * (0.95 + (k / 10) * 1.1); hr.circle(Math.cos(a) * 8.6, Math.sin(a) * 8.6 - 1, 3.1).fill(hair).stroke({ ...OUTLINE, width: 0.6 }); }
      if (L.hair === "Bun") { hr.circle(0, -11.5, 4).fill(hair).stroke(OUTLINE); hr.moveTo(-9, 0).quadraticCurveTo(-9.5, -10, 0, -10).quadraticCurveTo(9.5, -10, 9, 0).quadraticCurveTo(4, -5, 0, -5).quadraticCurveTo(-4, -5, -9, 0).fill(hair).stroke(OUTLINE); }
    }
    if (L.hat === "Knit cap") { hr.moveTo(-9.4, -2).quadraticCurveTo(-9, -13, 0, -13).quadraticCurveTo(9, -13, 9.4, -2).closePath().fill(0x7b4b3a).stroke(OUTLINE); hr.roundRect(-9.8, -4, 19.6, 3.6, 1.6).fill(shade(0x7b4b3a, 0.15)).stroke(OUTLINE); hr.circle(0, -13.5, 2).fill(0xefe4c8); }
    if (L.hat === "Wide brim") { hr.ellipse(0, -6, 14, 3.4).fill(0xd8c38e).stroke(OUTLINE); hr.roundRect(-6.5, -13, 13, 7.5, 3).fill(0xd8c38e).stroke(OUTLINE); hr.rect(-6.5, -8, 13, 1.8).fill(L.coral === "Hat band" ? RED : 0x5a4a32); }
    if (L.hat === "Baker's cap") { hr.roundRect(-7.5, -18, 15, 12, 5).fill(0xf6f1e4).stroke(OUTLINE); hr.roundRect(-8.5, -8, 17, 3.2, 1.4).fill(0xebe3d0).stroke(OUTLINE); }
    if (L.hat === "Headscarf") { hr.moveTo(-10, 3).quadraticCurveTo(-11, -12, 0, -12).quadraticCurveTo(11, -12, 10, 3).quadraticCurveTo(8, -5, 0, -5).quadraticCurveTo(-8, -5, -10, 3).fill(RED).stroke(OUTLINE); for (let k = -6; k <= 6; k += 4) hr.circle(k, -8, 0.8).fill(0xefe4c8); }
    h.addChild(hr);
    // rain gear: an umbrella for some, a hood for the rest; a breath of mist in the cold
    this.hood.moveTo(-10.5, 4).quadraticCurveTo(-12, -13, 0, -13).quadraticCurveTo(12, -13, 10.5, 4).quadraticCurveTo(8, -6, 0, -6).quadraticCurveTo(-8, -6, -10.5, 4).fill(0x5f7f86).stroke(OUTLINE); this.hood.visible = false; h.addChild(this.hood);
    this.umbrella.moveTo(-17, 0).quadraticCurveTo(0, -17, 17, 0).quadraticCurveTo(12, -3, 8.5, 0).quadraticCurveTo(4, -3, 0, 0).quadraticCurveTo(-4, -3, -8.5, 0).quadraticCurveTo(-12, -3, -17, 0).fill(this.phase % 2 < 1 ? RED : 0x3f7f78).stroke(OUTLINE);
    this.umbrella.moveTo(0, 0).lineTo(0, 22).stroke({ width: 1.2, color: INK }); this.umbrella.position.set(-1, -th - 22); this.umbrella.visible = false; this.upper.addChild(this.umbrella);
    this.breath.visible = false; h.addChild(this.breath);
    const gloss = new Graphics(); gloss.ellipse(-3.5, -5.5, 2.4, 1.4).fill({ color: 0xffffff, alpha: 0.35 }); h.addChild(gloss);
    this.drawFace(); this.castShadow(0.7, 1, 0);
  }

  /** Brows, eyes and mouth from the mood: joy lifts the mouth, grief pulls it down and the brows up, anger knits them, surprise opens everything, tiredness half-closes the eyes. */
  private drawFace(): void {
    const { hunger, joy, grief, anger, surprise, tired } = this.moodNow; const asleep = this.pose === "sleep";
    const e = this.eyes; e.clear(); const gx = this.gaze * 0.7;
    if (asleep) { for (const x of [-3.1, 3.1]) e.moveTo(x - 1.4, 0).quadraticCurveTo(x, 1, x + 1.4, 0).stroke({ width: 0.8, color: INK }); }
    else { const ry = 1.25 * (tired > 0.3 ? 1 - tired * 0.5 : surprise > 0.3 ? 1 + surprise * 0.3 : 1); for (const x of [-3.1, 3.1]) { e.ellipse(x + gx, -0.3, 1.25, ry).fill(0x1f1d1b); e.circle(x + gx + 0.4, -0.7, 0.4).fill(0xffffff); } }
    const m = this.mouth; m.clear(); const curve = joy * 3.5 - grief * 3 - hunger * 2 - anger * 1.5;
    if (surprise > 0.3) m.ellipse(0, 4.4, 1.3 + surprise * 0.6, 1.5 + surprise).fill(0x5a3a2c);
    else if (this.pose === "talk" || this.pose === "argue") m.ellipse(0, 4.4, 1.5, 1).fill(0x5a3a2c);
    else m.moveTo(-1.8, 4).quadraticCurveTo(0, 4 + Math.max(-1.6, Math.min(2.2, curve * 0.5)) + 0.8, 1.8, 4).stroke({ width: 0.85, color: 0x5a3a2c, cap: "round" });
    const b = this.brows; b.clear(); const tilt = grief * 1.6 - hunger * 0.6 - anger * 2.2, lift = joy * 0.6 + surprise * 2 - tired * 0.5;
    if (Math.abs(tilt) > 0.2 || Math.abs(lift) > 0.3) b.moveTo(-5, -3.6 - lift + tilt * 0.6).lineTo(-1.8, -3.6 - lift - tilt * 0.6).moveTo(1.8, -3.6 - lift - tilt * 0.6).lineTo(5, -3.6 - lift + tilt * 0.6).stroke({ width: anger > 0.3 ? 1.3 : 0.9, color: INK, cap: "round" });
  }

  // ---- the rig's interface, the same the town gives every citizen

  seatAt(height: number | null): void { this.seatHeight = height; }
  /** actual displacement this frame, in rig units: steps follow the ground covered */
  travel(distance: number): void { this.travelDistance = Math.max(0, distance); }
  weather(g: { rain: boolean; cold: boolean }): void {
    if (g.rain === this.gear.rain && g.cold === this.gear.cold) return; this.gear = g;
    const brolly = g.rain && this.phase % 5 < 2 && this.look.carrying !== "Suitcase";
    this.umbrella.visible = brolly; this.hood.visible = g.rain && !brolly && this.look.hat === "None";
    this.scarf.visible = g.cold && (this.years >= 60 || this.phase % 7 < 3.5) && this.look.coral !== "Scarf"; this.breath.visible = g.cold;
  }
  /** the tool of the trade in the working hand, and how the work moves */
  trade(title: string | null): void {
    const t = (title ?? "").toLowerCase(); if (t === this.tradeName) return; this.tradeName = t; const g = this.tool; g.clear();
    this.apron.visible = /cook|bak|inn|help|smith|forge|keep|clerk/.test(t);
    const handle = (len: number) => g.roundRect(-1.4, -len + 3, 2.8, len, 1.4).fill(WOOD).stroke(OUTLINE);
    if (t === "angling") { this.workStyle = "angle"; g.moveTo(0, 2).quadraticCurveTo(14, -20, 30, -30).stroke({ width: 1.6, color: WOOD }); g.moveTo(30, -30).quadraticCurveTo(34, -8, 36, 22).stroke({ width: 0.6, color: 0xf2ece0, alpha: 0.8 }); g.ellipse(36, 23, 1.6, 2.2).fill(RED); }
    else if (/smith|forge|iron/.test(t)) { this.workStyle = "swing"; handle(16); g.roundRect(-5, -16, 10, 5, 1.5).fill(IRON).stroke(OUTLINE); }
    else if (/cook|bak/.test(t)) { this.workStyle = "knead"; g.roundRect(-7, 0, 14, 4, 2).fill(0xe3d3a2).stroke(OUTLINE); }
    else if (/fish|gutter|net/.test(t)) { this.workStyle = "haul"; g.moveTo(-3, 1).lineTo(-7, 12).lineTo(7, 12).lineTo(3, 1).closePath().fill({ color: 0x9fc2ad, alpha: 0.75 }).stroke(OUTLINE); }
    else if (/saw/.test(t)) { this.workStyle = "push"; g.moveTo(0, 2).lineTo(0, 20).stroke({ width: 3.4, color: 0xdcd9cf }); g.moveTo(0, 2).lineTo(0, 20).stroke({ width: 0.8, color: INK }); }
    else if (/field|pick|orchard/.test(t)) { this.workStyle = "swing"; handle(19); g.roundRect(-6, -20, 12, 3.2, 1.2).fill(IRON).stroke(OUTLINE); }
    else if (/wood|cutter|axe/.test(t)) { this.workStyle = "swing"; handle(18); g.moveTo(0, -19).lineTo(7, -22).lineTo(7, -13).lineTo(0, -15).closePath().fill(0xdcd9cf).stroke(OUTLINE); }
    else if (/quarry|stone/.test(t)) { this.workStyle = "swing"; handle(18); g.moveTo(-7, -18).lineTo(7, -18).lineTo(5, -15).lineTo(-5, -15).closePath().fill(IRON).stroke(OUTLINE); }
    else if (/inn|help|clerk|keep/.test(t)) { this.workStyle = "sweep"; handle(22); g.moveTo(-5, 3).lineTo(5, 3).lineTo(3.5, 9).lineTo(-3.5, 9).closePath().fill(0xe3d3a2).stroke(OUTLINE); }
    else if (/mill/.test(t)) { this.workStyle = "haul"; g.roundRect(-6, -1, 12, 13, 4).fill(0xf7f5ee).stroke(OUTLINE); }
    else if (/dock|harbo/.test(t)) { this.workStyle = "haul"; g.roundRect(-6, 0, 12, 10, 1.5).fill(WOOD).stroke(OUTLINE); }
    else { this.workStyle = "swing"; g.roundRect(-1.5, -4, 3, 13, 1.5).fill(0x8e6a4b).stroke(OUTLINE); g.roundRect(-5, -6, 10, 4.5, 1.5).fill(IRON); }
  }
  /** a thing in the working hand when it is not working: a loaf, a fish, a cup, planks on the shoulder, a lantern, a letter */
  hold(item: string | null): void {
    const it = (item ?? "").toLowerCase(); if (it === this.heldItem) return; this.heldItem = it; const g = this.held; g.clear();
    if (it === "fishing rod") { g.moveTo(0, 5).lineTo(3, -26).stroke({ width: 1.6, color: WOOD }); }
    else if (it === "hammer" || it === "axe") { g.roundRect(-1.2, -12, 2.4, 18, 1).fill(WOOD).stroke(OUTLINE); g.roundRect(-4.5, -15, it === "axe" ? 10 : 8, 5, 1).fill(IRON).stroke(OUTLINE); }
    else if (it === "basket") { g.roundRect(-5, 0, 10, 8, 2).fill(0xc79a5b).stroke(OUTLINE); g.moveTo(-4, 0).quadraticCurveTo(0, -7, 4, 0).stroke({ width: 1.1, color: 0x8a6437 }); }
    else if (/bread|loaf/.test(it)) g.ellipse(0, 3, 5.4, 3).fill(0xd9b26a).stroke(OUTLINE);
    else if (/fish/.test(it)) { g.ellipse(0, 3, 6, 2.3).fill(0x9fc2ad).stroke(OUTLINE); g.moveTo(5.5, 3).lineTo(8.5, 1).lineTo(8.5, 5).closePath().fill(0x9fc2ad).stroke(OUTLINE); }
    else if (/apple/.test(it)) g.circle(0, 3, 3).fill(RED).stroke(OUTLINE);
    else if (/soup|drink|wine|beer/.test(it)) g.roundRect(-3, -1, 6, 7, 1.5).fill(0xdcebe3).stroke(OUTLINE);
    else if (/plank|timber|wood/.test(it)) { g.roundRect(-2.4, -24, 4.8, 27, 1.5).fill(WOOD).stroke(OUTLINE); }
    else if (/lavender/.test(it)) { for (let i = -1; i <= 1; i++) { g.moveTo(i * 2, 4).lineTo(i * 3, -6).stroke({ width: 1.1, color: 0x6f9a6a }); g.ellipse(i * 3, -7, 1.6, 3).fill(0x9a8fc4); } }
    else if (/lantern|lamp/.test(it)) { g.roundRect(-3, 0, 6, 7.5, 1.5).fill(0xfff2c2).stroke(OUTLINE); g.moveTo(-2, 0).lineTo(0, -3).lineTo(2, 0).stroke(OUTLINE); }
    else if (/writing|letter|paper/.test(it)) g.roundRect(-3, 0, 7, 5, 1).fill(0xf7f5ee).stroke(OUTLINE);
    else if (/stone|rock|nail/.test(it)) g.roundRect(-3, 1, 6, 4.5, 1.5).fill(0xc8c4b8).stroke(OUTLINE);
    else if (/flour|grain|sack/.test(it)) g.roundRect(-4.5, -1, 9, 9, 3).fill(0xf7f5ee).stroke(OUTLINE);
    else if (/oil|bottle|jar/.test(it)) { g.roundRect(-2.4, -1, 4.8, 8, 1.5).fill(0x9a8fc4).stroke(OUTLINE); g.roundRect(-1.2, -3.5, 2.4, 2.5, 1).fill(INK); }
  }
  /** years on the figure: children small, the old stooped */
  age(years: number): void { if (years === this.years) return; this.years = years; const k = years < 16 ? 0.62 + (years / 16) * 0.3 : years >= 70 ? 0.95 : 1; this.body.scale.y = k; this.body.scale.x = Math.sign(this.body.scale.x || 1) * k; }
  mood(m: { hunger?: number; joy?: number; grief?: number; anger?: number; surprise?: number; tired?: number }): void {
    const next = { hunger: m.hunger ?? 0, joy: m.joy ?? 0, grief: m.grief ?? 0, anger: m.anger ?? 0, surprise: m.surprise ?? 0, tired: m.tired ?? 0 };
    const changed = (Object.keys(next) as (keyof typeof next)[]).some((k) => Math.abs(next[k] - this.moodNow[k]) > 0.05); if (!changed) return; this.moodNow = next; this.drawFace();
  }
  /** hard times show: a patched coat when broke, a dusty one sleeping rough */
  wear(s: { broke?: boolean; roof?: boolean; roofless?: boolean }): void { this.state = { broke: !!s.broke, roof: !!s.roof, roofless: !!s.roofless }; this.patch.visible = this.state.broke; this.torso.tint = this.state.roofless ? 0xd8d2c4 : 0xffffff; }
  lookAt(dx: number): void { const g = Math.max(-2.5, Math.min(2.5, dx / 40)); if (Math.abs(g - this.gaze) > 0.15) { this.gaze = g; this.drawFace(); } }
  glance(tilt: number, dx: number): void { this.glanceTilt = tilt; this.lookAt(dx); }
  facing4(f: Facing, _animate = false): void {
    if (f === this.facing) return; this.facing = f;
    const k = Math.abs(this.body.scale.x) || 1; this.body.scale.x = f === "left" ? -k : k;
    const back = f === "back"; this.faceParts.visible = !back; this.backHair.visible = back; this.faceParts.x = f === "front" || back ? 0 : 1.6;
  }
  setPose(p: Pose, _immediate = false): void { if (p === this.pose) return; const wasAsleep = this.pose === "sleep"; this.pose = p; if (wasAsleep || p === "sleep" || p === "talk" || p === "argue") this.drawFace(); }
  face(dir: -1 | 1, animate = false): void { this.facing4(dir < 0 ? "left" : "right", animate); }
  /** the shadow on the ground: long and away from the sun when it is low, a small pool under the base at noon */
  castShadow(elev: number, dir: number, low: number): void {
    const len = 10 + Math.pow(1 - Math.max(0, Math.min(1, elev)), 2) * 22; const g = this.shadow; g.clear();
    g.ellipse(dir * len * 0.45, 2, 12 + len * 0.45, 4.2).fill({ color: low > 0.05 ? 0x3a2c22 : 0x2a241d, alpha: 0.2 + low * 0.06 });
  }

  /** pose the figure for the moment `t`, in seconds */
  update(t: number): void {
    const dt = this.lastT === null ? 1 : Math.min(0.25, Math.max(0, t - this.lastT)); this.lastT = t;
    const p = this.pose; const T = this.target(p, t, dt);
    const k = 1 - Math.exp(-dt * 12); const n = this.now;
    for (const key of Object.keys(n) as (keyof Stance)[]) n[key] = lerp(n[key], T[key], key === "lift" || key === "legL" || key === "legR" || key === "armL" || key === "armR" ? Math.max(k, 0.6) : k);
    // seated or lying, the base is set aside: a figure sits on the bench itself, or lies on the ground
    this.base.visible = this.seatHeight === null && n.lying < 0.5 && p !== "sit"; this.shadow.visible = n.lying < 0.5;
    this.body.y = -n.lift + n.hip; this.base.y = this.base.visible ? -Math.max(0, n.lift) : 0;
    this.body.rotation = n.tilt - n.lying * 1.5; this.upper.rotation = n.lean;
    this.legL.rotation = n.legL; this.legR.rotation = n.legR; this.legL.scale.y = this.legR.scale.y = n.legY;
    this.armL.rotation = n.armL; this.armR.rotation = n.armR; this.head.rotation = n.head;
    this.upper.scale.y = p === "idle" || p === "talk" ? 1 + Math.sin(t * 1.6 + this.phase) * 0.015 : 1;
    const working = p === "work"; this.tool.visible = working; this.held.visible = !working && this.heldItem !== "";
    this.book.visible = p === "read" || p === "write";
    if (this.breath.visible) { const b = this.breath; b.clear(); const c = (t * 0.6 + this.phase) % 1; b.circle(9 + c * 6, 3 - c * 4, 1.5 + c * 2.5).fill({ color: 0xffffff, alpha: 0.45 * (1 - c) }); }
  }

  /** where the parts want to be for a pose at a moment */
  private target(p: Pose, t: number, dt: number): Stance {
    const S: Stance = { lift: 0, tilt: 0, lean: this.years >= 62 ? Math.min(0.22, (this.years - 60) * 0.012) : 0, legL: 0, legR: 0, legY: 1, armL: 0.08, armR: -0.08, head: Math.sin(t * 0.7 + this.phase * 3) * 0.04 - this.glanceTilt * 0.5, hip: 0, lying: 0 };
    const hipH = 15 * this.tall;
    if (p === "walk" || p === "run") {
      // steps follow the ground actually covered; a figure lifted and set down, leaning into each step
      const stride = p === "run" ? 9 : 7; if (this.travelDistance !== null) this.gait += this.travelDistance / stride; else this.gait += dt * (p === "run" ? 2.6 : 1.8);
      this.travelDistance = null; const g = this.gait * Math.PI;
      const hop = Math.abs(Math.sin(g)) * (p === "run" ? 4.5 : 3.2); const sw = Math.sin(g) * (p === "run" ? 0.7 : 0.45);
      return { ...S, lift: hop, tilt: Math.sin(g) * 0.07 + (p === "run" ? 0.12 : 0), lean: S.lean + (p === "run" ? 0.1 : 0), legL: sw, legR: -sw, armL: -sw * 0.8, armR: sw * 0.8, head: Math.sin(g * 2) * 0.03 };
    }
    if (p === "sleep") return { ...S, lying: 1, hip: 2, armL: 0.2, armR: -0.2, head: 0.15 };
    if (p === "sit" || this.seatHeight !== null) {
      // knees toward the viewer: the legs foreshorten, the hips come down onto the seat
      const seat = this.seatHeight ?? 4; const upper = p === "sit" || p === "idle" ? { ...S, armL: 0.35, armR: -0.35 } : this.standing(p, t, S);
      return { ...upper, lift: 0, tilt: 0, legL: 0, legR: 0, legY: 0.42, hip: hipH - seat };
    }
    return this.standing(p, t, S);
  }
  /** the upper body for a pose, standing; a seated figure keeps the same arms and head */
  private standing(p: Pose, t: number, S: Stance): Stance {
    const hipH = 15 * this.tall;
    switch (p) {
      case "talk": return { ...S, head: Math.sin(t * 5 + this.phase) * 0.09, armR: -0.55 + Math.sin(t * 4 + this.phase) * 0.28 };
      case "greet": return { ...S, armR: -2.6 + Math.sin(t * 9 + this.phase) * 0.35, head: 0.05 };
      case "argue": { const s = Math.sin(t * 7 + this.phase); return { ...S, tilt: s * 0.04, armL: 1.2 + s * 0.5, armR: -1.2 + s * 0.5, head: s * 0.08 }; }
      case "crouch": return { ...S, legY: 0.55, hip: hipH * 0.4, lean: 0.35, armR: -0.9 + Math.sin(t * 3) * 0.15, armL: 0.3, head: 0.2 };
      case "read": return { ...S, armL: -0.9, armR: -0.9, head: 0.22 };
      case "write": return { ...S, armL: -0.9, armR: -0.8 + Math.sin(t * 8) * 0.1, head: 0.25 };
      case "eat": case "drink": { const bite = Math.max(0, Math.sin(t * 1.8 + this.phase)); return { ...S, armR: -0.2 - bite * 2.2, head: -bite * 0.12 }; }
      case "work": {
        const w = this.workStyle; const c = Math.sin(t * (w === "swing" ? 5 : 3.5) + this.phase);
        if (w === "swing") return { ...S, armR: -2.2 + (c * 0.5 + 0.5) * 2.1, armL: 0.2, lean: S.lean + 0.08 + (c < 0 ? 0.08 : 0) };
        if (w === "knead") return { ...S, armL: -0.7 + c * 0.2, armR: -0.7 - c * 0.2, lean: S.lean + 0.1, head: 0.15 };
        if (w === "haul") return { ...S, armL: -0.3, armR: -0.4, tilt: c * 0.05, lift: Math.abs(c) * 0.8 };
        if (w === "push") return { ...S, armR: -1.1 + c * 0.4, armL: -0.9 + c * 0.4, lean: S.lean + 0.12 };
        if (w === "sweep") return { ...S, armR: -0.5 + c * 0.35, armL: -0.4 + c * 0.35, lean: S.lean + 0.1 };
        return { ...S, armR: -0.95 + Math.sin(t * 0.8) * 0.04, armL: 0.1 }; // angling: the rod held steady
      }
      default: return { ...S, armL: 0.08 + Math.sin(t * 1.6 + this.phase) * 0.02, armR: -0.08 - Math.sin(t * 1.6 + this.phase) * 0.02 };
    }
  }
}
