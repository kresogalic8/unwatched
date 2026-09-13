"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import dynamic from "next/dynamic";
import Image from "next/image";
import s from "./landing.module.css";

const Island = dynamic(() => import("./IslandScene"), { ssr: false });
const Citizens = dynamic(() => import("./CitizenStage"), { ssr: false });

export function useMotionAllowed() {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () =>
      setAllowed(
        !media.matches &&
          document.querySelector("main")?.getAttribute("data-motion") !== "off",
      );
    update();
    media.addEventListener("change", update);
    window.addEventListener("unwatched-motion", update);
    return () => {
      media.removeEventListener("change", update);
      window.removeEventListener("unwatched-motion", update);
    };
  }, []);
  return allowed;
}

const ScrollEffects = dynamic(() => import("./ScrollMotion"), { ssr: false });
export function LandingMotion() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const firstSection = document.querySelector("[data-reveal]");
    if (!firstSection) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setEnabled(true);
        observer.disconnect();
      }
    });
    observer.observe(firstSection);
    return () => observer.disconnect();
  }, []);
  return enabled ? <ScrollEffects /> : null;
}

export function IslandExhibit() {
  const [night, setNight] = useState(false);
  const [ready, setReady] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const motion = useMotionAllowed();
  return (
    <figure className={s.island}>
      <div
        className={s.islandStage}
        role="img"
        aria-label={`An interactive miniature of the island in ${night ? "moonlight" : "daylight"}, built with the world's own artwork`}
      >
        <div
          className={s.islandPoster}
          style={{ visibility: ready ? "hidden" : "visible" }}
        >
          <Image
            className={s.lightPoster}
            src={`/landing/island-light-${night ? "night" : "day"}.jpg`}
            fill
            sizes="(max-width: 639px) 100vw, 70vw"
            alt=""
            priority
          />
          <Image
            className={s.darkPoster}
            src={`/landing/island-dark-${night ? "night" : "day"}.jpg`}
            fill
            sizes="(max-width: 639px) 100vw, 70vw"
            alt=""
            priority
          />
        </div>
        {enabled && (
          <Island
            night={night}
            motion={motion}
            onReady={setReady}
            onUnavailable={() => setUnavailable(true)}
          />
        )}
      </div>
      <figcaption className={s.islandCaption}>
        <button
          className={s.enableScene}
          type="button"
          disabled={enabled}
          onClick={() => setEnabled(true)}
        >
          {unavailable
            ? "3D unavailable. Showing artwork."
            : ready
              ? "3D active. Move your pointer."
              : enabled
                ? "Opening the miniature…"
                : <>Explore the miniature in 3D <Icon name="arrowUpRight" size={16} /></>}
        </button>
        <div
          className={s.dayControls}
          role="group"
          aria-label="Island lighting"
        >
          <button
            type="button"
            aria-pressed={!night}
            onClick={() => setNight(false)}
          >
            Day
          </button>
          <button
            type="button"
            aria-pressed={night}
            onClick={() => setNight(true)}
          >
            Night
          </button>
        </div>
      </figcaption>
    </figure>
  );
}

const citizens = [
  {
    name: "The dreamer",
    note: "A place to start again",
    story:
      "A dream of opening a shop. A fear of being forgotten. The rest is still unwritten.",
  },
  {
    name: "The maker",
    note: "Something worth building",
    story:
      "Patient with difficult work. Less patient with people. A town full of both awaits.",
  },
  {
    name: "The wanderer",
    note: "Somewhere to belong",
    story:
      "Curious about everyone. Committed to nowhere. Perhaps this island will change that.",
  },
  {
    name: "The thinker",
    note: "A question to follow",
    story:
      "A little skeptical. Quietly generous. Looking for an idea worth staying for.",
  },
];
export function CitizenExhibit() {
  const [selected, setSelected] = useState(0);
  const gesture = useRef<{x:number;y:number}|null>(null);
  const selectRelative=(step:number)=>setSelected(value=>(value+step+citizens.length)%citizens.length);
  const [visible, setVisible] = useState(false);
  const [failed, setFailed] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const motion = useMotionAllowed();
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "180px" },
    );
    if (host.current) io.observe(host.current);
    return () => io.disconnect();
  }, []);
  return (
    <div className={s.citizens} ref={host} role="region" aria-roledescription="carousel" aria-label="Meet the personalities">
      <p className={s.swipeHint}>A personality. A whole new story. <span>Swipe to meet them</span></p>
      <div
        className={s.citizenStage}
        role="img"
        aria-label={`${citizens[selected]!.name}, drawn with the same character rig used in town`}
        tabIndex={0}
        onKeyDown={e=>{if(e.key==="ArrowRight"||e.key==="ArrowLeft"){e.preventDefault();selectRelative(e.key==="ArrowRight"?1:-1);}if(e.key==="Home"){e.preventDefault();setSelected(0);}if(e.key==="End"){e.preventDefault();setSelected(citizens.length-1);}}}
        onPointerDown={e=>{if(e.pointerType==="mouse"&&e.button!==0)return;gesture.current={x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId);}}
        onPointerCancel={()=>{gesture.current=null;}}
        onPointerUp={e=>{const start=gesture.current;gesture.current=null;if(!start)return;const dx=e.clientX-start.x,dy=e.clientY-start.y;if(Math.abs(dx)>40&&Math.abs(dx)>Math.abs(dy)*1.3)selectRelative(dx<0?1:-1);}}
      >
        {!visible || failed ? (
          <div className={s.citizenFallback}>
            {failed
              ? "Meet the citizens in town."
              : "Every person starts somewhere."}
          </div>
        ) : (
          <Citizens
            selected={selected}
            motion={motion}
            onError={() => setFailed(true)}
          />
        )}
      </div>
      <div
        className={s.citizenButtons}
        role="group"
        aria-label="Explore sample personalities"
      >
        {citizens.map((c, i) => (
          <button
            type="button"
            key={c.name}
            aria-pressed={selected === i}
            onClick={() => setSelected(i)}
          >
            <strong>{c.name}</strong>
            <span>{c.note}</span>
          </button>
        ))}
      </div>
      <div className={s.citizenControls}>
        <button type="button" aria-label="Previous personality" onClick={()=>selectRelative(-1)}><Icon name="back" size={20}/></button>
        <div className={s.citizenDots} role="group" aria-label="Choose a personality">{citizens.map((c,i)=><button key={c.name} type="button" aria-label={`Show ${c.name.toLowerCase()}`} aria-pressed={selected===i} onClick={()=>setSelected(i)}><span/></button>)}</div>
        <button type="button" aria-label="Next personality" onClick={()=>selectRelative(1)}><Icon name="chevron" size={20}/></button>
      </div>
      <div className={s.citizenStory} aria-live="polite" aria-atomic="true">
        <span className={s.srOnly}>{citizens[selected]!.name}. </span>
        {citizens[selected]!.story}
      </div>
    </div>
  );
}

export function LandingPreferences() {
  const [theme, setTheme] = useState("auto");
  const [paused, setPaused] = useState(false);
  return (
    <div className={s.preferences}>
      <button
        type="button"
        onClick={() => {
          const next =
            theme === "auto" ? "light" : theme === "light" ? "dark" : "auto";
          setTheme(next);
          document.querySelector("main")?.setAttribute("data-appearance", next);
        }}
        aria-label={`Color theme: ${theme}. Change theme.`}
      >
        Theme: {theme}
      </button>
      <button
        type="button"
        aria-pressed={paused}
        onClick={() => {
          setPaused(!paused);
          document
            .querySelector("main")
            ?.setAttribute("data-motion", !paused ? "off" : "on");
          window.dispatchEvent(new Event("unwatched-motion"));
        }}
      >
        {paused ? "Resume motion" : "Pause motion"}
      </button>
    </div>
  );
}

export function CopyCommand({ command }: { command: string }) {
  const [label, setLabel] = useState("Copy commands");
  return (
    <button
      type="button"
      aria-live="polite"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(command);
          setLabel("Copied");
        } catch {
          setLabel("Select text to copy");
        }
      }}
    >
      {label}
    </button>
  );
}
