"use client";
import { useState } from "react";
import { World, type WorldSnapshot } from "@/components/World";

export default function HarborPreview() {
  const [state, setState] = useState<WorldSnapshot | null>(null);
  const [error, setError] = useState("");
  async function command(path: string) {
    try { const res = await fetch(`http://localhost:4011/${path}`, {method: "POST"}); if (!res.ok) throw new Error(); setError(""); }
    catch {setError("Start the local harbor-preview server on port 4011.");}
  }
  const person = state?.citizens[0];
  return <main style={{height: "100dvh", display: "grid", gridTemplateRows: "auto 1fr", background: "#eeeae0", color: "#20291f"}}>
    <header style={{padding: "16px 24px", display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center", borderBottom: "1px solid #bdc1af"}}>
      <div style={{flex: 1}}><strong>Living Harbor</strong><p style={{fontSize: 13, margin: "4px 0 0"}}>Local simulation · scripted choice, real engine outcome · 1 second = 1 island minute</p></div>
      <button className="px-4 py-3 bg-[#e4572e] rounded" onClick={() => command("attempt")}>Try fishing</button>
      <button className="px-4 py-3 border rounded disabled:opacity-40" disabled={person?.carrying !== "fish"} onClick={() => command("sell")}>Sell the catch</button>
      <button className="px-4 py-3 border rounded" onClick={() => command("storm")}>Bring a storm</button>
      <a href="/town">Live town ↗</a>
    </header>
    <div style={{position: "relative", minHeight: 0}}>
      <World apiUrl="http://localhost:4011" mineId={null} focusId={person?.id} onSelect={() => {}} view="street" onSnapshot={setState}/>
      <aside style={{position: "absolute", left: 20, bottom: 24, padding: 20, maxWidth: 350, background: "#f6f3e9ee", border: "1px solid #bdc1af", borderRadius: 8, pointerEvents: "none"}}>
        <strong>{person?.activity?.kind === "fish" ? "Line in the water" : person?.carrying === "fish" ? "A real fish in the inventory" : person ? `At ${person.place}` : "Connecting to the harbor"}</strong>
        <p style={{fontSize: 13, margin: "8px 0"}}>{person?.activity?.kind === "fish" ? `${Math.max(0, person.activity.until - (state?.clock?.t ?? 0))} island minutes remaining. The catch is not guaranteed.` : "Try an attempt, or interrupt it with a storm. No paid AI calls or production data."}</p>
        {state?.feed.filter(e => e.kind.startsWith("agent.fishing") || e.kind === "agent.trade").slice(0, 2).map(e => <p key={e.id} style={{fontSize: 13, borderTop: "1px solid #ccc", paddingTop: 8}}>{e.text}</p>)}
        {error && <p role="alert">{error}</p>}
      </aside>
    </div>
  </main>;
}
