"use client";
import { uiFont } from "@/lib/fonts";
import { useEffect, useRef } from "react";
import { Application, Container, Graphics, Text } from "pixi.js";
import { Page, Label } from "@/components/ui";
import { Citizen, lookFor, aged, type Look, type Pose } from "@/components/world/citizen";
import { drawThing, drawStock, DRAWN } from "@/components/world/buildings";
import { Portrait } from "@/components/Portrait";

/** The citizen rig, laid out like a model sheet: every part, every pose, and one person walking the length of the harbor. */
export default function Rig() {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let app: Application | null = null; let alive = true;
    (async () => {
      const el = host.current!;
      app = new Application();
      await app.init({ background: 0xefede4, resizeTo: el, antialias: true, resolution: Math.min(2, window.devicePixelRatio || 1), autoDensity: true });
      if (!alive) { app.destroy(true); return; }
      el.appendChild(app.canvas);
      const stage = new Container(); app.stage.addChild(stage);
      const S = 1.6; // model-sheet scale
      const rigs: { c: Citizen; walker?: boolean }[] = [];
      const row = (y: number, looks: Look[], pose: Pose) => looks.forEach((l, i) => { const c = new Citizen(l); c.scale.set(S); c.position.set(70 + i * 110, y); c.setPose(pose); stage.addChild(c); rigs.push({ c }); });
      const base: Look = { build: "Average", hair: "Bob", hat: "None", carrying: "Nothing", top: "Teal", bottom: "Sage", coral: "None" };
      // hair and hats
      row(150, (["Short dark", "Bob", "Curls", "Bun", "Grey", "Under a hat"] as const).map((hair) => ({ ...base, hair, hat: hair === "Under a hat" ? "Knit cap" : "None" })), "idle");
      row(150, (["Knit cap", "Wide brim", "Baker's cap", "Headscarf"] as const).map((hat, i): Look => ({ ...base, hat, coral: i % 2 ? "Hat band" : "None", top: (["Sage", "Cream", "Sand", "Kelp"] as const)[i]! })), "idle");
      // shift the second group to the right of the first
      rigs.slice(6).forEach((r, i) => r.c.position.set(70 + (6 + i) * 110, 150));
      // builds and carrying
      row(300, (["Slight", "Average", "Sturdy", "Tall"] as const).map((build, i) => ({ ...base, build, top: (["Teal", "Sage", "Kelp", "Cream"] as const)[i]!, bottom: (["Kelp", "Sand", "Sage", "Teal"] as const)[i]! })), "idle");
      const carries: Look[] = (["Suitcase", "Satchel", "Basket", "Tool bag", "Suitcase"] as const).map((carrying, i) => ({ ...base, carrying, coral: (i === 4 ? "Suitcase" : i === 1 ? "Scarf" : i === 2 ? "Buttons" : "None") as Look["coral"], hair: (["Short dark", "Curls", "Bun", "Grey", "Bob"] as const)[i]! }));
      carries.forEach((l, i) => { const c = new Citizen(l); c.scale.set(S); c.position.set(70 + (4 + i) * 110, 300); c.setPose("idle"); stage.addChild(c); rigs.push({ c }); });
      // poses
      const poses: Pose[] = ["idle", "walk", "run", "talk", "work", "sit", "sleep"];
      poses.forEach((pose, i) => { const c = new Citizen({ ...base, hair: "Short dark", carrying: "Tool bag", top: "Kelp", bottom: "Sand", build: "Sturdy" }); c.scale.set(S); c.position.set(70 + i * 110, 450); c.setPose(pose); stage.addChild(c); rigs.push({ c }); });
      // facings and faces: toward you, away, side on; hungry, glad, grieving, mid-word
      const faces: [string, (c: Citizen) => void][] = [["front", (c) => c.facing4("front")], ["back", (c) => c.facing4("back")], ["hungry", (c) => c.mood({ hunger: 1 })], ["glad", (c) => c.mood({ joy: 1 })], ["grieving", (c) => c.mood({ grief: 1 })], ["talking", (c) => { c.setPose("talk"); c.lookAt(60); }]];
      faces.forEach(([label, apply], i) => { const c = new Citizen({ ...base, hair: "Bob", top: "Sage", bottom: "Kelp" }); c.scale.set(S); c.position.set(820 + i * 80, 450); c.setPose("idle"); apply(c); stage.addChild(c); rigs.push({ c }); const t = new Text({ text: label, style: { fontFamily: uiFont(), fontSize: 11, fontWeight: "700", fill: 0x6f7a78 } }); t.anchor.set(0.5, 0); t.position.set(820 + i * 80, 458); stage.addChild(t); });
      // the trades at work, a thing in the other hand, and the years
      const trades: [string, string][] = [["smith's help", "nails"], ["cook at the bakery", "bread"], ["fish gutter", "fish"], ["sawyer", "planks"], ["field hand", "lavender"], ["woodcutter", "timber"], ["quarryman", "stone"], ["help at the inn", "soup"], ["mill hand", "flour"], ["dock hand", "lantern"]];
      trades.forEach(([job, item], i) => { const c = new Citizen({ ...base, hair: (["Short dark", "Bun", "Curls"] as const)[i % 3]!, top: (["Kelp", "Sage", "Cream", "Teal"] as const)[i % 4]! }); c.scale.set(S); c.position.set(70 + i * 118, 860); c.trade(job); c.hold(item); c.setPose("work"); stage.addChild(c); rigs.push({ c }); const t = new Text({ text: job, style: { fontFamily: uiFont(), fontSize: 11, fontWeight: "700", fill: 0x6f7a78 } }); t.anchor.set(0.5, 0); t.position.set(70 + i * 118, 868); stage.addChild(t); });
      [[6, "six"], [12, "twelve"], [30, "thirty"], [64, "sixty-four"], [78, "seventy-eight"]].forEach(([years, label], i) => { const c = new Citizen(aged({ ...base, hair: "Bob", top: "Teal" }, years as number)); c.scale.set(S); c.position.set(70 + i * 90, 990); c.age(years as number); c.setPose("idle"); stage.addChild(c); rigs.push({ c }); const t = new Text({ text: String(label), style: { fontFamily: uiFont(), fontSize: 11, fontWeight: "700", fill: 0x6f7a78 } }); t.anchor.set(0.5, 0); t.position.set(70 + i * 90, 998); stage.addChild(t); });
      // the cold: an elder, a child and two grown people wrapped up against a winter morning
      [[70, "seventy, in the cold"], [8, "eight"], [30, "thirty"], [34, "thirty-four"]].forEach(([years, label], i) => { const c = new Citizen(aged({ ...base, hair: i === 3 ? "Curls" : "Short dark", top: i === 2 ? "Kelp" : "Sage" }, years as number)); c.scale.set(S); c.position.set(1150 + i * 100, 990); c.age(years as number); c.setPose("idle"); c.weather({ rain: false, cold: true }); stage.addChild(c); rigs.push({ c }); const t = new Text({ text: String(label), style: { fontFamily: uiFont(), fontSize: 11, fontWeight: "700", fill: 0x6f7a78 } }); t.anchor.set(0.5, 0); t.position.set(1150 + i * 100, 998); stage.addChild(t); });
      // the walk: one citizen crossing the sheet and back
      const pier = new Graphics(); pier.roundRect(40, 560, 1000, 14, 7).fill(0xf7f5ee).stroke({ width: 1.6, color: 0x1e2a2b }); stage.addChild(pier);
      const walker = new Citizen(lookFor("Tomo Radić", { build: "Sturdy", hair: "Short dark", carrying: "Tool bag", top: "Kelp", bottom: "Sage" })); walker.scale.set(S); walker.position.set(80, 562); walker.setPose("walk"); stage.addChild(walker); rigs.push({ c: walker, walker: true });
      // a dozen strangers from names alone, so no two house citizens look the same
      ["Rosa Vidal", "Petar Ilić", "Ivana Horvat", "Luka Babić", "Ana Perić", "Vesna Marić", "Teodor Ilić", "Marko Petrić", "Katarina Jurić", "Goran Šimić", "Mara Tomić", "Jure Barić"].forEach((n, i) => { const c = new Citizen(lookFor(n, null)); c.scale.set(S); c.position.set(70 + i * 90, 700); c.setPose(i % 3 === 0 ? "talk" : "idle"); stage.addChild(c); rigs.push({ c }); });
      const label = (text: string, x: number, y: number) => { const t = new Text({ text, style: { fontFamily: uiFont(), fontSize: 11, fontWeight: "700", fill: 0x6f7a78 } }); t.anchor.set(0.5, 0); t.position.set(x, y); stage.addChild(t); };
      // the marks that tell people apart: beards, glasses, hair colours, patterns, shapes
      const marks: [string, Partial<Look>][] = [["moustache", { beard: "Moustache" }], ["short beard", { beard: "Short" }], ["full beard", { beard: "Full", hair: "Short dark" }], ["glasses", { glasses: true }], ["brown hair", { hairColor: "Brown", hair: "Curls" }], ["fair hair", { hairColor: "Fair", hair: "Bun" }], ["red hair", { hairColor: "Red" }], ["stripes", { pattern: "Stripes", top: "Cream" }], ["checks", { pattern: "Checks", top: "Sand" }], ["broad", { shape: "Broad", build: "Sturdy" }], ["round", { shape: "Round" }], ["all of it", { beard: "Full", glasses: true, hairColor: "Red", pattern: "Stripes", shape: "Round", top: "Cream", hair: "Short dark" }]];
      marks.forEach(([name, look], i) => { const c = new Citizen({ ...base, beard: "None", glasses: false, hairColor: "Dark", pattern: "Plain", shape: "Straight", ...look }); c.scale.set(S); c.position.set(70 + i * 95, 1130); c.setPose("idle"); stage.addChild(c); rigs.push({ c }); label(name, 70 + i * 95, 1138); });
      // more of the face, and what has come of them: angry, surprised, tired; broke, a roof of their own, an apron
      const more: [string, (c: Citizen) => void][] = [["angry", (c) => c.mood({ anger: 1 })], ["surprised", (c) => c.mood({ surprise: 1 })], ["tired", (c) => c.mood({ tired: 1 })], ["broke", (c) => c.wear({ broke: true })], ["a roof of their own", (c) => c.wear({ roof: true })], ["apron", (c) => c.trade("cook at the bakery")], ["no roof", (c) => c.wear({ roofless: true })]];
      more.forEach(([name, apply], i) => { const c = new Citizen({ ...base, hair: "Short dark", top: "Sage", bottom: "Kelp", beard: "None", glasses: false, hairColor: "Dark", pattern: "Plain", shape: "Straight" }); c.scale.set(S); c.position.set(70 + i * 110, 1280); c.setPose("idle"); apply(c); stage.addChild(c); rigs.push({ c }); label(name, 70 + i * 110, 1288); });
      // the new poses: a letter read and one written, a meal and a drink, a greeting, an argument
      const newPoses: [string, Pose][] = [["reads a letter", "read"], ["writes home", "write"], ["eats", "eat"], ["drinks", "drink"], ["greets", "greet"], ["argues", "argue"]];
      newPoses.forEach(([name, pose], i) => { const c = new Citizen({ ...base, hair: "Bob", carrying: "Basket", top: "Teal", bottom: "Sand", beard: "None", glasses: false, hairColor: "Dark", pattern: "Plain", shape: "Straight" }); c.scale.set(S); c.position.set(70 + i * 110, 1420); c.setPose(pose); if (pose === "argue") c.mood({ anger: 0.8 }); if (pose === "greet") c.mood({ joy: 0.7 }); stage.addChild(c); rigs.push({ c }); label(name, 70 + i * 110, 1428); });
      // every building and prop, at the world's scale
      const names = [...DRAWN]; let bx = 90, by = 1600, rowH = 0;
      for (const n of names) { const d = drawThing(n); if (!d) continue; const wpx = d.w * 1.1 + 30; if (bx + wpx > 1180) { bx = 90; by += rowH + 40; rowH = 0; } d.c.scale.set(1.1); d.c.position.set(bx + d.w * 0.55, by); stage.addChild(d.c); const t = new Text({ text: n, style: { fontFamily: uiFont(), fontSize: 11, fontWeight: "700", fill: 0x6f7a78 } }); t.anchor.set(0.5, 0); t.position.set(bx + d.w * 0.55, by + 6); stage.addChild(t); bx += wpx; rowH = Math.max(rowH, 150); }
      // the shelves as the street shows them: full, and half empty
      const SHELVES: [string, Record<string, number>][] = [["stall", { bread: 12, fish: 9, apples: 6 }], ["stall", { bread: 3, fish: 0, apples: 0 }], ["sawpit", { planks: 24, timber: 8 }], ["sawpit", { planks: 4 }], ["mill", { flour: 30, grain: 12 }], ["fishhouse", { fish: 14 }], ["tree-large", { timber: 14 }]];
      bx = 90; by += rowH + 60; rowH = 0;
      for (const [sprite, stock] of SHELVES) { const d = drawThing(sprite); if (!d) continue; const wpx = d.w * 1.1 + 30; if (bx + wpx > 1180) { bx = 90; by += rowH + 40; rowH = 0; } d.c.scale.set(1.1); d.c.position.set(bx + d.w * 0.55, by); stage.addChild(d.c); const st = drawStock(sprite, stock); if (st) { st.scale.set(1.1); st.position.set(bx + d.w * 0.55, by); stage.addChild(st); } const t = new Text({ text: Object.entries(stock).map(([k, v]) => `${v} ${k}`).join(" · "), style: { fontFamily: uiFont(), fontSize: 11, fontWeight: "700", fill: 0x6f7a78 } }); t.anchor.set(0.5, 0); t.position.set(bx + d.w * 0.55, by + 6); stage.addChild(t); bx += wpx; rowH = Math.max(rowH, 150); }
      // a building the island invented: Recraft's SVG, parsed straight into a Graphics context, footed and scaled like the drawn ones
      try {
        const svg = await (await fetch("/generated/boathouse.svg")).text();
        const g = new Graphics(); g.svg(svg); const b = g.getLocalBounds(); const target = 120; const sc = target / b.width;
        const gx = 1080, gy = 300;
        g.scale.set(sc); g.position.set(gx - (b.x + b.width / 2) * sc, gy - (b.y + b.height) * sc); stage.addChild(g);
        const t = new Text({ text: "boathouse · generated by Recraft, parsed as SVG", style: { fontFamily: uiFont(), fontSize: 11, fontWeight: "700", fill: 0x6f7a78 } }); t.anchor.set(0.5, 0); t.position.set(gx, gy + 6); stage.addChild(t);
      } catch (e) { console.warn("generated building did not load", e); }
      let dir = 1;
      app.ticker.add(() => {
        const t = performance.now() / 1000;
        for (const r of rigs) { if (r.walker) { r.c.position.x += dir * 1.4; if (r.c.position.x > 1020) dir = -1; if (r.c.position.x < 60) dir = 1; r.c.face(dir as 1 | -1); } r.c.update(t); }
      });
    })();
    return () => { alive = false; try { app?.destroy(true); } catch {} };
  }, []);
  return (
    <Page>
      <div className="flex flex-col gap-2 pt-4"><Label>The citizen rig · model sheet</Label><h1 className="display text-[32px] sm:text-[40px] font-bold">One body, drawn from parts.</h1><p className="text-[17px] text-ink2 max-w-[70ch]">Hair and hats, builds and what they carry, the seven poses and the faces, one person walking the pier, twelve house citizens whose looks come from their names alone, and every building and prop on the island in the same hand, with the shelves full and half empty.</p></div>
      <div className="flex flex-wrap gap-3 items-center"><Label>Portraits · the same rig, head and shoulders</Label>{["Tomo Radić", "Rosa Vidal", "Petar Ilić", "Ivana Horvat", "Luka Babić", "Ana Perić", "Vesna Marić", "Teodor Ilić"].map((n, i) => <Portrait key={n} name={n} age={i === 2 ? 68 : i === 5 ? 12 : 34} size={56} />)}</div>
      <div ref={host} className="relative w-full h-[2400px] rounded-[28px] overflow-hidden bg-sand" />
    </Page>
  );
}
