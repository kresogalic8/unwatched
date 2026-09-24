"use client";
import { useEffect, useRef } from "react";
import { Application, Container, Graphics } from "pixi.js";
import { lookFor, aged, type Look, type Pose } from "@/components/world/citizen";
import { Figurine, FIGURE_SCALE } from "@/components/world/figurine";

export type InteriorPerson = { id: string; name: string; asleep: boolean; job: string | null; appearance: Record<string, unknown> | null; age?: number; carrying?: string | null; pose?: "sleep" | "work" | "sit" | "idle" };

import { KELP as INK, CREAM, CORAL, LIGHT, SAND } from "@/components/world/palette";

/** The island's own stone, plaster and timber, the same as the houses outside (components/world/dalmatian.ts). */
const STONES = [0xd8cfbb, 0xcdc3ad, 0xddd5c3, 0xc6bca5, 0xd3c9b2, 0xe0d8c6], MORTAR = 0xa89e87, PLASTER = 0xece4d2, PLASTER_SHADE = 0xd9cfb9;
const BEAM = 0x6e5641, BEAM_DARK = 0x4f3d2e, PLANK = 0x8a6d51, TIMBER = 0xa0805e, SHUTTER = 0x4f7a5a, SHUTTER_DARK = 0x3d6147, SLAB = [0xcfc4ad, 0xc5b9a1, 0xd6ccb6], COTTO = [0xc98a66, 0xbf7d5a, 0xd29574];
const CLAY = 0xbb6443, COPPER = 0xb8703f, IRON = 0x3a3d3f, WINE = 0x6d2c33, OLIVE = 0x7d8a52, NET = 0x7a8872, SEA = 0x6f9c9a, SKY_DAY = 0xbfdde4, SKY_NIGHT = 0x1d2b40;

function rnd(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const seedOf = (s: string) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };

/** What a room is, from what the town calls the place: the konoba, the workshops, a home, the loggia, a shop, the harbour's store. */
export type Room = "konoba" | "home" | "inn" | "bakery" | "smithy" | "mill" | "fishhouse" | "loggia" | "shop" | "harbor" | "hall";
export function roomOf(kind: string, sprite: string): Room {
  if (sprite === "tavern" || kind === "tavern") return "konoba";
  if (sprite === "bakery" || sprite === "smithy" || sprite === "mill" || sprite === "fishhouse") return sprite;
  if (/chandlery|boatshed|harbor-office/.test(sprite) || kind === "harbor") return "harbor";
  if (kind === "civic" || /chapel|council/.test(sprite)) return "loggia";
  if (kind === "inn") return "inn";
  if (kind === "shop" || kind === "market") return "shop";
  if (kind === "home") return "home";
  return "hall";
}

/** The shell of the room: a back wall of dressed stone (plastered to the waist in homes), the beams over it, a floor of slabs or cotto, deep stone windows with the škure open, and the arched door. */
function shell(g: Graphics, room: Room, W: number, H: number, floorY: number, r: () => number) {
  const plastered = room === "home" || room === "inn" || room === "shop" || room === "loggia";
  // dressed stone courses, laid in rows of random lengths
  g.rect(0, 0, W, floorY).fill(MORTAR);
  for (let y = 14, row = 0; y < floorY; y += 17, row++) {
    let x = -(row % 2) * 18 - r() * 10;
    while (x < W) { const w = 26 + r() * 30; g.roundRect(x + 1, y + 1, w - 2, 15, 2).fill(STONES[Math.floor(r() * STONES.length)]!); g.moveTo(x + 3, y + 14).lineTo(x + w - 3, y + 14).stroke({ width: .6, color: MORTAR, alpha: .7 }); x += w; }
  }
  if (plastered) {
    // lime plaster over the stone, worn through here and there so the stone shows
    g.rect(0, 14, W, floorY - 60).fill(PLASTER);
    for (let i = 0; i < 5; i++) { const x = r() * (W - 60), y = 30 + r() * (floorY - 110), w = 24 + r() * 40, h = 12 + r() * 16; g.ellipse(x + w / 2, y + h / 2, w / 2, h / 2).fill(STONES[i % STONES.length]!); g.ellipse(x + w / 2, y + h / 2, w / 2, h / 2).stroke({ width: .6, color: PLASTER_SHADE }); }
    g.rect(0, floorY - 46, W, 2).fill(PLASTER_SHADE);
  }
  // the ceiling: planks, and the beams they rest on, end-on as they run into the back wall
  g.rect(0, 0, W, 14).fill(PLANK); for (let x = 0; x < W; x += 16) g.rect(x, 0, 1, 14).fill({ color: BEAM_DARK, alpha: .5 });
  for (let x = 10; x < W; x += 58) { g.rect(x, 0, 16, 20).fill(BEAM).stroke({ width: .6, color: BEAM_DARK }); g.rect(x + 2, 17, 12, 3).fill({ color: BEAM_DARK, alpha: .5 }); }
  // the floor
  const slabs = room === "home" || room === "inn" || room === "konoba" ? COTTO : SLAB;
  g.rect(0, floorY, W, H - floorY).fill(slabs[0]!);
  for (let y = floorY, row = 0; y < H; row++) {
    const h = 12 + row * 4; let x = -r() * 30;
    while (x < W) { const w = (room === "home" || room === "inn" || room === "konoba" ? 28 : 36 + r() * 30) + row * 6; g.rect(x + 1, y + 1, w - 2, h - 2).fill(slabs[Math.floor(r() * slabs.length)]!); x += w; }
    g.rect(0, y, W, 1).fill({ color: INK, alpha: .18 }); y += h;
  }
  g.rect(0, floorY - 1, W, 2).fill({ color: INK, alpha: .35 });
  // the side walls fall away into shadow
  g.poly([0, 0, 22, 14, 22, floorY, 0, H]).fill({ color: BEAM_DARK, alpha: .22 });
  g.poly([W, 0, W - 22, 14, W - 22, floorY, W, H]).fill({ color: BEAM_DARK, alpha: .22 });
}

/** Where the windows are, as fractions of the wall: none behind the hearth's hood or the forge's. */
const windowsOf = (room: Room) => room === "home" ? [0.76] : room === "smithy" ? [0.14] : [0.14, 0.76];

/** A window deep in the stone, the škure folded back, the sea or the night beyond. */
function window_(g: Graphics, x: number, y: number, night: boolean) {
  const w = 38, h = 46;
  g.rect(x - 6, y - 6, w + 12, h + 12).fill(STONES[2]!).stroke({ width: .7, color: MORTAR });
  g.rect(x - 8, y + h + 4, w + 16, 5).fill(STONES[5]!).stroke({ width: .6, color: MORTAR });
  g.rect(x, y, w, h).fill(night ? SKY_NIGHT : SKY_DAY);
  if (night) { g.circle(x + 28, y + 11, 4).fill(LIGHT.star); g.circle(x + 26, y + 10, 4).fill(SKY_NIGHT); for (const [sx, sy] of [[8, 8], [16, 20], [30, 26]] as const) g.circle(x + sx, y + sy, .8).fill(LIGHT.star); }
  g.rect(x, y + h * .62, w, h * .38).fill(night ? 0x223449 : SEA); g.rect(x, y + h * .62, w, 1).fill({ color: CREAM, alpha: night ? .2 : .6 });
  g.rect(x + w / 2 - 1, y, 2, h).fill(TIMBER); g.rect(x, y + h / 2 - 1, w, 2).fill(TIMBER); g.rect(x, y, w, h).stroke({ width: 2, color: TIMBER });
  // the shutters, open against the wall on either side
  for (const [sx, dir] of [[x - 22, -1], [x + w + 6, 1]] as const) {
    g.rect(sx, y - 2, 16, h + 4).fill(SHUTTER).stroke({ width: .7, color: SHUTTER_DARK });
    for (let i = 4; i < h; i += 5) g.moveTo(sx + 2, y + i).lineTo(sx + 14, y + i).stroke({ width: .7, color: SHUTTER_DARK });
    g.rect(dir < 0 ? sx + 14 : sx, y + 6, 2, 6).fill(IRON);
  }
}

/** The door: a round arch of voussoirs over a plank door with iron studs. */
function door(g: Graphics, cx: number, floorY: number) {
  const w = 46, h = 84, top = floorY - h;
  for (let i = 0; i <= 8; i++) { const a0 = Math.PI + (i / 9) * Math.PI, a1 = Math.PI + ((i + 1) / 9) * Math.PI; const R = w / 2 + 9, r0 = w / 2; g.poly([cx + Math.cos(a0) * r0, top + w / 2 + Math.sin(a0) * r0, cx + Math.cos(a0) * R, top + w / 2 + Math.sin(a0) * R, cx + Math.cos(a1) * R, top + w / 2 + Math.sin(a1) * R, cx + Math.cos(a1) * r0, top + w / 2 + Math.sin(a1) * r0]).fill(STONES[i % STONES.length]!).stroke({ width: .6, color: MORTAR }); }
  g.rect(cx - w / 2 - 9, top + w / 2, 9, h - w / 2).fill(STONES[3]!).stroke({ width: .6, color: MORTAR }); g.rect(cx + w / 2, top + w / 2, 9, h - w / 2).fill(STONES[1]!).stroke({ width: .6, color: MORTAR });
  g.moveTo(cx - w / 2, floorY).lineTo(cx - w / 2, top + w / 2).arc(cx, top + w / 2, w / 2, Math.PI, 0).lineTo(cx + w / 2, floorY).closePath().fill(TIMBER).stroke({ width: .8, color: BEAM_DARK });
  for (let x = cx - w / 2 + 9; x < cx + w / 2; x += 9) g.moveTo(x, top + 6 + Math.abs(cx - x) * .5).lineTo(x, floorY).stroke({ width: .7, color: BEAM, alpha: .7 });
  for (const y of [top + 34, floorY - 16]) for (let x = cx - w / 2 + 5; x < cx + w / 2; x += 9) g.circle(x, y, 1.1).fill(IRON);
  g.circle(cx + 14, floorY - 42, 2.2).stroke({ width: 1.2, color: IRON });
}

/** The furniture each room keeps, and the spots in it where a person sleeps, sits or works. */
function furnish(g: Graphics, room: Room, W: number, floorY: number, stock: Record<string, number>, r: () => number): { seats: [number, number][]; beds: [number, number][]; benches: [number, number][] } {
  const seats: [number, number][] = [], beds: [number, number][] = [], benches: [number, number][] = [];
  const ink = { width: .7, color: INK };
  const chair = (cx: number) => { g.moveTo(cx - 7, floorY - 1).lineTo(cx - 7, floorY - 34).moveTo(cx + 7, floorY - 1).lineTo(cx + 7, floorY - 16).moveTo(cx - 7, floorY - 16).lineTo(cx + 7, floorY - 16).moveTo(cx - 7, floorY - 26).lineTo(cx - 1, floorY - 26).stroke({ width: 2, color: TIMBER }); g.rect(cx - 8, floorY - 18, 16, 3).fill(0xc9a86a); };
  const table = (x: number, w = 76, jug = true) => {
    g.rect(x, floorY - 32, w, 6).fill(TIMBER).stroke(ink); g.rect(x + 5, floorY - 26, 5, 25).fill(BEAM); g.rect(x + w - 10, floorY - 26, 5, 25).fill(BEAM);
    if (jug) { g.roundRect(x + w * .3, floorY - 46, 10, 14, 4).fill(CREAM).stroke(ink); g.moveTo(x + w * .3 + 10, floorY - 43).quadraticCurveTo(x + w * .3 + 15, floorY - 40, x + w * .3 + 9, floorY - 36).stroke({ width: 1, color: INK }); g.rect(x + w * .62, floorY - 50, 5, 18).fill(WINE); g.rect(x + w * .62 + 1, floorY - 54, 3, 4).fill(WINE); g.ellipse(x + w * .8, floorY - 33, 7, 2).fill(CREAM); }
    for (const cx of [x - 11, x + w + 11]) chair(cx);
    seats.push([x - 11, floorY - 2], [x + w + 11, floorY - 2]);
  };
  const bench = (x: number, w = 84) => { g.rect(x, floorY - 36, w, 8).fill(TIMBER).stroke(ink); g.rect(x + 6, floorY - 28, 5, 27).fill(BEAM); g.rect(x + w - 11, floorY - 28, 5, 27).fill(BEAM); benches.push([x + w / 2, floorY - 2]); };
  const shelf = (x: number, y: number, w: number, goods: number[] = [OLIVE, CLAY, CREAM, WINE]) => { g.rect(x, y, w, 4).fill(TIMBER).stroke({ width: .5, color: BEAM_DARK }); g.poly([x + 4, y + 4, x + 10, y + 4, x + 4, y + 12]).fill(BEAM); g.poly([x + w - 4, y + 4, x + w - 10, y + 4, x + w - 4, y + 12]).fill(BEAM); for (let i = 0; i < Math.floor(w / 13); i++) { const c = goods[i % goods.length]!, tall = 9 + ((i * 7) % 5); if (i % 3 === 1) g.roundRect(x + 4 + i * 13, y - tall, 9, tall, 3).fill(c).stroke({ width: .5, color: INK }); else { g.rect(x + 5 + i * 13, y - tall, 7, tall).fill(c).stroke({ width: .5, color: INK }); g.rect(x + 7 + i * 13, y - tall - 3, 3, 3).fill(c); } } };
  const barrel = (x: number, y = floorY, s = 1) => { g.roundRect(x, y - 30 * s, 24 * s, 30 * s, 7 * s).fill(0x9b7650).stroke(ink); for (const k of [.2, .8]) g.rect(x, y - 30 * s * (1 - k) - 1, 24 * s, 2).fill(IRON); for (let i = 1; i < 4; i++) g.moveTo(x + i * 6 * s, y - 28 * s).lineTo(x + i * 6 * s, y - 2 * s).stroke({ width: .5, color: BEAM_DARK, alpha: .6 }); };
  const lyingBarrel = (x: number, y: number) => { g.ellipse(x, y, 16, 13).fill(0x9b7650).stroke(ink); g.ellipse(x, y, 9, 8).stroke({ width: .6, color: BEAM_DARK }); g.circle(x, y + 3, 1.6).fill(BEAM_DARK); };
  const amphora = (x: number) => { g.moveTo(x, floorY - 2).quadraticCurveTo(x - 12, floorY - 20, x - 5, floorY - 34).lineTo(x - 3, floorY - 42).lineTo(x + 3, floorY - 42).lineTo(x + 5, floorY - 34).quadraticCurveTo(x + 12, floorY - 20, x, floorY - 2).closePath().fill(CLAY).stroke(ink); g.moveTo(x - 3, floorY - 40).quadraticCurveTo(x - 10, floorY - 38, x - 6, floorY - 32).moveTo(x + 3, floorY - 40).quadraticCurveTo(x + 10, floorY - 38, x + 6, floorY - 32).stroke({ width: 1, color: INK }); };
  const strings = (x: number, n: number, color: number) => { for (let i = 0; i < n; i++) { const sx = x + i * 11; g.moveTo(sx, 20).lineTo(sx, 34 + (i % 2) * 8).stroke({ width: .6, color: BEAM_DARK }); for (let k = 0; k < 4; k++) g.ellipse(sx + (k % 2 ? 2 : -2), 30 + (i % 2) * 8 + k * 6, 3, 4).fill(color); } };
  const ham = (x: number) => { g.moveTo(x, 20).lineTo(x, 30).stroke({ width: .7, color: BEAM_DARK }); g.moveTo(x - 3, 30).quadraticCurveTo(x - 12, 52, x - 2, 62).quadraticCurveTo(x + 10, 56, x + 5, 30).closePath().fill(0x9d5a44).stroke(ink); g.moveTo(x - 2, 34).quadraticCurveTo(x - 7, 48, x - 1, 58).stroke({ width: 1.4, color: 0xe7d2b9, alpha: .7 }); };
  const bed = (x: number) => { g.rect(x, floorY - 24, 72, 20).fill(TIMBER).stroke(ink); g.rect(x - 2, floorY - 46, 8, 45).fill(BEAM).stroke(ink); g.rect(x, floorY - 32, 70, 10).fill(CREAM).stroke(ink); g.rect(x + 18, floorY - 33, 54, 16).fill(0x9c4a3c).stroke({ width: .6, color: INK }); for (let i = 22; i < 70; i += 8) g.moveTo(x + i, floorY - 33).lineTo(x + i, floorY - 17).stroke({ width: .6, color: CREAM, alpha: .6 }); g.roundRect(x + 4, floorY - 38, 16, 8, 3).fill(CREAM).stroke({ width: .5, color: INK }); beds.push([x + 36, floorY - 22]); };
  // the ognjište: a raised stone hearth under a plastered komin hood, a copper pot on its chain over the embers
  const hearth = (x: number, w = 92) => {
    g.poly([x - 8, floorY - 118, x + w + 8, floorY - 118, x + w, floorY - 70, x, floorY - 70]).fill(PLASTER).stroke(ink); g.rect(x + w * .35, 20, w * .3, floorY - 138).fill(PLASTER).stroke(ink); g.rect(x - 10, floorY - 122, w + 20, 5).fill(TIMBER).stroke(ink);
    g.poly([x + 4, floorY - 70, x + w - 4, floorY - 70, x + w - 12, floorY - 40, x + 12, floorY - 40]).fill({ color: IRON, alpha: .55 });
    g.rect(x, floorY - 26, w, 26).fill(STONES[1]!).stroke(ink); for (let i = 0; i < w; i += 23) g.rect(x + i, floorY - 26, 1, 26).fill(MORTAR);
    g.ellipse(x + w / 2, floorY - 29, 22, 4).fill(0x2b2f31); for (let i = 0; i < 5; i++) g.ellipse(x + w / 2 - 12 + i * 6, floorY - 30, 3, 2).fill(i % 2 ? CORAL : LIGHT.dusk);
    g.moveTo(x + w / 2, floorY - 70).lineTo(x + w / 2, floorY - 52).stroke({ width: 1, color: IRON }); g.moveTo(x + w / 2 - 12, floorY - 52).quadraticCurveTo(x + w / 2, floorY - 30, x + w / 2 + 12, floorY - 52).closePath().fill(COPPER).stroke(ink);
    benches.push([x + w / 2, floorY - 2]);
  };
  // the bread oven: a stone dome with its mouth glowing
  const oven = (x: number) => { g.moveTo(x, floorY).lineTo(x, floorY - 44).arc(x + 34, floorY - 44, 34, Math.PI, 0).lineTo(x + 68, floorY).closePath().fill(STONES[3]!).stroke(ink); g.moveTo(x + 18, floorY - 20).lineTo(x + 18, floorY - 36).arc(x + 34, floorY - 36, 16, Math.PI, 0).lineTo(x + 50, floorY - 20).closePath().fill(0x2b2f31); g.ellipse(x + 34, floorY - 24, 12, 4).fill(CORAL); g.ellipse(x + 34, floorY - 25, 7, 2).fill(LIGHT.lamp); g.rect(x - 4, floorY - 20, 76, 5).fill(STONES[5]!).stroke(ink); benches.push([x + 34, floorY - 2]); };
  const loaves = (x: number, n: number) => { for (let i = 0; i < n; i++) g.ellipse(x + i * 15, floorY - 40, 7, 4).fill(0xc9904f).stroke({ width: .5, color: BEAM_DARK }); };
  const forge = (x: number) => { g.rect(x, floorY - 40, 70, 40).fill(STONES[1]!).stroke(ink); g.ellipse(x + 35, floorY - 41, 26, 5).fill(0x2b2f31); for (let i = 0; i < 6; i++) g.ellipse(x + 17 + i * 7, floorY - 42, 3, 2).fill(i % 2 ? CORAL : LIGHT.lamp); g.poly([x - 6, floorY - 120, x + 76, floorY - 120, x + 60, floorY - 70, x + 10, floorY - 70]).fill(IRON).stroke(ink); g.rect(x + 25, 20, 20, floorY - 140).fill(IRON); benches.push([x + 35, floorY - 2]); };
  const anvil = (x: number) => { g.rect(x + 8, floorY - 22, 16, 22).fill(BEAM).stroke(ink); g.poly([x - 6, floorY - 34, x + 30, floorY - 34, x + 26, floorY - 26, x + 22, floorY - 22, x + 10, floorY - 22, x + 6, floorY - 26, x - 2, floorY - 28]).fill(IRON).stroke({ width: .6, color: INK }); };
  const tools = (x: number) => { g.rect(x, 50, 70, 4).fill(TIMBER); for (let i = 0; i < 5; i++) { g.moveTo(x + 8 + i * 13, 54).lineTo(x + 8 + i * 13, 84).stroke({ width: 1.5, color: IRON }); g.rect(x + 4 + i * 13, 82, 8, 5).fill(IRON); } };
  const net = (x: number, w: number) => { g.moveTo(x - 4, 60).lineTo(x + w + 4, 60).stroke({ width: 2, color: TIMBER }); for (let i = 0; i <= w; i += 8) g.moveTo(x + i, 60).quadraticCurveTo(x + i + 8, 90, x + i + (i % 16 ? 2 : -2), 118).stroke({ width: .7, color: NET, alpha: .75 }); for (let k = 0; k < 7; k++) g.moveTo(x, 66 + k * 8).quadraticCurveTo(x + w / 2, 76 + k * 7, x + w, 66 + k * 8).stroke({ width: .7, color: NET, alpha: .75 }); for (let i = 0; i < 4; i++) g.circle(x + 10 + i * (w - 20) / 3, 116, 3).fill(CORAL); };
  const counter = (x: number, w: number) => { g.rect(x, floorY - 38, w, 38).fill(0xb3a88f).stroke(ink); for (let i = 0; i < w; i += 28) g.rect(x + i, floorY - 38, 1, 38).fill(MORTAR); g.rect(x - 3, floorY - 42, w + 6, 5).fill(STONES[5]!).stroke(ink); benches.push([x + w / 2, floorY - 2]); };
  const fish = (x: number, n: number) => { for (let i = 0; i < n; i++) { g.ellipse(x + i * 17, floorY - 45, 7, 2.4).fill(0x91b6ac); g.moveTo(x + 6 + i * 17, floorY - 45).lineTo(x + 11 + i * 17, floorY - 48).lineTo(x + 11 + i * 17, floorY - 42).closePath().fill(0x91b6ac); } };
  const rope = (x: number) => { for (let k = 0; k < 4; k++) g.ellipse(x, floorY - 5 - k * 4, 18 - k * 2, 5).stroke({ width: 2, color: 0xc9a86a }); };
  const oars = (x: number) => { for (let i = 0; i < 3; i++) { g.moveTo(x + i * 10, floorY - 2).lineTo(x + 18 + i * 10, 40).stroke({ width: 2.2, color: TIMBER }); g.ellipse(x + 2 + i * 10, floorY - 14, 3.5, 11).fill(TIMBER).stroke({ width: .5, color: INK }); } };
  const anchor = (x: number, y: number) => { g.circle(x, y, 4).stroke({ width: 1.6, color: IRON }); g.moveTo(x, y + 4).lineTo(x, y + 32).moveTo(x - 9, y + 12).lineTo(x + 9, y + 12).stroke({ width: 2, color: IRON }); g.moveTo(x - 14, y + 24).quadraticCurveTo(x, y + 40, x + 14, y + 24).stroke({ width: 2, color: IRON }); };
  const crest = (x: number, y: number) => { g.rect(x - 22, y - 4, 44, 50).fill(STONES[5]!).stroke(ink); g.moveTo(x - 14, y + 2).lineTo(x + 14, y + 2).lineTo(x + 14, y + 22).quadraticCurveTo(x + 14, y + 36, x, y + 40).quadraticCurveTo(x - 14, y + 36, x - 14, y + 22).closePath().fill(CLAY).stroke(ink); g.moveTo(x - 14, y + 18).lineTo(x + 14, y + 18).stroke({ width: 2, color: CREAM }); };
  const icon = (x: number, y: number) => { g.roundRect(x - 13, y, 26, 34, 12).fill(0xc9a86a).stroke(ink); g.roundRect(x - 9, y + 4, 18, 26, 9).fill(0x46708f); g.circle(x, y + 12, 4).fill(0xe6c79b); };
  const lumin = (x: number) => { g.moveTo(x, 20).lineTo(x, 34).stroke({ width: .7, color: IRON }); g.moveTo(x - 7, 40).quadraticCurveTo(x, 34, x + 7, 40).quadraticCurveTo(x, 46, x - 7, 40).fill(COPPER).stroke({ width: .5, color: INK }); g.circle(x + 6, 38, 1.6).fill(LIGHT.lamp); };

  const W2 = W / 2;
  switch (room) {
    case "konoba": for (let i = 0; i < 3; i++) lyingBarrel(40 + i * 34, floorY - 13); for (let i = 0; i < 2; i++) lyingBarrel(57 + i * 34, floorY - 38); table(W - 170, 96); amphora(W - 40); ham(W2 + 60); ham(W2 + 78); strings(W2 - 80, 3, CLAY); shelf(W - 160, 112, 100, [WINE, OLIVE, WINE, CREAM]); break;
    case "home": hearth(24); table(W - 150, 70); strings(W - 40, 2, CREAM); shelf(W2 + 40, 60, 56, [CREAM, COPPER, CLAY]); amphora(W - 26); break;
    case "inn": bed(28); bed(W - 104); table(W2 + 44, 50, true); shelf(W2 - 40, 52, 80, [CREAM, CLAY, OLIVE]); break;
    case "bakery": oven(24); bench(W - 116, 90); loaves(W - 100, 5); shelf(W2 + 20, 60, 80, [0xc9904f, 0xd9a766, 0xc9904f]); strings(W2 - 30, 2, CREAM); break;
    case "smithy": forge(W - 110); anvil(W - 170); bench(24, 84); tools(130); barrel(W - 200, floorY, .8); break;
    case "mill": g.circle(W * .28, floorY - 50, 38).fill(STONES[3]!).stroke(ink); g.circle(W * .28, floorY - 50, 8).fill(IRON); for (let a = 0; a < 6; a++) g.moveTo(W * .28 + Math.cos(a) * 12, floorY - 50 + Math.sin(a) * 12).lineTo(W * .28 + Math.cos(a) * 34, floorY - 50 + Math.sin(a) * 34).stroke({ width: .7, color: MORTAR }); bench(W - 116, 90); for (let i = 0; i < 3; i++) g.roundRect(W - 110 + i * 26, floorY - 60, 22, 24, 6).fill(CREAM).stroke(ink); break;
    case "fishhouse": counter(40, 150); counter(W - 190, 150); fish(56, Math.min(7, stock.fish ?? 3)); net(W2 - 60, 120); barrel(W - 34, floorY, .8); break;
    case "loggia": crest(W2, 34); table(W2 + 70, 120, false); bench(26, 90); icon(W2 - 120, 60); break;
    case "shop": counter(W - 190, 150); shelf(24, 125, 160); shelf(24, 160, 160, [CLAY, CREAM, OLIVE]); shelf(W - 180, 115, 150, [OLIVE, OLIVE, WINE]); amphora(W - 20); strings(W2 + 50, 3, CLAY); break;
    case "harbor": table(30, 64, false); rope(W - 80); rope(W - 120); oars(W - 60); anchor(W2 + 60, 44); net(W2 - 110, 70); barrel(W2 + 80, floorY, .8); break;
    default: bench(24, 84); bench(W - 108, 84); shelf(W2 - 30, 56, 60); break;
  }
  lumin(room === "konoba" ? W2 - 20 : W2 + 120);
  return { seats, beds, benches };
}

const W = 480, H = 280;
/** One renderer for every interior, kept for the life of the page: destroying a second Pixi application next to the world's tears down what they share. */
let shared: Promise<Application> | null = null;
function interiorApp(): Promise<Application> {
  if (!shared) shared = (async () => { const app = new Application(); await app.init({ width: W, height: H, background: SAND, antialias: true, resolution: Math.min(2, window.devicePixelRatio || 1), autoDensity: true }); app.canvas.style.width = "100%"; app.canvas.style.height = "auto"; return app; })();
  return shared;
}

/** A cutaway of the building, with whoever is inside it right now in the pose the town reports. */
export function Interior({ kind, sprite, hour, people, stock }: { kind: string; sprite: string; hour: number; people: InteriorPerson[]; stock?: Record<string,number> }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let alive = true; let app: Application | null = null; let onTick: (() => void) | null = null; let stage: Container | null = null;
    (async () => {
      const el = host.current!;
      app = await interiorApp();
      if (!alive || !el) return;
      el.replaceChildren(app.canvas);
      stage = new Container(); app.stage.addChild(stage);
      const night = hour < 6 || hour >= 21; const floorY = H - 85;
      const kindOfRoom = roomOf(kind, sprite); const r = rnd(seedOf(kind + sprite));
      const room = new Graphics(); shell(room, kindOfRoom, W, H, floorY, r);
      for (const wx of windowsOf(kindOfRoom)) window_(room, W * wx, 34, night); door(room, W / 2, floorY);
      stage.addChild(room);
      const fur = new Graphics(); const spots = furnish(fur, kindOfRoom, W, floorY, stock ?? {}, r); stage.addChild(fur);
      // daylight falls through the windows onto the floor; at night the lamp does the work
      if (!night) { const sun = new Graphics(); for (const wx of windowsOf(kindOfRoom).map(x => x * W)) sun.poly([wx, 80, wx + 38, 80, wx + 90, H - 10, wx + 30, H - 10]).fill({ color: LIGHT.lamp, alpha: .08 }); stage.addChild(sun); }
      // at night the room is dark but for the lumin, the oil lamp hung from a beam
      if (night) { const lx = kindOfRoom === "konoba" ? W / 2 - 20 : W / 2 + 120; const dark = new Graphics(); dark.rect(0, 0, W, H).fill({ color: LIGHT.night, alpha: .32 }); for (let i = 7; i > 0; i--) dark.ellipse(lx, 60, 26 + i * 16, 22 + i * 14).fill({ color: LIGHT.lamp, alpha: .03 }); stage.addChild(dark); }
      // people, each at a spot that fits their pose
      const rigs: Figurine[] = []; let si = 0, bi = 0, wi = 0, xi = 0, pi = 0;
      for (const p of people.slice(0, 8)) {
        const pose: Pose = p.asleep || p.pose === "sleep" ? "sleep" : p.pose === "work" ? "work" : p.pose === "sit" ? "sit" : "idle";
        const c = new Figurine(aged(lookFor(p.name, p.appearance as Partial<Look> | null), p.age ?? 30)); c.age(p.age ?? 30); c.trade(p.job); c.hold(p.carrying ?? null); c.scale.set(1.15 * FIGURE_SCALE); c.setPose(pose);
        let at: [number, number] | undefined;
        if (pose === "sleep") at = spots.beds[bi++]; else if (pose === "work") at = spots.benches[wi++]; else if (pose === "sit") at = spots.seats[si++];
        if (pose === "sit" && at) c.seatAt(0); // the spot is the seat itself
        if (!at && pose === "sleep") {
          // no bed in this room: a straw pallet on the floor, a blanket over it, and the sleeper on that, not on the bare boards
          const px = 60 + (pi++ % 5) * 84, py = floorY + 34, pal = new Graphics();
          pal.roundRect(px - 34, py - 10, 68, 16, 6).fill(0xc9a86a).stroke({ width: 0.7, color: INK });
          for (let k = -26; k <= 26; k += 6) pal.moveTo(px + k, py - 8).lineTo(px + k + 2, py + 4).stroke({ width: 0.6, color: 0x9b7a44, alpha: 0.7 });
          pal.roundRect(px - 16, py - 14, 46, 14, 5).fill(0x9c4a3c).stroke({ width: 0.6, color: INK });
          stage.addChild(pal); at = [px + 32, py - 4]; // lying, the figure reaches back from its feet, so it is set at the pallet's foot
        }
        if (!at) { if(pose === "sit") c.setPose("idle"); at = [45 + (xi++ % 8) * 54, floorY + 28]; }
        c.position.set(at[0], at[1]); c.face(at[0] < W / 2 ? 1 : -1); stage.addChild(c); rigs.push(c);
      }
      const cut = new Graphics(); cut.rect(0, 0, W, H).stroke({ width: 6, color: SAND }); cut.rect(3, 3, W - 6, H - 6).stroke({ width: .7, color: INK, alpha: 0.6 }); stage.addChild(cut);
      onTick = () => { const t = performance.now() / 1000; for (const r of rigs) r.update(t); }; app.ticker.add(onTick);
    })();
    return () => { alive = false; if (app && onTick) app.ticker.remove(onTick); if (stage) { stage.removeFromParent(); stage.destroy({ children: true }); } };
  }, [kind, sprite, hour, people, stock]);
  return <div ref={host} className="w-full rounded-2xl overflow-hidden bg-sand" style={{ aspectRatio: "480 / 280" }} />;
}
