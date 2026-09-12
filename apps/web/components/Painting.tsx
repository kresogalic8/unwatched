"use client";
import { uiFont } from "@/lib/fonts";
import { useEffect, useRef } from "react";
import { Application, Container, Graphics, Text } from "pixi.js";
import { Citizen, lookFor } from "@/components/world/citizen";
import { loadWorldArt, drawThing } from "@/components/world/buildings";
import type { PaperScene } from "@/lib/api";
import { KELP, SAND, GROUND, LIGHT, SKY } from "@/components/world/palette";

/**
 * The daily painting: the front page's picture, composed on the reader's screen from the same hand that draws the
 * world. The engine chooses the moment (a place, the people who were there, the hour, the weather); this puts the
 * building at the centre, the people in front of it in a pose that fits, and the sky and the weather over it all.
 * Nothing is generated off the island: it is the world's own drawing, framed.
 */
export function Painting({ scene, edition }: { scene: PaperScene; edition: number }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let app: Application | null = null; let alive = true;
    (async () => {
      const el = host.current!; const W = 720, H = 400;
      app = new Application();
      await loadWorldArt();
      await app.init({bezierSmoothness:.97, width: W, height: H, background: SAND, antialias: true, resolution: Math.min(2, window.devicePixelRatio || 1), autoDensity: true });
      if (!alive) { app.destroy(true); return; }
      el.replaceChildren(app.canvas); app.canvas.style.width = "100%"; app.canvas.style.height = "auto";
      const stage = new Container(); app.stage.addChild(stage);
      const night = scene.hour < 6 || scene.hour >= 21; const dusk = !night && (scene.hour < 8 || scene.hour >= 18);
      const sky = new Graphics();
      const band = night ? SKY.night : scene.weather === "storm" ? SKY.storm : scene.weather === "rain" || scene.weather === "fog" ? SKY.grey : dusk ? SKY.dusk : SKY.day; const [top, bottom] = band;
      for (let i = 0; i < 24; i++) { const t = i / 23; const mix = (a: number, b: number) => { const r = ((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t, g = ((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t, bl = (a & 255) * (1 - t) + (b & 255) * t; return (r << 16) | (g << 8) | bl; }; sky.rect(0, i * (H * 0.62) / 24, W, (H * 0.62) / 24 + 1).fill(mix(top, bottom)); }
      stage.addChild(sky);
      if (night) { for (let i = 0; i < 40; i++) sky.circle((i * 173) % W, (i * 97) % (H * 0.45), i % 5 === 0 ? 1.6 : 1).fill({ color: LIGHT.star, alpha: 0.7 }); sky.circle(W - 110, 70, 22).fill(LIGHT.lamp); }
      else if (scene.weather === "clear" || scene.weather === "wind") sky.circle(W - 120, 84, 30).fill({ color: dusk ? 0xffb37a : 0xfff0b0, alpha: 0.95 });
      // the sea, far off, and the ground
      const sea = new Graphics(); sea.rect(0, H * 0.58, W, H * 0.08).fill(night ? 0x1f3a42 : scene.weather === "storm" ? 0x4c6a74 : GROUND.waterDeep); stage.addChild(sea);
      const ground = new Graphics(); ground.rect(0, H * 0.64, W, H * 0.36).fill(night ? 0x3a4a44 : scene.weather === "rain" || scene.weather === "storm" ? GROUND.wetSand : GROUND.sand); ground.ellipse(W / 2, H * 0.78, 300, 44).fill({ color: 0xffffff, alpha: night ? 0.04 : 0.18 }); stage.addChild(ground);
      // the place
      const d = drawThing(scene.sprite) ?? drawThing("house");
      if (d) { const s = Math.min(2.4, 240 / d.w); d.c.scale.set(s); d.c.position.set(W / 2, H * 0.74); stage.addChild(d.c); }
      // the people who were there
      const names = scene.actors.slice(0, 4); const rigs: Citizen[] = [];
      names.forEach((n, i) => {
        const c = new Citizen(lookFor(n, null)); c.scale.set(2.1);
        const side = i % 2 === 0 ? -1 : 1; const k = Math.floor(i / 2);
        c.position.set(W / 2 + side * (150 + k * 70), H * 0.84 + k * 10); c.face(side === -1 ? 1 : -1);
        c.setPose(names.length >= 2 ? "talk" : night ? "idle" : "work"); stage.addChild(c); rigs.push(c);
      });
      // the weather over everything
      const wx = new Graphics(); stage.addChild(wx);
      if (scene.weather === "rain" || scene.weather === "storm") for (let i = 0; i < 260; i++) { const x = (i * 97) % W, y = (i * 53) % H; wx.moveTo(x, y).lineTo(x - 3, y + 14).stroke({ width: 1, color: 0xdfe8ea, alpha: 0.55 }); }
      if (scene.weather === "snow") for (let i = 0; i < 140; i++) wx.circle((i * 131) % W, (i * 71) % H, 1.5 + (i % 3) * 0.6).fill({ color: 0xffffff, alpha: 0.85 });
      if (scene.weather === "fog") for (let i = 0; i < 9; i++) wx.ellipse((i * 211) % W, H * 0.5 + (i % 3) * 40, 260, 60).fill({ color: 0xe8ecec, alpha: 0.22 });
      if (night) { const shade = new Graphics(); shade.rect(0, 0, W, H).fill({ color: 0x0e2a30, alpha: 0.38 }); stage.addChild(shade); }
      // the frame and the caption, like a plate in a paper
      const frame = new Graphics(); frame.rect(0, 0, W, H).stroke({ width: 10, color: SAND }); frame.rect(5, 5, W - 10, H - 10).stroke({ width: 1.5, color: KELP, alpha: 0.5 }); stage.addChild(frame);
      const cap = new Text({ text: `${scene.placeName}, ${String(scene.hour).padStart(2, "0")}:00 · ${scene.weather} · plate ${edition}`, style: { fontFamily: uiFont(), fontSize: 12, fontWeight: "700", fill: KELP } });
      const capBg = new Graphics(); capBg.roundRect(14, H - 34, cap.width + 20, 24, 12).fill({ color: SAND, alpha: 0.92 }); stage.addChild(capBg); cap.position.set(24, H - 29); stage.addChild(cap);
      app.ticker.add(() => { const t = performance.now() / 1000; for (const r of rigs) r.update(t); });
    })();
    return () => { alive = false; try { app?.destroy(true); } catch {} };
  }, [scene, edition]);
  return <div ref={host} className="w-full rounded-[20px] overflow-hidden bg-sand" style={{ aspectRatio: "720 / 400" }} />;
}
