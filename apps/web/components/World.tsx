"use client";
import { Icon } from "./icons";
import { BuildingInterior, hasInterior } from "./BuildingInterior";
import { Footfall } from "./world/footfall";
import { PlaceMemory } from "./PlaceMemory";
import { drawPlaceMarks, markPosition } from "./world/place-marks";
import { coastalWonder, type Decoration } from "@unwatched/protocol";
import { CoastalLife } from "./world/coastal-life";
import { harborGround, harborBreeze, harborMoorings } from "./world/harbor-detail";
import { advanceWalk, walkFacing } from "./world/locomotion";
import { seatsFor, type Seat } from "./world/seating";
import { previewZoom, coast } from "./world/camera-motion";
import { constructionStage } from "@unwatched/protocol";
import { uiFont } from "@/lib/fonts";
import { useEffect, useRef, useState } from "react";
import { Application, BlurFilter, Container, Graphics, Matrix, Rectangle, Text, TextStyle } from "pixi.js";
import { BAY, PLINTH, TABLE, drawPlinth, drawTable } from "./world/diorama";
import { API, type PublicAgent, type TownEvent, type Clock } from "@/lib/api";
import { Citizen, lookFor, aged, type Look, type Pose } from "./world/citizen";
import { Figurine } from "./world/figurine";
/** Every citizen is a painted figurine; `?figures=classic` puts back the drawn rig they replaced. */
type Rig = Citizen | Figurine;
import { Ambience } from "./world/ambience";
import { ProjectDetails, type CommunityView } from "./CommunityProjects";
import { loadWorldArt, lightWorldArt, drawConstruction, drawThing, drawStock, drawCart, drawSign, setSeason, worldLight, nightGlow, clearNightGlow, setClassicHouses, streetHouse, treeCrowns } from "./world/buildings";
import { DALMATIAN_FOR, chimneyTop, forgeAt, kindOfDrawing, lanternAt, signPlacement } from "./world/dalmatian";
import { GROUND, LIGHT, CREAM, SAGE, TEAL, KELP, CORAL, DRIFT } from "./world/palette";
import { Lighting, WaterFilter, Weather, Clouds, Sky, mix, type LightSource } from "./world/fx";
import { Life, type Critter } from "./world/life";
import { Post, gradeFor, NEUTRAL, type Grade } from "./world/post";
import { Particles } from "./world/particles";
import { drawGround, drawRoads, segmentsOf, keepOffRoads, Wear, noise } from "./world/terrain";
import { Interior, type InteriorPerson } from "./Interior";
import { Portrait } from "./Portrait";
import townStyle from "./town/town.module.css";

/**
 * The island, drawn by PixiJS from the live event stream, in the Tide style.
 * The server owns the map: every place arrives with its position, district and sprite, so a house someone builds
 * this morning stands on the canvas by the time the paper prints it. Labels and bubbles are HTML over the canvas.
 */
const C = { ...GROUND, shell: CREAM, sage: SAGE, teal: TEAL, kelp: KELP, coral: CORAL, drift: DRIFT };

type PlaceView = { storedCount?: number; looseCount?: number; decorations?: Decoration[]; community?: CommunityView; hasHistory?: boolean; id: string; name: string; kind: string; exits: string[]; x: number; y: number; district: string; sprite: string; stock?: Record<string, number>; look?: string; owner: string | null; site: { what: string; name: string; by: string; done: number; of: number } | null; crowd: number };
type TownView = Clock & { size: { w: number; h: number }; places: PlaceView[] };


/** Trees, rocks and props laid by district so the island reads as a landscape and not a diagram. Positions are map units. */
export function decorFor(places: Pick<PlaceView, "id" | "x" | "y" | "sprite">[]): { sprite: string; x: number; y: number; w?: number; flip?: boolean }[] {
  const at = (id: string) => places.find((p) => p.id === id) ?? { x: 0, y: 0 };
  const h = at("harbor"), m = at("market"), pw = at("pinewood"), q = at("quarry"), f = at("fields"), o = at("orchard"), cv = at("cove"), lh = at("lighthouse"), sh = at("shore"), ln = at("lane");
  const out: { sprite: string; x: number; y: number; w?: number; flip?: boolean }[] = [
    { sprite: "pier", x: h.x - 250, y: h.y + 40 }, { sprite: "rowboat", x: h.x - 230, y: h.y + 110 }, { sprite: "crates", x: h.x + 110, y: h.y + 30 }, { sprite: "lamp", x: h.x + 150, y: h.y - 10 }, { sprite: "searocks", x: h.x - 320, y: h.y + 220 },
    { sprite: "bench", x: m.x - 200, y: m.y + 40 }, { sprite: "lamp", x: m.x - 150, y: m.y + 70 }, { sprite: "lamp", x: m.x + 160, y: m.y + 60 }, { sprite: "bush", x: m.x + 210, y: m.y - 40 }, { sprite: "tree-small", x: m.x - 260, y: m.y - 120 },
    { sprite: "lamp", x: ln.x, y: ln.y + 10 }, { sprite: "bench", x: ln.x + 120, y: ln.y + 30 }, { sprite: "bush", x: ln.x - 140, y: ln.y + 60 }, { sprite: "washing", x: ln.x - 60, y: ln.y - 90 }, { sprite: "washing", x: m.x + 330, y: m.y - 190 },
    { sprite: "fence", x: f.x + 60, y: f.y + 120 }, { sprite: "field", x: f.x - 120, y: f.y + 200, w: 200 }, { sprite: "tree-small", x: o.x + 180, y: o.y - 60 }, { sprite: "tree-small", x: o.x - 160, y: o.y + 80 }, { sprite: "tree-small", x: o.x + 40, y: o.y + 140 },
    { sprite: "searocks", x: cv.x - 120, y: cv.y + 120 }, { sprite: "searocks", x: cv.x + 260, y: cv.y - 60 }, { sprite: "rowboat", x: cv.x + 120, y: cv.y + 80, flip: true }, { sprite: "bush", x: sh.x + 120, y: sh.y + 90 }, { sprite: "tree-small", x: sh.x - 200, y: sh.y + 60 },
    { sprite: "rock", x: q.x - 120, y: q.y + 90 }, { sprite: "rock", x: q.x + 140, y: q.y + 60 }, { sprite: "searocks", x: lh.x + 140, y: lh.y + 120 }, { sprite: "rock", x: lh.x - 100, y: lh.y + 60 },
  ];
  // dressing by district: walls along the fields and plots, olives and cypresses on the hill, nets and barrels at the harbour, a well in the square
  const hill = at("hill"), chapel = at("chapel");
  out.push({ sprite: "wall", x: f.x - 210, y: f.y + 60 }, { sprite: "wall", x: f.x - 90, y: f.y + 120 }, { sprite: "wall", x: o.x + 220, y: o.y + 40 }, { sprite: "wall", x: ln.x + 260, y: ln.y + 120 });
  for (let i = 0; i < 5; i++) out.push({ sprite: "olive", x: hill.x - 260 + i * 110, y: hill.y + 140 + (i % 2) * 40 });
  for (let i = 0; i < 4; i++) out.push({ sprite: "cypress", x: chapel.x - 150 + i * 44, y: chapel.y + 70 + (i % 2) * 6 });
  out.push({ sprite: "cypress", x: hill.x + 120, y: hill.y - 40 }, { sprite: "cypress", x: hill.x + 150, y: hill.y - 30 });
  out.push({ sprite: "net", x: h.x - 60, y: h.y + 140 }, { sprite: "barrel", x: h.x + 190, y: h.y + 50 }, { sprite: "barrel", x: h.x + 212, y: h.y + 58 }, { sprite: "barrel", x: h.x + 200, y: h.y + 74 }, { sprite: "net", x: cv.x + 40, y: cv.y - 40 });
  out.push({ sprite: "well", x: m.x + 120, y: m.y - 110 }, { sprite: "barrel", x: m.x - 250, y: m.y - 30 });
  // Small domestic details around the places that actually exist.
  for (const p of places) {
    if (["inn", "tavern", "bakery"].includes(p.sprite)) {
      out.push({sprite:p.sprite==="tavern"?"parasol":"terrace",x:p.x-115,y:p.y+24},{sprite:"terrace",x:p.x+85,y:p.y+35});
    }
    if (["house","cottage","inn","tavern","bakery","chandlery","harbor-office"].includes(p.sprite)) {
      out.push({sprite:"planter",x:p.x-65,y:p.y+6},{sprite:"planter",x:p.x+52,y:p.y+12});
    }
  }
  // the pinewood is a wood
  for (let i = 0; i < 22; i++) out.push({ sprite: i % 3 === 0 ? "tree-small" : "tree-large", x: pw.x - 340 + (i * 173) % 680, y: pw.y - 160 + (i * 97) % 340, flip: i % 2 === 0 });
  // a few more trees where the land is empty, so the island is not bare between districts
  for (const [x, y] of [[h.x + 420, h.y - 260], [m.x - 420, m.y + 260], [ln.x + 300, ln.y + 40], [o.x - 300, o.y - 160], [sh.x + 380, sh.y + 120], [q.x - 320, q.y + 220]] as const) out.push({ sprite: "tree-large", x, y }, { sprite: "tree-small", x: x + 70, y: y + 30 });
  return out;
}

/** The island's drawings of described buildings, fetched once each. */
const lookCache = new Map<string, Promise<string | null>>();
function lookSvg(hash: string): Promise<string | null> {
  let p = lookCache.get(hash);
  if (!p) { p = fetch(`${API}/api/looks/${hash}`, { cache: "force-cache" }).then((r) => (r.ok ? r.text() : null)).catch(() => null); lookCache.set(hash, p); }
  return p;
}

type Fig = { speed?: number; walkFacing?: "left" | "right" | "front" | "back"; id: string; g: Container; rig: Rig; x: number; y: number; tx: number; ty: number; place: string; asleep: boolean; /** the place with their bed, if they have one */ home: string | null; mine: boolean; name: string; pose: Pose; facing: 1 | -1; weak: boolean; bench: boolean; seat?: Seat; boarding?: boolean; /** down to an animal until this tick */ react?: { until: number; ax: number; ay: number }; reactAt?: number; /** a short thing they are doing, from the record: a letter read, a meal, a greeting, an argument */ moment?: { pose: Pose; until: number; mood?: { anger?: number; surprise?: number; joy?: number } } };

export type WorldSnapshot = { clock: Clock | null; feed: TownEvent[]; citizens: PublicAgent[]; ready: boolean; error: boolean };
export function World({ mineId, onSelect, view, effects = true, observer = false, onSnapshot, focusId, onViewChange, apiUrl = API, selectedId = null, spotlight = null }: { apiUrl?: string; mineId: string | null; onSelect: (a: PublicAgent | null) => void; view: "street" | "map" | "cinema"; effects?: boolean; observer?: boolean; focusId?: string | null; onViewChange?: (view: "street" | "map" | "cinema") => void; onSnapshot?: (snapshot: WorldSnapshot) => void; selectedId?: string | null; spotlight?: { id: number; actors: string[]; place: string | null; at: number } | null }) {
  const viewChange = useRef(onViewChange); viewChange.current = onViewChange;
  const focusRef = useRef(focusId); focusRef.current = focusId;
  const selRef = useRef(selectedId); selRef.current = selectedId;
  const spotRef = useRef(spotlight); spotRef.current = spotlight;
  const navigateMini = useRef<((x:number,y:number)=>void) | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const cameraControl = useRef<((action: "in" | "out" | "reset") => void) | null>(null);
  const [labels, setLabels] = useState<{ id: string; name: string; x: number; y: number; mine: boolean; shown: boolean; activity?: string; bubble?: string }[]>([]);
  const labelEls = useRef(new Map<string, HTMLDivElement>());
  const labelPos = useRef(new Map<string, { x: number; y: number }>());
  const labelKey = useRef("");
  const [feed, setFeed] = useState<TownEvent[]>([]);
  const [clock, setClock] = useState<Clock | null>(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const figs = useRef(new Map<string, Fig>());
  const agents = useRef(new Map<string, PublicAgent>());
  const bubbles = useRef(new Map<string, { text: string; until: number }>());
  const camera = useRef({ x: 0, y: 0, zoom: 1, follow: mineId as string | null, hand: null as { x: number; y: number; zoom: number; vx: number; vy: number } | null });
  const seatOf = useRef(new Map<string, number>());
  const viewRef = useRef(view); viewRef.current = view;
  const effectsRef = useRef(effects); effectsRef.current = effects;
  const hoverRef = useRef<string | null>(null);
  /** Where the day is happening: the latest moment that mattered, for the camera to follow. */
  const cinema = useRef<{ x: number; y: number; ids: string[]; at: number; text?: string } | null>(null);
  /** A scene on the street: a gathering being held, or a fire, for the camera and the music to follow. */
  const staged = useRef<{ kind: string; place: string; x: number; y: number; actors: string[]; until: number } | null>(null);
  const clockRef = useRef<Clock | null>(null);
  const ambienceRef = useRef<Ambience | null>(null);
  const [sound, setSound] = useState(false);
  const [caption, setCaption] = useState<{ text: string; who: string } | null>(null);
  const [cleanUi, setCleanUi] = useState(false);
  // the miniature: the island as a model on a walnut table, shot close with a shallow focus and people moved a frame at a time
  const [miniature, setMiniature] = useState(false); const miniRef = useRef(false); miniRef.current = miniature;
  useEffect(() => { const q = new URLSearchParams(location.search).get("look"); let saved: string | null = null; try { saved = localStorage.getItem("uw.look"); } catch {} setMiniature(q ? q === "miniature" : saved === "miniature"); }, []);
  const toggleMiniature = () => setMiniature((m) => { try { localStorage.setItem("uw.look", m ? "town" : "miniature"); } catch {} return !m; });
  const placePast = useRef<{place:string;through:number} | null>(null);
  const [placeInfo, setPlaceInfo] = useState<{ decorations?: Decoration[]; community?: CommunityView; stock?: Record<string,number>; hasHistory?: boolean; id: string; name: string; district: string; kind: string; sprite: string; owner: string | null; site: PlaceView["site"]; people: InteriorPerson[] } | null>(null);
  const [mini, setMini] = useState<{ w: number; h: number; places: { id: string; x: number; y: number; kind: string; crowd: number }[]; view: { x: number; y: number; w: number; h: number }; people: { x: number; y: number; mine: boolean }[] } | null>(null);

  useEffect(() => {
    setLoadError(false); setReady(false);
    let suppressSelectUntil = 0;
    const dialogue = new Map<string, { peers: string[]; until: number }>();
    const speechTimers = new Set<ReturnType<typeof setTimeout>>();
    let app: Application | null = null; let stopWatching: (() => void) | null = null; let ws: WebSocket | null = null; let alive = true; let inited = false; let poll: ReturnType<typeof setInterval> | null = null;
    (async () => {
      const el = host.current!;
      const townView = (await (await fetch(`${apiUrl}/api/town`, { cache: "no-store" })).json()) as TownView;
      const W = townView.size?.w ?? 3000, H = townView.size?.h ?? 1800;
      const places = new Map<string, PlaceView>(townView.places.map((p) => [p.id, p]));
      const hourParam = typeof location !== "undefined" ? new URLSearchParams(location.search).get("hour") : null; const forcedHour = hourParam === null ? NaN : Number(hourParam); // ?hour=23 previews the light without waiting for it
      const forcedWeather = typeof location !== "undefined" ? new URLSearchParams(location.search).get("weather") : null; // ?weather=storm previews the weather
      const forcedSeason = typeof location !== "undefined" ? new URLSearchParams(location.search).get("season") : null; // ?season=autumn previews the leaves
      // ?at=harbor,40,-20&zoom=1.6 parks the camera on a place for a picture; the hand still moves it
      const clean = typeof location !== "undefined" && new URLSearchParams(location.search).get("clean") === "1"; setCleanUi(clean); // ?clean=1: the island with nothing over it, for pictures
      const atParam = typeof location !== "undefined" ? new URLSearchParams(location.search).get("at") : null; const zoomParam = typeof location !== "undefined" ? previewZoom(new URLSearchParams(location.search).get("zoom")) : NaN;
      const parkAt = (spec: string | null) => { if (!spec) return null; const [id, dx, dy] = spec.split(","); const p = places.get(id ?? ""); return p ? { x: p.x + (Number(dx) || 0), y: p.y + (Number(dy) || 0) } : null; };
      let parked = parkAt(atParam);
      // a filmed move: ?to=place,dx,dy&zoomTo=1.8&over=8&delay=1 glides the camera from `at` to `to` over that many seconds, eased both ends
      const q = typeof location !== "undefined" ? new URLSearchParams(location.search) : null;
      const moveTo_ = parkAt(q?.get("to") ?? null); const zoomToParam = previewZoom(q?.get("zoomTo")); const moveOver = Number(q?.get("over")) || 8; const moveDelay = Number(q?.get("delay")) || 0.8; const moveStart = performance.now();
      const nofx = new Set((q?.get("nofx") ?? "").split(",").filter(Boolean));
      const classic = q?.get("houses") === "classic"; setClassicHouses(classic);
      const classicFigures = q?.get("figures") === "classic";
      /** a citizen's figure at the size the street wants it */
      const makeRig = (look: Look): Rig => { const r = classicFigures ? new Citizen(look) : new Figurine(look); r.scale.set(classicFigures ? 0.82 : 0.95); return r; }; // ?houses=classic: the drawings the Dalmatian houses replaced // ?nofx=water,dark,glow,sky,clouds,weather,post switches one layer off, for profiling
      const moveP = () => { const t = Math.max(0, Math.min(1, (performance.now() - moveStart) / 1000 - moveDelay) / moveOver); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
      if (!alive) return;
      app = new Application();
      await loadWorldArt();
      await app.init({bezierSmoothness:.97, background: C.water, resizeTo: el, antialias: true, resolution: Math.min(2, window.devicePixelRatio || 1), autoDensity: true });
      inited = true;
      if (!alive) { try { app.destroy(true); } catch {} return; }
      el.appendChild(app.canvas);
      // nobody is looking: a hidden tab or a town scrolled out of view stops drawing; the stream keeps the record current meanwhile
      { let onScreen = true; const run = () => { if (!app) return; const on = onScreen && !document.hidden; if (on && !app.ticker.started) app.ticker.start(); else if (!on && app.ticker.started) app.ticker.stop(); };
        const io = new IntersectionObserver(([en]) => { onScreen = !!en?.isIntersecting; run(); }); io.observe(el);
        document.addEventListener("visibilitychange", run);
        stopWatching = () => { io.disconnect(); document.removeEventListener("visibilitychange", run); }; }
      const world = new Container(); app.stage.addChild(world);

      // sea, with slow ripples
      const sea = new Graphics(); sea.rect(-3000, -3000, W + 6000, H + 6000).fill(C.water); world.addChild(sea); // one rectangle, drawn once; the weather tints it and the water filter moves it
      const ripples: Graphics = new Graphics(); world.addChild(ripples);
      // the island: a soft blob, big enough that every district has shore or hill behind it. Its outline is one smooth curve;
      // the shallows and the foam follow it, the wet sand sits inside it, and the tiles stop just short of it.
      const cx = W / 2, cy = H / 2 + 40, Rx = W / 2 - 120, Ry = H / 2 - 100;
      const wobble = (a: number) => 1 + 0.14 * Math.sin(a * 3 + 0.7) + 0.08 * Math.cos(a * 5 + 2);
      const inside = (x: number, y: number): number => { const a = Math.atan2((y - cy) / Ry, (x - cx) / Rx); return Math.hypot((x - cx) / (Rx * wobble(a)), (y - cy) / (Ry * wobble(a))); }; // 1 is the shore
      const outline = (t: number): [number, number][] => { const pts: [number, number][] = []; for (let k = 0; k < 240; k++) { const a = (k / 240) * Math.PI * 2; const r = wobble(a) * t; pts.push([cx + Rx * r * Math.cos(a), cy + Ry * r * Math.sin(a)]); } return pts; };
      const poly = (g: Graphics, pts: [number, number][]) => { g.moveTo(pts[0]![0], pts[0]![1]); for (const [x, y] of pts.slice(1)) g.lineTo(x, y); g.closePath(); return g; };
      // the horizon: other islands, far off, as soft silhouettes on the sea; the sun crosses over them by day
      const horizon = new Graphics(); world.addChild(horizon);
      const ISLETS: [number, number, number, number][] = [[cx + Rx * 0.95, cy - Ry * 1.1, 190, 34], [cx - Rx * 0.9, cy - Ry * 1.12, 150, 28], [cx - Rx * 1.1, cy + Ry * 0.75, 200, 36], [cx + Rx * 1.12, cy + Ry * 0.6, 130, 26], [cx + Rx * 0.35, cy - Ry * 1.2, 110, 22]];
      for (const [ix, iy, iw, ih] of ISLETS) { horizon.ellipse(ix, iy + 2, iw * 1.12, ih * 0.7).fill({ color: C.shallow, alpha: 0.9 }); horizon.moveTo(ix - iw, iy).quadraticCurveTo(ix - iw * 0.5, iy - ih, ix - iw * 0.1, iy - ih * 0.6).quadraticCurveTo(ix + iw * 0.3, iy - ih * 1.1, ix + iw, iy).closePath().fill(0xa9bfb8); horizon.moveTo(ix - iw * 0.6, iy - 2).quadraticCurveTo(ix - iw * 0.2, iy - ih * 0.8, ix + iw * 0.2, iy - 4).stroke({ width: 1.2, color: C.kelp, alpha: 0.18 }); }
      const celestial = new Graphics(); world.addChild(celestial);
      const gather = (p: PlaceView) => ({ x: p.x - 110, y: p.y + 40, w: 220 });
      const OLD_TOWN = ["market", "lane", "council", "chapel", "bakery", "smithy", "tavern", "chandlery"];
      const seasonNow = forcedSeason ?? clockRef.current?.season ?? townView.season ?? "summer";
      // the ground: kinds blended where they meet, tufts and stones and flowers, contours on the hill, a wrack line on the shore
      const ground = drawGround({ W, H, cx, cy, inside, outline, places, oldTown: OLD_TOWN }, seasonNow); world.addChild(ground);
      // roads: an edge, a centre, cobbles in courses in the old town; and over them the wear, pale where feet actually go
      const segs = segmentsOf(places, OLD_TOWN); world.addChild(drawRoads(segs));
      const wear = new Wear(segs, (sg) => { const [a, b] = sg.key.split("|"); const hub = (id?: string) => id === "market" || id === "harbor" || id === "lane"; return (hub(a) ? 30 : 0) + (hub(b) ? 30 : 0) + (sg.cobbled ? 20 : 6); }); world.addChild(wear);
      // T2: desire-lines. Where feet cross the grass off the roads, the ground wears to a pale path — a light baseline for the shortcuts near each place, deepening with real traffic.
      const trails = new Graphics(); world.addChild(trails);
      const trailCount = new Map<string, number>(); const roadKeys = new Set(segs.map((s) => s.key)); let trailsDirty = true;
      const trailKey = (a: string, b: string) => [a, b].sort().join("|");
      const trailStep = (from: string, to: string) => { if (from === to) return; const key = trailKey(from, to); if (roadKeys.has(key)) return; trailCount.set(key, (trailCount.get(key) ?? 0) + 1); trailsDirty = true; };
      { const list = [...places.values()].filter((p) => p.kind !== "wild" && p.kind !== "plot"); for (const p of list) { let best: { id: string; d: number } | null = null; for (const q of list) { if (q.id === p.id) continue; if (roadKeys.has(trailKey(p.id, q.id))) continue; const dd = Math.hypot(p.x - q.x, p.y - q.y); if (dd < 360 && (!best || dd < best.d)) best = { id: q.id, d: dd }; } if (best) { const key = trailKey(p.id, best.id); trailCount.set(key, Math.max(trailCount.get(key) ?? 0, 2)); } } }
      const trailPath = (ax: number, ay: number, bx: number, by: number) => { const L = Math.hypot(bx - ax, by - ay) || 1; const n = Math.max(2, Math.round(L / 40)); const nx = -(by - ay) / L, ny = (bx - ax) / L; trails.moveTo(ax, ay); for (let i = 1; i <= n; i++) { const t = i / n; const off = i === n ? 0 : (noise(ax * 0.01 + t * 6, ay * 0.01 + 3) - 0.5) * 12; trails.lineTo(ax + (bx - ax) * t + nx * off, ay + (by - ay) * t + ny * off); } };
      const drawTrail = (ax: number, ay: number, bx: number, by: number, width: number, alpha: number) => { trailPath(ax, ay, bx, by); trails.stroke({ width, color: 0xccb890, alpha: alpha * 0.6, cap: "round", join: "round" }); trailPath(ax, ay, bx, by); trails.stroke({ width: width * 0.5, color: 0xbba475, alpha, cap: "round", join: "round" }); };
      const redrawTrails = () => { if (!trailsDirty) return; trailsDirty = false; trails.clear(); for (const [key, n] of trailCount) { if (n < 2) continue; const [a, b] = key.split("|") as [string, string]; const pa = places.get(a), pb = places.get(b); if (!pa || !pb) continue; const k = Math.min(1, Math.log2(1 + n) / 6); drawTrail(pa.x, pa.y + 22, pb.x, pb.y + 22, 6 + 11 * k, 0.13 + 0.15 * k); } };
      redrawTrails();
      const harborSurface=harborGround(places.values(),inside);world.addChild(harborSurface.root);
      // the water's edge, alive: foam that breathes along the shore, whitecaps in wind and storm, rings where the rain hits
      const shoreLine = outline(1.012), shoreOut = outline(1.05); const tideMid = outline(1.0), tideIn = outline(0.984); const shallowLine = outline(1.03);
      const tide = new Graphics(); world.addChild(tide); // the wet sand the sea washes over, and light on the shallows, both under the white foam edge
      const foam = new Graphics(); world.addChild(foam);
      const tlerp = (p: [number, number], q: [number, number], f: number): [number, number] => [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f];
      const drawTide = (t: number) => {
        tide.clear();
        for (let k = 0; k < tideMid.length; k++) {
          const wet = Math.max(0, Math.sin(t / 30 + k * 0.35)); if (wet < 0.05) continue; // in step with the foam, so the wet reaches where the wave breaks
          const a = tideMid[k]!, b = tideMid[(k + 1) % tideMid.length]!, ia = tideIn[k]!, ib = tideIn[(k + 1) % tideIn.length]!;
          const wa = tlerp(a, ia, 0.3 + wet * 0.7), wb = tlerp(b, ib, 0.3 + wet * 0.7);
          tide.moveTo(a[0], a[1]).lineTo(b[0], b[1]).lineTo(wb[0], wb[1]).lineTo(wa[0], wa[1]).closePath().fill({ color: C.wetSand, alpha: 0.3 * wet });
        }
        // caustics: a soft moving glint on the shallow water just off the sand
        for (let k = 0; k < shallowLine.length; k += 3) { const ph = Math.sin(t / 20 + k * 0.7); if (ph < 0.45) continue; const a = shallowLine[k]!, b = shallowLine[(k + 1) % shallowLine.length]!; tide.moveTo(a[0], a[1]).lineTo(b[0], b[1]).stroke({ width: 2, color: C.foam, alpha: 0.14 * (ph - 0.45), cap: "round" }); }
      };
      const seaLife = new Graphics(); world.addChild(seaLife);
      const coastalLife = new CoastalLife((a, r) => ({ x: cx + Rx * wobble(a) * r * Math.cos(a), y: cy + Ry * wobble(a) * r * Math.sin(a) }), inside);
      world.addChild(coastalLife.root);
      const drawFoam = (t: number, rough: number) => {
        foam.clear();
        for (let k = 0; k < shoreLine.length; k += 2) { const ph = Math.sin(t / 30 + k * 0.35); if (ph < -0.2) continue; const a = shoreLine[k]!, b = shoreLine[(k + 1) % shoreLine.length]!; foam.moveTo(a[0], a[1]).lineTo(b[0], b[1]).stroke({ width: 2.5 + rough * 2, color: C.foam, alpha: 0.45 + 0.45 * ph, cap: "round" }); }
        for (let k = 0; k < shoreOut.length; k += 3) { const ph = Math.sin(t / 42 + k * 0.5 + 1); if (ph < 0.3 && rough < 0.5) continue; const a = shoreOut[k]!, b = shoreOut[(k + 1) % shoreOut.length]!; foam.moveTo(a[0], a[1]).lineTo(b[0], b[1]).stroke({ width: 2, color: C.foam, alpha: 0.25 + 0.3 * Math.max(0, ph) + rough * 0.3, cap: "round" }); }
      };

      // everything with a foot on the ground sorts by y
      const footfall = new Footfall(); world.addChild(footfall.g);
      // the miniature's table and plinth: the table covers everything past the bay, so the sea inside it reads as resin poured round the model
      const rim = outline(BAY);
      const table = new Graphics(); drawTable(table, W, H); const tableCut = new Graphics().rect(-4000, -4000, W + 8000, H + 8000).fill(0xffffff).poly(rim.flat()).cut();
      const plinthShadow = new Graphics(), plinth = new Graphics(); drawPlinth(new Graphics(), plinth, rim, 0.3);
      // its shadow on the table, soft-edged by a few widening layers rather than a blur the size of the island every frame
      for (let i = 5; i >= 0; i--) plinthShadow.poly(rim.flatMap(([x, y]) => { const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy) || 1; return [x + 12 + (dx / d) * i * 14, y + PLINTH + 50 + (dy / d) * i * 9]; })).fill({ color: 0x1b140f, alpha: i ? 0.07 : 0.2 });
      const onTable = new Container(); onTable.addChild(table, plinthShadow); onTable.mask = tableCut; // the table and the plinth's shadow on it, only past the rim
      const model = new Container(); model.addChild(onTable, tableCut, plinth); model.visible = false; world.addChild(model);
      const scene = new Container(); scene.sortableChildren = true; world.addChild(scene);
      // everything standing on the ground is drawn in code, in one projection, at its natural size; props may be scaled
      const shadows = new Graphics(); shadows.zIndex = 0.5; scene.addChild(shadows);
      // the ring under a selected person, and the pulse that marks the actors of a picked event
      const emphasis = new Graphics(); emphasis.zIndex = 0.55; scene.addChild(emphasis);
      const pulses = new Map<string, number>();
      const shadowSpecs: { x: number; y: number; w: number }[] = [];
      // trees and bushes are replanted each season, so their sun-cast specs live apart and are rebuilt, never piled up
      const treeSpecs: { x: number; y: number; w: number }[] = [];
      // shadows sit under things at noon and lean away from the sun: long to the west in the morning, long to the east in the evening, warm when the sun is low.
      // Each is a pool at the foot and a cast from the walls, so buildings and trees read as standing in one light.
      const redrawShadows = (elev: number, dir: number, low: number) => {
        shadows.clear(); const L = 0.12 + Math.pow(1 - elev, 2) * 0.9; const color = low > 0.05 ? LIGHT.lowSunShadow : C.kelp; const a = 0.08 + low * 0.05;
        for (const sp of [...shadowSpecs, ...treeSpecs]) {
          const rx = sp.w * 0.5, ry = Math.max(6, sp.w * 0.16), bx = sp.x + sp.w * 0.12, by = sp.y + 4; const len = sp.w * L * 0.7;
          shadows.moveTo(bx - rx * 0.75, by).lineTo(bx + rx * 0.75, by).lineTo(bx + rx * 0.75 + dir * len, by - len * 0.22).lineTo(bx - rx * 0.75 + dir * len, by - len * 0.22).closePath().fill({ color, alpha: a * 0.8 });
          shadows.ellipse(bx + dir * len, by - len * 0.22, rx * 0.75, ry * 0.8).fill({ color, alpha: a * 0.8 });
          shadows.ellipse(bx, by, rx, ry).fill({ color, alpha: a });
          // a tighter, darker core where the thing meets the ground, so buildings and trees sit rather than float
          shadows.ellipse(bx, by, rx * 0.5, ry * 0.55).fill({ color, alpha: a * 0.7 });
        }
      };
      const shadowUnder = (x: number, y: number, w: number) => { if (w < 30) return; shadowSpecs.push({ x, y, w }); shadows.ellipse(x + w * 0.12, y + 4, w * 0.5, Math.max(6, w * 0.16)).fill({ color: C.kelp, alpha: 0.09 }); };
      // each natural thing varies a little by where it stands, so a wood or a shore of one drawing never reads as clones; stable per position, so it does not jump between seasons
      const ORGANIC = /^(tree-small|tree-large|bush|olive|cypress|rock|searocks)$/;
      const vhash = (x: number, y: number, s: number) => { const h = Math.sin(x * 12.9898 + y * 78.233 + s * 37.719) * 43758.5453; return h - Math.floor(h); };
      const VARY_TINTS = [0xffffff, 0xf3eede, 0xebf0e3, 0xf8f1e2, 0xe6ede0, 0xfcf6e9];
      // ordinary houses come from a handful of drawings; a faint per-building shade keeps a row from reading as identical. Landmarks (council, mill, chapel, lighthouse) stay canonical.
      const BUILDING = /^(house|cottage|shop|inn|tavern|bakery|chandlery|harbor-office|smithy|fishhouse|boatshed)\d*$/;
      const BLD_TINTS = [0xffffff, 0xf7f3ea, 0xf2f2ee, 0xfbf5ec, 0xeef0ee, 0xf9f4e6];
      // roughly where the roof of each building sits above its foot, shared by the golden-hour roof light and the foundation moss
      const ROOF_Y: Record<string, number> = { house: -150, cottage: -120, shop: -150, inn: -195, tavern: -150, bakery: -155, chandlery: -155, "harbor-office": -140, smithy: -130, fishhouse: -115, boatshed: -115, council: -195, mill: -165, chapel: -165, lighthouse: -225 };
      // the common houses come in a few colour-and-roof variants in the atlas; each building keeps the same one by its position
      const VARIANTS_OF: Record<string, string[]> = { house: ["house", "house2", "house3"], cottage: ["cottage", "cottage2", "cottage3"], shop: ["shop", "shop2", "shop3"] };
      const bldVariant = (sprite: string, x: number, y: number) => { const v = VARIANTS_OF[sprite]; return v ? v[Math.floor(vhash(x, y, 13) * v.length)]! : sprite; };
      const mulTint = (a: number, f: number) => (Math.round(((a >> 16) & 255) * ((f >> 16) & 255) / 255) << 16) | (Math.round(((a >> 8) & 255) * ((f >> 8) & 255) / 255) << 8) | Math.round((a & 255) * (f & 255) / 255);
      const put = (name: string, x: number, y: number, w?: number, flip = false) => {
        const d = drawThing(name); if (!d) return null;
        const c = d.c; if (w) c.scale.set(w / d.w); if (flip) c.scale.x *= -1; c.position.set(x, y); c.zIndex = y; scene.addChild(c);
        if (ORGANIC.test(name)) {
          const s = 0.87 + vhash(x, y, 1) * 0.26; c.scale.x *= s; c.scale.y *= s;
          const t = VARY_TINTS[Math.floor(vhash(x, y, 2) * VARY_TINTS.length)] ?? 0xffffff;
          for (const ch of c.children) if ("tint" in ch) (ch as { tint: number }).tint = mulTint((ch as { tint: number }).tint, t);
          if (/rock|searocks/.test(name)) c.rotation = (vhash(x, y, 3) - 0.5) * 0.16;
        }
        if (!/^(lamp|fence|field|pier|tree-small|tree-large|bush|olive|cypress)$/.test(name)) shadowUnder(x, y, w ?? d.w);
        return c;
      };
      // a place's name on the ground: ink with a paper edge, so it reads on sand, grass, stone and in the dark alike
      const nameStyle = new TextStyle({ fontFamily: uiFont(), fontSize: 10, fontWeight: "500", fill: 0x536451, letterSpacing: 1.2, stroke: { color: 0xeee5cd, width: 2, join: "round" } });
      // a place's name painted on its signboard, cream on the dark board, laid flat on the wall it hangs from
      const signStyle = new TextStyle({ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 40, fontWeight: "700", fill: 0xf2e6c8, letterSpacing: 3 });
      const smallStyle = new TextStyle({ fontFamily: uiFont(), fontSize: 11, fontWeight: "700", fill: 0x1e5a63, stroke: { color: 0xf7f6f3, width: 3, join: "round" } });
      // each place owns its drawn things so it can be redrawn when someone builds on it
      const drawn = new Map<string, Container>();
      const drawnMarks = new Map<string, Container>();
      const drawPlace = (p: PlaceView) => {
        drawn.get(p.id)?.destroy({ children: true });
        const g = new Container(); g.sortableChildren = true; g.zIndex = p.y; scene.addChild(g); drawn.set(p.id, g);
        const local = (name: string, w?: number) => { const d=drawThing(name);if(!d)return null;const s=d.c;if(w)s.scale.set(w/d.w);s.zIndex=0;g.addChild(s);shadowUnder(p.x,p.y,w??d.w); if(BUILDING.test(name)){const t=BLD_TINTS[Math.floor(vhash(p.x,p.y,5)*BLD_TINTS.length)]??0xffffff;for(const ch of s.children)if("tint" in ch)(ch as {tint:number}).tint=mulTint((ch as {tint:number}).tint,t);} return s; };
        if (p.kind === "plot" && !p.site) {
          // pegged-out land: a dashed rectangle and four stakes
          const r = new Graphics(); r.rect(-80, -60, 160, 70).fill({ color: C.sage, alpha: 0.3 });
          r.moveTo(-80, -60).lineTo(80, -60).lineTo(80, 10).lineTo(-80, 10).closePath().stroke({ width: 1.2, color: 0xc9b58f }); // a rope between the stakes
          for (let i = 0; i < 4; i++) { const x0 = -80 + (i % 2) * 160, y0 = -60 + Math.floor(i / 2) * 70; r.roundRect(x0 - 2.5, y0 - 14, 5, 15, 2).fill(0xc9b58f).stroke({ width: 1, color: C.kelp }); }
          if (p.owner) { r.roundRect(-16, -22, 32, 10, 2).fill(C.shell).stroke({ width: 1.2, color: C.kelp }); r.moveTo(0, -12).lineTo(0, 0).stroke({ width: 2, color: 0xc9b58f }); } // bought: a board on a post
          g.addChild(r);
          if(p.community) { const t = new Text({text:`${p.community.name} · ${p.community.coins}/${p.community.target} coins`,style:smallStyle});t.anchor.set(.5,0);t.position.set(0,16);g.addChild(t); }
        } else if (p.site?.what === "garden") {
          g.addChild(drawConstruction(p.site.done, p.site.of, "garden"));
          const t = new Text({ text: `${p.site.name} · ${p.site.done} of ${p.site.of}`, style: smallStyle }); t.anchor.set(.5,0); t.position.set(0,65); g.addChild(t);
        } else if (p.site) {
          // a site: timber frame, a crates pile, and how many mornings are done
          const r = new Graphics(); const done = Math.min(1, p.site.done / Math.max(1, p.site.of));
          r.rect(-70, -70, 140, 70).fill({ color: C.sand, alpha: 0.9 }); // the cleared ground
          // walls rise a course per morning worked, in the island's stone, with the door left open
          g.addChild(drawConstruction(p.site.done,p.site.of,p.site.what));
          // scaffold: poles, ledgers, braces, a ladder against it
          for (const x of [-72, -24, 24, 72]) r.moveTo(x, 4).lineTo(x, -78).stroke({ width: 4, color: 0xc9b58f, cap: "round" });
          for (const y of [-40, -76]) r.moveTo(-72, y).lineTo(72, y).stroke({ width: 3, color: 0xc9b58f });
          r.moveTo(-72, -40).lineTo(-24, -76).moveTo(24, -40).lineTo(72, -76).stroke({ width: 2, color: 0xc9b58f, alpha: 0.8 });
          r.moveTo(80, 6).lineTo(96, -72).moveTo(88, 6).lineTo(104, -72).stroke({ width: 2.5, color: 0xa3906d }); for (let k = 0; k < 7; k++) { const t = k / 7; r.moveTo(80 + 16 * t, 6 - 78 * t).lineTo(88 + 16 * t, 6 - 78 * t).stroke({ width: 2, color: 0xa3906d }); }
          // The shared construction mask reveals the actual clay roof as work completes.
          g.addChild(r);
          // the plank pile and the sand heap by the site
          const pile = new Graphics(); for (let k = 0; k < 4; k++) pile.rect(-118, -6 - k * 5, 40, 4).fill(k % 2 ? 0xc4b08c : 0xd6c49e).stroke({ width: 1, color: C.kelp }); pile.ellipse(-90, 6, 14, 5).fill({ color: C.sand, alpha: 0.9 }).stroke({ width: 1, color: C.kelp, alpha: 0.4 }); g.addChild(pile);
          const t = new Text({ text: `${p.site.name} · ${p.site.done} of ${p.site.of}`, style: smallStyle }); t.anchor.set(0.5, 0); t.position.set(0, 6); g.addChild(t);
        } else if (p.sprite.startsWith("look:")) {
          // a building someone described: the plain kind stands in until the island's drawing of it arrives
          const standIn = p.kind === "shop" ? "shop" : "house"; const stand = local(streetHouse(standIn, vhash(p.x, p.y, 13)) ?? bldVariant(standIn, p.x, p.y));
          void lookSvg(p.sprite.slice(5)).then((svg) => { if (!svg || g.destroyed) return; const d = new Graphics(); try { d.svg(svg); } catch { return; } const b = d.getLocalBounds(); if (b.width < 1) return; const target = p.kind === "shop" ? 120 : 104; const sc = target / b.width; d.scale.set(sc); d.position.set(-(b.x + b.width / 2) * sc, -(b.y + b.height) * sc); d.zIndex = 0; stand?.destroy(); g.addChild(d); });
        } else {
          const drawing = streetHouse(p.sprite, vhash(p.x, p.y, 13)) ?? bldVariant(p.sprite, p.x, p.y); local(drawing);
          const kind = kindOfDrawing(drawing); const board = kind ? signPlacement(kind) : null;
          if (board) {
            const sign = new Text({ text: p.name.replace(/^the /i, "").toUpperCase(), style: signStyle }); sign.anchor.set(0.5);
            // as tall as the board allows, narrowed to fit a long name
            let k = (board.h * 0.62) / 40; if (sign.width * k > board.w * 0.9) k = (board.w * 0.9) / sign.width;
            sign.setFromMatrix(new Matrix(board.along[0] * k, board.along[1] * k, board.down[0] * k, board.down[1] * k, board.x, board.y)); sign.zIndex = 1.5; g.addChild(sign);
          }
          // #3: moss and lichen creep up the foot of a building, a little on every one and more on some, so the stone reads as lived-in and aged
          if (ROOF_Y[p.sprite] !== undefined) { const moss = new Graphics(); const n = 8 + Math.floor(vhash(p.x, p.y, 7) * 11); for (let i = 0; i < n; i++) { const mx = -54 + vhash(p.x + i, p.y, 8) * 108, mz = vhash(p.x, p.y + i, 9) * 30; moss.ellipse(mx, -mz, 3.5 + vhash(i, p.y, 10) * 5, 2.2 + vhash(i, p.x, 11) * 3).fill({ color: i % 3 ? 0x6f8158 : 0x8a9470, alpha: 0.2 + vhash(i, i + 3, 12) * 0.16 }); } moss.zIndex = 0.3; g.addChild(moss); }
          if (p.stock) { const st = drawStock(p.sprite, p.stock, drawing); if (st) { st.zIndex = 1; g.addChild(st); } }
          // the shelf is bare: a board leans by the door until the cart or the work fills it again
          if (p.stock && (p.kind === "shop" || p.kind === "workplace" || p.kind === "market") && Object.values(p.stock).every((v) => v <= 0)) { const sg = drawSign("nothing left"); sg.position.set(-58, -10); sg.zIndex = 2; g.addChild(sg); const st = new Text({ text: "Sold out", style: { ...smallStyle, fontSize: 7, stroke: { color: 0xeee3cc, width: 0 } } }); st.anchor.set(0.5, 0.5); st.position.set(-58, -33); st.zIndex = 3; g.addChild(st); }
          // owned: the owner's name on a board by the door
          if (p.owner && p.kind !== "plot") { const nb = new Graphics(); nb.roundRect(-30, -12, 60, 11, 2).fill(C.shell).stroke({ width: 1.2, color: C.kelp }); nb.position.set(48, -6); nb.zIndex = 2; g.addChild(nb); const nt = new Text({ text: p.owner.split(" ").slice(-1)[0]!.toUpperCase(), style: { ...smallStyle, fontSize: 7 } }); nt.anchor.set(0.5, 0.5); nt.position.set(48, -12.5); nt.zIndex = 3; g.addChild(nt); }
        }
        const possessions = (p.storedCount ?? 0) + (p.looseCount ?? 0);
        if (possessions > 0) {
          const chest = new Graphics();
          for (let i=0;i<Math.min(3,Math.ceil(possessions/4));i++) {
            chest.roundRect(55+i*15,5-i*5,22,15,2).fill(0xb28e63).stroke({width:1,color:C.kelp});
            chest.moveTo(56+i*15,10-i*5).lineTo(76+i*15,10-i*5).stroke({width:1,color:C.kelp,alpha:.5});
          }
          chest.zIndex=3;g.addChild(chest);
        }
        const t = new Text({ text: p.name.replace(/^the /, "").replace(/^an? /, "").toUpperCase(), style: nameStyle }); t.anchor.set(0.5, 0); t.position.set(0, p.site ? 22 : 6); t.zIndex = 100000; g.addChild(t);
        const marks = drawPlaceMarks(p.decorations ?? [], i=>markPosition(i,p,{x:cx,y:cy},inside)); g.addChild(marks); drawnMarks.set(p.id, marks);
        g.position.set(p.x, p.y);
        g.eventMode = "static"; g.cursor = "pointer"; const bounds=g.getLocalBounds(); g.hitArea=new Rectangle(bounds.x-8,bounds.y-8,bounds.width+16,bounds.height+16);
        g.on("pointertap", () => { if (performance.now() < suppressSelectUntil) return; const here = [...agents.current.values()].filter((a) => a.location === p.id); onSelect(null); placePast.current=null; setPlaceInfo({ decorations:p.decorations, community: p.community, stock: p.stock, hasHistory: p.hasHistory, id: p.id, name: p.name, district: p.district, kind: p.kind, sprite: p.sprite, owner: p.owner, site: p.site, people: here.map((a) => ({ id: a.id, name: a.name, asleep: a.asleep, job: a.job, appearance: a.appearance, age: a.age, carrying:a.carrying, ...(a.pose ? { pose: a.pose } : {}) })) }); });
      };
      for (const p of places.values()) drawPlace(p);
      // the konoba brings its own tables under its vine, so the tavern's terrace and parasol stay away
      const tavern = places.get("tavern"); const konoba = !classic && !!tavern && DALMATIAN_FOR[tavern.sprite]?.kind === "konoba";
      const decor = keepOffRoads(decorFor([...places.values()]), segs).filter((d) => !(konoba && tavern && /^(terrace|parasol)$/.test(d.sprite) && Math.hypot(d.x - tavern.x, d.y - tavern.y) < 160));
      let trees: Container[] = [];
      /** which drawing each tree is, for where its crown sits */
      const treeKind = new WeakMap<Container, string>(); let snowCaps: Graphics[] = [];
      /** a tree's crowns in the world: its drawing's crowns through the tree's place, size and flip */
      const crownsOf = (t: Container) => treeCrowns(treeKind.get(t) ?? "").map((c) => ({ x: t.position.x + c.x * t.scale.x, y: t.position.y + c.y * t.scale.y, rx: c.rx * Math.abs(t.scale.x), ry: c.ry * t.scale.y }));
      const plantTrees = () => {
        treeSpecs.length = 0; // rebuilt from scratch each replant, so season changes never pile shadows up
        for (const t of trees) t.destroy({ children: true }); trees = []; snowCaps = [];
        for (const d of decor) { if (!/tree|bush|olive|cypress/.test(d.sprite)) continue; const sp = put(d.sprite, d.x, d.y, d.w, d.flip); if (!sp) continue; treeKind.set(sp, d.sprite);
          // snow settles on the top of each crown; it is part of the tree, so it sways with it and stays behind what stands in front
          const crowns = treeCrowns(d.sprite); if (crowns.length) { const cap = new Graphics(); for (const c of crowns) { cap.ellipse(c.x, c.y - c.ry * 0.45, c.rx * 0.85, c.ry * 0.55).fill(0xffffff); cap.ellipse(c.x - c.rx * 0.25, c.y - c.ry * 0.72, c.rx * 0.45, c.ry * 0.32).fill({ color: 0xffffff, alpha: 0.9 }); } cap.alpha = 0; cap.label = "snowcap"; /* the weather step sets how much has settled */ sp.addChild(cap); snowCaps.push(cap); } const sw = sp.width; if (sw >= 30) treeSpecs.push({ x: sp.x, y: sp.y, w: sw }); const sh = new Graphics(); sh.ellipse(d.w ? d.w * 0.12 : 8, 3, d.sprite === "tree-large" ? 40 : d.sprite === "bush" ? 12 : 26, d.sprite === "tree-large" ? 12 : d.sprite === "bush" ? 4 : 8).fill({ color: C.kelp, alpha: 0.09 }); sp.addChildAt(sh, 0); trees.push(sp); }
      };
      setSeason(forcedSeason ?? clockRef.current?.season ?? townView.season ?? "summer");
      for (const d of decor) { if (/tree|bush|olive|cypress/.test(d.sprite)) continue; put(d.sprite, d.x, d.y, d.w, d.flip); }
      plantTrees();
      const SEASON_CAST: Record<string, number> = { winter: 0xeaf0f0, spring: 0xffffff, summer: 0xfbf2dc, autumn: 0xf7e9d2 };
      // wet ground darkens the island under the rain; snow settles on it and melts again
      const wetGround = new Graphics(); poly(wetGround, outline(0.99)).fill(C.kelp); wetGround.alpha = 0; world.addChild(wetGround);
      const lavender = new Graphics(); lavender.visible = false; world.addChild(lavender);
      { const f = places.get("fields"), o = places.get("orchard"); for (const p of [f, o]) { if (!p) continue; for (let r = 0; r < 7; r++) for (let k = 0; k < 9; k++) { const x = p.x - 200 + k * 46 + (r % 2) * 23, y = p.y + 60 + r * 26; if (inside(x, y) > 0.96) continue; lavender.ellipse(x, y, 14, 7).fill({ color: 0x9a8fc4, alpha: 0.85 }); lavender.ellipse(x, y - 2, 9, 4).fill({ color: 0xb8aee0, alpha: 0.9 }); } } }
      const snowGround = new Graphics(); poly(snowGround, outline(0.99)).fill(0xffffff); snowGround.alpha = 0; world.addChild(snowGround); let snowiness = 0;
      // the moving parts of the drawn things, found by their labels
      const findParts = (label: string): Container[] => { const out: Container[] = []; const walk = (n: Container) => { if (n.label === label) out.push(n); for (const ch of n.children) if (ch instanceof Container) walk(ch); }; walk(scene); return out; };
      const sails = findParts("sails"), bells = findParts("bell"), cloths = findParts("cloth"); let millSpeed = 0;
      const boats = [...scene.children].filter((ch) => decor.some((d) => d.sprite === "rowboat" && Math.abs(ch.position.x - d.x) < 1 && Math.abs(ch.position.y - d.y) < 1)) as (Container & { userData: number })[]; for (const bt of boats) bt.userData = bt.position.y;
      const updateMoorings=harborMoorings(scene,boats,decor.filter(d=>d.sprite==="pier"));
      let detailSeconds=0;const quietMotion=window.matchMedia("(prefers-reduced-motion: reduce)");
      const wake = new Graphics(); wake.zIndex = 0.6; scene.addChild(wake);
      const aboard: Container[] = []; // figures riding the boat, parented to it
      const gulls = new Graphics(); gulls.zIndex = 180000; scene.addChild(gulls);
      const rays = new Graphics(); rays.zIndex = 148000; rays.blendMode = "add"; scene.addChild(rays); // soft light shafts through the pinewood at dawn and dusk; additive, so they glow where they cross shade and vanish over the brightest sand
      const CHIMNEYS: Record<string, [number, number]> = { smithy: [44, -150], bakery: [30, -180], inn: [60, -210], mill: [0, -220], tavern: [40, -150], fishhouse: [30, -120] };
      const litHearths = new Set<string>();
      const HEARTHS: Record<string, [number, number]> = { inn: [60, -210], tavern: [40, -150], chandlery: [30, -150], boatshed: [20, -120], council: [50, -190] }; // where a fire is kept for the people inside, not the work
      // a Dalmatian house smokes from its own chimney
      if (!classic) for (const table of [CHIMNEYS, HEARTHS]) for (const id of Object.keys(table)) { const m = DALMATIAN_FOR[places.get(id)?.sprite ?? ""]; if (m) table[id] = chimneyTop(m.kind); }
      const harbor = places.get("harbor") ?? { x: 560, y: 1180 };
      const dockX = harbor.x - 420, awayX = -760;
      const boat = put("boat", dockX, harbor.y + 20)!; boat.zIndex = harbor.y - 30; let boatTarget = dockX;

      // weather and time
      const rain = new Graphics(); rain.zIndex = 200000; scene.addChild(rain);
      const puddles = new Graphics(); puddles.zIndex = 1; scene.addChild(puddles); let wetness = 0;
      const smoke = new Graphics(); smoke.zIndex = 190000; scene.addChild(smoke);
      const fog = new Graphics(); fog.zIndex = 210000; scene.addChild(fog);
      const flash = new Graphics(); flash.rect(-3000, -3000, W + 6000, H + 6000).fill(0xffffff); flash.alpha = 0; world.addChild(flash); let nextBolt = 0;
      // night is its own look, not the day under a veil: the dark multiplies the colours down into a moonlit blue, so the stone stays stone and the
      // lamps and windows stay warm, where a flat navy laid over the top greyed everything into haze. ?nofx=nightlook shows the old veil.
      const nightLook = !nofx.has("nightlook");
      const night = new Graphics(); night.rect(-3000, -3000, W + 6000, H + 6000).fill(LIGHT.night); night.alpha = 0; world.addChild(night); // its alpha is how dark the island reckons it, 0 to .42
      const moonlit = new Graphics(); moonlit.rect(-3000, -3000, W + 6000, H + 6000).fill(LIGHT.moon); moonlit.blendMode = "multiply"; moonlit.alpha = 0; world.addChild(moonlit);
      if (nightLook) night.renderable = false; else moonlit.visible = false;
      world.addChild(nightGlow); // lit windows, added back over the moonlit dark
      // the GPU's share, behind a switch so the old street and the new can be compared: night the lights cut through, and water that moves
      const lighting = new Lighting(world, W, H, nightLook); const water = new WaterFilter(); let effectsOn = false;
      water.island(cx, cy, Rx, Ry);
      const lightArea = new Rectangle(); lighting.dark.filterArea = lightArea; lighting.glow.filterArea = lightArea;
      // the ground shadows soften at their edges the way a real sun's do; blurred over the screen only, like the light layers
      const shadowBlur = new BlurFilter({ strength: 3, quality: 2 }); shadows.filterArea = lightArea; // the layers are world-sized; the filter only needs the screen, or retina fills a texture many times larger every frame
      const post = new Post(app); let gradeNow: Grade = NEUTRAL; // the picture after the world: the map as a miniature, the night blooming, the cinema's grain and bars
      const sunGrade = new Sky(W, H); world.addChildAt(sunGrade.veil, world.getChildIndex(lighting.glow)); world.addChild(sunGrade.glow, sunGrade.halo); // the cast under the night's layers, the light above them
      sunGrade.veil.visible = sunGrade.glow.visible = sunGrade.halo.visible = false;
      const clouds = new Clouds(W, H); clouds.shadows.zIndex = 0.4; scene.addChild(clouds.shadows); clouds.puffs.zIndex = 220000; scene.addChild(clouds.puffs);
      const weatherFx = new Weather(W, H); weatherFx.rain.zIndex = 200000; scene.addChild(weatherFx.rain); weatherFx.snow.zIndex = 200001; scene.addChild(weatherFx.snow); weatherFx.fog.zIndex = 210000; scene.addChild(weatherFx.fog);
      const dusk = new Graphics(); dusk.rect(-3000, -3000, W + 6000, H + 6000).fill(LIGHT.dusk); dusk.alpha = 0; world.addChild(dusk);
      const lamps = new Graphics(); lamps.zIndex = 150000; scene.addChild(lamps);
      const caps = new Graphics(); caps.zIndex = 170000; scene.addChild(caps); // snow and rain on the roofs
      const prints_ = new Graphics(); prints_.zIndex = 0.7; scene.addChild(prints_); const prints: { x: number; y: number; at: number }[] = [];
      const moths = new Graphics(); moths.zIndex = 150001; scene.addChild(moths);
      // the small life: it needs to know where the posts, the benches, the yard and the trees are
      // the six o'clock cart: a carter pulling a cart along the roads, leg by leg as the record names them; empty where a link has failed
      const roadTo = (from: string, to: string): string[] => { if (from === to) return [from]; const prev = new Map<string, string | null>([[from, null]]); const q = [from]; while (q.length) { const cur = q.shift()!; for (const nx of places.get(cur)?.exits ?? []) if (!prev.has(nx)) { prev.set(nx, cur); q.push(nx); } } if (!prev.has(to)) return [from, to]; const out: string[] = []; for (let cur: string | null = to; cur; cur = prev.get(cur) ?? null) out.unshift(cur); return out; };
      const carter = { g: new Container(), rig: makeRig(lookFor("the carter", { build: "Sturdy", hair: "Short dark", hat: "Wide brim", carrying: "Nothing", top: "Sand", bottom: "Kelp", coral: "None" })), cart: new Container() as Container, queue: [] as { from: string; to: string; item: string; qty: number; route: string[] }[], path: [] as { x: number; y: number }[], at: null as string | null, load: null as { item: string; qty: number } | null, x: 0, y: 0, busy: false, pause: 0 };
      carter.rig.scale.set(0.9); carter.rig.setPose("walk"); carter.g.addChild(carter.cart); carter.g.addChild(carter.rig); carter.rig.position.set(26, 0); carter.cart.position.set(-14, 0); carter.g.visible = false; scene.addChild(carter.g);
      const setLoad = (load: { item: string; qty: number } | null) => { carter.load = load; carter.cart.removeChildren().forEach((ch) => ch.destroy({ children: true })); carter.cart.addChild(drawCart(load)); };
      setLoad(null);
      const cartTick = () => {
        const c = carter;
        if (c.pause > 0) { c.pause--; return; }
        if (!c.path.length) {
          const leg = c.queue[0]; if (!leg) { if (c.busy) { c.busy = false; c.g.visible = false; } return; }
          if (!c.busy) { c.busy = true; c.at = leg.from; const p0 = places.get(leg.from); if (p0) { c.x = p0.x; c.y = p0.y + 30; } c.g.visible = true; }
          if (c.at !== leg.from) { c.path = roadTo(c.at ?? leg.from, leg.from).slice(1).map((id) => { const p = places.get(id)!; return { x: p.x, y: p.y + 30 }; }); c.at = leg.from; setLoad(null); return; } // go and fetch it, empty
          if (!c.load) { setLoad({ item: leg.item, qty: leg.qty }); c.pause = 40; return; } // loading
          c.path = (leg.route.length > 1 ? leg.route : roadTo(leg.from, leg.to)).slice(1).map((id) => { const p = places.get(id)!; return { x: p.x, y: p.y + 30 }; }); c.at = leg.to;
          if (!c.path.length) { c.queue.shift(); setLoad(null); void refreshPlaces(); }
          return;
        }
        const t = c.path[0]!; const dx = t.x - c.x, dy = t.y - c.y, d = Math.hypot(dx, dy); const st = Math.min(d, 2.2);
        if (d > 0.5) { c.x += (dx / d) * st; c.y += (dy / d) * st; const face = dx < 0 ? -1 : 1; c.rig.face(face); c.g.scale.x = 1; c.rig.position.set(26 * face, 0); c.cart.position.set(-14 * face, 0); c.cart.scale.x = face; }
        else { c.path.shift(); if (!c.path.length) { const leg = c.queue[0]; if (leg && c.at === leg.to && c.load) { c.queue.shift(); setLoad(null); c.pause = 40; void refreshPlaces(); } } }
        c.g.position.set(c.x, c.y); c.g.zIndex = c.y; c.rig.update(Date.now() / 1000);
      };
      const life = (() => {
        const pier = decor.find((d) => d.sprite === "pier"); const rocks = decor.filter((d) => d.sprite === "searocks"); const crates = decor.filter((d) => d.sprite === "crates"); const benches = decor.filter((d) => d.sprite === "bench");
        const perches: { x: number; y: number; dir: 1 | -1 }[] = [];
        if (pier) for (const off of [-110, -22, 66, 110]) perches.push({ x: pier.x + off, y: pier.y - 18, dir: off < 0 ? -1 : 1 });
        for (const r of rocks) { perches.push({ x: r.x + 14, y: r.y - 20, dir: 1 }); if (perches.length % 3 === 0) perches.push({ x: r.x - 16, y: r.y - 16, dir: -1 }); }
        for (const cr of crates) perches.push({ x: cr.x, y: cr.y - 30, dir: -1 });
        const inn = places.get("inn"), fh = places.get("fishhouse"), tav = places.get("tavern");
        const catSpots = [inn ? { x: inn.x - 40, y: inn.y + 10 } : { x: harbor.x, y: harbor.y }, ...benches.map((b) => ({ x: b.x, y: b.y })), ...(tav ? [{ x: tav.x - 50, y: tav.y + 10 }] : []), ...(fh ? [{ x: fh.x + 30, y: fh.y + 20 }] : [])];
        const f = places.get("fields") ?? { x: 2380, y: 1000 }, o = places.get("orchard") ?? { x: 2360, y: 1320 }, lh = places.get("lighthouse") ?? { x: 2660, y: 420 }, ch = places.get("chapel") ?? { x: 1820, y: 760 }, pw = places.get("pinewood") ?? { x: 1900, y: 380 };
        let moor = { x: (pier?.x ?? harbor.x - 250) - 150, y: (pier?.y ?? harbor.y + 40) + 30 }; for (let i = 0; i < 80 && inside(moor.x, moor.y) < 1.05; i++) moor = { x: moor.x - 6, y: moor.y };
        let spot = { x: moor.x - 300, y: moor.y - 160 }; for (let i = 0; i < 80 && inside(spot.x, spot.y) < 1.18; i++) spot = { x: spot.x - 8, y: spot.y - 3 };
        return new Life({
          perches, catSpots, dogHome: { x: harbor.x + 80, y: harbor.y + 70 }, yard: { x: f.x + 150, y: f.y + 200, r: 70 },
          trees: () => trees.map((t) => ({ x: t.position.x, y: t.position.y, h: Math.max(20, ...crownsOf(t).map((c) => t.position.y - c.y), 20), orchard: Math.hypot(t.position.x - o.x, t.position.y - o.y) < 260 })),
          flag: { x: (pier?.x ?? harbor.x - 250) - 118, y: (pier?.y ?? harbor.y + 40) - 12 }, moor, spot, lantern: !classic && DALMATIAN_FOR[(lh as PlaceView).sprite ?? ""] ? { x: lh.x + lanternAt()[0], y: lh.y + lanternAt()[1] } : { x: lh.x, y: lh.y - 233 },
          meadows: [{ x: f.x - 40, y: f.y + 140, r: 220 }, { x: o.x, y: o.y + 40, r: 200 }, { x: pw.x - 60, y: pw.y + 120, r: 180 }], roosts: [{ x: lh.x, y: lh.y - 100 }, { x: ch.x, y: ch.y - 70 }],
        }, scene);
      })();
      life.figurine = !classicFigures; // the cat, the dog and the hens are painted figurines too, unless the classic figures were asked for
      const particles = new Particles(scene); world.addChild(particles.glow); // embers and sparks above the night, dust and pollen in the scene
      const sunNow = { elev: 1, dir: 1, low: 0 }; const lastCart = { x: 0, y: 0 }; const lifeMeadows = (() => { const f = places.get("fields"), o = places.get("orchard"), pw = places.get("pinewood"); return [f && { x: f.x - 40, y: f.y + 140, r: 220 }, o && { x: o.x, y: o.y + 40, r: 200 }, pw && { x: pw.x - 60, y: pw.y + 120, r: 180 }].filter((m): m is { x: number; y: number; r: number } => !!m); })();
      world.addChild(life.glow); lighting.dark.addChild(life.cut); // the beam cuts the shade; what glows sits above it, so the night cannot dim it
      const sky = new Graphics(); sky.alpha = 0; world.addChild(sky); // stars and the moon over the water, after the night shade so they stay bright
      let lastStop = -1; // the miniature's last posed frame
      const falling = new Map<number, { x: number; y: number }>();
      const STARS = Array.from({ length: 160 }, (_, i) => ({ x: ((i * 7919) % (W + 1600)) - 800, y: ((i * 104729) % (H + 1200)) - 600, r: i % 7 === 0 ? 4.5 : 2.6, tw: (i * 31) % 17 }));
      const moonPhase = () => { const days = (Date.now() - Date.UTC(2000, 0, 6, 18, 14)) / 86400000; return (days / 29.530588) % 1; }; // 0 new, 0.5 full
      const windows = new Graphics(); windows.zIndex = 160000; scene.addChild(windows);
      const ambience = new Ambience(); ambienceRef.current = ambience;

      const takenBenches = new Set<string>();
      const availableSeats = decor.flatMap((d,i) => seatsFor(d,i));
      const releaseSeat = (f: Fig) => { if(f.seat) takenBenches.delete(f.seat.key); f.seat=undefined; f.bench=false; f.rig.seatAt(null); };
      const benchAt = (place: string): Seat | null => {
        const p=places.get(place); if(!p)return null;
        const addedSeats = [...places.values()].flatMap((pl,pi) => (pl.decorations ?? []).flatMap((d,i)=>d.kind==='bench'?seatsFor({sprite:'bench',x:pl.x+markPosition(i,pl,{x:cx,y:cy},inside).x,y:pl.y+markPosition(i,pl,{x:cx,y:cy},inside).y},100000+pi*6+i):[]));
        return [...availableSeats,...addedSeats].filter(seat => !takenBenches.has(seat.key) && Math.hypot(seat.x-p.x,seat.y-p.y)<260)
          .sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0] ?? null;
      };
      const spot = (place: string, seat: number) => { const p = places.get(place) ?? places.get("market")!; const g = gather(p); const cols = 5; return { x: g.x + 20 + (seat % cols) * ((g.w - 40) / (cols - 1)), y: g.y + Math.floor(seat / cols) * 26 }; };
      const ensure = (a: PublicAgent) => {
        agents.current.set(a.id, a);
        let f = figs.current.get(a.id);
        if (!f) {
          const g = new Container();
          const rig = makeRig(aged(lookFor(a.name, a.appearance as Partial<Look> | null), a.age)); rig.age(a.age); rig.trade(a.job); rig.hold(a.carrying ?? null); g.addChild(rig);
          g.eventMode = "static"; g.cursor = "pointer"; g.hitArea = { contains: (x: number, y: number) => x > -18 && x < 18 && y > -66 && y < 0 } as never;
          g.on("pointertap", () => { if (performance.now() >= suppressSelectUntil) { placePast.current=null; setPlaceInfo(null); onSelect(agents.current.get(a.id) ?? null); } });
          g.on("pointerover", () => { hoverRef.current = a.id; }); g.on("pointerout", () => { if (hoverRef.current === a.id) hoverRef.current = null; });
          scene.addChild(g);
          const seat = seatOf.current.get(a.location) ?? 0; seatOf.current.set(a.location, (seat + 1) % 10);
          const sp = spot(a.location, seat);
          f = { id: a.id, g, rig, x: sp.x, y: sp.y, tx: sp.x, ty: sp.y, place: a.location, asleep: a.asleep, home: a.home ?? null, mine: a.id === mineId, name: a.name, pose: a.pose ?? (a.asleep ? "sleep" : "idle"), facing: 1, weak: !!a.weak, bench: false };
          figs.current.set(a.id, f);
        } else { f.asleep = a.asleep; f.home = a.home ?? null; f.weak = !!a.weak; f.rig.wear({ broke: !!a.broke, roof: !!a.roof, roofless: !!a.roofless }); f.pose = a.pose ?? (a.asleep ? "sleep" : "idle"); f.rig.trade(a.job); f.rig.hold(a.carrying ?? null); f.rig.age(a.age); if (a.location !== f.place) moveTo(a.id, a.location); }
        // Fishing is placed at the actual pier, only while the server confirms the attempt.
        if (a.activity?.kind === "fish" && a.activity.place === a.location && a.activity.until > (clockRef.current?.t ?? 0) && !a.asleep) {
          releaseSeat(f);
          const pier = decor.find(d => d.sprite === "pier");
          if (pier) { const slot = [...agents.current.values()].filter(p => p.activity?.kind === "fish").findIndex(p => p.id === a.id); f.tx = pier.x - 70 + Math.max(0, slot) * 24; f.ty = pier.y + 16; f.facing = -1; }
        }
        // someone idle where there is a bench takes it
        if (f.seat && (f.asleep || !["idle","sit","talk","eat","drink","read"].includes(f.pose))) releaseSeat(f);
        if (!f.asleep && a.activity?.kind !== "fish" && ["idle","sit","eat","drink"].includes(f.pose) && !f.bench) { const b = benchAt(f.place); if (b && !takenBenches.has(b.key)) { takenBenches.add(b.key); f.bench = true; f.seat=b; f.tx = b.x; f.ty = b.y; } }
        return f;
      };
      const moveTo = (id: string, place: string) => { const f = figs.current.get(id); if (!f) return; releaseSeat(f); const seat = seatOf.current.get(place) ?? 0; seatOf.current.set(place, (seat + 1) % 10); const sp = spot(place, seat); if (f.place && f.place !== place) { wear.step(f.place, place); trailStep(f.place, place); } f.tx = sp.x; f.ty = sp.y; f.place = place; const a = agents.current.get(id); if (a) { a.location = place; a.place = places.get(place)?.name ?? place; } };
      const refreshPlaces = async () => { try { const t = (await (await fetch(`${apiUrl}/api/town`, { cache: "no-store" })).json()) as TownView; for (const p of t.places) { const old = places.get(p.id); places.set(p.id, p); if (!old || old.kind !== p.kind || old.name !== p.name || JSON.stringify(old.decorations) !== JSON.stringify(p.decorations) || JSON.stringify(old.community) !== JSON.stringify(p.community) || JSON.stringify(old.site) !== JSON.stringify(p.site) || JSON.stringify(old.stock) !== JSON.stringify(p.stock) || old.storedCount !== p.storedCount || old.looseCount !== p.looseCount) drawPlace(p); } setPlaceInfo(info => { const p = info ? places.get(info.id) : null; return info && p ? { ...info, decorations:p.decorations, community: p.community, stock: p.stock, site: p.site, kind: p.kind, sprite: p.sprite, name: p.name, hasHistory: p.hasHistory } : info; }); } catch {} };

      // Full population snapshots are authoritative, including citizens who were moved off island.
      const syncPopulation = (list: PublicAgent[]) => {
        if (!Array.isArray(list)) return;
        const present = new Set(list.map(a => a.id));
        let removed = false;
        for (const id of agents.current.keys()) if (!present.has(id)) {
          agents.current.delete(id); bubbles.current.delete(id); dialogue.delete(id);
          if (hoverRef.current === id) hoverRef.current = null;
          const f = figs.current.get(id);
          if (f && !f.boarding) { releaseSeat(f); f.g.destroy({children:true}); figs.current.delete(id); }
          removed = true;
        }
        for (const a of list) ensure(a);
        setPlaceInfo(info=>info?{...info,people:list.filter(a=>a.location===info.id).map(a=>({id:a.id,name:a.name,asleep:a.asleep,job:a.job,appearance:a.appearance,age:a.age,carrying:a.carrying,pose:a.pose}))}:info);
        if (removed) setFeed(feed => [...feed]);
      };
      poll = setInterval(() => { void fetch(`${apiUrl}/api/agents`, { cache: "no-store" }).then((r) => r.json()).then((list: PublicAgent[]) => syncPopulation(list)).catch(() => {}); void refreshPlaces(); }, 30000);
      ws = new WebSocket(apiUrl.replace(/^http/, "ws") + "/stream");
      ws.onmessage = (m) => {
        const msg = JSON.parse(m.data as string) as { type: string; agents?: PublicAgent[]; recent?: TownEvent[]; event?: TownEvent; clock?: Clock };
        if (msg.type === "hello") { if(msg.agents)syncPopulation(msg.agents); setFeed((msg.recent ?? []).filter((e) => e.importance >= 0.1 && e.kind !== "agent.move").slice(-12).reverse()); if (msg.clock) { setClock(msg.clock); clockRef.current = msg.clock; } setReady(true); }
        if (msg.type === "clock" && msg.clock) { setClock(msg.clock); clockRef.current = msg.clock; }
        if (msg.type === "event" && msg.event) {
          const e = msg.event;
          const eventActor=agents.current.get(e.actors[0]!);
          if (eventActor && (e.kind === "agent.fishing" || e.kind === "agent.activity")) {
            const activity = (e.payload as {activity?: PublicAgent["activity"]} | undefined)?.activity;
            ensure({...eventActor, activity: activity ?? null, pose: activity?.kind === "work" ? "work" : "idle"});
          }
          if (eventActor && e.kind === "agent.fishing-ended") {
            const caught = (e.payload as {caught?: number} | undefined)?.caught;
            ensure({...eventActor, activity: null, pose: "idle", ...(caught ? {carrying: "fish"} : {})});
          }
          if(eventActor && e.kind==="agent.sleep"){eventActor.asleep=true;eventActor.pose="sleep";}
          if(eventActor && e.kind==="agent.wake"){eventActor.asleep=false;eventActor.pose="idle";}
          if(["agent.move","agent.sleep","agent.wake","agent.work"].includes(e.kind)) setPlaceInfo(info=>{
            if(!info)return info;
            const list=[...agents.current.values()].map(a=>a.id!==e.actors[0]?a:{...a,...(e.kind==="agent.move"&&e.place?{location:e.place}:{}),...(e.kind==="agent.sleep"?{asleep:true,pose:"sleep" as const}:{}),...(e.kind==="agent.wake"?{asleep:false,pose:"idle" as const}:{})});
            return {...info,people:list.filter(a=>a.location===info.id).map(a=>({id:a.id,name:a.name,asleep:a.asleep,job:a.job,appearance:a.appearance,age:a.age,carrying:a.carrying,pose:a.pose}))};
          });
          if ((e.kind === "town.gathering" || e.kind === "town.fire") && e.place) { const pl = places.get(e.place); const pay = (e.payload ?? {}) as { kind?: string; crowd?: string[]; held?: boolean; stage?: string }; if (pl && pay.held !== false) { const kind = e.kind === "town.fire" ? "fire" : (pay.kind ?? "feast"); staged.current = { kind, place: e.place, x: pl.x, y: pl.y, actors: e.actors, until: Date.now() + (kind === "fire" ? 180000 : 150000) }; const crowd = (pay.crowd ?? []).map((id) => figs.current.get(id)).filter((f): f is Fig => !!f && f.place === e.place); const leads = e.actors.map((id) => figs.current.get(id)).filter((f): f is Fig => !!f && f.place === e.place && !f.asleep); const g = gather(pl); const cxp = g.x + g.w / 2, cyp = g.y + 10; leads.forEach((f, i) => { releaseSeat(f); f.tx = cxp - 14 + i * 28; f.ty = cyp; f.facing = i === 0 ? 1 : -1; }); const others = crowd.filter((f) => !leads.includes(f)); others.forEach((f, i) => { const n = Math.max(1, others.length); const ang = Math.PI * 0.15 + (Math.PI * 0.7 * i) / n; const r = 70 + (i % 2) * 22; releaseSeat(f); f.tx = cxp + Math.cos(ang) * r * 1.6; f.ty = cyp + 30 + Math.sin(ang) * r * 0.5; }); if (kind === "wedding" || kind === "funeral") ambienceRef.current?.toll(kind === "wedding" ? 6 : 3); } }
          if (e.importance >= 0.45 && e.kind !== "agent.move" && e.kind !== "agent.reflect") { const f = e.actors[0] ? figs.current.get(e.actors[0]) : null; const p = e.place ? places.get(e.place) : null; const x = f?.x ?? p?.x, y = f?.y ?? p?.y; if (x !== undefined && y !== undefined) cinema.current = { x, y: y - 40, ids: e.actors, at: Date.now(), text: e.text }; }
          if (e.kind === "agent.move" && eventActor) eventActor.activity = null;
          if (e.kind === "agent.move" && e.place) moveTo(e.actors[0]!, e.place);
          if (e.kind === "agent.sleep") { const f = figs.current.get(e.actors[0]!); if (f) { f.asleep = true; f.pose = "sleep"; } }
          if (e.kind === "agent.wake") { const f = figs.current.get(e.actors[0]!); if (f) { f.asleep = false; f.pose = "idle"; } }
          if (e.kind === "agent.work" && /worked on|mornings done/.test(e.text)) { const f = figs.current.get(e.actors[0]!); if (f) f.pose = "work"; }
          // whoever leaves walks to the boat and rides away on it; the deck carries them until the boat is out of sight
          if (e.kind === "agent.leave") { const f = figs.current.get(e.actors[0]!); if (f) { f.boarding = true; releaseSeat(f); f.asleep = false; f.tx = boat.position.x + 12; f.ty = boat.position.y - 2; } }
          if (e.kind === "knowledge.shared") {
            bubbles.current.set(e.actors[0]!, { text: e.text.split(": ").slice(1).join(": ") || e.text, until: Date.now() + 9000 });
            for (const id of e.actors) { const f = figs.current.get(id); if (f) f.moment = { pose: "greet", until: Date.now() + 1800 }; }
          }
          if (e.kind === "garden.harvest" || e.kind === "place.decorated") { const f = figs.current.get(e.actors[0]!); if (f) f.moment = { pose: "work", until: Date.now() + 8000 }; }
          if (e.kind.startsWith("project.") || e.kind === "garden.harvest" || e.kind === "place.decorated") void refreshPlaces();
          if (e.kind === "agent.give" && e.actors.length===2) {
            const pair=e.actors.map(id=>figs.current.get(id));const [a,b]=pair;
            if(a&&b&&a.place===b.place&&!a.asleep&&!b.asleep){
              dialogue.set(a.id,{peers:[b.id],until:Date.now()+4000});dialogue.set(b.id,{peers:[a.id],until:Date.now()+4000});
              for(const f of [a,b])f.moment={pose:"greet",until:Date.now()+2400};
            }
          }
          if (e.kind === "agent.eat") {const f=figs.current.get(e.actors[0]!);if(f)f.moment={pose:"eat",until:Date.now()+6000};}
          if (e.kind === "agent.say") { const q = /“([^”]+)”/.exec(e.text)?.[1]; if (q) bubbles.current.set(e.actors[0]!, { text: q, until: Date.now() + 7000 }); }
          if (e.kind === "conversation") { const lines = (e.payload?.lines as { speaker: string; text: string }[] | undefined) ?? []; const until = Date.now() + Math.max(5500, (lines.length - 1) * 2600 + 5500);
            for (const id of e.actors) dialogue.set(id, { peers: e.actors.filter(peer => peer !== id), until });
            lines.forEach((l, i) => { const timer = setTimeout(() => { speechTimers.delete(timer); if (alive) bubbles.current.set(l.speaker, { text: l.text, until: Date.now() + 5500 }); }, i * 2600); speechTimers.add(timer); }); for (const id of e.actors) { const f = figs.current.get(id); if (f) f.moment = { pose: "greet", until: Date.now() + 1800, mood: { joy: 0.6 } }; } }
          // the moments the record names: a letter written home, a meal or a drink bought at the inn or the tavern, a charge argued before the council, a fire
          if (e.kind === "agent.letter") { const f = figs.current.get(e.actors[0]!); if (f) f.moment = { pose: "write", until: Date.now() + 12000 }; }
          if (e.kind === "cart.leg") { const pay = (e.payload ?? {}) as { from?: string; to?: string; item?: string; qty?: number; route?: string[] }; if (pay.from && pay.to && pay.item) carter.queue.push({ from: pay.from, to: pay.to, item: pay.item, qty: pay.qty ?? 0, route: pay.route ?? [] }); }
          if (e.kind === "economy.price") void refreshPlaces();
          if (e.kind === "agent.trade" && /bought (soup|bread|fish|apples|drink|wine|beer)/.test(e.text)) { const f = figs.current.get(e.actors[0]!); if (f && (f.place === "inn" || f.place === "tavern")) f.moment = { pose: /drink|wine|beer/.test(e.text) ? "drink" : "eat", until: Date.now() + 10000 }; }
          if (e.kind === "town.verdict") for (const id of e.actors) { const f = figs.current.get(id); if (f) f.moment = { pose: "argue", until: Date.now() + 8000, mood: { anger: 0.8 } }; }
          if (e.kind === "town.fire" && e.place) for (const f of figs.current.values()) if (f.place === e.place || places.get(f.place)?.district === places.get(e.place)?.district) f.moment = { pose: "idle", until: Date.now() + 5000, mood: { surprise: 1 } };
          if (e.kind === "agent.fired") { const f = figs.current.get(e.actors[0]!); if (f) f.moment = { pose: "idle", until: Date.now() + 6000, mood: { anger: 0.5 } }; }
          if (e.kind === "boat.dock") { if (/docked/.test(e.text)) { boat.position.x = awayX; boatTarget = dockX; ambience.horn(); } }
          if (e.kind === "boat.depart") boatTarget = awayX;
          if ((e.kind.startsWith("item.") || ["agent.trade", "agent.give", "agent.take", "agent.eat"].includes(e.kind)) && e.actors[0]) void fetch(`${apiUrl}/api/agents/${e.actors[0]}`, {cache: "no-store"}).then(r => r.ok ? r.json() : null).then((a: PublicAgent | null) => { if (alive && a?.id) ensure(a); }).catch(() => {});
          if (e.kind === "agent.arrive") { void fetch(`${apiUrl}/api/agents/${e.actors[0]}`).then((r) => r.json()).then((a: PublicAgent) => { if (a?.id) { const f = ensure(a); f.x = boat.position.x + 40; f.y = boat.position.y - 10; f.g.position.set(f.x, f.y); } }); }
          if (e.kind.startsWith("item.") || e.kind === "town.recipe" || e.kind === "agent.trade" || e.kind === "agent.make" || e.kind === "place.decorated" || e.kind === "garden.harvest" || e.kind === "agent.build" || e.kind === "town.built" || (e.kind === "agent.work" && /mornings done/.test(e.text))) void refreshPlaces();
          if (e.importance >= 0.1 && e.kind !== "agent.move") setFeed((f) => [e, ...f].slice(0, 12));
        }
      };

      // Time runs in steps of a 60 Hz frame whatever the screen's refresh: `tick` counts whole steps for the per-step simulations
      // (critters, embers, the cart) and the redraw cadences; `ft` is the same clock unbroken, for anything drawn as a function of time.
      let tick = 0; let ft = 0; let stepAcc = 0; let firstFrame = true;
      // a filmed pan to a selected person or a picked event, eased both ends; the hand takes over once it lands
      let glide: { fromX: number; fromY: number; toX: number; toY: number; start: number; dur: number } | null = null;
      let lastSel: string | null = null; let lastSpotAt = 0; let lastCaptionKey = "";
      // a hand on the camera in the street view: drag to look around, wheel to zoom, a little inertia after letting go
      const canvas = app.canvas; let press: { x: number; y: number; cx: number; cy: number; moved: boolean } | null = null; let lastMove = { x: 0, y: 0, t: 0 };
      const handOn = () => { const c = camera.current; if (!c.hand) { const Wd = app!.screen.width, Hd = app!.screen.height; c.hand = { x: (Wd / 2 - c.x) / c.zoom, y: (Hd / 2 - c.y) / c.zoom, zoom: c.zoom, vx: 0, vy: 0 }; c.follow = null; } return c.hand; };
      const fitZoom = () => Math.min(app!.screen.width / (W * 1.12), Math.max(180,app!.screen.height - (observer ? 150 : 0)) / (H * 1.12));
      if (observer && !parked && !focusRef.current) camera.current.hand = {x:W/2,y:H/2+(observer ? 65/fitZoom() : 0),zoom:fitZoom(),vx:0,vy:0};
      navigateMini.current = (x,y) => { parked=null;viewRef.current="street";viewChange.current?.("street");camera.current.follow=null;camera.current.hand={x,y,zoom:Math.max(.7,camera.current.zoom),vx:0,vy:0}; };
      cameraControl.current = action => {
        parked=null;
        if (action === "reset") { camera.current.hand = {x:W/2,y:H/2+(observer ? 65/fitZoom() : 0),zoom:fitZoom(),vx:0,vy:0}; camera.current.follow=null;viewRef.current="street";viewChange.current?.("street");return; }
        if(viewRef.current !== "street") {viewRef.current="street";viewChange.current?.("street");}
        const hand = handOn(); hand.vx = 0; hand.vy = 0;
        hand.zoom = Math.min(1.9, Math.max(Math.min(.2,fitZoom()), hand.zoom * (action === "in" ? 1.2 : 1 / 1.2)));
      };
      // fly the free camera to a world point, easing from wherever it is now; the street view is where this can be seen
      const startGlide = (x: number, y: number) => {
        if (viewRef.current !== "street") { viewRef.current = "street"; viewChange.current?.("street"); }
        const h = handOn(); h.vx = 0; h.vy = 0;
        glide = { fromX: h.x, fromY: h.y, toX: x, toY: y, start: performance.now(), dur: quietMotion.matches ? 1 : 900 }; // with reduced motion the camera cuts instead of flying
      };
      canvas.addEventListener("pointerdown", (e) => { if (viewRef.current !== "street") return; press = { x: e.clientX, y: e.clientY, cx: e.clientX, cy: e.clientY, moved: false }; lastMove = { x: e.clientX, y: e.clientY, t: performance.now() }; });
      canvas.addEventListener("pointermove", (e) => { if (!press) return; const dx = e.clientX - press.cx, dy = e.clientY - press.cy; if (!press.moved && Math.hypot(e.clientX - press.x, e.clientY - press.y) < 6) return; press.moved = true; suppressSelectUntil = performance.now() + 250; const h = handOn(); h.x -= dx / camera.current.zoom; h.y -= dy / camera.current.zoom; const now = performance.now(); const dt = Math.max(8, now - lastMove.t); h.vx = Math.max(-30, Math.min(30, -(e.clientX - lastMove.x) / dt * 16 / camera.current.zoom)); h.vy = Math.max(-30, Math.min(30, -(e.clientY - lastMove.y) / dt * 16 / camera.current.zoom)); lastMove = { x: e.clientX, y: e.clientY, t: now }; press.cx = e.clientX; press.cy = e.clientY; });
      const release = () => { if (press?.moved) suppressSelectUntil = performance.now() + 250; if (press?.moved && camera.current.hand && performance.now() - lastMove.t > 80) { camera.current.hand.vx = 0; camera.current.hand.vy = 0; } press = null; };
      canvas.addEventListener("pointerup", release); canvas.addEventListener("pointercancel", release); canvas.addEventListener("pointerleave", release);
      canvas.addEventListener("wheel", (e) => { if (viewRef.current !== "street") return; e.preventDefault(); const h = handOn(); const before = h.zoom; h.zoom = Math.min(1.9, Math.max(Math.min(.2,fitZoom()), h.zoom * Math.exp(-e.deltaY * 0.0012))); const r = canvas.getBoundingClientRect(); const mx = e.clientX - r.left - app!.screen.width / 2, my = e.clientY - r.top - app!.screen.height / 2; h.x += mx / before - mx / h.zoom; h.y += my / before - my / h.zoom; }, { passive: false });
      let lastCut = ""; let cutAt = 0;
      // where the frame goes, for tuning: window.__ftperf holds milliseconds per section since load
      const perf: Record<string, number> = {}; let perfT = 0; let perfSection = "start"; (window as unknown as { __ftperf: Record<string, number>; __ftworld: Container; __ftscene: Container }).__ftperf = perf; (window as unknown as { __ftworld: Container }).__ftworld = world; (window as unknown as { __ftscene: Container }).__ftscene = scene;
      const perfMark = (next: string) => { const now = performance.now(); perf[perfSection] = (perf[perfSection] ?? 0) + (now - perfT); perfT = now; perfSection = next; };
      world.addChild(coastalLife.glow);
      app.ticker.add(() => {
        if (!app) return; if(!quietMotion.matches)detailSeconds+=Math.min(app.ticker.deltaMS,50)/1000;
        const dtf = Math.min(app.ticker.deltaMS, 100) / (1000 / 60); // this frame, in 60 Hz frames: 0.5 on a 120 Hz screen, 2 on a 30 Hz one
        stepAcc += dtf; const steps = Math.min(4, Math.floor(stepAcc)); stepAcc -= Math.floor(stepAcc);
        const prevTick = tick; tick += steps; ft += dtf; const still = quietMotion.matches;
        const first = firstFrame; firstFrame = false;
        /** true once each time the step clock crosses a multiple of n, so a cadence keeps its rate at any refresh */
        const every = (n: number) => first || Math.floor(tick / n) !== Math.floor(prevTick / n);
        /** a per-frame ease of k at 60 Hz, made the same per second at any refresh */
        const ease = (k: number) => 1 - Math.pow(1 - k, dtf);
        perfT = performance.now(); perfSection = "camera"; perf.frames = (perf.frames ?? 0) + 1;
        const Wd = app.screen.width, Hd = app.screen.height; const cam = camera.current;
        // a person was selected, or an event was picked from the journal: fly there, and pulse the actors
        {
          const selNow = selRef.current;
          if (selNow !== lastSel) { lastSel = selNow; const f = selNow ? figs.current.get(selNow) : null; if (f && !cam.follow) startGlide(f.x, f.y - 20); }
          const sp = spotRef.current;
          if (sp && sp.at !== lastSpotAt) {
            lastSpotAt = sp.at;
            const ids = sp.actors ?? [];
            const tf = ids.map((id) => figs.current.get(id)).find((x): x is Fig => !!x);
            const tp = sp.place ? places.get(sp.place) : null;
            if (tf) startGlide(tf.x, tf.y - 20); else if (tp) startGlide(tp.x, tp.y - 20);
            const until = Date.now() + 4200; for (const id of ids) pulses.set(id, until);
          }
        }
        const hand = viewRef.current === "street" ? cam.hand : null;
        if (viewRef.current !== "street" && cam.hand) cam.hand = null;
        if (glide && hand && !press) { const t = Math.min(1, (performance.now() - glide.start) / glide.dur); const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; hand.x = glide.fromX + (glide.toX - glide.fromX) * e; hand.y = glide.fromY + (glide.toY - glide.fromY) * e; if (t >= 1) glide = null; } else if (glide && press) glide = null;
        const followed = viewRef.current === "street" && cam.follow ? figs.current.get(cam.follow) : null;
        const talking = followed ? followed.pose === "talk" : false;
        // the cinema breathes: the zoom swells and settles over half a minute; a followed conversation draws the camera in a step
        const zoom = viewRef.current === "map" ? fitZoom() : viewRef.current === "cinema" ? 1.22 + (still ? 0 : Math.sin(ft / 1400) * 0.06) : hand ? hand.zoom : talking ? 1.16 : 1.05; // the map leaves sea around the island, so the horizon shows
        const zoomAim = parked && !hand && !focusRef.current && viewRef.current === "street" && Number.isFinite(zoomParam) ? (Number.isFinite(zoomToParam) ? zoomParam + (zoomToParam - zoomParam) * moveP() : zoomParam) : zoom; cam.zoom += (zoomAim - cam.zoom) * ease(hand ? 0.16 : parked ? 0.5 : 0.05);
        let fx = W / 2, fy = H / 2 + (observer && viewRef.current === "map" ? 65/zoom : 40);
        if (hand) { hand.vx = Math.max(-22, Math.min(22, hand.vx)); hand.vy = Math.max(-22, Math.min(22, hand.vy)); hand.x = Math.max(-200, Math.min(W + 200, hand.x + (press ? 0 : coast(hand.vx, app.ticker.deltaTime).distance))); hand.y = Math.max(-150, Math.min(H + 150, hand.y + (press ? 0 : coast(hand.vy, app.ticker.deltaTime).distance))); if (!press) { hand.vx = coast(hand.vx, app.ticker.deltaTime).velocity; hand.vy = coast(hand.vy, app.ticker.deltaTime).velocity; } fx = hand.x; fy = hand.y; } // the hand stays over the island and never flings it
        else if (viewRef.current === "street") { if (followed) { const lead = Math.max(-70, Math.min(70, (followed.tx - followed.x) * 0.7)); fx = followed.x + lead; fy = followed.y - 60; } else { const mk = places.get("market"); if (mk) { fx = mk.x; fy = mk.y; } } }
        // the camera follows the day: the latest moment that mattered, or the busiest place when nothing has happened for a while
        const stagedNow = staged.current && Date.now() < staged.current.until ? staged.current : null;
        if (viewRef.current === "cinema" && stagedNow) { fx = stagedNow.x; fy = stagedNow.y + 20; }
        else if (viewRef.current === "cinema") { const cn = cinema.current; if (cn && Date.now() - cn.at < 120000) { const f = cn.ids[0] ? figs.current.get(cn.ids[0]) : null; fx = f?.x ?? cn.x; fy = (f?.y ?? cn.y) - 50; } else { let best: PlaceView | null = null; for (const p of places.values()) if (!best || p.crowd > best.crowd) best = p; if (best) { fx = best.x; fy = best.y - 20; } } }
        if (viewRef.current === "cinema") { const key = stagedNow ? `s:${stagedNow.place}` : cinema.current ? `c:${cinema.current.at}` : "idle"; if (key !== lastCut) { lastCut = key; cutAt = tick; } if (!still) { fx += Math.sin(ft / 900) * 36; fy += Math.cos(ft / 1100) * 18; } } // a slow drift while the moment plays
        // the lower third: who is on screen and what the record says is happening, while the cinema plays
        if (viewRef.current === "cinema" && every(12)) {
          let capText: string | null = null, capIds: string[] = [];
          if (stagedNow) { capText = stagedNow.kind === "fire" ? "A fire on the island" : `The town gathers · ${stagedNow.kind}`; capIds = stagedNow.actors; }
          else if (cinema.current && Date.now() - cinema.current.at < 120000 && cinema.current.text) { capText = cinema.current.text; capIds = cinema.current.ids; }
          const who = capIds.map((id) => agents.current.get(id)?.name.split(" ")[0]).filter(Boolean).join(", ");
          const key = capText ?? "";
          if (key !== lastCaptionKey) { lastCaptionKey = key; setCaption(capText ? { text: capText, who } : null); }
        }
        if (parked && !hand && !focusRef.current && viewRef.current === "street") { const k = moveTo_ ? moveP() : 0; fx = parked.x + (moveTo_ ? (moveTo_.x - parked.x) * k : 0); fy = parked.y + (moveTo_ ? (moveTo_.y - parked.y) * k : 0); }
        if (observer && focusRef.current && followed && !hand && viewRef.current === "street") fy += Math.min(160, Hd * .25) / cam.zoom;
        const tx = Wd / 2 - fx * cam.zoom, ty = Hd / 2 - fy * cam.zoom;
        const cutting = viewRef.current === "cinema" && tick - cutAt < 90; // a new moment is a cut, not a crawl
        const camEase = hand ? 1 : ease(viewRef.current === "cinema" ? (cutting ? 0.09 : 0.02) : 0.08); cam.x += (tx - cam.x) * camEase; cam.y += (ty - cam.y) * camEase;
        world.scale.set(cam.zoom); world.position.set(cam.x, cam.y); shadowBlur.strength = 2.4 * cam.zoom; lightArea.x = -cam.x / cam.zoom; lightArea.y = -cam.y / cam.zoom; lightArea.width = Wd / cam.zoom; lightArea.height = Hd / cam.zoom; // the screen, in world space, for the light filters
        // parallax: what is far moves less than the island, what is near moves more, measured from where the camera looks
        const cwx = (Wd / 2 - cam.x) / cam.zoom, cwy = (Hd / 2 - cam.y) / cam.zoom;
        const par = (f: number) => [(cwx - cx) * (1 - f), (cwy - cy) * (1 - f)] as const;
        { const [sx, sy] = par(0.92); sea.position.set(sx, sy); ripples.position.set(sx, sy); const [hx, hy] = par(0.8); horizon.position.set(hx, hy); const [ex, ey] = par(0.7); celestial.position.set(ex, ey); const [gx, gy] = par(1.1); gulls.position.set(gx, gy); const [kx, ky] = par(1.03); smoke.position.set(kx, ky); const [ox, oy] = par(1.06); fog.position.set(ox, oy); weatherFx.fog.position.set(ox, oy); const [rx, ry] = par(1.04); weatherFx.rain.position.set(rx, ry); weatherFx.snow.position.set(rx, ry); const [px, py] = par(1.2); clouds.puffs.position.set(px, py); }
        // sea
        perfMark("sea");
        if (every(6) && (!still || first)) { ripples.clear(); for (let i = 0; i < 48; i++) { const yy = ((i * 97 + tick * 0.4) % (H + 600)) - 300; const xx = ((i * 331) % (W + 800)) - 400 + Math.sin(tick / 90 + i) * 12; ripples.moveTo(xx, yy).lineTo(xx + 60 + (i % 3) * 20, yy).stroke({ width: 3, color: C.waterDeep, cap: "round" }); } }
        // weather: what falls, what lingers, what blows
        perfMark("weather");
        const c = clockRef.current; const weather = forcedWeather ?? c?.weather ?? "clear"; const winter = (forcedSeason ?? c?.season) === "winter";
        const wet = weather === "rain" || weather === "storm" || weather === "snow"; const snowing = weather === "snow" || (wet && winter);
        const wind = weather === "storm" ? 1 : weather === "wind" ? 0.8 : weather === "rain" ? 0.45 : weather === "fog" ? 0.1 : 0.2;
        // the sea itself: the foam breathes, the water darkens and breaks white in a blow, rain rings the surface
        const rough = weather === "storm" ? 1 : weather === "wind" ? 0.5 : 0;
        if (every(3)) { drawFoam(tick, rough); drawTide(tick); }
        sea.tint = weather === "storm" ? 0x8fa9a6 : weather === "rain" || weather === "fog" ? 0xb9cfcb : 0xffffff;
        if (every(3)) {
          seaLife.clear();
          if (rough > 0) for (let i = 0; i < 70 * rough; i++) { const xx = ((i * 811 + tick * 3) % (W + 1400)) - 700, yy = ((i * 1237) % (H + 1000)) - 500; if (inside(xx, yy) < 1.12) continue; const ph = Math.sin(tick / 12 + i); if (ph < 0.2) continue; seaLife.moveTo(xx, yy).lineTo(xx + 14 + ph * 10, yy - 2).stroke({ width: 2.2, color: C.foam, alpha: 0.5 + ph * 0.4, cap: "round" }); }
          if (weather === "rain" || weather === "storm") for (let i = 0; i < 60; i++) { const xx = ((i * 947 + Math.floor(tick / 9) * 131) % (W + 1400)) - 700, yy = ((i * 1543 + Math.floor(tick / 9) * 71) % (H + 1000)) - 500; if (inside(xx, yy) < 1.1) continue; const age = ((tick + i * 7) % 9) / 9; seaLife.ellipse(xx, yy, 3 + age * 14, 1.5 + age * 6).stroke({ width: 1, color: C.foam, alpha: 0.5 * (1 - age) }); }
        }
        // boat: it crosses at a boat's pace, bobs, and leaves a wake; the rowboats bob beside the quay
        const sailing = Math.abs(boatTarget - boat.position.x) > 2;
        if (sailing) boat.position.x += Math.sign(boatTarget - boat.position.x) * Math.min(Math.abs(boatTarget - boat.position.x), 2.2 * dtf);
        boat.position.y = harbor.y + 20 + (still ? 0 : Math.sin(ft / 40) * 1.5); boat.rotation = still ? 0 : Math.sin(ft / 55) * 0.012;
        if (every(2)) { wake.clear(); if (sailing) { const dir = Math.sign(boatTarget - boat.position.x); for (let i = 1; i <= 7; i++) { const x = boat.position.x - dir * (70 + i * 26), y = boat.position.y + 6 + Math.sin(tick / 9 + i) * 2; wake.moveTo(x, y - i * 1.5).lineTo(x - dir * 18, y - i * 1.5).moveTo(x, y + i * 1.5).lineTo(x - dir * 18, y + i * 1.5).stroke({ width: 2, color: C.foam, alpha: Math.max(0, 0.7 - i * 0.09), cap: "round" }); } } }
        // out of sight, the passengers are gone
        if (aboard.length && Math.abs(boat.position.x - awayX) < 4) { for (const g of aboard) g.destroy({ children: true }); aboard.length = 0; }
        for (let i = 0; i < boats.length; i++) { const bt = boats[i]!; const breeze=harborBreeze(detailSeconds,bt.x,bt.userData,wind);bt.position.y=bt.userData+Math.sin(detailSeconds*1.35+i*2)*(quietMotion.matches?0:.7+breeze*1.2);bt.rotation=quietMotion.matches?0:Math.sin(detailSeconds*.9+i)*(.007+breeze*.018); }
        updateMoorings();
        // the mill turns while it is worked; the chapel bell swings at ten on Sunday; the washing sways in the wind
        const workingPlaces = new Set([...agents.current.values()].filter(a => !a.asleep && a.activity?.kind === "work" && a.activity.place === a.location && a.activity.until > (c?.t ?? 0)).map(a => a.location));
        const millOn = workingPlaces.has("mill");
        millSpeed += ((millOn ? 0.012 : 0) - millSpeed) * ease(0.01); for (const sl of sails) sl.rotation += millSpeed * dtf;
        const bellOn = c?.weekday === "Sunday" && c.hour === 10 && c.minute % 60 < 3; for (const bl of bells) bl.rotation = bellOn ? Math.sin(ft / 4) * 0.5 : bl.rotation * Math.pow(0.95, dtf);
        for (const cl of cloths) {const parent=cl.parent;const breeze=harborBreeze(detailSeconds,parent?.x??0,parent?.y??0,wind);cl.skew.x=quietMotion.matches?0:Math.sin(detailSeconds*2.1)*.075*breeze+Math.sin(detailSeconds*5)*.02*breeze;}
        // gulls over the quay by day, a few, wheeling
        if (every(2)) { gulls.clear(); if (!still && !(c && (c.hour < 6 || c.hour >= 20)) && weather !== "storm") for (let i = 0; i < 5; i++) { const t = tick / 60 + i * 1.3; const gx = harbor.x - 120 + Math.cos(t * 0.7 + i) * (160 + i * 30), gy = harbor.y - 260 - i * 28 + Math.sin(t * 1.1) * 40; const flap = Math.sin(tick / 5 + i) * 4; gulls.moveTo(gx - 9, gy + flap).quadraticCurveTo(gx - 4, gy - 4, gx, gy).quadraticCurveTo(gx + 4, gy - 4, gx + 9, gy + flap).stroke({ width: 1.6, color: C.kelp, alpha: 0.7, cap: "round" }); } }
        if (every(2)) {
          rain.clear();
          if (wet) {
            const n = Math.round((weather === "storm" ? 420 : 200) * (still ? 0.35 : 1));
            for (let i = 0; i < n; i++) {
              const xx = ((i * 137 + tick * (snowing ? 2 : 9)) % (W + 400)) - 200 + Math.sin(tick / 40 + i) * wind * 6; const yy = ((i * 251 + tick * (snowing ? 4 : 16)) % (H + 200)) - 100;
              if (snowing) rain.circle(xx, yy, 2.2).fill({ color: 0xffffff, alpha: 0.8 }); else rain.moveTo(xx, yy).lineTo(xx - 3 - wind * 6, yy + 14).stroke({ width: 1.5, color: C.teal, alpha: 0.35 });
            }
            // splashes on the ground
            if (!snowing) for (let i = 0; i < 40; i++) { const xx = ((i * 419 + tick * 23) % W); const yy = ((i * 733 + tick * 31) % H); rain.circle(xx, yy, 2 + (tick + i) % 3).stroke({ width: 1, color: C.shell, alpha: 0.5 }); }
          }
        }
        wetness += ((wet && !snowing ? 1 : 0) - wetness) * ease(wet ? 0.002 : 0.0006);
        snowiness += ((snowing ? 1 : 0) - snowiness) * ease(snowing ? 0.0015 : winter ? 0.0002 : 0.001);
        harborSurface.update(wetness,detailSeconds);
        wetGround.alpha = 0.12 * wetness; snowGround.alpha = 0.6 * snowiness;
        worldLight.roofCoat = classic ? 0 : Math.max(0.82 * snowiness, 0.14 * wetness); // snow on every roof, or the sheen of rain, cut to the roof's own shape
        // snow settles on every roof and crown; rain leaves the roofs shining; footprints cross the snow and fill in
        if (every(15)) {
          caps.clear();
          // the classic drawings carry no roof masks: their snow and sheen are ellipses where their roofs roughly are
          if (classic && snowiness > 0.05) for (const p of places.values()) { if (p.kind === "plot" || p.kind === "wild" || p.kind === "public") continue; caps.ellipse(p.x + 8, p.y - 64, 54, 15).fill({ color: 0xffffff, alpha: 0.8 * snowiness }); caps.ellipse(p.x - 30, p.y - 50, 26, 9).fill({ color: 0xffffff, alpha: 0.6 * snowiness }); }
          if (classic && wetness > 0.05) for (const p of places.values()) { if (p.kind === "plot" || p.kind === "wild" || p.kind === "public") continue; caps.ellipse(p.x + 12, p.y - 66, 40, 9).fill({ color: 0xffffff, alpha: 0.16 * wetness }); }
          for (const cap of snowCaps) cap.alpha = 0.8 * snowiness;
          prints_.clear(); for (const pr of prints) { const ageT = (tick - pr.at) / 900; if (ageT > 1) continue; prints_.ellipse(pr.x, pr.y, 3, 1.6).fill({ color: C.kelp, alpha: 0.18 * (1 - ageT) * snowiness }); }
        }
        if (every(60) && c && setSeason(forcedSeason ?? c.season)) { plantTrees(); }
        if (every(120)) { wear.redraw(); redrawTrails(); }
        if (every(60)) ground.tint = SEASON_CAST[forcedSeason ?? c?.season ?? "summer"] ?? 0xffffff;
        // the short season: the fields turn to lavender
        if (every(60)) { const bloom = !!c?.inSeason?.includes("lavender"); if (bloom !== lavender.visible) { lavender.visible = bloom; } }
        if (every(15)) { puddles.clear(); if (wetness > 0.02) for (let i = 0; i < 26; i++) { const xx = ((i * 587) % (W - 400)) + 200, yy = ((i * 911) % (H - 400)) + 200; puddles.ellipse(xx, yy, 26 + (i % 4) * 8, 9 + (i % 3) * 3).fill({ color: C.waterDeep, alpha: 0.55 * wetness }); } }
        for (let i = 0; i < trees.length; i++) { const tr = trees[i]!; const breeze=harborBreeze(detailSeconds,tr.x,tr.y,wind);tr.skew.x=quietMotion.matches?0:Math.sin(detailSeconds*1.5+i*.35)*.023*breeze+Math.sin(detailSeconds*3.4+i)*.006*breeze; }
        if (every(3)) { fog.clear(); if (weather === "fog") for (let i = 0; i < 18; i++) { const xx = ((i * 431 + tick * 0.6) % (W + 800)) - 400, yy = ((i * 277) % (H + 200)) - 100; fog.ellipse(xx, yy, 340 + (i % 3) * 120, 110 + (i % 2) * 50).fill({ color: C.shell, alpha: 0.16 }); } }
        if (weather === "storm" && !still) { if (tick > nextBolt) { flash.alpha = 0.55; nextBolt = tick + 300 + Math.random() * 900; } flash.alpha *= Math.pow(0.82, dtf); } else flash.alpha = 0; // no lightning flashes for anyone who has asked for less motion
        // light: a warm dawn, a coral dusk, kelp at night
        perfMark("light");
        const hour = Number.isFinite(forcedHour) ? forcedHour : c ? c.hour + (c.minute % 60) / 60 : 12;
        // dawn and dusk follow the real sunrise and sunset when the island keeps our time
        const hm = (t?: string | null) => t ? Number(t.slice(0, 2)) + Number(t.slice(3, 5)) / 60 : null;
        const rise = hm(c?.sunrise) ?? 6.5, set = hm(c?.sunset) ?? 19.5;
        const nightAmt = (hour < rise - 1 ? 0.42 : hour < rise + 0.5 ? 0.42 * (rise + 0.5 - hour) / 1.5 : hour < set - 0.5 ? 0 : hour < set + 1 ? 0.42 * (hour - (set - 0.5)) / 1.5 : 0.42) + (weather === "storm" ? 0.12 : weather === "rain" ? 0.05 : 0);
        const duskAmt = Math.abs(hour - rise) < 1 ? 0.16 * (1 - Math.abs(hour - rise)) : Math.abs(hour - set) < 1 ? 0.2 * (1 - Math.abs(hour - set)) : 0;
        night.alpha += (nightAmt - night.alpha) * ease(0.05); dusk.alpha += (duskAmt - dusk.alpha) * ease(0.05); moonlit.alpha = 0.85 * Math.min(1, night.alpha / 0.42) * Math.max(0, 1 - flash.alpha * 1.4); worldLight.windowGlow = nightLook ? Math.min(1, night.alpha / 0.3) : 0;
        perfMark("life");
        for (let s = 0; s < steps; s++) cartTick();
        const mini = miniRef.current;
        if (model.visible !== mini) { model.visible = mini; horizon.visible = celestial.visible = !mini; app.renderer.background.color = mini ? TABLE : C.water; }
        sky.visible = !mini; // no stars or moon over a table
        post.update(viewRef.current, night.alpha / 0.42, effectsOn && !nofx.has("post"), tick, nofx.has("grade") ? NEUTRAL : gradeNow, mini);
        if (nofx.size) { ground.visible = !nofx.has("ground"); scene.visible = !nofx.has("scene"); lighting.dark.visible = !nofx.has("dark"); lighting.glow.visible = !nofx.has("glow"); clouds.puffs.visible = clouds.shadows.visible = !nofx.has("clouds"); weatherFx.rain.visible = weatherFx.snow.visible = weatherFx.fog.visible = !nofx.has("weather"); if (nofx.has("sky")) sunGrade.veil.visible = sunGrade.glow.visible = sunGrade.halo.visible = false; }
        { const smithy = places.get("smithy"); const dalSmithy = !classic && !!smithy && DALMATIAN_FOR[smithy.sprite]?.kind === "smithy"; const forced = new Set((q?.get("force") ?? "").split(",").filter(Boolean)); if (forced.has("hearths")) for (const id of Object.keys(HEARTHS)) litHearths.add(id); /* ?force=hearths,forge lights them for filming */ const cartMoving = Math.abs(carter.g.x - lastCart.x) > 0.3 || Math.abs(carter.g.y - lastCart.y) > 0.3; lastCart.x = carter.g.x; lastCart.y = carter.g.y;
          for (let s = 0; s < steps; s++) particles.update({ renderer: app.renderer, tick: prevTick + s + 1, wind, night: night.alpha / 0.42, hour, season: forcedSeason ?? c?.season ?? "summer", weather, effects: effectsOn && !nofx.has("particles"),
            hearths: [...litHearths].map((id) => { const p = places.get(id); const off = HEARTHS[id] ?? [0, 0]; return p ? { x: p.x + off[0], y: p.y + off[1] } : null; }).filter((h): h is { x: number; y: number } => !!h),
            forge: { x: smithy ? smithy.x + (dalSmithy ? forgeAt()[0] : -58) : 0, y: smithy ? smithy.y + (dalSmithy ? forgeAt()[1] : -2) : 0, on: !!smithy && (forced.has("forge") || (smithy.crowd > 0 && hour >= 7 && hour < 18)) },
            cart: { x: carter.g.x, y: carter.g.y, moving: cartMoving && carter.g.visible }, meadows: lifeMeadows }); }
        for(const [id,marks] of drawnMarks) marks.children.forEach((child,i)=>{child.visible=placePast.current?.place!==id || i<placePast.current.through;});
        const livingPeople = [...figs.current.values()].map(f => ({ id: f.id, x: f.x, y: f.y, moving: Math.hypot(f.tx-f.x, f.ty-f.y)>1.5 }));
        footfall.update(detailSeconds,livingPeople,wetness>.35,quietMotion.matches,inside);
        coastalLife.update(detailSeconds, night.alpha / 0.42, weather, [boat, ...boats].filter(b => b.visible), livingPeople, quietMotion.matches, coastalWonder(c?.day ?? 1,hour,forcedSeason ?? c?.season ?? "summer",weather));
        const lifeSounds: typeof life.sounds = [];
        for (let s = 0; s < steps; s++) { life.update({ tick: prevTick + s + 1, hour, rise, set, night: night.alpha / 0.42, season: forcedSeason ?? c?.season ?? "summer", weather, wind, people: livingPeople, effects: effectsOn }); lifeSounds.push(...life.sounds); }
        for (const snd of lifeSounds) ambience.cue(snd.name, Math.hypot(snd.x - cam.x, snd.y - cam.y), snd.x - cam.x, snd.level ?? 1);
        if (effectsRef.current !== effectsOn) { effectsOn = effectsRef.current; sea.filters = effectsOn && !nofx.has("water") ? [water] : null; shadows.filters = effectsOn && !nofx.has("softshadow") ? [shadowBlur] : null; ripples.visible = !effectsOn; lamps.visible = !effectsOn; night.visible = !effectsOn; dusk.visible = !effectsOn; rain.visible = !effectsOn; if (!effectsOn) { sunGrade.veil.visible = sunGrade.glow.visible = sunGrade.halo.visible = false; } fog.visible = !effectsOn; if (!effectsOn) { for (const face of ["front", "side", "roof"] as const) { worldLight.shade[face] = 0; worldLight.glow[face] = 0; } lighting.dark.visible = false; lighting.glow.visible = false; weatherFx.rain.visible = false; weatherFx.snow.visible = false; weatherFx.fog.visible = false; clouds.puffs.visible = false; clouds.shadows.visible = false; } }
        rays.clear();
        if (effectsOn) {
          const up = hour > rise && hour < set; let lx: number, ly: number, ls: number;
          if (up) { const f = (hour - rise) / Math.max(1, set - rise); const ang = Math.PI * (1 - f); lx = cx - Rx * 1.05 * Math.cos(ang); ly = cy - Ry * 1.05 - Ry * 0.16 * Math.abs(Math.sin(ang)) - 30; ls = 0.9; }
          else { lx = W - 220; ly = 90; ls = 0.55 * Math.max(0, (night.alpha - 0.1) / 0.32); }
          { const [ex, ey] = par(0.7); lx += ex; ly += ey; }
          // the low sun: golden either side of sunrise and sunset, blue for the half hour beyond them; cloud and rain take most of it away
          const cover = weather === "storm" ? 1 : weather === "rain" ? 0.85 : weather === "fog" ? 0.9 : weather === "snow" ? 0.8 : weather === "wind" ? 0.2 : 0;
          const nearRise = Math.abs(hour - rise), nearSet = Math.abs(hour - set); const phase: "rise" | "set" = nearRise < nearSet ? "rise" : "set";
          const golden = Math.max(0, 1 - Math.min(nearRise, nearSet) / 1.1);
          const blue = Math.max(0, 1 - Math.abs(hour - (phase === "rise" ? rise - 0.7 : set + 0.7)) / 0.7);
          { const f = Math.max(0, Math.min(1, (hour - rise) / Math.max(1, set - rise))); const ang = Math.PI * (1 - f); const sx = cx - Rx * 1.05 * Math.cos(ang), sy = cy - Ry * 1.05 - Ry * 0.16 * Math.abs(Math.sin(ang)) - 30; const [ex, ey] = par(0.7); sunGrade.update({ golden, blue, phase, sun: { x: sx + ex, y: sy + ey }, cover }); }
          // L2: the low sun throws soft shafts through the pinewood at dawn and dusk, from the horizon it stands on
          const pw = places.get("pinewood");
          if (pw && golden > 0.15 && (1 - cover) > 0.2 && night.alpha < 0.4) {
            const sunX = phase === "rise" ? cx + Rx * 1.05 : cx - Rx * 1.05, sunY = cy - Ry * 1.12;
            const dx = pw.x - sunX, dy = pw.y - sunY, dl = Math.hypot(dx, dy) || 1; const ux = dx / dl, uy = dy / dl, nx = -uy, ny = ux;
            const strength = golden * (1 - cover) * Math.max(0.3, 1 - night.alpha / 0.4);
            const warm = mix(0x6b5a34, phase === "rise" ? 0x6a5530 : 0x6e4e2c, 0.5); // dim warm; additive blend turns it to glowing gold over shade
            for (let i = -4; i <= 4; i++) {
              const off = i * 66 + Math.sin(tick / 220 + i * 1.3) * 12;
              const bx = pw.x + nx * off - ux * 220, by = pw.y - 150 + ny * off - uy * 220;
              const L = 460 + (i % 2) * 90, wid = 11 + Math.abs(Math.sin(tick / 260 + i * 1.7)) * 10;
              const rex = bx + ux * L, rey = by + uy * L;
              const a = strength * (0.32 + 0.28 * Math.max(0, Math.sin(tick / 150 + i * 2)));
              rays.moveTo(bx - nx * wid, by - ny * wid).lineTo(bx + nx * wid, by + ny * wid).lineTo(rex + nx * wid * 0.35, rey + ny * wid * 0.35).lineTo(rex - nx * wid * 0.35, rey - ny * wid * 0.35).closePath().fill({ color: warm, alpha: a });
            }
          }
          // the sun on the buildings: each wall and roof is shaded by how far it turns from the sun, and raked warm when a low sun faces it.
          // The sun rises in the east (screen right), stands in the south (toward us) at noon and sets in the west; walls face the lane (+v) or along it (+u).
          { const f = Math.max(0, Math.min(1, (hour - rise) / Math.max(1, set - rise))); const th = Math.PI * f; const el = up ? Math.sin(Math.PI * f) * 1.05 : 0;
            const hu = 0.707 * Math.cos(th) + 0.707 * Math.sin(th), hv = -0.707 * Math.cos(th) + 0.707 * Math.sin(th); // east turning to south turning to west
            const L = [hu * Math.cos(el), hv * Math.cos(el), Math.sin(el)] as const;
            const lit = { front: Math.max(0, L[1]), side: Math.max(0, L[0]), roof: Math.max(0, 0.6 * L[1] + 0.8 * L[2]) };
            const day = up && !nofx.has("facelight") ? Math.max(0, 1 - night.alpha / 0.42) : 0; const contrast = 0.38 * day * (1 - cover * 0.8); const rake = 0.55 * golden * (1 - cover) * day;
            for (const face of ["front", "side", "roof"] as const) { worldLight.shade[face] = contrast * Math.max(0, 0.55 - lit[face]) / 0.55; worldLight.glow[face] = rake * lit[face]; }
            worldLight.shadeTint = mix(0x5d6b8c, 0x6a5f86, golden); worldLight.glowTint = mix(0x66502a, phase === "rise" ? 0x63501f : 0x6a4620, 0.5);
            // by night the moon does the sun's work, coldly: the roofs catch it, the walls turned from it fall into shade
            const moon = nightLook && !nofx.has("facelight") ? Math.min(1, night.alpha / 0.42) * (1 - cover * 0.85) * (0.45 + 0.55 * (1 - Math.cos(moonPhase() * Math.PI * 2)) / 2) : 0;
            if (moon > 0.01) { worldLight.glow.roof = 0.42 * moon; worldLight.glow.front = 0.06 * moon; worldLight.glow.side = 0; worldLight.shade.side = 0.42 * moon; worldLight.shade.front = 0.12 * moon; worldLight.shade.roof = 0; worldLight.glowTint = 0x34466a; worldLight.shadeTint = 0x3b4775; } }
          gradeNow = gradeFor({ golden: golden * (1 - cover * 0.7), blue: blue * (1 - cover * 0.4), night: Math.min(1, night.alpha / 0.42), cover, weather });
          const shadeTint = mix(LIGHT.night, 0x1b2140, blue * (1 - cover));
          water.update({ time: (still ? ft * 0.3 : ft) / 60, cam: { x: cam.x, y: cam.y, zoom: cam.zoom }, sun: { x: lx, y: ly, strength: ls * (weather === "storm" ? 0.15 : weather === "rain" || weather === "fog" ? 0.35 : 1) * (1 + golden * 0.5) }, color: GROUND.water, deep: GROUND.waterDeep, glint: up ? mix(0xffe9a8, phase === "rise" ? 0xffb27a : 0xff8f57, golden) : 0xd9e3ff, rough, night: Math.min(1, night.alpha / 0.42) });
          const sources: LightSource[] = [];
          if (night.alpha > 0.03) {
            for (const d of decor) if (d.sprite === "lamp") {
              sources.push({ x: d.x + 14, y: d.y - 58, r: 90, color: LIGHT.lamp, strength: .72, flicker: .025 });
              sources.push({ x: d.x + 18, y: d.y + 2, r: 62, aspect: .38, color: LIGHT.lamp, strength: .42 });
            }
            for (const p of places.values()) if (p.crowd > 0 && p.kind !== "plot" && p.kind !== "wild" && p.kind !== "public" && (p.kind !== "harbor" || drawn.has(p.id)) && p.kind !== "market") { sources.push({ x: p.x - 22, y: p.y - 78, r: 90, color: LIGHT.window, strength: 0.7, flicker: 0.025 }); sources.push({ x: p.x - 14, y: p.y + 20, r: 78, aspect: 0.4, color: LIGHT.window, strength: 0.42, flicker: 0.02 }); } // #4: warm light spilling from the windows onto the ground at the threshold
          }
          if (night.alpha > 0.1) sources.push({ x: W - 220, y: 90, r: 130, color: 0xdfe8ff, strength: 0.5, noHole: true }); // the moon blooms too
          sources.push(...life.lights);
          lighting.update(night.alpha * (1 - golden * (1 - cover) * 0.55), sources, ft, flash.alpha, shadeTint); // the low sun holds the dark off a while
          weatherFx.update({ weather, wind, snowing, wet, tick: ft, dt: dtf, density: still ? 0.35 : 1, night: Math.min(1, night.alpha / 0.42), fogColor: 0xd7dfe2, rainColor: night.alpha > 0.15 ? 0xdfe8ee : 0x4b5560 });
          clouds.update({ tick: ft, wind, sunUp: up ? 1 - Math.min(1, night.alpha / 0.42) : 0, night: Math.min(1, night.alpha / 0.42), weather, warm: golden * (1 - cover) }); if (miniRef.current) clouds.puffs.visible = clouds.shadows.visible = false; // no weather in the sky over a model on a table
        }
        // long shadows near sunrise and sunset
        const lowSun = Math.max(0, 1 - Math.min(Math.abs(hour - rise), Math.abs(hour - set)) / 1.5) * (night.alpha < 0.3 ? 1 : 0);
        if (every(10)) { const f = Math.max(0, Math.min(1, (hour - rise) / Math.max(1, set - rise))); const up = hour > rise && hour < set; sunNow.elev = up ? Math.sin(Math.PI * f) : 0.55; sunNow.dir = up ? (f < 0.5 ? -1 : 1) : 1; sunNow.low = lowSun; redrawShadows(sunNow.elev, sunNow.dir, sunNow.low); for (const fg of figs.current.values()) fg.rig.castShadow(sunNow.elev, sunNow.dir, sunNow.low); }
        // the sun: up in the east over the far islands, over the top at noon, down in the west; on the sea beneath it, its light
        if (every(4)) { celestial.clear(); const up = hour > rise && hour < set; if (up) { const f = (hour - rise) / Math.max(1, set - rise); const ang = Math.PI * (1 - f); const sx = cx - Rx * 1.05 * Math.cos(ang), sy = cy - Ry * 1.05 - Ry * 0.16 * Math.abs(Math.sin(ang)) - 30; const warm = f < 0.12 || f > 0.88; celestial.circle(sx, sy, 34).fill({ color: warm ? 0xf4b183 : 0xfff0b0, alpha: 0.95 }); celestial.circle(sx, sy, 60).fill({ color: warm ? 0xf4b183 : 0xfff0b0, alpha: 0.12 }); for (let i = 0; i < 6; i++) { const yy = sy + 70 + i * 30; if (inside(sx, yy) < 1.1) break; celestial.moveTo(sx - 16 + Math.sin(tick / 30 + i) * 6, yy).lineTo(sx + 16 + Math.sin(tick / 30 + i) * 6, yy).stroke({ width: 2.5, color: 0xfff0b0, alpha: 0.28 - i * 0.04, cap: "round" }); } } }
        // the sky over the water: stars come out with the dark, the moon keeps the calendar's phase, both lie on the sea
        sky.alpha = Math.max(0, (night.alpha - 0.12) / 0.3);
        if (every(4) && sky.alpha > 0.02) {
          sky.clear();
          for (const st of STARS) { if (inside(st.x, st.y) < 1.1) continue; const tw = 0.5 + 0.5 * Math.sin(tick / 20 + st.tw); sky.circle(st.x, st.y, st.r).fill({ color: LIGHT.star, alpha: 0.35 + 0.5 * tw }); }
          const ph = moonPhase(); const full = (1 - Math.cos(ph * Math.PI * 2)) / 2; // 0 new, 1 full
          // the moon crosses the night the way the sun crosses the day, rising where the sun set
          const nightLen = 24 - set + rise; const nf = hour >= set ? (hour - set) / nightLen : (hour + 24 - set) / nightLen; const mang = Math.PI * (1 - Math.max(0, Math.min(1, nf)));
          const mx = cx + Rx * 1.05 * Math.cos(mang), my = cy - Ry * 1.05 - Ry * 0.16 * Math.abs(Math.sin(mang)) - 40;
          sky.circle(mx, my, 70).fill({ color: LIGHT.lamp, alpha: 0.05 * full }); sky.circle(mx, my, 44).fill({ color: LIGHT.lamp, alpha: 0.07 * full });
          if (every(4200) && !still) falling.set(tick, { x: 200 + ((tick * 7919) % (W - 400)), y: -500 + ((tick * 104729) % 300) });
          for (const [t0, st] of falling) { const age = (tick - t0) / 28; if (age > 1) { falling.delete(t0); continue; } const x = st.x + age * 260, y = st.y + age * 90; sky.moveTo(x - 60 * (1 - age), y - 20 * (1 - age)).lineTo(x, y).stroke({ width: 2, color: LIGHT.star, alpha: 0.9 * (1 - age), cap: "round" }); }
          sky.circle(mx, my, 28).fill({ color: 0x2e3a52, alpha: 0.5 }); // the dark of the moon, faintly there
          sky.circle(mx, my, 28).fill(LIGHT.lamp); if (full < 0.98) sky.circle(mx + (ph < 0.5 ? -1 : 1) * 58 * full, my, 29).cut(); // the earth's shadow slides off as the moon fills
          for (let i = 0; i < 9; i++) { const yy = my + 60 + i * 34; if (inside(mx, yy) < 1.1) break; sky.moveTo(mx - 14 - (i % 3) * 8 + Math.sin(tick / 30 + i) * 6, yy).lineTo(mx + 14 + (i % 2) * 10 + Math.sin(tick / 30 + i) * 6, yy).stroke({ width: 2.5, color: LIGHT.lamp, alpha: 0.35 - i * 0.03, cap: "round" }); }
          // the quay's lamps on the water
          for (const d of decor) if (d.sprite === "lamp" && inside(d.x, d.y + 120) > 0.96) for (let i = 0; i < 4; i++) { const yy = d.y + 70 + i * 22; sky.moveTo(d.x - 8 + Math.sin(tick / 25 + i) * 4, yy).lineTo(d.x + 8 + Math.sin(tick / 25 + i) * 4, yy).stroke({ width: 2, color: LIGHT.lamp, alpha: 0.35 - i * 0.07, cap: "round" }); }
        } else if (sky.alpha <= 0.02 && every(60)) sky.clear();
        if (every(10)) {
          lamps.clear(); windows.clear();
          for(const [id,node] of drawn) lightWorldArt(node,night.alpha>.05 && (places.get(id)?.crowd??0)>0);
          if (night.alpha > 0.05) {
            const k = night.alpha / 0.42;
            for (const d of decor) if (d.sprite === "lamp") { lamps.circle(d.x, d.y - 58, 40).fill({ color: LIGHT.lamp, alpha: 0.16 * k }); lamps.circle(d.x, d.y - 58, 22).fill({ color: LIGHT.lamp, alpha: 0.28 * k }); lamps.ellipse(d.x, d.y + 2, 34, 12).fill({ color: LIGHT.lamp, alpha: 0.22 * k }); }

          }
        }
        if (every(2)) { moths.clear(); if (night.alpha > 0.15 && !still) for (const d of decor) { if (d.sprite !== "lamp") continue; for (let i = 0; i < 3; i++) { const t = tick / (9 + i * 3) + i * 2; moths.circle(d.x + Math.cos(t) * (10 + i * 4) + Math.sin(t * 2.3) * 3, d.y - 58 + Math.sin(t * 1.7) * (7 + i * 2), 1.3).fill({ color: LIGHT.star, alpha: 0.8 }); } } }
        // smoke from a chimney where someone works
        perfMark("smoke");
        if (every(2)) { smoke.clear(); const sn = forcedSeason ?? c?.season; const cold = sn === "winter" || sn === "autumn"; const evening = hour >= 16.5 || hour < 8; litHearths.clear(); for (const [id, [ox, oy]] of [...Object.entries(CHIMNEYS).filter(([id]) => workingPlaces.has(id)), ...Object.entries(HEARTHS).filter(() => cold || evening)]) { const p = places.get(id); if (!p || p.crowd === 0) continue; if (id in HEARTHS && (cold || evening)) litHearths.add(id); for (let i = 0; i < 6; i++) { const age = ((tick / 3 + i * 17) % 60) / 60; smoke.circle(p.x + ox + Math.sin(age * 6 + i) * 6 + age * wind * 30, p.y + oy - age * 70, 4 + age * 10).fill({ color: C.shell, alpha: 0.5 * (1 - age) }); } } }
        // sound follows the camera
        if (every(30) && c) { const f = cam.follow ? figs.current.get(cam.follow) : null; const p = places.get(f?.place ?? "market"); ambience.tick({ mood: stagedNow ? (stagedNow.kind === "wedding" || stagedNow.kind === "feast" ? "tavern" : stagedNow.kind === "funeral" ? "night" : stagedNow.kind === "fire" ? "storm" : "day") : null, weather, hour: c.hour, season: c.season, district: p?.district ?? "old town", place: p?.id ?? "market", crowd: p?.crowd ?? 0, hearth: !!p && litHearths.has(p.id), walking: !!f && !f.asleep && Math.hypot(f.tx - f.x, f.ty - f.y) > 1.5, wind }); }
        // people
        perfMark("people");
        const now = Date.now(); const next: typeof labels = []; const secs = now / 1000;
        // in the miniature, people are posed twelve times a second, as if moved by hand between frames
        const stopFrame = Math.floor(secs * 12), posed = !miniRef.current || stopFrame !== lastStop; lastStop = stopFrame; const poseSecs = miniRef.current ? stopFrame / 12 : secs;
        for (const f of figs.current.values()) {
          const dx = f.tx - f.x, dy = f.ty - f.y, dist = Math.hypot(dx, dy);
          const fleeing = stagedNow?.kind === "fire" && f.place !== stagedNow.place;
          // #5: people slow behind someone ahead of them rather than walking through a crowd
          let crowd = 1;
          if (dist > 8 && !fleeing) { const ix = dx / dist, iy = dy / dist; for (const o of figs.current.values()) { if (o === f || o.asleep || o.boarding) continue; const ox = o.x - f.x, oy = o.y - f.y; const ahead = ox * ix + oy * iy; if (ahead > 6 && ahead < 44 && Math.abs(-ox * iy + oy * ix) < 18) crowd = Math.min(crowd, Math.max(0.3, ahead / 44)); } }
          const motion = advanceWalk(dist, f.speed ?? 0, (fleeing ? 78 : f.weak ? 28 : 48) * crowd, app.ticker.deltaMS / 1000);
          f.speed = motion.speed;
          const moving = dist > .01;
          if (motion.distance > 0) { f.x += dx / dist * motion.distance; f.y += dy / dist * motion.distance; }
          f.rig.travel(motion.distance / .82);
          if (f.boarding) { f.tx = boat.position.x + 12; f.ty = boat.position.y - 2; if (dist < 4) { scene.removeChild(f.g); f.g.position.set(-20 + aboard.length * 16, -14); f.g.scale.set(0.9); f.rig.setPose("idle"); f.rig.face(-1); boat.addChild(f.g); aboard.push(f.g); figs.current.delete(f.id); continue; } }
          if (posed) f.g.position.set(f.x, f.y);
          // asleep in a bed of their own, or at the inn or the boat shed, they are indoors and out of sight; asleep anywhere else they sleep rough, in the open, for everyone to see
          const indoors = f.asleep && !moving && (f.home === f.place || f.place === "inn" || f.place === "boatshed");
          f.g.visible = !indoors; if (indoors) continue;
          if (moving && Math.abs(dx) > .1) f.facing = dx < 0 ? -1 : 1;
          let b = bubbles.current.get(f.id); if (b && b.until < now) { bubbles.current.delete(f.id); b = undefined; }
          const conversation = dialogue.get(f.id);
          if (conversation && conversation.until < now) dialogue.delete(f.id);
          const partner = conversation && conversation.until >= now ? conversation.peers.map(id => figs.current.get(id)).find(peer => peer && peer.place === f.place && !peer.asleep && !peer.boarding && Math.hypot(peer.x - f.x, peer.y - f.y) < 180) : undefined;
          if (!moving && !f.asleep && partner && Math.abs(partner.x - f.x) > 4) f.facing = partner.x < f.x ? -1 : 1;
          // which way they face: toward you or away when the walk is mostly down or up the map, else side on
          if (moving) { f.walkFacing = walkFacing(dx, dy, f.walkFacing ?? (f.facing < 0 ? "left" : "right")); f.rig.facing4(f.walkFacing, true); } else f.rig.face(f.facing, true);
          const running = moving && stagedNow?.kind === "fire" && f.place !== stagedNow.place;
          // people and the animals: a walker looks at the hens or the cat as they pass; someone standing still lets the cat or the dog come to hand
          let petting = false, animal: Critter | null = null, animalD = 90;
          if (!f.asleep && !f.boarding) {
            for (const cr of life.critters) { if (!cr.g.visible) continue; const d = Math.hypot(cr.x - f.x, cr.y - f.y); if (d < animalD) { animalD = d; animal = cr; } }
            if (f.react && (moving || tick >= f.react.until)) f.react = undefined;
            if (f.react) { petting = true; f.facing = f.react.ax < f.x ? -1 : 1; }
            else if (animal && animal.kind !== "hen" && animalD < 48 && !moving && !b && !f.bench && f.pose !== "work" && !(stagedNow && f.place === stagedNow.place) && (animal.kind === "dog" || animal.state === "sit" || animal.state === "sleep") && tick > (f.reactAt ?? 0) && every(5) && Math.random() < 0.3) {
              const len = 240 + Math.random() * 220; f.react = { until: tick + len, ax: animal.x, ay: animal.y }; f.reactAt = tick + len + 2400; animal.pinned = tick + len; petting = true; f.facing = animal.x < f.x ? -1 : 1;
            }
            for (const fl of life.flushes) if (tick - fl.at < 3 && Math.hypot(fl.x - f.x, fl.y - f.y) < 160) f.rig.glance(-0.26, (fl.x - f.x) * f.facing); // gulls going up turn heads
          }
          if (f.moment && (Date.now() > f.moment.until || moving || f.asleep)) f.moment = undefined;
          const moment = f.moment;
          const actual = agents.current.get(f.id);
          const activity = actual?.activity && actual.activity.place === f.place && actual.activity.until > (c?.t ?? 0) && !f.asleep ? actual.activity : null;
          const fishing = activity?.kind === "fish";
          f.rig.trade(fishing ? "angling" : actual?.gear?.name === "hammer" ? "smith" : actual?.gear?.name === "axe" ? "axe" : actual?.job ?? null);
          f.rig.hold(fishing ? null : actual?.gear?.name ?? actual?.carrying ?? null);
          f.rig.seatAt(!moving && f.seat ? f.seat.height / .82 : null);
          if (!moving && f.seat) { f.facing=f.seat.facing; f.rig.face(f.facing, true); }
          f.rig.setPose(f.asleep ? "sleep" : running ? "run" : moving ? "walk" : fishing ? "work" : petting ? "crouch" : moment && moment.pose !== "idle" ? moment.pose : b ? "talk" : f.bench ? "sit" : f.pose === "sit" || (f.pose === "work" && !activity) ? "idle" : f.pose);
          // the face: hunger shows, a wedding or a feast lifts it, a funeral lowers it; the eyes go to whoever they are talking to
          const inStage = !!stagedNow && f.place === stagedNow.place; const ag = agents.current.get(f.id);
          f.rig.mood({ hunger: Math.min(1, (ag?.daysHungry ?? 0) / 3), joy: inStage && (stagedNow.kind === "wedding" || stagedNow.kind === "feast") ? 0.8 : (moment?.mood?.joy ?? 0), grief: inStage && stagedNow.kind === "funeral" ? 0.8 : 0, anger: moment?.mood?.anger ?? 0, surprise: moment?.mood?.surprise ?? 0, tired: f.weak ? 0.6 : 0 });
          if (partner) { f.rig.lookAt((partner.x - f.x) * f.facing); } else if (b || f.rig["pose" as keyof typeof f.rig] === "talk") { let best: Fig | null = null, bd = 90; for (const o of figs.current.values()) { if (o === f || o.asleep || o.place !== f.place) continue; const d = Math.hypot(o.x - f.x, o.y - f.y); if (d < bd) { bd = d; best = o; } } f.rig.lookAt(best ? (best.x - f.x) * (f.facing) : 0); } else if (petting && f.react) f.rig.lookAt((f.react.ax - f.x) * f.facing); else if (animal && (animal.kind === "hen" ? animalD < 90 : animalD < 70) && !(animal.kind === "dog" && animal.state === "follow" && tick % 400 > 120)) f.rig.lookAt((animal.x - f.x) * f.facing); else f.rig.lookAt(0);
          if (!moving && petting) f.rig.face(f.facing, true);
          if (posed) f.rig.update(poseSecs);
          f.rig.weather({ rain: wet && !snowing && !f.asleep, cold: (winter || snowing) && !f.asleep });
          if (moving && snowiness > 0.3 && every(6)) { prints.push({ x: f.x + (tick % 12 < 6 ? -4 : 4), y: f.y + 2, at: tick }); if (prints.length > 400) prints.shift(); }
          f.g.zIndex = f.y;
          const subjectX = viewRef.current === "cinema" ? (cinema.current?.x ?? fx) : fx, subjectY = viewRef.current === "cinema" ? (cinema.current?.y ?? fy) : fy;
          const near = viewRef.current !== "map" && Math.hypot(f.x - subjectX, f.y - subjectY) < (viewRef.current === "cinema" ? 170 : 260);
          const inScene = viewRef.current === "cinema" && !!cinema.current?.ids.includes(f.id) && Date.now() - (cinema.current?.at ?? 0) < 120000;
          next.push({ id: f.id, name: f.name, activity: activity ? fishing ? moving ? "Walking to the pier" : "Fishing · line in the water" : "At work" : undefined, x: f.x * cam.zoom + cam.x, y: (f.y - 66) * cam.zoom + cam.y, mine: f.mine, shown: f.mine || !!b || hoverRef.current === f.id || inScene || (near && viewRef.current === "street"), ...(b ? { bubble: b.text } : {}) });
        }
        // the ring under the selected person, and the fading pulse under the actors of a picked event
        if (every(2)) {
          emphasis.clear();
          const selF = selRef.current ? figs.current.get(selRef.current) : null;
          if (selF && selF.g.visible) { emphasis.ellipse(selF.x, selF.y + 2, 30, 30 * 0.42).stroke({ width: 2.5, color: C.coral, alpha: 0.9 }); emphasis.ellipse(selF.x, selF.y + 2, 34, 34 * 0.42).stroke({ width: 1.5, color: C.coral, alpha: 0.35 }); }
          const nowP = Date.now();
          for (const [id, until] of pulses) {
            if (until < nowP) { pulses.delete(id); continue; }
            const f = figs.current.get(id); if (!f || !f.g.visible) continue;
            const life = (until - nowP) / 4200; const ph = ((nowP / 900) % 1); const r = 20 + ph * 30;
            emphasis.ellipse(f.x, f.y + 2, r, r * 0.42).stroke({ width: 2.5, color: C.coral, alpha: (1 - ph) * life * 0.85 });
          }
        }
        // names stack upward when people stand shoulder to shoulder, so none is written over another
        perfMark("labels");
        next.sort((a, b) => a.x - b.x);
        for (let i = 0; i < next.length; i++) { const a = next[i]!; if (!a.shown) continue; for (let guard = 0; guard < 6; guard++) { const hit = next.slice(0, i).find((b) => b.shown && Math.abs(b.x - a.x) < 46 * cam.zoom + 8 && Math.abs(b.y - a.y) < 16); if (!hit) break; a.y = hit.y - 15; } }
        // positions go straight to the tags every frame; React only hears about it when what a tag says or shows changes
        for (const l of next) { labelPos.current.set(l.id, { x: l.x, y: l.y }); const el = labelEls.current.get(l.id); if (el) el.style.transform = `translate3d(${l.x}px,${l.y}px,0)`; }
        const labelsNow = next.map((l) => `${l.id}\u0001${l.name}\u0001${l.mine ? 1 : 0}\u0001${l.shown ? 1 : 0}\u0001${l.activity ?? ""}\u0001${l.bubble ?? ""}`).sort().join("\u0002");
        if (labelsNow !== labelKey.current) { labelKey.current = labelsNow; setLabels(next); }
        perfMark("mini");
        if (every(20)) setMini({ w: W, h: H, places: [...places.values()].map((p) => ({ id: p.id, x: p.x, y: p.y, kind: p.kind, crowd: p.crowd })), view: { x: -cam.x / cam.zoom, y: -cam.y / cam.zoom, w: Wd / cam.zoom, h: Hd / cam.zoom }, people: [...figs.current.values()].map((f) => ({ x: f.x, y: f.y, mine: f.mine })) });
        perfMark("end");
      });
    })().catch(() => { if(alive) setLoadError(true); });
    return () => { alive = false; stopWatching?.(); cameraControl.current = null; navigateMini.current=null; for (const timer of speechTimers) clearTimeout(timer); speechTimers.clear(); dialogue.clear(); bubbles.current.clear(); ws?.close(); if (poll) clearInterval(poll); void ambienceRef.current?.disable(); clearNightGlow(); if (inited) { try { app?.destroy(true); } catch {} } figs.current.clear(); agents.current.clear(); seatOf.current.clear(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mineId, apiUrl]);

  useEffect(() => { onSnapshot?.({ clock, feed, citizens: [...agents.current.values()], ready, error: loadError }); }, [clock, feed, ready, loadError, onSnapshot]);

  useEffect(() => { camera.current.follow = focusId ?? (observer ? null : mineId); if (focusId || !observer) camera.current.hand = null; }, [mineId, focusId, observer]);
  useEffect(() => { if(view !== "street") camera.current.hand=null; if (view !== "cinema") setCaption(null); },[view]);
  const z = camera.current.zoom;
  const showLabels = view === "street" || z > 0.6;

  return (
    <div className={`absolute inset-0 overflow-hidden rounded-[28px] bg-glass ${observer ? townStyle.world : ""}`}>
      <div ref={host} className="absolute inset-0" />
      {!ready && <div className="absolute inset-0 flex flex-col gap-3 items-center justify-center text-teal font-bold">{loadError ? <>The island could not be loaded.<button className="underline" onClick={()=>window.location.reload()}>Try again</button></> : "Crossing to the island…"}</div>}
      <div className="absolute inset-0 pointer-events-none crossfade" style={{ background: "radial-gradient(ellipse at center, rgba(30,42,43,0) 55%, rgba(30,42,43,0.22) 100%)", opacity: view === "map" ? 0.5 : view === "cinema" ? 1 : 0.7 }} />
      <button data-world-control="sound" hidden={cleanUi} onClick={() => { const a = ambienceRef.current; if (!a) return; if (sound) { void a.disable(); setSound(false); } else { void a.enable().then(() => setSound(true)); } }} className="absolute right-3 top-3 sm:right-6 sm:top-6 h-9 px-3.5 rounded-full bg-shell text-teal text-[13px] font-bold pointer-events-auto transition-colors" aria-pressed={sound}>{sound ? "Sound on" : "Sound off"}</button>
      {ready && !cleanUi && !placeInfo && <div data-world-control="camera" role="group" aria-label="Camera controls" className="absolute right-3 top-16 sm:right-6 sm:top-20 flex flex-col rounded-2xl bg-shell text-teal shadow-sm overflow-hidden">
        <button aria-label="Zoom in" title="Zoom in" onClick={() => cameraControl.current?.("in")} className="w-11 h-11 text-2xl hover:bg-glass focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-4">+</button>
        <button aria-label="Zoom out" title="Zoom out" onClick={() => cameraControl.current?.("out")} className="w-11 h-11 text-2xl hover:bg-glass focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-4">−</button>
        <button aria-label="Show whole island" title="Show whole island" onClick={() => cameraControl.current?.("reset")} className="w-11 h-11 text-xl hover:bg-glass focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-4"><Icon name="map" size={20}/></button>
        <button aria-label="Miniature" title={miniature ? "Back to the town" : "See the island as a model"} aria-pressed={miniature} onClick={toggleMiniature} className={`w-11 h-11 text-xl hover:bg-glass focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-4 ${miniature ? "bg-glass" : ""}`}><Icon name="model" size={20}/></button>
      </div>}
      <div hidden={cleanUi} className="absolute inset-0 pointer-events-none">
        {labels.map((l) => (
          <div key={l.id} ref={(el) => { if (el) { labelEls.current.set(l.id, el); const p = labelPos.current.get(l.id); if (p) el.style.transform = `translate3d(${p.x}px,${p.y}px,0)`; } else { labelEls.current.delete(l.id); labelPos.current.delete(l.id); } }} className="absolute left-0 top-0 will-change-transform flex flex-col items-center gap-1 -translate-x-1/2 -translate-y-full">
            {l.bubble && <div className="bg-glass px-3 py-2 italic text-[13px] max-w-[260px] leading-[1.3] pointer-events-auto shadow-none" style={{ borderRadius: "16px 16px 16px 4px" }}>“{l.bubble}”</div>}
            {/* a name tag: ink on the drawn ground whatever the theme, since the street is always sand; yours in the signal colour */}
            <div className="crossfade display text-[12px] font-semibold leading-none whitespace-nowrap rounded-[6px] px-1.5 py-[3px]" style={{ opacity: l.shown ? 1 : 0, background: l.mine ? "#E4572E" : "rgba(20,22,26,0.82)", color: "#F7F6F3", letterSpacing: "0.01em" }}>{l.name.split(" ")[0]}{l.mine ? " · you" : ""}{l.activity && <span className="block text-[10px] font-normal mt-1 opacity-80">{l.activity}</span>}</div>
          </div>
        ))}
      </div>
      {caption && !cleanUi && view === "cinema" && <div data-world-control="caption" className="absolute left-1/2 -translate-x-1/2 bottom-[98px] sm:bottom-[135px] w-[min(560px,calc(100%-32px))] pointer-events-none rise" style={{ zIndex: 5 }}>
        <div className="rounded-2xl px-4 py-3 shadow-sm" style={{ background: "rgba(20,22,26,0.82)", color: "#F7F6F3" }}>
          {caption.who && <div className="text-[11px] font-semibold uppercase mb-1" style={{ letterSpacing: "0.06em", opacity: 0.7 }}>{caption.who}</div>}
          <div className="text-[14px] leading-snug">{caption.text}</div>
        </div>
      </div>}
      {mini && !cleanUi && <svg data-world-control="mini" className="absolute right-3 bottom-3 sm:right-6 sm:bottom-6 hidden sm:block rounded-2xl bg-shell/90 pointer-events-auto" width={180} height={Math.round(180 * mini.h / mini.w)} viewBox={`0 0 ${mini.w} ${mini.h}`} role="button" tabIndex={0} aria-label="Island minimap. Click to travel, or press Enter to show the whole island." onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();cameraControl.current?.("reset");}}} onClick={e=>{const matrix=e.currentTarget.getScreenCTM();if(!matrix)return;const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());navigateMini.current?.(Math.max(0,Math.min(mini.w,p.x)),Math.max(0,Math.min(mini.h,p.y)));}}>
        <rect width={mini.w} height={mini.h} fill="#d4ddcb" rx={80}/>
        {mini.places.filter((p) => p.kind !== "public" && p.kind !== "wild").map((p) => <circle key={p.id} cx={p.x} cy={p.y} r={p.kind === "plot" ? 22 : 34} fill={p.kind === "plot" ? "#B9CFC8" : "#1F5F5B"} opacity={0.55} />)}
        {mini.people.map((pp, i) => <circle key={i} cx={pp.x} cy={pp.y} r={pp.mine ? 30 : 16} fill={pp.mine ? "#E8735A" : "#1E2A2B"} />)}
        <rect x={mini.view.x} y={mini.view.y} width={mini.view.w} height={mini.view.h} fill="none" stroke="#1F5F5B" strokeWidth={18} rx={40} />
      </svg>}
      {placeInfo && !cleanUi && hasInterior(placeInfo.kind,placeInfo.sprite,placeInfo.site) && <BuildingInterior key={placeInfo.id} name={placeInfo.name} district={placeInfo.district} kind={placeInfo.kind} sprite={placeInfo.sprite} hour={clock?.hour ?? 12} people={placeInfo.people} stock={placeInfo.stock} onClose={()=>{placePast.current=null;setPlaceInfo(null);}} onPerson={id=>{placePast.current=null;setPlaceInfo(null);onSelect(agents.current.get(id)??null);}}>
        {placeInfo.owner && <p className="text-sm">Owned by {placeInfo.owner}.</p>}
        <PlaceMemory marks={placeInfo.decorations??[]} onPreview={through=>{placePast.current=through===null?null:{place:placeInfo.id,through};}}/>
        {placeInfo.hasHistory && <a className="text-sm font-semibold" href={`/built/${encodeURIComponent(placeInfo.id)}`}>Explore the building record →</a>}
      </BuildingInterior>}
      {placeInfo && !cleanUi && !hasInterior(placeInfo.kind,placeInfo.sprite,placeInfo.site) && <div data-world-control="place" className="absolute right-3 top-14 sm:right-6 sm:top-16 max-h-[calc(100%-5rem)] overflow-y-auto w-[min(320px,calc(100%-24px))] bg-shell rounded-card p-4 flex flex-col gap-2 pointer-events-auto rise">
        <div className="flex justify-between items-baseline gap-2"><div><div className="label">{placeInfo.district}</div><div className="display text-[20px] font-semibold">{placeInfo.name}</div></div><button onClick={() => {placePast.current=null;setPlaceInfo(null);}} className="text-sm text-drift">Close</button></div>
        {!placeInfo.community && placeInfo.kind !== "plot" && placeInfo.kind !== "wild" && <Interior kind={placeInfo.kind} sprite={placeInfo.sprite} hour={clock?.hour ?? 12} people={placeInfo.people} />}
        {placeInfo.community && <ProjectDetails project={placeInfo.community} site={placeInfo.site} stock={placeInfo.stock} />}
        <PlaceMemory key={placeInfo.id} marks={placeInfo.decorations ?? []} onPreview={through=>{placePast.current=through===null?null:{place:placeInfo.id,through};}} />
        {placeInfo.hasHistory && <a href={`/built/${encodeURIComponent(placeInfo.id)}`} className="text-sm font-semibold text-teal underline underline-offset-4">Explore the building record →</a>}
        {placeInfo.owner && <div className="text-sm text-ink2">Owned by {placeInfo.owner}.</div>}
        {placeInfo.site && <div className="text-sm text-ink2">{constructionStage(placeInfo.site.done, placeInfo.site.of)} · {placeInfo.site.by} is building {placeInfo.site.name}: {placeInfo.site.done} of {placeInfo.site.of} mornings done.</div>}
        {placeInfo.kind === "plot" && !placeInfo.site && !placeInfo.community && <div className="text-sm text-ink2">Empty land. A house costs 15 coins and six mornings; a shop 30 and ten.</div>}
        <div className="text-sm">{placeInfo.people.length === 0 ? <span className="text-drift">Nobody here right now.</span> : placeInfo.people.map((pp) => <div key={pp.id} className="flex items-center gap-2 py-0.5"><Portrait name={pp.name} appearance={pp.appearance} age={pp.age ?? 30} size={26} /><span>{pp.name}{pp.asleep ? ", asleep" : pp.job ? `, ${pp.job}` : ""}</span></div>)}</div>
      </div>}
      <div hidden={cleanUi || observer} className="absolute left-3 bottom-3 sm:left-6 sm:bottom-6 bg-shell rounded-card p-3 sm:p-4 w-[calc(100%-24px)] sm:w-[330px] flex flex-col gap-1.5 pointer-events-auto max-h-[38%] sm:max-h-none overflow-hidden">
        <div className="label">Just now{clock ? ` · day ${clock.day} ${String(clock.hour).padStart(2, "0")}:${String(clock.minute % 60).padStart(2, "0")} · ${clock.weather}${typeof clock.temperatureC === "number" ? ` · ${Math.round(clock.temperatureC)}°` : ""}` : ""}</div>
        {feed.slice(0, 6).map((e) => <div key={e.id} className="grid gap-x-2.5 items-center" style={{ gridTemplateColumns: "44px 14px 1fr" }}><span className="text-[12px] text-drift tabular">{String(Math.floor((e.t % 1440) / 60)).padStart(2, "0")}:{String(e.t % 60).padStart(2, "0")}</span><span className="rounded-full" style={{ width: e.importance >= 0.45 ? 10 : 7, height: e.importance >= 0.45 ? 10 : 7, background: e.importance >= 0.45 ? "#E8735A" : "#1F5F5B" }} /><span className={`text-[13px] leading-tight line-clamp-2 ${e.importance >= 0.45 ? "font-semibold" : ""}`}>{e.text}</span></div>)}
        {feed.length === 0 && <div className="text-sm text-drift">A quiet minute on the island.</div>}
      </div>
    </div>
  );
}
