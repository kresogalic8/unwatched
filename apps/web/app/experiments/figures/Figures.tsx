"use client";
import { useEffect, useRef } from "react";
import { Application, Container, Text } from "pixi.js";
import { Figurine } from "@/components/world/figurine";
import { aged, lookFor, type Look, type Pose } from "@/components/world/citizen";

/** Who stands in the line-up: a name for the look, an age, a trade, a pose. */
const LINE: { name: string; age: number; job: string | null; pose: Pose; look?: Partial<Look> }[] = [
  { name: "Luka", age: 7, job: null, pose: "idle" },
  { name: "Mia", age: 9, job: null, pose: "walk" },
  { name: "Petra", age: 11, job: null, pose: "idle" },
  { name: "Ivo", age: 44, job: "fisher", pose: "idle", look: { hat: "None", hair: "Short dark" } },
  { name: "Marko", age: 38, job: "smith", pose: "idle" },
  { name: "Ana", age: 31, job: "baker", pose: "idle" },
  { name: "Nika", age: 35, job: "fishmonger", pose: "idle" },
  { name: "Josip", age: 50, job: "innkeeper", pose: "idle" },
  { name: "Lucija", age: 29, job: "shopkeeper", pose: "idle" },
  { name: "Tomo", age: 41, job: "field hand", pose: "idle" },
  { name: "Zora", age: 74, job: null, pose: "idle", look: { carrying: "Nothing" } },
  { name: "Frane", age: 81, job: null, pose: "walk", look: { carrying: "Nothing" } },
];

export function Figures() {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let alive = true; let app: Application | null = null;
    (async () => {
      const a = new Application(); await a.init({ width: 1100, height: 300, background: 0xe9e4d6, antialias: true, resolution: Math.min(2, window.devicePixelRatio || 1), autoDensity: true });
      if (!alive) { a.destroy(true); return; } app = a; host.current?.replaceChildren(a.canvas);
      const row = new Container(); a.stage.addChild(row); const figs: Figurine[] = [];
      LINE.forEach((p, i) => {
        const f = new Figurine(aged({ ...lookFor(p.name, null), ...p.look } as Look, p.age), i * 1.37); f.age(p.age); f.trade(p.job); f.setPose(p.pose); f.scale.set(1.9); f.position.set(55 + i * 88, 220); row.addChild(f); figs.push(f);
        const label = new Text({ text: `${p.name}, ${p.age}${p.job ? `\n${p.job}` : ""}`, style: { fontFamily: "system-ui", fontSize: 11, fill: 0x4f6257, align: "center" } }); label.anchor.set(0.5, 0); label.position.set(55 + i * 88, 236); row.addChild(label);
      });
      a.ticker.add(() => { const t = performance.now() / 1000; for (const f of figs) { if (f.pose === "walk") f.travel(0.6); f.update(t); } });
    })();
    return () => { alive = false; app?.destroy(true, { children: true }); };
  }, []);
  return <main style={{ maxWidth: 1140, margin: "40px auto", padding: 16 }}><h1 style={{ fontSize: 36, margin: "0 0 12px" }}>Figures</h1><div ref={host} /></main>;
}
