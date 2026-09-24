/**
 * The sun and the shape of a house, shared by both study styles. A house on the street is the atlas drawing of one of HOUSE_SPECS,
 * rendered at scale .72 around the foot of its front-right corner; `isoFor` gives the same projection in the building's own units,
 * so light and ink can be laid on the drawing exactly.
 */
import { Graphics } from "pixi.js";
import { HOUSE_SPECS } from "@/components/world/harbor-art";

export type Spec = { w: number; d: number; h: number; cafe: boolean };
export type Iso = (i: number, j: number, k: number) => [number, number];
export type Sun = { up: boolean; L: [number, number, number]; golden: number; blue: number; night: number; phase: "rise" | "set" };

const SPECS = new Map<string, Spec>(HOUSE_SPECS.map(([name, w, d, h, cafe]) => [name, { w, d, h, cafe }]));
/** The shape behind a drawing: house2 and cottage3 are colour variants of house and cottage. */
export function specFor(sprite: string): Spec | null { return SPECS.get(sprite.replace(/\d+$/, "")) ?? null; }
export const RISE = 40;
export function isoFor({ w, d }: Spec): Iso {
  return (i, j, k) => [0.72 * ((i - j) * 0.95 - (w - d) * 0.95), 0.72 * ((i + j) * 0.44 - k - (w + d) * 0.44)];
}

/**
 * Where the sun is, as a direction in the island's own axes (u along the lane, v across it, z up). It rises in the east
 * (screen right), stands in the south, toward the viewer, at noon, and sets in the west; `L` points at it.
 */
export function sunAt(hour: number, rise: number, set: number): Sun {
  const up = hour > rise && hour < set; const f = Math.max(0, Math.min(1, (hour - rise) / Math.max(1, set - rise)));
  const th = Math.PI * f, el = up ? Math.sin(Math.PI * f) * 1.05 : 0;
  const hu = 0.707 * Math.cos(th) + 0.707 * Math.sin(th), hv = -0.707 * Math.cos(th) + 0.707 * Math.sin(th);
  const nearRise = Math.abs(hour - rise), nearSet = Math.abs(hour - set); const phase = nearRise < nearSet ? "rise" : "set";
  // the dark comes in over the half hour before sunset and the hour after it, and leaves the same way around sunrise
  const night = Math.max(0, Math.min(1, hour < (rise + set) / 2 ? (rise + 0.5 - hour) / 1.5 : (hour - set + 0.5) / 1.5));
  return { up, L: [hu * Math.cos(el), hv * Math.cos(el), Math.sin(el)], golden: Math.max(0, 1 - Math.min(nearRise, nearSet) / 1.1), blue: Math.max(0, 1 - Math.abs(hour - (phase === "rise" ? rise - 0.7 : set + 0.7)) / 0.7), night, phase };
}
/** How much each way a surface can face is turned toward the sun, 0..1. */
export function litFaces(L: Sun["L"]) { return { front: Math.max(0, L[1]), side: Math.max(0, L[0]), roof: Math.max(0, 0.6 * L[1] + 0.8 * L[2]) }; }

/** Monotone-chain convex hull. */
export function hull(points: [number, number][]): [number, number][] {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]); if (p.length < 3) return p;
  const cross = (o: number[], a: number[], b: number[]) => (a[0]! - o[0]!) * (b[1]! - o[1]!) - (a[1]! - o[1]!) * (b[0]! - o[0]!);
  const lower: [number, number][] = []; for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, q) <= 0) lower.pop(); lower.push(q); }
  const upper: [number, number][] = []; for (const q of [...p].reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, q) <= 0) upper.pop(); upper.push(q); }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** The ground a house shades: its walls and roof pushed along the sun onto z = 0, in the building's units. Null with the sun down. */
export function castShadow(spec: Spec, sun: Sun): [number, number][] | null {
  if (!sun.up) return null; const { w, d, h } = spec; const iso = isoFor(spec);
  // a real 13° sun throws four heights of shadow; two reads better on a street this dense
  const lz = Math.max(0.42, sun.L[2]); const su = sun.L[0] / lz, sv = sun.L[1] / lz;
  const ground = (i: number, j: number, k: number) => iso(i - su * k, j - sv * k, 0);
  const pts: [number, number][] = [];
  for (const [i, j] of [[0, 0], [w, 0], [w, d], [0, d]] as const) { pts.push(iso(i, j, 0), ground(i, j, h)); }
  pts.push(ground(-7, d / 2, h + RISE), ground(w + 7, d / 2, h + RISE));
  return hull(pts);
}

const poly = (g: Graphics, pts: [number, number][]) => { g.moveTo(pts[0]![0], pts[0]![1]); for (const p of pts.slice(1)) g.lineTo(p[0], p[1]); return g.closePath(); };

/**
 * Painted light, the pieces an illustrator adds that a flat drawing lacks: the dark where a wall meets the ground (contact),
 * warm light thrown back up from sunlit ground (bounce), and a bright line along the edges the sun grazes (rim).
 * `dark` is drawn with a multiply blend, `bright` with add.
 */
export function paintLight(dark: Graphics, bright: Graphics, spec: Spec, sun: Sun): void {
  dark.clear(); bright.clear();
  const { w, d, h } = spec; const q = isoFor(spec); const day = sun.up ? 1 - sun.night : 0; const lit = litFaces(sun.L);
  // contact: bands of shade up the foot of both walls, and a soft dark on the ground just outside them
  const ink = 0x3d4a44;
  for (const [z0, z1, a] of [[0, 3, 0.34], [3, 8, 0.17], [8, 16, 0.08], [16, 28, 0.03]] as const) {
    poly(dark, [q(0, d, z0), q(w, d, z0), q(w, d, z1), q(0, d, z1)]).fill({ color: ink, alpha: a });
    poly(dark, [q(w, d, z0), q(w, 0, z0), q(w, 0, z1), q(w, d, z1)]).fill({ color: ink, alpha: a });
  }
  for (const [b, a] of [[3, 0.22], [7, 0.12], [13, 0.06]] as const) {
    poly(dark, [q(-2, d, 0), q(w, d, 0), q(w, d + b, 0), q(-2, d + b, 0)]).fill({ color: ink, alpha: a });
    poly(dark, [q(w, -2, 0), q(w, d, 0), q(w + b, d, 0), q(w + b, -2, 0)]).fill({ color: ink, alpha: a });
  }
  if (day <= 0.02) return;
  // bounce: sunlit sand throws a little warmth back up onto the lower walls
  const sand = 0x5c4a2c, bounce = 0.07 * day * Math.max(0.3, sun.L[2]);
  for (const [z0, z1, a] of [[4, 14, 1], [14, 26, 0.6], [26, 40, 0.3]] as const) {
    poly(bright, [q(0, d, z0), q(w, d, z0), q(w, d, z1), q(0, d, z1)]).fill({ color: sand, alpha: bounce * a });
    poly(bright, [q(w, d, z0), q(w, 0, z0), q(w, 0, z1), q(w, d, z1)]).fill({ color: sand, alpha: bounce * a * 0.8 });
  }
  // rim: the edges the sun grazes, brightest when it is low
  const warm = sun.golden > 0.2 ? 0xffc98a : 0xfff0cc; const low = 0.35 + 0.65 * sun.golden;
  const rim = (a: [number, number], b: [number, number], k: number) => { if (k < 0.02) return; bright.moveTo(a[0], a[1]).lineTo(b[0], b[1]).stroke({ width: 3.4, color: warm, alpha: 0.18 * k, cap: "round" }); bright.moveTo(a[0], a[1]).lineTo(b[0], b[1]).stroke({ width: 1.2, color: warm, alpha: 0.6 * k, cap: "round" }); };
  rim(q(-7, d / 2, h + RISE), q(w + 7, d / 2, h + RISE), day * low * (0.4 + 0.6 * lit.roof));
  rim(q(-7, d + 6, h), q(w + 7, d + 6, h), day * low * lit.front);
  rim(q(w + 7, -6, h), q(w + 7, d / 2, h + RISE), day * low * lit.side);
  rim(q(w + 7, d / 2, h + RISE), q(w + 7, d + 6, h), day * low * lit.side);
  rim(q(w, d, 2), q(w, d, h - 2), day * sun.golden * Math.abs(lit.front - lit.side));
}
