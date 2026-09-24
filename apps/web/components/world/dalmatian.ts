/**
 * The island's houses in the Dalmatian vernacular: dressed limestone, kupa kanalica roofs, green škure, the balatura stair
 * that climbs the outside of a stone house to its first-floor door. Drawn as SVG in code, in the town's own projection
 * (the atlas's scale .72, anchored at the foot of the front-right corner). scripts/gen-harbor.tsx rasterizes them into the
 * atlas as dal-<kind>, dal-<kind>2 and dal-<kind>3, each with a lit twin and light masks; the town picks them by place.
 */
export type Spec = { w: number; d: number; h: number; cafe: boolean };

export type Kind = "stone" | "fisher" | "townhouse" | "konoba" | "shop" | "bakery" | "smithy" | "chandlery" | "fishhouse" | "council" | "chapel" | "mill" | "lighthouse";
type Pt = [number, number];

/** Every building the island draws. `ways` is how many colourways the atlas carries; `tower` marks the square towers with a pyramid roof. */
export const HOUSES: Record<Kind, { name: string; local: string; spec: Spec; old: string; note: string; ways: number; tower?: boolean }> = {
  stone: { ways: 3, name: "Stone house", local: "kamena kuća", spec: { w: 120, d: 90, h: 128, cafe: false }, old: "house", note: "Dressed limestone, a balatura stair to the first floor, a dark arch under the landing." },
  fisher: { ways: 3, name: "Fisherman's cottage", local: "ribarska kućica", spec: { w: 110, d: 80, h: 66, cafe: false }, old: "cottage", note: "Low and whitewashed, stone at the corners, a wide arch for the boat, nets drying on the wall." },
  townhouse: { ways: 3, name: "Town house", local: "gradska kuća", spec: { w: 130, d: 100, h: 176, cafe: false }, old: "inn", note: "Three storeys of plaster over stone courses, a balcony with a balustrade, geraniums." },
  konoba: { ways: 1, name: "Konoba", local: "konoba", spec: { w: 140, d: 100, h: 112, cafe: false }, old: "tavern", note: "A stone ground floor of barrel arches, a plastered room above, a vine pergola over the tables." },
  shop: { ways: 3, name: "Shop", local: "dućan", spec: { w: 130, d: 95, h: 118, cafe: true }, old: "shop", note: "A stone-framed window of goods on its shelves, a glazed door, a striped awning, a board for its name." },
  bakery: { ways: 1, name: "Bakery", local: "pekara", spec: { w: 130, d: 95, h: 122, cafe: true }, old: "bakery", note: "Stone below and plaster above, the bread oven's dome against the side wall, a bench for the morning's loaves." },
  smithy: { ways: 1, name: "Smithy", local: "kovačnica", spec: { w: 132, d: 100, h: 92, cafe: false }, old: "smithy", note: "Rough stone, one wide arch with the forge glowing at the back, the anvil on its stump outside, a wheel waiting for its rim." },
  chandlery: { ways: 1, name: "Chandlery", local: "brodska opskrba", spec: { w: 100, d: 80, h: 150, cafe: false }, old: "chandlery", note: "Tall and narrow, an anchor hung on the wall for a sign, rope coiled at the door." },
  fishhouse: { ways: 1, name: "Fish house", local: "ribarnica", spec: { w: 125, d: 85, h: 90, cafe: false }, old: "fishhouse", note: "A loggia of three arches over a stone counter, crates of the catch in front, a fish turning on the ridge." },
  council: { ways: 1, name: "Council hall", local: "gradska loža", spec: { w: 175, d: 115, h: 170, cafe: false }, old: "council", note: "A dressed-stone loggia of arches, paired windows above, a clock, and a bell-cote on the ridge." },
  chapel: { ways: 1, name: "Chapel", local: "crkvica", spec: { w: 110, d: 78, h: 86, cafe: false }, old: "chapel", note: "Stone walls and a roof of stone slabs, a rose window, and a bell-gable over the door where the bell swings." },
  mill: { ways: 1, tower: true, name: "Mill", local: "mlin", spec: { w: 64, d: 64, h: 150, cafe: false }, old: "mill", note: "A square stone tower under a pyramid of tiles, its sails turning while someone works it." },
  lighthouse: { ways: 1, tower: true, name: "Lighthouse", local: "svjetionik", spec: { w: 52, d: 52, h: 176, cafe: false }, old: "lighthouse", note: "A whitewashed tower on stone corners, a gallery with a rail, the lantern under its red cap." },
};

/** Colourways: plaster, shutters, door. The stone is the island's own, the same for every house. */
const WAYS = [
  { plaster: "#ece4d2", shutter: "#4f7a5a", door: "#5b4636" },
  { plaster: "#e6c79b", shutter: "#46708f", door: "#6b4a33" },
  { plaster: "#e9cfc0", shutter: "#5d7f63", door: "#4e5b4a" },
];
const STONES = ["#d8cfbb", "#cdc3ad", "#ddd5c3", "#c6bca5", "#d3c9b2", "#e0d8c6"];
const MORTAR = "#a89e87", GLASS = "#3b4847", LIT = "#f1c46c", TILE_CLAY = "#bb6443", TILE_CLAY_LIGHT = "#d98d62", TILE_CLAY_DARK = "#8d4631";
const TILE = TILE_CLAY, TILE_DARK = TILE_CLAY_DARK;

function rnd(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f = (n: number) => n.toFixed(2);

/** One drawing: SVG elements in painter's order, and the box they occupy, so the page can rasterize exactly that. */
class Sheet {
  out: string[] = []; x0 = 1e9; y0 = 1e9; x1 = -1e9; y1 = -1e9;
  constructor(readonly spec: Spec) {}
  /** the town's projection in the building's units: i along the lane, j across it, k up */
  q = (i: number, j: number, k: number): Pt => { const { w, d } = this.spec; const p: Pt = [0.72 * ((i - j) * 0.95 - (w - d) * 0.95), 0.72 * ((i + j) * 0.44 - k - (w + d) * 0.44)]; this.x0 = Math.min(this.x0, p[0]); this.y0 = Math.min(this.y0, p[1]); this.x1 = Math.max(this.x1, p[0]); this.y1 = Math.max(this.y1, p[1]); return p; };
  /** a point on the front wall (a along it from the left, z up, out toward the viewer) or the side wall (a back from the front corner) */
  front = (a: number, z: number, out = 0) => this.q(a, this.spec.d + out, z);
  side = (a: number, z: number, out = 0) => this.q(this.spec.w + out, this.spec.d - a, z);
  poly(pts: Pt[], fill: string, stroke = "none", sw = 0.6, extra = "") { this.out.push(`<polygon points="${pts.map((p) => `${f(p[0])},${f(p[1])}`).join(" ")}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" ${extra}/>`); }
  line(a: Pt, b: Pt, color: string, w = 0.8, op = 1) { this.out.push(`<path d="M${f(a[0])} ${f(a[1])}L${f(b[0])} ${f(b[1])}" stroke="${color}" stroke-width="${w}" stroke-linecap="round" opacity="${op}" fill="none"/>`); }
  path(pts: Pt[], color: string, w = 0.8, op = 1) { this.out.push(`<path d="M${pts.map((p) => `${f(p[0])} ${f(p[1])}`).join("L")}" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" opacity="${op}" fill="none"/>`); }
  circle(c: Pt, r: number, fill: string, stroke = "none", sw = 0.5) { this.out.push(`<circle cx="${f(c[0])}" cy="${f(c[1])}" r="${f(r)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`); }
  ellipse(c: Pt, rx: number, ry: number, fill: string, op = 1) { this.out.push(`<ellipse cx="${f(c[0])}" cy="${f(c[1])}" rx="${f(rx)}" ry="${f(ry)}" fill="${fill}" opacity="${op}"/>`); }
  /** text laid flat on the front wall */
  text(a: number, z: number, out: number, s: string, size: number, color: string) { const [x, y] = this.front(a, z, out); this.out.push(`<text transform="matrix(.684 .317 0 .72 ${f(x)} ${f(y)})" font-family="Georgia, serif" font-size="${size}" letter-spacing="1.2" text-anchor="middle" fill="${color}">${s}</text>`); }
}

type Plane = (a: number, z: number, out?: number) => Pt;
/** A shape given in a wall's own (a, z) coordinates. */
const onPlane = (p: Plane, pts: [number, number][], out = 0) => pts.map(([a, z]) => p(a, z, out));
const rect = (a0: number, z0: number, a1: number, z1: number): [number, number][] => [[a0, z0], [a1, z0], [a1, z1], [a0, z1]];
/** An arched opening: straight jambs to `spring`, then a half circle. */
const arch = (a0: number, a1: number, z0: number, spring: number): [number, number][] => { const r = (a1 - a0) / 2, c = a0 + r; const top: [number, number][] = Array.from({ length: 13 }, (_, k) => { const t = Math.PI * (k / 12); return [c - Math.cos(t) * r, spring + Math.sin(t) * r * 0.9]; }); return [[a0, z0], ...top, [a1, z0]]; };

/** Coursed limestone over a region of a wall: rows of blocks, each a slightly different stone, the joints staggered. */
function stone(s: Sheet, p: Plane, a0: number, a1: number, z0: number, z1: number, seed: number, course = 11) {
  const r = rnd(seed); s.poly(onPlane(p, rect(a0, z0, a1, z1)), STONES[0]!);
  for (let z = z0, row = 0; z < z1; z += course, row++) {
    const zt = Math.min(z1, z + course); let a = a0 - (row % 2) * 9 * r();
    while (a < a1) { const len = 13 + r() * 14; const b0 = Math.max(a0, a), b1 = Math.min(a1, a + len); if (b1 - b0 > 1) s.poly(onPlane(p, rect(b0 + 0.6, z + 0.6, b1 - 0.6, zt - 0.6)), STONES[Math.floor(r() * STONES.length)]!, MORTAR, 0.45); a += len; }
  }
}
/** Big corner stones, alternating long and short, on the corner at `a` of a wall. */
function quoins(s: Sheet, p: Plane, a: number, dir: 1 | -1, z0: number, z1: number) { for (let z = z0, k = 0; z < z1; z += 13, k++) { const len = k % 2 ? 12 : 20; s.poly(onPlane(p, rect(Math.min(a, a + dir * len), z + 0.5, Math.max(a, a + dir * len), Math.min(z1, z + 12.5))), k % 2 ? "#d9d0bd" : "#e3dbc9", MORTAR, 0.5); } }
/** A window: stone frame, glass, open škure to either side, a sill. Lit, the glass is lamplight. */
function window_(s: Sheet, p: Plane, a: number, z: number, w: number, h: number, way: (typeof WAYS)[number], lit: boolean, shutters = true) {
  s.poly(onPlane(p, rect(a - 2.5, z - 2, a + w + 2.5, z + h + 2.5)), "#e8e0cd", MORTAR, 0.5);
  s.poly(onPlane(p, rect(a, z, a + w, z + h)), lit ? LIT : GLASS);
  if (!lit) s.poly(onPlane(p, [[a + 1, z + h - 1], [a + w * 0.55, z + h - 1], [a + 1, z + h * 0.35]]), "#8fa9a3", "none", 0, `opacity=".35"`);
  s.line(p(a + w / 2, z), p(a + w / 2, z + h), lit ? "#b58a55" : "#c9c2ad", 1.1); s.line(p(a, z + h * 0.55), p(a + w, z + h * 0.55), lit ? "#b58a55" : "#c9c2ad", 1.1);
  if (shutters) for (const [s0, s1] of [[a - 2.5 - w * 0.48, a - 2.5], [a + w + 2.5, a + w + 2.5 + w * 0.48]] as const) { s.poly(onPlane(p, rect(s0, z - 1, s1, z + h + 1), 0.4), way.shutter, "#34473d", 0.55); for (let k = 1; k < 7; k++) s.line(p(s0 + 1, z + (h * k) / 7, 0.5), p(s1 - 1, z + (h * k) / 7, 0.5), "#2e3f36", 0.45, 0.55); }
  s.poly(onPlane(p, rect(a - 4, z - 4.5, a + w + 4, z - 2), 1.2), "#ece5d4", MORTAR, 0.5);
}
function door(s: Sheet, p: Plane, a0: number, a1: number, z1: number, way: (typeof WAYS)[number], arched: boolean) {
  const frame = arched ? arch(a0 - 3, a1 + 3, 0, z1 - (a1 - a0) / 2) : rect(a0 - 3, 0, a1 + 3, z1 + 3);
  s.poly(onPlane(p, frame), "#e5ddca", MORTAR, 0.6);
  const leaf = arched ? arch(a0, a1, 0, z1 - (a1 - a0) / 2 - 1.5) : rect(a0, 0, a1, z1);
  s.poly(onPlane(p, leaf, 0.2), way.door, "#3d3226", 0.6);
  for (let a = a0 + 4; a < a1 - 1; a += 5) s.line(p(a, 1, 0.3), p(a, z1 - (arched ? (a1 - a0) / 2 : 2), 0.3), "#2c241b", 0.5, 0.45);
  s.circle(p(a1 - 4, z1 * 0.45, 0.5), 0.9, "#d2b27a");
}
/** Geraniums in a pot, standing at a point. */
function geraniums(s: Sheet, at: Pt, seed: number) {
  const r = rnd(seed); s.poly([[at[0] - 3.2, at[1] - 5], [at[0] + 3.2, at[1] - 5], [at[0] + 2.4, at[1]], [at[0] - 2.4, at[1]]], "#b86b4b", "#7e4a35", 0.4);
  for (let k = 0; k < 9; k++) s.ellipse([at[0] + (r() - 0.5) * 9, at[1] - 7 - r() * 5], 2.2, 1.5, k % 3 ? "#6d8a52" : "#58743f");
  for (let k = 0; k < 6; k++) s.circle([at[0] + (r() - 0.5) * 8, at[1] - 9 - r() * 5], 1.1, k % 2 ? "#d0443c" : "#e8706a");
}

/** The roof all these houses share: a gable along the lane, clay kanalica in rows, a ridge of capping tiles, a chimney with its own little roof. */
function roof(s: Sheet, h: number, seed: number, chimneys: number[], slabs = false) {
  const [TILE, TILE_LIGHT, TILE_DARK] = slabs ? ["#b9b3a6", "#d2cdc1", "#8d877b"] : [TILE_CLAY, TILE_CLAY_LIGHT, TILE_CLAY_DARK];
  const { w, d } = s.spec; const q = s.q; const RISE = 40;
  const slope = (a: number, t: number) => q(a, d + 6 - t * (d / 2 + 6), h + t * RISE);
  const r = rnd(seed);
  s.poly([slope(-7, 0), slope(w + 7, 0), slope(w + 7, 1), slope(-7, 1)], TILE, TILE_DARK, 0.6);
  // the tiles: columns of half-round clay, light on the crown, dark in the channel, each course overlapping the next
  for (let a = -5; a < w + 6; a += 7) {
    const tone = r(); s.path(Array.from({ length: 7 }, (_, k) => slope(a + 3.5, k / 6)), slabs ? (tone < 0.5 ? TILE_LIGHT : "#c6c0b3") : tone < 0.3 ? "#cf7b54" : tone < 0.7 ? TILE_LIGHT : "#e39a6c", 2.6);
    s.path(Array.from({ length: 7 }, (_, k) => slope(a, k / 6)), TILE_DARK, 1.2, 0.8);
    for (let k = 1; k < 7; k++) s.line(slope(a, k / 7), slope(a + 7, k / 7), TILE_DARK, 0.5, 0.5);
    if (!slabs) s.circle(slope(a + 3.5, 0), 1.9, "#a9543a", TILE_DARK, 0.4);
  }
  s.line(slope(-8, 1), slope(w + 8, 1), slabs ? "#9d978b" : "#a8563a", 3.2); if (!slabs) for (let a = -6; a < w + 7; a += 9) s.circle(slope(a, 1), 1.9, "#c46e4b", TILE_DARK, 0.4);
  for (const ci of chimneys) {
    const c0 = ci, c1 = ci + 14, j0 = 6, j1 = 18, top = h + RISE + 22;
    s.poly([q(c0, j1, h + 10), q(c1, j1, h + 10), q(c1, j1, top), q(c0, j1, top)], "#d3c9b3", MORTAR, 0.5);
    s.poly([q(c1, j1, h + 10), q(c1, j0, h + 10), q(c1, j0, top), q(c1, j1, top)], "#bdb39c", MORTAR, 0.5);
    for (let z = h + 16; z < top; z += 7) { s.line(q(c0, j1, z), q(c1, j1, z), MORTAR, 0.4); s.line(q(c1, j1, z), q(c1, j0, z), MORTAR, 0.4); }
    s.poly([q(c0 - 2, j1 + 2, top), q(c1 + 2, j1 + 2, top), q(c1 + 2, (j0 + j1) / 2, top + 7), q(c0 - 2, (j0 + j1) / 2, top + 7)], TILE, TILE_DARK, 0.5);
    s.poly([q(c1 + 2, j0 - 2, top), q(c1 + 2, j1 + 2, top), q(c1 + 2, (j0 + j1) / 2, top + 7)], "#a9543a", TILE_DARK, 0.5);
  }
}
/** The back slope and the gable end, painted before the front of the roof. */
function roofBack(s: Sheet, h: number, wall: string, stoneGable: boolean, slabs = false) {
  const { w, d } = s.spec; const q = s.q; const RISE = 40;
  s.poly([q(-7, -6, h), q(w + 7, -6, h), q(w + 7, d / 2, h + RISE), q(-7, d / 2, h + RISE)], slabs ? "#8d877b" : TILE_DARK);
  s.poly([q(w + 7, -6, h), q(w + 7, d + 6, h), q(w + 7, d / 2, h + RISE)], stoneGable ? STONES[1]! : wall, MORTAR, 0.5);
  if (stoneGable) for (let z = h + 9; z < h + RISE; z += 9) { const t = (z - h) / RISE, j0 = -6 + t * (d / 2 + 6), j1 = d + 6 - t * (d / 2 + 6); s.line(q(w + 7, j0, z), q(w + 7, j1, z), MORTAR, 0.45); }
  s.poly([q(w + 7, d + 6, h), q(w + 7, -6, h), q(w + 7, -6, h - 5), q(w + 7, d + 6, h - 5)], "#b9ae96", MORTAR, 0.4);
}
/** Walls: front and side, either all stone or plaster over a stone base with corner stones. */
function walls(s: Sheet, h: number, way: (typeof WAYS)[number], seed: number, allStone: boolean, stoneTo = 10) {
  const { w, d } = s.spec;
  if (allStone) { stone(s, s.side, 0, d, 0, h, seed + 1); stone(s, s.front, 0, w, 0, h, seed + 2); quoins(s, s.front, w, -1, 0, h); quoins(s, s.side, 0, 1, 0, h); return; }
  s.poly(onPlane(s.side, rect(0, 0, d, h)), way.plaster, MORTAR, 0.5); s.poly(onPlane(s.front, rect(0, 0, w, h)), way.plaster, MORTAR, 0.5);
  // limewash is never even: a little bloom and a few patches where it has worn to the stone
  const r = rnd(seed); for (let k = 0; k < 14; k++) { const a = r() * (w - 20) + 6, z = stoneTo + 6 + r() * (h - stoneTo - 16); s.poly(onPlane(s.front, [[a, z], [a + 6 + r() * 8, z + 1], [a + 7, z + 4], [a + 1, z + 3]]), STONES[k % STONES.length]!, "none", 0, `opacity=".55"`); }
  stone(s, s.side, 0, d, 0, stoneTo, seed + 3, stoneTo); stone(s, s.front, 0, w, 0, stoneTo, seed + 4, stoneTo);
  quoins(s, s.front, w, -1, stoneTo, h); quoins(s, s.side, 0, 1, stoneTo, h); quoins(s, s.front, 0, 1, stoneTo, h);
}

function stoneHouse(s: Sheet, way: (typeof WAYS)[number], lit: boolean) {
  const { w, d, h } = HOUSES.stone.spec;
  roofBack(s, h, way.plaster, true); walls(s, h, way, 11, true);
  // side wall
  window_(s, s.side, 26, 72, 18, 26, way, lit); window_(s, s.side, 44, 20, 13, 16, way, false, false);
  // the ground floor behind the stair: an arched door and a small window
  door(s, s.front, 12, 34, 46, way, true); window_(s, s.front, 13, 70, 18, 26, way, lit);
  // the balatura: a stone stair climbing along the front to a landing and the first-floor door
  const out = 17, land = 62, a0 = 44, aStair = 82, aEnd = 116; const steps = 8;
  door(s, s.front, aStair + 6, aStair + 26, land + 44, way, false);
  const profile: [number, number][] = [[a0, 0]]; for (let k = 0; k < steps; k++) { const a = a0 + ((aStair - a0) * k) / steps, z = (land * (k + 1)) / steps; profile.push([a, z], [a + (aStair - a0) / steps, z]); }
  profile.push([aEnd, land], [aEnd, 0]);
  s.poly(onPlane(s.front, profile, out), "#d6ccb6", MORTAR, 0.6);
  for (let z = 10; z < land; z += 11) s.line(s.front(Math.max(a0, a0 + (z / land) * (aStair - a0)) + 2, z, out), s.front(aEnd, z, out), MORTAR, 0.45);
  s.poly(onPlane(s.front, arch(aStair - 2, aEnd - 8, 0, 26), out + 0.2), "#3b3a33", "#8f8570", 0.6); // the cellar door under the landing
  for (let k = 0; k < steps; k++) { const a = a0 + ((aStair - a0) * k) / steps, z = (land * (k + 1)) / steps, b = a + (aStair - a0) / steps; s.poly([s.front(a, z, 0), s.front(b, z, 0), s.front(b, z, out), s.front(a, z, out)], "#e4dccb", MORTAR, 0.45); }
  s.poly([s.front(aStair, land, 0), s.front(aEnd, land, 0), s.front(aEnd, land, out), s.front(aStair, land, out)], "#e4dccb", MORTAR, 0.5);
  s.poly([s.q(aEnd, d, 0), s.q(aEnd, d + out, 0), s.q(aEnd, d + out, land), s.q(aEnd, d, land)], "#c3b9a2", MORTAR, 0.5);
  // the parapet along the landing's edge, with a pot on it
  s.poly(onPlane(s.front, rect(aStair, land, aEnd, land + 9), out), "#dcd3bf", MORTAR, 0.5); s.poly([s.front(aStair, land + 9, out - 3), s.front(aEnd, land + 9, out - 3), s.front(aEnd, land + 9, out), s.front(aStair, land + 9, out)], "#ece5d4", MORTAR, 0.4);
  geraniums(s, s.front(aEnd - 8, land + 9, out - 1.5), 5); geraniums(s, s.front(aStair + 3, land, out - 6), 9);
  roof(s, h, 21, CHIMNEYS.stone);
}

function fisherCottage(s: Sheet, way: (typeof WAYS)[number], lit: boolean) {
  const { w, d, h } = HOUSES.fisher.spec; const white = { ...way, plaster: "#f2eee3" };
  roofBack(s, h, white.plaster, false); walls(s, h, white, 31, false, 12);
  window_(s, s.side, 26, 24, 16, 20, { ...way, shutter: "#4a7ea3" }, lit);
  // nets drying on the side wall, with cork floats
  const net: Pt[] = []; for (let k = 0; k <= 10; k++) net.push(s.side(44 + k * 3, 52 - Math.sin((k / 10) * Math.PI) * 18, 1));
  s.path(net, "#8a7a5a", 1.2); for (let k = 0; k <= 10; k += 2) s.line(s.side(44 + k * 3, 52 - Math.sin((k / 10) * Math.PI) * 18, 1), s.side(44 + k * 3, 12, 1), "#8a7a5a", 0.6, 0.8);
  for (let z = 18; z < 50; z += 7) s.line(s.side(44, z, 1), s.side(74, z, 1), "#8a7a5a", 0.45, 0.6);
  for (let k = 0; k <= 10; k += 2) s.circle(s.side(44 + k * 3, 52 - Math.sin((k / 10) * Math.PI) * 18, 1.2), 1.5, "#e0823f", "#8a4a22", 0.4);
  // the boat arch: dark inside, the bow of a gajeta in the shadow
  s.poly(onPlane(s.front, arch(40, 96, 0, 30)), "#e5ddca", MORTAR, 0.6); s.poly(onPlane(s.front, arch(44, 92, 0, 28), 0.2), "#343a38");
  s.poly([s.front(56, 4, 0.4), s.front(80, 4, 0.4), s.front(86, 12, 0.4), s.front(50, 12, 0.4)], "#f2eee3", "#2b2f2e", 0.5); s.line(s.front(50, 12, 0.5), s.front(86, 12, 0.5), "#c24b3a", 1.6);
  window_(s, s.front, 12, 24, 16, 20, { ...way, shutter: "#4a7ea3" }, lit);
  // oars against the wall, a bench of one plank
  s.line(s.front(102, 0, 3), s.front(104, 56, 1), "#a88b62", 1.6); s.line(s.front(106, 0, 3), s.front(107, 54, 1), "#a88b62", 1.6);
  s.poly([s.front(8, 12, 10), s.front(36, 12, 10), s.front(36, 12, 16), s.front(8, 12, 16)], "#b49a73", "#7c6647", 0.5);
  for (const a of [10, 34]) s.line(s.front(a, 0, 13), s.front(a, 12, 13), "#7c6647", 1.2);
  roof(s, h, 41, CHIMNEYS.fisher);
}

function townHouse(s: Sheet, way: (typeof WAYS)[number], lit: boolean) {
  const { w, d, h } = HOUSES.townhouse.spec;
  roofBack(s, h, way.plaster, false); walls(s, h, way, 51, false, 9);
  // string courses at each floor
  for (const z of [60, 120]) { s.poly(onPlane(s.front, rect(-1, z, w + 1, z + 5), 1.5), "#e7dfcd", MORTAR, 0.5); s.poly(onPlane(s.side, rect(-1, z, d + 1, z + 5), 1.5), "#d8d0bd", MORTAR, 0.5); }
  for (const [a, z] of [[16, 130], [60, 130], [100, 130], [16, 72], [100, 72]] as const) window_(s, s.front, a, z, 18, 28, way, lit);
  for (const [a, z] of [[22, 130], [58, 130], [22, 72], [58, 72]] as const) window_(s, s.side, a, z, 16, 26, way, lit);
  // ground floor: a keystoned arch, barred windows either side
  door(s, s.front, 52, 78, 50, way, true); s.poly(onPlane(s.front, [[62, 51], [68, 51], [69, 57], [61, 57]], 0.6), "#ece5d4", MORTAR, 0.5);
  for (const a of [16, 100]) { s.poly(onPlane(s.front, rect(a - 2, 18, a + 18, 42)), "#e8e0cd", MORTAR, 0.5); s.poly(onPlane(s.front, rect(a, 20, a + 16, 40)), GLASS); for (let k = 3; k < 16; k += 4) s.line(s.front(a + k, 20, 1), s.front(a + k, 40, 1), "#2a2e2b", 0.9); }
  // the balcony: a stone slab on corbels, balusters, a door with shutters, geraniums along the rail
  const b0 = 44, b1 = 86, bz = 66, bo = 13;
  window_(s, s.front, 57, 68, 16, 38, way, lit);
  for (const a of [b0 + 4, b1 - 4]) s.poly([s.front(a - 2, bz - 6, 0), s.front(a + 2, bz - 6, 0), s.front(a + 2, bz, bo - 2), s.front(a - 2, bz, bo - 2)], "#d6ccb6", MORTAR, 0.4);
  s.poly([s.front(b0, bz, 0), s.front(b1, bz, 0), s.front(b1, bz, bo), s.front(b0, bz, bo)], "#ece5d4", MORTAR, 0.5); s.poly(onPlane(s.front, rect(b0, bz - 3, b1, bz), bo), "#d6ccb6", MORTAR, 0.5);
  for (let a = b0 + 2; a <= b1 - 2; a += 4) s.poly(onPlane(s.front, [[a - 1, bz], [a + 1, bz], [a + 1.4, bz + 5], [a + 1, bz + 10], [a - 1, bz + 10], [a - 1.4, bz + 5]], bo - 1), "#e7dfcd", MORTAR, 0.35);
  s.poly([s.front(b0, bz + 10, bo - 3), s.front(b1, bz + 10, bo - 3), s.front(b1, bz + 10, bo), s.front(b0, bz + 10, bo)], "#f0e9d9", MORTAR, 0.45);
  for (const a of [b0 + 6, b0 + 20, b1 - 6]) geraniums(s, s.front(a, bz + 10, bo - 1.5), a);
  roof(s, h, 61, CHIMNEYS.townhouse);
}

function konoba(s: Sheet, way: (typeof WAYS)[number], lit: boolean) {
  const { w, d, h } = HOUSES.konoba.spec; const upper = { ...way, plaster: way === WAYS[1] ? "#ead7b6" : "#ebe1cc" };
  roofBack(s, h, upper.plaster, false);
  // stone below, plaster above
  s.poly(onPlane(s.side, rect(0, 56, d, h)), upper.plaster, MORTAR, 0.5); s.poly(onPlane(s.front, rect(0, 56, w, h)), upper.plaster, MORTAR, 0.5);
  stone(s, s.side, 0, d, 0, 56, 71); stone(s, s.front, 0, w, 0, 56, 72); quoins(s, s.front, w, -1, 56, h); quoins(s, s.side, 0, 1, 56, h);
  s.poly(onPlane(s.front, rect(-1, 56, w + 1, 60), 1.4), "#e7dfcd", MORTAR, 0.5); s.poly(onPlane(s.side, rect(-1, 56, d + 1, 60), 1.4), "#d8d0bd", MORTAR, 0.5);
  window_(s, s.side, 30, 22, 14, 18, way, lit, false); window_(s, s.side, 34, 72, 16, 24, way, lit);
  for (const a of [18, 62, 106]) window_(s, s.front, a, 72, 16, 24, way, lit);
  // two barrel arches, the casks inside
  for (const [a0, a1] of [[10, 60], [76, 126]] as const) {
    s.poly(onPlane(s.front, arch(a0 - 4, a1 + 4, 0, 26)), "#e0d7c3", MORTAR, 0.6); s.poly(onPlane(s.front, arch(a0, a1, 0, 24), 0.2), lit ? "#5a3f26" : "#2f2b25");
    for (const a of [a0 + 12, a0 + 30]) { const c = s.front(a, 9, -6); s.ellipse(c, 8, 9, "#7a5436"); for (const dy of [-5, 0, 5]) s.line([c[0] - 7.5, c[1] + dy], [c[0] + 7.5, c[1] + dy], "#3b2a1c", 0.6, 0.7); s.circle(c, 3.2, "#5d3f28"); }
  }
  s.text(68, 40, 1, "KONOBA", 7, "#5b4636");
  // barrels by the door and the pergola with its vine over the tables
  for (const a of [66, 132]) { const c = s.front(a, 0, 8); s.poly([[c[0] - 6, c[1]], [c[0] + 6, c[1]], [c[0] + 7, c[1] - 9], [c[0] + 6, c[1] - 17], [c[0] - 6, c[1] - 17], [c[0] - 7, c[1] - 9]], "#8a5f3d", "#4b3322", 0.5); for (const dy of [-3, -14]) s.line([c[0] - 6.5, c[1] + dy], [c[0] + 6.5, c[1] + dy], "#3b2a1c", 0.8); s.ellipse([c[0], c[1] - 17], 6, 2.2, "#6d4a30"); }
  const po = 46, pz = 60;
  for (const a of [4, 70, 136]) s.line(s.front(a, 0, po), s.front(a, pz, po), "#8d7454", 2.2);
  s.line(s.front(0, pz, po), s.front(w, pz, po), "#9a8060", 2); s.line(s.front(0, pz, 2), s.front(w, pz, 2), "#9a8060", 1.6);
  for (let a = 4; a <= w; a += 16) s.line(s.front(a, pz, 2), s.front(a, pz, po + 3), "#9a8060", 1.3);
  const r = rnd(81); for (let k = 0; k < 140; k++) { const a = r() * w, o = 2 + r() * po; s.ellipse(s.front(a, pz + 1 + r() * 4, o), 3 + r() * 2.2, 2 + r() * 1.4, ["#6f8b4f", "#5d7a42", "#86a05f", "#4f6b39"][k % 4]!); }
  for (let k = 0; k < 9; k++) { const a = 10 + r() * (w - 20), o = 10 + r() * (po - 12); for (let g = 0; g < 6; g++) s.circle(s.front(a + (g % 2) * 1.6, pz - 2 - Math.floor(g / 2) * 2, o), 1.2, g % 2 ? "#5b2f4f" : "#733c63"); }
  roof(s, h, 91, CHIMNEYS.konoba);
}

/** Where each kind's chimneys stand along the lane, in the building's units. */
const CHIMNEYS: Record<Kind, number[]> = {
  stone: [HOUSES.stone.spec.w - 34], fisher: [HOUSES.fisher.spec.w - 30], townhouse: [14, HOUSES.townhouse.spec.w - 30], konoba: [HOUSES.konoba.spec.w - 32],
  shop: [HOUSES.shop.spec.w - 30], bakery: [18, HOUSES.bakery.spec.w - 34], smithy: [HOUSES.smithy.spec.w - 38], chandlery: [HOUSES.chandlery.spec.w - 30],
  fishhouse: [HOUSES.fishhouse.spec.w - 30], council: [HOUSES.council.spec.w - 30], chapel: [], mill: [], lighthouse: [],
};

/** A striped canvas awning over a shop front, sloping out from the wall, with a scalloped edge. */
function awning(s: Sheet, a0: number, a1: number, z: number, out: number, c1: string, c2: string) {
  const n = Math.max(2, Math.round((a1 - a0) / 7)); const at = (k: number) => a0 + ((a1 - a0) * k) / n;
  for (let k = 0; k < n; k++) s.poly([s.front(at(k), z, 0), s.front(at(k + 1), z, 0), s.front(at(k + 1), z - 12, out), s.front(at(k), z - 12, out)], k % 2 ? c1 : c2, "#6b5a45", 0.4);
  for (let k = 0; k < n; k++) s.poly([s.front(at(k), z - 12, out), s.front(at(k + 1), z - 12, out), s.front((at(k) + at(k + 1)) / 2, z - 17, out)], k % 2 ? c1 : c2, "#6b5a45", 0.4);
  s.poly([s.front(a1, z, 0), s.front(a1, z - 12, out), s.front(a1, z - 12, 0)], c2, "#6b5a45", 0.4); // the cheek at the open end
}
/** A string course: a band of dressed stone standing proud of the wall, across the front and the side. */
function course(s: Sheet, z: number) { const { w, d } = s.spec; s.poly(onPlane(s.front, rect(-1, z, w + 1, z + 5), 1.5), "#e7dfcd", MORTAR, 0.5); s.poly(onPlane(s.side, rect(-1, z, d + 1, z + 5), 1.5), "#d8d0bd", MORTAR, 0.5); }

function shop(s: Sheet, way: (typeof WAYS)[number], lit: boolean) {
  const { h } = HOUSES.shop.spec;
  roofBack(s, h, way.plaster, false); walls(s, h, way, 101, false, 10);
  window_(s, s.side, 24, 76, 16, 24, way, lit); window_(s, s.side, 56, 76, 16, 24, way, lit); window_(s, s.side, 40, 22, 14, 22, way, lit, false);
  // the shop front: a stone surround, a wide window of goods on shelves, a glazed door
  s.poly(onPlane(s.front, rect(10, 4, 96, 54)), "#e5ddca", MORTAR, 0.6);
  s.poly(onPlane(s.front, rect(14, 8, 60, 46), 0.2), lit ? LIT : GLASS);
  for (const z of [20, 33]) s.line(s.front(15, z, 0.3), s.front(59, z, 0.3), "#8a6f4e", 1.2);
  const r = rnd(103); for (let k = 0; k < 14; k++) { const a = 17 + (k % 7) * 6, z = k < 7 ? 21 : 34; s.poly(onPlane(s.front, rect(a, z, a + 4, z + 4 + r() * 4), 0.4), ["#c9a36a", "#9fb49a", "#d98d62", "#e8dcc0"][k % 4]!, "#5b4a36", 0.3); }
  s.poly(onPlane(s.front, rect(66, 4, 90, 50), 0.2), way.door, "#3d3226", 0.6); s.poly(onPlane(s.front, rect(69, 28, 87, 46), 0.3), lit ? LIT : GLASS); s.circle(s.front(86, 24, 0.5), 0.9, "#d2b27a");
  window_(s, s.front, 104, 18, 14, 26, way, lit);
  awning(s, 8, 98, 62, 16, "#efe6cf", way.shutter);
  s.poly(onPlane(s.front, rect(28, 66, 78, 75), 0.8), "#7a5a3c", "#4b3524", 0.5); s.poly(onPlane(s.front, rect(30, 67.5, 76, 73.5), 1), "#8f6a47");
  for (const a of [16, 57, 98]) window_(s, s.front, a, 84, 16, 22, way, lit);
  roof(s, h, 111, CHIMNEYS.shop);
}

function bakery(s: Sheet, way: (typeof WAYS)[number], lit: boolean) {
  const { h } = HOUSES.bakery.spec; const upper = { ...way, plaster: "#efe3c9" };
  roofBack(s, h, upper.plaster, false);
  s.poly(onPlane(s.side, rect(0, 50, s.spec.d, h)), upper.plaster, MORTAR, 0.5); s.poly(onPlane(s.front, rect(0, 50, s.spec.w, h)), upper.plaster, MORTAR, 0.5);
  stone(s, s.side, 0, s.spec.d, 0, 50, 121); stone(s, s.front, 0, s.spec.w, 0, 50, 122); quoins(s, s.front, s.spec.w, -1, 50, h); quoins(s, s.side, 0, 1, 50, h); course(s, 50);
  window_(s, s.side, 20, 72, 16, 24, way, lit);
  // the bread oven: a stone dome built against the side wall, its mouth dark, soot on the wall above
  const oven = s.side(64, 0, 16); s.ellipse([oven[0] - 4, oven[1] - 30], 16, 12, "#3a3530", 0.25);
  s.poly(Array.from({ length: 15 }, (_, k) => { const t = Math.PI * (k / 14); return [oven[0] - Math.cos(t) * 21, oven[1] - Math.sin(t) * 23] as Pt; }), "#d2c7b0", MORTAR, 0.6);
  for (let k = 1; k < 4; k++) s.path(Array.from({ length: 9 }, (_, i) => { const t = Math.PI * (i / 8); return [oven[0] - Math.cos(t) * 21 * (1 - k * 0.22), oven[1] - Math.sin(t) * 23 * (1 - k * 0.22)] as Pt; }), MORTAR, 0.5);
  s.poly(Array.from({ length: 9 }, (_, k) => { const t = Math.PI * (k / 8); return [oven[0] - 2 - Math.cos(t) * 6, oven[1] - Math.sin(t) * 8] as Pt; }), lit ? "#c9642f" : "#2e2a26");
  door(s, s.front, 16, 38, 44, way, true);
  s.poly(onPlane(s.front, rect(52, 8, 106, 44)), "#e8e0cd", MORTAR, 0.5); s.poly(onPlane(s.front, rect(55, 11, 103, 41), 0.2), lit ? LIT : GLASS);
  for (const z of [18, 30]) { s.line(s.front(56, z, 0.3), s.front(102, z, 0.3), "#8a6f4e", 1.1); for (let a = 58; a < 100; a += 6) s.ellipse(s.front(a + 2, z + 2.5, 0.4), 2.6, 1.6, "#c98b4a"); }
  awning(s, 50, 108, 52, 13, "#efe6cf", "#c4503f");
  // the bench where the morning's loaves are set out
  s.poly([s.front(58, 12, 13), s.front(100, 12, 13), s.front(100, 12, 19), s.front(58, 12, 19)], "#b49a73", "#7c6647", 0.5);
  s.poly(onPlane(s.front, rect(58, 10, 100, 12), 19), "#9a8060", "#7c6647", 0.4);
  for (const a of [60, 98]) s.line(s.front(a, 0, 17), s.front(a, 10, 17), "#7c6647", 1.3);
  for (const a of [16, 57, 98]) window_(s, s.front, a, 72, 16, 24, way, lit);
  roof(s, h, 131, CHIMNEYS.bakery);
}

function smithy(s: Sheet, way: (typeof WAYS)[number], lit: boolean) {
  const { h } = HOUSES.smithy.spec;
  roofBack(s, h, way.plaster, true); walls(s, h, way, 141, true);
  window_(s, s.side, 30, 40, 14, 18, way, lit, false);
  // a cart wheel leaning at the corner, waiting for its iron rim
  const wheel = s.side(8, 13, 3); s.out.push(`<ellipse cx="${f(wheel[0])}" cy="${f(wheel[1])}" rx="10" ry="12" fill="none" stroke="#7c6647" stroke-width="2"/>`);
  for (let k = 0; k < 6; k++) { const t = (k / 6) * Math.PI; s.line([wheel[0] - Math.cos(t) * 10, wheel[1] - Math.sin(t) * 12], [wheel[0] + Math.cos(t) * 10, wheel[1] + Math.sin(t) * 12], "#7c6647", 0.9); }
  // the wide arch, the forge glowing at the back of the dark
  s.poly(onPlane(s.front, arch(30, 102, 0, 32)), "#ddd3bd", MORTAR, 0.7); s.poly(onPlane(s.front, arch(34, 98, 0, 30), 0.2), "#2b2622");
  const glow = s.front(52, 12, -14); for (const [r, c, a] of [[22, "#6a2a14", 0.5], [13, "#b8461c", 0.6], [6, "#f39a3a", 0.85]] as const) s.ellipse(glow, r, r * 0.7, c, a);
  window_(s, s.front, 12, 40, 12, 18, way, lit, false);
  // the anvil on its stump, out in the light
  s.poly(onPlane(s.front, rect(72, 0, 82, 9), 26), "#6b4f37", "#3e2e20", 0.5);
  s.poly(onPlane(s.front, [[66, 9], [86, 9], [90, 12], [86, 14], [68, 14], [63, 12]], 26), "#3c3f40", "#1e2021", 0.6); s.line(s.front(67, 14, 26), s.front(86, 14, 26), "#8e9496", 0.9);
  // a horseshoe on a board by the door, for anyone who cannot read
  s.poly(onPlane(s.front, rect(108, 40, 124, 54), 0.8), "#8a6a48", "#4b3524", 0.5);
  s.path(onPlane(s.front, Array.from({ length: 9 }, (_, k) => { const t = Math.PI * 1.2 * (k / 8) - Math.PI * 0.1; return [116 + Math.cos(t) * 4.5, 46 + Math.sin(t) * 4.5] as [number, number]; }), 1.2), "#3c3f40", 1.6);
  roof(s, h, 151, CHIMNEYS.smithy);
}

function chandlery(s: Sheet, _: (typeof WAYS)[number], lit: boolean) {
  const way = WAYS[1]!; const { h } = HOUSES.chandlery.spec;
  roofBack(s, h, way.plaster, false); walls(s, h, way, 161, false, 10); course(s, 52); course(s, 102);
  for (const z of [64, 114]) { window_(s, s.side, 20, z, 14, 24, way, lit); window_(s, s.side, 48, z, 14, 24, way, lit); }
  door(s, s.front, 34, 56, 46, way, true);
  s.poly(onPlane(s.front, rect(66, 16, 86, 40)), "#e8e0cd", MORTAR, 0.5); s.poly(onPlane(s.front, rect(68, 18, 84, 38)), lit ? LIT : GLASS); for (let a = 71; a < 84; a += 4) s.line(s.front(a, 18, 1), s.front(a, 38, 1), "#2a2e2b", 0.9);
  // an anchor hung on the wall for a sign
  const A = (a: number, z: number) => s.front(a, z, 1.5);
  s.line(A(22, 62), A(22, 92), "#3c3f40", 2.2); s.circle(A(22, 94), 2.4, "none", "#3c3f40", 1.4); s.line(A(16, 88), A(28, 88), "#3c3f40", 1.8);
  s.path(Array.from({ length: 11 }, (_, k) => { const t = Math.PI * (k / 10); return A(22 - Math.cos(t) * 9, 66 - Math.sin(t) * 6); }), "#3c3f40", 2.2);
  s.poly([A(12, 67), A(14, 71), A(15.5, 65)], "#3c3f40"); s.poly([A(32, 67), A(30, 71), A(28.5, 65)], "#3c3f40");
  for (const a of [44, 74]) window_(s, s.front, a, 64, 14, 24, way, lit);
  for (const a of [14, 44, 74]) window_(s, s.front, a, 114, 14, 24, way, lit);
  roof(s, h, 171, CHIMNEYS.chandlery);
}

function fishhouse(s: Sheet, _: (typeof WAYS)[number], lit: boolean) {
  const way = { ...WAYS[0]!, plaster: "#f0ebdf", shutter: "#4a7ea3" }; const { w, d, h } = HOUSES.fishhouse.spec;
  roofBack(s, h, way.plaster, false); walls(s, h, way, 181, false, 10);
  window_(s, s.side, 28, 52, 14, 20, way, lit); window_(s, s.side, 58, 18, 12, 16, way, lit, false);
  // the loggia: three arches over a stone counter where the catch is laid out
  for (const [a0, a1] of [[8, 42], [46, 80], [84, 118]] as const) { s.poly(onPlane(s.front, arch(a0 - 3, a1 + 3, 0, 24)), "#e0d7c3", MORTAR, 0.6); s.poly(onPlane(s.front, arch(a0, a1, 0, 22), 0.2), "#3a3f3d"); }
  s.poly(onPlane(s.front, rect(6, 0, 120, 15), 1), "#ddd4c0", MORTAR, 0.6); s.poly([s.front(6, 15, 1), s.front(120, 15, 1), s.front(120, 15, -8), s.front(6, 15, -8)], "#ebe4d4", MORTAR, 0.5);
  const r = rnd(183); for (let k = 0; k < 9; k++) { const c = s.front(14 + k * 11 + r() * 4, 15.5, -3); s.ellipse(c, 4.2, 1.5, k % 3 ? "#9fb0b3" : "#b9c6c7"); s.poly([[c[0] + 3.8, c[1]], [c[0] + 6.4, c[1] - 1.6], [c[0] + 6.4, c[1] + 1.6]], "#8a9b9f"); }
  for (const a of [16, 58, 100]) window_(s, s.front, a, 54, 14, 20, way, lit);
  roof(s, h, 191, CHIMNEYS.fishhouse);
  // a fish turning on the ridge
  const top = s.q(w / 2, d / 2, h + 40); s.line(top, [top[0], top[1] - 16], "#3c3f40", 1.2);
  s.poly([[top[0] - 9, top[1] - 16], [top[0] + 5, top[1] - 19], [top[0] + 9, top[1] - 16], [top[0] + 5, top[1] - 13]], "#3c3f40"); s.poly([[top[0] - 9, top[1] - 16], [top[0] - 13, top[1] - 19], [top[0] - 13, top[1] - 13]], "#3c3f40");
}

function council(s: Sheet, way: (typeof WAYS)[number], lit: boolean) {
  const { w, d, h } = HOUSES.council.spec; const q = s.q;
  roofBack(s, h, way.plaster, true); walls(s, h, way, 201, true); course(s, 64);
  // the loggia: arches on the lane and along the side, open to the square
  for (const [p, spans] of [[s.front, [[10, 44], [50, 84], [90, 124], [130, 164]]], [s.side, [[14, 50], [64, 100]]]] as const) for (const [a0, a1] of spans) {
    s.poly(onPlane(p, arch(a0 - 3, a1 + 3, 0, 38)), "#ebe4d2", MORTAR, 0.7); s.poly(onPlane(p, arch(a0, a1, 0, 36), 0.2), lit ? "#6a5238" : "#4e483f");
  }
  s.poly(onPlane(s.front, [[82, 54], [92, 54], [92, 60], [87, 63], [82, 60]], 1), "#d8cfb9", MORTAR, 0.5); s.line(s.front(87, 54, 1.2), s.front(87, 62, 1.2), "#c4503f", 1.2);
  // paired windows under their arches, a column between the lights
  for (const a of [14, 54, 94, 134]) {
    s.poly(onPlane(s.front, rect(a - 2, 82, a + 28, 128)), "#e8e0cd", MORTAR, 0.5);
    for (const b of [a + 2, a + 14]) s.poly(onPlane(s.front, arch(b, b + 10, 84, 114), 0.2), lit ? LIT : GLASS);
    s.line(s.front(a + 13, 84, 0.6), s.front(a + 13, 118, 0.6), "#e8e0cd", 2);
  }
  for (const a of [22, 70]) { s.poly(onPlane(s.side, rect(a - 2, 82, a + 22, 128)), "#e2d9c6", MORTAR, 0.5); s.poly(onPlane(s.side, arch(a, a + 20, 84, 114), 0.2), lit ? LIT : GLASS); }
  // the clock
  const clock = s.front(87, 148, 1); s.ellipse(clock, 9, 9.5, "#f2ecdc"); s.out.push(`<ellipse cx="${f(clock[0])}" cy="${f(clock[1])}" rx="9" ry="9.5" fill="none" stroke="#8f8570" stroke-width="1"/>`);
  s.line(clock, [clock[0], clock[1] - 6], "#2a2a2a", 1); s.line(clock, [clock[0] + 4, clock[1] + 1.5], "#2a2a2a", 1);
  roof(s, h, 211, CHIMNEYS.council);
  // the bell-cote on the ridge, and a pennant
  const bc = (i: number, z: number) => q(w / 2 + i, d / 2, h + 40 + z);
  s.poly([bc(-12, -4), bc(12, -4), bc(12, 26), bc(0, 36), bc(-12, 26)], "#ddd5c1", MORTAR, 0.6);
  s.poly(Array.from({ length: 11 }, (_, k) => { const t = Math.PI * (k / 10); return bc(-Math.cos(t) * 6, 14 + Math.sin(t) * 6); }).concat([bc(6, 2), bc(-6, 2)]), "#2e2c28");
  const bell = bc(0, 12); s.poly([[bell[0] - 4, bell[1] + 3], [bell[0] + 4, bell[1] + 3], [bell[0] + 2.5, bell[1] - 4], [bell[0] - 2.5, bell[1] - 4]], "#c3a474");
  const pole = q(w - 12, d / 2, h + 40); s.line(pole, [pole[0], pole[1] - 42], "#6b5a45", 1.3); s.poly([[pole[0], pole[1] - 42], [pole[0] + 18, pole[1] - 38], [pole[0], pole[1] - 33]], "#c4503f");
}

function chapel(s: Sheet, way: (typeof WAYS)[number], lit: boolean) {
  const { d, h } = HOUSES.chapel.spec;
  roofBack(s, h, way.plaster, true, true); walls(s, h, way, 221, true);
  for (const a of [30, 72]) { s.poly(onPlane(s.front, arch(a - 2, a + 10, 40, 60)), "#e8e0cd", MORTAR, 0.5); s.poly(onPlane(s.front, arch(a, a + 8, 42, 60), 0.2), lit ? LIT : GLASS); }
  // the door in the gable end under its lunette, a step before it
  s.poly(onPlane(s.side, rect(22, 0, 56, 3), 6), "#e3dbc9", MORTAR, 0.5);
  s.poly(onPlane(s.side, arch(24, 54, 0, 40)), "#e8e0cd", MORTAR, 0.6); s.poly(onPlane(s.side, rect(28, 0, 50, 40), 0.2), "#5a4636", "#3d3226", 0.5);
  s.poly(onPlane(s.side, arch(28, 50, 40, 40), 0.2), "#cfc4ad", MORTAR, 0.4);
  // the rose window high in the gable
  const rose = s.side(d / 2, h + 16, 7.5); s.ellipse(rose, 7, 7.6, "#e8e0cd"); s.ellipse(rose, 5, 5.5, lit ? LIT : GLASS);
  for (let k = 0; k < 8; k++) { const t = (k / 8) * Math.PI * 2; s.line(rose, [rose[0] + Math.cos(t) * 5, rose[1] + Math.sin(t) * 5.5], "#e8e0cd", 0.7); }
  roof(s, h, 231, CHIMNEYS.chapel, true);
  // the bell-gable on the apex, open where the bell hangs
  const g = (a: number, z: number) => s.side(a, h + 40 + z, 7);
  s.poly([g(d / 2 - 12, -6), g(d / 2 + 12, -6), g(d / 2 + 12, 26), g(d / 2, 36), g(d / 2 - 12, 26)], "#ddd5c1", MORTAR, 0.6);
  s.poly(Array.from({ length: 11 }, (_, k) => { const t = Math.PI * (k / 10); return g(d / 2 - Math.cos(t) * 6, 14 + Math.sin(t) * 6); }).concat([g(d / 2 + 6, 3), g(d / 2 - 6, 3)]), "#2e2c28");
  const cross = g(d / 2, 36); s.line(cross, [cross[0], cross[1] - 10], "#5b5446", 1.4); s.line([cross[0] - 3.5, cross[1] - 7], [cross[0] + 3.5, cross[1] - 7], "#5b5446", 1.4);
}

/** The square towers' roof: a pyramid of tiles over a small overhang. */
function pyramid(s: Sheet, h: number, rise: number) {
  const { w, d } = s.spec; const q = s.q; const o = 6; const apex = q(w / 2, d / 2, h + rise);
  const e = [q(-o, d + o, h), q(w + o, d + o, h), q(w + o, -o, h)];
  s.poly([e[1]!, e[2]!, apex], "#a9543a", TILE_DARK, 0.6); s.poly([e[0]!, e[1]!, apex], TILE, TILE_DARK, 0.6);
  for (let k = 1; k < 8; k++) { const t = k / 8; s.line([e[0]![0] + (e[1]![0] - e[0]![0]) * t, e[0]![1] + (e[1]![1] - e[0]![1]) * t], apex, TILE_CLAY_LIGHT, 1.4, 0.8); s.line([e[1]![0] + (e[2]![0] - e[1]![0]) * t, e[1]![1] + (e[2]![1] - e[1]![1]) * t], apex, "#c46e4b", 1.2, 0.7); }
  s.line(e[1]!, apex, "#a8563a", 2.4); s.circle(apex, 2.6, "#c46e4b", TILE_DARK, 0.5);
}

function mill(s: Sheet, way: (typeof WAYS)[number], lit: boolean) {
  const { h } = HOUSES.mill.spec;
  walls(s, h, way, 241, true);
  door(s, s.front, 22, 42, 34, way, true);
  for (const z of [70, 112]) { window_(s, s.front, 26, z, 10, 14, way, lit, false); window_(s, s.side, 28, z - 20, 10, 14, way, lit, false); }
  s.poly(onPlane(s.front, rect(22, 116, 42, 136), 0.4), "#6b5a45", "#3e2e20", 0.5); // the hub's timber seat
  pyramid(s, h, 46);
}

function lighthouse(s: Sheet, way: (typeof WAYS)[number], lit: boolean) {
  const { w, d, h } = HOUSES.lighthouse.spec; const q = s.q; const white = { ...way, plaster: "#f3f0e7" };
  walls(s, h, white, 251, false, 14);
  door(s, s.front, 16, 34, 36, way, true);
  for (const [p, a, z] of [[s.front, 20, 76], [s.side, 22, 110], [s.front, 20, 140]] as const) window_(s, p, a, z, 10, 16, way, lit, false);
  // the gallery: a stone slab with a rail
  const o = 7; s.poly([q(-o, d + o, h - 4), q(w + o, d + o, h - 4), q(w + o, d + o, h), q(-o, d + o, h)], "#cfc6b2", MORTAR, 0.5);
  s.poly([q(w + o, d + o, h - 4), q(w + o, -o, h - 4), q(w + o, -o, h), q(w + o, d + o, h)], "#bdb49f", MORTAR, 0.5);
  s.poly([q(-o, d + o, h), q(w + o, d + o, h), q(w + o, -o, h), q(-o, -o, h)], "#e4dccb", MORTAR, 0.5);
  // the lantern, glazed all round, under a red cap
  const i0 = 12, i1 = w - 12, lh = 30;
  s.poly([q(i0, i1, h), q(i1, i1, h), q(i1, i1, h + lh), q(i0, i1, h + lh)], lit ? "#ffe28a" : "#f2e3a8", "#5d5a50", 0.6);
  s.poly([q(i1, i1, h), q(i1, i0, h), q(i1, i0, h + lh), q(i1, i1, h + lh)], lit ? "#f5cf6a" : "#dccc8f", "#5d5a50", 0.6);
  for (let t = 1; t < 3; t++) { const a = i0 + ((i1 - i0) * t) / 3; s.line(q(a, i1, h), q(a, i1, h + lh), "#5d5a50", 0.8); s.line(q(i1, a, h), q(i1, a, h + lh), "#5d5a50", 0.8); }
  const capo = 3; const apex = q(w / 2, d / 2, h + lh + 18);
  s.poly([q(i1 + capo, i1 + capo, h + lh), q(i1 + capo, i0 - capo, h + lh), apex], "#8f3b2a", "#5e2519", 0.5); s.poly([q(i0 - capo, i1 + capo, h + lh), q(i1 + capo, i1 + capo, h + lh), apex], "#b5523c", "#5e2519", 0.5);
  s.circle(apex, 2.2, "#3c3f40"); s.line(apex, [apex[0], apex[1] - 8], "#3c3f40", 1);
  // the rail, in front of the lantern
  for (const [a0, b0, a1, b1] of [[-o, d + o, w + o, d + o], [w + o, d + o, w + o, -o]] as const) { s.line(q(a0, b0, h + 9), q(a1, b1, h + 9), "#3c3f40", 1); for (let t = 0; t <= 6; t++) { const a = a0 + ((a1 - a0) * t) / 6, b = b0 + ((b1 - b0) * t) / 6; s.line(q(a, b, h), q(a, b, h + 9), "#3c3f40", 0.8); } }
}

const DRAW: Record<Kind, (s: Sheet, way: (typeof WAYS)[number], lit: boolean) => void> = { stone: stoneHouse, fisher: fisherCottage, townhouse: townHouse, konoba, shop, bakery, smithy, chandlery, fishhouse, council, chapel, mill, lighthouse };

/** One house as a finished SVG and the box it fills in the building's units. */
export function houseSvg(kind: Kind, variant: number, lit: boolean): { svg: string; x: number; y: number; width: number; height: number } {
  const s = new Sheet(HOUSES[kind].spec); DRAW[kind](s, WAYS[variant % WAYS.length]!, lit);
  const pad = 6; const x = Math.floor(s.x0 - pad), y = Math.floor(s.y0 - pad), width = Math.ceil(s.x1 - s.x0 + pad * 2), height = Math.ceil(s.y1 - s.y0 + pad * 2);
  return { svg: s.out.join(""), x, y, width, height };
}

/** The atlas name of a kind in a colourway: dal-stone, dal-stone2, dal-stone3; kinds drawn in one colourway have only the first. */
export const atlasName = (kind: Kind, variant: number) => { const v = variant % HOUSES[kind].ways; return `dal-${kind}${v ? String(v + 1) : ""}`; };

/**
 * Which building stands where the town has each of its drawings. `variant` null means a colourway chosen by the place's
 * position, so a row of houses is never one house repeated.
 */
export const DALMATIAN_FOR: Record<string, { kind: Kind; variant: number | null }> = {
  house: { kind: "stone", variant: null }, cottage: { kind: "fisher", variant: null }, shop: { kind: "shop", variant: null },
  inn: { kind: "townhouse", variant: 0 }, tavern: { kind: "konoba", variant: 0 }, "harbor-office": { kind: "townhouse", variant: 2 }, boatshed: { kind: "fisher", variant: 2 },
  bakery: { kind: "bakery", variant: 0 }, smithy: { kind: "smithy", variant: 0 }, chandlery: { kind: "chandlery", variant: 0 }, fishhouse: { kind: "fishhouse", variant: 0 },
  council: { kind: "council", variant: 0 }, chapel: { kind: "chapel", variant: 0 }, mill: { kind: "mill", variant: 0 }, lighthouse: { kind: "lighthouse", variant: 0 },
};
/** The same projection outside a drawing, for things the town lays on a building: its smoke, its stock, its bell. */
export function isoOf(kind: Kind) { const { w, d } = HOUSES[kind].spec; return (i: number, j: number, k: number): [number, number] => [0.72 * ((i - j) * 0.95 - (w - d) * 0.95), 0.72 * ((i + j) * 0.44 - k - (w + d) * 0.44)]; }
/** Where the town sets out a building's stock: the bakery's bench, the chandlery's doorstep, the fish house's counter, the mill's foot. */
export function stockAt(kind: Kind): [number, number] | null {
  const q = isoOf(kind); const { w, d } = HOUSES[kind].spec;
  if (kind === "bakery") return q(79, d + 16, 12);
  if (kind === "chandlery") return q(80, d + 14, 0);
  if (kind === "fishhouse") return q(62, d + 18, 0);
  if (kind === "mill") return q(w + 26, d - 10, 0);
  return null;
}
/** The forge's anvil, where sparks fly while the smith works. */
export const forgeAt = (): [number, number] => isoOf("smithy")(76, HOUSES.smithy.spec.d + 26, 14);
/** The chapel's bell, in its gable. */
export const bellAt = (): [number, number] => { const { w, d, h } = HOUSES.chapel.spec; return isoOf("chapel")(w + 7, d / 2, h + 40 + 14); };
/** The hub the mill's sails turn on. */
export const sailsAt = (): [number, number] => { const { w, d, h } = HOUSES.mill.spec; return isoOf("mill")(w / 2, d + 1, h - 24); };
/** The light in the lighthouse's lantern. */
export const lanternAt = (): [number, number] => { const { w, d, h } = HOUSES.lighthouse.spec; return isoOf("lighthouse")(w / 2, d / 2, h + 15); };

/** Where smoke leaves a kind's chimney, in the drawing's own units: the top of the last chimney, over its cap. */
export function chimneyTop(kind: Kind): [number, number] {
  const { w, d, h } = HOUSES[kind].spec; const ci = CHIMNEYS[kind][CHIMNEYS[kind].length - 1];
  if (ci === undefined) return isoOf(kind)(w / 2, d / 2, h + (HOUSES[kind].tower ? 46 : 40)); // no chimney: the top of the roof
  return isoOf(kind)(ci + 7, 12, h + 40 + 22 + 8);
}

/**
 * The light masks' source: every surface of the house by the way it faces, red toward the lane, green along it, blue to the sky,
 * painted in the drawing's own order and on the drawing's own geometry, stair and chimneys included. The generator splits it
 * into the three masks the town's sunlight reads.
 */
export function houseFacesSvg(kind: Kind): string {
  const spec = HOUSES[kind].spec; const s = new Sheet(spec); const { w, d, h } = spec; const q = s.q; const RISE = 40;
  const R = "#ff0000", G = "#00ff00", B = "#0000ff"; const F = (pts: Pt[], c: string) => s.poly(pts, c, c, 0.8);
  if (HOUSES[kind].tower) {
    // a tower: its two walls and the roof above them, pyramid or lantern cap
    F(onPlane(s.side, rect(0, 0, d, h)), G); F(onPlane(s.front, rect(0, 0, w, h)), R);
    const rise = kind === "mill" ? 46 : 48, o = 6, apex = q(w / 2, d / 2, h + rise);
    F([q(w + o, d + o, h), q(w + o, -o, h), apex], B); F([q(-o, d + o, h), q(w + o, d + o, h), apex], B);
    return s.out.join("");
  }
  F([q(-7, -6, h), q(w + 7, -6, h), q(w + 7, d / 2, h + RISE), q(-7, d / 2, h + RISE)], B);
  F(onPlane(s.side, rect(0, 0, d, h)), G); F(onPlane(s.front, rect(0, 0, w, h)), R);
  if (kind === "stone") {
    // the balatura: its outer face and the end of the landing face the lane and along it; its treads face the sky
    const out = 17, land = 62, a0 = 44, aStair = 82, aEnd = 116, steps = 8;
    const profile: [number, number][] = [[a0, 0]]; for (let k = 0; k < steps; k++) { const a = a0 + ((aStair - a0) * k) / steps, z = (land * (k + 1)) / steps; profile.push([a, z], [a + (aStair - a0) / steps, z]); }
    profile.push([aEnd, land], [aEnd, 0]); F(onPlane(s.front, profile, out), R);
    F([s.front(aStair, land, 0), s.front(aEnd, land, 0), s.front(aEnd, land, out), s.front(aStair, land, out)], B);
    F([q(aEnd, d, 0), q(aEnd, d + out, 0), q(aEnd, d + out, land), q(aEnd, d, land)], G);
  }
  F([q(w + 7, -6, h), q(w + 7, d + 6, h), q(w + 7, d / 2, h + RISE)], G);
  F([q(-7, d + 6, h), q(w + 7, d + 6, h), q(w + 7, d / 2, h + RISE), q(-7, d / 2, h + RISE)], B);
  for (const c0 of CHIMNEYS[kind]) {
    const c1 = c0 + 14, j0 = 6, j1 = 18, top = h + RISE + 22;
    F([q(c0, j1, h + 10), q(c1, j1, h + 10), q(c1, j1, top), q(c0, j1, top)], R);
    F([q(c1, j1, h + 10), q(c1, j0, h + 10), q(c1, j0, top), q(c1, j1, top)], G);
    F([q(c0 - 2, j1 + 2, top), q(c1 + 2, j1 + 2, top), q(c1 + 2, (j0 + j1) / 2, top + 7), q(c0 - 2, (j0 + j1) / 2, top + 7)], B);
  }
  return s.out.join("");
}
