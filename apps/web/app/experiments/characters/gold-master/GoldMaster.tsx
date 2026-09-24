"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import GoldMotion from "./GoldMotion";
import s from "./gold-master.module.css";

type View = "art" | "anatomy" | "town";

const landmarks = [
  { key: "neck", label: "Neck overlap", x: 50.4, y: 20.6 },
  { key: "shoulder-l", label: "Shoulder", x: 38.2, y: 25.8 },
  { key: "shoulder-r", label: "Shoulder", x: 62.1, y: 25.4 },
  { key: "elbow-l", label: "Elbow", x: 35.4, y: 40.1 },
  { key: "elbow-r", label: "Elbow", x: 65.2, y: 38.8 },
  { key: "wrist-l", label: "Wrist overlap", x: 34.1, y: 49.2 },
  { key: "wrist-r", label: "Wrist overlap", x: 67.2, y: 48.2 },
  { key: "hips", label: "Pelvis / root", x: 50.5, y: 53.8 },
  { key: "knee-l", label: "Knee", x: 45.3, y: 72.8 },
  { key: "knee-r", label: "Knee", x: 55.8, y: 72.4 },
  { key: "ankle-l", label: "Ankle", x: 44.8, y: 89.9 },
  { key: "ankle-r", label: "Ankle", x: 56.7, y: 89.5 },
] as const;

const checks = [
  ["01", "Rest pose", "The complete illustration must remain identical after it is cut and assembled in Spine."],
  ["02", "Hidden overlap", "Neck, shoulders, wrists, pelvis and ankles need painted material beneath every seam."],
  ["03", "Deformation", "Elbows and knees keep their volume through the full bend; feet remain planted during contact."],
  ["04", "World read", "Face, silhouette and carried objects remain legible at the town's actual camera scale."],
] as const;

export default function GoldMaster() {
  const [view, setView] = useState<View>("art");

  return (
    <main className={s.page}>
      <header className={s.header}>
        <Link href="/experiments/characters">← Character experiments</Link>
        <span>Local study · production gate</span>
      </header>

      <section className={s.intro}>
        <div>
          <span className={s.eyebrow}>Mara / gold master 01</span>
          <h1>One body.<br />No broken seams.</h1>
        </div>
        <p>
          The source we approve before rigging. Correct hands, one continuous
          neck, stable hips and enough room around every joint to build a fluid
          Spine character.
        </p>
      </section>

      <nav className={s.controls} aria-label="Master artwork views">
        {([
          ["art", "Final art"],
          ["anatomy", "Rig map"],
          ["town", "Town scale"],
        ] as const).map(([key, label]) => (
          <button key={key} type="button" aria-pressed={view === key} onClick={() => setView(key)}>
            {label}
          </button>
        ))}
        <div className={s.status}><i /> Source candidate ready</div>
      </nav>

      <section className={s.stage} data-view={view}>
        <div className={s.stageCopy}>
          <span>{view === "art" ? "SOURCE / ALPHA" : view === "anatomy" ? "LANDMARK REVIEW" : "CAMERA TEST"}</span>
          <strong>{view === "art" ? "A single coherent painting." : view === "anatomy" ? "Where the rig must bend." : "What a player will actually see."}</strong>
        </div>
        <div className={s.figure}>
          <Image
            src="/characters/mara-gold/source/mara-master-v1.png"
            alt="Mara, a painted island citizen in a neutral three-quarter pose"
            fill
            priority
            sizes="(max-width: 720px) 88vw, 48vw"
          />
          {view === "anatomy" ? (
            <div className={s.rig} aria-label="Proposed Spine rig landmarks">
              <svg viewBox="0 0 100 100" aria-hidden="true">
                <path d="M50.4 20.6 L38.2 25.8 L35.4 40.1 L34.1 49.2 M50.4 20.6 L62.1 25.4 L65.2 38.8 L67.2 48.2 M50.4 20.6 L50.5 53.8 L45.3 72.8 L44.8 89.9 M50.5 53.8 L55.8 72.4 L56.7 89.5" />
              </svg>
              {landmarks.map((point) => (
                <span
                  key={point.key}
                  className={s.point}
                  style={{ left: `${point.x}%`, top: `${point.y}%` }}
                  title={point.label}
                ><b>{point.label}</b></span>
              ))}
            </div>
          ) : null}
        </div>
        {view === "town" ? (
          <div className={s.townScene} aria-hidden="true">
            <Image className={s.house} src="/harbor/house.png" alt="" width={420} height={420} />
            <Image className={s.tree} src="/harbor/tree-large.png" alt="" width={320} height={390} />
            <Image className={s.crates} src="/harbor/crates.png" alt="" width={120} height={120} />
            <div className={s.path} />
          </div>
        ) : null}
        <div className={s.scale}>{view === "town" ? "1× town camera" : "2× art review"}</div>
      </section>

      <GoldMotion />

      <section className={s.gates}>
        <div className={s.gatesHeading}>
          <span className={s.eyebrow}>Acceptance gates</span>
          <h2>We do not animate around a bad source.</h2>
        </div>
        <div className={s.checks}>
          {checks.map(([number, title, body]) => (
            <article key={number}>
              <span>{number}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className={s.footer}>
        <strong>Next:</strong> replace the first rigid regions with weighted meshes, add planted-foot IK and draw dedicated hand and face attachments.
      </footer>
    </main>
  );
}
