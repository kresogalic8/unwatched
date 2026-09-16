"use client";
import { useState } from "react";
import type { InventoryView, ItemInstance, Action } from "@unwatched/protocol";
import { Icon } from "@/components/icons";
import s from "./inventory.module.css";

export function Inventory({data, onAction}: {data: InventoryView; onAction?: (action: Action) => Promise<void>}) {
  const [view, setView] = useState<"pack" | "home" | "recipes">("pack");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function act(action: Action) {
    if (!onAction || busy) return;
    setBusy(true); setError("");
    try {await onAction(action);} catch (e) {setError(e instanceof Error ? e.message : "The action could not be completed.");} finally {setBusy(false);}
  }
  const renderItem = (item: ItemInstance, stored = false) => <details className={s.item} key={item.id}>
    <summary>
      <span className={s.drawing}><Icon name={item.condition !== null ? "work" : "ticket"} size={24}/></span>
      <span><strong>{item.name}</strong><small>{data.equipped === item.id ? "Equipped" : item.madeBy ? `Made by ${item.madeBy}` : stored ? "Stored safely" : "Carried"}</small></span>
      <Icon name="plus" size={16}/>
    </summary>
    <div className={s.story}>
      {item.condition !== null && <label>Condition · {item.condition}%<progress max={100} value={item.condition} aria-label={`${item.name} condition`}/></label>}
      <ol>{item.history.map((event, i) => <li key={`${event.t}-${i}`}><small>Day {Math.floor(event.t / 1440) + 1} · {event.who}</small><span>{event.what}</span></li>)}</ol>
      {onAction && <div className={s.actions}>
        {!stored && item.condition !== null && <button disabled={busy} onClick={() => act({kind:"equip",item:data.equipped === item.id ? null : item.id})}>{data.equipped === item.id ? "Put away" : "Equip"}</button>}
        {!stored && item.condition !== null && item.condition < 100 && <button disabled={busy} onClick={() => act({kind:"repair_tool",item:item.id})}>Repair · 1 plank</button>}
        <button disabled={busy} onClick={() => act({kind: stored ? "retrieve" : "stow", item:item.id})}>{stored ? "Retrieve here" : "Store here"}</button>
        {!stored && <button disabled={busy} onClick={() => act({kind:"drop",item:item.id})}>Leave here</button>}
      </div>}
    </div>
  </details>;
  return <section className={s.panel} aria-label="Belongings">
    <header className={s.header}><div><small>THE THINGS THEY KEEP</small><h2>Belongings</h2></div><span>{data.items.length} / {data.capacity}<small>carrying slots</small></span></header>
    <progress className={s.capacity} value={Math.min(data.items.length, data.capacity)} max={data.capacity} aria-label="Backpack capacity"/>
    {data.items.length >= data.capacity && <p className={s.notice}>The backpack is full. Nothing is lost; they need to make room before collecting more.</p>}
    <div className={s.tabs} role="group" aria-label="View belongings">
      {([['pack','Backpack'],['home','At home'],['recipes','Crafting']] as const).map(([key,label]) => <button key={key} aria-pressed={view === key} onClick={() => setView(key)}>{label}</button>)}
    </div>
    {view === "pack" && <div className={s.grid}>{data.items.map(i => renderItem(i))}{!data.items.length && <p>The backpack is empty.</p>}</div>}
    {view === "home" && <div>{data.storage.filter(box => box.items.length).map(box => <div key={box.place}><h3 className={s.place}><Icon name="home" size={20}/>{box.place.replaceAll("-", " ")} <small>{box.items.length} / 48</small></h3><div className={s.grid}>{box.items.map(i => renderItem(i, true))}</div></div>)}{!data.storage.some(box => box.items.length) && <p className={s.empty}>Nothing stored yet. They can keep belongings at home or a place they own.</p>}</div>}
    {view === "recipes" && <div className={s.recipes}>{data.recipes.map(r => {
      const remaining = data.items.map(i => i.name); const ready = r.from.every(name => {const index=remaining.indexOf(name);if(index<0)return false;remaining.splice(index,1);return true;});
      return <article key={r.item}><strong>{r.item}</strong><small>{r.from.join(" + ")}</small><p>{r.why}</p>{onAction ? <button disabled={!ready || busy} onClick={() => act({kind:"craft",recipe:r.item})}>{ready ? "Craft in preview" : "Needs materials"}</button> : <span className={s.readiness}>{ready ? "Materials in the backpack" : "Materials still needed"}</span>}</article>;
    })}</div>}
    {error && <p role="alert" className={s.notice}>{error}</p>}
    <p className={s.footer}>{onAction ? "Local preview controls. Real citizens choose their own actions." : "Their possessions, their choices. Open an item to read its history."}</p>
  </section>;
}
