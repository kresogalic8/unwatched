"use client";
import { useEffect, useState } from "react";
import { Application, Container, Graphics } from "pixi.js";
import { lookFor, aged, type Look } from "@/components/world/citizen";
import { Figurine, headHeight } from "@/components/world/figurine";
import { SAND, CREAM_DARK } from "@/components/world/palette";

/**
 * A portrait: head and shoulders of the same painted figurine that walks the street, drawn once per person and kept, so a face
 * becomes familiar across the digest, the book, the paper and the library. One hidden renderer serves every portrait.
 */
const cache = new Map<string, Promise<string>>();
let app: Promise<Application> | null = null;
function renderer(): Promise<Application> {
  if (!app) app = (async () => { const a = new Application(); await a.init({bezierSmoothness:.97, width: 96, height: 96, backgroundAlpha: 0, antialias: true, resolution: 2, autoDensity: true }); a.ticker.stop(); return a; })();
  return app;
}
export function portraitFor(name: string, appearance: Partial<Look> | null | undefined, age: number): Promise<string> {
  const key = `${name}|${age}|${JSON.stringify(appearance ?? null)}`;
  let p = cache.get(key);
  if (!p) {
    p = (async () => {
      const a = await renderer(); const stage = new Container();
      const bg = new Graphics(); bg.circle(48, 48, 46).fill(CREAM_DARK).stroke({ width: 1.5, color: SAND }); stage.addChild(bg);
      const look = aged(lookFor(name, appearance), age);
      const c = new Figurine(look, 0); c.age(age); c.setPose("idle"); c.facing4("front");
      // the head fills the upper circle whatever the age: children are drawn smaller, so they are framed closer
      const ageScale = age < 16 ? 0.62 + age / 16 * 0.3 : age >= 70 ? 0.95 : 1; const s = 2.5 / ageScale;
      c.scale.set(s); c.position.set(48, 46 + headHeight(look, age) * s);
      c.update(0.4); stage.addChild(c);
      const mask = new Graphics(); mask.circle(48, 48, 46).fill(0xffffff); stage.addChild(mask); stage.mask = mask;
      const canvas = a.renderer.extract.canvas(stage) as HTMLCanvasElement; const url = canvas.toDataURL("image/png"); stage.destroy({ children: true }); return url;
    })();
    cache.set(key, p);
  }
  return p;
}
/** The face when the plan does not carry one: a silhouette, so the page keeps its shape and the difference shows. */
function Silhouette({ size }: { size: number }) { return <svg width={size} height={size} viewBox="0 0 96 96" aria-hidden="true" style={{ display: "block" }}><circle cx="48" cy="48" r="46" fill="var(--color-glass)" /><circle cx="48" cy="40" r="15" fill="var(--color-line)" /><path d="M20 84c3-16 14-24 28-24s25 8 28 24" fill="var(--color-line)" /></svg>; }
export function Portrait({ name, appearance, age, size = 48, className = "", locked = false }: { name: string; appearance?: Partial<Look> | Record<string, unknown> | null; age: number; size?: number; className?: string; /** the owner's plan carries no portrait */ locked?: boolean }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => { let alive = true; setSrc(null); if (locked) return; void portraitFor(name, (appearance ?? null) as Partial<Look> | null, age).then((u) => { if (alive) setSrc(u); }).catch(() => {}); return () => { alive = false; }; }, [name, appearance, age, locked]);
  if (locked) return <span className={`inline-block rounded-full overflow-hidden bg-glass shrink-0 ${className}`} style={{ width: size, height: size }} title="A portrait comes with the Resident and Patron plans"><Silhouette size={size} /></span>;
  return <span className={`inline-block rounded-full overflow-hidden bg-glass shrink-0 ${className}`} style={{ width: size, height: size }}>{src ? <img src={src} alt="" width={size} height={size} style={{ display: "block", width: size, height: size }} /> : null}</span>;
}
