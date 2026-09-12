import { BENCH_SCALE_Y } from "./seating";
import { Container, Graphics, Assets, Sprite, type Texture } from "pixi.js";
import { HARBOR_ATLAS } from "./harbor-atlas";
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
let atlasReady: Promise<void> | null = null;
/** Full SVG rasterization at 3x keeps the study's transforms intact and the runtime GPU cost bounded. */
export function loadWorldArt(): Promise<void> {
  if (!atlasReady) atlasReady = Promise.all(Object.entries(HARBOR_ATLAS).map(async ([name,asset])=>{
    atlasTextures.set(name,await Assets.load<Texture>(asset.src));
  })).then(()=>undefined).catch(error=>{atlasReady=null;throw error;});
  return atlasReady;
}
function harborDrawing(name: string): Drawn | null {
  const asset=HARBOR_ATLAS[name as keyof typeof HARBOR_ATLAS], texture=atlasTextures.get(name);
  if(!asset||!texture)return null;
  const c=new Container(), sprite=new Sprite(texture);sprite.label="harbor:"+name;sprite.position.set(asset.x,asset.y);sprite.width=asset.width;sprite.height=asset.height;c.addChild(sprite);
  if(name === "bench") { sprite.scale.y *= BENCH_SCALE_Y; sprite.y *= BENCH_SCALE_Y; }
  if(/tree|olive/.test(name)) sprite.tint=season==="autumn"?0xe8c397:season==="winter"?0xbdc9c4:season==="spring"?0xe5f0cd:0xffffff;
  if(name==="washing"){const cloth=harborDrawing("cloth");if(cloth){cloth.c.label="cloth";c.addChild(cloth.c);}}
  if(name==="mill") {
    const sails=new Graphics();sails.label="sails";sails.position.set(0,-143);
    for(let n=0;n<4;n++){const a=n*Math.PI/2+.3,at=(r:number,off:number):Pt=>[Math.cos(a)*r-Math.sin(a)*off,Math.sin(a)*r+Math.cos(a)*off];
      sails.moveTo(0,0).lineTo(...at(66,0)).stroke({width:2.4,color:0x8d8263});
      poly(sails,[at(20,1),at(65,1),at(65,15),at(20,15)],0xe7dec1,false);
      for(let r=25;r<65;r+=9)sails.moveTo(...at(r,1)).lineTo(...at(r,15)).stroke({width:.65,color:0xb0a587});
    }sails.circle(0,0,4).fill(0xb48b65);c.addChild(sails);
  }
  if(name==="chapel"){const bell=new Graphics();bell.label="bell";bell.position.set(-1,-147);bell.moveTo(-5,3).quadraticCurveTo(-4,-7,0,-7).quadraticCurveTo(4,-7,5,3).closePath().fill(0xc3a474);bell.circle(0,5,1.5).fill(0x8f805f);c.addChild(bell);}
  return {c,w:asset.w};
}
/** Change only a building's occupied windows; geometry and the citizen's chosen appearance stay fixed. */
export function lightWorldArt(root:Container,lit:boolean):void {
  for(const child of root.children){
    if(child instanceof Sprite && child.label.startsWith("harbor:")) {
      const name=child.label.slice(7),texture=atlasTextures.get(lit?name+"-lit":name);if(texture)child.texture=texture;
    } else if(child instanceof Container) lightWorldArt(child,lit);
  }
}
export function drawConstruction(done:number,needed:number,kind:string):Container {
  const c=new Container(),building=drawThing(kind==="shop"?"shop":"house");if(!building)return c;
  const ratio=Math.max(0,Math.min(1,done/Math.max(1,needed))),mask=new Graphics();
  mask.rect(-200,-Math.max(8,210*ratio),400,Math.max(8,210*ratio)+10).fill(0xffffff);
  c.addChild(building.c,mask);building.c.mask=mask;return c;
}
/** A fresh drawing of the named thing, or null if the atlas still has to stand in. */
export function drawThing(name: string): Drawn | null { return harborDrawing(name); }

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
export function drawStock(sprite: string, stock: Record<string, number>): Graphics | null {
  const g = new Graphics(); const n = (k: string, per: number, max: number) => Math.min(max, Math.ceil((stock[k] ?? 0) / per));
  if (sprite === "stall") {
    const w = 70, d = 44; const P = proj(w, d);
    const rows: [string, number, (q: Pt) => void][] = [
      ["bread", 3, (q) => { g.ellipse(q[0], q[1] - 3, 4.2, 2.6).fill(0xd9b26a).stroke({ width: 1, color: KELP }); }],
      ["fish", 3, (q) => { g.ellipse(q[0], q[1] - 3, 4.5, 2).fill(SAGE_DARK).stroke({ width: 1, color: KELP }); g.moveTo(q[0] + 4, q[1] - 3).lineTo(q[0] + 6.5, q[1] - 5).lineTo(q[0] + 6.5, q[1] - 1).closePath().fill(SAGE_DARK).stroke({ width: 1, color: KELP }); }],
      ["apples", 3, (q) => { g.circle(q[0], q[1] - 3, 3).fill(CORAL).stroke({ width: 1, color: KELP }); }],
    ];
    let any = false;
    rows.forEach(([item, per, draw], r) => { const k = n(item, per, 6); for (let i = 0; i < k; i++) { draw(P(8 + i * 10, d - 8 - r * 9, 20)); any = true; } });
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
