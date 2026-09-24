"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Application, BlurFilter, Container, FillGradient, Graphics, Rectangle, Text, TextStyle } from "pixi.js";
import { TiltShiftFilter } from "pixi-filters";
import { API, type Clock, type PublicAgent, type TownEvent } from "@/lib/api";
import { decorFor } from "@/components/World";
import { loadWorldArt, drawThing, lightWorldArt, setSeason, worldLight } from "@/components/world/buildings";
import { drawGround, drawRoads, keepOffRoads, segmentsOf, type TerrainPlace } from "@/components/world/terrain";
import { Citizen, aged, lookFor, type Look } from "@/components/world/citizen";
import { WaterFilter, mix } from "@/components/world/fx";
import { GradeFilter, gradeFor } from "@/components/world/post";
import { GROUND } from "@/components/world/palette";
import { uiFont } from "@/lib/fonts";
import { castShadow, litFaces, paintLight, specFor, sunAt, type Spec, type Sun } from "./light";
import { BAY, TABLE, dioramaGrade, drawPlinth, drawTable, drybrush } from "./diorama";
import s from "./world-styles.module.css";

type Style = "current" | "painted" | "diorama";
type PlaceView = TerrainPlace & { name: string; district: string; sprite: string; crowd: number; site: unknown };
type TownView = Clock & { size: { w: number; h: number }; places: PlaceView[] };
const STYLES: { id: Style; name: string; note: string }[] = [
  { id: "current", name: "As it ships", note: "The town today: the drawn buildings, each wall lit by the sun, soft shadows and the hour's grade." },
  { id: "painted", name: "Painted light", note: "Shadows shaped like the buildings that cast them, laid along the sun. Shade where walls meet the ground, warmth thrown up from sunlit sand, and a bright line along the edges the sun grazes." },
  { id: "diorama", name: "Miniature", note: "The island as a model on a table, shot close. A wooden plinth, a bay of resin sea, and a shallow band of focus. Painted edges pick out every roof and corner. The people move in stop-motion." },
];
const OLD_TOWN = ["market", "lane", "council", "chapel", "bakery", "smithy", "tavern", "chandlery"];
const VARIANTS: Record<string, string[]> = { house: ["house", "house2", "house3"], cottage: ["cottage", "cottage2", "cottage3"], shop: ["shop", "shop2", "shop3"] };
const vhash = (x: number, y: number, k: number) => { const h = Math.sin(x * 12.9898 + y * 78.233 + k * 37.719) * 43758.5453; return h - Math.floor(h); };
const hm = (t?: string | null) => (t ? Number(t.slice(0, 2)) + Number(t.slice(3, 5)) / 60 : null);
const fmtHour = (h: number) => { const m = Math.round(h * 60); return `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; };
/** Stop-motion: the miniature's people are posed twelve times a second, as if moved by hand between frames. */
const STOP_FPS = 12;

export function WorldStyles() {
  const host = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<Style>("diorama");
  const [hour, setHour] = useState(17.9);
  const [live, setLive] = useState(false);
  const [weather, setWeather] = useState("clear");
  const [clock, setClock] = useState<Clock | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const want = useRef({ style, hour, live, weather }); want.current = { style, hour, live, weather };

  useEffect(() => {
    let alive = true; let app: Application | null = null; let ws: WebSocket | null = null;
    void (async () => {
      const [town, agents] = await Promise.all([fetch(`${API}/api/town`, { cache: "no-store" }).then((r) => r.json() as Promise<TownView>), fetch(`${API}/api/agents`, { cache: "no-store" }).then((r) => r.json() as Promise<PublicAgent[]>)]);
      if (!alive) return; setClock(town); let clockNow: Clock = town;
      await loadWorldArt(); app = new Application();
      await app.init({ background: GROUND.water, resizeTo: host.current!, antialias: true, resolution: Math.min(2, window.devicePixelRatio || 1), autoDensity: true });
      if (!alive) { app.destroy(true); return; }
      host.current!.appendChild(app.canvas);
      const W = town.size?.w ?? 3000, H = town.size?.h ?? 1800;
      const places = new Map(town.places.map((p) => [p.id, p]));
      // the island's outline, the same blob the town draws
      const cx = W / 2, cy = H / 2 + 40, Rx = W / 2 - 120, Ry = H / 2 - 100;
      const wobble = (a: number) => 1 + 0.14 * Math.sin(a * 3 + 0.7) + 0.08 * Math.cos(a * 5 + 2);
      const inside = (x: number, y: number) => { const a = Math.atan2((y - cy) / Ry, (x - cx) / Rx); return Math.hypot((x - cx) / (Rx * wobble(a)), (y - cy) / (Ry * wobble(a))); };
      const outline = (t: number): [number, number][] => Array.from({ length: 240 }, (_, k) => { const a = (k / 240) * Math.PI * 2, r = wobble(a) * t; return [cx + Rx * r * Math.cos(a), cy + Ry * r * Math.sin(a)] as [number, number]; });
      const rim = outline(BAY);

      const world = new Container(); app.stage.addChild(world);
      // the miniature's table and plinth, under everything; hidden for the other styles
      const table = new Graphics(); drawTable(table, W, H); world.addChild(table);
      const plinthShadow = new Graphics(); world.addChild(plinthShadow); plinthShadow.filters = [new BlurFilter({ strength: 40, quality: 3 })];
      const plinth = new Graphics(); world.addChild(plinth);
      const openSea = new Graphics().rect(-3000, -3000, W + 6000, H + 6000).fill(GROUND.water); world.addChild(openSea);
      const resin = new Graphics().poly(rim.flat()).fill(GROUND.water); world.addChild(resin);
      setSeason(town.season ?? "summer");
      world.addChild(drawGround({ W, H, cx, cy, inside, outline, places, oldTown: OLD_TOWN }, town.season ?? "summer"));
      const segs = segmentsOf(places, OLD_TOWN); world.addChild(drawRoads(segs));
      const casts = new Graphics(); world.addChild(casts);
      const scene = new Container(); scene.sortableChildren = true; world.addChild(scene);
      const veil = new Graphics().rect(-4000, -4000, W + 8000, H + 8000).fill(0xffffff); veil.blendMode = "multiply"; veil.alpha = 0; world.addChild(veil);
      // after dark the miniature is lit the way a model on a desk is: one warm lamp over the middle of it, the room gone dark around
      const lampGlow = new FillGradient({ type: "radial", center: { x: 0.5, y: 0.5 }, innerRadius: 0, outerCenter: { x: 0.5, y: 0.5 }, outerRadius: 0.5, colorStops: [{ offset: 0, color: "rgba(255,196,120,0.55)" }, { offset: 0.45, color: "rgba(255,170,90,0.22)" }, { offset: 1, color: "rgba(255,160,80,0)" }] });
      const lamp = new Graphics().rect(cx - Rx * 1.5, cy - Ry * 1.6, Rx * 3, Ry * 3.2).fill(lampGlow); lamp.blendMode = "add"; lamp.alpha = 0; world.addChild(lamp);

      // the street: every built place from the atlas, with the layers each study adds
      type House = { c: Container; spec: Spec; at: { x: number; y: number }; dark: Graphics; bright: Graphics; brush: Graphics; crowd: number };
      const houses: House[] = []; const footprints: { x: number; y: number; w: number }[] = [];
      const labelStyle = new TextStyle({ fontFamily: uiFont(), fontSize: 10, fontWeight: "500", fill: 0x536451, letterSpacing: 1.2, stroke: { color: 0xeee5cd, width: 2, join: "round" } });
      for (const p of places.values()) {
        if (p.kind === "plot" || p.site) continue;
        const name = p.sprite.startsWith("look:") ? "house" : (VARIANTS[p.sprite]?.[Math.floor(vhash(p.x, p.y, 13) * 3)] ?? p.sprite);
        const art = drawThing(name); if (!art) continue;
        art.c.position.set(p.x, p.y); art.c.zIndex = p.y; scene.addChild(art.c); footprints.push({ x: p.x, y: p.y, w: art.w });
        const spec = specFor(name);
        if (spec) { const dark = new Graphics(), bright = new Graphics(), brush = new Graphics(); dark.blendMode = "multiply"; bright.blendMode = "add"; brush.blendMode = "add"; art.c.addChild(dark, bright, brush); houses.push({ c: art.c, spec, at: { x: p.x, y: p.y }, dark, bright, brush, crowd: p.crowd }); }
        const label = new Text({ text: p.name.replace(/^the /, "").replace(/^an? /, "").toUpperCase(), style: labelStyle }); label.anchor.set(0.5, 0); label.position.set(p.x, p.y + 6); label.zIndex = 100000; scene.addChild(label);
      }
      for (const d of keepOffRoads(decorFor([...places.values()]), segs)) {
        const art = drawThing(d.sprite); if (!art) continue;
        if (d.w) art.c.scale.set(d.w / art.w); if (d.flip) art.c.scale.x *= -1;
        art.c.position.set(d.x, d.y); art.c.zIndex = d.y; scene.addChild(art.c);
        if (!/^(lamp|fence|field|pier)$/.test(d.sprite)) footprints.push({ x: d.x, y: d.y, w: d.w ?? art.w });
      }

      // the people, where the record puts them
      type Fig = { id: string; rig: Citizen; x: number; y: number; tx: number; ty: number; place: string; asleep: boolean };
      const figs = new Map<string, Fig>(); const seats = new Map<string, number>();
      const spot = (place: string) => { const p = places.get(place) ?? places.get("market")!; const n = seats.get(place) ?? 0; seats.set(place, (n + 1) % 10); return { x: p.x - 90 + (n % 5) * 45, y: p.y + 40 + Math.floor(n / 5) * 26 }; };
      for (const a of agents) { const at = spot(a.location); const rig = new Citizen(aged(lookFor(a.name, a.appearance as Partial<Look> | null), a.age)); rig.scale.set(0.82); rig.position.set(at.x, at.y); rig.zIndex = at.y; scene.addChild(rig); figs.set(a.id, { id: a.id, rig, x: at.x, y: at.y, tx: at.x, ty: at.y, place: a.location, asleep: a.asleep }); }
      const moveTo = (id: string, place: string) => { const f = figs.get(id); if (!f || f.place === place) return; const to = spot(place); f.tx = to.x; f.ty = to.y; f.place = place; };
      ws = new WebSocket(API.replace(/^http/, "ws") + "/stream");
      ws.onmessage = (m) => {
        const msg = JSON.parse(m.data as string) as { type: string; clock?: Clock; event?: TownEvent };
        if (msg.clock) { clockNow = msg.clock; setClock(msg.clock); }
        const e = msg.event; if (!e) return; const who = e.actors[0]; if (!who) return;
        if (e.kind === "agent.move" && e.place) moveTo(who, e.place);
        if (e.kind === "agent.sleep" || e.kind === "agent.wake") { const f = figs.get(who); if (f) f.asleep = e.kind === "agent.sleep"; }
      };

      // the look of the moment, rebuilt only when the style, the hour or the weather changes
      const water = new WaterFilter(); water.island(cx, cy, Rx, Ry);
      const grade = new GradeFilter(); const blur = new BlurFilter({ strength: 3, quality: 2 });
      const tilt = new TiltShiftFilter({ blur: 14, gradientBlur: 500 });
      const screen = new Rectangle(); casts.filterArea = screen;
      let lastKey = ""; let sunNow: Sun = sunAt(12, 6.5, 19.5);
      const relight = (st: Style, sun: Sun, wx: string) => {
        const model = st === "diorama"; const cover = wx === "storm" ? 1 : wx === "rain" ? 0.85 : wx === "fog" ? 0.9 : 0;
        // the sun on each face, as the live town does it; a model lamp is a little harder
        const lit = litFaces(sun.L); const day = sun.up ? 1 - sun.night : 0;
        for (const face of ["front", "side", "roof"] as const) { worldLight.shade[face] = (model ? 0.46 : 0.38) * day * (1 - cover * 0.8) * Math.max(0, 0.55 - lit[face]) / 0.55; worldLight.glow[face] = 0.55 * sun.golden * (1 - cover) * day * lit[face]; }
        worldLight.shadeTint = mix(0x5d6b8c, 0x6a5f86, sun.golden); worldLight.glowTint = mix(0x66502a, sun.phase === "rise" ? 0x63501f : 0x6a4620, 0.5);
        for (const hs of houses) {
          hs.dark.visible = hs.bright.visible = st !== "current"; hs.brush.visible = model;
          if (st !== "current") paintLight(hs.dark, hs.bright, hs.spec, sun);
          if (model) drybrush(hs.brush, hs.spec, sun);
          lightWorldArt(hs.c, sun.night > 0.35 && hs.crowd > 0);
        }
        // shadows: pools under things as the town ships; house-shaped casts for the studies, darker and crisper under a model lamp
        casts.clear();
        if (sun.up && cover < 0.95) {
          const a = (0.1 + sun.golden * 0.05) * (1 - cover * 0.7) * (model ? 1.25 : 1); const lean = sun.L[0] > 0 ? -1 : 1; const len = 0.12 + Math.pow(1 - Math.max(0, sun.L[2]), 2) * 0.9;
          const houseAt = new Set<string>();
          if (st !== "current") for (const hs of houses) { const poly = castShadow(hs.spec, sun); if (!poly) continue; houseAt.add(`${hs.at.x},${hs.at.y}`); casts.poly(poly.flat().map((v, i) => v + (i % 2 ? hs.at.y : hs.at.x))).fill({ color: sun.golden > 0.05 ? 0x5a4a6a : 0x2f4a44, alpha: a * 1.6 }); }
          for (const fp of footprints) {
            if (houseAt.has(`${fp.x},${fp.y}`) || fp.w < 30) continue;
            const rx = fp.w * 0.5, ry = Math.max(6, fp.w * 0.16), bx = fp.x + fp.w * 0.12, by = fp.y + 4, l = fp.w * len * 0.7;
            casts.poly([bx - rx * 0.75, by, bx + rx * 0.75, by, bx + rx * 0.75 + lean * l, by - l * 0.22, bx - rx * 0.75 + lean * l, by - l * 0.22]).fill({ color: 0x2f4a44, alpha: a * 0.8 });
            casts.ellipse(bx, by, rx, ry).fill({ color: 0x2f4a44, alpha: a });
          }
        }
        casts.filters = [blur];
        // the model's surroundings: table, plinth and a bay of resin in place of the open sea
        table.visible = plinth.visible = plinthShadow.visible = resin.visible = model; openSea.visible = !model;
        if (model) drawPlinth(plinthShadow, plinth, rim, sun);
        (model ? resin : openSea).filters = [water]; (model ? openSea : resin).filters = null;
        veil.tint = mix(0x2b3350, 0x3a3558, sun.blue); veil.alpha = sun.night * (model ? 0.72 : 0.62); lamp.visible = model; lamp.alpha = sun.night * 0.8;
        const g = gradeFor({ golden: sun.golden * (1 - cover * 0.7), blue: sun.blue * (1 - cover * 0.4), night: sun.night, cover, weather: wx });
        grade.set(model ? dioramaGrade(g) : g); app!.stage.filters = model ? [grade, tilt] : [grade];
        app!.renderer.background.color = model ? TABLE : GROUND.water;
      };

      // the camera: drag to look around, wheel to zoom; it starts over the old town
      const market = places.get("market") ?? { x: W / 2, y: H / 2 };
      const cam = { x: market.x, y: market.y - 60, zoom: 1.15 }; let press: { x: number; y: number } | null = null;
      app.canvas.addEventListener("pointerdown", (e) => { press = { x: e.clientX, y: e.clientY }; });
      app.canvas.addEventListener("pointermove", (e) => { if (!press) return; cam.x -= (e.clientX - press.x) / cam.zoom; cam.y -= (e.clientY - press.y) / cam.zoom; press = { x: e.clientX, y: e.clientY }; });
      for (const ev of ["pointerup", "pointerleave", "pointercancel"]) app.canvas.addEventListener(ev, () => { press = null; });
      app.canvas.addEventListener("wheel", (e) => { e.preventDefault(); cam.zoom = Math.min(2.4, Math.max(0.3, cam.zoom * Math.exp(-e.deltaY * 0.0012))); }, { passive: false });

      setStatus("ready");
      let t = 0; let lastPose = -1;
      app.ticker.add(() => {
        if (!app) return; const dt = Math.min(app.ticker.deltaMS, 100) / 1000; t += dt;
        const w = want.current; const hr = w.live ? clockNow.hour + (clockNow.minute % 60) / 60 : w.hour;
        const rise = hm((clockNow as Clock & { sunrise?: string }).sunrise) ?? 6.5, set = hm((clockNow as Clock & { sunset?: string }).sunset) ?? 19.5;
        const wx = w.live ? clockNow.weather : w.weather; const key = `${w.style}|${hr.toFixed(2)}|${wx}|${rise}|${set}`;
        if (key !== lastKey) { lastKey = key; sunNow = sunAt(hr, rise, set); relight(w.style, sunNow, wx); }
        const model = w.style === "diorama";
        const Wd = app.screen.width, Hd = app.screen.height; const sx = Wd / 2 - cam.x * cam.zoom, sy = Hd / 2 - cam.y * cam.zoom;
        world.scale.set(cam.zoom); world.position.set(sx, sy);
        screen.x = -sx / cam.zoom; screen.y = -sy / cam.zoom; screen.width = Wd / cam.zoom; screen.height = Hd / cam.zoom;
        blur.strength = (model ? 1.6 : 2.8) * cam.zoom;
        // the focus band sits a little below the middle, where the eye rests, and narrows as the camera comes closer
        if (model) { tilt.start = { x: 0, y: Hd * 0.54 }; tilt.end = { x: Wd, y: Hd * 0.54 }; tilt.gradientBlur = Hd * (0.62 - 0.14 * Math.min(1, Math.max(0, (cam.zoom - 0.5) / 1.5))); }
        water.update({ time: model ? t * 0.35 : t, cam: { x: sx, y: sy, zoom: cam.zoom }, sun: { x: cx, y: cy - Ry * 1.1, strength: (sunNow.up ? 0.9 : 0.2) * (model ? 1.4 : 1) }, color: GROUND.water, deep: GROUND.waterDeep, glint: mix(0xffe9a8, 0xff8f57, sunNow.golden), rough: wx === "storm" ? 1 : 0, night: sunNow.night });
        // people: smooth in the drawn town; in the miniature they are moved a frame at a time
        const pose = Math.floor(t * STOP_FPS); const posed = !model || pose !== lastPose; lastPose = pose;
        for (const f of figs.values()) {
          const dx = f.tx - f.x, dy = f.ty - f.y, d = Math.hypot(dx, dy); const walking = d > 1;
          if (walking) { const st = Math.min(d, 48 * dt); f.x += (dx / d) * st; f.y += (dy / d) * st; }
          f.rig.visible = !f.asleep; if (!posed || !f.rig.visible) continue;
          f.rig.position.set(f.x, f.y); f.rig.zIndex = f.y;
          f.rig.setPose(walking ? "walk" : "idle"); if (walking && Math.abs(dx) > 0.1) f.rig.face(dx < 0 ? -1 : 1);
          f.rig.travel(walking ? Math.min(d, 48 * (model ? 1 / STOP_FPS : dt)) / 0.82 : 0);
          f.rig.update(model ? pose / STOP_FPS : t);
        }
      });
    })().catch(() => { if (alive) setStatus("error"); });
    return () => { alive = false; ws?.close(); if (app?.renderer) app.destroy(true, { children: true }); for (const face of ["front", "side", "roof"] as const) { worldLight.shade[face] = 0; worldLight.glow[face] = 0; } };
  }, []);

  const effHour = live && clock ? clock.hour + (clock.minute % 60) / 60 : hour;
  const current = STYLES.find((x) => x.id === style)!;
  return (
    <main className={s.page}>
      <div ref={host} className={s.canvas} />
      {style === "diorama" && <div className={s.lens} aria-hidden />}
      {status !== "ready" && <div className={s.status}>{status === "error" ? "The island could not be reached. Is the server running on :4000?" : "Crossing to the island…"}</div>}
      <header className={s.top}>
        <Link href="/experiments" className={s.back}>← Experiments</Link>
        <div className={s.switch} role="radiogroup" aria-label="World style">
          {STYLES.map((x) => <button key={x.id} role="radio" aria-checked={style === x.id} className={style === x.id ? s.on : ""} onClick={() => setStyle(x.id)}>{x.name}</button>)}
        </div>
      </header>
      <footer className={s.panel}>
        <p className={s.note}><strong>{current.name}.</strong> {current.note}</p>
        <div className={s.controls}>
          <label className={s.hour}><span>Hour <b>{fmtHour(effHour)}</b></span><input type="range" min={0} max={23.99} step={0.05} value={effHour} disabled={live} onChange={(e) => setHour(Number(e.target.value))} /></label>
          <label className={s.check}><input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} /> Live hour and sky</label>
          <label className={s.select}>Weather <select value={weather} disabled={live} onChange={(e) => setWeather(e.target.value)}>{["clear", "wind", "rain", "fog", "storm"].map((w) => <option key={w}>{w}</option>)}</select></label>
          <div className={s.presets}>{[["Dawn", 7.2], ["Noon", 13], ["Golden", 17.9], ["Night", 22]].map(([n, h]) => <button key={n} disabled={live} onClick={() => setHour(h as number)}>{n}</button>)}</div>
        </div>
      </footer>
    </main>
  );
}
