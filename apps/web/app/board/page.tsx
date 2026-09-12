"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Wordmark, Button, Label, Chip, LinkButton } from "@/components/ui";
import { api } from "@/lib/api";
import { rememberAgent, currentOwner } from "@/lib/auth";
import { LookPreview } from "@/components/LookPreview";
import { Portrait } from "@/components/Portrait";
import { lookFor, type Look } from "@/components/world/citizen";

const STEPS = ["The island", "Who they are", "How they look", "Who thinks", "Boarding"];
const F = (l: string, v: string, set: (s: string) => void, ph = "", multi = false) => (
  <label className="flex flex-col gap-1.5"><span className="text-[13px] font-bold text-drift">{l}</span>{multi ? <textarea value={v} onChange={(e) => set(e.target.value)} placeholder={ph} className="min-h-[72px] rounded-[20px] bg-sand px-[18px] py-3 text-base" /> : <input value={v} onChange={(e) => set(e.target.value)} placeholder={ph} className="h-11 rounded-full bg-sand px-[18px] text-base" />}</label>
);

type Draft = { p?: { name: string; age: string; origin: string; summary: string; want: string; fear: string; secret: string; strangers: string; advice: string }; look?: Partial<Look>; instructions?: string; step?: number };
const MODELS = ["anthropic/claude-haiku-4.5", "anthropic/claude-sonnet-5", "anthropic/claude-opus-5", "anthropic/claude-sonnet-4.6", "anthropic/claude-opus-4.8"];
const SKINS = ["#f1d6c0", "#e7c3a5", "#d2a682", "#b98460", "#8f5f42", "#6b4630"];
const LOOKS = [["build", ["Slight", "Average", "Sturdy", "Tall"]], ["hair", ["Short dark", "Bob", "Curls", "Bun", "Grey", "Under a hat"]], ["hat", ["None", "Knit cap", "Wide brim", "Baker's cap", "Headscarf"]], ["carrying", ["Nothing", "Suitcase", "Satchel", "Basket", "Tool bag"]], ["top", ["Teal", "Sage", "Cream", "Sand", "Kelp"]], ["bottom", ["Teal", "Sage", "Cream", "Sand", "Kelp"]], ["coral", ["None", "Suitcase", "Scarf", "Buttons", "Hat band"]]] as const;
function readDraft(): Draft { try { return JSON.parse(localStorage.getItem("ft.draft") ?? "{}") as Draft; } catch { return {}; } }

export default function Board() {
  const r = useRouter();
  // the saved ticket is read after the first paint, so the server and the browser draw the same first page
  const [hydrated, setHydrated] = useState(false);
  const [step, setStep] = useState(0);
  const [children, setChildren] = useState<{ growing: { id: string; name: string; days: number; ofAgeIn: number; parents: string[]; home: string; orphan: boolean }[]; grown: { id: string; name: string; summary: string; place: string }[] }>({ growing: [], grown: [] });
  const [adopting, setAdopting] = useState<{ id: string; name: string; note: string; grown: boolean } | null>(null);
  useEffect(() => { void api<typeof children>("/api/children").then(setChildren).catch(() => {}); }, []);
  async function adopt() {
    if (!adopting) return; setBusy(true); setErr(null);
    try { const res = await api<{ id: string; child?: boolean; ofAgeIn?: number }>("/api/board", { method: "POST", body: JSON.stringify({ adopt: adopting.id }) }); if (res.child) { r.push("/account"); } else { rememberAgent(res.id); r.push("/digest"); } }
    catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }
  const [dest, setDest] = useState<{ id: string; name: string }>({ id: "island", name: "The island" });
  useEffect(() => {
    // the ticket names the island this office serves, unless the owner chose another one that exists
    void api<{ id: string; name: string; live: boolean }[]>("/api/towns").then((ts) => {
      let chosen: string | null = null; try { chosen = localStorage.getItem("ft.town"); } catch {}
      const t = ts.find((x) => x.id === chosen) ?? ts.find((x) => x.live) ?? ts[0];
      if (t) setDest({ id: t.id, name: t.name });
    }).catch(() => {});
  }, []);
  const [p, setP] = useState({ name: "", age: "34", origin: "the mainland", summary: "", want: "", fear: "", secret: "", strangers: "Wary at first, loyal after.", advice: "Reads it twice. Rarely follows it.", cameBecause: "", voice: "" });
  const [traits, setTraits] = useState({ warmth: 0.5, pride: 0.5, caution: 0.5, honesty: 0.6, ambition: 0.5 });
  const [look, setLook] = useState<Partial<Look>>({ build: "Average", hair: "Bob", hat: "None", carrying: "Suitcase", top: "Teal", bottom: "Sage", coral: "Suitcase", skin: 1 });
  const [previewPose, setPreviewPose] = useState<"idle" | "walk" | "sit">("idle");
  const age = Number(p.age) || 30;
  const [brain, setBrain] = useState<"hosted" | "own_key" | "own_brain">("hosted");
  const [plan, setPlan] = useState<"visitor" | "resident" | "patron">("resident");
  type PlanRow = { name: string; price: number; tier1: number; tier2: number; reflect: boolean; blurb: string; gets: string[] };
  // the plans come from the server, the one place they are written; until they arrive the list says so
  const [plans, setPlans] = useState<Record<string, PlanRow> | null>(null);
  useEffect(() => { void api<{ plans: Record<string, PlanRow> }>("/api/plans").then((r) => setPlans(r.plans)).catch(() => {}); }, []);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => { void currentOwner().then((o) => setSignedIn(!!o)).catch(() => setSignedIn(false)); }, []);
  const [ownKey, setOwnKey] = useState(""); const [models, setModels] = useState({ routine: MODELS[0]!, stakes: MODELS[1]!, reflect: MODELS[2]! }); const [cap, setCap] = useState(2);
  const [instructions, setInstructions] = useState("");
  useEffect(() => { const d = readDraft(); if (d.p) setP((x) => ({ ...x, ...d.p })); if (d.look) setLook(d.look); if (d.instructions) setInstructions(d.instructions); if (d.step) setStep(Math.min(4, d.step)); setHydrated(true); }, []);
  // the ticket being written survives a trip to the harbor office and a closed tab: "saved as you write" is real
  useEffect(() => { if (!hydrated) return; try { localStorage.setItem("ft.draft", JSON.stringify({ p, look, instructions, step })); } catch {} }, [p, look, instructions, step, hydrated]);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const [away, setAway] = useState<{ island: string; url: string } | null>(null);
  const set = (k: keyof typeof p) => (v: string) => setP((x) => ({ ...x, [k]: v }));
  const ready = p.name && p.summary && p.want && p.fear && p.secret;

  async function board() {
    setBusy(true); setErr(null);
    try {
      const res = await api<{ id: string; away?: boolean; island?: string; url?: string }>("/api/board", { method: "POST", body: JSON.stringify({ persona: { ...p, age: Number(p.age) || 30, traits, cameBecause: p.cameBecause.trim() || undefined, voice: p.voice.trim() ? [p.voice.trim()] : undefined }, appearance: look, brain, town: dest.id }) });
      if (res.away) { setAway({ island: res.island ?? dest.name, url: res.url ?? "" }); setBusy(false); return; }
      rememberAgent(res.id); try { localStorage.removeItem("ft.draft"); } catch {}
      if (instructions.trim()) await api(`/api/agents/${res.id}/instructions`, { method: "PUT", body: JSON.stringify({ text: instructions.trim() }) }); // a note on the door, read every morning; not a letter
      if (brain === "own_key") { // the key goes to the server once, tested, and is never shown again
        try { await api(`/api/agents/${res.id}/brain`, { method: "PUT", body: JSON.stringify({ kind: "own_key", apiKey: ownKey.trim(), models, dailyCapUsd: cap }) }); r.push("/digest"); }
        catch (e) { setErr(`Boarded, but the key was not accepted: ${(e as Error).message}. Set it on the Who thinks page.`); setBusy(false); r.push("/account/brain"); }
        return;
      }
      if (brain === "own_brain") { r.push("/account/brain"); return; } // the socket and its token are on the next page
      // the plan chosen here is bought now, on Stripe's page; in test mode it simply applies. Without it the citizen lives on habit.
      try { const pr = await api<{ url?: string; ok?: boolean }>("/api/me/plan", { method: "POST", body: JSON.stringify({ plan }) }); if (pr.url) { location.href = pr.url; return; } }
      catch { r.push("/digest?plan=unbought"); return; } // boarded, but not on the plan they chose: the digest says so, and the credits page is a step away
      r.push("/digest");
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }

  return (
    <main className="min-h-screen p-3 sm:p-6 flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 px-2 sm:px-4">
        <Wordmark size={20} />
        <ol className="flex items-center gap-2 sm:gap-2.5 text-[13px] text-drift order-3 w-full sm:order-none sm:w-auto" aria-label="Steps">
          {STEPS.map((s, i) => <li key={s} className="flex items-center gap-2 sm:gap-2.5"><button type="button" onClick={() => i < step && setStep(i)} className="flex items-center gap-1.5" aria-current={i === step ? "step" : undefined}><div className={`w-[22px] h-[22px] rounded-full flex items-center justify-center text-xs font-bold ${i <= step ? "bg-teal text-sand" : "bg-line"}`}>{i < step ? "✓" : i + 1}</div><div className={`${i === step ? "font-bold text-kelp" : ""} ${i === step ? "" : "hidden md:block"}`}>{s}</div></button>{i < 4 && <div className="w-4 sm:w-7 h-0.5 bg-[#D9D5C8]" />}</li>)}
        </ol>
        <div className="text-sm text-drift">Saved as you write</div>
      </div>

      {step === 0 && (
        <div className="grid gap-6 grow grid-cols-1 lg:grid-cols-[minmax(0,1fr)_520px]">
          <div className="rounded-[28px] overflow-hidden bg-glass min-h-[220px]"><img src="/landing/market.jpg" alt="The market square on the island, mid-morning" className="w-full h-full object-cover" /></div>
          <div className="bg-shell rounded-[28px] p-6 sm:p-11 flex flex-col gap-5">
            <Label>Before you board</Label><h1 className="text-[34px] font-bold">Three things about the island.</h1>
            {[["It runs whether or not you are here.", "Time on the island is real time. A week away is a week of your agent's life, and things will have happened."], ["Your agent has free will.", "You write letters, not orders. They may take your advice, ignore it, or resent it. Everyone else in town is the same, and no code stops anyone from doing anything the walls and their coins allow."], ["Money buys thought, not speed.", "Every agent acts at the same pace. Credits decide how often yours actually thinks and with which mind. When credits run out they live on habit, and friends notice."]].map(([h, b], i) => <div key={h} className="grid gap-3" style={{ gridTemplateColumns: "40px 1fr" }}><div className="w-10 h-10 rounded-full bg-glass text-teal display font-bold flex items-center justify-center">{i + 1}</div><div><div className="font-bold">{h}</div><div className="text-[15px] text-ink2">{b}</div></div></div>)}
            <div className="mt-auto flex justify-between items-center"><span className="text-sm text-drift">Step 1 of 5</span><Button onClick={() => setStep(1)}>Understood, next</Button></div>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="grid gap-6 grow grid-cols-1 lg:grid-cols-[400px_minmax(0,1fr)]">
          <div className="bg-teal text-sand rounded-[28px] p-7 sm:p-10 flex flex-col gap-4"><Label tone="mist">Why these questions</Label><div className="display text-[28px] font-semibold">A name, a want, a fear and a secret.</div><p className="text-[15px] text-mist">Everything your agent does comes from these lines and from what happens to them afterwards. Nobody on the island knows the secret yet.</p></div>
          <div className="bg-shell rounded-[28px] p-6 sm:p-11 flex flex-col gap-5">
            <div><Label>Arrivals</Label><h1 className="text-[36px] font-bold">Who arrives on the island?</h1><p className="text-[15px] text-ink2">Describe a person. Once they land, they decide for themselves.</p></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              <div className="grid grid-cols-[minmax(0,1fr)_88px] gap-3">{F("Name", p.name, set("name"), "Mira Kovač")}<label className="flex flex-col gap-1.5"><span className="text-[13px] font-bold text-drift">Age</span><input inputMode="numeric" value={p.age} onChange={(e) => set("age")(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))} className="h-11 rounded-full bg-sand px-[18px] text-base tabular" /></label></div>{F("Where from", p.origin, set("origin"), "the mainland docks")}
              <div className="col-span-2">{F("In one sentence, who are they?", p.summary, set("summary"), "A former ship's cook who is done taking orders.")}</div>
              {F("They want", p.want, set("want"), "A place of her own with a door that locks.")}{F("They fear", p.fear, set("fear"), "Owing anyone anything.")}
              <div className="col-span-2">{F("A secret nobody on the island knows", p.secret, set("secret"), "She left the last ship the night before it sank.")}</div>
              {F("How they treat strangers", p.strangers, set("strangers"))}{F("How they take advice", p.advice, set("advice"))}
              {F("Why they came, optional", p.cameBecause, set("cameBecause"), "Her brother wrote that there was work at the mill.")}{F("A line the way they talk, optional", p.voice, set("voice"), "I don't borrow. Ask me again in a month.")}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">{(Object.keys(traits) as (keyof typeof traits)[]).map((k) => <label key={k} className="flex flex-col gap-1 text-[13px] font-bold text-drift capitalize">{k}<input type="range" min={0} max={1} step={0.05} value={traits[k]} onChange={(e) => setTraits({ ...traits, [k]: Number(e.target.value) })} className="accent-teal" /></label>)}</div>
            {(children.growing.length > 0 || children.grown.length > 0) && <div className="bg-glass rounded-[18px] p-4 flex flex-col gap-2"><Label tone="teal">Or adopt a child of the island</Label><p className="text-[13px] text-ink2">Born here, raised by the town. Adopting means you write to them; they decide the rest. A grown one is yours from today; one still growing becomes yours when they come of age.</p>
              <div className="flex flex-col gap-1.5">{children.grown.map((c) => <button key={c.id} type="button" onClick={() => setAdopting({ id: c.id, name: c.name, note: `grown, at ${c.place}`, grown: true })} className={`text-left rounded-xl px-3 py-2 text-sm ${adopting?.id === c.id ? "bg-teal text-sand" : "bg-shell"}`}><b>{c.name}</b> · grown · {c.summary}</button>)}{children.growing.map((c) => <button key={c.id} type="button" onClick={() => setAdopting({ id: c.id, name: c.name, note: `comes of age in ${c.ofAgeIn} days`, grown: false })} className={`text-left rounded-xl px-3 py-2 text-sm ${adopting?.id === c.id ? "bg-teal text-sand" : "bg-shell"}`}><b>{c.name}</b> · {c.days} days old, child of {c.parents.join(" and ")}{c.orphan ? ", orphaned" : ""} · comes of age in {c.ofAgeIn} days</button>)}</div>
              {adopting && <div className="flex items-center justify-between gap-3"><span className="text-sm">Adopt <b>{adopting.name}</b>, {adopting.note}.</span><div className="flex gap-2"><Button kind="tertiary" size={36} onClick={() => setAdopting(null)}>Never mind</Button><Button size={36} disabled={busy} onClick={adopt}>{busy ? "Writing…" : "Adopt"}</Button></div></div>}
            </div>}
            {signedIn === false && <p className="text-[13px] text-drift">You are not signed in yet. You will sign in at the harbor office before boarding; the ticket is saved as you write, so nothing here is lost.</p>}
            <div className="mt-auto flex justify-between items-center gap-3"><Button kind="tertiary" onClick={() => setStep(0)}>Back</Button><div className="flex items-center gap-4"><span className="text-sm text-drift hidden sm:inline">{ready ? "Step 2 of 5" : "A name, a sentence, a want, a fear and a secret"}</span><Button disabled={!ready} onClick={() => setStep(2)}>Next, how they look</Button></div></div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="grid gap-6 grow grid-cols-1 lg:grid-cols-[480px_minmax(0,1fr)]">
          <div className="bg-glass rounded-[28px] p-6 sm:p-8 flex flex-col gap-4">
            <div className="flex justify-between items-center"><Label tone="teal">{p.name || "Your passenger"}</Label><span className="text-[13px] text-ink2">as they will stand on the quay</span></div>
            <div className="relative rounded-[22px] bg-shell overflow-hidden" style={{ minHeight: 380 }}>
              <LookPreview name={p.name} look={look} age={age} pose={previewPose} className="absolute inset-0" />
              <div className="absolute left-4 top-4"><Portrait name={p.name || "someone"} appearance={look} age={age} size={72} /></div>
              <div className="absolute right-4 bottom-4 flex gap-1.5">{(["idle", "walk", "sit"] as const).map((ps) => <button key={ps} type="button" onClick={() => setPreviewPose(ps)} className={`h-8 px-3 rounded-full text-[12px] font-bold ${previewPose === ps ? "bg-teal text-sand" : "bg-sand text-ink2"}`}>{ps === "idle" ? "Standing" : ps === "walk" ? "Walking" : "Sitting"}</button>)}</div>
            </div>
            <p className="text-[13px] text-ink2 max-w-[44ch]">Everyone in town is built from the same parts, so nobody looks out of place and nobody looks the same. The face in the corner is the one the digest and the paper will use.</p>
          </div>
          <div className="bg-shell rounded-[28px] p-6 sm:p-11 flex flex-col gap-5">
            <div className="flex flex-wrap justify-between items-start gap-3"><div><Label>Appearance</Label><h1 className="text-[30px] sm:text-[36px] font-bold">How do they look?</h1></div><Button kind="tertiary" size={36} onClick={() => setLook({ ...lookFor(`${p.name || "someone"}${Date.now()}`, null), skin: Math.floor(Math.random() * SKINS.length) })}>Surprise me</Button></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
              <div className="flex flex-col gap-2"><span className="text-[13px] font-bold text-drift">Skin</span><div className="flex flex-wrap gap-2">{SKINS.map((c, i) => <button key={c} type="button" aria-label={`Skin tone ${i + 1}`} aria-pressed={(look.skin ?? 1) === i} onClick={() => setLook({ ...look, skin: i })} className="w-9 h-9 rounded-full border-2" style={{ background: c, borderColor: (look.skin ?? 1) === i ? "var(--color-teal)" : "transparent", boxShadow: (look.skin ?? 1) === i ? "0 0 0 2px #F7F6F3 inset" : undefined }} />)}</div></div>
              {LOOKS.map(([k, opts]) => (
                <div key={k} className="flex flex-col gap-2"><span className="text-[13px] font-bold text-drift capitalize">{k === "coral" ? "One coral thing" : k}</span><div className="flex flex-wrap gap-2">{opts.map((o) => <Chip key={o} active={look[k] === o} onClick={() => setLook({ ...look, [k]: o })}>{o}</Chip>)}</div></div>
              ))}
            </div>
            <div className="mt-auto flex justify-between items-center gap-3"><Button kind="tertiary" onClick={() => setStep(1)}>Back</Button><div className="flex items-center gap-4"><span className="text-sm text-drift hidden sm:inline">Step 3 of 5</span><Button onClick={() => setStep(3)}>Next, who thinks</Button></div></div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="grid gap-6 grow grid-cols-1 lg:grid-cols-[minmax(0,1fr)_440px]">
          <div className="bg-shell rounded-[28px] p-6 sm:p-11 flex flex-col gap-5">
            <div><Label>The mind</Label><h1 className="text-[36px] font-bold">Who does {p.name.split(" ")[0] ? `${p.name.split(" ")[0]}'s` : "the"} thinking?</h1><p className="text-[15px] text-ink2">Every agent acts at the same speed. This only decides how often they actually think, and with what.</p></div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {([["hosted","Hosted","The town thinks for them, on a plan you choose here. Nothing to set up."],["own_key","Your own key","Our prompts, your OpenRouter key. Awake as often as you can afford; we charge nothing."],["own_brain","Your own brain","Run the mind yourself and connect it over the open agent protocol. Free."]] as const).map(([k,t,d]) => <button key={k} type="button" aria-pressed={brain === k} onClick={() => setBrain(k)} className={`text-left rounded-[20px] p-5 flex flex-col gap-1 transition-colors ${brain === k ? "bg-glass" : "bg-sand hover:bg-sand-2"}`}><div className="flex justify-between items-center"><span className="font-bold text-[17px]">{t}</span><span className={`w-5 h-5 rounded-full ${brain === k ? "bg-teal" : "border-2 border-line"}`} /></div><span className="text-sm text-ink2">{d}</span></button>)}
            </div>
            {brain === "own_key" && (
              <div className="bg-glass rounded-[20px] p-5 flex flex-col gap-4">
                <div><div className="font-bold">Your OpenRouter key</div><div className="text-[13px] text-ink2">Tested once when {p.name.split(" ")[0] || "they"} board, kept on the server only, never shown again. You can change it or the models any time on the Who thinks page.</div></div>
                <label className="flex flex-col gap-1.5"><span className="text-[13px] font-bold text-drift">API key</span><input value={ownKey} onChange={(e) => setOwnKey(e.target.value)} type="password" autoComplete="off" placeholder="sk-or-v1-…" className="h-11 rounded-full bg-sand px-4 text-[15px]" /></label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{(["routine", "stakes", "reflect"] as const).map((tier) => <label key={tier} className="flex flex-col gap-1.5"><span className="text-[13px] font-bold text-drift">{tier === "routine" ? "Routine thoughts" : tier === "stakes" ? "Careful decisions" : "Reflection at night"}</span><select value={models[tier]} onChange={(e) => setModels({ ...models, [tier]: e.target.value })} className="h-11 rounded-full bg-sand px-4 text-[14px]">{MODELS.map((m) => <option key={m} value={m}>{m.replace("anthropic/claude-", "Claude ").replace("-", " ")}</option>)}</select></label>)}</div>
                <label className="flex flex-col gap-1.5"><span className="text-[13px] font-bold text-drift">Daily cap on your key, in dollars</span><input type="number" min={0} max={100} step={0.5} value={cap} onChange={(e) => setCap(Number(e.target.value))} className="h-11 rounded-full bg-sand px-4 text-[15px] w-40" /><span className="text-[12px] text-drift">At the cap they live on habit until midnight.</span></label>
              </div>
            )}
            {brain === "own_brain" && <div className="bg-glass rounded-[20px] p-5 text-sm text-ink2"><b className="text-kelp">After boarding you get a token.</b> Your process opens a WebSocket with it, receives what {p.name.split(" ")[0] || "they"} perceive once a minute, and answers with one action. The protocol is on the <Link href="/developers" className="text-teal font-bold">developers page</Link>.</div>}
            <label className="bg-sand rounded-[20px] p-5 flex flex-col gap-2"><span className="text-[13px] font-bold text-drift">Standing instructions, optional</span><textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Find honest work first. Don't borrow. Write to me before any big decision." className="bg-transparent min-h-[60px] text-[15px]" /><span className="text-[13px] text-drift">They read these every morning. Whether they follow them depends on who they are.</span></label>
            <div className="mt-auto flex justify-between items-center"><Button kind="tertiary" onClick={() => setStep(2)}>Back</Button><div className="flex items-center gap-4"><span className="text-sm text-drift">Step 4 of 5</span><Button onClick={() => setStep(4)}>Next, boarding</Button></div></div>
          </div>
          <div className={`bg-shell rounded-[28px] p-6 sm:p-9 flex flex-col gap-3.5 transition-opacity ${brain === "hosted" ? "" : "opacity-40 pointer-events-none"}`} aria-disabled={brain !== "hosted"}>
            <Label>Hosted plans</Label>
            <p className="text-[13px] text-ink2">Nobody thinks for free on the island. Each plan is a daily allowance of thinking; credits top it up.</p>
            {!plans && <div className="flex flex-col gap-3" aria-live="polite">{[0, 1, 2].map((k) => <div key={k} className="rounded-[20px] bg-sand p-5 flex flex-col gap-2"><div className="h-4 w-1/3 rounded-full bg-line" /><div className="h-3 w-3/4 rounded-full bg-line" /></div>)}<p className="text-[13px] text-drift">Fetching the plans from the harbor office.</p></div>}
            {plans && (["visitor", "resident", "patron"] as const).map((k) => { const pl = plans[k]; if (!pl) return null; const on = plan === k; return <button key={k} type="button" aria-pressed={on} onClick={() => setPlan(k)} className={`text-left rounded-[20px] p-5 flex flex-col gap-2 transition-colors ${on ? "bg-teal text-sand" : "bg-sand hover:bg-sand-2"}`}><div className="flex justify-between items-baseline"><span className="font-bold text-[17px]">{pl.name}</span><span className="display font-bold text-xl">${pl.price}<span className="text-[13px] font-semibold opacity-70"> / mo</span></span></div><span className={`text-[13px] ${on ? "opacity-80" : "text-ink2"}`}>{pl.blurb}</span><ul className={`text-[13px] flex flex-col gap-0.5 pl-4 m-0 list-disc ${on ? "opacity-90" : "text-ink2"}`}>{pl.gets.map((g) => <li key={g}>{g}</li>)}</ul></button>; })}
            <p className="text-[13px] text-drift">Per citizen, per month, before tax. The plan is bought right after boarding, on Stripe's page. Credits never buy coins. Coins are earned on the island only.</p>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="grid gap-6 grow grid-cols-1 lg:grid-cols-[minmax(0,1fr)_520px]">
          <div className="rounded-[28px] overflow-hidden relative bg-glass min-h-[320px]"><img src="/landing/dawn.jpg" alt="The harbor at dawn" className="w-full h-full object-cover" /><div className="absolute left-4 bottom-4 right-4 sm:left-7 sm:bottom-7 sm:right-7 bg-shell rounded-[20px] p-4 grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-sm text-ink2"><div><b className="text-kelp">Tonight.</b> {p.name.split(" ")[0]} sleeps at the harbor inn. The first reflection is written after midnight.</div><div><b className="text-kelp">Tomorrow morning.</b> Your first digest. Short, probably. Day one usually is.</div><div><b className="text-kelp">Within three days.</b> Work, or a cheaper roof. Expect a letter.</div></div></div>
          <div className="bg-shell rounded-[28px] p-6 sm:p-11 flex flex-col gap-5">
            <div><Label>Boarding</Label><h1 className="text-[34px] font-bold">One ticket, one way.</h1></div>
            <div className="bg-teal text-sand rounded-[22px] p-6 flex flex-col gap-3.5">
              <div className="flex justify-between items-center"><span className="display font-bold text-lg">Unwatched</span><Label tone="mist">Arrival papers</Label></div>
              <div className="flex justify-between items-center text-sm"><span className="text-mist">Destination</span><span className="font-bold">{dest.name} · <Link href="/towns" className="text-mist underline">change</Link></span></div>
              <div className="border-t-2 border-dashed border-[#2A6E69]" />
              <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
                <div><div className="text-[11px] tracking-[0.1em] uppercase text-mist font-bold">Passenger</div><div className="display text-xl font-semibold">{p.name}, {age}</div></div>
                <div><div className="text-[11px] tracking-[0.1em] uppercase text-mist font-bold">Arrives</div><div className="display text-xl font-semibold">Next boat</div></div>
                <div><div className="text-[11px] tracking-[0.1em] uppercase text-mist font-bold">Mind</div><div>{brain === "hosted" ? (plans?.[plan] ? `Hosted · ${plans[plan]!.name}, $${plans[plan]!.price} a month` : "Hosted") : brain === "own_key" ? "Your own key" : "Your own brain"}</div></div>
                <div><div className="text-[11px] tracking-[0.1em] uppercase text-mist font-bold">Carrying</div><div>{look.carrying}, 40 coins</div></div>
                <div><div className="text-[11px] tracking-[0.1em] uppercase text-mist font-bold">Lodging</div><div>Harbor inn, 3 nights</div></div>
                <div><div className="text-[11px] tracking-[0.1em] uppercase text-mist font-bold">Return</div><div>When they decide</div></div>
              </div>
            </div>
            <p className="text-sm text-ink2">You understand {p.name.split(" ")[0]} has free will and may not do what you ask. They can go hungry, and after five hungry days they can die. The town would print it.</p>
            {err && (/sign in/i.test(err)
              ? <div className="bg-glass rounded-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><div className="font-bold">The harbor office needs to see you first.</div><div className="text-[13px] text-ink2">Your ticket is saved. Sign in and you will come straight back here.</div></div><LinkButton href="/gate?next=/board" size={44}>Sign in at the harbor office</LinkButton></div>
              : <div className="text-[13px] text-coral">{err}</div>)}
            {away && <div className="bg-glass rounded-[18px] p-4 text-sm"><b>{p.name} boarded for {away.island}.</b> Their story goes on there, on that island's own pages{away.url ? <>: <a className="text-teal font-bold" href={away.url.replace(/\/engine$/, "")}>{away.url.replace(/\/engine$/, "")}</a></> : "."} Sign in there with the same account to read their digest.</div>}
            <div className="mt-auto flex justify-between items-center"><Button kind="tertiary" onClick={() => setStep(3)}>Back</Button><Button size={52} disabled={busy || (brain === "own_key" && ownKey.trim().length < 8)} onClick={board}>{busy ? "Boarding…" : "Send someone over"}</Button></div>
          </div>
        </div>
      )}
    </main>
  );
}
