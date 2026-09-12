import { Container, Graphics } from "pixi.js";

/**
 * A citizen, drawn from parts. Rounded flat shapes with a thin kelp outline, the Tide style, built in code so that
 * every choice made at boarding is a real part and a real colour, every person looks different, and the rig can walk,
 * sit, sleep, talk and swing a hammer instead of bobbing a picture up and down.
 *
 * Proportions are in "units"; a citizen stands about 72 units tall. The origin is between the feet.
 */
export type Pose = "idle" | "walk" | "run" | "sleep" | "sit" | "talk" | "work" | "crouch" | "read" | "write" | "eat" | "drink" | "greet" | "argue";
export type Facing = "left" | "right" | "front" | "back";
export interface Look {
  build: "Slight" | "Average" | "Sturdy" | "Tall";
  hair: "Short dark" | "Bob" | "Curls" | "Bun" | "Grey" | "Under a hat";
  hat: "None" | "Knit cap" | "Wide brim" | "Baker's cap" | "Headscarf";
  carrying: "Nothing" | "Suitcase" | "Satchel" | "Basket" | "Tool bag";
  top: "Teal" | "Sage" | "Cream" | "Sand" | "Kelp";
  bottom: "Teal" | "Sage" | "Cream" | "Sand" | "Kelp";
  coral: "None" | "Suitcase" | "Scarf" | "Buttons" | "Hat band";
  skin?: number;
  /** the marks that tell twenty people apart at street zoom; each set from the name when not chosen */
  beard?: "None" | "Moustache" | "Short" | "Full";
  glasses?: boolean;
  hairColor?: "Dark" | "Brown" | "Fair" | "Red" | "Grey";
  pattern?: "Plain" | "Stripes" | "Checks";
  shape?: "Straight" | "Broad" | "Round";
}
const HAIR_COLORS: Record<NonNullable<Look["hairColor"]>, number> = { Dark: 0x2b2f30, Brown: 0x6b4a33, Fair: 0xd9b56a, Red: 0xb35a32, Grey: 0xb9c4bf };

import { KELP, CORAL, TEAL, SAGE, CREAM, SAND } from "./palette";
const PALETTE: Record<Look["top"], number> = { Teal: TEAL, Sage: SAGE, Cream: CREAM, Sand: SAND, Kelp: KELP };
const HAIR = 0x2b2f30, GREY = 0xb9c4bf, STRAW = 0xe3d3a2, LEATHER = 0x8e6a4b, WOOD_H = 0xc9b58f;
const SKINS = [0xf1d6c0, 0xe7c3a5, 0xd2a682, 0xb98460, 0x8f5f42, 0x6b4630];
const STROKE = { width: 1.6, color: KELP, join: "round" as const, cap: "round" as const };

function hash(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function pick<T>(arr: readonly T[], h: number, salt: number): T { return arr[(h >>> (salt % 24)) % arr.length]!; }

/** A look for someone who never chose one: house-funded citizens get a deterministic one from their name. */
/** The years grey the hair: past sixty, whatever they had. */
export function aged(look: Look, years: number): Look { return years >= 60 && look.hair !== "Under a hat" ? { ...look, hair: "Grey", hairColor: "Grey" } : look; }
export function lookFor(name: string, chosen: Partial<Look> | null | undefined): Look {
  const h = hash(name);
  const base: Look = {
    build: pick(["Slight", "Average", "Average", "Sturdy", "Tall"] as const, h, 1),
    hair: pick(["Short dark", "Bob", "Curls", "Bun", "Grey", "Short dark"] as const, h, 4),
    hat: pick(["None", "None", "None", "Knit cap", "Wide brim", "Headscarf"] as const, h, 7),
    carrying: pick(["Nothing", "Nothing", "Basket", "Satchel", "Tool bag", "Nothing"] as const, h, 10),
    top: pick(["Teal", "Sage", "Cream", "Sand", "Kelp"] as const, h, 13),
    bottom: pick(["Kelp", "Sage", "Sand", "Teal", "Cream"] as const, h, 16),
    coral: pick(["None", "None", "Scarf", "Buttons", "Hat band", "None"] as const, h, 19),
    skin: SKINS[(h >>> 3) % SKINS.length]!,
    beard: pick(["None", "None", "None", "Moustache", "Short", "Full", "None"] as const, h, 22),
    glasses: pick([false, false, false, false, true] as const, h, 2),
    hairColor: pick(["Dark", "Dark", "Brown", "Brown", "Fair", "Red", "Dark"] as const, h, 5),
    pattern: pick(["Plain", "Plain", "Plain", "Stripes", "Checks"] as const, h, 8),
    shape: pick(["Straight", "Straight", "Broad", "Round", "Straight"] as const, h, 11),
  };
  const c = chosen ?? {};
  const has = (k: keyof Look) => typeof c[k] === "string" && (c[k] as string).length > 0;
  return { ...base, ...(has("build") ? { build: c.build! } : {}), ...(has("hair") ? { hair: c.hair! } : {}), ...(has("hat") ? { hat: c.hat! } : {}), ...(has("carrying") ? { carrying: c.carrying! } : {}), ...(has("top") ? { top: c.top! } : {}), ...(has("bottom") ? { bottom: c.bottom! } : {}), ...(has("coral") ? { coral: c.coral! } : {}), ...(typeof c.skin === "number" ? { skin: c.skin } : {}), ...(has("beard") ? { beard: c.beard! } : {}), ...(typeof c.glasses === "boolean" ? { glasses: c.glasses } : {}), ...(has("hairColor") ? { hairColor: c.hairColor! } : {}), ...(has("pattern") ? { pattern: c.pattern! } : {}), ...(has("shape") ? { shape: c.shape! } : {}) };
}

const rrect = (g: Graphics, x: number, y: number, w: number, h: number, r: number, fill: number) => g.roundRect(x, y, w, h, r).fill(fill).stroke(STROKE);
const ellipse = (g: Graphics, x: number, y: number, rx: number, ry: number, fill: number) => g.ellipse(x, y, rx, ry).fill(fill).stroke(STROKE);

export class Citizen extends Container {
  readonly look: Look;
  /** the shadow at the feet, and the one the sun throws; redrawn by the world as the sun moves */
  readonly shadow = new Graphics();
  private body = new Container();
  private legL = new Graphics(); private legR = new Graphics(); private shinL = new Graphics(); private shinR = new Graphics();
  private armL = new Graphics(); private armR = new Graphics(); private foreL = new Graphics(); private foreR = new Graphics();
  private torso = new Graphics(); private head = new Container();
  private eyes = new Graphics(); private brows = new Graphics(); private mouth = new Graphics(); private backHair = new Graphics();
  private facingMode: Facing = "right"; private moodState = { hunger: 0, joy: 0, grief: 0, anger: 0, surprise: 0, tired: 0 }; private gaze = 0; private talking = false;
  private thighH = 0; private shinH = 0; private upperH = 0; private foreH = 0; private headR = 11;
  private held = new Graphics(); private heldItem: string | null = null; private tradeName: string | null = null; private workStyle: "swing" | "push" | "haul" | "sweep" | "knead" = "swing"; private years = 30;
  private carry = new Graphics(); private tool = new Graphics();
  private hood = new Graphics(); private umbrella = new Graphics(); private breath = new Graphics(); private coat = new Graphics(); private scarf = new Graphics(); private gear = { rain: false, cold: false };
  private patches = new Graphics(); private vest = new Graphics(); private bundle = new Graphics(); private strap = new Graphics(); private apron = new Graphics(); private beard = new Graphics(); private glasses = new Graphics(); private letter = new Graphics(); private cup = new Graphics(); private bowl = new Graphics(); private state = { broke: false, roof: false, roofless: false };
  private facing = 1;
  private pose: Pose = "idle";
  private phase = Math.random() * 10;
  private torsoW: number; private torsoH: number; private legH: number;

  constructor(look: Look) {
    super();
    this.addChild(this.shadow); this.castShadow(1, 1, 0);
    this.look = look;
    const wide = { Slight: 0.82, Average: 1, Sturdy: 1.22, Tall: 0.95 }[look.build];
    const tall = { Slight: 1, Average: 1, Sturdy: 1, Tall: 1.14 }[look.build];
    this.torsoW = 20 * wide * (look.shape === "Broad" ? 1.12 : 1); this.torsoH = 26 * tall; this.legH = 20 * tall;
    const skin = typeof look.skin === "number" ? (look.skin < SKINS.length ? SKINS[look.skin]! : look.skin) : SKINS[1]!;
    const top = PALETTE[look.top], bottom = PALETTE[look.bottom];

    // legs: a thigh that pivots at the hip and a shin that pivots at the knee, a foot at the end
    this.thighH = this.legH * 0.55; this.shinH = this.legH * 0.5;
    for (const [g, shin, side] of [[this.legL, this.shinL, -1], [this.legR, this.shinR, 1]] as const) {
      rrect(g, -4, 0, 8, this.thighH + 3, 4, bottom);
      rrect(shin, -3.5, 0, 7, this.shinH, 3.5, bottom);
      ellipse(shin, 1, this.shinH, 5.5, 3, KELP);
      shin.position.set(0, this.thighH); g.addChild(shin);
      g.position.set(side * (this.torsoW * 0.28), -this.legH);
      this.body.addChild(g);
    }
    // torso above the hips; broad shoulders or a belly change the shape, a pattern the cloth
    rrect(this.torso, -this.torsoW / 2, -this.legH - this.torsoH, this.torsoW, this.torsoH + 4, 8, top);
    if (look.shape === "Round") this.torso.ellipse(0, -this.legH - 9, this.torsoW / 2 + 2.5, 8).fill(top).stroke(STROKE);
    if (look.pattern === "Stripes") for (let y = -this.legH - this.torsoH + 5; y < -this.legH; y += 5) this.torso.moveTo(-this.torsoW / 2 + 2, y).lineTo(this.torsoW / 2 - 2, y).stroke({ width: 1.4, color: KELP, alpha: 0.35 });
    if (look.pattern === "Checks") { for (let y = -this.legH - this.torsoH + 4; y < -this.legH; y += 6) this.torso.moveTo(-this.torsoW / 2 + 2, y).lineTo(this.torsoW / 2 - 2, y).stroke({ width: 0.9, color: KELP, alpha: 0.3 }); for (let x = -this.torsoW / 2 + 5; x < this.torsoW / 2 - 2; x += 6) this.torso.moveTo(x, -this.legH - this.torsoH + 2).lineTo(x, -this.legH + 2).stroke({ width: 0.9, color: KELP, alpha: 0.3 }); }
    // what they have come to: patches when the coins are gone, a waistcoat once they own a roof, an apron for a trade with one
    this.patches.roundRect(-3, this.thighH - 6, 6, 5, 1).fill({ color: 0xffffff, alpha: 0.35 }).stroke({ width: 0.8, color: KELP, alpha: 0.6 }); this.patches.visible = false; this.legL.addChild(this.patches);
    this.vest.roundRect(-this.torsoW / 2 + 2, -this.legH - this.torsoH + 3, this.torsoW - 4, this.torsoH - 2, 5).fill(look.top === "Kelp" ? 0x8e6a4b : KELP).stroke(STROKE); this.vest.moveTo(0, -this.legH - this.torsoH + 6).lineTo(0, -this.legH).stroke({ width: 1, color: CREAM, alpha: 0.5 }); for (let i = 0; i < 3; i++) this.vest.circle(0, -this.legH - this.torsoH + 9 + i * 6, 1.3).fill(CREAM); this.vest.visible = false;
    // everything they have, rolled and slung: what a person carries when there is no room to leave it in
    const rollW = this.torsoW / 2 + 8, rollY = -this.legH - this.torsoH + 2;
    this.bundle.roundRect(-rollW, rollY - 5, rollW * 2, 11, 5).fill(0xcfc4a8).stroke(STROKE);
    this.bundle.moveTo(-rollW + 5, rollY - 4).lineTo(-rollW + 5, rollY + 5).moveTo(rollW - 5, rollY - 4).lineTo(rollW - 5, rollY + 5).stroke({ width: 1.1, color: WOOD_H });
    this.bundle.visible = false; this.body.addChild(this.bundle);
    this.strap.moveTo(-this.torsoW / 2 + 3, -this.legH - this.torsoH + 4).lineTo(this.torsoW / 2 - 3, -this.legH - this.torsoH + 15).stroke({ width: 2, color: WOOD_H });
    this.strap.visible = false;
    this.apron.moveTo(-this.torsoW / 2 + 3, -this.legH - this.torsoH + 10).lineTo(this.torsoW / 2 - 3, -this.legH - this.torsoH + 10).lineTo(this.torsoW / 2 - 1, -this.legH + 10).lineTo(-this.torsoW / 2 + 1, -this.legH + 10).closePath().fill(0xf7f5ee).stroke(STROKE); this.apron.moveTo(-3, -this.legH - this.torsoH + 10).lineTo(-4, -this.legH - this.torsoH + 2).moveTo(3, -this.legH - this.torsoH + 10).lineTo(4, -this.legH - this.torsoH + 2).stroke({ width: 1.2, color: KELP }); this.apron.visible = false;
    if (look.coral === "Buttons") for (let i = 0; i < 3; i++) this.torso.circle(0, -this.legH - this.torsoH + 7 + i * 7, 1.8).fill(CORAL);
    if (look.coral === "Scarf") this.torso.roundRect(-this.torsoW / 2 - 1, -this.legH - this.torsoH - 3, this.torsoW + 2, 7, 3).fill(CORAL).stroke(STROKE);
    // a winter coat over the torso and a wool scarf at the neck, worn in the cold: elders always, the rest by lot
    const wool = this.phase % 3 < 1 ? CORAL : this.phase % 3 < 2 ? 0xb9d9c6 : STRAW;
    this.coat.roundRect(-this.torsoW / 2 - 2, -this.legH - this.torsoH - 1, this.torsoW + 4, this.torsoH + 9, 9).fill(look.top === "Kelp" ? LEATHER : 0x5b6b66).stroke(STROKE);
    this.coat.moveTo(0, -this.legH - this.torsoH + 4).lineTo(0, -this.legH + 6).stroke({ width: 1.2, color: KELP, alpha: 0.5 });
    for (let i = 0; i < 3; i++) this.coat.circle(-3, -this.legH - this.torsoH + 8 + i * 7, 1.6).fill(wool);
    this.coat.visible = false; this.body.addChild(this.coat);
    this.scarf.roundRect(-this.torsoW / 2 - 1, -this.legH - this.torsoH - 4, this.torsoW + 2, 8, 4).fill(wool).stroke(STROKE);
    this.scarf.roundRect(this.torsoW / 2 - 8, -this.legH - this.torsoH - 2, 6, 14, 3).fill(wool).stroke(STROKE);
    this.scarf.visible = false; this.body.addChild(this.scarf);
    this.body.addChild(this.torso); this.body.setChildIndex(this.torso, this.body.getChildIndex(this.coat)); this.body.addChild(this.vest); this.body.addChild(this.apron); this.body.addChild(this.strap);
    // arms: an upper arm at the shoulder, a forearm at the elbow, a hand at the end
    this.upperH = this.torsoH * 0.44; this.foreH = this.torsoH * 0.4;
    for (const [g, fore, side] of [[this.armL, this.foreL, -1], [this.armR, this.foreR, 1]] as const) {
      rrect(g, -3.5, 0, 7, this.upperH + 2, 3.5, top);
      rrect(fore, -3, 0, 6, this.foreH, 3, top);
      ellipse(fore, 0, this.foreH + 1, 4, 4, skin);
      fore.position.set(0, this.upperH); g.addChild(fore);
      g.position.set(side * (this.torsoW / 2 + 1), -this.legH - this.torsoH + 5);
      this.body.addChild(g);
    }
    // what they carry, in the front hand or on the hip
    this.drawCarry(look);
    this.foreR.addChild(this.carry);
    this.tool.roundRect(-2, -6, 4, 18, 2).fill(LEATHER).stroke(STROKE).roundRect(-7, -9, 14, 6, 2).fill(KELP);
    this.tool.position.set(0, this.foreH); this.tool.visible = false; this.foreR.addChild(this.tool);
    this.held.position.set(0, this.foreH); this.foreL.addChild(this.held);
    // head, hair, hat
    const headR = 11 * (look.build === "Sturdy" ? 1.05 : 1); this.headR = headR;
    const face = new Graphics(); face.circle(0, 0, headR).fill(skin).stroke(STROKE);
    this.head.addChild(face);
    // a face that can look, blink, frown and smile
    this.eyes.circle(-4, -1, 1.4).fill(KELP).circle(4, -1, 1.4).fill(KELP); this.head.addChild(this.eyes);
    this.head.addChild(this.brows); this.head.addChild(this.mouth); this.drawFace();
    const hairCol = HAIR_COLORS[look.hairColor ?? (look.hair === "Grey" ? "Grey" : "Dark")];
    if (look.beard && look.beard !== "None") { const b = this.beard; if (look.beard === "Moustache") b.moveTo(-5, 2.5).quadraticCurveTo(0, 0.5, 5, 2.5).quadraticCurveTo(0, 3.5, -5, 2.5).closePath().fill(hairCol).stroke({ width: 0.8, color: KELP }); else if (look.beard === "Short") b.moveTo(-headR + 1, 1).quadraticCurveTo(0, headR + 5, headR - 1, 1).quadraticCurveTo(0, headR - 1, -headR + 1, 1).closePath().fill({ color: hairCol, alpha: 0.85 }).stroke({ width: 0.8, color: KELP, alpha: 0.7 }); else b.moveTo(-headR + 1, 0).quadraticCurveTo(-headR + 2, headR + 8, 0, headR + 10).quadraticCurveTo(headR - 2, headR + 8, headR - 1, 0).quadraticCurveTo(0, headR - 2, -headR + 1, 0).closePath().fill(hairCol).stroke(STROKE); if (look.beard !== "Moustache") b.moveTo(-3, 4).quadraticCurveTo(0, 3.2, 3, 4).stroke({ width: 1, color: KELP, alpha: 0.5 }); this.head.addChild(b); }
    if (look.glasses) { const g = this.glasses; g.circle(-4, -1, 3.6).stroke({ width: 1.1, color: KELP }); g.circle(4, -1, 3.6).stroke({ width: 1.1, color: KELP }); g.moveTo(-0.4, -1).lineTo(0.4, -1).stroke({ width: 1.1, color: KELP }); g.moveTo(7.6, -1.5).lineTo(headR, -3).stroke({ width: 1, color: KELP }); this.head.addChild(g); }
    // the back of the head: all hair, or hat; shown only when they walk away from you
    this.backHair.circle(0, 0, headR + 0.5).fill(hairCol).stroke(STROKE); this.backHair.visible = false; this.head.addChild(this.backHair);
    // a letter and a cup, for the minutes that call for them
    this.letter.roundRect(-6, -2, 12, 9, 1).fill(0xf7f5ee).stroke(STROKE); this.letter.moveTo(-4, 1).lineTo(4, 1).moveTo(-4, 3.5).lineTo(2, 3.5).stroke({ width: 0.8, color: KELP, alpha: 0.5 }); this.letter.position.set(0, this.foreH); this.letter.visible = false; this.foreR.addChild(this.letter);
    this.cup.roundRect(-3.5, -3, 7, 9, 2).fill(0xdcebe3).stroke(STROKE); this.cup.position.set(0, this.foreH); this.cup.visible = false; this.foreR.addChild(this.cup);
    this.bowl.ellipse(0, 3, 7, 3.5).fill(0xf7f5ee).stroke(STROKE); this.bowl.moveTo(-2, 1).lineTo(4, -6).stroke({ width: 1.6, color: WOOD_H, cap: "round" }); this.bowl.position.set(0, this.foreH); this.bowl.visible = false; this.foreR.addChild(this.bowl);
    this.head.addChild(this.drawHair(look, headR));
    this.head.addChild(this.drawHat(look, headR));
    this.head.position.set(0, -this.legH - this.torsoH - headR + 3);
    // weather gear: a hood in the coat's colour for the hatless, an umbrella for some, breath in the cold
    this.hood.moveTo(-headR - 2, 2).quadraticCurveTo(-headR - 2, -headR - 6, 0, -headR - 6).quadraticCurveTo(headR + 2, -headR - 6, headR + 2, 2).lineTo(headR - 3, 2).quadraticCurveTo(headR - 3, -headR + 2, 0, -headR + 2).quadraticCurveTo(-headR + 3, -headR + 2, -headR + 3, 2).closePath().fill(PALETTE[look.top]).stroke(STROKE); this.hood.visible = false; this.head.addChild(this.hood);
    this.umbrella.moveTo(-18, -headR - 8).quadraticCurveTo(0, -headR - 30, 18, -headR - 8).closePath().fill(this.phase % 2 < 1 ? CORAL : PALETTE.Teal).stroke(STROKE); for (const x of [-9, 0, 9]) this.umbrella.moveTo(x, -headR - 8).lineTo(x, -headR - 6).stroke({ width: 1.2, color: KELP }); this.umbrella.moveTo(2, -headR - 8).lineTo(2, 6).stroke({ width: 1.6, color: KELP }); this.umbrella.visible = false; this.head.addChild(this.umbrella);
    this.breath.visible = false; this.head.addChild(this.breath);
    this.body.addChild(this.head);
    this.addChild(this.body);
  }

  private drawHair(look: Look, r: number): Graphics {
    const g = new Graphics(); const col = HAIR_COLORS[look.hairColor ?? (look.hair === "Grey" ? "Grey" : "Dark")];
    if (look.hat === "Headscarf" || look.hair === "Under a hat") return g;
    switch (look.hair) {
      case "Short dark": case "Grey": g.moveTo(-r, -1).arc(0, 0, r, Math.PI, 0).lineTo(r, -1).quadraticCurveTo(0, -r * 0.55, -r, -1).closePath().fill(col).stroke(STROKE); break;
      case "Bob": g.moveTo(-r - 1, 6).lineTo(-r - 1, -2).arc(0, 0, r + 1, Math.PI, 0).lineTo(r + 1, 6).quadraticCurveTo(r, 8, r - 3, 8).lineTo(r - 3, -1).quadraticCurveTo(0, -r * 0.5, -r + 3, -1).lineTo(-r + 3, 8).quadraticCurveTo(-r, 8, -r - 1, 6).closePath().fill(col).stroke(STROKE); break;
      case "Curls": for (let i = 0; i < 7; i++) { const a = Math.PI + (i / 6) * Math.PI; g.circle(Math.cos(a) * r, Math.sin(a) * r - 1, 4.5).fill(col).stroke(STROKE); } break;
      case "Bun": g.moveTo(-r, -1).arc(0, 0, r, Math.PI, 0).lineTo(r, -1).quadraticCurveTo(0, -r * 0.55, -r, -1).closePath().fill(col).stroke(STROKE); g.circle(-r * 0.55, -r * 0.7, 4.5).fill(col).stroke(STROKE); break;
    }
    return g;
  }
  private drawHat(look: Look, r: number): Graphics {
    const g = new Graphics(); const band = look.coral === "Hat band";
    switch (look.hat) {
      case "None": break;
      case "Knit cap": g.moveTo(-r - 1, -2).arc(0, -1, r + 1, Math.PI, 0).closePath().fill(0x8e6a4b).stroke(STROKE); g.roundRect(-r - 1, -4, 2 * r + 2, 5, 2).fill(band ? CORAL : 0x7a5a3f).stroke(STROKE); break;
      case "Wide brim": g.ellipse(0, -3, r + 9, 4.5).fill(STRAW).stroke(STROKE); g.moveTo(-r + 2, -3).arc(0, -3, r - 2, Math.PI, 0).closePath().fill(STRAW).stroke(STROKE); if (band) g.roundRect(-r + 2, -6, 2 * r - 4, 3, 1).fill(CORAL); break;
      case "Baker's cap": g.roundRect(-r - 1, -6, 2 * r + 2, 6, 2).fill(0xf7f5ee).stroke(STROKE); g.ellipse(0, -9, r + 2, 7).fill(0xf7f5ee).stroke(STROKE); if (band) g.roundRect(-r - 1, -5, 2 * r + 2, 2.5, 1).fill(CORAL); break;
      case "Headscarf": g.moveTo(-r - 2, 4).arc(0, 0, r + 2, Math.PI, 0).lineTo(r + 2, 4).lineTo(r - 4, 9).lineTo(-r - 2, 4).closePath().fill(band ? CORAL : 0xb9d9c6).stroke(STROKE); break;
    }
    return g;
  }
  private drawCarry(look: Look): void {
    const g = this.carry; const handY = this.foreH + 1; const coral = look.coral === "Suitcase" && look.carrying === "Suitcase";
    switch (look.carrying) {
      case "Nothing": break;
      case "Suitcase": g.roundRect(-9, handY + 2, 18, 13, 2).fill(coral ? CORAL : 0xc9b58f).stroke(STROKE); g.roundRect(-3, handY - 1, 6, 4, 1).fill(KELP); break;
      case "Tool bag": g.roundRect(-8, handY + 2, 16, 11, 4).fill(LEATHER).stroke(STROKE); g.roundRect(-2, handY - 2, 4, 5, 1).fill(KELP); break;
      case "Basket": g.roundRect(-8, handY + 1, 16, 10, 5).fill(STRAW).stroke(STROKE); g.moveTo(-6, handY + 1).quadraticCurveTo(0, handY - 8, 6, handY + 1).stroke(STROKE); break;
      case "Satchel": g.moveTo(-2, -4).lineTo(6, handY - 2).stroke({ ...STROKE, width: 2.2 }); g.roundRect(0, handY - 4, 13, 10, 3).fill(LEATHER).stroke(STROKE); break;
    }
  }

  /** What the weather asks of a person: a hood or an umbrella in rain, visible breath in the cold. */
  weather(g: { rain: boolean; cold: boolean }): void { if (g.rain === this.gear.rain && g.cold === this.gear.cold) return; this.gear = g; const brolly = g.rain && this.phase % 5 < 2 && this.look.carrying !== "Suitcase"; this.umbrella.visible = brolly; this.hood.visible = g.rain && !brolly && this.look.hat === "None"; this.breath.visible = g.cold; this.wrapUp(); }
  /** Who wraps up against the cold: everyone past sixty, and about half of everyone else; children get the scarf. */
  private wrapUp(): void { const cold = this.gear.cold; const elder = this.years >= 60; this.coat.visible = cold && (elder || this.phase % 7 < 3.5) && this.years >= 12; this.scarf.visible = cold && (elder || this.years < 12 || this.phase % 7 >= 5); }
  /** Brows and mouth from the mood: hunger flattens, grief pulls the brows up and the mouth down, joy lifts. */
  private drawFace(): void {
    const { hunger, joy, grief, anger, surprise, tired } = this.moodState;
    const curve = joy * 3.5 - grief * 3 - hunger * 2 - anger * 1.5; // positive is a smile
    this.mouth.clear();
    if (surprise > 0.3) this.mouth.ellipse(0, 4.8, 1.8 + surprise, 2 + surprise * 1.4).fill(KELP);
    else if (this.talking) this.mouth.ellipse(0, 4.5, 2.2, 1.6).fill(KELP);
    else this.mouth.moveTo(-3, 4).quadraticCurveTo(0, 4 + curve, 3, 4).stroke({ width: 1.2, color: KELP, cap: "round" });
    this.brows.clear(); const tilt = grief * 1.6 - hunger * 0.6 - anger * 2.2; const lift = joy * 0.8 - hunger * 0.8 + surprise * 2.2 - tired * 0.6;
    if (Math.abs(tilt) > 0.2 || Math.abs(lift) > 0.2 || grief > 0.2 || anger > 0.2) { this.brows.moveTo(-6, -4.5 - lift + tilt * 0.6).lineTo(-2, -4.5 - lift - tilt * 0.6).moveTo(2, -4.5 - lift - tilt * 0.6).lineTo(6, -4.5 - lift + tilt * 0.6).stroke({ width: anger > 0.3 ? 1.5 : 1.1, color: KELP, cap: "round" }); }
    this.eyes.scale.y = tired > 0.3 ? 1 - tired * 0.5 : surprise > 0.3 ? 1 + surprise * 0.3 : 1;
  }
  /** The tool of the trade, drawn in the working hand, and how the work moves: a swing, a push and pull, a haul, a sweep, a knead. */
  trade(title: string | null): void {
    const t = (title ?? "").toLowerCase(); if (t === this.tradeName) return; this.tradeName = t; const g = this.tool; g.clear(); this.apron.visible = /cook|bak|inn|help|smith|forge|keep|clerk/.test(t);
    const handle = (len: number, w = 3.5) => g.roundRect(-w / 2, -len + 4, w, len, w / 2).fill(WOOD_H).stroke(STROKE);
    if (/smith|forge|iron/.test(t)) { this.workStyle = "swing"; handle(22); g.roundRect(-7, -24, 14, 7, 2).fill(KELP).stroke(STROKE); }
    else if (/cook|bak/.test(t)) { this.workStyle = "knead"; g.roundRect(-9, 0, 18, 5, 2.5).fill(0xe3d3a2).stroke(STROKE); g.roundRect(-11, 1, 3, 3, 1.5).fill(WOOD_H); g.roundRect(8, 1, 3, 3, 1.5).fill(WOOD_H); }
    else if (/fish|gutter|net/.test(t)) { this.workStyle = "haul"; g.moveTo(-4, 2).lineTo(-9, 16).lineTo(9, 16).lineTo(4, 2).closePath().fill({ color: 0x9fc2ad, alpha: 0.7 }).stroke(STROKE); for (let x = -6; x <= 6; x += 4) g.moveTo(x, 4).lineTo(x * 1.3, 16).stroke({ width: 0.8, color: KELP, alpha: 0.5 }); }
    else if (/saw/.test(t)) { this.workStyle = "push"; g.roundRect(-2, -2, 4, 8, 2).fill(WOOD_H).stroke(STROKE); g.moveTo(0, 6).lineTo(0, 26).stroke({ width: 4, color: 0xdcd9cf }); g.moveTo(0, 6).lineTo(0, 26).stroke({ width: 1, color: KELP }); for (let y = 8; y < 26; y += 3) g.moveTo(2, y).lineTo(3.5, y + 1.5).stroke({ width: 1, color: KELP }); }
    else if (/field|pick|orchard|hand at the field/.test(t)) { this.workStyle = "swing"; handle(26, 3); g.roundRect(-8, -28, 16, 4, 1.5).fill(KELP).stroke(STROKE); }
    else if (/wood|cutter|axe/.test(t)) { this.workStyle = "swing"; handle(24); g.moveTo(0, -26).lineTo(9, -30).lineTo(9, -18).lineTo(0, -21).closePath().fill(0xdcd9cf).stroke(STROKE); }
    else if (/quarry|stone/.test(t)) { this.workStyle = "swing"; handle(24); g.moveTo(-9, -25).lineTo(9, -25).lineTo(6, -21).lineTo(-6, -21).closePath().fill(KELP).stroke(STROKE); }
    else if (/inn|help|clerk|keep/.test(t)) { this.workStyle = "sweep"; handle(28, 3); g.moveTo(-6, 4).lineTo(6, 4).lineTo(4, 12).lineTo(-4, 12).closePath().fill(0xe3d3a2).stroke(STROKE); }
    else if (/mill/.test(t)) { this.workStyle = "haul"; g.roundRect(-8, -2, 16, 18, 5).fill(0xf7f5ee).stroke(STROKE); g.moveTo(-5, -1).lineTo(5, -1).stroke({ width: 2, color: KELP }); }
    else if (/dock|harbo/.test(t)) { this.workStyle = "haul"; g.roundRect(-8, 0, 16, 14, 2).fill(WOOD_H).stroke(STROKE); g.moveTo(-8, 5).lineTo(8, 5).stroke({ width: 1, color: KELP }); }
    else { this.workStyle = "swing"; g.roundRect(-2, -6, 4, 18, 2).fill(LEATHER).stroke(STROKE).roundRect(-7, -9, 14, 6, 2).fill(KELP); }
  }
  /** A thing in the free hand: a loaf, a fish, an apple, planks on the shoulder, a bundle of lavender, a lantern. Nothing drawn for what has no shape. */
  hold(item: string | null): void {
    const it = (item ?? "").toLowerCase(); if (it === this.heldItem) return; this.heldItem = it; const g = this.held; g.clear();
    if (/bread|loaf/.test(it)) g.ellipse(0, 4, 7, 4).fill(0xd9b26a).stroke(STROKE);
    else if (/fish/.test(it)) { g.ellipse(0, 4, 8, 3).fill(0x9fc2ad).stroke(STROKE); g.moveTo(7, 4).lineTo(11, 1).lineTo(11, 7).closePath().fill(0x9fc2ad).stroke(STROKE); }
    else if (/apple/.test(it)) g.circle(0, 4, 4).fill(CORAL).stroke(STROKE);
    else if (/soup|drink|wine|beer/.test(it)) { g.roundRect(-4, -2, 8, 10, 2).fill(0xdcebe3).stroke(STROKE); }
    else if (/plank|timber|wood/.test(it)) { g.roundRect(-3, -30, 6, 34, 2).fill(WOOD_H).stroke(STROKE); g.moveTo(-3, -18).lineTo(3, -18).stroke({ width: 1, color: KELP, alpha: 0.5 }); }
    else if (/lavender/.test(it)) { for (let i = -1; i <= 1; i++) { g.moveTo(i * 3, 6).lineTo(i * 4, -8).stroke({ width: 1.5, color: 0x6f9a6a }); g.ellipse(i * 4, -9, 2.2, 4).fill(0x9a8fc4).stroke({ width: 0.8, color: KELP }); } }
    else if (/lantern|lamp/.test(it)) { g.roundRect(-4, 0, 8, 10, 2).fill(0xfff2c2).stroke(STROKE); g.moveTo(-3, 0).lineTo(0, -4).lineTo(3, 0).stroke(STROKE); }
    else if (/writing|letter|paper/.test(it)) g.roundRect(-4, 0, 9, 7, 1).fill(0xf7f5ee).stroke(STROKE);
    else if (/stone|rock|nail/.test(it)) g.roundRect(-4, 1, 8, 6, 2).fill(0xc8c4b8).stroke(STROKE);
    else if (/flour|grain|sack/.test(it)) g.roundRect(-6, -2, 12, 12, 4).fill(0xf7f5ee).stroke(STROKE);
    else if (/oil|bottle|jar/.test(it)) { g.roundRect(-3, -2, 6, 10, 2).fill(0x9a8fc4).stroke(STROKE); g.roundRect(-1.5, -5, 3, 3, 1).fill(KELP); }
  }
  /** Years on the body: children drawn small, the old greyed and stooped. */
  age(years: number): void {
    if (years === this.years) return; this.years = years;
    const k = years < 16 ? 0.62 + (years / 16) * 0.3 : years >= 70 ? 0.94 : 1; this.body.scale.set(this.body.scale.x < 0 ? -k : k, k);
    this.stoop = years >= 62 ? Math.min(0.22, (years - 60) * 0.012) : 0; this.wrapUp();
  }
  private stoop = 0;
  /** What the day is doing to their face. */
  mood(m: { hunger?: number; joy?: number; grief?: number; anger?: number; surprise?: number; tired?: number }): void { const next = { hunger: m.hunger ?? 0, joy: m.joy ?? 0, grief: m.grief ?? 0, anger: m.anger ?? 0, surprise: m.surprise ?? 0, tired: m.tired ?? 0 }; const keys = Object.keys(next) as (keyof typeof next)[]; if (keys.every((k) => Math.abs(next[k] - this.moodState[k]) < 0.05)) return; this.moodState = next; this.drawFace(); }
  /** What has come of them, on the body: patches when broke, a waistcoat once they hold a roof of their own. */
  wear(s: { broke?: boolean; roof?: boolean; roofless?: boolean }): void { const next = { broke: !!s.broke, roof: !!s.roof, roofless: !!s.roofless }; if (next.broke === this.state.broke && next.roof === this.state.roof && next.roofless === this.state.roofless) return; this.state = next; this.patches.visible = next.broke; this.vest.visible = next.roof && !next.broke; this.bundle.visible = next.roofless; this.strap.visible = next.roofless; }
  /** Where they are looking, in local pixels to the side; the eyes follow a little. */
  lookAt(dx: number): void { this.gaze = Math.max(-2.5, Math.min(2.5, dx / 40)); }
  private glanceTilt = 0; private glanceGaze = 0;
  /** A look that fades on its own: the head tips (up is negative) and the eyes go to dx, then both settle back. */
  glance(tilt: number, dx: number): void { this.glanceTilt = tilt; this.glanceGaze = Math.max(-2.5, Math.min(2.5, dx / 40)); }
  /** Which way they face: side on, toward you, or away. */
  facing4(f: Facing): void { if (f === this.facingMode) return; this.facingMode = f; this.facing = f === "left" ? -1 : 1; const back = f === "back"; this.eyes.visible = !back; this.mouth.visible = !back; this.brows.visible = !back; this.backHair.visible = back; this.carry.visible = !back; }
  setPose(p: Pose): void { if (this.pose === p) return; this.pose = p; this.tool.visible = p === "work" && this.look.carrying !== "Suitcase"; this.letter.visible = p === "read" || p === "write"; this.cup.visible = p === "drink"; this.bowl.visible = p === "eat"; this.carry.visible = !(p === "read" || p === "write" || p === "eat" || p === "drink") && this.facingMode !== "back"; const talking = p === "talk" || p === "argue"; if (talking !== this.talking) { this.talking = talking; this.drawFace(); } }
  face(dir: -1 | 1): void { this.facing4(dir < 0 ? "left" : "right"); }

  /** Advance the animation. `t` is seconds. */
  /** The sun's shadow: a pool at the feet, and a cast that leans away from the sun and stretches as it sinks (elev 1 at noon, 0 at the horizon). */
  castShadow(elev: number, dir: number, low: number): void {
    const g = this.shadow; g.clear(); const L = 8 + Math.pow(1 - elev, 2) * 34; const color = low > 0.05 ? 0x4a3a2a : 0x14161a; const a = 0.14 + low * 0.06;
    g.moveTo(-7, 2).lineTo(7, 2).lineTo(7 + dir * L, 2 - L * 0.22).lineTo(-7 + dir * L, 2 - L * 0.22).closePath().fill({ color, alpha: a * 0.8 });
    g.ellipse(dir * L, 2 - L * 0.22, 7, 3).fill({ color, alpha: a * 0.8 });
    g.ellipse(0, 2, 11, 4.2).fill({ color, alpha: a });
  }
  update(t: number): void {
    const k = t * 2 * Math.PI + this.phase;
    const k0 = this.years < 16 ? 0.62 + (this.years / 16) * 0.3 : this.years >= 70 ? 0.94 : 1; this.body.scale.set(this.facingMode === "left" ? -k0 : k0, k0); this.body.rotation = 0; this.body.position.set(0, 0); this.body.alpha = 1; this.torso.scale.y = 1;
    let legL = 0, legR = 0, shinL = 0, shinR = 0, armL = 0, armR = 0, foreL = 0.15, foreR = 0.15, bob = 0, headTilt = 0;
    const gait = (speed: number, amp: number) => { const s = Math.sin(k * speed), c = Math.cos(k * speed); legL = s * amp; legR = -s * amp; shinL = Math.max(0, -c) * amp * 1.3; shinR = Math.max(0, c) * amp * 1.3; armL = -s * amp * 0.8; armR = s * amp * 0.8; foreL = 0.35 + Math.max(0, -s) * 0.5; foreR = 0.35 + Math.max(0, s) * 0.5; bob = Math.abs(c) * -amp * 4; };
    switch (this.pose) {
      case "walk": gait(1.6, 0.55); break;
      case "run": gait(2.6, 0.95); this.body.rotation = 0.12 * this.facing; bob *= 1.4; break;
      case "idle": {
        // small life between actions: a sway, and every few seconds a fidget: a shift of weight, a look around, a scratch of the head, a stretch
        bob = Math.sin(k * 0.35) * 0.8; armL = 0.06; armR = -0.06;
        const slot = Math.floor((t + this.phase * 3) / 5); const which = ((slot * 2654435761) >>> 0) % 7; const into = ((t + this.phase * 3) % 5);
        if (into < 1.2) { const e = Math.sin((into / 1.2) * Math.PI); if (which === 1) this.body.position.x = e * 1.5 * this.facing; else if (which === 2) { armR = -2.6 * e; foreR = -1.2 * e; headTilt = -0.08 * e; } else if (which === 3) { armL = -2.9 * e; armR = 2.9 * e; foreL = 0.3 * e; foreR = -0.3 * e; bob -= e * 1.5; } else if (which === 4) { headTilt = 0.1 * e; } }
        break;
      }
      case "talk": { armR = -0.9 + Math.sin(k * 1.2) * 0.25; foreR = -0.9 + Math.sin(k * 1.7) * 0.4; armL = 0.1; headTilt = Math.sin(k * 0.6) * 0.06; bob = Math.sin(k * 0.5) * 0.6; break; }
      case "work": {
        const s = Math.sin(k * 1.4);
        switch (this.workStyle) {
          case "swing": armR = -1.9 + Math.max(0, s) * 1.6; foreR = -0.6 + Math.max(0, s) * 0.6; armL = 0.15; foreL = 0.5; bob = Math.max(0, -s) * -1.5; break;
          case "push": armR = -1.2 + s * 0.5; foreR = -0.4 + s * 0.4; armL = -1.0 + s * 0.5; foreL = -0.3; bob = Math.abs(s) * -0.8; headTilt = 0.1; break;
          case "haul": armR = -0.8 + Math.max(0, -s) * 0.9; foreR = -1.1; armL = -0.8 + Math.max(0, -s) * 0.9; foreL = -1.1; bob = Math.max(0, -s) * -2; this.body.rotation = 0.06 * this.facing; break;
          case "sweep": armR = -0.5 + s * 0.35; foreR = -0.9; armL = 0.3 + s * 0.2; foreL = -0.5; this.body.position.x = s * 2 * this.facing; break;
          case "knead": armR = -1.3 + Math.max(0, s) * 0.5; foreR = -1.0 + Math.max(0, s) * 0.5; armL = -1.3 + Math.max(0, -s) * 0.5; foreL = -1.0 + Math.max(0, -s) * 0.5; bob = Math.abs(s) * -0.6; headTilt = 0.12; break;
        }
        break;
      }
      case "sit": { legL = -1.5; legR = -1.5; shinL = 1.45; shinR = 1.45; armL = 0.5; armR = 0.5; foreL = -0.6; foreR = -0.6; this.body.position.y = 8; bob = Math.sin(k * 0.3) * 0.5; break; }
      // a letter held up and read, the head bent to it; the same for writing, with the hand moving along the lines
      case "read": { armR = -0.5; foreR = -1.9; armL = 0.35; foreL = -0.2; headTilt = 0.3; bob = Math.sin(k * 0.3) * 0.4; break; }
      case "write": { armR = -0.2 + Math.sin(k * 1.6) * 0.08; foreR = -1.5 + Math.sin(k * 3.2) * 0.12; armL = 0.4; foreL = -0.8; headTilt = 0.34; break; }
      // at a table: sitting, the cup or the spoon goes up to the mouth and down again
      case "eat": case "drink": { legL = -1.5; legR = -1.5; shinL = 1.45; shinR = 1.45; this.body.position.y = 8; const up = Math.max(0, Math.sin(k * 0.7)); armR = -0.9 - up * 0.9; foreR = -1.2 - up * 1.1; armL = 0.4; foreL = -0.7; headTilt = up * 0.12; break; }
      // a hand up to someone they know
      case "greet": { armR = -2.7 + Math.sin(k * 2.2) * 0.25; foreR = -0.4 + Math.sin(k * 2.2) * 0.5; armL = 0.1; headTilt = -0.06; bob = Math.sin(k * 0.5) * 0.6; break; }
      // both hands out, the head forward, the weight on the front foot
      case "argue": { armR = -1.1 + Math.sin(k * 1.4) * 0.35; foreR = -1.4 + Math.sin(k * 1.4) * 0.3; armL = -0.9 + Math.cos(k * 1.4) * 0.3; foreL = -1.3; headTilt = -0.12; this.body.rotation = 0.1 * this.facing; legR = 0.35; legL = -0.25; shinL = 0.3; break; }
      // down on one knee to something small: a hand goes out and strokes, the head is bent to it
      case "crouch": { legL = -1.35; legR = -0.7; shinL = 2.1; shinR = 1.5; this.body.position.y = 10; armR = 1.05 + Math.sin(k * 0.9) * 0.12; foreR = 0.35 + Math.sin(k * 0.9) * 0.25; armL = 0.55; foreL = -0.35; headTilt = 0.34; this.body.rotation = 0.14 * this.facing; bob = Math.sin(k * 0.3) * 0.4; break; }
      case "sleep": { this.body.rotation = (Math.PI / 2) * this.facing; this.body.position.set(0, -6); legL = -0.15; legR = 0.1; shinL = 0.3; shinR = 0.2; armL = 0.3; armR = 0.35; foreL = 0.4; foreR = 0.3; this.body.alpha = 0.92; this.torso.scale.y = 1 + Math.sin(k * 0.25) * 0.02; break; }
    }
    // age shows too: a stoop that the years put there
    if (this.stoop && this.pose !== "sleep") { this.body.rotation += this.stoop * this.facing; headTilt += this.stoop * 0.6; }
    // hunger shows in the whole body: a slump, a hanging head
    if (this.moodState.hunger > 0.4 && this.pose !== "sleep") { const w = (this.moodState.hunger - 0.4) / 0.6; this.body.rotation += 0.1 * w * this.facing; headTilt += 0.18 * w; if (this.pose === "walk") bob *= 0.5; }
    this.legL.rotation = legL; this.legR.rotation = legR; this.shinL.rotation = shinL; this.shinR.rotation = shinR;
    this.armL.rotation = armL; this.armR.rotation = armR; this.foreL.rotation = foreL; this.foreR.rotation = foreR;
    if (this.glanceTilt) { headTilt += this.glanceTilt; this.glanceTilt *= 0.984; if (Math.abs(this.glanceTilt) < 0.004) this.glanceTilt = 0; }
    this.head.rotation = headTilt; this.body.position.y += bob;
    // eyes: they follow a little where the person looks, and blink
    const side = this.facingMode === "left" || this.facingMode === "right" ? 2.2 : 0; this.eyes.position.x = side + (this.glanceTilt ? this.glanceGaze : this.gaze); const blink = ((t * 0.9 + this.phase) % 4.3) < 0.13; this.eyes.scale.y = blink ? 0.15 : 1;
    if (this.talking) this.mouth.scale.y = 0.6 + Math.abs(Math.sin(k * 2.4)) * 0.6;
    if (this.breath.visible && this.pose !== "sleep") { const c = (t * 0.6 + this.phase) % 1; this.breath.clear(); if (c < 0.6) this.breath.circle(11 + c * 10, 1 - c * 6, 2 + c * 4).fill({ color: 0xe6eeee, alpha: 0.45 * (1 - c / 0.6) }); }
  }
}
