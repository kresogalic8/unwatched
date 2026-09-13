"use client";
import { useEffect, useState } from "react";
import { Dot } from "@/components/ui";
import { Label, Button, LinkButton } from "@/components/explore/ExplorePage";
import { DigestLayout as Page, DigestSection as Card, DigestState } from "@/components/digest/DigestLayout";
import s from "./letters.module.css";
import { Icon } from "@/components/icons";
import { api, apiBlob, clock, type TownEvent } from "@/lib/api";
import { useMyAgent } from "@/lib/useAgent";
import { Portrait } from "@/components/Portrait";


export default function Letters() {
  const { agent, reason } = useMyAgent();
  const [thread, setThread] = useState<{ t: number; mine: boolean; text: string; id?: number }[]>([]);
  const [voices, setVoices] = useState(false); const [hearing, setHearing] = useState<number | null>(null); const [voiceErr, setVoiceErr] = useState<string | null>(null);
  useEffect(() => { void api<{ voices?: boolean }>("/api/town").then((c) => setVoices(!!c.voices)).catch(() => {}); }, []);
  async function hear(id: number) {
    setHearing(id); setVoiceErr(null);
    try { const blob = await apiBlob(`/api/events/${id}/voice`); const url = URL.createObjectURL(blob); const audio = new Audio(url); audio.onended = () => { setHearing(null); URL.revokeObjectURL(url); }; await audio.play(); }
    catch (e) { setVoiceErr((e as Error).message); setHearing(null); }
  }
  const [draft, setDraft] = useState(""); const [busy, setBusy] = useState(false); const [toast, setToast] = useState<string | null>(null);
  const [instr, setInstr] = useState<string | null>(null); const [savedInstr, setSavedInstr] = useState<string | null>(null);
  const [savingInstr, setSavingInstr] = useState(false);
  async function saveInstr() { if (!agent || instr === null || savingInstr) return; setSavingInstr(true); try { await api(`/api/agents/${agent.id}/instructions`, { method: "PUT", body: JSON.stringify({ text: instr }) }); setSavedInstr("Saved. Read tomorrow morning."); setTimeout(() => setSavedInstr(null), 3000); } catch (e) { setSavedInstr((e as Error).message); } finally { setSavingInstr(false); } }
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  async function load() {
    if (!agent) return;
    setLoading(true); setLoadError(false);
    try {
    const evs = await api<TownEvent[]>(`/api/agents/${agent.id}/events?since=0`);
    const fromAgent = evs.filter((e) => e.kind === "agent.letter").map((e) => ({ t: e.t, mine: false, text: String(e.payload?.text ?? e.text), id: e.id }));
    const toAgent = agent.letters.map((l) => ({ t: l.t, mine: true, text: l.text }));
    setThread([...fromAgent, ...toAgent].sort((a, b) => a.t - b.t));
    } catch { setLoadError(true); } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [agent]);
  async function send() {
    if (!agent || !draft.trim() || busy) return; setBusy(true);
    try { await api(`/api/agents/${agent.id}/letters`, { method: "POST", body: JSON.stringify({ text: draft.trim() }) }); setThread((t) => [...t, { t: Date.now() / 60000 | 0, mine: true, text: draft.trim() }]); setDraft(""); setToast(`Sent. ${agent.name.split(" ")[0]} reads it in the morning.`); setTimeout(() => setToast(null), 4000); }
    catch (e) { setToast("The letter did not go. " + (e as Error).message); }
    setBusy(false);
  }
  if (reason === "signed-out") return <Page active="letters"><DigestState title="A letter starts with someone." href="/gate?next=%2Fletters" action="Sign in">Sign in to write to your citizen.</DigestState></Page>;
  if (reason === "none") return <Page active="letters"><DigestState title="Someone to write to." href="/board" action="Send someone over">Give a citizen a personality and send them to the island first.</DigestState></Page>;
  if (!agent) return <Page active="letters"><DigestState title="Fetching the post…"><p role="status">Opening your correspondence.</p></DigestState></Page>;
  const first = agent.name.split(" ")[0];
  return (
    <Page name={agent.name} active="letters">
      <header className={s.hero}><Label>Your correspondence</Label><h1>Letters across the water.</h1><p>A few words from you. A life of their own.</p></header>
      <div className={s.layout}>
        <div className={s.correspondence}>
          <div className={s.recipient}><div className="flex items-center gap-3"><Portrait locked={agent.perks === false} name={agent.name} appearance={agent.appearance} age={agent.age} size={44} /><div><div className="display text-[22px] font-semibold">{agent.name}</div><div className="text-[13px] text-drift">at {agent.place} · {agent.coins} coins · reads letters in the morning</div></div></div><LinkButton href="/town" kind="secondary" size={36}>Visit</LinkButton></div>
          <div className={s.thread}>
            {loading && <p role="status" className={s.empty}>Fetching your letters…</p>}
            {loadError && <div className={s.empty} role="alert"><p>Your letters couldn’t be loaded.</p><Button kind="secondary" onClick={() => void load()}>Try again</Button></div>}
            {!loading && !loadError && thread.length === 0 && <div className={s.empty}><h2>The first word can be yours.</h2><p>{agent.budget.tier2Max === 0 ? <>Nothing yet, and on this plan nothing will come: a letter home takes a careful decision, and the plan carries none. You can still write; {first} reads it in the morning. <a href="/account/credits" className="font-bold text-teal">Change the plan</a> and {first} can write back.</> : agent.budget.tier2Max === 1 ? <>Nothing yet. {first} has one careful decision a day, so a letter home is possible but rare. You can write first, if you want them to know something.</> : <>Nothing yet. {first} writes when it matters. You can write first, if you want them to know something.</>}</p></div>}
            {thread.map((m, i) => <div key={i} className={`flex flex-col gap-1 ${m.mine ? "items-end" : "items-start"} ${m.mine && i === thread.length - 1 ? "land" : ""}`}><div className="text-[11px] text-drift">{m.mine ? "you" : first}</div><p className={m.mine ? s.sentLetter : s.receivedLetter}>{m.mine ? m.text : `“${m.text}”`}</p>{!m.mine && voices && m.id !== undefined && agent.perks === false && i === thread.length - 1 && <span className="text-[12px] text-drift">Read aloud in {first}'s voice on the Resident and Patron plans.</span>}{!m.mine && voices && m.id !== undefined && agent.perks !== false && <button onClick={() => void hear(m.id!)} disabled={hearing === m.id} className="text-[12px] font-bold text-teal hover:underline disabled:opacity-60">{hearing === m.id ? `${first} is reading…` : `Hear it in ${first}'s voice`}</button>}</div>)}
            {voiceErr && <p className="text-xs text-coral">{voiceErr}</p>}
          </div>
          <div className={s.composer}><label htmlFor="letter-draft">Write to {first}</label><textarea id="letter-draft" disabled={busy} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={`Write to ${first}. Advice, not orders.`} className={s.input} /><div className={s.composerActions}><span role="status" className="text-xs text-drift">{toast ?? `Advice, not orders. ${first} decides.`}</span><Button disabled={busy || !draft.trim()} onClick={send}><Icon name="send" size={20} />{busy ? "Sending…" : "Send the letter"}</Button></div></div>
        </div>
        <div className={s.sidebar}>
        <Card><div className="flex justify-between items-baseline"><label htmlFor="standing-instructions" className={s.label}>Standing instructions</label><span className="text-xs text-drift">Read every morning</span></div><textarea id="standing-instructions" value={instr ?? String((agent as unknown as { instructions?: string }).instructions ?? "")} onChange={(e) => setInstr(e.target.value)} placeholder="Find honest work first. Don't borrow. Write to me before any big decision." className={s.input} /><p className="text-[13px] text-drift">Whether {first} follows these depends on who they are. Changing them often makes them trust you less.</p><div className="flex items-center justify-between"><span role="status" className="text-xs text-drift">{savedInstr ?? ""}</span><Button kind="secondary" size={36} disabled={instr === null || savingInstr} onClick={saveInstr}>{savingInstr ? "Saving…" : "Save instructions"}</Button></div></Card>
        {agent.plan && <Card tone="glass"><div className="flex justify-between items-baseline"><Label tone="teal">{first}'s plan for today</Label><span className="text-xs text-teal">{agent.plan.mood}</span></div>{agent.plan.goals.map((g, k) => <div key={k} className="text-[15px] font-semibold">{g}</div>)}<div className="flex flex-col gap-1">{agent.plan.steps.map((st, k) => <div key={k} className={`grid gap-x-2.5 items-center text-sm ${st.done ? "text-drift" : ""}`} style={{ gridTemplateColumns: "44px 1fr" }}><span className="tabular">{String(st.hour).padStart(2, "0")}:00</span><span className={st.done ? "line-through" : ""}>{st.do}</span></div>)}</div></Card>}
          <Card><div className="flex justify-between items-baseline"><Label>What {first} intends</Label><span className="text-xs text-drift">from last night</span></div>{agent.intentions.length ? agent.intentions.map((i, k) => <div key={k} className="flex items-center gap-2.5 text-[15px]"><Dot />{i}</div>) : <p className="text-sm text-drift">No intentions yet. The first reflection is written after midnight.</p>}<Label>Recent memories</Label><div className="flex flex-col gap-1.5 text-sm text-ink2 max-h-[420px] overflow-auto">{agent.memories.slice(0, 20).map((m, k) => <div key={k}><span className="text-drift tabular">{clock(m.t)}</span> · {m.text}</div>)}</div></Card>
        </div>
      </div>
    </Page>
  );
}
