"use client";
import { useEffect, useRef } from "react";
import { Application, Container, Graphics } from "pixi.js";
import { Citizen, lookFor, aged, type Look, type Pose } from "@/components/world/citizen";

export type InteriorPerson = { id: string; name: string; asleep: boolean; job: string | null; appearance: Record<string, unknown> | null; age?: number; pose?: "sleep" | "work" | "sit" | "idle" };

import { KELP as INK, CREAM as WALL, CREAM_DARK as WALL2, WOOD as FLOOR, WOOD_DARK as FLOOR2, WOOD_DARK as WOOD, TEAL as CLOTH, CORAL, CREAM, GLASS, SAND, DRIFT, LIGHT } from "@/components/world/palette";

/** The furniture a kind of place keeps, drawn in the same dimetric hand as the buildings, flat to the back wall. */
function furnish(g: Graphics, kind: string, sprite: string, W: number, H: number, floorY: number): { seats: [number, number][]; beds: [number, number][]; benches: [number, number][] } {
  const seats: [number, number][] = [], beds: [number, number][] = [], benches: [number, number][] = [];
  const bed = (x: number) => { g.roundRect(x, floorY - 26, 58, 22, 4).fill(WOOD).stroke({ width: .7, color: INK }); g.roundRect(x + 3, floorY - 30, 52, 12, 3).fill(CREAM).stroke({ width: .65, color: INK }); g.roundRect(x + 6, floorY - 33, 14, 7, 3).fill(CLOTH); beds.push([x + 30, floorY - 22]); };
  const table = (x: number, w = 70) => { g.rect(x, floorY - 30, w, 5).fill(WOOD).stroke({ width: .65, color: INK }); g.rect(x + 6, floorY - 25, 4, 22).fill(WOOD); g.rect(x + w - 10, floorY - 25, 4, 22).fill(WOOD); for (const cx of [x-10,x+w+10]) { g.moveTo(cx-7,floorY-1).lineTo(cx-7,floorY-32).lineTo(cx+7,floorY-32).lineTo(cx+7,floorY-1).moveTo(cx-7,floorY-14).lineTo(cx+7,floorY-14).stroke({width:1.8,color:WOOD}); } seats.push([x - 10, floorY - 2], [x + w + 10, floorY - 2]); };
  const bench = (x: number, w = 80) => { g.rect(x, floorY - 34, w, 8).fill(WOOD).stroke({ width: .65, color: INK }); g.rect(x + 6, floorY - 26, 5, 24).fill(WOOD); g.rect(x + w - 11, floorY - 26, 5, 24).fill(WOOD); benches.push([x + w / 2, floorY - 2]); };
  const shelf = (x: number, y: number, w: number) => { g.rect(x, y, w, 4).fill(WOOD); for (let i = 0; i < Math.floor(w / 14); i++) g.roundRect(x + 4 + i * 14, y - 12, 9, 12, 2).fill([CLOTH, CORAL, FLOOR, DRIFT][i % 4]!); };
  const window_ = (x: number, y: number) => { g.rect(x-3,y-3,40,37).fill(0xd6ceb4).stroke({width:.6,color:0xa5a58b}); g.rect(x-4,y+31,43,3).fill(0xeee2c6); g.roundRect(x, y, 34, 30, 3).fill(GLASS).stroke({ width: .7, color: INK }); g.moveTo(x+2,y+3).lineTo(x+15,y+3).lineTo(x+2,y+24).closePath().fill({color:0xe5ebd0,alpha:.3}); g.moveTo(x + 17, y).lineTo(x + 17, y + 30).stroke({ width: .65, color: INK }); g.moveTo(x, y + 15).lineTo(x + 34, y + 15).stroke({ width: .65, color: INK }); };
  const oven = (x: number) => { g.roundRect(x, floorY - 54, 54, 54, 6).fill(DRIFT).stroke({ width: .7, color: INK }); g.roundRect(x + 10, floorY - 34, 34, 18, 9).fill(0x2b2f31); g.roundRect(x + 14, floorY - 30, 26, 10, 5).fill(CORAL); benches.push([x + 27, floorY - 2]); };
  const barrel = (x: number) => { g.roundRect(x, floorY - 26, 20, 26, 5).fill(WOOD).stroke({ width: .65, color: INK }); g.rect(x, floorY - 18, 20, 2).fill(INK); g.rect(x, floorY - 9, 20, 2).fill(INK); };
  window_(W * 0.18, 26); window_(W * 0.7, 26);
  switch (kind) {
    case "inn": bed(20); bed(W - 80); table(W / 2 - 35); shelf(W / 2 - 40, 34, 80); break;
    case "home": bed(W - 82); table(24, 60); shelf(28, 40, 56); break;
    case "civic": table(W / 2 - 70, 140); g.roundRect(W / 2 - 16, 18, 32, 40, 3).fill(CLOTH).stroke({ width: .65, color: INK }); break;
    case "market": bench(16, 70); bench(W - 86, 70); shelf(W / 2 - 30, 44, 60); barrel(W / 2 - 10); break;
    case "shop": shelf(16, 40, W - 32); shelf(16, 62, W - 32); bench(W / 2 - 45, 90); break;
    case "harbor": table(20, 60); barrel(W - 70); barrel(W - 46); g.moveTo(W - 90, 14).lineTo(W - 20, 14).stroke({ width: 3, color: WOOD }); break;
    case "public": bench(20, 60); bench(W - 80, 60); break;
    default:
      if (sprite === "bakery") { oven(18); bench(W - 100, 84); shelf(W / 2 - 20, 40, 60); }
      else if (sprite === "smithy") { oven(W - 72); bench(16, 84); }
      else if (sprite === "mill") { g.circle(W * 0.3, floorY - 46, 30).stroke({ width: 4, color: WOOD }); g.circle(W * 0.3, floorY - 46, 6).fill(INK); bench(W - 100, 84); }
      else { bench(16, 84); bench(W - 100, 84); shelf(W / 2 - 25, 40, 50); }
  }
  return { seats, beds, benches };
}

const W = 288, H = 170;
/** One renderer for every interior, kept for the life of the page: destroying a second Pixi application next to the world's tears down what they share. */
let shared: Promise<Application> | null = null;
function interiorApp(): Promise<Application> {
  if (!shared) shared = (async () => { const app = new Application(); await app.init({ width: W, height: H, background: SAND, antialias: true, resolution: Math.min(2, window.devicePixelRatio || 1), autoDensity: true }); app.canvas.style.width = "100%"; app.canvas.style.height = "auto"; return app; })();
  return shared;
}

/** A cutaway of the building, with whoever is inside it right now in the pose the town reports. */
export function Interior({ kind, sprite, hour, people }: { kind: string; sprite: string; hour: number; people: InteriorPerson[] }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let alive = true; let app: Application | null = null; let onTick: (() => void) | null = null; let stage: Container | null = null;
    (async () => {
      const el = host.current!;
      app = await interiorApp();
      if (!alive) return;
      el.replaceChildren(app.canvas);
      stage = new Container(); app.stage.addChild(stage);
      const night = hour < 6 || hour >= 21; const floorY = H - 30;
      const room = new Graphics();
      room.rect(0, 0, W, floorY).fill(night ? WALL2 : WALL); for (let i = 0; i < 6; i++) room.rect(0, 12 + i * 22, W, 1).fill({ color: WALL2, alpha: 0.8 });
      room.rect(0, floorY, W, H - floorY).fill(FLOOR); for (let i = 0; i < 14; i++) room.rect(i * 22, floorY, 1, H - floorY).fill(FLOOR2);
      room.rect(0,floorY-9,W,8).fill(0xc8c2a7); room.rect(0,floorY-10,W,1).fill(0xebe1c6);
      for(let i=0;i<13;i++){const x=7+i*22;room.moveTo(x,floorY+4).quadraticCurveTo(x+4,floorY+13,x+2,H-3).stroke({width:.6,color:0x8d7d61,alpha:.45});}
      room.rect(0, floorY - 1, W, 2).fill({color:INK,alpha:.4});
      stage.addChild(room);
      const fur = new Graphics(); const spots = furnish(fur, kind, sprite, W, H, floorY); stage.addChild(fur);
      if (night) { const lamp = new Graphics(); lamp.circle(W / 2, 40, 70).fill({ color: LIGHT.lamp, alpha: 0.35 }); lamp.circle(W / 2, 22, 6).fill(LIGHT.lamp); stage.addChild(lamp); }
      // people, each at a spot that fits their pose
      const rigs: Citizen[] = []; let si = 0, bi = 0, wi = 0, xi = 0;
      for (const p of people.slice(0, 6)) {
        const pose: Pose = p.asleep || p.pose === "sleep" ? "sleep" : p.pose === "work" ? "work" : p.pose === "sit" ? "sit" : people.length > 1 ? "talk" : "idle";
        const c = new Citizen(aged(lookFor(p.name, p.appearance as Partial<Look> | null), p.age ?? 30)); c.age(p.age ?? 30); c.trade(p.job); c.scale.set(1.15); c.setPose(pose);
        let at: [number, number] | undefined;
        if (pose === "sleep") at = spots.beds[bi++]; else if (pose === "work") at = spots.benches[wi++]; else if (pose === "sit") at = spots.seats[si++];
        if (pose === "sit" && at) c.seatAt(-12/1.15);
        if (!at) { if(pose === "sit") c.setPose("idle"); at = [40 + (xi++) * 52 + (people.length > 1 ? 30 : 100), floorY - 2]; }
        c.position.set(at[0], at[1]); c.face(at[0] < W / 2 ? 1 : -1); stage.addChild(c); rigs.push(c);
      }
      const cut = new Graphics(); cut.rect(0, 0, W, H).stroke({ width: 6, color: SAND }); cut.rect(3, 3, W - 6, H - 6).stroke({ width: .7, color: INK, alpha: 0.6 }); stage.addChild(cut);
      onTick = () => { const t = performance.now() / 1000; for (const r of rigs) r.update(t); }; app.ticker.add(onTick);
    })();
    return () => { alive = false; if (app && onTick) app.ticker.remove(onTick); if (stage) { stage.removeFromParent(); stage.destroy({ children: true }); } };
  }, [kind, sprite, hour, people]);
  return <div ref={host} className="w-full rounded-2xl overflow-hidden bg-sand" style={{ aspectRatio: "288 / 170" }} />;
}
