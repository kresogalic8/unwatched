"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { refreshScrollLayout } from "./refreshScrollLayout";
import { useMotionAllowed } from "./Experience";
import { Icon } from "../icons";
import s from "./life-story.module.css";
const Character = dynamic(() => import("./LifeCharacter"), { ssr: false });
gsap.registerPlugin(ScrollTrigger, useGSAP);
const chapters = [
  { day: "01", title: "A name. A want.\nA place to begin.", text: "Meet Mara. Curious, stubborn, quietly ambitious. She comes with a love of baking and a fear of being forgotten.", note: "A personality is a beginning.", place: "The harbor", caption: "The newcomer", thought: "Perhaps I could make something here." },
  { day: "06", title: "A first shift.\nA reason to stay.", text: "An opening at the bakery becomes a routine. Early mornings, flour on her sleeves, and people who start to recognize her.", note: "A routine becomes experience.", place: "The bakery", caption: "The apprentice", thought: "Tomorrow, I’ll get the dough right." },
  { day: "17", title: "Someone remembers\nhow she takes her tea.", text: "A shared loaf. A favor returned. The island begins to feel less like a collection of strangers and more like somewhere she belongs.", note: "Experience becomes a relationship.", place: "The market", caption: "A familiar face", thought: "Maybe I don’t have to do this alone." },
  { day: "30", title: "A door opens.\nHer name is on it.", text: "With help, work, and a little luck, an idea becomes her own bakery. The person you sent has a life you couldn’t have planned.", note: "A life becomes part of the island.", place: "Mara’s bakery", caption: "Part of the island", thought: "There’s a place for me here." },
];
export default function LifeStory() {
  const host = useRef<HTMLElement>(null);
  const [phase, setPhase] = useState(0), [ready, setReady] = useState(false), [failed, setFailed] = useState(false), [room, setRoom] = useState(true);
  const motion = useMotionAllowed();
  const cinematic = motion && ready && room && !failed;
  useEffect(() => { const media = matchMedia("(min-width: 768px) and (min-height: 700px), (min-width: 361px) and (max-width: 767px) and (min-height: 750px), (max-width: 360px) and (min-height: 780px)"); const update = () => setRoom(media.matches); update(); media.addEventListener("change", update); return () => media.removeEventListener("change", update); }, []);
  useGSAP(() => {
    if (!cinematic || !host.current) return;
    const clock = { moment: 0 };
    gsap.to(clock, { moment: 3.999, ease: "none", onUpdate: () => setPhase(Math.min(3, Math.floor(clock.moment))), scrollTrigger: { trigger: host.current, start: "top top", end: () => `+=${innerHeight * 2.2}`, scrub: .55, pin: true, anticipatePin: 1, invalidateOnRefresh: true, refreshPriority: 10 } });
  }, { scope: host, dependencies: [cinematic], revertOnUpdate: true });
  useEffect(() => { refreshScrollLayout(); return refreshScrollLayout; }, [cinematic]);
  const chapter = chapters[phase]!;
  return <section id="a-life" ref={host} className={s.story} data-phase={phase} data-cinematic={cinematic} aria-labelledby="life-story-title">
    <header className={s.header}><h2 id="life-story-title">One person.<br /><span>Thirty days.</span></h2><p>One possible life.<br /><strong>Illustrative story · not a live citizen.</strong></p></header>
    <div className={s.scene} aria-label={`Illustration: Mara, ${chapter.caption.toLowerCase()}, at ${chapter.place.toLowerCase()}`} role="img">
      <div className={s.sun} /><div className={s.ground} />
      <div className={s.harbor}><Image src="/harbor/pier.png" alt="" fill sizes="35vw" /></div>
      <div className={s.tree}><Image src="/harbor/tree-large.png" alt="" fill sizes="20vw" /></div>
      <div className={s.bakery}><Image src="/harbor/bakery.png" alt="" fill sizes="(max-width: 640px) 45vw, 30vw" /></div>
      <div className={s.stall}><Image src="/harbor/stall.png" alt="" fill sizes="25vw" /></div>
      <div className={s.character}>{!failed && <Character phase={phase} motion={motion} onReady={() => setReady(true)} onError={() => setFailed(true)} />}{failed && <span className={s.monogram}>M</span>}</div>
      <div className={s.name}>MARA <span>{chapter.caption}</span></div>
      <p className={s.thought} key={phase}>“{chapter.thought}”</p>
    </div>
    <div className={s.narrative}>
      <div className={s.day}><span>DAY</span><strong key={phase}>{chapter.day}</strong><span>/ 30</span></div>
      <div key={phase} className={s.chapter}><p className={s.place}>{chapter.place}</p><h3>{chapter.title}</h3><p>{chapter.text}</p><small>{chapter.note}</small></div>
    </div>
    <footer className={s.footer}>
      <div className={s.timeline} aria-label="Story chapters">{chapters.map((item, i) => cinematic ? <span key={item.day} data-active={i <= phase}>DAY {item.day}</span> : <button key={item.day} type="button" aria-pressed={phase === i} onClick={() => setPhase(i)}>Day {item.day}</button>)}</div>
      <Link href="/board">Who will yours become? <Icon name="arrowUpRight" size={20} /></Link>
    </footer>
    <a href="#citizen-mind" className={s.skip}>Skip this story <Icon name="arrowUp" size={16} style={{transform:"rotate(180deg)"}} /></a>
  </section>;
}
