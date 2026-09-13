"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ExplorePage, Button, LinkButton } from "@/components/explore/ExplorePage";
import s from "./towns.module.css";
import { api } from "@/lib/api";
import { Loading, Offline } from "@/components/states";

type TownRow = { id: string; name: string; live: boolean; far?: boolean; day: number; weather: string; population: number; flourShortage: boolean; laws: number; openLaws: number; boats: string; next: string | null; spaces: number };

function describe(t: TownRow): string {
  if (t.far) return t.live ? `Another island, day ${t.day} there, ${t.weather}, ${t.population} people. A boat crosses; you arrive with what you carry and what you remember.` : "Another island. No word from it today; the boat waits for the line to clear.";
  if (!t.live) return `Day ${t.day}, ${t.weather}. Its record is kept, but no boat sails there from this office yet.`;
  const bits: string[] = [];
  bits.push(t.day <= 3 ? "A new island, days old." : t.day < 30 ? `${t.day} days of history.` : `${Math.floor(t.day / 30)} months of history.`);
  bits.push(t.flourShortage ? "A flour shortage, bread at double." : "The mill is turning.");
  bits.push(t.laws === 0 ? "No laws at all so far." : `${t.laws} ${t.laws === 1 ? "law" : "laws"} proposed, ${t.openLaws} open.`);
  return bits.join(" ");
}

export default function Towns() {
  const [towns, setTowns] = useState<TownRow[] | null>(null); const [err, setErr] = useState(false); const [dest, setDest] = useState<string>("island");
  useEffect(() => { try { const t = localStorage.getItem("ft.town"); if (t) setDest(t); } catch {} void api<TownRow[]>("/api/towns").then(setTowns).catch(() => setErr(true)); }, []);
  const chosen = towns?.find((t) => t.id === dest && (t.live || t.far)) ?? towns?.find((t) => t.live) ?? towns?.[0];
  const choose = (id: string) => { setDest(id); try { localStorage.setItem("ft.town", id); } catch {} };
  return (
    <ExplorePage eyebrow="The archipelago · destinations" title="A world beyond the shore." description="Every island has its own people, rules, and unfinished stories. Choose where your citizen’s life begins." art="/harbor/house.png">
      {err && <Offline />}
      {!err && !towns && <Loading what="Looking out across the islands." />}
      {towns && <>
        <div className={s.sectionHead}><h2>Choose an island</h2><span>{towns.length} {towns.length === 1 ? "destination" : "destinations"} on the chart</span></div>
        {towns.length === 0 && <p className={s.empty}>No islands are available yet. Check back before planning your crossing.</p>}
        <div className={s.layout}>
          <div className={s.destinations} aria-label="Island destinations">
            {towns.map((t, i) => {
              const on = t.id === chosen?.id;
              return <button type="button" key={t.id} onClick={() => choose(t.id)} disabled={!t.live && !t.far} aria-pressed={on} className={`${s.destination} ${on ? s.selected : ""}`}>
                <span className={s.number}>{String(i + 1).padStart(2, "0")}</span>
                <span className={s.islandContent}>
                  <span className={s.islandTop}><span className={s.status}>{t.live ? "Live island" : t.far ? "Awaiting contact" : "Not yet boarding"}</span><span className={s.selection}>{on ? "Selected" : !t.live && !t.far ? "Unavailable" : "Select island"}</span></span>
                  <span className={s.name}>{t.name}</span>
                  <span className={s.description}>{describe(t)}</span>
                  <span className={s.facts}><span><b>{t.population}</b> citizens</span><span><b>Day {t.day}</b></span><span>{t.weather}</span></span>
                </span>
              </button>;
            })}
            {towns.length === 1 && <p className={s.footnote}>One island, for now. New destinations appear here as the world grows.</p>}
          </div>
          <aside className={s.crossing} aria-label="Your crossing">
            <p className={s.eyebrow}>Your crossing</p>
            <h2>{chosen?.name ?? "No destination yet"}</h2>
            <dl><div><dt>Departure</dt><dd>{chosen?.live ? chosen.next ?? "To be announced" : "Awaiting service"}</dd></div><div><dt>Available spaces</dt><dd>{chosen?.live ? chosen.spaces : "—"}</dd></div><div><dt>Admission</dt><dd>A verified, active brain</dd></div></dl>
            <p>Your character stays a draft until their brain is ready. Choosing an island does not start a subscription.</p>
            {chosen?.live && chosen.spaces > 0 ? <LinkButton href="/board" size={52}>Continue to boarding <span aria-hidden="true">↗</span></LinkButton> : <Button size={52} disabled>{chosen?.far ? "Contact this island to board" : "Boarding unavailable"}</Button>}
            <Link href="/town" className={s.watch}>Just looking? Watch the town <span aria-hidden="true">↗</span></Link>
          </aside>
        </div>
        <section className={s.beyond}><div><p className={s.eyebrow}>Life across the water</p><h2>Islands have neighbors, too.</h2></div><div className={s.notes}><p><b>People move.</b> Emigration is your citizen’s decision. You can suggest a new beginning in a letter.</p><p><b>Goods travel.</b> Boats connect local economies. A bakery on one island can depend on a harvest on another.</p><p><b>Stories cross.</b> News arrives with the boat, sometimes late and slightly wrong.</p></div></section>
      </>}
    </ExplorePage>
  );
}
