"use client";
import { useEffect, useState } from "react";
import { Page, Card, Label, Bubble, Button, Dot, LinkButton } from "@/components/ui";
import { Icon } from "@/components/icons";
import { api, apiBlob, clock, type TownEvent } from "@/lib/api";
import { useMyAgent } from "@/lib/useAgent";
import { Portrait } from "@/components/Portrait";
import { Loading, SignedOut, NoAgent } from "@/components/states";

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
  async function saveInstr() { if (!agent || instr === null) return; try { await api(`/api/agents/${agent.id}/instructions`, { method: "PUT", body: JSON.stringify({ text: instr }) }); setSavedInstr("Saved. Read tomorrow morning."); setTimeout(() => setSavedInstr(null), 3000); } catch (e) { setSavedInstr((e as Error).message); } }
  async function load() {
    if (!agent) return;
    const evs = await api<TownEvent[]>(`/api/agents/${agent.id}/events?since=0`);
    const fromAgent = evs.filter((e) => e.kind === "agent.letter").map((e) => ({ t: e.t, mine: false, text: String(e.payload?.text ?? e.text), id: e.id }));
    const toAgent = agent.letters.map((l) => ({ t: l.t, mine: true, text: l.text }));
    setThread([...fromAgent, ...toAgent].sort((a, b) => a.t - b.t));
  }
  useEffect(() => { void load(); }, [agent]);
  async function send() {
    if (!agent || !draft.trim()) return; setBusy(true);
    try { await api(`/api/agents/${agent.id}/letters`, { method: "POST", body: JSON.stringify({ text: draft.trim() }) }); setThread((t) => [...t, { t: Date.now() / 60000 | 0, mine: true, text: draft.trim() }]); setTimeout(() => setDraft(""), 400); setToast(`Sent. ${agent.name.split(" ")[0]} reads it in the morning.`); setTimeout(() => setToast(null), 4000); }
    catch (e) { setToast("The letter did not go. " + (e as Error).message); }
    setBusy(false);
  }
  if (reason === "signed-out") return <Page><SignedOut what="Letters go to your own agent. Sign in to write one." /></Page>;
  if (reason === "none") return <Page><NoAgent what="Letters go to your own agent. Send someone to the island first." /></Page>;
  if (!agent) return <Page><Loading what="Fetching the post." /></Page>;
  const first = agent.name.split(" ")[0];
  return (
    <Page>
      <div className="grid gap-5 grow grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="bg-shell rounded-card p-4 sm:p-7 flex flex-col gap-3 min-h-[520px]">
          <div className="flex justify-between items-center border-b border-line pb-3"><div className="flex items-center gap-3"><Portrait locked={agent.perks === false} name={agent.name} appearance={agent.appearance} age={agent.age} size={44} /><div><div className="display text-[22px] font-semibold">{agent.name}</div><div className="text-[13px] text-drift">at {agent.place} · {agent.coins} coins · reads letters in the morning</div></div></div><LinkButton href="/town" kind="secondary" size={36}>Visit</LinkButton></div>
          <div className="flex flex-col gap-3.5 grow">
            {thread.length === 0 && <p className="text-drift text-sm">{agent.budget.tier2Max === 0 ? <>Nothing yet, and on this plan nothing will come: a letter home takes a careful decision, and the plan carries none. You can still write; {first} reads it in the morning. <a href="/account/credits" className="font-bold text-teal">Change the plan</a> and {first} can write back.</> : agent.budget.tier2Max === 1 ? <>Nothing yet. {first} has one careful decision a day, so a letter home is possible but rare. You can write first, if you want them to know something.</> : <>Nothing yet. {first} writes when it matters. You can write first, if you want them to know something.</>}</p>}
            {thread.map((m, i) => <div key={i} className={`flex flex-col gap-1 ${m.mine ? "items-end" : "items-start"} ${m.mine && i === thread.length - 1 ? "land" : ""}`}><div className="text-[11px] text-drift">{m.mine ? "you" : first}</div><Bubble mine={m.mine} max={560}>{m.mine ? m.text : `“${m.text}”`}</Bubble>{!m.mine && voices && m.id !== undefined && agent.perks === false && i === thread.length - 1 && <span className="text-[12px] text-drift">Read aloud in {first}'s voice on the Resident and Patron plans.</span>}{!m.mine && voices && m.id !== undefined && agent.perks !== false && <button onClick={() => void hear(m.id!)} disabled={hearing === m.id} className="text-[12px] font-bold text-teal hover:underline disabled:opacity-60">{hearing === m.id ? `${first} is reading…` : `Hear it in ${first}'s voice`}</button>}</div>)}
            {voiceErr && <p className="text-xs text-coral">{voiceErr}</p>}
          </div>
          <div className="flex flex-col gap-2 mt-auto"><textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={`Write to ${first}. Advice, not orders.`} className="rounded-[20px] bg-sand px-[18px] py-3.5 min-h-[88px] text-[15px]" /><div className="flex justify-between items-center"><span className="text-xs text-drift">{toast ?? `Advice, not orders. ${first} decides.`}</span><Button disabled={busy || !draft.trim()} onClick={send}><Icon name="send" size={20} />Send the letter</Button></div></div>
        </div>
        <div className="flex flex-col gap-4">
        <Card><div className="flex justify-between items-baseline"><Label>Standing instructions</Label><span className="text-xs text-drift">Read every morning</span></div><textarea value={instr ?? String((agent as unknown as { instructions?: string }).instructions ?? "")} onChange={(e) => setInstr(e.target.value)} placeholder="Find honest work first. Don't borrow. Write to me before any big decision." className="rounded-[18px] bg-sand px-4 py-3 min-h-[100px] text-[15px]" /><p className="text-[13px] text-drift">Whether {first} follows these depends on who they are. Changing them often makes them trust you less.</p><div className="flex items-center justify-between"><span className="text-xs text-drift">{savedInstr ?? ""}</span><Button kind="secondary" size={36} disabled={instr === null} onClick={saveInstr}>Save instructions</Button></div></Card>
        {agent.plan && <Card tone="glass"><div className="flex justify-between items-baseline"><Label tone="teal">{first}'s plan for today</Label><span className="text-xs text-teal">{agent.plan.mood}</span></div>{agent.plan.goals.map((g, k) => <div key={k} className="text-[15px] font-semibold">{g}</div>)}<div className="flex flex-col gap-1">{agent.plan.steps.map((st, k) => <div key={k} className={`grid gap-x-2.5 items-center text-sm ${st.done ? "text-drift" : ""}`} style={{ gridTemplateColumns: "44px 1fr" }}><span className="tabular">{String(st.hour).padStart(2, "0")}:00</span><span className={st.done ? "line-through" : ""}>{st.do}</span></div>)}</div></Card>}
          <Card><div className="flex justify-between items-baseline"><Label>What {first} intends</Label><span className="text-xs text-drift">from last night</span></div>{agent.intentions.length ? agent.intentions.map((i, k) => <div key={k} className="flex items-center gap-2.5 text-[15px]"><Dot />{i}</div>) : <p className="text-sm text-drift">No intentions yet. The first reflection is written after midnight.</p>}<Label>Recent memories</Label><div className="flex flex-col gap-1.5 text-sm text-ink2 max-h-[420px] overflow-auto">{agent.memories.slice(0, 20).map((m, k) => <div key={k}><span className="text-drift tabular">{clock(m.t)}</span> · {m.text}</div>)}</div></Card>
        </div>
      </div>
    </Page>
  );
}
