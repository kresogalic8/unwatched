"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Application, BlurFilter, Container, FillGradient, Graphics, Rectangle, Sprite, Text, TextStyle, Texture } from "pixi.js";
import { TiltShiftFilter } from "pixi-filters";
import { loadWorldArt, drawThing, lightWorldArt, worldLight } from "@/components/world/buildings";
import { Citizen, lookFor, type Look } from "@/components/world/citizen";
import { mix } from "@/components/world/fx";
import { GradeFilter, gradeFor } from "@/components/world/post";
import { castShadow, isoFor, litFaces, paintLight, sunAt, type Sun } from "../world-styles/light";
import { TABLE, dioramaGrade, drawTable, drybrush } from "../world-styles/diorama";
import { HOUSES, houseSvg, type Kind } from "@/components/world/dalmatian";
import { Figurine } from "@/components/world/figurine";
type FigurePose = "idle" | "walk" | "talk";
import s from "../world-styles/world-styles.module.css";

type Mode = "street" | "sheet";
type Art = "new" | "old";
const KINDS = Object.keys(HOUSES) as Kind[];
/** Sunrise and sunset for a late-September day on the coast; the study keeps its own clock. */
const RISE = 6.9, SET = 18.9;
const STOP_FPS = 12;
const PEOPLE = ["Ana Perić", "Petar Ilić", "Mara Tomić", "Davor Novak", "Vesna Marić", "Luka Babić", "Iva Božić", "Franjo Kovač", "Katarina Jurić", "Stjepan Vuković", "Nikola Rota", "Ema Vidović", "Tonći Bralić", "Zdenka Radić"];
const fmtHour = (h: number) => { const m = Math.round(h * 60); return `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; };
/** The plaza's own axes onto the world, at the atlas's scale, so a house's corner lands where its drawing says. */
const G = (u: number, v: number): [number, number] => [(u - v) * 0.684, (u + v) * 0.317];

/** A house drawing rasterized once at three times its size, as a texture with its box. */
async function houseTexture(kind: Kind, variant: number, lit: boolean) {
  const { svg, x, y, width, height } = houseSvg(kind, variant, lit);
  const img = new Image(); img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width * 3}" height="${height * 3}" viewBox="${x} ${y} ${width} ${height}">${svg}</svg>`);
  await img.decode();
  return { texture: Texture.from(img), x, y, width, height };
}

export function NewLooks() {
  const host = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<Mode>("street");
  const [art, setArt] = useState<Art>("new");
  const [hour, setHour] = useState(17.9);
  const [lens, setLens] = useState(true);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const want = useRef({ mode, art, hour, lens }); want.current = { mode, art, hour, lens };

  useEffect(() => {
    let alive = true; let app: Application | null = null;
    void (async () => {
      await loadWorldArt();
      const tex = new Map<string, Awaited<ReturnType<typeof houseTexture>>>();
      await Promise.all(KINDS.flatMap((k) => Array.from({ length: HOUSES[k].ways }, (_, v) => v).flatMap((v) => [false, true].map(async (lit) => { tex.set(`${k}|${v}|${lit}`, await houseTexture(k, v, lit)); }))));
      app = new Application();
      await app.init({ background: TABLE, resizeTo: host.current!, antialias: true, resolution: Math.min(2, window.devicePixelRatio || 1), autoDensity: true });
      if (!alive) { app.destroy(true); return; }
      host.current!.appendChild(app.canvas);
      const world = new Container(); app.stage.addChild(world);
      const table = new Graphics(); drawTable(table, 3000, 2000); table.position.set(-1500, -1000); world.addChild(table);

      // one house of either art, with the light layers every study shares
      type Built = { root: Container; kind: Kind; variant: number; at: [number, number]; art: Art; sprite?: Sprite; shade: Graphics; glow: Graphics; dark: Graphics; bright: Graphics; brush: Graphics };
      const built: Built[] = [];
      const makeHouse = (parent: Container, kind: Kind, variant: number, at: [number, number], which: Art): Built => {
        const root = new Container(); root.position.set(at[0], at[1]); root.zIndex = at[1]; parent.addChild(root);
        const shade = new Graphics(), glow = new Graphics(), dark = new Graphics(), bright = new Graphics(), brush = new Graphics();
        shade.blendMode = dark.blendMode = "multiply"; glow.blendMode = bright.blendMode = brush.blendMode = "add";
        let sprite: Sprite | undefined;
        if (which === "new") { const t = tex.get(`${kind}|${variant}|false`)!; sprite = new Sprite(t.texture); sprite.position.set(t.x, t.y); sprite.width = t.width; sprite.height = t.height; root.addChild(sprite, shade, glow, dark, bright, brush); }
        else { const d = drawThing(HOUSES[kind].old + (variant ? String(variant + 1) : "")) ?? drawThing(HOUSES[kind].old); if (d) root.addChild(d.c); root.addChild(dark, bright); }
        const b: Built = { root, kind, variant, at, art: which, shade, glow, dark, bright, brush, ...(sprite ? { sprite } : {}) }; built.push(b); return b;
      };
      /** a figure of either art for one look */
      type Figure = { look: Look; root: Container; fig?: Figurine; rig?: Citizen; x: number; y: number; tx: number; ty: number; wait: number; pose: FigurePose; seed: number };
      const figures: Figure[] = [];
      const makeFigure = (parent: Container, look: Look, x: number, y: number, which: Art, seed: number, pose: FigurePose = "idle"): Figure => {
        const root = new Container(); root.position.set(x, y); root.zIndex = y; parent.addChild(root);
        const f: Figure = { look, root, x, y, tx: x, ty: y, wait: 0, pose, seed };
        if (which === "new") { f.fig = new Figurine(look, seed); f.fig.scale.set(0.95); root.addChild(f.fig); } else { f.rig = new Citizen(look); f.rig.scale.set(0.82); root.addChild(f.rig); }
        figures.push(f); return f;
      };

      // ---- the street: a small plaza on a plinth, four kinds of house around it, people crossing it
      const street = new Container(); world.addChild(street);
      const PU = 880, PV = 640, DEPTH = 34;
      const slabShadow = new Graphics(); slabShadow.poly([...G(0, 0), ...G(PU, 0), ...G(PU, PV), ...G(0, PV)].map((v, i) => v + (i % 2 ? DEPTH + 40 : 30))).fill({ color: 0x1b140f, alpha: 0.5 }); slabShadow.filters = [new BlurFilter({ strength: 30, quality: 3 })]; street.addChild(slabShadow);
      const slab = new Graphics(); street.addChild(slab);
      slab.poly([...G(0, PV), ...G(PU, PV), ...G(PU, PV).map((v, i) => v + (i % 2 ? DEPTH : 0)), ...G(0, PV).map((v, i) => v + (i % 2 ? DEPTH : 0))]).fill(0x5e4331);
      slab.poly([...G(PU, 0), ...G(PU, PV), ...G(PU, PV).map((v, i) => v + (i % 2 ? DEPTH : 0)), ...G(PU, 0).map((v, i) => v + (i % 2 ? DEPTH : 0))]).fill(0x7a5a40);
      slab.poly([...G(0, 0), ...G(PU, 0), ...G(PU, PV), ...G(0, PV)]).fill(0xd6ccb7);
      // flagstones in courses, each a slightly different stone
      { let seed = 7; const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
        for (let v = 0; v < PV; v += 26) for (let u = -(v % 52 ? 16 : 0), len = 0; u < PU; u += len) { len = 26 + r() * 22; const u0 = Math.max(0, u), u1 = Math.min(PU, u + len), v1 = Math.min(PV, v + 26); if (u1 - u0 < 3) continue; slab.poly([...G(u0 + 1, v + 1), ...G(u1 - 1, v + 1), ...G(u1 - 1, v1 - 1), ...G(u0 + 1, v1 - 1)]).fill(mix(0xd9cfbb, [0xcfc4ad, 0xe2d9c7, 0xc9bea6][Math.floor(r() * 3)]!, 0.6)).stroke({ width: 0.6, color: 0xa9a08b, alpha: 0.7 }); } }
      slab.poly([...G(0, 0), ...G(PU, 0), ...G(PU, PV), ...G(0, PV)]).stroke({ width: 3, color: 0xe3d6b8 });
      const streetCasts = new Graphics(); street.addChild(streetCasts); const streetFigShade = new Graphics(); street.addChild(streetFigShade);
      const streetScene = new Container(); streetScene.sortableChildren = true; street.addChild(streetScene);
      const layout: [Kind, number, number, number][] = [["stone", 0, 30, 20], ["townhouse", 1, 190, 10], ["konoba", 0, 370, 20], ["fisher", 2, 560, 40], ["stone", 1, 730, 180], ["fisher", 0, 20, 330]];
      const streetHouses: { kind: Kind; variant: number; at: [number, number] }[] = layout.map(([kind, variant, u0, v0]) => { const { w, d } = HOUSES[kind].spec; return { kind, variant, at: G(u0 + w, v0 + d) }; });
      const streetBuilt: Record<Art, Built[]> = { new: [], old: [] };
      for (const which of ["new", "old"] as const) for (const h of streetHouses) streetBuilt[which].push(makeHouse(streetScene, h.kind, h.variant, h.at, which));
      for (const [name, u, v] of [["well", 440, 360], ["lamp", 300, 250], ["lamp", 600, 480], ["tree-small", 110, 600], ["tree-small", 820, 590], ["bench", 520, 250], ["planter", 250, 175], ["terrace", 480, 200]] as const) { const d = drawThing(name); if (!d) continue; const [x, y] = G(u, v); d.c.position.set(x, y); d.c.zIndex = y; streetScene.addChild(d.c); }
      const streetFigures: Record<Art, Figure[]> = { new: [], old: [] };
      PEOPLE.forEach((name, i) => { const u = 160 + ((i * 97) % 560), v = 200 + ((i * 61) % 380); const [x, y] = G(u, v); for (const which of ["new", "old"] as const) streetFigures[which].push(makeFigure(streetScene, lookFor(name, null), x, y, which, i)); });
      const lamps = [G(300, 250), G(600, 480)];

      // ---- the model sheet: every kind of house on its own tile, every look in a row of figures
      const sheet = new Container(); world.addChild(sheet);
      const sheetCasts = new Graphics(); sheet.addChild(sheetCasts); const sheetFigShade = new Graphics(); sheet.addChild(sheetFigShade);
      const sheetScene = new Container(); sheetScene.sortableChildren = true; sheet.addChild(sheetScene);
      const nameStyle = new TextStyle({ fontFamily: "Georgia, serif", fontSize: 15, fill: 0xf2e8d2 }), localStyle = new TextStyle({ fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: 12, fill: 0xd8ccb2 });
      const sheetBuilt: Record<Art, Built[]> = { new: [], old: [] };
      KINDS.forEach((kind, i) => {
        const at: [number, number] = [(i % 5) * 300, Math.floor(i / 5) * 340]; const { w, d } = HOUSES[kind].spec; const q = isoFor(HOUSES[kind].spec);
        const tile = new Graphics(); tile.position.set(...at);
        tile.poly([...q(-24, -24, -8), ...q(w + 24, -24, -8), ...q(w + 24, d + 24, -8), ...q(-24, d + 24, -8)]).fill(0x4f3a2b);
        tile.poly([...q(-24, -24, 0), ...q(w + 24, -24, 0), ...q(w + 24, d + 24, 0), ...q(-24, d + 24, 0)]).fill(0xcfc4ad).stroke({ width: 2, color: 0xe3d6b8 });
        tile.zIndex = -1; sheetScene.addChild(tile);
        for (const which of ["new", "old"] as const) sheetBuilt[which].push(makeHouse(sheetScene, kind, i % HOUSES[kind].ways, at, which));
        const [, ly] = q(w / 2, d + 24, 0); const t1 = new Text({ text: HOUSES[kind].name, style: nameStyle }); t1.anchor.set(0.5, 0); t1.position.set(at[0] - 10, at[1] + ly + 26); sheet.addChild(t1);
        const t2 = new Text({ text: HOUSES[kind].local, style: localStyle }); t2.anchor.set(0.5, 0); t2.position.set(at[0] - 10, at[1] + ly + 46); sheet.addChild(t2);
      });
      const sheetFigures: Record<Art, Figure[]> = { new: [], old: [] };
      PEOPLE.slice(0, 12).forEach((name, i) => { const x = 60 + i * 96, y = 1060; const pose: FigurePose = i % 3 === 1 ? "walk" : i % 3 === 2 ? "talk" : "idle"; for (const which of ["new", "old"] as const) { const f = makeFigure(sheetScene, lookFor(name, null), x, y, which, i, pose); f.root.scale.set(1.6); sheetFigures[which].push(f); } const t = new Text({ text: name.split(" ")[0]!, style: localStyle }); t.anchor.set(0.5, 0); t.position.set(x, y + 16); sheet.addChild(t); });

      // ---- light: sun, shade on each face, casts, night, the lens
      const blur = new BlurFilter({ strength: 2, quality: 2 }); const screen = new Rectangle(); streetCasts.filterArea = sheetCasts.filterArea = screen; streetCasts.filters = sheetCasts.filters = [blur];
      const veil = new Graphics().rect(-4000, -4000, 8000, 8000).fill(0xffffff); veil.blendMode = "multiply"; veil.alpha = 0; world.addChild(veil);
      const lampGlow = new FillGradient({ type: "radial", center: { x: 0.5, y: 0.5 }, innerRadius: 0, outerCenter: { x: 0.5, y: 0.5 }, outerRadius: 0.5, colorStops: [{ offset: 0, color: "rgba(255,196,120,0.6)" }, { offset: 0.5, color: "rgba(255,170,90,0.2)" }, { offset: 1, color: "rgba(255,160,80,0)" }] });
      const deskLamp = new Graphics().rect(-700, -600, 1400, 1200).fill(lampGlow); deskLamp.blendMode = "add"; deskLamp.alpha = 0; world.addChild(deskLamp);
      const posts = new Graphics(); posts.blendMode = "add"; world.addChild(posts);
      const grade = new GradeFilter(); const tilt = new TiltShiftFilter({ blur: 12, gradientBlur: 500 });
      const faceQuads = (kind: Kind) => { const { w, d, h } = HOUSES[kind].spec; const q = isoFor(HOUSES[kind].spec); return { front: [q(0, d, 0), q(w, d, 0), q(w, d, h), q(0, d, h)], side: [q(w, d, 0), q(w, 0, 0), q(w, 0, h), q(w, d, h)], roof: [q(-7, d + 6, h), q(w + 7, d + 6, h), q(w + 7, d / 2, h + 40), q(-7, d / 2, h + 40)] }; };
      let lastKey = ""; let sun: Sun = sunAt(12, RISE, SET);
      const relight = () => {
        const w = want.current; sun = sunAt(w.hour, RISE, SET); const day = sun.up ? 1 - sun.night : 0; const lit = litFaces(sun.L);
        street.visible = w.mode === "street"; sheet.visible = w.mode === "sheet";
        for (const face of ["front", "side", "roof"] as const) { worldLight.shade[face] = 0.4 * day * Math.max(0, 0.55 - lit[face]) / 0.55; worldLight.glow[face] = 0.55 * sun.golden * day * lit[face]; }
        worldLight.shadeTint = mix(0x5d6b8c, 0x6a5f86, sun.golden);
        const shadeTint = worldLight.shadeTint, glowTint = mix(0x66502a, sun.phase === "rise" ? 0x63501f : 0x6a4620, 0.5);
        for (const b of built) {
          const show = b.art === w.art; b.root.visible = show; if (!show) continue;
          const spec = HOUSES[b.kind].spec; paintLight(b.dark, b.bright, spec, sun);
          if (b.art === "new") {
            // the new drawings carry their own face light, from the same geometry they were drawn with
            const quads = faceQuads(b.kind); b.shade.clear(); b.glow.clear();
            for (const face of ["front", "side", "roof"] as const) { const pts = quads[face].flat(); b.shade.poly(pts).fill({ color: shadeTint, alpha: worldLight.shade[face] }); b.glow.poly(pts).fill({ color: glowTint, alpha: worldLight.glow[face] }); }
            b.brush.visible = w.lens; if (w.lens) drybrush(b.brush, spec, sun);
            b.sprite!.texture = tex.get(`${b.kind}|${b.variant}|${sun.night > 0.35}`)!.texture;
          } else lightWorldArt(b.root, sun.night > 0.35);
        }
        for (const f of figures) f.root.visible = (f.fig ? "new" : "old") === w.art;
        for (const [g, list] of [[streetCasts, streetBuilt], [sheetCasts, sheetBuilt]] as const) {
          g.clear(); if (!sun.up) continue; const a = 0.16 + sun.golden * 0.06;
          for (const b of list[w.art]) { const poly = castShadow(HOUSES[b.kind].spec, sun); if (poly) g.poly(poly.flat().map((v, i) => v + b.at[i % 2]!)).fill({ color: sun.golden > 0.05 ? 0x4a3a5a : 0x2f3f3a, alpha: a }); }
        }
        veil.tint = mix(0x2b3350, 0x3a3558, sun.blue); veil.alpha = sun.night * 0.7; deskLamp.alpha = w.lens ? sun.night * 0.8 : 0;
        posts.clear(); posts.alpha = sun.night; if (w.mode === "street" && sun.night > 0.2) for (const [x, y] of lamps) { posts.rect(x + 10 - 44, y - 42 - 44, 88, 88).fill(lampGlow); posts.rect(x + 10 - 80, y + 2 - 30, 160, 60).fill(lampGlow); } // a soft halo at the lantern and a pool on the flags below it
        const g = gradeFor({ golden: sun.golden, blue: sun.blue, night: sun.night, cover: 0, weather: "clear" });
        grade.set(w.lens ? dioramaGrade(g) : g); app!.stage.filters = w.lens ? [grade, tilt] : [grade];
      };

      // camera: each view has its framing; drag and wheel from there
      const frames: Record<Mode, { x: number; y: number; zoom: number }> = { street: { x: G(440, 320)[0], y: G(440, 320)[1] - 50, zoom: 1.05 }, sheet: { x: 600, y: 440, zoom: 0.55 } };
      let cam = { ...frames.street }; let camMode: Mode = "street"; let press: { x: number; y: number } | null = null;
      app.canvas.addEventListener("pointerdown", (e) => { press = { x: e.clientX, y: e.clientY }; });
      app.canvas.addEventListener("pointermove", (e) => { if (!press) return; cam.x -= (e.clientX - press.x) / cam.zoom; cam.y -= (e.clientY - press.y) / cam.zoom; press = { x: e.clientX, y: e.clientY }; });
      for (const ev of ["pointerup", "pointerleave", "pointercancel"]) app.canvas.addEventListener(ev, () => { press = null; });
      app.canvas.addEventListener("wheel", (e) => { e.preventDefault(); cam.zoom = Math.min(3, Math.max(0.3, cam.zoom * Math.exp(-e.deltaY * 0.0012))); }, { passive: false });

      setStatus("ready");
      let t = 0; let lastPose = -1;
      app.ticker.add(() => {
        if (!app) return; const dt = Math.min(app.ticker.deltaMS, 100) / 1000; t += dt; const w = want.current;
        const key = `${w.mode}|${w.art}|${w.hour.toFixed(2)}|${w.lens}`; if (key !== lastKey) { lastKey = key; relight(); }
        if (w.mode !== camMode) { camMode = w.mode; cam = { ...frames[w.mode] }; }
        const Wd = app.screen.width, Hd = app.screen.height; const sx = Wd / 2 - cam.x * cam.zoom, sy = Hd / 2 - cam.y * cam.zoom;
        world.scale.set(cam.zoom); world.position.set(sx, sy);
        screen.x = -sx / cam.zoom; screen.y = -sy / cam.zoom; screen.width = Wd / cam.zoom; screen.height = Hd / cam.zoom; blur.strength = 1.8 * cam.zoom;
        if (w.lens) { tilt.start = { x: 0, y: Hd * 0.52 }; tilt.end = { x: Wd, y: Hd * 0.52 }; tilt.gradientBlur = Hd * 0.5; }
        // people cross the plaza between resting places and stop to talk; the sheet's figures hold their poses
        const walkers = streetFigures[w.art];
        for (const f of walkers) {
          const dx = f.tx - f.x, dy = f.ty - f.y, d = Math.hypot(dx, dy);
          if (d > 1) { const st = Math.min(d, 34 * dt); f.x += (dx / d) * st; f.y += (dy / d) * st; f.pose = "walk"; }
          else if ((f.wait -= dt) <= 0) { const u = 150 + Math.random() * 600, v = 190 + Math.random() * 400; [f.tx, f.ty] = G(u, v); f.wait = 2 + Math.random() * 5; }
          else f.pose = walkers.some((o) => o !== f && Math.hypot(o.x - f.x, o.y - f.y) < 40 && Math.hypot(o.tx - o.x, o.ty - o.y) < 1) ? "talk" : "idle";
          f.root.position.set(f.x, f.y); f.root.zIndex = f.y; if (d > 1 && Math.abs(dx) > 0.2) { f.fig?.face(dx < 0 ? -1 : 1); f.rig?.face(dx < 0 ? -1 : 1); }
        }
        // posed twelve times a second through the lens, like stop-motion; smooth without it
        const frame = Math.floor(t * STOP_FPS); const posed = !w.lens || frame !== lastPose; lastPose = frame; const pt = w.lens ? frame / STOP_FPS : t;
        if (posed) for (const f of [...streetFigures[w.art], ...sheetFigures[w.art]]) {
          if (f.fig) { f.fig.setPose(f.pose); f.fig.update(pt); }
          if (f.rig) { f.rig.setPose(f.pose === "talk" ? "talk" : f.pose === "walk" ? "walk" : "idle"); f.rig.travel(f.pose === "walk" ? 34 * dt / 0.82 : 0); f.rig.update(pt); }
        }
        // under each base a soft shadow, leaning away from the sun, fainter by lamplight
        if (posed) for (const [g, list] of [[streetFigShade, streetFigures[w.art]], [sheetFigShade, sheetFigures[w.art]]] as const) {
          g.clear(); const lean = sun.up ? -sun.L[0] * 9 : 0, a = sun.up ? 0.28 : 0.14;
          for (const f of list) { const lift = (f.pose === "walk" ? 0.75 : 1) * f.root.scale.x; g.ellipse(f.x + lean * f.root.scale.x, f.y + 2, 13 * lift, 4.6 * lift).fill({ color: 0x2a241d, alpha: a * lift }); }
        }
      });
    })().catch((e) => { console.error(e); if (alive) setStatus("error"); });
    return () => { alive = false; if (app?.renderer) app.destroy(true, { children: true }); for (const face of ["front", "side", "roof"] as const) { worldLight.shade[face] = 0; worldLight.glow[face] = 0; } };
  }, []);

  return (
    <main className={s.page}>
      <div ref={host} className={s.canvas} />
      {lens && <div className={s.lens} aria-hidden />}
      {status !== "ready" && <div className={s.status}>{status === "error" ? "The drawings could not be made; see the console." : "Drawing the houses…"}</div>}
      <header className={s.top}>
        <Link href="/experiments" className={s.back}>← Experiments</Link>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <div className={s.switch} role="radiogroup" aria-label="View">{(["street", "sheet"] as const).map((m) => <button key={m} role="radio" aria-checked={mode === m} className={mode === m ? s.on : ""} onClick={() => setMode(m)}>{m === "street" ? "Street" : "Model sheet"}</button>)}</div>
          <div className={s.switch} role="radiogroup" aria-label="Art">{(["new", "old"] as const).map((a) => <button key={a} role="radio" aria-checked={art === a} className={art === a ? s.on : ""} onClick={() => setArt(a)}>{a === "new" ? "New houses & figures" : "As it ships"}</button>)}</div>
        </div>
      </header>
      <footer className={s.panel}>
        <p className={s.note}><strong>{art === "new" ? "New looks." : "As it ships."}</strong> {art === "new" ? "Four Dalmatian houses drawn in code: a stone house with its balatura stair, a fisherman's cottage with a boat arch, a town house with a balcony, a konoba under a vine. The people are painted miniatures on turned bases, from the same looks citizens choose, hopping when they walk." : "The same places and people in the art the island uses today, for comparison."}</p>
        <div className={s.controls}>
          <label className={s.hour}><span>Hour <b>{fmtHour(hour)}</b></span><input type="range" min={0} max={23.99} step={0.05} value={hour} onChange={(e) => setHour(Number(e.target.value))} /></label>
          <label className={s.check}><input type="checkbox" checked={lens} onChange={(e) => setLens(e.target.checked)} /> Miniature lens</label>
          <div className={s.presets}>{[["Dawn", 7.4], ["Noon", 13], ["Golden", 17.9], ["Night", 21.5]].map(([n, h]) => <button key={n} onClick={() => setHour(h as number)}>{n}</button>)}</div>
        </div>
      </footer>
    </main>
  );
}
