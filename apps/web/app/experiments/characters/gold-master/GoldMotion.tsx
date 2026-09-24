"use client";

import { useEffect, useRef, useState } from "react";
import { Application, Assets, Graphics } from "pixi.js";
import { Spine } from "@esotericsoftware/spine-pixi-v8";
import s from "./gold-master.module.css";

const motions = ["idle", "walk", "wave", "think"] as const;
type Motion = (typeof motions)[number];

export default function GoldMotion() {
  const host = useRef<HTMLDivElement>(null);
  const live = useRef({ motion: "idle" as Motion, playing: true, speed: 1 });
  const redraw = useRef(() => {});
  const [motion, setMotion] = useState<Motion>("idle");
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  live.current = { motion, playing, speed };

  useEffect(() => redraw.current(), [motion, playing, speed]);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let disposed = false;
    let app: Application | undefined;
    let resize: ResizeObserver | undefined;
    let previous = "";
    void (async () => {
      const next = new Application();
      try {
        await next.init({ backgroundAlpha: 0, antialias: true, autoDensity: true, resolution: Math.min(devicePixelRatio, 2) });
        if (disposed) return next.destroy({ removeView: true }, { children: true });
        app = next;
        el.appendChild(next.canvas);
        await Assets.load(["/characters/mara-gold/mara.json", "/characters/mara-gold/mara.atlas"]);
        if (disposed) return;
        const shadow = new Graphics();
        const person = Spine.from({ skeleton: "/characters/mara-gold/mara.json", atlas: "/characters/mara-gold/mara.atlas", autoUpdate: false });
        person.skeleton.setSkinByName("mara-gold");
        person.skeleton.setSlotsToSetupPose();
        person.state.data.defaultMix = .24;
        next.stage.addChild(shadow, person);
        const render = () => {
          if (!app) return;
          const { motion: selected, playing: shouldPlay } = live.current;
          const width = el.clientWidth;
          const height = el.clientHeight;
          app.renderer.resize(width, height);
          const scale = Math.min((height - 76) / 118, width / 92);
          person.scale.set(scale);
          person.position.set(width / 2, height - 28);
          shadow.clear().ellipse(width / 2, height - 24, 48 * scale, 7 * scale).fill({ color: 0x43564a, alpha: .14 });
          if (previous !== selected) {
            person.state.setAnimation(0, selected, true);
            previous = selected;
          }
          if (shouldPlay) app.start(); else { app.stop(); person.update(0); app.render(); }
        };
        next.ticker.maxFPS = 60;
        next.ticker.add((ticker) => person.update(Math.min(ticker.deltaMS / 1000, .05) * live.current.speed));
        redraw.current = render;
        resize = new ResizeObserver(render);
        resize.observe(el);
        render();
        setReady(true);
      } catch (reason) {
        console.error("Mara gold rig", reason);
        if (!disposed) setError(true);
      }
    })();
    return () => {
      disposed = true;
      redraw.current = () => {};
      resize?.disconnect();
      app?.destroy({ removeView: true }, { children: true });
    };
  }, []);

  return (
    <section className={s.goldMotion}>
      <div className={s.motionIntro}>
        <div>
          <span className={s.eyebrow}>New asset / first articulation pass</span>
          <h2>The gold master moves.</h2>
        </div>
        <p>
          Fresh atlas, bones and animation curves built only from the approved
          master above. This is the first review gate: silhouette, overlaps and
          foot contact still need to earn production status.
        </p>
      </div>
      <div className={s.motionStage}>
        <div ref={host} className={s.motionCanvas} role="img" aria-label={`Mara gold-master ${motion} animation`} />
        <div className={s.motionBadge}>NEW · MARA GOLD 01</div>
        {(!ready || error) && <p className={s.motionLoading} role="status">{error ? "The new rig could not load." : "Building the new rig…"}</p>}
      </div>
      <div className={s.motionControls}>
        <button className={s.play} type="button" disabled={!ready} onClick={() => setPlaying((value) => !value)}>{playing ? "Pause" : "Play"}</button>
        <div className={s.motionButtons} aria-label="Gold-master animation">
          {motions.map((name) => <button key={name} type="button" aria-pressed={motion === name} onClick={() => setMotion(name)}>{name}</button>)}
        </div>
        <label>Speed<input aria-label="Playback speed" type="range" min=".5" max="1.5" step=".25" value={speed} onChange={(event) => setSpeed(Number(event.target.value))}/><output>{speed}×</output></label>
      </div>
    </section>
  );
}
