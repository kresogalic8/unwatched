/**
 * The ground under everything: sand, grass, field, forest, rock and cobble, blended where they meet instead of cut at a tile;
 * roads that are worn where people actually walk; a shore with a wrack line and rocks; contours on the hill.
 * Drawn once, in the island's flat hand, from the same places the engine has. Only the wear changes while you watch.
 */
import { Graphics, Container } from "pixi.js";
import { GROUND, KELP, CORAL, CREAM } from "./palette";

type Pt = { x: number; y: number };
export type TerrainPlace = { id: string; x: number; y: number; kind: string; exits: string[] };
export type TerrainOptions = {
  W: number; H: number; cx: number; cy: number;
  /** 1 at the shore, 0 at the centre, more than 1 at sea */
  inside: (x: number, y: number) => number;
  /** the island's outline at a fraction of its size */
  outline: (t: number) => [number, number][];
  places: Map<string, TerrainPlace>;
  oldTown: string[];
};

/** Value noise: smooth, seeded, the same every time the island is drawn. */
function hash2(i: number, j: number): number { let h = (i * 374761393 + j * 668265263) >>> 0; h = (h ^ (h >>> 13)) >>> 0; h = Math.imul(h, 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
export function noise(x: number, y: number): number {
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j; const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash2(i, j), b = hash2(i + 1, j), c = hash2(i, j + 1), d = hash2(i + 1, j + 1);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}
const smooth = (t: number) => { const k = Math.max(0, Math.min(1, t)); return k * k * (3 - 2 * k); };
const shade = (color: number, k: number) => { const r = (color >> 16) & 255, g = (color >> 8) & 255, b = color & 255; const f = 1 + k; return (Math.min(255, Math.round(r * f)) << 16) | (Math.min(255, Math.round(g * f)) << 8) | Math.min(255, Math.round(b * f)); };
const mix = (a: number, b: number, t: number) => { const ch = (sh: number) => Math.round(((a >> sh) & 255) * (1 - t) + ((b >> sh) & 255) * t); return (ch(16) << 16) | (ch(8) << 8) | ch(0); };

/** Where the roads meet: a little below each place, where the door is. */
export const doorOf = (p: Pt) => ({ x: p.x, y: p.y + 40 });

export type Seg = { key: string; a: Pt; b: Pt; cobbled: boolean };
export function segmentsOf(places: Map<string, TerrainPlace>, oldTown: string[]): Seg[] {
  const segs: Seg[] = []; const seen = new Set<string>();
  for (const p of places.values()) for (const e of p.exits) { const q = places.get(e); if (!q) continue; const key = [p.id, q.id].sort().join("|"); if (seen.has(key)) continue; seen.add(key); segs.push({ key, a: doorOf(p), b: doorOf(q), cobbled: oldTown.includes(p.id) && oldTown.includes(q.id) }); }
  return segs;
}

/** A road drawn as a slightly wandering ribbon, not a ruler line. */
function ribbon(g: Graphics, a: Pt, b: Pt, width: number, color: number, alpha = 1, wobble = 3, seed = 0): void {
  const L = Math.hypot(b.x - a.x, b.y - a.y); const n = Math.max(2, Math.round(L / 40)); const nx = -(b.y - a.y) / L, ny = (b.x - a.x) / L;
  g.moveTo(a.x, a.y);
  for (let k = 1; k <= n; k++) { const t = k / n; const off = k === n ? 0 : (noise(seed + t * 6, seed * 0.37) - 0.5) * 2 * wobble; g.lineTo(a.x + (b.x - a.x) * t + nx * off, a.y + (b.y - a.y) * t + ny * off); }
  g.stroke({ width, color, alpha, cap: "round", join: "round" });
}

export function drawGround(o: TerrainOptions, season: string): Graphics {
  const {W,H,cy,inside,outline,places,oldTown}=o; const g=new Graphics();
  const poly=(pts:[number,number][])=>{g.moveTo(...pts[0]!);for(const p of pts.slice(1))g.lineTo(...p);return g.closePath();};
  // A continuous landscape replaces the old diamond terrain grid.
  poly(outline(1.09)).fill({color:0x95bcaf,alpha:.23});
  poly(outline(1.055)).fill({color:0xc5d8c9,alpha:.65});
  const shallows=outline(1.065);
  for(let i=0;i<shallows.length-1;i+=3){const a=shallows[i]!,b=shallows[i+1]!;g.moveTo(...a).lineTo(...b).stroke({width:1.3,color:0xe8edda,alpha:.55,cap:"round"});}
  poly(outline(1).map(([x,y])=>[x+9,y+22] as [number,number])).fill({color:0x527d70,alpha:.15});
  poly(outline(1)).fill(0xc3c6a8);poly(outline(.98)).fill(0xded7bb);
  poly(outline(.92)).fill(season==="winter"?0xc8cbbd:season==="autumn"?0xcac6a4:0xc4c9a6);
  // The land reads as raised, not a flat cut-out: a soft slope-shadow just inside the shore where the ground falls to the sea,
  // a gentle lift over the interior, and a brighter knoll where the hill actually is. Static, following the real coastline.
  for(let k=0;k<18;k++)poly(outline(.99-k*.011)).stroke({width:32,color:0x93997f,alpha:.052*(1-k/18),join:"round"});
  poly(outline(.62)).fill({color:0xfbf5e6,alpha:.06});poly(outline(.42)).fill({color:0xfdf8ec,alpha:.06});poly(outline(.24)).fill({color:0xfffbef,alpha:.05});
  const hill=places.get("hill");if(hill)for(let k=0;k<5;k++)g.ellipse(hill.x,hill.y-20,280-k*44,164-k*26).fill({color:0xfaf3e2,alpha:.05});
  // Broad overlapping color washes have soft, irregular boundaries, never hard tiles.
  for(let n=0;n<380;n++) {
    const x=hash2(n,31)*W,y=hash2(n,67)*H,rx=25+hash2(n,19)*50,ry=rx*.42;
    if(inside(x-rx,y)>.90||inside(x+rx,y)>.90||inside(x,y+ry)>.90||inside(x,y-ry)>.90)continue;
    g.ellipse(x,y,rx,ry).fill({color:n%3?0xe1d9b8:0x97aa88,alpha:.075});
  }
  const urban=[...places.values()].filter(p=>oldTown.includes(p.id)||["harbor","boatshed","chandlery","fishhouse","inn"].includes(p.id));
  const urbanity=(x:number,y:number)=>urban.reduce((best,p)=>Math.min(best,Math.hypot((x-p.x)/230,(y-p.y+20)/145)),Infinity);
  // Worn limestone beds fade into the soil; only fragments retain a visible joint.
  for (const p of urban) for (let layer=0;layer<4;layer++) {
    const rx=185-layer*23, ry=105-layer*13;
    if(inside(p.x-rx,p.y)<.97 && inside(p.x+rx,p.y)<.97 && inside(p.x,p.y+ry)<.97)
      g.ellipse(p.x,p.y-15,rx,ry).fill({color:0xdbd5bd,alpha:.16});
  }
  // Sparse, chipped stones interrupt the paving instead of covering town in a checkerboard.
  for(let row=-8;row<H/10+8;row++)for(let col=-4;col<W/38+4;col++) {
    const x=col*38+(row%2)*19+(hash2(col,row+41)-.5)*18,y=row*10+(hash2(col+52,row)-.5)*7;
    if(hash2(col+311,row+91)<.76)continue;
    if(urbanity(x,y)>1+noise(x/110,y/80)*.18)continue;
    const pts:[number,number][]=[[x-2,y-8],[x+15,y-1],[x+16,y+1],[x+1,y+8],[x-15,y+1],[x-16,y-1]];
    if(pts.some(([xx,yy])=>inside(xx,yy)>.973))continue;
    poly(pts).fill({color:[0xd8d2bc,0xdcd6c0,0xd4cfb8,0xdfd8c1,0xd7d3bc][Math.floor(hash2(col,row)*5)]!,alpha:.25+hash2(col+81,row)*.22});
    g.moveTo(x-17,y).lineTo(x,y-9).lineTo(x+17,y).stroke({width:.45,color:0xeee3c9,alpha:.25});
  }
  // Tiny grass, shells and limestone chips share the ground instead of sitting on tile symbols.
  for(let n=0;n<2400;n++) {
    const x=hash2(n,7)*W,y=hash2(n,13)*H,d=inside(x,y); if(d>.96)continue;
    const paved=urbanity(x,y)<1.15;
    if(paved) { if(n%4===0)g.ellipse(x,y,.7,.4).fill({color:0x8d9277,alpha:.3});continue; }
    if(n%7===0)g.ellipse(x,y,2.2,1).fill({color:0xeee4c9,alpha:.7});
    else if(d<.86){g.moveTo(x,y).quadraticCurveTo(x-2,y-3,x-1,y-5).moveTo(x+2,y).lineTo(x+4,y-4).stroke({width:.8,color:0x889b75,alpha:.5});if(season==="spring"&&n%13===0)g.circle(x,y-5,1.6).fill(0xd4a087);}
  }
  // The front shore is a physical cut of limestone, with cap stones and mortar joints.
  const rim=outline(.99);
  for(let k=0;k<rim.length;k++) {
    const a=rim[k]!,b=rim[(k+1)%rim.length]!;if((a[1]+b[1])/2<cy)continue;
    const h=17+noise(k/8,2)*13;
    poly([a,b,[b[0],b[1]+h],[a[0],a[1]+h]]).fill(k%3?0xb1b49b:0xa6ad95);
    g.moveTo(a[0],a[1]+2).lineTo(a[0],a[1]+h).stroke({width:.7,color:0x87977f,alpha:.65});
    g.moveTo(...a).lineTo(...b).stroke({width:4,color:k%2?0xe5dec5:0xd9d5bc});
    g.moveTo(a[0],a[1]+h).lineTo(b[0],b[1]+h).stroke({width:1,color:0x789381,alpha:.55});
  }
  return g;
}

/** Roads with an edge, a centre worn pale, and cobbles in the old town. Drawn once; the wear layer above them changes. */
export function drawRoads(segs: Seg[]): Graphics {
  const g=new Graphics();
  segs.forEach((s,i)=>{
    const L=Math.hypot(s.b.x-s.a.x,s.b.y-s.a.y);if(L<1)return;
    ribbon(g,s.a,s.b,s.cobbled?20:27,0x9ba58a,.12,5,i);
    if(!s.cobbled) {ribbon(g,s.a,s.b,22,0xcfc5a8,.34,4,i);ribbon(g,s.a,s.b,15,0xe2d7b9,.65,3,i);}
    const ux=(s.b.x-s.a.x)/L,uy=(s.b.y-s.a.y)/L;
    for(let t=7;t<L;t+=14){const h=hash2(Math.round(t),i),x=s.a.x+ux*t,y=s.a.y+uy*t;
      if(s.cobbled && h>.4)g.moveTo(x-8,y).lineTo(x,y-4).lineTo(x+8,y).lineTo(x,y+4).closePath().fill({color:h>.5?0xe3ddc5:0xd4ceb5,alpha:.55});
      else if(h>.65)g.ellipse(x+7,y+3,1.8,.8).fill({color:0xb0b394,alpha:.45});
    }
  });return g;
}

/** The wear on the roads: the centre goes pale where feet go. Counts steps between places and redraws now and then. */
export class Wear extends Container {
  private g = new Graphics(); private count = new Map<string, number>(); private dirty = true;
  constructor(private segs: Seg[], seed: (s: Seg) => number) { super(); this.addChild(this.g); for (const s of segs) this.count.set(s.key, seed(s)); }
  step(from: string, to: string): void { const key = [from, to].sort().join("|"); if (!this.count.has(key)) return; this.count.set(key, (this.count.get(key) ?? 0) + 1); this.dirty = true; }
  redraw(): void {
    if (!this.dirty) return; this.dirty = false; const g = this.g; g.clear();
    for (const s of this.segs) { const n = this.count.get(s.key) ?? 0; if (n <= 0) continue; const k = Math.min(1, Math.log2(1 + n) / 7); ribbon(g, s.a, s.b, 4 + 9 * k, s.cobbled ? 0xe2dbca : 0xe6dcc4, 0.06 + 0.08 * k, 2, 3); }
  }
}

/** Nothing planted stands in the road: anything whose foot is within a road's width is moved sideways off it. Water and shore props are left alone. */
export function keepOffRoads<T extends { sprite: string; x: number; y: number }>(items: T[], segs: Seg[], margin = 30): T[] {
  const skip = /pier|rowboat|searocks|net|field|washing|fence/;
  return items.map((it) => {
    if (skip.test(it.sprite)) return it;
    let best: { d: number; nx: number; ny: number } | null = null;
    for (const s of segs) {
      const dx = s.b.x - s.a.x, dy = s.b.y - s.a.y, L2 = dx * dx + dy * dy || 1; const t = Math.max(0, Math.min(1, ((it.x - s.a.x) * dx + (it.y - s.a.y) * dy) / L2));
      const px = s.a.x + dx * t, py = s.a.y + dy * t; const ox = it.x - px, oy = it.y - py; const d = Math.hypot(ox, oy);
      if (!best || d < best.d) { const L = Math.hypot(dx, dy) || 1; const side = ox * -dy + oy * dx >= 0 ? 1 : -1; best = { d, nx: (-dy / L) * side, ny: (dx / L) * side }; }
    }
    if (!best || best.d >= margin) return it;
    return { ...it, x: it.x + best.nx * (margin - best.d + 6), y: it.y + best.ny * (margin - best.d + 6) };
  });
}
