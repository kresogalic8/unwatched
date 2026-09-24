/**
 * The miniature: the island as a model on a table, photographed close. A wooden plinth carries the island and a bay of resin sea;
 * the table runs out beyond it; the buildings are painted models, their edges picked out light the way a modeller dry-brushes them.
 * The photograph is a shallow focus band (the tilt-shift) and richer colour.
 */
import { Graphics } from "pixi.js";
import { RISE, isoFor, type Spec, type Sun } from "./light";
import type { Grade } from "@/components/world/post";

/** How far the resin sea reaches past the shore, as a fraction of the island's size, and how tall the plinth stands. */
export const BAY = 1.2, PLINTH = 90;
export const TABLE = 0x5a4a3e;
const WOOD = 0x6e4f36, WOOD_DARK = 0x3f2c1f, TRIM = 0xd8c6a0;

/** The table: a walnut top with a long grain, laid once over a wide area around the model. */
export function drawTable(g: Graphics, W: number, H: number): void {
  g.clear(); g.rect(-4000, -4000, W + 8000, H + 8000).fill(TABLE);
  for (let i = 0; i < 260; i++) {
    const y = -4000 + (i / 260) * (H + 8000) + Math.sin(i * 1.7) * 12; const a = 0.035 + ((i * 37) % 7) * 0.006;
    g.moveTo(-4000, y); for (let x = -4000; x <= W + 4000; x += 400) g.lineTo(x, y + Math.sin(x * 0.0021 + i) * 9);
    g.stroke({ width: 3 + (i % 4), color: i % 3 ? 0x4a3b30 : 0x6b5849, alpha: a });
  }
}

/**
 * The plinth under the model: its shadow on the table, the wooden sides the viewer can see (the southern half, facing us),
 * shaded by which way each stretch faces the lamp, and a pale trim along the top edge.
 */
export function drawPlinth(shadow: Graphics, sides: Graphics, rim: [number, number][], sun: Sun): void {
  shadow.clear(); sides.clear();
  const off = { x: -sun.L[0] * 60 + 30, y: 50 };
  shadow.poly(rim.flatMap(([x, y]) => [x + off.x, y + PLINTH + off.y])).fill({ color: 0x1b140f, alpha: 0.45 });
  const n = rim.length;
  for (let k = 0; k < n; k++) {
    const a = rim[k]!, b = rim[(k + 1) % n]!;
    const nx = b[1] - a[1], ny = -(b[0] - a[0]); // outward, for the island's winding
    if (ny <= 0) continue; // the northern sides face away from us
    const facing = Math.max(0, Math.min(1, 0.55 + 0.45 * (nx * -sun.L[0] + ny * 0.4) / Math.hypot(nx, ny)));
    sides.poly([a[0], a[1], b[0], b[1], b[0], b[1] + PLINTH, a[0], a[1] + PLINTH]).fill(mixWood(facing));
  }
  // the bevelled trim along the top, and a dark line where the plinth meets the table
  sides.moveTo(rim[0]![0], rim[0]![1]); for (const [x, y] of rim.slice(1)) sides.lineTo(x, y); sides.closePath().stroke({ width: 5, color: TRIM, alpha: 0.9 });
  for (let k = 0; k < n; k++) { const a = rim[k]!, b = rim[(k + 1) % n]!; if (b[0] - a[0] >= 0) continue; sides.moveTo(a[0], a[1] + PLINTH).lineTo(b[0], b[1] + PLINTH).stroke({ width: 2, color: 0x1b140f, alpha: 0.6 }); }
}
const mixWood = (t: number) => { const ch = (sh: number) => Math.round(((WOOD_DARK >> sh) & 255) * (1 - t) + ((WOOD >> sh) & 255) * t); return (ch(16) << 16) | (ch(8) << 8) | ch(0); };

/**
 * A painted model's edges: a thin pale line along every outside corner, ridge and eave, the modeller's dry-brush,
 * plus a soft gloss on the roof that follows the lamp. Drawn with an add blend over the building.
 */
export function drybrush(g: Graphics, spec: Spec, sun: Sun): void {
  g.clear(); const { w, d, h } = spec; const q = isoFor(spec);
  const edge = (a: [number, number], b: [number, number], alpha: number) => g.moveTo(a[0], a[1]).lineTo(b[0], b[1]).stroke({ width: 1.1, color: 0xfff6e0, alpha, cap: "round" });
  edge(q(-7, d / 2, h + RISE), q(w + 7, d / 2, h + RISE), 0.55);
  edge(q(-7, d + 6, h), q(w + 7, d + 6, h), 0.4);
  edge(q(w + 7, -6, h), q(w + 7, d / 2, h + RISE), 0.4); edge(q(w + 7, d / 2, h + RISE), q(w + 7, d + 6, h), 0.4);
  edge(q(w, d, 1), q(w, d, h - 1), 0.35); edge(q(0, d, 1), q(0, d, h - 1), 0.18); edge(q(w, 0, 1), q(w, 0, h - 1), 0.18);
  edge(q(0, d, 0.5), q(w, d, 0.5), 0.12); edge(q(w, d, 0.5), q(w, 0, 0.5), 0.12);
  // gloss: a soft oval where the lamp catches the painted tiles, sliding along the roof with the light
  const day = sun.up ? 1 - sun.night : 0.25; const along = 0.5 + 0.35 * Math.max(-1, Math.min(1, sun.L[0] - sun.L[1]));
  const [gx, gy] = q(-7 + (w + 14) * along, d * 0.72, h + RISE * 0.45);
  for (const [r, a] of [[26, 0.05], [15, 0.07], [7, 0.08]] as const) g.ellipse(gx, gy, r * 1.6, r * 0.55).fill({ color: 0xffffff, alpha: a * day });
}

/** The photograph's colour: a little richer and crisper than life, the way close-up shots of models look. */
export function dioramaGrade(base: Grade): Grade {
  return { sat: base.sat * 1.22, contrast: base.contrast * 1.08, lift: [base.lift[0], base.lift[1] + 0.005, base.lift[2] + 0.015], gain: [base.gain[0] * 1.03, base.gain[1] * 1.01, base.gain[2] * 0.98] };
}
