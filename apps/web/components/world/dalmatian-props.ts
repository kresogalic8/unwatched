/**
 * The square's and the harbour's small things in the same Dalmatian hand as the houses: a stone well with its pulley, a market
 * stall under a striped awning, stone benches, iron lamps, a konoba's bistro tables, a stone quay with bollards, a passenger
 * boat, a pasara, nets on their rack and karst rocks. Drawn in each prop's own frame, the origin at its foot, at the size the
 * street places it, and keeping every point the town hangs something on: seats, the stall's counter, the lamp's light, the
 * quay's bollards and edge, the boat's deck. scripts/gen-harbor.tsx rasterizes them as dal-<name>.
 */
type Pt = [number, number];
const f = (n: number) => n.toFixed(2);
const STONES = ["#d8cfbb", "#cdc3ad", "#ddd5c3", "#c6bca5", "#d3c9b2", "#e0d8c6"];
const MORTAR = "#a89e87", IRON = "#34393a", IRON_LIGHT = "#5c6566", OAK = "#8a6440", OAK_LIGHT = "#b08a5c", CLAY = "#b86b4b";

function rnd(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/** the town's projection at the atlas's scale, for props with depth: u along the lane, v across it, z up */
const iso = (u: number, v: number, z = 0): Pt => [(u - v) * 0.684, (u + v) * 0.317 - z * 0.72];

class Draw {
  out: string[] = [];
  poly(pts: Pt[], fill: string, stroke = "none", sw = 0.6, op = 1) { this.out.push(`<polygon points="${pts.map((p) => `${f(p[0])},${f(p[1])}`).join(" ")}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" opacity="${op}"/>`); return this; }
  path(d: string, fill: string, stroke = "none", sw = 0.8, op = 1) { this.out.push(`<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" opacity="${op}"/>`); return this; }
  line(a: Pt, b: Pt, color: string, w = 0.8, op = 1) { return this.path(`M${f(a[0])} ${f(a[1])}L${f(b[0])} ${f(b[1])}`, "none", color, w, op); }
  ellipse(c: Pt, rx: number, ry: number, fill: string, stroke = "none", sw = 0.6, op = 1) { this.out.push(`<ellipse cx="${f(c[0])}" cy="${f(c[1])}" rx="${f(rx)}" ry="${f(ry)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" opacity="${op}"/>`); return this; }
  circle(c: Pt, r: number, fill: string, stroke = "none", sw = 0.5) { return this.ellipse(c, r, r, fill, stroke, sw); }
  shadow(cx: number, cy: number, rx: number, ry: number, op = 0.16) { return this.ellipse([cx, cy], rx, ry, "#4a5a48", "none", 0, op); }
  svg() { return this.out.join(""); }
}
const pts = (xs: number[]): Pt[] => { const r: Pt[] = []; for (let i = 0; i < xs.length; i += 2) r.push([xs[i]!, xs[i + 1]!]); return r; };
/** Geraniums: leaves in two greens, red and pink heads above them. */
function geraniums(d: Draw, cx: number, cy: number, w: number, seed: number) {
  const r = rnd(seed); for (let k = 0; k < 16; k++) d.ellipse([cx + (r() - 0.5) * w, cy - r() * w * 0.35], 3.2, 2.2, k % 3 ? "#6d8a52" : "#58743f");
  for (let k = 0; k < 9; k++) { const c: Pt = [cx + (r() - 0.5) * w * 0.9, cy - 4 - r() * w * 0.4]; d.circle(c, 1.9, k % 3 ? "#d0443c" : "#e8706a"); d.circle([c[0] + 1.2, c[1] - 0.8], 1.3, k % 2 ? "#e0584e" : "#f08a82"); }
}

/** The well: a round stone curb in coursed blocks, two stone posts and a beam with the pulley, a bucket on its rope. */
function well(d: Draw) {
  const r = rnd(301); d.shadow(6, 2, 34, 11);
  d.ellipse([0, -2], 27, 12, "#b9ae96");
  d.path("M-27 -26V-2Q0 13 27 -2V-26Q0 -12 -27 -26Z", STONES[0]!, MORTAR, 0.7);
  for (let row = 0; row < 3; row++) { const y0 = -26 + row * 8; d.path(`M-27 ${y0 + 8}Q0 ${y0 + 21} 27 ${y0 + 8}`, "none", MORTAR, 0.5); for (let k = 0; k < 7; k++) { const a = ((k + (row % 2) * 0.5) / 7) * Math.PI; const x = -Math.cos(a) * 27; d.line([x, y0 + Math.sin(a) * 13 + 0.4], [x, y0 + 8 + Math.sin(a) * 13 - 0.4], MORTAR, 0.5); } for (let k = 0; k < 6; k++) { const a = ((k + 0.5 + (row % 2) * 0.5) / 7) * Math.PI; d.ellipse([-Math.cos(a) * 25, y0 + 4 + Math.sin(a) * 12], 3.5, 2.2, STONES[Math.floor(r() * STONES.length)]!, "none", 0, 0.7); } }
  d.ellipse([0, -26], 28, 13, "#e8e0cd", MORTAR, 0.7); d.ellipse([0, -26], 21, 9, "#3b4847"); d.ellipse([-3, -24], 12, 4, "#5e7a78", "none", 0, 0.6);
  // the posts and the beam, the pulley wheel and the rope
  for (const x of [-22, 22]) { d.poly(pts([x - 4, -22, x + 4, -20, x + 4, -80, x - 4, -82]), x < 0 ? "#ddd5c1" : "#c8bea8", MORTAR, 0.6); for (let y = -30; y > -80; y -= 9) d.line([x - 4, y + (x < 0 ? -0.3 : 0.3)], [x + 4, y], MORTAR, 0.45); }
  d.poly(pts([-28, -82, 28, -80, 28, -87, -28, -89]), "#e5ddca", MORTAR, 0.6);
  d.circle([0, -76], 5, "none", IRON, 1.6); d.circle([0, -76], 1.4, IRON); d.line([0, -76], [0, -84], IRON, 1.4);
  d.line([4.5, -76], [4.5, -40], "#c9b489", 0.9); d.line([-4.5, -76], [-4.5, -48], "#c9b489", 0.9);
  d.path("M-2 -40H11L9.5 -29H-0.5Z", OAK, "#5c4128", 0.6); d.path("M-2 -40Q4.5 -48 11 -40", "none", IRON, 1); d.line([-1.5, -36], [10.5, -36], IRON, 0.8);
  geraniums(d, -18, -27, 12, 3);
}

/** The market stall: a plank counter (where the town lays out the stock), a striped awning on four posts, baskets beneath. */
function stall(d: Draw) {
  d.shadow(12, 6, 70, 16);
  const posts: [number, number][] = [[-50, -10], [45, 2], [72, -15], [-22, -27]];
  for (const [x, y] of [posts[3]!, posts[2]!]) d.line([x, y], [x, y - 62], "#8a6f4e", 3.4);
  // baskets under the counter, half in its shade
  for (const [x, y, c] of [[-30, -6, "#c79a5b"], [2, -2, "#b88a4f"], [30, -4, "#c79a5b"]] as const) { d.ellipse([x, y], 11, 4.5, "#7a5a36"); d.path(`M${x - 11} ${y}Q${x} ${y + 12} ${x + 11} ${y}V${y - 6}H${x - 11}Z`, c, "#6b5033", 0.6); d.ellipse([x, y - 6], 11, 4.5, "#e4b04a"); for (let k = 0; k < 4; k++) d.circle([x - 6 + k * 4, y - 7], 1.8, k % 2 ? "#e8c24d" : "#d99a3a"); }
  // the counter: top, front and end, in planks
  d.poly(pts([-50, -10, 45, 2, 45, 19, -50, 7]), "#9c7a52", "#6b5033", 0.7); for (let k = 1; k < 9; k++) { const x = -50 + k * 10.5; d.line([x, -10 + k * 1.33], [x, 7 + k * 1.33], "#6b5033", 0.5, 0.7); }
  d.poly(pts([45, 2, 72, -15, 72, 2, 45, 19]), "#86673f", "#6b5033", 0.7);
  d.poly(pts([-50, -10, 45, 2, 72, -15, -22, -27]), "#c9a878", "#7e6140", 0.8);
  for (let k = 1; k < 5; k++) { const t = k / 5; d.line([-50 + 28 * t, -10 - 17 * t], [45 + 27 * t, 2 - 17 * t], "#9c7e55", 0.6, 0.8); }
  for (const [x, y] of [posts[0]!, posts[1]!]) d.line([x, y + 6], [x, y - 62], "#8a6f4e", 3.4);
  // the awning: a striped canvas pitched from the back posts to the front, with a scalloped valance
  const B0: Pt = [-22, -97], B1: Pt = [72, -85], F0: Pt = [-56, -70], F1: Pt = [45, -58]; const n = 9;
  for (let k = 0; k < n; k++) { const a = k / n, b = (k + 1) / n; const L = (p: Pt, q: Pt, t: number): Pt => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]; d.poly([L(B0, B1, a), L(B0, B1, b), L(F0, F1, b), L(F0, F1, a)], k % 2 ? "#f2e9d3" : "#c4503f", "#8a4a36", 0.5); d.poly([L(F0, F1, a), L(F0, F1, b), [(L(F0, F1, a)[0] + L(F0, F1, b)[0]) / 2, (L(F0, F1, a)[1] + L(F0, F1, b)[1]) / 2 + 6]], k % 2 ? "#f2e9d3" : "#c4503f", "#8a4a36", 0.5); }
  d.line(F0, F1, "#8a4a36", 1);
}

/** A stone bench: a dressed slab on two blocks, worn smooth where people sit. The seat is where the town seats them. */
function bench(d: Draw) {
  d.shadow(4, 2, 36, 7, 0.18);
  for (const x of [-24, 20]) { d.poly(pts([x - 5, -7, x + 5, -6, x + 5, 1, x - 5, 0]), "#c9bfa8", MORTAR, 0.6); d.poly(pts([x + 5, -6, x + 9, -8, x + 9, -1, x + 5, 1]), "#b3a990", MORTAR, 0.6); }
  d.poly(pts([-33, -11, 31, -10, 31, -6, -33, -7]), "#d6ccb6", MORTAR, 0.7);
  d.poly(pts([31, -10, 37, -13, 37, -9, 31, -6]), "#bfb59e", MORTAR, 0.6);
  d.poly(pts([-33, -11, 31, -10, 37, -13, -27, -14]), "#e8e0cd", MORTAR, 0.7);
  d.path("M-20 -12.2Q-6 -13.4 8 -12.2M12 -12.4Q20 -13 26 -12", "none", "#f5efe2", 1, 0.8);
}

/** An iron lamp: a fluted post on a stepped base, a curled arm, the lantern hanging where the town's light comes from. */
function lamp(d: Draw, lit: boolean) {
  d.shadow(8, 1, 14, 4);
  d.path("M-5 0H5L4 -4H-4Z", IRON, IRON, 0.6); d.path("M-3.4 -4H3.4L2.4 -10H-2.4Z", IRON_LIGHT, IRON, 0.5);
  d.line([0, -10], [0, -76], IRON, 3); d.line([-0.8, -12], [-0.8, -74], IRON_LIGHT, 0.7, 0.7);
  d.path("M0 -74Q0 -83 9 -83Q15 -83 14 -77", "none", IRON, 2); d.path("M0 -64Q6 -64 8 -70Q9 -74 5 -75", "none", IRON, 1.2);
  // the lantern: a little roof, four panes, a finial
  d.path("M8 -66H20L18 -52H10Z", lit ? "#f8d18d" : "#e8e2c4", IRON, 1); d.line([14, -66], [14, -52], IRON, 0.8); d.line([9.2, -59], [18.8, -59], IRON, 0.5, 0.6);
  d.path("M7 -66L14 -72L21 -66Z", IRON, IRON, 0.6); d.circle([14, -73.5], 1.3, IRON); d.path("M10 -52H18L16 -49H12Z", IRON, IRON, 0.5);
  if (!lit) d.path("M10 -64L12 -54", "none", "#ffffff", 0.8, 0.5);
}

/** A terracotta planter of geraniums. */
function planter(d: Draw) {
  d.shadow(2, 2, 16, 5);
  d.path("M-12 -14L-9 0Q0 4 9 0L12 -14Z", CLAY, "#7e4a35", 0.7); d.ellipse([0, -14], 13, 4.5, "#c98463", "#7e4a35", 0.6); d.ellipse([0, -14], 10, 3.2, "#5b4a38");
  d.path("M-10.5 -8Q0 -5 10.5 -8", "none", "#9d5a40", 0.8, 0.8); d.path("M-8 -12L-6.5 -2", "none", "#d99a7a", 0.9, 0.6);
  geraniums(d, 0, -16, 26, 7);
}

/** An oak barrel on its end: staves, three iron hoops, the lid with its bung. */
function barrel(d: Draw) {
  d.shadow(2, 1, 13, 4);
  d.path("M-10 -24Q-14 -12 -10 0Q0 4 10 0Q14 -12 10 -24Z", OAK, "#4f3620", 0.8);
  for (const x of [-6, -2, 2, 6]) d.path(`M${x} -23Q${x * 1.25} -12 ${x} 1`, "none", "#5c4128", 0.5, 0.7);
  d.path("M-8 -20Q-11 -12 -8 -3", "none", OAK_LIGHT, 1.4, 0.7);
  for (const y of [-19, -12, -4]) d.path(`M${-10.5 - (y === -12 ? 2.4 : 0.8)} ${y}Q0 ${y + 4} ${10.5 + (y === -12 ? 2.4 : 0.8)} ${y}`, "none", IRON, 1.5);
  d.ellipse([0, -24], 10, 3.8, "#a47c52", "#4f3620", 0.7); d.ellipse([0, -24], 8, 2.8, "none", "#6b4a2e", 0.5); d.circle([3, -24], 1, "#3b2a1c");
}

/** Stacked slatted crates, the top one open and full of lemons. */
function crates(d: Draw) {
  d.shadow(4, 3, 30, 8);
  const crate = (x: number, y: number, s: number, lemons: boolean) => {
    const P = (u: number, v: number, z: number): Pt => { const p = iso(u * s, v * s, z * s); return [x + p[0], y + p[1]]; };
    d.poly([P(0, 22, 0), P(30, 22, 0), P(30, 22, 18), P(0, 22, 18)], "#b08a5c", "#6b5033", 0.6); for (const z of [6, 12]) d.line(P(0, 22, z), P(30, 22, z), "#6b5033", 0.8);
    d.poly([P(30, 22, 0), P(30, 0, 0), P(30, 0, 18), P(30, 22, 18)], "#9a764a", "#6b5033", 0.6); for (const z of [6, 12]) d.line(P(30, 22, z), P(30, 0, z), "#6b5033", 0.8);
    d.poly([P(0, 0, 18), P(30, 0, 18), P(30, 22, 18), P(0, 22, 18)], lemons ? "#5b4a38" : "#c9a878", "#6b5033", 0.6);
    if (lemons) { const r = rnd(Math.round(x * 7 + y)); for (let k = 0; k < 16; k++) { const c = P(3 + r() * 24, 3 + r() * 16, 18.5); d.ellipse(c, 2.6 * s, 2 * s, k % 5 ? "#e9c53e" : "#9aa352", "#b0902a", 0.4); } }
    else for (let k = 1; k < 4; k++) d.line(P(0, (22 * k) / 4, 18), P(30, (22 * k) / 4, 18), "#9c7e55", 0.6);
  };
  crate(-28, -2, 1, false); crate(6, 6, 0.9, false); crate(-27, -15, 0.85, true); // the lemons sit on the big crate
}

/** A bistro table outside the konoba: marble on an iron foot, two chairs with rush seats, a cup and a jar of rosemary. Seats at ±27. */
function terrace(d: Draw, parasol: boolean) {
  d.shadow(0, 4, 42, 11);
  // the chairs stand a step in front of the table, their rush seats where the town seats people (y +5, 12.75 up)
  const chair = (x: number, side: -1 | 1) => {
    const y = 5, back = x + side * 8; d.line([back, y], [back, y - 22], "#6b4a2e", 1.8); d.line([x - side * 6, y], [x - side * 6, y - 7], "#6b4a2e", 1.6); d.line([x + side * 2, y + 2], [x + side * 2, y - 6], "#6b4a2e", 1.4);
    d.poly(pts([x - 8, y - 9, x + 8, y - 9, x + 9, y - 7, x - 9, y - 7]), "#d8b86a", "#8a6a36", 0.6); d.path(`M${x - 7} ${y - 8}H${x + 7}`, "none", "#b8963e", 0.5); d.line([back, y - 20], [back, y - 12], "#8a6a36", 3, 0.6);
  };
  chair(-27, -1); chair(27, 1);
  d.line([0, 0], [0, -20], IRON, 2); d.path("M-7 1L0 -1L7 1", "none", IRON, 1.6);
  d.ellipse([0, -21], 15, 6, "#eeebe4", "#a8a39a", 0.7); d.ellipse([0, -21.6], 13, 5, "none", "#ffffff", 0.6, 0.8); d.path("M-12 -20Q-2 -22 9 -23", "none", "#d4cfc4", 0.5, 0.8);
  d.ellipse([5, -23], 2.8, 1.2, "#ffffff", "#8f8a80", 0.4); d.path("M3 -25H7L6.4 -22.8H3.6Z", "#ffffff", "#8f8a80", 0.4);
  d.path("M-7 -26H-3V-21.5H-7Z", "#c9dcd8", "#7d918d", 0.4); for (let k = 0; k < 4; k++) d.line([-5, -26], [-7.5 + k * 1.6, -33], "#5d7a4f", 0.8);
  if (parasol) {
    d.line([0, -20], [0, -92], "#8a6f4e", 2);
    const n = 8; for (let k = 0; k < n; k++) { const a0 = Math.PI * (k / n), a1 = Math.PI * ((k + 1) / n); const P = (a: number): Pt => [-Math.cos(a) * 46, -76 + Math.sin(a) * 10]; d.poly([[0, -98], P(a0), P(a1)], k % 2 ? "#f2e9d3" : "#e6d8b6", "#a8987a", 0.5); d.poly([P(a0), P(a1), [(P(a0)[0] + P(a1)[0]) / 2, (P(a0)[1] + P(a1)[1]) / 2 + 4]], k % 2 ? "#f2e9d3" : "#e6d8b6", "#a8987a", 0.4); }
    d.circle([0, -99], 1.6, "#8a6f4e");
  }
}

/** The stone quay: slabs on a coursed face, a pale kerb, iron bollards where the gulls sit, rings for the boats, weed at the waterline. */
function pier(d: Draw) {
  const r = rnd(311);
  // the face toward the sea, in coursed blocks, darker and weedier as it goes down
  d.poly(pts([-112, 14, 140, 14, 140, 34, -112, 34]), "#bfb49c", MORTAR, 0.7);
  for (let row = 0; row < 2; row++) { const y0 = 14 + row * 10; d.line([-112, y0 + 10], [140, y0 + 10], MORTAR, 0.5); for (let x = -112 + (row % 2) * 9; x < 140; x += 18 + r() * 8) d.line([x, y0], [x, y0 + 10], MORTAR, 0.5); }
  d.poly(pts([-112, 28, 140, 28, 140, 34, -112, 34]), "#5e7a58", "none", 0, 0.55); d.poly(pts([-112, 32, 140, 32, 140, 36, -112, 36]), "#3f5a48", "none", 0, 0.5);
  d.poly(pts([140, 14, 122, -12, 122, 6, 140, 34]), "#a9a08a", MORTAR, 0.6);
  // the deck: rows of slabs, each its own stone
  d.poly(pts([-130, -12, 122, -12, 140, 14, -112, 14]), "#d9d0bc", MORTAR, 0.7);
  for (let row = 0; row < 3; row++) { const t0 = row / 3, t1 = (row + 1) / 3; let x = -130 + (row % 2) * 10; while (x < 122) { const w = 22 + r() * 14, a = Math.max(-130, x), b = Math.min(122, x + w); const off0 = 18 * t0, off1 = 18 * t1, y0 = -12 + 26 * t0, y1 = -12 + 26 * t1; d.poly(pts([a + off0 + 0.8, y0 + 0.6, b + off0 - 0.8, y0 + 0.6, b + off1 - 0.8, y1 - 0.6, a + off1 + 0.8, y1 - 0.6]), STONES[Math.floor(r() * STONES.length)]!, MORTAR, 0.45); x += w; } }
  // the kerb along the sea edge
  d.poly(pts([-114, 11, 140, 11, 141, 14, -113, 14]), "#ece5d4", MORTAR, 0.5);
  for (let x = -104; x < 140; x += 24) d.line([x, 11], [x + 1, 14], MORTAR, 0.5);
  // iron rings on the face, bollards on the far edge
  for (const x of [-70, 10, 90]) d.ellipse([x, 20], 3, 2.4, "none", IRON, 1.2);
  for (const x of [-110, -22, 66, 110]) { d.ellipse([x, -10], 5, 2, "#2a2e2f", "none", 0, 0.4); d.path(`M${x - 3.2} -10V-15Q${x - 5} -17 ${x - 5} -18.5H${x + 5}Q${x + 5} -17 ${x + 3.2} -15V-10Z`, IRON, "#1e2223", 0.6); d.ellipse([x, -18.5], 5, 1.8, IRON_LIGHT, "#1e2223", 0.5); }
  // a coil of rope by one bollard
  d.ellipse([-10, -4], 7, 3, "none", "#c9b489", 1.6); d.ellipse([-10, -4.6], 4.4, 1.8, "none", "#b39c6e", 1.3);
}

/** The island's passenger boat: a white wooden hull with a blue stripe, a wheelhouse with its windows, a life ring, a little flag. Deck at -15. */
function boat(d: Draw) {
  d.ellipse([6, 14], 92, 14, "#2e5e60", "none", 0, 0.14);
  d.path("M-90 -15H90Q86 2 72 11Q0 22 -74 11Q-86 2 -90 -15Z", "#f3efe4", "#8d8a7c", 0.8);
  d.path("M-89 -9H89Q88 -6 86 -3H-86Q-88 -6 -89 -9Z", "#2f6f8f", "none"); d.path("M-80 6Q0 16 78 6", "none", "#c4503f", 1.6);
  d.path("M-90 -15H90V-13H-90Z", OAK, "#5c4128", 0.5);
  for (let x = -70; x < 80; x += 30) d.line([x, -3], [x + 1, 9], "#d4cfc0", 0.5, 0.7);
  // the wheelhouse
  d.poly(pts([-44, -17, 34, -17, 34, -50, -44, -50]), "#eee8da", "#8d8a7c", 0.7); d.poly(pts([34, -17, 44, -22, 44, -55, 34, -50]), "#d5cfbf", "#8d8a7c", 0.7);
  d.poly(pts([-48, -50, 34, -50, 44, -55, -38, -55]), "#3a6f86", "#294f60", 0.6); d.poly(pts([-48, -50, 34, -50, 34, -48, -48, -48]), "#2b5a6e", "none");
  for (const x of [-36, -18, 0, 18]) { d.poly(pts([x, -44, x + 13, -44, x + 13, -30, x, -30]), "#4f7b86", "#2f4a50", 0.5); d.path(`M${x + 2} -42L${x + 8} -42L${x + 2} -34Z`, "#a9c8cc", "none", 0, 0.6); }
  d.circle([39, -36], 4.5, "none", "#e05a3f", 2.4); d.circle([39, -36], 4.5, "none", "#f5f0e4", 0.6);
  // the mast, a flag, a lamp
  d.line([-66, -15], [-66, -72], "#6b4a2e", 1.8); d.path("M-66 -72L-48 -68L-66 -62Z", "#c4503f", "#8a3a2c", 0.5); d.circle([-66, -52], 1.8, "#f2e3a8", IRON, 0.4);
  d.line([20, -55], [20, -64], IRON, 1.4);
}

/** A pasara: a white wooden rowing boat with a painted gunwale and a warm inside, its oars shipped. */
function rowboat(d: Draw) {
  d.ellipse([6, 12], 46, 12, "#2e5e60", "none", 0, 0.14);
  d.path("M-44 -8Q-20 -26 40 -12Q42 10 4 24Q-26 18 -44 -8Z", "#f3efe4", "#7d8a86", 0.9);
  d.path("M-44 -8Q-16 -22 40 -12Q14 6 4 12Q-18 6 -44 -8Z", "#b98a5a", "#2f6f8f", 2.2);
  d.path("M-40 -6Q-14 -17 34 -10Q12 3 4 8Q-15 3 -40 -6Z", "#9a6f45", "none");
  for (const [a, b] of [[-22, -4], [2, 2], [22, -6]] as const) d.line([a - 7, b - 6], [a + 8, b + 4], "#d9b88a", 2.2);
  d.path("M-44 -8Q-20 -26 40 -12", "none", "#2f6f8f", 1.4); d.path("M-30 12Q-8 22 4 24Q24 16 36 4", "none", "#c4503f", 1.2);
  d.line([-34, -18], [26, 10], "#c9a878", 1.6); d.line([-30, -8], [22, -20], "#c9a878", 1.6); d.path("M24 8Q30 12 30 16L22 13Z", "#b08a5c"); d.path("M20 -21Q25 -25 28 -24L23 -18Z", "#b08a5c");
}

/** Nets drying on their rack: two posts, a line, the mesh hanging in swags, cork floats and an orange buoy. */
function net(d: Draw) {
  d.shadow(2, 2, 50, 8);
  for (const x of [-46, 46]) d.line([x, 0], [x, -60], "#8a6f4e", 3);
  d.path("M-46 -58Q0 -44 46 -59", "none", "#6b5033", 1.2);
  for (let k = 0; k <= 12; k++) { const x = -44 + k * 7.3; const top = -57 + Math.sin((k / 12) * Math.PI) * 7; d.path(`M${x} ${top}Q${x + (k % 2 ? 2 : -2)} ${top + 18} ${x + 1} ${top + 40}`, "none", "#7f8c78", 0.6, 0.85); }
  for (let j = 1; j < 8; j++) d.path(`M-44 ${-57 + j * 5}Q0 ${-43 + j * 5.4} 45 ${-58 + j * 5}`, "none", "#7f8c78", 0.55, 0.8);
  for (let k = 0; k < 6; k++) { const x = -34 + k * 13.5; d.ellipse([x, -51 + Math.sin((k / 5) * Math.PI) * 6], 2.8, 1.8, "#c9a36a", "#7e6140", 0.4); }
  d.circle([30, -20], 5, "#e0823f", "#8a4a22", 0.6); d.path("M27 -22Q30 -24 33 -22", "none", "#f5c29a", 0.8);
}

/** Karst rocks at the water: grey-white limestone, pitted and cracked, a band of weed and a line of foam at the foot. */
function searocks(d: Draw) {
  const r = rnd(331);
  for (const [x, s, y] of [[-24, 1, 0], [8, 1.25, 4], [32, 0.8, 1]] as const) {
    const P = (px: number, py: number): Pt => [x + px * s, y + py * s];
    d.poly([P(-18, 0), P(-22, -9), P(-12, -22), P(-2, -27), P(10, -24), P(21, -12), P(17, 0)], "#e2ddd0", "#8f8a7c", 0.7);
    d.poly([P(-2, -27), P(10, -24), P(21, -12), P(17, 0), P(2, -5)], "#c4beb0", "none"); d.poly([P(-22, -9), P(-12, -22), P(-2, -27), P(2, -5), P(-18, 0)], "#ece8de", "none", 0, 0.6);
    for (let k = 0; k < 7; k++) d.circle(P(-12 + r() * 26, -20 + r() * 16), 0.8 + r() * 1.1, "#9d978a");
    d.path(`M${P(-14, -12)[0]} ${P(-14, -12)[1]}L${P(-6, -9)[0]} ${P(-6, -9)[1]}L${P(-2, -14)[0]} ${P(-2, -14)[1]}`, "none", "#8f8a7c", 0.6, 0.7);
    d.path(`M${P(-19, -2)[0]} ${P(-19, -2)[1]}Q${P(0, 3)[0]} ${P(0, 3)[1]} ${P(18, -1)[0]} ${P(18, -1)[1]}`, "none", "#5e7a58", 2.4, 0.8);
  }
  d.path("M-46 5Q-10 11 42 4", "none", "#f2f6ef", 1.4, 0.85);
}

/** Every prop the town can draw in the new hand, with the width the atlas records for it (for shadows and placement). */
export const PROPS: Record<string, { w: number; draw: (d: Draw) => void; lit?: (d: Draw) => void }> = {
  well: { w: 65, draw: well }, stall: { w: 150, draw: stall }, bench: { w: 74, draw: bench },
  lamp: { w: 26, draw: (d) => lamp(d, false) }, planter: { w: 36, draw: planter }, barrel: { w: 26, draw: barrel },
  crates: { w: 60, draw: crates }, terrace: { w: 71, draw: (d) => terrace(d, false) }, parasol: { w: 93, draw: (d) => terrace(d, true) },
  pier: { w: 280, draw: pier }, boat: { w: 180, draw: boat }, rowboat: { w: 90, draw: rowboat }, net: { w: 100, draw: net }, searocks: { w: 90, draw: searocks },
};
/** One prop as SVG, in its own frame with the origin at its foot. */
export function propSvg(name: string, lit = false): string | null { const p = PROPS[name]; if (!p) return null; const d = new Draw(); (lit && p.lit ? p.lit : p.draw)(d); return d.svg(); }
