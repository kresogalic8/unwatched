"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { Icon } from "../icons";
import { useMotionAllowed } from "./Experience";
import { GITHUB_URL } from "@/lib/site";
import s from "./journey.module.css";

const Island = dynamic(() => import("./IslandScene"), { ssr: false });
gsap.registerPlugin(ScrollTrigger, useGSAP);

export default function IslandJourney() {
  const host = useRef<HTMLElement>(null);
  const progress = useRef(0);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const motion = useMotionAllowed();
  const [room, setRoom] = useState(true);
  useEffect(() => {
    const media = matchMedia("(min-height: 640px)");
    const update = () => setRoom(media.matches);
    update(); media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const cinematic = motion && ready && !failed && room;
  useGSAP(() => {
    if (!cinematic || !host.current) { progress.current = 0; return; }
    const root = host.current;
    const panels = gsap.utils.toArray<HTMLElement>("[data-chapter]", root);
    const meter = root.querySelector("[data-progress]");
    gsap.set(panels.slice(1), { autoAlpha: 0, y: 50 });
    const timeline = gsap.timeline({ scrollTrigger: {
      trigger: root, start: "top top", end: () => `+=${innerHeight * (innerWidth < 640 ? 2 : 2.5)}`,
      pin: true, scrub: .8, anticipatePin: 1, invalidateOnRefresh: true,
    } });
    timeline.to(progress, { current: 1, duration: 3, ease: "none" }, 0)
      .to(meter, { scaleX: 1, duration: 3, ease: "none" }, 0)
      .to(panels[0]!, { autoAlpha: 0, y: -45, duration: .35 }, .65)
      .to(panels[1]!, { autoAlpha: 1, y: 0, duration: .45 }, .9)
      .to(panels[1]!, { autoAlpha: 0, y: -45, duration: .35 }, 1.75)
      .to(panels[2]!, { autoAlpha: 1, y: 0, duration: .5 }, 2.05);
    return () => { progress.current = 0; };
  }, { scope: host, dependencies: [cinematic], revertOnUpdate: true });

  return <section ref={host} className={s.journey} data-cinematic={cinematic} aria-label="A day on an island with a life of its own">
    <div className={s.world} role="img" aria-label="A three-dimensional island moving from daylight to night as you scroll">
      {!ready && <Image src="/landing/island-dark-day.jpg" fill priority sizes="100vw" alt="" className={s.poster} />}
      {!failed && <Island night={false} focus={0} motion={motion} journey={progress} onReady={setReady} onUnavailable={() => { setFailed(true); setReady(false); }} />}
    </div>
    <div className={s.veil} aria-hidden="true" />
    <div className={s.topline}><span>UNWATCHED / AN EXPERIMENT IN ARTIFICIAL LIFE</span><span className={s.coordinate}>A WORLD WITH A MIND OF ITS OWN</span></div>
    <div className={s.chapters}>
      <article data-chapter className={s.chapter}>
        <p className={s.kicker}>01 / THE ARRIVAL</p>
        <h1>You give <br />them life.<br /><em>They take it <br />from here.</em></h1>
        <p className={s.copy}>Give someone a personality. Let them find their way in a world that keeps going when you leave.</p>
      </article>
      <article data-chapter className={s.chapter}>
        <p className={s.kicker}>02 / THE EVERYDAY</p>
        <h2>A small place.<br /><em>Entirely<br />their lives.</em></h2>
        <p className={s.copy}>A stranger becomes a friend. A job becomes a purpose. Small decisions leave their mark on the island.</p>
      </article>
      <article data-chapter className={s.chapter}>
        <p className={s.kicker}>03 / AFTER YOU LEAVE</p>
        <h2>The lights<br />stay on.<br /><em>Life goes on.</em></h2>
        <p className={s.copy}>They remember today. They make plans for tomorrow. Come back and discover who they’ve become.</p>
      </article>
    </div>
    <div className={s.bottomline}>
      <div className={s.links}><Link className={s.enter} href="/town">Step into the world <Icon name="arrowUpRight" size={20} /></Link><a href={GITHUB_URL} className={s.source}>Explore the source <Icon name="arrowUpRight" size={16} /></a></div>
      <a className={s.scroll} href="#about">{cinematic ? "SCROLL TO SPEND A DAY HERE" : "DISCOVER THE ISLAND"}<Icon name="arrowUp" size={20} style={{ transform: "rotate(180deg)" }} /></a>
    </div>
    <div className={s.track} aria-hidden="true"><div data-progress /></div>
  </section>;
}
