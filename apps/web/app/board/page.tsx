"use client";
import { Icon as ArrowIcon } from "@/components/icons";
import Link from "next/link";
import AnotherLife from "@/components/onboarding/AnotherLife";
import { personaFromLife, lookFromLife, type LifeDraft } from "@/lib/another-life";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Wordmark } from "@/components/ui";
import { Button, Label, Chip, LinkButton } from "@/components/account/AccountUI";
import theme from "@/components/explore/explore.module.css";
import s from "./board.module.css";
import { api, API } from "@/lib/api";
import { rememberAgent, currentOwner } from "@/lib/auth";
import { LookPreview } from "@/components/LookPreview";
import { Portrait } from "@/components/Portrait";
import { lookFor, type Look } from "@/components/world/citizen";

const STEPS = ["The island", "Who they are", "How they look", "Who thinks", "Boarding"];
const F = (l: string, v: string, set: (s: string) => void, ph = "", multi = false) => (
  <label className="flex flex-col gap-1.5"><span className="text-[13px] font-bold text-drift">{l}</span>{multi ? <textarea value={v} onChange={(e) => set(e.target.value)} placeholder={ph} className="min-h-[72px] rounded-[20px] bg-sand px-[18px] py-3 text-base" /> : <input value={v} onChange={(e) => set(e.target.value)} placeholder={ph} className="h-11 rounded-full bg-sand px-[18px] text-base" />}</label>
);

type Draft = { life?:LifeDraft; requestId?:string; p?: { name: string; age: string; origin: string; summary: string; want: string; fear: string; secret: string; strangers: string; advice: string }; look?: Partial<Look>; instructions?: string; traits?: { warmth:number; pride:number; caution:number; honesty:number; ambition:number }; brain?: "hosted" | "own_key" | "own_brain"; plan?: "visitor" | "resident" | "patron"; cap?: number; models?: { routine:string; stakes:string; reflect:string }; step?: number };
const MODELS = ["anthropic/claude-haiku-4.5", "anthropic/claude-sonnet-5", "anthropic/claude-opus-5", "anthropic/claude-sonnet-4.6", "anthropic/claude-opus-4.8"];
const SKINS = ["#f1d6c0", "#e7c3a5", "#d2a682", "#b98460", "#8f5f42", "#6b4630"];
const LOOKS = [["build", ["Slight", "Average", "Sturdy", "Tall"]], ["hair", ["Short dark", "Bob", "Curls", "Bun", "Grey", "Under a hat"]], ["hat", ["None", "Knit cap", "Wide brim", "Baker's cap", "Headscarf"]], ["carrying", ["Nothing", "Suitcase", "Satchel", "Basket", "Tool bag"]], ["top", ["Teal", "Sage", "Cream", "Sand", "Kelp"]], ["bottom", ["Teal", "Sage", "Cream", "Sand", "Kelp"]], ["coral", ["None", "Suitcase", "Scarf", "Buttons", "Hat band"]]] as const;
function readDraft(): Draft { try { return JSON.parse(localStorage.getItem("ft.draft") ?? "{}") as Draft; } catch { return {}; } }

export default function Board() {
  const r = useRouter();
  // the saved ticket is read after the first paint, so the server and the browser draw the same first page
  const [hydrated, setHydrated] = useState(false);
  const [step, setStep] = useState(1);
  const [life,setLife]=useState<LifeDraft|undefined>();
  const contentRef = useRef<HTMLDivElement>(null);
  const previousStep = useRef(0);
  useEffect(() => { if (previousStep.current !== step) { contentRef.current?.querySelector<HTMLHeadingElement>("h1")?.focus({preventScroll:true}); previousStep.current = step; } }, [step]);
  const [children, setChildren] = useState<{ growing: { id: string; name: string; days: number; ofAgeIn: number; parents: string[]; home: string; orphan: boolean }[]; grown: { id: string; name: string; summary: string; place: string }[] }>({ growing: [], grown: [] });
  const [adopting, setAdopting] = useState<{ id: string; name: string; note: string; grown: boolean } | null>(null);
  useEffect(() => { void api<typeof children>("/api/children").then(setChildren).catch(() => {}); }, []);
  async function adopt() {
    if (!adopting || busy) return; setBusy(true); setErr(null);
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
  const [p, setP] = useState({ name: "", age: "34", origin: "the mainland", summary: "", want: "", fear: "", secret: "", strangers: "Wary at first, loyal after.", advice: "Reads it twice. Rarely follows it.", cameBecause: "", voice: "", habit:"", skill:"", flaw:"" });
  const [traits, setTraits] = useState({ warmth: 0.5, pride: 0.5, caution: 0.5, honesty: 0.6, ambition: 0.5 });
  const [look, setLook] = useState<Partial<Look>>({ build: "Average", hair: "Bob", hat: "None", carrying: "Suitcase", top: "Teal", bottom: "Sage", coral: "Suitcase", skin: 1 });
  const [previewPose, setPreviewPose] = useState<"idle" | "walk" | "sit">("idle");
  const age = Number(p.age) || 30;
  const [requestId,setRequestId]=useState("");
  const [brain, setBrain] = useState<"hosted" | "own_key" | "own_brain">("hosted");
  const [plan, setPlan] = useState<"visitor" | "resident" | "patron">("resident");
  type PlanRow = { name: string; price: number; tier1: number; tier2: number; reflect: boolean; blurb: string; gets: string[] };
  // the plans come from the server, the one place they are written; until they arrive the list says so
  const [plans, setPlans] = useState<Record<string, PlanRow> | null>(null);
  const [plansDown, setPlansDown] = useState(false);
  const loadPlans = () => { setPlansDown(false); void api<{ plans: Record<string, PlanRow> }>("/api/plans").then((r) => setPlans(r.plans)).catch(() => setPlansDown(true)); };
  useEffect(loadPlans, []);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => { void currentOwner().then((o) => setSignedIn(!!o)).catch(() => setSignedIn(false)); }, []);
  const [ownKey, setOwnKey] = useState(""); const [models, setModels] = useState({ routine: MODELS[0]!, stakes: MODELS[1]!, reflect: MODELS[2]! }); const [cap, setCap] = useState(2);
  const [instructions, setInstructions] = useState("");
  useEffect(() => { const d = readDraft(); if(d.life)setLife(d.life); setRequestId(d.requestId??crypto.randomUUID()); if (d.p) setP((x) => ({ ...x, ...d.p })); if (d.look) setLook(d.look); if (d.instructions) setInstructions(d.instructions); if(d.traits) setTraits(d.traits); if(d.brain) setBrain(d.brain); if(d.plan) setPlan(d.plan); if(typeof d.cap === "number") setCap(d.cap); if(d.models) setModels(d.models); if (typeof d.step === "number") setStep(Math.max(0,Math.min(4, d.step))); setHydrated(true); }, []);
  // the ticket being written survives a trip to the harbor office and a closed tab: "saved as you write" is real
  useEffect(() => { if (!hydrated) return; try { localStorage.setItem("ft.draft", JSON.stringify({ requestId, life, p, look, instructions, traits, brain, plan, cap, models, step })); } catch {} }, [life,p, look, instructions, traits, brain, plan, cap, models, step, hydrated, requestId]);
  const [activePlan,setActivePlan]=useState<string|null>(null);
  const [connection,setConnection]=useState<{id:string;token:string;agentId:string}|null>(null);
  const [verified,setVerified]=useState(false);
  useEffect(()=>{if(!signedIn)return; const load=()=>{void api<{plan:string}>("/api/me/wallet").then(w=>setActivePlan(w.plan)).catch(()=>setActivePlan(null));};load();window.addEventListener("focus",load);return()=>window.removeEventListener("focus",load);},[signedIn]);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const [away, setAway] = useState<{ island: string; url: string } | null>(null);
  const set = (k: keyof typeof p) => (v: string) => setP((x) => ({ ...x, [k]: v }));
  const ready = [p.name, p.summary, p.want].every(value => value.trim().length > 0);

  const persona=()=>({...p,age:Number(p.age)||30,traits,cameBecause:p.cameBecause.trim()||undefined,voice:p.voice.trim()?[p.voice.trim()]:undefined});
  async function connectBrain(){
    setBusy(true);setErr(null);setVerified(false);
    try {setConnection(await api<{id:string;token:string;agentId:string}>("/api/boarding/external",{method:"POST",body:JSON.stringify({persona:persona()})}));}
    catch(e){setErr((e as Error).message);}finally{setBusy(false);}
  }
  async function verifyBrain(){
    if(!connection)return;setBusy(true);setErr(null);setVerified(false);
    try {await api(`/api/boarding/external/${connection.id}/verify`,{method:"POST"});setVerified(true);}
    catch(e){setErr((e as Error).message);}finally{setBusy(false);}
  }
  async function board() {
    if(busy||!ready||!requestId)return;setBusy(true);setErr(null);
    try {
      if(brain==="hosted"){
        const wallet=await api<{plan:string}>("/api/me/wallet");setActivePlan(wallet.plan);
        if(wallet.plan==="none"){
          if(new URLSearchParams(location.search).has("plan")){throw new Error("Payment confirmation has not arrived yet. Your draft is saved. Wait a moment, then try again; you will not be sent to pay twice.");}
          const checkout=await api<{url?:string;ok?:boolean}>("/api/me/plan",{method:"POST",body:JSON.stringify({plan,returnTo:"board"})});
          if(checkout.url){location.href=checkout.url;return;}
        }
      }
      const res=await api<{id:string}>("/api/board",{method:"POST",body:JSON.stringify({requestId,persona:persona(),appearance:look,instructions:instructions.trim(),brain,town:dest.id,...(brain==="own_key"?{apiKey:ownKey.trim(),models,dailyCapUsd:cap}:{}),...(brain==="own_brain"?{ticket:connection?.id}:{})})});
      rememberAgent(res.id);try{localStorage.removeItem("ft.draft");}catch{}
      r.push("/digest?arrived=1");
    }catch(e){setErr((e as Error).message);setBusy(false);}
  }

  if(!hydrated)return <main className={theme.page}><p role="status">Opening your arrival papers…</p></main>;
  const continuation = step>=2 ? <div className={`${theme.page} ${s.unified} ${s.content}`} ref={contentRef}>
      {step === 2 && (
        <div className={`${s.layout} ${s.appearance}`}>
          <div className="bg-shell rounded-[28px] p-6 sm:p-11 flex flex-col gap-5">
            <div className="flex flex-wrap justify-between items-start gap-3"><div><Label>Appearance</Label><h1 tabIndex={-1} className="text-[30px] sm:text-[36px] font-bold">How do they look?</h1></div><Button kind="tertiary" size={36} onClick={() => setLook({ ...lookFor(`${p.name || "someone"}${Date.now()}`, null), skin: Math.floor(Math.random() * SKINS.length) })}>Surprise me</Button></div>
            <div className="flex gap-2">{(["idle","walk","sit"] as const).map(pose=><Chip key={pose} active={previewPose===pose} onClick={()=>setPreviewPose(pose)}>{pose=== "idle"?"Standing":pose==="walk"?"Walking":"Sitting"}</Chip>)}</div><div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
              <div className="flex flex-col gap-2"><span className="text-[13px] font-bold text-drift">Skin</span><div className="flex flex-wrap gap-2">{SKINS.map((c, i) => <button key={c} type="button" aria-label={`Skin tone ${i + 1}`} aria-pressed={(look.skin ?? 1) === i} onClick={() => setLook({ ...look, skin: i })} className="w-9 h-9 rounded-full border-2" style={{ background: c, borderColor: (look.skin ?? 1) === i ? "var(--color-teal)" : "transparent", boxShadow: (look.skin ?? 1) === i ? "0 0 0 2px #F7F6F3 inset" : undefined }} />)}</div></div>
              {LOOKS.map(([k, opts]) => (
                <div key={k} className="flex flex-col gap-2"><span className="text-[13px] font-bold text-drift capitalize">{k === "coral" ? "One coral thing" : k}</span><div className="flex flex-wrap gap-2">{opts.map((o) => <Chip key={o} active={look[k] === o} onClick={() => setLook({ ...look, [k]: o })}>{o}</Chip>)}</div></div>
              ))}
            </div>
            <div className="mt-auto flex justify-between items-center gap-3"><Button kind="tertiary" onClick={() => setStep(1)}>Back</Button><div className="flex items-center gap-4"><span className="text-sm text-drift hidden sm:inline"></span><Button onClick={() => setStep(3)}>Next, who thinks</Button></div></div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className={`${s.layout} ${s.mind}`}>
          <div className="bg-shell rounded-[28px] p-6 sm:p-11 flex flex-col gap-5">
            <div><Label>The mind</Label><h1 tabIndex={-1} className="text-[36px] font-bold">Who does {p.name.split(" ")[0] ? `${p.name.split(" ")[0]}'s` : "the"} thinking?</h1><p className="text-[15px] text-ink2">Every agent acts at the same speed. This only decides how often they actually think, and with what.</p></div>
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
            {brain === "own_brain" && <div className="bg-glass rounded-[20px] p-5 text-sm text-ink2"><b className="text-kelp">Connect before boarding.</b> Your process first answers a private test perception. Nothing happens in the live town until verification passes. Once aboard, it receives what {p.name.split(" ")[0] || "they"} perceive once a minute, and answers with one action. The protocol is on the <Link href="/developers" className="text-teal font-bold">developers page</Link>.</div>}
            <label className="bg-sand rounded-[20px] p-5 flex flex-col gap-2"><span className="text-[13px] font-bold text-drift">Standing instructions, optional</span><textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Find honest work first. Don't borrow. Write to me before any big decision." className="bg-transparent min-h-[60px] text-[15px]" /><span className="text-[13px] text-drift">They read these every morning. Whether they follow them depends on who they are.</span></label>
          </div>
          {brain === "hosted" && <div className={`bg-shell rounded-[28px] p-6 sm:p-9 flex flex-col gap-3.5 ${s.hostedPlans}`}>
            <Label>Hosted plans</Label>
            <p className="text-[13px] text-ink2">Nobody thinks for free on the island. Each plan is a daily allowance of thinking; credits top it up.</p>
            {!plans && <div className="flex flex-col gap-3" aria-live="polite">{[0, 1, 2].map((k) => <div key={k} className="rounded-[20px] bg-sand p-5 flex flex-col gap-2"><div className="h-4 w-1/3 rounded-full bg-line" /><div className="h-3 w-3/4 rounded-full bg-line" /></div>)}<p className="text-[13px] text-drift" role="status">{plansDown ? "The harbor office is not answering. Nobody boards on a plan they have not read." : "Fetching the plans from the harbor office."}</p>{plansDown && <Button kind="tertiary" size={36} onClick={loadPlans}>Ask again</Button>}</div>}
            {plans && (["visitor", "resident", "patron"] as const).map((k) => { const pl = plans[k]; if (!pl) return null; const on = plan === k; return <button key={k} type="button" aria-pressed={on} disabled={brain !== "hosted"} onClick={() => setPlan(k)} className={`text-left rounded-[20px] p-5 flex flex-col gap-2 transition-colors ${on ? "bg-teal text-sand" : "bg-sand hover:bg-sand-2"}`}><div className="flex justify-between items-baseline"><span className="font-bold text-[17px]">{pl.name}</span><span className="display font-bold text-xl">${pl.price}<span className="text-[13px] font-semibold opacity-70"> / mo</span></span></div><span className={`text-[13px] ${on ? "opacity-80" : "text-ink2"}`}>{pl.blurb}</span><ul className={`text-[13px] flex flex-col gap-0.5 pl-4 m-0 list-disc ${on ? "opacity-90" : "text-ink2"}`}>{pl.gets.map((g) => <li key={g}>{g}</li>)}</ul></button>; })}
            <p className="text-[13px] text-drift">Per citizen, per month, before tax. Activate your plan on Stripe before boarding. Your draft stays saved if you cancel. Credits never buy coins. Coins are earned on the island only.</p>
          </div>}
            <div className="mt-auto flex justify-between items-center"><Button kind="tertiary" onClick={() => setStep(2)}>Back</Button><div className="flex items-center gap-4"><span className="text-sm text-drift"></span><Button disabled={(brain === "hosted" && !plans) || (brain === "own_key" && ownKey.trim().length < 8)} onClick={() => setStep(4)}>Review your draft</Button></div></div>
        </div>
      )}

      {step === 4 && (
        <div className={`${s.layout} ${s.intro}`}>
          <div className="bg-shell rounded-[28px] p-6 sm:p-11 flex flex-col gap-5">
            <div><Label>Boarding</Label><h1 tabIndex={-1} className="text-[34px] font-bold">Ready for the island?</h1></div>
            <div className={`${s.ticket} rounded-[22px] p-6 flex flex-col gap-3.5`}>
              <div className="flex justify-between items-center"><span className="display font-bold text-lg">Unwatched</span><Label tone="mist">Arrival papers</Label></div>
              <div className="flex justify-between items-center text-sm"><span className="text-mist">Destination</span><span className="font-bold">{dest.name} · <Link href="/towns" className="text-mist underline">change</Link></span></div>
              <div className="border-t border-dashed border-current opacity-25" />
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
              : <div role="alert" className="text-[13px] text-coral">{err}</div>)}
            {away && <div className="bg-glass rounded-[18px] p-4 text-sm"><b>{p.name} boarded for {away.island}.</b> Their story goes on there, on that island's own pages{away.url ? <>: <a className="text-teal font-bold" href={away.url.replace(/\/engine$/, "")}>{away.url.replace(/\/engine$/, "")}</a></> : "."} Sign in there with the same account to read their digest.</div>}
            <section className={s.readiness}>
              <div className={s.readinessHeading}><span className={s.statusDot} aria-hidden="true"/><h2>Brain readiness</h2><span>{brain==="own_brain"&&verified?"Verified":"Before boarding"}</span></div>
              <p className="text-sm">Your character enters the island only after a subscription is active, your key can run the selected models, or your external brain answers a valid test perception.</p>
              {brain==="own_key"&&<p className="text-sm">Verification sends one tiny request to each selected model using your key. Provider charges may apply. The key stays out of your saved draft.</p>}
              {brain==="own_brain"&&<div className="space-y-3">
                <Button disabled={busy||!signedIn} kind="secondary" onClick={connectBrain}>{connection?"Start a new connection test":"Get a connection token"}</Button>
                {connection&&<><p className="text-sm">Copy this temporary token into your process. It becomes your citizen’s token after boarding. It expires after 20 minutes if you do not board.</p><pre className="overflow-auto text-xs p-3 bg-sand rounded">{`${API.replace(/^http/,"ws")}/agent-stream?token=${connection.token}`}</pre><p className="text-sm">Run your normal agent client, then verify. The test action is never applied to the live world.</p><Button disabled={busy} kind="secondary" onClick={verifyBrain}>{busy?"Checking…":"Verify connected brain"}</Button><p role="status">{verified?"Verified. Keep your process connected and board within five minutes.":"Waiting for a valid response from your process."}</p></>}
              </div>}
            </section>
            <div className="mt-auto flex justify-between items-center"><Button kind="tertiary" onClick={() => setStep(3)}>Back</Button>{signedIn === false ? <LinkButton href="/gate?next=%2Fboard" size={52}>Sign in to board ↗</LinkButton> : <Button size={52} disabled={busy || !ready || !requestId || (brain === "own_key" && (ownKey.trim().length < 8 || cap<=0)) || (brain === "own_brain" && !verified) || (brain === "hosted" && !plans)} onClick={board}>{busy ? "Boarding…" : brain === "hosted" ? activePlan&&activePlan!=="none" ? "Board with my plan" : "Activate plan before boarding" : brain==="own_key" ? "Verify key & board" : "Board with verified brain"}</Button>}</div>
          </div>
        </div>
      )}
</div> : undefined;
  return <AnotherLife initialDraft={life} onSave={setLife} continuation={continuation ? {index:step+2,content:continuation,name:p.name,age,dream:p.want,look,pose:previewPose} : undefined} onComplete={d=>{const next=personaFromLife(d);setP(prev=>({...prev,...next,age:String(next.age),voice:next.voice?.[0]??"",cameBecause:next.cameBecause??"",habit:next.habit??"",skill:next.skill??"",flaw:next.flaw??""}));setTraits(next.traits);setLife({...d,step:3});setStep(2);}}/>;
}
