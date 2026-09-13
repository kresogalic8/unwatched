"use client";

import { useEffect, useRef, useState } from "react";
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
                : "Explore the miniature in 3D ↗"}
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
    <div className={s.citizens} ref={host}>
      <div
        className={s.citizenStage}
        role="img"
        aria-label="Four sample citizens, drawn with the same character rig used in town"
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
      <div className={s.citizenStory} aria-live="polite">
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
