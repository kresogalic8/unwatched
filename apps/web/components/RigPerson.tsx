"use client";
import { useEffect, useState } from "react";
import { Application, Rectangle } from "pixi.js";
import { Citizen, lookFor, type Look, type Pose } from "./world/citizen";
import { P } from "./world/harbor-art";

// SVG scenes use snapshots of the production rig, preserving their depth ordering.
// A single stopped renderer serves every person; the town itself remains animated.
let renderer: Promise<Application> | undefined;
const snapshots = new Map<string, Promise<string>>();
function snapshot(name: string, top: Look["top"], hat: boolean, pose: "walk" | "talk" | "carry") {
  const key = JSON.stringify([name, top, hat, pose]);
  let result = snapshots.get(key);
  if (!result) {
    result = (async () => {
      if (!renderer) renderer = (async () => {
        const app = new Application();
        await app.init({ width: 100, height: 100, backgroundAlpha: 0, antialias: true, resolution: 3 });
        app.ticker.stop(); return app;
      })().catch(error => { renderer = undefined; throw error; });
      const app = await renderer;
      const citizen = new Citizen(lookFor(name, { top, hat: hat ? "Wide brim" : "None", carrying: pose === "carry" ? "Basket" : "Nothing" }));
      try {
        citizen.setPose((pose === "carry" ? "walk" : pose) as Pose); citizen.update(0.4);
        return (app.renderer.extract.canvas({ target: citizen, frame: new Rectangle(-40, -80, 100, 100), resolution: 3 }) as HTMLCanvasElement).toDataURL("image/png");
      } finally { citizen.destroy({ children: true }); }
    })();
    snapshots.set(key, result);
    void result.catch(() => snapshots.delete(key));
  }
  return result;
}
export function RigPerson({ u, v, name, top = "Teal", hat = false, pose = "walk", flip = false }: {
  u: number; v: number; name: string; top?: Look["top"]; hat?: boolean; pose?: "walk" | "talk" | "carry"; flip?: boolean;
}) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => { let active = true; setSrc(null); void snapshot(name, top, hat, pose).then(url => { if (active) setSrc(url); }).catch(() => {}); return () => { active = false; }; }, [name, top, hat, pose]);
  const [x, y] = P(u, v);
  return src ? <g transform={`translate(${x} ${y}) scale(${flip ? -1 : 1} 1)`}><image href={src} x={-40} y={-80} width={100} height={100} aria-label={name} /></g> : null;
}
