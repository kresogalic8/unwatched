"use client";
import { useCallback, useEffect, useState } from "react";
import { World, type WorldSnapshot } from "@/components/World";
import { Inventory } from "@/components/citizen/Inventory";
import type { OwnerAgent } from "@/lib/api";
import type { Action } from "@unwatched/protocol";
import s from "./preview.module.css";

export default function InventoryPreview() {
  const [person, setPerson] = useState<OwnerAgent | null>(null);
  const [error, setError] = useState("");
  const [snapshot,setSnapshot] = useState<WorldSnapshot|null>(null);
  const load = useCallback(async () => {
    const response = await fetch("http://localhost:4011/preview-owner", {cache:"no-store"});
    if (!response.ok) throw new Error("The local preview server is unavailable.");
    setPerson(await response.json());setError("");
  },[]);
  useEffect(() => {void load().catch(e=>setError(String(e.message)));},[load,snapshot?.feed[0]?.id]);
  async function action(action: Action) {
    const response = await fetch("http://localhost:4011/preview-action", {method:"POST",body:JSON.stringify(action)});
    const body = await response.json(); if(!response.ok)throw new Error(body.error ?? "That action is not possible here.");
    await load();
  }
  return <main className={s.page}>
    <header><div><small>UNWATCHED · LOCAL PREVIEW</small><h1>A backpack. A workshop. A history.</h1></div><a href="/town">Back to the island ↗</a></header>
    <div className={s.layout}>
      <section className={s.world} aria-label="Live preview world">
        <World apiUrl="http://localhost:4011" mineId={null} focusId={person?.id} onSelect={()=>{}} view="street" onSnapshot={setSnapshot}/>
        <div className={s.caption}><strong>{person?.name ?? "Mara"}</strong><p>{person ? `At ${person.place} · ${person.coins} coins` : "Connecting…"}</p></div>
      </section>
      <aside className={s.aside}>
        <p className={s.intro}>A test citizen with starting materials. Craft a tool, equip it, or go home and store it. These controls demonstrate real rules; citizens make these choices themselves.</p>
        <div className={s.actions}>
          <button onClick={()=>action({kind:"move",to:person?.location === "boatshed" ? "harbor" : "boatshed"}).catch(e=>setError(e.message))}>{person?.location === "boatshed" ? "Go to the harbor" : "Go home"}</button>
          <button onClick={()=>action({kind:"fish"}).catch(e=>setError(e.message))}>Try fishing</button>
        </div>
        {error && <p role="alert">{error}</p>}
        {person?.belongings && <Inventory data={person.belongings} onAction={action}/>}
      </aside>
    </div>
  </main>;
}
