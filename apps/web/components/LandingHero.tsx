"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { api, type Clock } from "@/lib/api";

// The island itself is the hero. On a wide screen without a reduced-motion preference the live world mounts in the follow-the-day view;
// everyone else gets the island at night as a still, so a phone never loads the renderer and nothing depends on the world arriving.
const World = dynamic(() => import("@/components/World").then((m) => m.World), { ssr: false, loading: () => null });

const pad = (n: number) => String(n).padStart(2, "0");

export function LandingHero({ github }: { github?: React.ReactNode }) {
  const [live, setLive] = useState(false);
  const [clock, setClock] = useState<Clock | null>(null);
  useEffect(() => {
    const wide = window.matchMedia("(min-width: 1024px)").matches;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setLive(wide && !still);
    void api<Clock>("/api/town").then(setClock).catch(() => {});
  }, []);
  const line = clock
    ? `Live · day ${clock.day} · ${pad(clock.hour)}:${pad(clock.minute % 60)} · ${clock.weather}${typeof clock.temperatureC === "number" ? ` · ${Math.round(clock.temperatureC)}°` : ""}${clock.place ? ` · the sky of ${clock.place}` : ""} · ${clock.population} people`
    : "The island, tonight";
  return (
    <section aria-label="The island, live" className="relative overflow-hidden rounded-[28px] bg-shell" style={{ height: "clamp(560px, 82svh, 880px)" }}>
      <div className="absolute inset-0">
        {live
          ? <World mineId={null} onSelect={() => {}} view="cinema" />
          : <img src="/landing/night.jpg" alt="The island at night: the coast road, the smithy and the bakery under a kelp sky, the feed of what just happened in the corner" className="w-full h-full object-cover" style={{ objectPosition: "center 30%" }} fetchPriority="high" />}
      </div>
      <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(180deg, rgba(20,22,26,0.78) 0%, rgba(20,22,26,0.30) 40%, rgba(20,22,26,0) 62%), linear-gradient(100deg, rgba(20,22,26,0.72) 0%, rgba(20,22,26,0.42) 42%, rgba(20,22,26,0) 68%)" }} />
      <div className="absolute left-5 right-5 top-5 sm:left-9 sm:right-9 sm:top-9 flex flex-col gap-4 sm:gap-5 pointer-events-none max-w-[760px]">
        <div className="landfall flex items-center gap-2.5 text-[13px] font-bold text-mist" style={{ "--i": 0 } as React.CSSProperties}>
          <span className={`w-2.5 h-2.5 rounded-[8px] bg-coral ${clock ? "ring-once" : ""}`} aria-hidden />
          <span className="tabular">{line}</span>
        </div>
        <h1 className="landfall text-[32px] sm:text-[48px] lg:text-[64px] font-semibold text-kelp" style={{ letterSpacing: "-0.03em", lineHeight: 1.02, textWrap: "balance", "--i": 1 } as React.CSSProperties}>A town that keeps living while you are away.</h1>
        <p className="landfall text-[17px] sm:text-xl text-mist max-w-[42ch] leading-[1.45]" style={{ "--i": 2 } as React.CSSProperties}>Put a person on the island. They find work, make friends and enemies, and write to you when something matters. You can write back. What they do with it is their decision.</p>
        <div className="landfall flex flex-wrap gap-3 pointer-events-auto" style={{ "--i": 3 } as React.CSSProperties}>
          <Link href="/board" className="h-[56px] px-7 rounded-[8px] bg-[#E4572E] text-[#14161A] font-bold text-[17px] inline-flex items-center hover:bg-[#EA7554] transition-colors">Send someone over</Link>
          <Link href="/town" className="h-[56px] px-6 rounded-[8px] border-[1.5px] border-[rgba(247,246,243,0.3)] text-kelp font-bold text-[17px] inline-flex items-center hover:border-kelp transition-colors">Watch tonight</Link><Link href="/built" className="text-[15px] font-semibold text-kelp underline underline-offset-4">Watch what they built →</Link>{github}
        </div>
      </div>
    </section>
  );
}

/** A picture that settles into place the first time it scrolls into view. Always visible; the entrance only moves it, so a tab that never fires the observer still shows every picture. */
export function Settle({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [off, setOff] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = el.getBoundingClientRect(); if (r.top < window.innerHeight) return; // already on screen: no entrance
    setOff(true);
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setOff(false); io.disconnect(); } }, { rootMargin: "0px 0px -12% 0px" });
    io.observe(el); return () => io.disconnect();
  }, []);
  return <div ref={ref} className={`settle ${className}`} data-off={off ? "true" : "false"}>{children}</div>;
}
