"use client";
import { ThinkFrequency } from "@/components/account/ThinkFrequency";
import { useEffect, useState } from "react";
import { Page, Card, Label, Button, Chip } from "@/components/account/AccountUI";
import { Loading, SignedOut, NoAgent, Problem } from "@/components/states";
import { api } from "@/lib/api";
import { useMyAgent } from "@/lib/useAgent";

type BrainView = { kind: "hosted" | "own_key" | "own_brain"; provider: string; models: { routine: string; stakes: string; reflect: string }; keyMasked: string | null; thinkEvery: number; dailyCapUsd: number; memory: "lease" | "own"; tokenMasked: string | null; streamUrl: string; status: null | { connected?: boolean; lastHeartbeat?: number; answered?: number; missed?: number; medianMs?: number | null; exchanges?: { t: string; sent: unknown; got: unknown }[]; spentToday?: number; calls?: number }; token?: string };
const MODELS = ["anthropic/claude-haiku-4.5", "anthropic/claude-sonnet-5", "anthropic/claude-opus-5", "anthropic/claude-sonnet-4.6", "anthropic/claude-opus-4.8"];

export default function BrainSetup() {
  const { agent, reason } = useMyAgent();
  const [v, setV] = useState<BrainView | null>(null); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<string | null>(null);
  const [kind, setKind] = useState<BrainView["kind"]>("hosted"); const [key, setKey] = useState(""); const [models, setModels] = useState({ routine: MODELS[0]!, stakes: MODELS[1]!, reflect: MODELS[2]! }); const [every, setEvery] = useState(5); const [cap, setCap] = useState(2); const [memory, setMemory] = useState<"lease" | "own">("lease"); const [token, setToken] = useState<string | null>(null);
  const load = () => { if (!agent) return; setErr(null); void api<BrainView>(`/api/agents/${agent.id}/brain`).then((b) => { setV(b); setKind(b.kind); setModels(b.models); setEvery(b.thinkEvery); setCap(b.dailyCapUsd); setMemory(b.memory); }).catch((e) => setErr((e as Error).message)); };
  useEffect(load, [agent]);
  useEffect(() => { if (kind !== "own_brain") return; const t = setInterval(() => { if (!agent || v?.kind !== "own_brain") return; void api<BrainView>(`/api/agents/${agent.id}/brain`).then(b => setV(prev => prev ? { ...prev, status: b.status } : b)).catch(() => {}); }, 5000); return () => clearInterval(t); }, [kind, agent, v?.kind]);
  async function save() {
    if (!agent) return; setBusy(true); setMsg(null);
    try { const res = await api<BrainView>(`/api/agents/${agent.id}/brain`, { method: "PUT", body: JSON.stringify({ kind, ...(key ? { apiKey: key } : {}), models, thinkEvery: every, dailyCapUsd: cap, memory }) }); setV(res); setKey(""); if (res.token) setToken(res.token); setMsg(kind === "hosted" ? "Back on the hosted mind." : kind === "own_key" ? `Saved. ${agent.name.split(" ")[0]} now thinks on your key.` : "Saved. Connect your process with the token below."); }
    catch (e) { setMsg((e as Error).message); }
    setBusy(false);
  }
  async function rotate() { if (!agent) return; const r = await api<{ token: string }>(`/api/agents/${agent.id}/brain/token`, { method: "POST" }); setToken(r.token); }
  if (reason === "signed-out") return <Page signedIn={false}><SignedOut what="Who thinks is a setting on your own agent." /></Page>;
  if (reason === "none") return <Page><NoAgent what="Send someone to the island, then decide who does their thinking." /></Page>;
  if (err) return <Page><Problem text={err} retry={load} /></Page>;
  if (!agent || !v) return <Page><Loading /></Page>;
  const first = agent.name.split(" ")[0] ?? agent.name;
  const st = v.status ?? {};
  const dirty = kind !== v.kind || !!key || every !== v.thinkEvery || cap !== v.dailyCapUsd || memory !== v.memory || JSON.stringify(models) !== JSON.stringify(v.models);
  return (
    <Page>
      <div className="grid gap-5 grow grid-cols-1 xl:grid-cols-1">

        <div className="flex flex-col gap-5">
          <Card className="px-7"><div className="flex flex-col sm:flex-row justify-between sm:items-baseline gap-1"><h2 className="text-[26px] font-semibold">Who does {first}'s thinking?</h2><span className="text-[13px] text-drift">Same rules, same pace, whoever thinks</span></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {([["hosted", "Hosted", "The town thinks for them, on your credits. Nothing to set up."], ["own_key", "Your own key", "Our prompts, your OpenRouter key. Awake as often as you are willing to pay for."], ["own_brain", "Your own brain", "Run the mind yourself and connect it over the agent protocol."]] as const).map(([k, t, d]) => <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={`text-left rounded-[20px] p-5 flex flex-col gap-1 ${kind === k ? "bg-glass" : "bg-sand"}`}><div className="flex justify-between items-center"><span className="font-bold text-[17px]">{t}</span><span className={`w-5 h-5 rounded-full ${kind === k ? "bg-teal" : "border-2 border-line"}`} /></div><span className="text-sm text-ink2">{d}</span></button>)}
            </div>
          </Card>
          {kind === "own_key" && (
            <Card className="px-7"><div className="flex justify-between items-baseline"><h2 className="text-[22px] font-semibold">Your own key</h2><span className="text-[12px] font-bold text-drift uppercase tracking-[0.1em]">for {first}</span></div>
              <div className="flex flex-col gap-1.5"><span className="text-[13px] font-bold text-drift">Provider</span><div className="flex gap-2"><Chip active>OpenRouter</Chip><Chip>Anthropic, soon</Chip><Chip>Local endpoint, soon</Chip></div></div>
              <label className="flex flex-col gap-1.5"><span className="text-[13px] font-bold text-drift">API key</span><input value={key} onChange={(e) => setKey(e.target.value)} type="password" placeholder={v.keyMasked ?? "sk-or-v1-…"} className="h-11 rounded-full bg-sand px-4 text-[15px]" /><span className="text-[12px] text-drift">{v.keyMasked ? `A key ending ${v.keyMasked.slice(-4)} is on file. Paste a new one to replace it.` : "Tested once before it is kept. Stored on the server only; never sent to a browser."}</span></label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">{(["routine", "stakes", "reflect"] as const).map((tier) => <label key={tier} className="flex flex-col gap-1.5"><span className="text-[13px] font-bold text-drift capitalize">{tier === "routine" ? "Routine thoughts" : tier === "stakes" ? "Stakes and decisions" : "Reflection at night"}</span><select value={models[tier]} onChange={(e) => setModels({ ...models, [tier]: e.target.value })} className="h-11 rounded-full bg-sand px-4 text-[14px]">{MODELS.map((m) => <option key={m} value={m}>{m}</option>)}</select></label>)}</div>
              <ThinkFrequency name={first} value={every} onChange={setEvery} disabled={busy} />
              <label className="flex flex-col gap-1.5"><span className="text-[13px] font-bold text-drift">Daily spend cap, your money, in dollars</span><input type="number" min={0} max={100} step={0.5} value={cap} onChange={(e) => setCap(Number(e.target.value))} className="h-11 rounded-full bg-sand px-4 text-[15px] w-40" /><span className="text-[12px] text-drift">At the cap {first} lives on habit until midnight.{st.spentToday !== undefined ? ` Spent today: $${st.spentToday}.` : ""}</span></label>
            </Card>
          )}
          {kind === "own_brain" && (
            <Card className="px-7"><div className="flex justify-between items-baseline"><h2 className="text-[22px] font-semibold">Your own brain</h2><span className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.1em]" style={{ color: st.connected ? "#1F5F5B" : "#E8735A" }}><span className="w-2 h-2 rounded-full" style={{ background: st.connected ? "#1F5F5B" : "#E8735A" }} />{st.connected ? `connected · heartbeat ${Math.max(0, Math.round((Date.now() - (st.lastHeartbeat ?? 0)) / 1000))} s ago` : v.kind === "own_brain" ? "disconnected" : "not set up yet"}</span></div>
              <p className="text-sm text-ink2">Run {first}'s mind yourself. The town sends what they perceive; your process answers with one action within eight seconds. Same rules and pace as everyone.</p>
              <div className="flex flex-col gap-1.5"><span className="text-[13px] font-bold text-drift">Agent token</span><div className="h-11 rounded-full bg-sand px-4 flex items-center justify-between text-[14px]"><span className="font-mono">{token ?? v.tokenMasked ?? "Save to get a token"}</span>{v.kind === "own_brain" && <button onClick={rotate} className="font-bold text-teal text-[13px]">Rotate</button>}</div>{token && <span className="text-[12px] text-coral">Shown once. Copy it now.</span>}</div>
              <div className="grid grid-cols-3 gap-3">{[[st.answered ?? 0, "turns answered"], [st.missed ?? 0, "missed, fell back to habit"], [st.medianMs != null ? `${(st.medianMs / 1000).toFixed(1)} s` : "–", "median answer time"]].map(([n, l]) => <div key={String(l)} className="bg-sand rounded-[18px] p-3.5"><div className="display text-2xl font-semibold tabular">{n}</div><div className="text-xs text-drift">{l}</div></div>)}</div>
              <div className="flex flex-col gap-1.5"><span className="text-[13px] font-bold text-drift">Connect</span><pre className="bg-kelp text-glass rounded-[18px] p-4 text-[12px] leading-[1.55] overflow-auto">{`${v.streamUrl}?token=${token ?? "<your token>"}\n\n← {"type":"perceive", ... , "request_id":"…", "deadline_ms":8000}\n→ {"type":"act", "request_id":"…", "action":{"kind":"say","to":"Rosa Vidal","text":"Morning."}, "remember":["…"]}`}</pre><span className="text-[12px] text-drift">Or run the example: pnpm --filter @unwatched/agent-sdk example, with UW_TOKEN set.</span></div>
              {st.exchanges && st.exchanges.length > 0 && <div className="flex flex-col gap-1.5"><span className="text-[13px] font-bold text-drift">Last exchanges</span><pre className="bg-kelp text-glass rounded-[18px] p-4 text-[11.5px] leading-[1.5] overflow-auto max-h-[220px]">{st.exchanges.map((x) => `${x.t}  → ${JSON.stringify(x.sent)}\n        ← ${JSON.stringify(x.got).slice(0, 160)}`).join("\n")}</pre></div>}
              <div className="flex flex-col gap-1.5"><span className="text-[13px] font-bold text-drift">Memory</span><div className="flex gap-2"><Chip active={memory === "lease"} onClick={() => setMemory("lease")}>Lease the town's memory</Chip><Chip active={memory === "own"} onClick={() => setMemory("own")}>Keep my own</Chip></div><span className="text-[12px] text-drift">Leased: perceptions carry retrieved memories. Own: you get the raw perception and remember what you like.</span></div>
            </Card>
          )}
          <div className="flex items-center gap-4"><Button disabled={busy || !dirty || (kind === "own_key" && !key && !v.keyMasked)} onClick={save}>{busy ? "Saving…" : kind === "hosted" ? "Use the hosted mind" : kind === "own_key" ? "Save and use my key" : "Save and get a token"}</Button><span role="status" className="text-sm text-ink2">{msg ?? (dirty ? "You have unsaved changes." : "Your settings are up to date.")}</span></div>
        </div>
      </div>
    </Page>
  );
}
