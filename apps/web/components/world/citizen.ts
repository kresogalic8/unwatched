import { Container, Graphics, GraphicsPath } from "pixi.js";
import { HARBOR_PERSON, CITIZEN_BODY } from "./person-art";

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
const HAIR_COLORS: Record<NonNullable<Look["hairColor"]>, number> = { Dark: HARBOR_PERSON.hairColor, Brown: 0x6b4a33, Fair: 0xd9b56a, Red: 0xb35a32, Grey: 0xb9c4bf };

import { KELP, CORAL, TEAL, SAGE, CREAM, SAND } from "./palette";
const PALETTE: Record<Look["top"], number> = { Teal: HARBOR_PERSON.coat, Sage: SAGE, Cream: CREAM, Sand: SAND, Kelp: HARBOR_PERSON.trousers };
const HAIR = 0x2b2f30, GREY = 0xb9c4bf, STRAW = 0xe3d3a2, LEATHER = 0x8e6a4b, WOOD_H = 0xc9b58f;
const SKINS = [0xf1d6c0, 0xe7c3a5, 0xd2a682, 0xb98460, 0x8f5f42, 0x6b4630];
const STROKE = { width: 0.55, color: 0x66705b, join: "round" as const, cap: "round" as const };

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

function harborPath(svg: string): GraphicsPath {
  const path = new GraphicsPath(svg);
  for (const instruction of path.instructions) {
    if (instruction.action === "quadraticCurveTo") instruction.data[4] = .99;
    if (instruction.action === "bezierCurveTo") instruction.data[6] = .99;
  }
  return path;
}
function tone(color: number, amount: number): number {
  const channel = (shift: number) => Math.max(0, Math.min(255, ((color >> shift) & 255) + amount));
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}
const rrect = (g: Graphics, x: number, y: number, w: number, h: number, r: number, fill: number) => g.roundRect(x, y, w, h, r).fill(fill);
const ellipse = (g: Graphics, x: number, y: number, rx: number, ry: number, fill: number) => g.ellipse(x, y, rx, ry).fill(fill);

export class Citizen extends Container {
  readonly look: Look;
  /** the shadow at the feet, and the one the sun throws; redrawn by the world as the sun moves */
  readonly shadow = new Graphics();
  private body = new Container();
  private legL = new Graphics(); private legR = new Graphics(); private shinL = new Graphics(); private shinR = new Graphics();
  private footL = new Graphics(); private footR = new Graphics();
  private armL = new Graphics(); private armR = new Graphics(); private foreL = new Graphics(); private foreR = new Graphics();
  private torso = new Graphics(); private head = new Container();
  private nose = new Graphics(); private eyes = new Graphics(); private brows = new Graphics(); private mouth = new Graphics(); private backHair = new Graphics();
  private facingMode: Facing = "right"; private moodState = { hunger: 0, joy: 0, grief: 0, anger: 0, surprise: 0, tired: 0 }; private gaze = 0; private talking = false;
  private thighH = 0; private shinH = 0; private upperH = 0; private foreH = 0; private headR = 11;
  private held = new Graphics(); private heldItem: string | null = null; private tradeName: string | null = null; private workStyle: "swing" | "push" | "haul" | "sweep" | "knead" | "angle" = "swing"; private years = 30;
  private carry = new Graphics(); private tool = new Graphics();
  private hood = new Graphics(); private umbrella = new Graphics(); private breath = new Graphics(); private coat = new Graphics(); private scarf = new Graphics(); private gear = { rain: false, cold: false };
  private patches = new Graphics(); private vest = new Graphics(); private bundle = new Graphics(); private strap = new Graphics(); private apron = new Graphics(); private beard = new Graphics(); private glasses = new Graphics(); private letter = new Graphics(); private cup = new Graphics(); private bowl = new Graphics(); private spoon = new Graphics(); private pen = new Graphics(); private state = { broke: false, roof: false, roofless: false };
  private facing = 1;
  private turn: { target: Facing; elapsed: number; via: Facing } | null = null;
  private pose: Pose = "idle";
  private seatHeight: number | null = null;
  /** Seat surface in rig-local coordinates; null keeps actions standing. */
  seatAt(height: number | null): void {
    if (height === this.seatHeight) return;
    if (this.lastUpdate !== null) this.transition = { elapsed: 0, from: this.poseTransforms(), duration: .45 };
    this.seatHeight = height;
  }
  private phase = Math.random() * 10;
  private travelDistance: number | null = null;
  private gaitPhase = 0;
  /** Actual displacement in rig pixels; previews without travel retain a timed gait. */
  travel(distance: number): void { this.travelDistance = Math.max(0, distance); }

  private lastUpdate: number | null = null;
  private transition: { elapsed: number; from: number[]; duration?: number } | null = null;
  private poseTransforms(): number[] {
    return [this.legL.rotation, this.legR.rotation, this.shinL.rotation, this.shinR.rotation,
      this.armL.rotation, this.armR.rotation, this.foreL.rotation, this.foreR.rotation,
      this.head.rotation, this.body.rotation, this.body.x, this.body.y, this.torso.scale.y];
  }
  private blendPose(dt: number): void {
    const transition = this.transition;
    if (!transition) return;
    transition.elapsed += dt;
    const progress = Math.min(1, transition.elapsed / (transition.duration ?? 0.24));
    const weight = progress * progress * (3 - 2 * progress);
    const value = this.poseTransforms().map((target, i) => transition.from[i]! + (target - transition.from[i]!) * weight);
    [this.legL.rotation, this.legR.rotation, this.shinL.rotation, this.shinR.rotation,
      this.armL.rotation, this.armR.rotation, this.foreL.rotation, this.foreR.rotation,
      this.head.rotation, this.body.rotation, this.body.x, this.body.y, this.torso.scale.y] = value as [number, number, number, number, number, number, number, number, number, number, number, number, number];
    if (progress === 1) this.transition = null;
  }
  private torsoW: number; private torsoH: number; private legH: number;

  constructor(look: Look, phase?: number) {
    super();
    this.addChild(this.shadow); this.castShadow(1, 1, 0);
    this.look = look;
    if (phase !== undefined) this.phase = phase;
    const wide = { Slight: 0.82, Average: 1, Sturdy: 1.22, Tall: 0.95 }[look.build];
    const tall = { Slight: 1, Average: 1, Sturdy: 1, Tall: 1.14 }[look.build];
    this.torsoW = 14 * wide * (look.shape === "Broad" ? 1.12 : 1); this.torsoH = CITIZEN_BODY.torsoHeight * tall; this.legH = CITIZEN_BODY.legHeight * tall;
    const skin = typeof look.skin === "number" ? (look.skin < SKINS.length ? SKINS[look.skin]! : look.skin) : SKINS[1]!;
    const top = PALETTE[look.top], bottom = PALETTE[look.bottom];

    // legs: a thigh that pivots at the hip and a shin that pivots at the knee, a foot at the end
    this.thighH = this.legH * 0.5; this.shinH = this.legH * 0.5;
    for (const [g, shin, side] of [[this.legL, this.shinL, -1], [this.legR, this.shinR, 1]] as const) {
      g.moveTo(0, 0).lineTo(0, this.thighH).stroke({ width: 5, color: bottom, cap: "round" });
      shin.moveTo(0, 0).lineTo(0, this.shinH).stroke({ width: 5, color: bottom, cap: "round" });
      g.moveTo(-1.5,2).lineTo(-1,this.thighH-1).stroke({width:.6,color:tone(bottom,-20),alpha:.6});
      shin.moveTo(1.3,1).lineTo(1,this.shinH-1).stroke({width:.65,color:tone(bottom,25),alpha:.6});
      const foot = side < 0 ? this.footL : this.footR;
      foot.moveTo(-3,1).lineTo(-3,-1).quadraticCurveTo(-1,-3,1,-1.5).lineTo(4,-1).quadraticCurveTo(5,-.5,5,1).closePath().fill(0x645747);
      foot.moveTo(-3,1).lineTo(5,1).stroke({width:1,color:0x403f37,cap:"round"});
      foot.moveTo(-.5,-1.4).lineTo(2,-.8).stroke({width:.45,color:0xb3a48b});
      foot.position.set(0,this.shinH); shin.addChild(foot);
      shin.position.set(0, this.thighH); g.addChild(shin);
      g.position.set(side * (this.torsoW * 0.28), -this.legH);
      this.body.addChild(g);
    }
    // torso above the hips; broad shoulders or a belly change the shape, a pattern the cloth
    const shoulder=-this.legH-this.torsoH;
    const neck=new Graphics();neck.roundRect(-2.5,shoulder-7,5,6,1).fill(skin);
    const shape=harborPath(CITIZEN_BODY.torso);
    this.torso.path(shape).fill(top).stroke({width:.7,color:0x596657});
    this.torso.moveTo(-7,-31).quadraticCurveTo(-4,-25,-5,-17).lineTo(-6,-14).lineTo(-7.5,-14).closePath().fill({color:tone(top,-28),alpha:.46});
    this.torso.moveTo(1,-34).quadraticCurveTo(6,-30,6,-23).lineTo(4,-17).quadraticCurveTo(6,-25,1,-34).fill({color:tone(top,35),alpha:.35});
    this.torso.moveTo(-6,-15).quadraticCurveTo(0,-12,7,-15).stroke({width:.55,color:tone(top,-25),alpha:.6});
    this.torso.moveTo(-3,-34).lineTo(0,-30).lineTo(3,-34).stroke({width:.8,color:tone(top,-30),join:"round"});
    this.torso.moveTo(0,-30).lineTo(0,-22).stroke({width:.55,color:tone(top,-25),alpha:.5});
    this.torso.circle(.7,-28, .45).circle(.7,-24.5,.45).fill(tone(top,50));
    this.torso.moveTo(2,-21).lineTo(6,-21).lineTo(5.5,-17.5).quadraticCurveTo(3,-16,2,-18).closePath().stroke({width:.5,color:tone(top,-20),alpha:.7});
    this.torso.scale.set(wide,this.torsoH/18);
    this.torso.y = -this.legH + 14*this.torsoH/18;
    if (look.shape === "Round") this.torso.ellipse(0, -22, 8.5, 7).fill(top).stroke(STROKE);
    if (look.pattern === "Stripes") for (let y = -28; y < -15; y += 5) this.torso.moveTo(-this.torsoW / 2 + 2, y).lineTo(this.torsoW / 2 - 2, y).stroke({ width: 1.4, color: KELP, alpha: 0.35 });
    if (look.pattern === "Checks") { for (let y = -28; y < -15; y += 6) this.torso.moveTo(-this.torsoW / 2 + 2, y).lineTo(this.torsoW / 2 - 2, y).stroke({ width: 0.9, color: KELP, alpha: 0.3 }); for (let x = -this.torsoW / 2 + 5; x < this.torsoW / 2 - 2; x += 6) this.torso.moveTo(x, -30).lineTo(x, -15).stroke({ width: 0.9, color: KELP, alpha: 0.3 }); }
    this.torso.moveTo(-5,-30).quadraticCurveTo(-4,-24,-6,-17).stroke({width:.65,color:CREAM,alpha:.12});
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
    this.apron.moveTo(-this.torsoW / 2 + 3, -this.legH - this.torsoH + 10).lineTo(this.torsoW / 2 - 3, -this.legH - this.torsoH + 10).lineTo(this.torsoW / 2 - 1, -this.legH + 1).lineTo(-this.torsoW / 2 + 1, -this.legH + 1).closePath().fill(0xf7f5ee).stroke(STROKE); this.apron.moveTo(-3, -this.legH - this.torsoH + 10).lineTo(-4, -this.legH - this.torsoH + 2).moveTo(3, -this.legH - this.torsoH + 10).lineTo(4, -this.legH - this.torsoH + 2).stroke({ width: 1.2, color: KELP }); this.apron.visible = false;
    if (look.coral === "Buttons") for (let i = 0; i < 3; i++) this.torso.circle(0, -29 + i * 5, 1.1).fill(CORAL);
    if (look.coral === "Scarf") this.torso.roundRect(-7, -35, 14, 4, 2).fill(CORAL).stroke(STROKE);
    // a winter coat over the torso and a wool scarf at the neck, worn in the cold: elders always, the rest by lot
    const wool = this.phase % 3 < 1 ? CORAL : this.phase % 3 < 2 ? 0xb9d9c6 : STRAW;
    this.coat.roundRect(-this.torsoW / 2 - 2, -this.legH - this.torsoH - 1, this.torsoW + 4, this.torsoH + 4, 5).fill(look.top === "Kelp" ? LEATHER : 0x5b6b66).stroke(STROKE);
    this.coat.moveTo(0, -this.legH - this.torsoH + 4).lineTo(0, -this.legH + 1).stroke({ width: .7, color: KELP, alpha: 0.5 });
    for (let i = 0; i < 3; i++) this.coat.circle(-3, -this.legH - this.torsoH + 5 + i * 5, 1).fill(wool);
    this.coat.visible = false; this.body.addChild(this.coat);
    this.scarf.roundRect(-this.torsoW / 2 - 1, -this.legH - this.torsoH - 4, this.torsoW + 2, 5, 2.5).fill(wool).stroke(STROKE);
    this.scarf.roundRect(this.torsoW / 2 - 6, -this.legH - this.torsoH - 1, 4, 10, 2).fill(wool).stroke(STROKE);
    this.scarf.visible = false; this.body.addChild(this.scarf);
    this.body.addChild(this.torso); this.body.setChildIndex(this.torso, this.body.getChildIndex(this.coat)); this.body.addChild(this.vest); this.body.addChild(this.apron); this.body.addChild(this.strap);
    // arms: an upper arm at the shoulder, a forearm at the elbow, a hand at the end
    this.upperH = this.torsoH * 0.66; this.foreH = this.torsoH * 0.28;
    for (const [g, fore, side] of [[this.armL, this.foreL, -1], [this.armR, this.foreR, 1]] as const) {
      g.moveTo(0,0).lineTo(0,this.upperH).stroke({color:top,width:5.3,cap:"round"});
      fore.moveTo(0,0).lineTo(0,this.foreH).stroke({color:top,width:4.8,cap:"round"});
      g.moveTo(-1.7,2).quadraticCurveTo(-2,this.upperH*.6,-1.4,this.upperH-1).stroke({color:tone(top,-25),width:.65,alpha:.55});
      fore.moveTo(-2,this.foreH-1).lineTo(2,this.foreH-1).stroke({color:tone(top,35),width:1.1});
      const handY=this.foreH;
      fore.moveTo(-1.35,handY).lineTo(1.2,handY).quadraticCurveTo(2,handY+1,1.4,handY+3)
        .quadraticCurveTo(.2,handY+4,-1.2,handY+2.8).lineTo(-1.6,handY+1.6)
        .quadraticCurveTo(-2.7,handY+1,-2,handY+.5).closePath().fill(skin).stroke({width:.3,color:tone(skin,-30),alpha:.65});
      fore.moveTo(-.4,handY+1.8).lineTo(-.3,handY+3).stroke({width:.3,color:tone(skin,-35),alpha:.55});
      fore.position.set(0, this.upperH); g.addChild(fore);
      g.position.set(side * (this.torsoW / 2 - 1), -this.legH - this.torsoH + 2);
      this.body.addChild(g);
    }
    // what they carry, in the front hand or on the hip
    this.drawCarry(look);
    (look.carrying === "Basket" ? this.foreL : this.foreR).addChild(this.carry);
    this.tool.roundRect(-2, -6, 4, 18, 2).fill(LEATHER).stroke(STROKE).roundRect(-7, -9, 14, 6, 2).fill(KELP);
    this.tool.position.set(0, this.foreH); this.tool.visible = false; this.foreR.addChild(this.tool);
    this.held.position.set(0, this.foreH); this.foreL.addChild(this.held);
    // head, hair, hat
    const headR = HARBOR_PERSON.headXRadius * (look.build === "Sturdy" ? 1.05 : 1); this.headR = headR;
    const face = new Graphics();
    face.moveTo(-5,-6).quadraticCurveTo(0,-10,5,-6,.99).quadraticCurveTo(7,-3,6,2,.99)
      .lineTo(4.5,6).quadraticCurveTo(2,8.5,-.5,7.5,.99).quadraticCurveTo(-5,6,-6,1,.99)
      .quadraticCurveTo(-7,-3,-5,-6,.99).closePath().fill(skin);
    face.moveTo(-5,-5).quadraticCurveTo(-3,0,-2,4).quadraticCurveTo(0,7,3,7)
      .quadraticCurveTo(-4,9,-6,1).closePath().fill({color:tone(skin,-28),alpha:.36});
    face.ellipse(3,1.5,2,2.6).fill({color:tone(skin,25),alpha:.28});
    face.ellipse(-5.4,.6,1.5,2.1).fill(skin).stroke({width:.4,color:tone(skin,-24)});
    face.moveTo(-5.6,-.2).quadraticCurveTo(-4.3,-.8,-4.8,1.3).stroke({width:.4,color:tone(skin,-38),alpha:.7});
    this.nose.moveTo(5,-1).quadraticCurveTo(5.7,1,7.8,2.5).quadraticCurveTo(7.1,3.6,5,3.2)
      .closePath().fill(tone(skin,8)).stroke({width:.4,color:tone(skin,-27)});
    this.head.addChild(face, this.nose);
    // a face that can look, blink, frown and smile
    this.eyes.circle(-4, -1, .9).fill(KELP).circle(4, -1, .9).fill(KELP); this.head.addChild(this.eyes);
    this.head.addChild(this.brows); this.head.addChild(this.mouth); this.drawFace();
    const hairCol = HAIR_COLORS[look.hairColor ?? (look.hair === "Grey" ? "Grey" : "Dark")];
    this.head.addChild(this.beard, this.glasses);
    // the back of the head: all hair, or hat; shown only when they walk away from you
    this.backHair.circle(0, 0, headR + 0.5).fill(hairCol).stroke(STROKE); this.backHair.visible = false; this.head.addChild(this.backHair);
    // a letter and a cup, for the minutes that call for them
    this.letter.roundRect(-6, -2, 12, 9, 1).fill(0xf7f5ee).stroke(STROKE); this.letter.moveTo(-4, 1).lineTo(4, 1).moveTo(-4, 3.5).lineTo(2, 3.5).stroke({ width: 0.8, color: KELP, alpha: 0.5 }); this.letter.position.set(0, this.foreH); this.letter.visible = false; this.foreR.addChild(this.letter);
    this.cup.roundRect(-3.5, -3, 7, 9, 2).fill(0xdcebe3).stroke(STROKE); this.cup.position.set(0, this.foreH); this.cup.visible = false; this.foreR.addChild(this.cup);
    this.bowl.ellipse(0, 1, 7, 3).fill(0xb78b55).stroke(STROKE);
    this.bowl.moveTo(-7,1).quadraticCurveTo(0,10,7,1).quadraticCurveTo(0,4,-7,1).fill(0xf7f5ee).stroke(STROKE);
    this.bowl.position.set(0, this.foreH); this.bowl.visible = false; this.foreL.addChild(this.bowl);
    this.spoon.moveTo(0,0).lineTo(-8,-6).stroke({width:1.2,color:WOOD_H,cap:"round"});
    this.spoon.ellipse(-10,-8,2.5,1.5).fill(0xdcd9cf).stroke({width:.5,color:KELP});
    this.spoon.position.set(0,this.foreH); this.spoon.visible=false; this.foreR.addChild(this.spoon);
    this.pen.moveTo(0,0).lineTo(-3,3).stroke({width:1,color:KELP,cap:"round"});
    this.pen.position.set(0,this.foreH); this.pen.visible=false; this.foreR.addChild(this.pen);
    this.foreL.addChild(this.letter); this.letter.position.set(0,this.foreH); this.letter.pivot.set(-6,5);
    this.head.addChild(this.drawHair(look, headR));
    this.head.addChild(this.drawHat(look, headR));
    this.head.position.set(0, CITIZEN_BODY.headY*tall);
    this.head.scale.set(CITIZEN_BODY.headScale);
    // weather gear: a hood in the coat's colour for the hatless, an umbrella for some, breath in the cold
    this.hood.moveTo(-headR - 2, 2).quadraticCurveTo(-headR - 2, -headR - 6, 0, -headR - 6).quadraticCurveTo(headR + 2, -headR - 6, headR + 2, 2).lineTo(headR - 3, 2).quadraticCurveTo(headR - 3, -headR + 2, 0, -headR + 2).quadraticCurveTo(-headR + 3, -headR + 2, -headR + 3, 2).closePath().fill(PALETTE[look.top]).stroke(STROKE); this.hood.visible = false; this.head.addChild(this.hood);
    this.umbrella.moveTo(-18, -headR - 8).quadraticCurveTo(0, -headR - 30, 18, -headR - 8).closePath().fill(this.phase % 2 < 1 ? CORAL : PALETTE.Teal).stroke(STROKE); for (const x of [-9, 0, 9]) this.umbrella.moveTo(x, -headR - 8).lineTo(x, -headR - 6).stroke({ width: 1.2, color: KELP }); this.umbrella.moveTo(2, -headR - 8).lineTo(2, 6).stroke({ width: 1.6, color: KELP }); this.umbrella.visible = false; this.head.addChild(this.umbrella);
    this.breath.visible = false; this.head.addChild(this.breath);
    this.body.addChild(neck);
    this.body.addChild(this.head);
    this.addChild(this.body);
    this.facing4("front");this.facing4("right");
  }

  /** Accessories follow the viewing direction and leave the eyes and cheeks open. */
  private drawAccessories(profile: boolean): void {
    const b = this.beard.clear(), g = this.glasses.clear();
    const color = HAIR_COLORS[this.look.hairColor ?? (this.look.hair === "Grey" ? "Grey" : "Dark")];
    const r = this.headR;
    if (this.look.beard === "Moustache") {
      b.moveTo(profile ? 1 : -3, 3.3).quadraticCurveTo(profile ? 3 : 0, 2.3, profile ? 5 : 3, 3.3).stroke({color,width:1.2,cap:"round"});
    } else if (this.look.beard && this.look.beard !== "None") {
      const tip = this.look.beard === "Full" ? 10 : 7;
      b.moveTo(-r+1,3).quadraticCurveTo(-r+2,tip,profile?2:0,tip)
        .quadraticCurveTo(r-1,tip-1,r-1,3).lineTo(r-2,5)
        .quadraticCurveTo(0,8,-r+2,4).closePath().fill(color);
    }
    if (this.look.glasses) {
      if (!profile) g.circle(-3,-1,2.3).stroke({color:0x77715e,width:.65});
      g.circle(3,-1,2.3).stroke({color:0x77715e,width:.65});
      g.moveTo(profile?-5:-.7,-1.5).lineTo(.7,-1.5).stroke({color:0x77715e,width:.6});
    }
  }

  private drawHair(look: Look, r: number): Graphics {
    const g = new Graphics(); const col = HAIR_COLORS[look.hairColor ?? (look.hair === "Grey" ? "Grey" : "Dark")];
    if (look.hat === "Headscarf" || look.hair === "Under a hat") return g;
    switch (look.hair) {
      case "Short dark": case "Grey": g.path(harborPath(HARBOR_PERSON.hair)).fill(col); break;
      case "Bob": g.moveTo(-6,5).quadraticCurveTo(-12,-10,0,-11).quadraticCurveTo(10,-10,7,6).lineTo(5.5,7).lineTo(5.5,-5).lineTo(-3,-4).lineTo(-3,5).closePath().fill(col);break;
      case "Curls": for (let i = 0; i < 7; i++) { const a = Math.PI + (i / 6) * Math.PI; g.ellipse(Math.cos(a) * r*.85, Math.sin(a) * r - 1, 3.3,3.8).fill(col).stroke(STROKE); } break;
      case "Bun": g.moveTo(-r, -1).arc(0, 0, r, Math.PI, 0).lineTo(r, -1).quadraticCurveTo(0, -r * 0.55, -r, -1).closePath().fill(col).stroke(STROKE); g.circle(-r * 0.55, -r * 0.7, 4.5).fill(col).stroke(STROKE); break;
    }
    if (look.hair === "Short dark" || look.hair === "Grey" || look.hair === "Bob") {
      for (let i=0;i<4;i++) g.moveTo(-5+i*2,-7).quadraticCurveTo(-3+i*2,-10,1+i,-7+i*.7,.99).stroke({width:.45,color:tone(col,32),alpha:.55});
      g.moveTo(-5,0).lineTo(-5,2.5).stroke({width:.5,color:tone(col,28),alpha:.5});
    }
    return g;
  }
  private drawHat(look: Look, r: number): Graphics {
    const g = new Graphics(); const band = look.coral === "Hat band";
    switch (look.hat) {
      case "None": break;
      case "Knit cap": g.moveTo(-r - 1, -6).arc(0, -5, r + 1, Math.PI, 0).closePath().fill(0x8e6a4b).stroke(STROKE); g.roundRect(-r - 1, -8, 2 * r + 2, 4, 2).fill(band ? CORAL : 0x7a5a3f).stroke(STROKE); break;
      case "Wide brim": g.ellipse(0,-7,11,3).fill(0xcdb681);g.moveTo(-6,-8).lineTo(-5,-15).quadraticCurveTo(1,-19,6,-14).lineTo(7,-8).closePath().fill(0xddc68d);g.moveTo(-6,-9).quadraticCurveTo(0,-7,7,-9).stroke({width:2,color:band?CORAL:0x8d7d5e});break;
      case "Baker's cap": g.roundRect(-r - 1, -8, 2 * r + 2, 4, 2).fill(0xf7f5ee).stroke(STROKE); g.ellipse(0, -9, r + 2, 7).fill(0xf7f5ee).stroke(STROKE); if (band) g.roundRect(-r - 1, -7, 2 * r + 2, 1.5, 1).fill(CORAL); break;
      case "Headscarf": g.moveTo(-r-2,6).quadraticCurveTo(-r-5,-12,0,-12).quadraticCurveTo(r+5,-12,r+2,5).lineTo(r-1,10).lineTo(r-3,5).lineTo(r-2,-4).quadraticCurveTo(0,-9,-r+2,-4).lineTo(-r+2,5).closePath().fill(band ? CORAL : 0xb9d9c6).stroke(STROKE); break;
    }
    return g;
  }
  private drawCarry(look: Look): void {
    const g = this.carry; const handY = this.foreH + 1; const coral = look.coral === "Suitcase" && look.carrying === "Suitcase";
    switch (look.carrying) {
      case "Nothing": break;
      case "Suitcase": g.roundRect(-9, handY + 2, 18, 13, 2).fill(coral ? CORAL : 0xc9b58f).stroke(STROKE); g.roundRect(-3, handY - 1, 6, 4, 1).fill(KELP); break;
      case "Tool bag": g.roundRect(-8, handY + 2, 16, 11, 4).fill(LEATHER).stroke(STROKE); g.roundRect(-2, handY - 2, 4, 5, 1).fill(KELP); break;
      case "Basket": g.moveTo(-8,handY).lineTo(7,handY).lineTo(5,handY+12).lineTo(-6,handY+12).closePath().fill(0xbe9f6e).stroke({width:.8,color:0x8d7855});g.moveTo(-5,handY).quadraticCurveTo(-3,handY-12,4,handY).stroke({width:1.8,color:0x8c7552});for(let n=0;n<3;n++)g.moveTo(-7,handY+3+n*3).lineTo(6,handY+3+n*3).stroke({width:.7,color:0x9e8258});break;
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
    else if (this.talking) this.mouth.ellipse(0, 4.5, 1.6, 1.1).fill(KELP);
    else if(Math.abs(curve)>.2) this.mouth.moveTo(-1, 4).quadraticCurveTo(1, 4 + curve*.5, 3, 4).stroke({ width: .65, color: KELP, cap: "round" });
    else this.mouth.moveTo(1,4.5).quadraticCurveTo(2.5,5,4,4.3).stroke({width:.45,color:0x89644f,alpha:.75});
    this.brows.clear(); const tilt = grief * 1.6 - hunger * 0.6 - anger * 2.2; const lift = joy * 0.8 - hunger * 0.8 + surprise * 2.2 - tired * 0.6;
    if (Math.abs(tilt) > 0.2 || Math.abs(lift) > 0.2 || grief > 0.2 || anger > 0.2) { this.brows.moveTo(-6, -4.5 - lift + tilt * 0.6).lineTo(-2, -4.5 - lift - tilt * 0.6).moveTo(2, -4.5 - lift - tilt * 0.6).lineTo(6, -4.5 - lift + tilt * 0.6).stroke({ width: anger > 0.3 ? 1.5 : 1.1, color: KELP, cap: "round" }); }
    this.eyes.scale.y = tired > 0.3 ? 1 - tired * 0.5 : surprise > 0.3 ? 1 + surprise * 0.3 : 1;
  }
  /** The tool of the trade, drawn in the working hand, and how the work moves: a swing, a push and pull, a haul, a sweep, a knead. */
  trade(title: string | null): void {
    const t = (title ?? "").toLowerCase(); if (t === this.tradeName) return; this.tradeName = t; const g = this.tool; g.clear(); this.apron.visible = /cook|bak|inn|help|smith|forge|keep|clerk/.test(t);
    const handle = (len: number, w = 3.5) => g.roundRect(-w / 2, -len + 4, w, len, w / 2).fill(WOOD_H).stroke(STROKE);
    if (t === "angling") { this.workStyle = "angle"; g.moveTo(0, 3).quadraticCurveTo(18, -24, 38, -36).stroke({width: 1.8, color: WOOD_H}); g.moveTo(38, -36).quadraticCurveTo(43, -8, 46, 36).stroke({width: .7, color: CREAM, alpha: .8}); g.ellipse(46, 37, 2, 3).fill(CORAL); }
    else if (/smith|forge|iron/.test(t)) { this.workStyle = "swing"; handle(22); g.roundRect(-7, -24, 14, 7, 2).fill(KELP).stroke(STROKE); }
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
    if (it === "fishing rod") {g.moveTo(0,8).lineTo(4,-35).stroke({width:2,color:WOOD_H});g.moveTo(4,-35).lineTo(9,6).stroke({width:.6,color:CREAM});}
    else if (it === "hammer" || it === "axe") {g.roundRect(-1.5,-16,3,24,1).fill(WOOD_H).stroke(STROKE);g.roundRect(-6,-20,it === "axe" ? 13 : 10,7,1).fill(KELP).stroke(STROKE);}
    else if (it === "basket") {g.roundRect(-7,0,14,12,3).fill(WOOD_H).stroke(STROKE);g.moveTo(-5,0).quadraticCurveTo(0,-10,5,0).stroke({width:1.5,color:WOOD_H});}
    else if (/bread|loaf/.test(it)) g.ellipse(0, 4, 7, 4).fill(0xd9b26a).stroke(STROKE);
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
  private lastSpeed = 0; private leanNow = 0;
  /** How this particular person walks: their build, their years and a little of themselves set the stride, the cadence, the roll and the bounce. */
  private gaitStyle(): { speed: number; amp: number; sway: number; lift: number } {
    let speed = 1.05, amp = 0.3, sway = 1, lift = 1;
    if (this.look.build === "Tall") { speed = 0.92; amp = 0.37; sway = 0.82; lift = 0.9; }        // long, calm strides
    else if (this.look.build === "Sturdy") { speed = 1.0; amp = 0.29; sway = 1.25; lift = 1.3; }  // a wider roll
    else if (this.look.build === "Slight") { speed = 1.2; amp = 0.26; sway = 1.08; lift = 0.88; } // quick and light
    if (this.years < 16) { speed *= 1.14; amp *= 0.88; lift *= 1.4; }                             // a child's bounce
    else if (this.years >= 65) { speed *= 0.82; amp *= 0.7; sway *= 0.68; lift *= 0.66; }         // an elder's shuffle
    const j = this.phase % 1, j2 = (this.phase * 1.7) % 1;                                        // a little of themselves, so two of a kind still differ
    speed *= 0.94 + j * 0.12; amp *= 0.9 + j2 * 0.18;
    const drag = Math.max(this.moodState.tired, this.moodState.hunger * 0.7);                     // tired or hungry, the step drags
    speed *= 1 - drag * 0.24; amp *= 1 - drag * 0.2; lift *= 1 - drag * 0.3;
    return { speed, amp, sway, lift };
  }
  /** What the day is doing to their face. */
  mood(m: { hunger?: number; joy?: number; grief?: number; anger?: number; surprise?: number; tired?: number }): void { const next = { hunger: m.hunger ?? 0, joy: m.joy ?? 0, grief: m.grief ?? 0, anger: m.anger ?? 0, surprise: m.surprise ?? 0, tired: m.tired ?? 0 }; const keys = Object.keys(next) as (keyof typeof next)[]; if (keys.every((k) => Math.abs(next[k] - this.moodState[k]) < 0.05)) return; this.moodState = next; this.drawFace(); }
  /** What has come of them, on the body: patches when broke, a waistcoat once they hold a roof of their own. */
  wear(s: { broke?: boolean; roof?: boolean; roofless?: boolean }): void { const next = { broke: !!s.broke, roof: !!s.roof, roofless: !!s.roofless }; if (next.broke === this.state.broke && next.roof === this.state.roof && next.roofless === this.state.roofless) return; this.state = next; this.patches.visible = next.broke; this.vest.visible = next.roof && !next.broke; this.bundle.visible = next.roofless; this.strap.visible = next.roofless; }
  /** Where they are looking, in local pixels to the side; the eyes follow a little. */
  lookAt(dx: number): void { this.gaze = Math.max(-2.5, Math.min(2.5, dx / 40)); }
  private glanceTilt = 0; private glanceGaze = 0; private eyeGaze = 0;
  /** A look that fades on its own: the head tips (up is negative) and the eyes go to dx, then both settle back. */
  glance(tilt: number, dx: number): void { this.glanceTilt = tilt; this.glanceGaze = Math.max(-2.5, Math.min(2.5, dx / 40)); }
  /** Which way they face: side on, toward you, or away. */
  facing4(f: Facing, animate = false): void {
    if (!animate || this.lastUpdate === null) { this.turn = null; this.applyFacing(f); return; }
    if (this.turn?.target === f) return;
    if (f === this.facingMode) { this.turn = null; return; }
    const side = this.facingMode === "left" || this.facingMode === "right";
    const opposite = side && (f === "left" || f === "right");
    this.turn = { target: f, elapsed: 0, via: opposite ? "front" : this.facingMode };
  }
  private applyFacing(f: Facing): void { if (f === this.facingMode) return; this.facingMode = f; this.facing = f === "left" ? -1 : 1; const back = f === "back"; this.eyes.visible = !back; this.mouth.visible = !back && this.pose !== "sleep"; this.brows.visible = !back; this.backHair.visible = back; this.carry.visible = !back && !["read", "write", "eat", "drink"].includes(this.pose); this.beard.visible=!back;this.glasses.visible=!back;
    const side=f==="left"||f==="right";this.nose.visible=side;this.drawAccessories(side);this.eyes.clear();
    if(side)this.eyes.circle(3,-1,.85).fill(0x4d4f43);else this.eyes.circle(-3,-1,.85).circle(3,-1,.85).fill(0x4d4f43);
    this.mouth.x=side?2:0;this.brows.x=side?1:0;
  }
  setPose(p: Pose, immediate = false): void { if (this.pose === p) return; this.transition = !immediate && this.lastUpdate !== null ? { elapsed: 0, from: this.poseTransforms(), duration: this.transition?.duration } : null; this.pose = p; this.mouth.visible = p !== "sleep" && this.facingMode !== "back"; this.tool.visible = p === "work" && this.look.carrying !== "Suitcase"; this.letter.visible = p === "read" || p === "write"; this.cup.visible = p === "drink"; this.bowl.visible = p === "eat"; this.spoon.visible = p === "eat"; this.pen.visible = p === "write"; this.held.visible = !["read","write","eat","drink"].includes(p); this.carry.visible = !(p === "read" || p === "write" || p === "eat" || p === "drink") && this.facingMode !== "back"; const talking = p === "talk" || p === "argue"; if (talking !== this.talking) { this.talking = talking; this.drawFace(); } }
  face(dir: -1 | 1, animate = false): void { this.facing4(dir < 0 ? "left" : "right", animate); }

  /** Optional contact layer, applied after update(). Target uses renderer coordinates. */
  reachFor(side: "left" | "right", target: { x: number; y: number }, weight = 1): void {
    const arm = side === "left" ? this.armL : this.armR;
    const fore = side === "left" ? this.foreL : this.foreR;
    const local = this.body.toLocal(target);
    const [shoulder, elbow] = this.reach(arm, local.x, local.y);
    const w = Math.max(0, Math.min(1, weight));
    arm.rotation += Math.atan2(Math.sin(shoulder-arm.rotation), Math.cos(shoulder-arm.rotation))*w;
    fore.rotation += Math.atan2(Math.sin(elbow-fore.rotation), Math.cos(elbow-fore.rotation))*w;
  }

  /** Wrist position for attaching a shared prop without a handoff teleport. */
  wrist(side: "left" | "right"): { x: number; y: number } {
    return (side === "left" ? this.foreL : this.foreR).toGlobal({ x: 0, y: this.foreH });
  }

  /** Solve a wrist target with the elbow bending naturally forward. */
  private reach(arm: Graphics, x: number, y: number): [number, number] {
    const dx=x-arm.x, dy=y-arm.y;
    const distance=Math.max(Math.abs(this.upperH-this.foreH)+.001,Math.min(this.upperH+this.foreH-.001,Math.hypot(dx,dy)));
    const elbow=-Math.acos(Math.max(-1,Math.min(1,(distance*distance-this.upperH*this.upperH-this.foreH*this.foreH)/(2*this.upperH*this.foreH))));
    return [Math.atan2(-dx,dy)-Math.atan2(this.foreH*Math.sin(elbow),this.upperH+this.foreH*Math.cos(elbow)),elbow];
  }

  /** Advance the animation. `t` is seconds. */
  /** The sun's shadow: a pool at the feet, and a cast that leans away from the sun and stretches as it sinks (elev 1 at noon, 0 at the horizon). */
  castShadow(elev: number, dir: number, low: number): void {
    const g = this.shadow; g.clear(); const L = 8 + Math.pow(1 - elev, 2) * 34; const color = low > 0.05 ? 0x4a3a2a : 0x14161a; const a = 0.14 + low * 0.06;
    g.moveTo(-7, 2).lineTo(7, 2).lineTo(7 + dir * L, 2 - L * 0.22).lineTo(-7 + dir * L, 2 - L * 0.22).closePath().fill({ color, alpha: a * 0.8 });
    g.ellipse(dir * L, 2 - L * 0.22, 7, 3).fill({ color, alpha: a * 0.8 });
    g.ellipse(0, 2, 11, 4.2).fill({ color, alpha: a });
  }
  update(t: number): void {
    const dt = this.lastUpdate === null ? 0 : Math.max(0, Math.min(0.1, t - this.lastUpdate));
    this.lastUpdate = t;
    // #2: weight in the step. The body leans into a quickening pace and settles back as it slows, from the change in real speed.
    const curSpeed = dt > 0 && this.travelDistance !== null ? this.travelDistance / dt : this.lastSpeed;
    const leanTarget = Math.max(-0.13, Math.min(0.15, (dt > 0 ? (curSpeed - this.lastSpeed) / dt : 0) * 0.00035));
    this.lastSpeed = curSpeed;
    this.leanNow += (leanTarget - this.leanNow) * (1 - Math.exp(-9 * Math.max(dt, 0.001)));
    let turning = 0;
    if (this.turn) {
      this.turn.elapsed += dt;
      const progress = Math.min(1, this.turn.elapsed / .32);
      turning = Math.sin(progress * Math.PI);
      if (progress >= .65) this.applyFacing(this.turn.target);
      else if (progress >= .2) this.applyFacing(this.turn.via);
      if (progress === 1) this.turn = null;
    }
    // Shoulder rotation and a small head lead make the intermediate view a pivot.
    this.torso.skew.x = turning * .07 * this.facing;
    const k = t * 2 * Math.PI + this.phase;
    const fatigue = Math.max(this.moodState.tired, this.moodState.hunger * .6);
    const gesture = (1 - fatigue * .45) * (1 + this.moodState.joy * .3 - this.moodState.grief * .25);
    const conversationBeat = k * (this.years >= 65 ? .85 : this.years < 16 ? 1.12 : 1);

    const k0 = this.years < 16 ? 0.62 + (this.years / 16) * 0.3 : this.years >= 70 ? 0.94 : 1; this.body.scale.set(this.facingMode === "left" ? -k0 : k0, k0); this.body.rotation = 0; this.body.position.set(0, 0); this.body.alpha = 1; this.torso.scale.y = this.torsoH / 18;
    let legL = 0, legR = 0, shinL = 0, shinR = 0, armL = 0, armR = 0, foreL = 0.15, foreR = 0.15, bob = 0, headTilt = 0;
    const gait = (speed: number, amp: number, sway = 1, lift = 1) => { const stride = 4 * this.legH * Math.sin(amp) * k0;
      if (this.travelDistance !== null) this.gaitPhase = (this.gaitPhase + this.travelDistance / stride * Math.PI * 2) % (Math.PI * 2);
      const phase = this.travelDistance === null ? k * speed : this.gaitPhase;
      const s = Math.sin(phase), c = Math.cos(phase); legL = s * amp; legR = -s * amp; shinL = Math.max(0, -c) * amp * 0.7; shinR = Math.max(0, c) * amp * 0.7; armL = 0.4 - s * amp * 0.2 * sway; armR = -0.33 + s * amp * 0.2 * sway; foreL = 0.15 + Math.max(0, -s) * 0.12; foreR = -0.95 - Math.max(0, s) * 0.12; bob = Math.abs(c) * -amp * 4 * lift; };
    switch (this.pose) {
      case "walk": { const g = this.gaitStyle(); gait(g.speed, g.amp, g.sway, g.lift); break; }
      case "run": { const g = this.gaitStyle(); gait(1.9 * Math.min(1.1, g.speed), 0.75 * (0.85 + g.amp), g.sway); this.body.rotation = 0.12 * this.facing; bob *= 1.4; break; }
      case "idle": {
        // small life between actions: a sway, and every few seconds a fidget: a shift of weight, a look around, a scratch of the head, a stretch
        bob = Math.sin(k * 0.35) * 0.25; armL = 0.35; armR = -0.3; foreR = -0.95;
        const slot = Math.floor((t + this.phase * 3) / 5); const which = ((slot * 2654435761) >>> 0) % 7; const into = ((t + this.phase * 3) % 5);
        if (into < 1.2) { const e = Math.sin((into / 1.2) * Math.PI) * (1-fatigue*.65); if (which === 1) this.body.position.x = e * 1.5 * this.facing; else if (which === 2) { armR = -2.6 * e; foreR = -1.2 * e; headTilt = -0.08 * e; } else if (which === 3) { armL = -2.9 * e; armR = 2.9 * e; foreL = 0.3 * e; foreR = -0.3 * e; bob -= e * 1.5; } else if (which === 4) { headTilt = 0.1 * e; } }
        break;
      }
      case "talk": {
        armR = -.9 + Math.sin(conversationBeat * 1.2) * .25 * gesture;
        foreR = -.9 + Math.sin(conversationBeat * 1.7) * .4 * gesture;
        armL = .1; headTilt = Math.sin(conversationBeat * .6) * .06 * gesture;
        bob = Math.sin(conversationBeat * .5) * .6 * gesture; break;
      }
      case "work": {
        const s = Math.sin(k * 1.4);
        switch (this.workStyle) {
          case "angle": armR = -.7; foreR = -1; armL = .15; foreL = -.5; bob = Math.sin(k * .3) * .35; break;
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
      case "eat": case "drink": { const up = Math.max(0, Math.sin(k * 0.7)); armR = -0.9 - up * 0.9; foreR = -1.2 - up * 1.1; armL = 0.4; foreL = -0.7; headTilt = up * 0.12; break; }
      // a hand up to someone they know
      case "greet": { armR = -2.7 + Math.sin(k * 2.2) * 0.25; foreR = -0.4 + Math.sin(k * 2.2) * 0.5; armL = 0.1; headTilt = -0.06; bob = Math.sin(k * 0.5) * 0.6; break; }
      // both hands out, the head forward, the weight on the front foot
      case "argue": { armR = -1.1 + Math.sin(k * 1.4) * 0.35; foreR = -1.4 + Math.sin(k * 1.4) * 0.3; armL = -0.9 + Math.cos(k * 1.4) * 0.3; foreL = -1.3; headTilt = -0.12; this.body.rotation = 0.1 * this.facing; legR = 0.35; legL = -0.25; shinL = 0.3; break; }
      // down on one knee to something small: a hand goes out and strokes, the head is bent to it
      case "crouch": { legL = -1.35; legR = -0.7; shinL = 2.1; shinR = 1.5; this.body.position.y = 10; armR = 1.05 + Math.sin(k * 0.9) * 0.12; foreR = 0.35 + Math.sin(k * 0.9) * 0.25; armL = 0.55; foreL = -0.35; headTilt = 0.34; this.body.rotation = 0.14 * this.facing; bob = Math.sin(k * 0.3) * 0.4; break; }
      case "sleep": { this.body.rotation = (Math.PI / 2) * this.facing; this.body.position.set(0, -6); legL = -0.15; legR = 0.1; shinL = 0.3; shinR = 0.2; armL = 0.3; armR = 0.35; foreL = 0.4; foreR = 0.3; this.body.alpha = 0.92; this.torso.scale.y = (this.torsoH / 18) * (1 + Math.sin(k * 0.25) * 0.02); break; }
    }
    const supported = this.seatHeight !== null && ["sit","idle","talk","read","write","eat","drink","greet"].includes(this.pose);
    if (supported) {
      legL = legR = -1.5; shinL = shinR = 1.5;
      this.body.y = this.seatHeight! + this.legH*k0; bob = 0;
    }
    if (this.pose === "drink") {
      const up = Math.max(0,Math.sin(k*.7));
      const dx = 6-this.armR.x, dy = this.head.y+6-this.armR.y;
      const distance = Math.min(this.upperH+this.foreH-.01,Math.hypot(dx,dy));
      const elbow = -Math.acos(Math.max(-1,Math.min(1,(distance*distance-this.upperH*this.upperH-this.foreH*this.foreH)/(2*this.upperH*this.foreH))));
      const shoulder = Math.atan2(-dx,dy)-Math.atan2(this.foreH*Math.sin(elbow),this.upperH+this.foreH*Math.cos(elbow));
      armR = -.65+(shoulder+.65)*up; foreR = -.8+(elbow+.8)*up;
      headTilt = 0;
    }
    if (this.pose === "read" || this.pose === "write") {
      const pageY=-this.legH-8;
      [armL,foreL]=this.reach(this.armL,0,pageY);
      const stroke=this.pose === "write" ? Math.sin(k*1.6)*1.5 : 0;
      [armR,foreR]=this.reach(this.armR,this.pose === "read" ? 12 : 8+stroke,this.pose === "read" ? pageY : pageY-6);
    }
    if (this.pose === "eat") {
      const bowlY=-this.legH-8;
      const lift=Math.max(0,Math.sin(k*.55));
      const ease=lift*lift*(3-2*lift);
      [armL,foreL]=this.reach(this.armL,2,bowlY);
      [armR,foreR]=this.reach(this.armR,12+4*ease,bowlY+8+(this.head.y+12.5-bowlY-8)*ease);
      headTilt=0;
    }
    if (this.pose === "work" && (this.workStyle === "knead" || this.workStyle === "haul")) {
      const handY=-this.legH-7+Math.sin(k*1.4)*1.2;
      [armR,foreR]=this.reach(this.armR,8,handY);
      [armL,foreL]=this.reach(this.armL,this.workStyle === "knead" ? -1 : 0,handY);
    }
    // age shows too: a stoop that the years put there
    if (this.stoop && this.pose !== "sleep") { this.body.rotation += this.stoop * this.facing; headTilt += this.stoop * 0.6; }
    // hunger shows in the whole body: a slump, a hanging head
    if (this.moodState.hunger > 0.4 && this.pose !== "sleep") { const w = (this.moodState.hunger - 0.4) / 0.6; this.body.rotation += 0.1 * w * this.facing; headTilt += 0.18 * w; if (this.pose === "walk") bob *= 0.5; }
    if(this.look.carrying==="Basket" && (this.pose==="walk"||this.pose==="idle")){armL=.32;foreL=-.12;}
    // #2: the acceleration lean, on the move
    if (this.pose === "walk" || this.pose === "run") this.body.rotation += this.leanNow * this.facing;
    // #3: bank into a turn taken at pace — lean toward the side being turned to
    if (turning > 0.01 && this.turn && (this.pose === "walk" || this.pose === "run")) { const sign = this.turn.target === "left" ? -1 : this.turn.target === "right" ? 1 : 0; this.body.rotation += turning * 0.07 * sign; }
    // #4: a heavy load in the hands makes a braced, labored walk — the body counters back, the head drops, the free arm steadies, the bounce goes out of it
    if ((this.pose === "walk" || this.pose === "idle") && /plank|timber|wood|stone|flour|grain|sack|barrel|crate/.test(this.heldItem ?? "")) { this.body.rotation -= 0.08 * this.facing; headTilt += 0.07; armL = Math.min(armL, -0.15); bob *= 0.55; }
    this.legL.rotation = legL; this.legR.rotation = legR; this.shinL.rotation = shinL; this.shinR.rotation = shinR;
    this.armL.rotation = armL; this.armR.rotation = armR; this.foreL.rotation = foreL; this.foreR.rotation = foreR;
    if (this.glanceTilt) { headTilt += this.glanceTilt; this.glanceTilt *= Math.exp(-.97 * dt); if (Math.abs(this.glanceTilt) < 0.004) this.glanceTilt = 0; }
    headTilt -= turning * .055;
    this.head.rotation = headTilt; this.body.position.y += bob;
    this.blendPose(dt);
    if (this.pose === "drink") this.cup.rotation = -this.armR.rotation-this.foreR.rotation-this.body.rotation*this.facing;
    // Keep supported objects in the body's plane while wrists articulate around them.
    const leftLevel=-this.armL.rotation-this.foreL.rotation;
    const rightLevel=-this.armR.rotation-this.foreR.rotation;
    this.letter.rotation=leftLevel;
    this.bowl.rotation=leftLevel;
    this.spoon.rotation=rightLevel;
    this.pen.rotation=rightLevel;
    this.tool.rotation=this.pose === "work" && (this.workStyle === "knead" || this.workStyle === "haul" || this.workStyle === "angle") ? rightLevel : 0;
    // Ankle articulation keeps shoes flat while the knee bends. During a walk,
    // the lowest sole stays on the ground instead of both feet floating above it.
    const planted = ["idle", "walk", "talk", "work", "greet", "argue"].includes(this.pose);
    this.footL.rotation = planted ? -this.legL.rotation-this.shinL.rotation-this.body.rotation*this.facing : 0;
    this.footR.rotation = planted ? -this.legR.rotation-this.shinR.rotation-this.body.rotation*this.facing : 0;
    if (this.pose === "walk" && !this.transition) {
      const soleY = (leg: Graphics, shin: Graphics) => {
        const x = leg.x-this.thighH*Math.sin(leg.rotation)-this.shinH*Math.sin(leg.rotation+shin.rotation);
        const y = leg.y+this.thighH*Math.cos(leg.rotation)+this.shinH*Math.cos(leg.rotation+shin.rotation);
        return x*this.facing*Math.sin(this.body.rotation)+y*Math.cos(this.body.rotation);
      };
      this.body.y = -(Math.max(soleY(this.legL,this.shinL),soleY(this.legR,this.shinR))+1.5)*k0;
    }
    if (this.travelDistance !== null) this.travelDistance = 0;
    // eyes: they follow a little where the person looks, and blink
    const side = this.facingMode === "left" || this.facingMode === "right" ? 1 : 0; const targetGaze = this.glanceTilt ? this.glanceGaze : this.gaze;
    this.eyeGaze += (targetGaze-this.eyeGaze) * (1-Math.exp(-12*dt));
    this.eyes.position.x = side + this.eyeGaze; const blink = ((t * 0.9 + this.phase) % 4.3) < 0.13; this.eyes.scale.y = this.pose === "sleep" ? 0.12 : blink ? 0.15 : this.moodState.tired > 0.3 ? 1 - this.moodState.tired * 0.5 : this.moodState.surprise > 0.3 ? 1 + this.moodState.surprise * 0.3 : 1;
    if (this.talking) this.mouth.scale.y = 0.6 + Math.abs(Math.sin(k * 2.4)) * 0.6;
    if (this.breath.visible && this.pose !== "sleep") { const c = (t * 0.6 + this.phase) % 1; this.breath.clear(); if (c < 0.6) this.breath.circle(11 + c * 10, 1 - c * 6, 2 + c * 4).fill({ color: 0xe6eeee, alpha: 0.45 * (1 - c / 0.6) }); }
  }
}
