import { gardenArt } from "./garden-art";
import { BENCH_SCALE_Y } from "./seating";
import { Container, Graphics, Assets, Rectangle, Sprite, Texture } from "pixi.js";
import { HARBOR_ATLAS, HARBOR_SHEETS, LIGHT_SHEETS } from "./harbor-atlas";
import { DALMATIAN_FOR, HOUSES, atlasName, bellAt, kindOfDrawing, sailsAt, stockAt } from "./dalmatian";
import { CROWNS } from "./dalmatian-props";
import { KELP, CREAM, SAGE_DARK, CORAL, WOOD, WOOD_DARK, STONE } from "./palette";

/** Canonical Harbor Street atlas; only movable parts and live inventory are drawn separately. */
type Pt = [number, number];
const S={width:.65,color:KELP,join:"round" as const};
const STRAW=0xd9c79e;
const proj=(w:number,d:number)=>(i:number,j:number,k:number):Pt=>[(i-j)-(w-d),(i+j)/2-(w+d)/2-k];
const poly=(g:Graphics,pts:Pt[],fill:number,stroke=true)=>{g.moveTo(...pts[0]!);for(const p of pts.slice(1))g.lineTo(...p);g.closePath().fill(fill);if(stroke)g.stroke(S);};
export type Season="winter"|"spring"|"summer"|"autumn";
let season:Season="summer";
export function setSeason(s:string):boolean {const next=(["winter","spring","summer","autumn"].includes(s)?s:"summer") as Season;const changed=next!==season;season=next;return changed;}

type Drawn = { c: Container; w: number };
const atlasTextures = new Map<string, Texture>();
type Face = "front" | "side" | "roof";
const FACES: Face[] = ["front", "side", "roof"];
const faceTextures = new Map<string, Record<Face, Texture>>();
let atlasReady: Promise<void> | null = null;
/** Full SVG rasterization at 3x keeps the study's transforms intact; the drawings arrive packed on a few WebP sheets, so the street is a handful of requests and batches as one. */
export function loadWorldArt(): Promise<void> {
  if (!atlasReady) atlasReady = Promise.all([Promise.all(HARBOR_SHEETS.map((src)=>Assets.load<Texture>(src))), Promise.all(LIGHT_SHEETS.map((src)=>Assets.load<Texture>(src)))]).then(([sheets,lightSheets])=>{
    const cut=(from:Texture[],[s,x,y,w,h]:readonly number[])=>{const sheet=from[s!];return sheet?new Texture({source:sheet.source,frame:new Rectangle(x!,y!,w!,h!)}):null;};
    for (const [name,asset] of Object.entries(HARBOR_ATLAS)) {
      const t=cut(sheets,[asset.sheet,...asset.frame]); if(t)atlasTextures.set(name,t);
      if("faces" in asset){const f={front:cut(lightSheets,asset.faces.front),side:cut(lightSheets,asset.faces.side),roof:cut(lightSheets,asset.faces.roof)};if(f.front&&f.side&&f.roof)faceTextures.set(name,f as Record<Face,Texture>);}
    }
  }).catch(error=>{atlasReady=null;throw error;});
  return atlasReady;
}

/**
 * The sun on the buildings, set by the world each frame and read by every building as it draws. For each way a wall can face,
 * how much it is turned from the light (shade, multiplied in a cool tint) and how much a low sun rakes it (glow, added warm).
 */
export const worldLight = {
  shade: { front: 0, side: 0, roof: 0 } as Record<Face, number>,
  glow: { front: 0, side: 0, roof: 0 } as Record<Face, number>,
  shadeTint: 0x5d6b8c, glowTint: 0x6a4a26,
  /** snow settled on the roofs, or the sheen of rain on them, laid over each roof by its own mask */
  roofCoat: 0,
};
/** The light masks of a drawing, for studies that shade or hatch a building by the way its surfaces face; null for anything without them. */
export function faceTexturesFor(name: string): Record<Face, Texture> | null { return faceTextures.get(name) ?? null; }
let classicHouses = false;
/** The town's houses are the Dalmatian drawings; `?houses=classic` puts back the ones they replaced, for comparison. */
export function setClassicHouses(on: boolean): void { classicHouses = on; }
/** The drawing that stands where the town has a `sprite`, or null to keep the town's own. `h` is a stable 0..1 for the place, choosing its colourway. */
export function streetHouse(sprite: string, h: number): string | null { if (classicHouses) return null; const m = DALMATIAN_FOR[sprite]; return m ? atlasName(m.kind, m.variant ?? Math.floor(h * HOUSES[m.kind].ways)) : null; }
const kindOf = kindOfDrawing;
/** The crowns of a tree as drawn now, in its own frame: the Dalmatian trees' own, or where the classic drawings carry theirs. */
const CLASSIC_CROWNS: Record<string, { x: number; y: number; rx: number; ry: number }[]> = {
  "tree-large": [{ x: 0, y: -95, rx: 60, ry: 38 }], "tree-small": [{ x: 0, y: -58, rx: 37, ry: 23 }], olive: [{ x: 0, y: -62, rx: 40, ry: 25 }],
  cypress: [{ x: 0, y: -100, rx: 9, ry: 12 }, { x: 0, y: -60, rx: 12, ry: 12 }], bush: [{ x: 0, y: -14, rx: 20, ry: 13 }],
};
export function treeCrowns(name: string): { x: number; y: number; rx: number; ry: number }[] { return (propDrawing(name) === name ? CLASSIC_CROWNS[name] : CROWNS[name]) ?? []; }
/** How fast lit windows come up and go down, in seconds. */
const WINDOW_FADE = 1.6;
const litTarget = new WeakMap<Sprite, { to: number; at: number }>();
/** A prop's drawing: the Dalmatian one where the atlas has it, unless the classic street was asked for. */
const propDrawing = (name: string) => !classicHouses && ("dal-" + name) in HARBOR_ATLAS ? "dal-" + name : name;
function harborDrawing(name: string): Drawn | null {
  const drawn=propDrawing(name); const asset=HARBOR_ATLAS[drawn as keyof typeof HARBOR_ATLAS], texture=atlasTextures.get(drawn);
  if(!asset||!texture)return null;
  const c=new Container(), sprite=new Sprite(texture);sprite.label="harbor:"+drawn;sprite.position.set(asset.x,asset.y);sprite.width=asset.width;sprite.height=asset.height;c.addChild(sprite);
  const over=(t:Texture,label:string)=>{const s=new Sprite(t);s.label=label;s.position.set(asset.x,asset.y);s.width=asset.width;s.height=asset.height;c.addChild(s);return s;};
  // the lit drawing lies over the dark one and fades in when someone is home, rather than switching
  const litTexture=atlasTextures.get(drawn+"-lit");
  if(litTexture){const lit=over(litTexture,"harbor-lit:"+drawn);lit.alpha=0;lit.onRender=()=>{const tg=litTarget.get(lit);if(!tg)return;const now=performance.now()/1000;const step=Math.min(1,(now-tg.at)/WINDOW_FADE);tg.at=now;lit.alpha+=(tg.to-lit.alpha)*Math.min(1,step*3);lit.visible=lit.alpha>.004;};}
  // the sun on each face: shade where a wall turns from it, a warm rake where a low sun catches it
  const faces=faceTextures.get(drawn);
  if(faces)for(const face of FACES){
    const shade=over(faces[face],"light-shade:"+face);shade.blendMode="multiply";shade.onRender=()=>{shade.tint=worldLight.shadeTint;shade.alpha=worldLight.shade[face];shade.visible=shade.alpha>.004;};
    const glow=over(faces[face],"light-glow:"+face);glow.blendMode="add";glow.onRender=()=>{glow.tint=worldLight.glowTint;glow.alpha=worldLight.glow[face];glow.visible=glow.alpha>.004;};
    if(face==="roof"){const coat=over(faces.roof,"light-coat");coat.onRender=()=>{coat.alpha=worldLight.roofCoat;coat.visible=coat.alpha>.004;};}
  }
  if(drawn === "bench") { sprite.scale.y *= BENCH_SCALE_Y; sprite.y *= BENCH_SCALE_Y; } // the old bench is drawn tall and squashed to its seat; the stone one is drawn at it
  if(/tree|olive/.test(name)) sprite.tint=season==="autumn"?0xe8c397:season==="winter"?0xbdc9c4:season==="spring"?0xe5f0cd:0xffffff;
  if(name==="washing"){const cloth=harborDrawing("cloth");if(cloth){cloth.c.label="cloth";c.addChild(cloth.c);}}
  if(name==="mill"||name==="dal-mill") {
    const sails=new Graphics();sails.label="sails";if(name==="dal-mill")sails.position.set(...sailsAt());else sails.position.set(0,-143);
    for(let n=0;n<4;n++){const a=n*Math.PI/2+.3,at=(r:number,off:number):Pt=>[Math.cos(a)*r-Math.sin(a)*off,Math.sin(a)*r+Math.cos(a)*off];
      sails.moveTo(0,0).lineTo(...at(66,0)).stroke({width:2.4,color:0x8d8263});
      poly(sails,[at(20,1),at(65,1),at(65,15),at(20,15)],0xe7dec1,false);
      for(let r=25;r<65;r+=9)sails.moveTo(...at(r,1)).lineTo(...at(r,15)).stroke({width:.65,color:0xb0a587});
    }sails.circle(0,0,4).fill(0xb48b65);c.addChild(sails);
  }
  if(name==="chapel"||name==="dal-chapel"){const bell=new Graphics();bell.label="bell";if(name==="dal-chapel")bell.position.set(...bellAt());else bell.position.set(-1,-147);bell.moveTo(-5,3).quadraticCurveTo(-4,-7,0,-7).quadraticCurveTo(4,-7,5,3).closePath().fill(0xc3a474);bell.circle(0,5,1.5).fill(0x8f805f);c.addChild(bell);}
  return {c,w:asset.w};
}
/** Change only a building's occupied windows; geometry and the citizen's chosen appearance stay fixed. */
export function lightWorldArt(root:Container,lit:boolean):void {
  for(const child of root.children){
    if(child instanceof Sprite && child.label.startsWith("harbor-lit:")) {
      const to=lit?1:0,tg=litTarget.get(child);if(!tg)litTarget.set(child,{to,at:performance.now()/1000});else tg.to=to;
    } else if(child instanceof Container && !(child instanceof Sprite)) lightWorldArt(child,lit);
  }
}
export function drawConstruction(done:number,needed:number,kind:string):Container {
  if (kind === "garden") { const c = new Container(); c.addChild(new Graphics().svg(gardenArt(done / Math.max(1, needed)))); return c; }
  const c=new Container(),building=drawThing(kind==="shop"?"shop":streetHouse("house",0)??"house");if(!building)return c; // a house rises as the house it will be
  const ratio=Math.max(0,Math.min(1,done/Math.max(1,needed))),mask=new Graphics();
  const bounds=building.c.getLocalBounds(); const visible=Math.max(8,bounds.height*ratio);
  mask.rect(bounds.x-1,bounds.y+bounds.height-visible,bounds.width+2,visible+1).fill(0xffffff);
  c.addChild(building.c,mask);building.c.mask=mask;return c;
}
/** A fresh drawing of the named thing, or null if the atlas still has to stand in. */
export function drawThing(name: string): Drawn | null { if (name === "garden") { const c = new Container(); c.addChild(new Graphics().svg(gardenArt())); return { c, w: 220 }; } return harborDrawing(name); }

/**
 * What is on the shelves, drawn onto the building: loaves, fish and apples on the market counter, the plank pile at the
 * sawpit, logs at the pinewood, sacks at the mill. Empty shelves draw nothing, and that is the point: the street shows the economy.
 */
/** The six o'clock cart: two wheels, a bed, two handles; what it carries is drawn on the bed by kind. */
export function drawCart(load: { item: string; qty: number } | null): Container {
  const c = new Container(); const g = new Graphics();
  g.roundRect(-22, -14, 44, 12, 2).fill(WOOD).stroke({ width: .8, color: KELP }); g.moveTo(-22, -8).lineTo(-36, -4).moveTo(-22, -12).lineTo(-36, -8).stroke({ width: 3, color: WOOD_DARK, cap: "round" });
  const wheel = (x: number) => { g.circle(x, 0, 8).fill(CREAM).stroke({ width: .9, color: KELP }); g.circle(x, 0, 2).fill(KELP); for (let i = 0; i < 4; i++) g.moveTo(x, 0).lineTo(x + Math.cos(i * Math.PI / 2) * 7, Math.sin(i * Math.PI / 2) * 7).stroke({ width: 1, color: KELP }); };
  wheel(-10); wheel(12); c.addChild(g);
  if (load && load.qty > 0) {
    const l = new Graphics(); const n = Math.min(5, Math.max(1, Math.ceil(load.qty / 2)));
    for (let i = 0; i < n; i++) { const x = -16 + i * 8, y = -18 - (i % 2) * 3;
      if (/grain|flour|sack/.test(load.item)) { l.ellipse(x, y, 5, 6).fill(load.item === "flour" ? CREAM : STRAW).stroke({ width: .65, color: KELP }); l.moveTo(x - 3, y - 5).lineTo(x + 3, y - 5).stroke({ width: 1.4, color: KELP }); }
      else if (/bread/.test(load.item)) l.ellipse(x, y + 2, 5, 3).fill(0xd9b26a).stroke({ width: 1, color: KELP });
      else if (/apple/.test(load.item)) { if (i === 0) l.rect(-18, -22, 30, 8).fill(WOOD).stroke({ width: .65, color: KELP }); l.circle(x + 1, -23, 3).fill(CORAL).stroke({ width: 1, color: KELP }); }
      else if (/fish/.test(load.item)) { if (i === 0) l.rect(-18, -22, 30, 8).fill(WOOD).stroke({ width: .65, color: KELP }); l.ellipse(x + 1, -23, 4, 2).fill(SAGE_DARK).stroke({ width: 1, color: KELP }); }
      else if (/timber|plank|wood/.test(load.item)) l.moveTo(-20, y - 2).lineTo(20, y - 2).stroke({ width: 5, color: WOOD_DARK, cap: "round" });
      else l.rect(x - 4, y - 4, 8, 8).fill(WOOD).stroke({ width: .65, color: KELP });
    }
    c.addChild(l);
  }
  return c;
}
/** A board on the door when the shelf is empty. */
export function drawSign(text: string): Graphics {
  const g = new Graphics(); g.roundRect(-22, -30, 44, 14, 2).fill(CREAM).stroke({ width: 1.4, color: KELP }); g.moveTo(-22, -24).lineTo(-28, -18).moveTo(22, -24).lineTo(28, -18).stroke({ width: .65, color: KELP });
  void text; return g;
}
/** Where each stock display sat on the old drawings; a Dalmatian building moves the same display to its own bench, step or counter. */
const OLD_STOCK_AT: Record<string, [number, number]> = { bakery: [-41, -6], chandlery: [58, 4], fishhouse: [60, 8], mill: [52, 4] };
export function drawStock(sprite: string, stock: Record<string, number>, drawing?: string): Graphics | null {
  const g = drawStockAt(sprite, stock); const kind = drawing ? kindOf(drawing) : null; const at = kind ? stockAt(kind) : null; const old = OLD_STOCK_AT[sprite];
  if (g && at && old) g.position.set(at[0] - old[0], at[1] - old[1]);
  return g;
}
function drawStockAt(sprite: string, stock: Record<string, number>): Graphics | null {
  const g = new Graphics(); const n = (k: string, per: number, max: number) => Math.min(max, Math.ceil((stock[k] ?? 0) / per));
  if (sprite === "stall") {
    const w = 70, d = 44; const P = proj(w, d);
    const rows: [string, number, (q: Pt) => void][] = [
      ["bread", 3, (q) => { g.ellipse(q[0], q[1] - 3, 4.2, 2.6).fill(0xd9b26a).stroke({ width: 1, color: KELP }); }],
      ["fish", 3, (q) => { g.ellipse(q[0], q[1] - 3, 4.5, 2).fill(SAGE_DARK).stroke({ width: 1, color: KELP }); g.moveTo(q[0] + 4, q[1] - 3).lineTo(q[0] + 6.5, q[1] - 5).lineTo(q[0] + 6.5, q[1] - 1).closePath().fill(SAGE_DARK).stroke({ width: 1, color: KELP }); }],
      ["apples", 3, (q) => { g.circle(q[0], q[1] - 3, 3).fill(CORAL).stroke({ width: 1, color: KELP }); }],
    ];
    let any = false;
    rows.forEach(([item, per, draw], r) => { const k = n(item, per, 6); for (let i = 0; i < k; i++) { draw([-36+i*11+r*7,-13+i*.9-r*5]); any = true; } });
    return any ? g : null;
  }
  if (sprite === "sawpit") {
    const w = 80, d = 50; const P = proj(w, d); const layers = n("planks", 4, 7); if (!layers) return null;
    for (let k = 0; k < layers; k++) poly(g, [P(10, d - 8 - k * 5, k * 4), P(60, d - 8 - k * 5, k * 4), P(60, d - 8 - k * 5, k * 4 + 4), P(10, d - 8 - k * 5, k * 4 + 4)], k % 2 ? WOOD : CREAM);
    return g;
  }
  if (sprite === "tree-large") { // the pinewood: a log pile at its foot
    const logs = n("timber", 3, 6); if (!logs) return null;
    for (let i = 0; i < logs; i++) { const row = i < 3 ? 0 : 1, col = i < 3 ? i : i - 3; const x = 40 + col * 14 - row * 7, y = 6 - row * 9; g.moveTo(x - 10, y).lineTo(x + 10, y).stroke({ width: 8, color: WOOD_DARK, cap: "round" }); g.circle(x + 10, y, 4).fill(WOOD).stroke({ width: 1, color: KELP }); }
    return g;
  }
  if (sprite === "mill") { const sacks = n("flour", 8, 5); if (!sacks) return null; for (let i = 0; i < sacks; i++) { const x = 30 + i * 11, y = 4 - (i % 2) * 2; g.ellipse(x, y - 6, 5, 7).fill(CREAM).stroke({ width: .65, color: KELP }); g.moveTo(x - 3, y - 12).lineTo(x + 3, y - 12).stroke({ width: 1.5, color: KELP }); } return g; }
  if (sprite === "bakery") { const loaves = n("bread", 3, 6); if (!loaves) return null; g.rect(-62, -6, 42, 4).fill(WOOD).stroke({ width: 1, color: KELP }); for (let i = 0; i < loaves; i++) g.ellipse(-56 + i * 7, -9, 3.6, 2.4).fill(0xd9b26a).stroke({ width: 1, color: KELP }); return g; }
  if (sprite === "orchard") { const crates = n("apples", 6, 4); if (!crates) return null; for (let i = 0; i < crates; i++) { const x = -70 + i * 18, y = 10; g.rect(x - 7, y - 8, 14, 8).fill(WOOD).stroke({ width: .65, color: KELP }); for (let f = 0; f < 3; f++) g.circle(x - 4 + f * 4, y - 9, 2.2).fill(CORAL); } return g; }
  if (sprite === "field") { const sacks = n("grain", 15, 5); if (!sacks) return null; for (let i = 0; i < sacks; i++) { const x = 60 + i * 13, y = 26 - (i % 2) * 3; g.ellipse(x, y - 6, 5, 7).fill(STRAW).stroke({ width: .65, color: KELP }); g.moveTo(x - 3, y - 12).lineTo(x + 3, y - 12).stroke({ width: 1.5, color: KELP }); } return g; }
  if (sprite === "chandlery") { const coils = n("rope", 2, 3); if (!coils) return null; for (let i = 0; i < coils; i++) { const x = 46 + i * 12; g.circle(x, 4, 5).stroke({ width: 3, color: STRAW }); g.circle(x, 4, 5).stroke({ width: 1, color: KELP }); } return g; }
  if (sprite === "quarry") { const blocks = n("stone", 3, 5); if (!blocks) return null; for (let i = 0; i < blocks; i++) { const row = i < 3 ? 0 : 1, col = i < 3 ? i : i - 3; g.rect(50 + col * 14 - row * 7, 6 - row * 9 - 8, 12, 8).fill(STONE).stroke({ width: .65, color: KELP }); } return g; }
  if (sprite === "fishhouse") { const crates = n("fish", 6, 3); if (!crates) return null; for (let i = 0; i < crates; i++) { const x = 44 + i * 16, y = 8; g.rect(x - 7, y - 8, 14, 8).fill(WOOD).stroke({ width: .65, color: KELP }); for (let f = 0; f < 3; f++) g.ellipse(x - 4 + f * 4, y - 9, 2.2, 1.2).fill(SAGE_DARK); } return g; }
  return null;
}
export const DRAWN = new Set(Object.keys(HARBOR_ATLAS).filter(name=>!name.endsWith("-lit")&&name!=="cloth"));
