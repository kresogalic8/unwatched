"use client";
import { useEffect, useRef, useState } from "react";
import { Application } from "pixi.js";
import { Citizen, aged, type Look, type Pose, type Facing } from "@/components/world/citizen";
import { Portrait } from "@/components/Portrait";

const initialLook: Look = { build: "Average", hair: "Short dark", hairColor: "Dark", hat: "None", carrying: "Nothing", top: "Teal", bottom: "Kelp", coral: "None", skin: 0xd3a484, beard: "None", glasses: false, pattern: "Plain", shape: "Straight" };
const choices = {
  build: ["Slight", "Average", "Sturdy", "Tall"], hair: ["Short dark", "Bob", "Curls", "Bun", "Grey", "Under a hat"],
  hairColor: ["Dark", "Brown", "Fair", "Red", "Grey"], hat: ["None", "Knit cap", "Wide brim", "Baker's cap", "Headscarf"],
  carrying: ["Nothing", "Suitcase", "Satchel", "Basket", "Tool bag"], top: ["Teal", "Sage", "Cream", "Sand", "Kelp"],
  bottom: ["Teal", "Sage", "Cream", "Sand", "Kelp"], beard: ["None", "Moustache", "Short", "Full"],
  pattern: ["Plain", "Stripes", "Checks"], shape: ["Straight", "Broad", "Round"], coral: ["None", "Suitcase", "Scarf", "Buttons", "Hat band"],
} as const;
const labels: Record<keyof typeof choices, string> = { build: "Build", hair: "Hair", hairColor: "Hair color", hat: "Headwear", carrying: "Carry", top: "Coat", bottom: "Trousers", beard: "Beard", pattern: "Fabric", shape: "Shape", coral: "Accent" };
const poses: Pose[] = ["idle", "walk", "run", "talk", "work", "sit", "sleep", "crouch", "read", "write", "eat", "drink", "greet", "argue"];
const field = { display: "block", width: "100%", padding: "8px 10px", marginTop: 5, border: "1px solid #bfc4b3", borderRadius: 8, background: "#f6f3e9", color: "#4f6257" };

export default function CharacterStudy() {
  const host = useRef<HTMLDivElement>(null), rig = useRef<Citizen | null>(null);
  const [look, setLook] = useState<Look>(initialLook), [pose, setPose] = useState<Pose>("walk"), [facing, setFacing] = useState<Facing>("right");
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false); pausedRef.current = paused;
  useEffect(() => { const preference = window.matchMedia("(prefers-reduced-motion: reduce)"); const apply = () => setPaused(preference.matches); apply(); preference.addEventListener("change", apply); return () => preference.removeEventListener("change", apply); }, []);
  const [age, setAge] = useState(30), [weather, setWeather] = useState("clear"), [error, setError] = useState(false);
  const [expression, setExpression] = useState("neutral");
  const state = useRef({ pose, facing, age, weather, expression }); state.current = { pose, facing, age, weather, expression };
  useEffect(() => {
    let active = true, app: Application | null = null; setError(false);
    void (async () => {
      app = new Application();
      await app.init({ bezierSmoothness: .97, width: 400, height: 360, background: 0xece8d9, antialias: true, resolution: 2, autoDensity: true });
      if (!active) { app.destroy(true); return; }
      host.current!.replaceChildren(app.canvas); app.canvas.style.width = "100%"; app.canvas.style.height = "auto";
      const c = new Citizen(aged(look, age)); c.scale.set(2.9); c.position.set(190, 300); rig.current = c; app.stage.addChild(c);
      let time = 0;
      app.ticker.add(ticker => {
        if (document.hidden) return;
        if (!pausedRef.current) time += Math.min(ticker.deltaMS, 50) / 1000;
        const s = state.current; c.age(s.age); c.setPose(s.pose, pausedRef.current); c.facing4(s.facing);
        c.trade(s.pose === "work" ? "cook at the bakery" : null);
        c.weather({ rain: s.weather === "rain", cold: s.weather === "cold" });
        c.mood(s.expression === "neutral" ? {} : { [s.expression]: 1 });
        c.update(time);
      });
    })().catch(() => { if (active) setError(true); });
    return () => { active = false; rig.current = null; if (app?.renderer) app.destroy(true, { children: true }); };
  }, [look, age]);
  return <main style={{ minHeight: "100vh", background: "#eeeadd", color: "#4f6257", padding: "40px clamp(20px,6vw,100px)" }}>
    <nav style={{ display: "flex", gap: 24, fontSize: 14 }}><a href="/town">← Unwatched</a><a href="/town">Harbor Street</a><a href="/experiments/characters/model-sheet">Full model sheet</a></nav>
    <p style={{ marginTop: 36, fontSize: 11, letterSpacing: 3 }}>HARBOR STREET · CHARACTER STANDARD</p>
    <h1 style={{ fontFamily: "Georgia,serif", fontWeight: 400, fontSize: "clamp(30px,5vw,54px)", margin: "10px 0" }}>The same person. Everywhere.</h1>
    <p style={{ maxWidth: 620, lineHeight: 1.6 }}>One living character, from the street to their portrait. Explore every part of the approved character style.</p>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,340px),1fr))", gap: 32, maxWidth: 1120, marginTop: 28 }}>
      <section style={{ background: "#ece8d9", borderRadius: 24, overflow: "hidden", alignSelf: "start" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "20px 24px 0" }}><p style={{ fontSize: 12, letterSpacing: 2 }}>LIVE CHARACTER · APPROVED STANDARD</p><button aria-pressed={paused} onClick={() => setPaused(!paused)} style={{ fontSize: 13, padding: "8px 12px", border: "1px solid #bfc4b3", borderRadius: 20 }}>{paused ? "Play" : "Pause"}</button></div>
        <div ref={host} role="img" aria-label={`Live character: ${pose}, facing ${facing}`} />{error && <p role="alert">Character preview could not load. Refresh to retry.</p>}
        <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "16px 24px 24px", borderTop: "1px solid #d4d5c6" }}><Portrait name="Harbor specimen" appearance={look} age={age} size={80} /><div><p style={{ fontSize: 12, letterSpacing: 2 }}>THE SAME PORTRAIT</p><p style={{ fontSize: 14, marginTop: 6 }}>Shared appearance · {age} years old</p></div></div>
      </section>
      <section aria-label="Character controls">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "14px 18px" }}>
          {(Object.keys(choices) as (keyof typeof choices)[]).map(key => <label key={key} style={{ fontSize: 13 }}>{labels[key]}<select style={field} value={String(look[key])} onChange={e => setLook({ ...look, [key]: e.target.value })}>{choices[key].map(value => <option key={value}>{value}</option>)}</select></label>)}
          <label style={{ fontSize: 13 }}>Skin<select style={field} value={look.skin} onChange={e => setLook({ ...look, skin: Number(e.target.value) })}>{[0xd3a484, 0xf1d6c0, 0xe7c3a5, 0xb98460, 0x8f5f42, 0x6b4630].map((value, i) => <option key={value} value={value}>Tone {i + 1}</option>)}</select></label>
          <label style={{ fontSize: 13 }}>Animation<select style={field} value={pose} onChange={e => setPose(e.target.value as Pose)}>{poses.map(value => <option key={value}>{value}</option>)}</select></label>
          <label style={{ fontSize: 13 }}>Facing<select style={field} value={facing} onChange={e => setFacing(e.target.value as Facing)}>{["right", "left", "front", "back"].map(value => <option key={value}>{value}</option>)}</select></label>
          <label style={{ fontSize: 13 }}>Age<select style={field} value={age} onChange={e => setAge(Number(e.target.value))}>{[6, 12, 30, 64, 78].map(value => <option key={value} value={value}>{value} years</option>)}</select></label>
          <label style={{ fontSize: 13 }}>Expression<select style={field} value={expression} onChange={e => setExpression(e.target.value)}>{["neutral", "joy", "grief", "anger", "surprise", "tired", "hunger"].map(value => <option key={value}>{value}</option>)}</select></label>
          <label style={{ fontSize: 13 }}>Weather<select style={field} value={weather} onChange={e => setWeather(e.target.value)}>{["clear", "rain", "cold"].map(value => <option key={value}>{value}</option>)}</select></label>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24 }}><label><input type="checkbox" checked={look.glasses} onChange={e => setLook({ ...look, glasses: e.target.checked })} /> Glasses</label><button style={{ borderRadius: 24, padding: "10px 20px", background: "#657e76", color: "white" }} onClick={() => { setLook(initialLook); setAge(30); setPose("walk"); setFacing("right"); setWeather("clear"); setExpression("neutral"); }}>Reset character</button></div>
      </section>
    </div>
  </main>;
}
