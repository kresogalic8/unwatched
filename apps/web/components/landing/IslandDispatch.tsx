"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "../icons";
import s from "./landing.module.css";

type Dispatch = { day: number; population: number; items: { id: number; t: number; text: string; label: string }[] };
export default function IslandDispatch() {
  const host = useRef<HTMLElement>(null);
  const [data, setData] = useState<Dispatch | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let visible = false, disposed = false, busy = false, lastFetch = 0;
    const controller = new AbortController();
    async function update() {
      if (!visible || document.hidden || busy || Date.now() - lastFetch < 60000) return;
      busy = true;
      lastFetch = Date.now();
      try {
        const response = await fetch("/api/island-dispatch", { signal: controller.signal });
        if (!response.ok) throw new Error("Unavailable");
        const result: Dispatch = await response.json();
        if (!disposed) { setData(result); setFailed(false); }
      } catch { if (!disposed) setFailed(true); }
      finally { busy = false; }
    }
    const observer = new IntersectionObserver(([entry]) => { visible = !!entry?.isIntersecting; void update(); }, { rootMargin: "150px" });
    if (host.current) observer.observe(host.current);
    const timer = setInterval(update, 60000);
    document.addEventListener("visibilitychange", update);
    return () => { disposed = true; controller.abort(); observer.disconnect(); clearInterval(timer); document.removeEventListener("visibilitychange", update); };
  }, []);
  return <section ref={host} className={s.dispatch} aria-labelledby="dispatch-title">
    <div className={s.dispatchHead}>
      <div><p className={s.eyebrow}>THE ISLAND DISPATCH</p><h2 id="dispatch-title">Life didn’t wait<br />for you to arrive.</h2></div>
      <div className={s.dispatchMeta}><span>{failed ? "Record temporarily unavailable" : data ? `Day ${data.day} · ${data.population} citizens` : "Opening the public record…"}</span><p>Real moments from the island.<br />No two visits tell the same story.</p></div>
    </div>
    <div className={s.dispatchItems}>
      {data?.items.length ? data.items.map(item => <article key={item.id}><div className={s.dispatchStamp}><span>{item.label}</span><time>Day {Math.floor(item.t / 1440) + 1} · {String(Math.floor(item.t % 1440 / 60)).padStart(2,"0")}:{String(Math.floor(item.t % 60)).padStart(2,"0")}</time></div><p>{item.text}</p></article>) : <p className={s.dispatchEmpty}>{failed ? "The connection is quiet. You can still step into the town and explore." : data ? "A quiet stretch on the island. The next public moment will appear here." : "Arrivals, conversations, small decisions. The public record is on its way."}</p>}
    </div>
    <div className={s.dispatchFoot}><span>{failed && data ? "Showing the last available record." : "From the last two island hours · refreshes every minute"}</span><Link href="/town" className={s.textLink}>See where the story goes <span><Icon name="arrowUpRight" size={20} /></span></Link></div>
  </section>;
}
