"use client";
import { useEffect, useRef } from "react";
import { Application, Container, Graphics } from "pixi.js";
import { Citizen, lookFor, type Look } from "@/components/world/citizen";

const looks: Partial<Look>[] = [
  {
    hair: "Bob",
    hat: "Wide brim",
    carrying: "Basket",
    top: "Cream",
    bottom: "Teal",
    coral: "Hat band",
    beard: "None",
    skin: 0xe7c3a5,
  },
  {
    hair: "Short dark",
    hat: "None",
    carrying: "Tool bag",
    top: "Sage",
    bottom: "Kelp",
    beard: "Short",
    skin: 0x8f5f42,
  },
  {
    hair: "Curls",
    hat: "None",
    carrying: "Suitcase",
    top: "Teal",
    bottom: "Sand",
    coral: "Suitcase",
    beard: "None",
    skin: 0xb98460,
  },
  {
    hair: "Grey",
    hat: "None",
    carrying: "Satchel",
    top: "Cream",
    bottom: "Sage",
    glasses: true,
    beard: "None",
    skin: 0xf1d6c0,
  },
];
export default function CitizenStage({
  selected,
  motion,
  onError,
}: {
  selected: number;
  motion: boolean;
  onError: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const refresh = useRef<() => void>(() => {});
  const state = useRef({ selected, motion, onError });
  state.current = { selected, motion, onError };
  useEffect(() => refresh.current(), [selected, motion]);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let dead = false,
      app: Application | null = null,
      ro: ResizeObserver | null = null,
      io: IntersectionObserver | null = null;
    const visibility = () => refresh.current();
    (async () => {
      const a = new Application();
      try {
        await a.init({
          backgroundAlpha: 0,
          antialias: true,
          resolution: Math.min(2, devicePixelRatio),
          autoDensity: true,
        });
      } catch {
        if (!dead) state.current.onError();
        return;
      }
      if (dead) {
        a.destroy({ removeView: true, releaseGlobalResources: false }, { children: true });
        return;
      }
      app = a;
      el.appendChild(a.canvas);
      const group = new Container();
      a.stage.addChild(group);
      const citizens = looks.map((look, index) => {
        const c = new Citizen(lookFor(`Landing sample ${index}`, look));
        c.age(index === 3 ? 67 : 30);
        c.facing4("front");
        group.addChild(c);
        return c;
      });
      const ground = new Graphics();
      group.addChildAt(ground, 0);
      let offset=state.current.selected;
      const layout = (render = true) => {
        const w = el.clientWidth,
          h = el.clientHeight;
        const mobile=window.matchMedia("(max-width: 639px)").matches;
        ground.clear();
        citizens.forEach((c, i) => {
          const x = mobile ? w / 2 + (((i-offset+2)%4+4)%4-2)*w : (w * (i + 0.5)) / 4;
          const scale = mobile ? Math.min(h / 105, w / 135) : Math.min(h / 108, w / 390);
          c.scale.set(scale);
          c.position.set(x, h * 0.88);
          ground
            .ellipse(x, h * 0.89, mobile ? Math.min(w / 5, 70) : w / 14, mobile ? 10 : 8)
            .fill({ color: 0x747d60, alpha: 0.12 });
        });
        if(render)a.render();
      };
      const resize=()=>{a.renderer.resize(el.clientWidth,el.clientHeight);layout();};
      resize();
      ro = new ResizeObserver(resize);
      ro.observe(el);
      let time = 0,
        previous = -1,
        previousMotion: boolean | undefined;
      a.ticker.maxFPS = 30;
      a.ticker.add((ticker) => {
        const { selected: active, motion: moving } = state.current;
        if (moving) time += ticker.deltaMS / 1000;
        const delta=((active-offset+2)%4+4)%4-2;
        if(Math.abs(delta)>0.001){offset=moving?offset+delta*Math.min(1,ticker.deltaMS/90):active;layout(false);}
        if (active !== previous || moving !== previousMotion) {
          citizens.forEach((c, i) =>
            c.setPose(moving && i === active ? "greet" : "idle"),
          );
          previous = active;
          previousMotion = moving;
        }
        citizens.forEach((c, i) => c.update(moving ? time + i * 0.7 : 0.4));
      });
      let inView = true;
      refresh.current = () => {
        if(!state.current.motion){offset=state.current.selected;layout();}
        if (inView && !document.hidden && state.current.motion) a.start();
        else {
          a.stop();
          previous = -1;
          previousMotion = undefined;
          citizens.forEach((c) => {
            c.setPose("idle");
            c.update(0.4);
          });
          a.render();
        }
      };
      io = new IntersectionObserver(([entry]) => {
        inView = !!entry?.isIntersecting;
        refresh.current();
      });
      io.observe(el);
      document.addEventListener("visibilitychange", visibility);
      refresh.current();
    })();
    return () => {
      dead = true;
      refresh.current = () => {};
      document.removeEventListener("visibilitychange", visibility);
      ro?.disconnect();
      io?.disconnect();
      app?.destroy({ removeView: true, releaseGlobalResources: false }, { children: true });
    };
  }, []);
  return (
    <div
      ref={host}
      style={{ position: "absolute", inset: 0 }}
      aria-hidden="true"
    />
  );
}
