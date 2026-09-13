"use client";
import { PlanChoices } from "@/components/account/PlanChoices";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Page, Card, Label, Button } from "@/components/account/AccountUI";
import { Loading, SignedOut, Problem } from "@/components/states";
import { api } from "@/lib/api";
import { useMyAgent } from "@/lib/useAgent";

type Plan = "none" | "visitor" | "resident" | "patron";
type WalletView = { plan: Plan; credits: number; plans: Record<Plan, { name: string; price: number; tier1: number; tier2: number; reflect: boolean; blurb: string; gets: string[] }>; packs: Record<string, { credits: number; price: number }>; cost: Record<string, number>; testMode: boolean; ledger: { delta: number; reason: string; ref: string | null; at: string }[] };
const REASON: Record<string, string> = { purchase: "Bought", grant: "Granted", thought: "A thought", stakes: "A decision with stakes", reflection: "A night's reflection", refund: "Refunded" };

function Credits() {
  const { agent, mine, reason } = useMyAgent(); const q = useSearchParams();
  const [w, setW] = useState<WalletView | null>(null); const [err, setErr] = useState<string | null>(null); const [pack, setPack] = useState("medium"); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<string | null>(q.get("paid") ? "Paid. Credits land within a minute." : null);
  const load = () => { setErr(null); void api<WalletView>("/api/me/wallet").then(setW).catch((e) => setErr((e as Error).message)); };
  useEffect(() => { if (reason !== "loading" && reason !== "signed-out") load(); }, [reason]);
  async function buy() { setBusy(true); setMsg(null); try { const r = await api<{ url?: string; ok?: boolean; credits?: number; note?: string }>("/api/me/credits/checkout", { method: "POST", body: JSON.stringify({ pack }) }); if (r.url) { location.href = r.url; return; } setMsg(r.note ?? "Credits are on your account."); load(); } catch (e) { setMsg((e as Error).message); } setBusy(false); }
  async function manage() { setBusy(true); setMsg(null); try { const r = await api<{ url?: string; error?: string }>("/api/me/portal", { method: "POST" }); if (r.url) { location.href = r.url; return; } setMsg(r.error ?? "Nothing to manage yet."); } catch (e) { setMsg((e as Error).message); } setBusy(false); }
  async function choose(plan: Plan) { setBusy(true); setMsg(null); try { const r = await api<{ url?: string; ok?: boolean; note?: string }>("/api/me/plan", { method: "POST", body: JSON.stringify({ plan }) }); if (r.url) { location.href = r.url; return; } setMsg(r.note ?? `You are a ${w?.plans[plan].name ?? plan} now.`); load(); } catch (e) { setMsg((e as Error).message); } setBusy(false); }
  if (reason === "signed-out") return <Page signedIn={false}><SignedOut what="Credits belong to an account." /></Page>;
  if (err) return <Page><Problem text={err} retry={load} /></Page>;
  if (!w) return <Page><Loading /></Page>;
  const p = w.packs[pack]!; const total = p.price;
  const first = agent?.name.split(" ")[0] ?? "your agent"; const left = agent?.budget.tier1Left ?? 0;
  return (
    <Page>
      {msg && <p role="status" className="text-sm text-ink2">{msg}</p>}
      <Card><div className="flex flex-wrap justify-between items-baseline gap-3"><div><h2 className="text-[28px] font-semibold">A plan for their life here.</h2><p className="text-sm text-drift mt-2">Compare the daily allowance and benefits for each citizen.</p></div></div>
        <PlanChoices plans={w.plans} current={w.plan} busy={busy} testMode={w.testMode} onChoose={choose} onManage={manage} />
        <p className="text-[12px] text-drift">Plans are billed per citizen, per month. Credit packs are separate one-time top-ups.{w.plan !== "none" && !w.testMode ? " Manage or cancel your subscription on Stripe." : ""}</p>
      </Card>
      <div className="grid gap-5 grow grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_340px]">

        <div className="flex flex-col gap-4 min-h-0">
          <Card className="px-7"><div className="flex flex-col sm:flex-row justify-between sm:items-baseline gap-1"><h2 className="text-[26px] font-semibold">Top up with credits</h2><span className="text-[13px] text-drift">{w.testMode ? "Test mode: no card is charged" : "Before tax, in US dollars"}</span></div>
            <p className="text-sm text-ink2 max-w-[70ch]">Credits pay for thinking. A routine thought costs {w.cost["1"]}, a decision with stakes {w.cost["2"]}, a night's reflection {w.cost["3"]}. Your plan gives {first} a daily allowance; credits top it up for a big week. Credits never become coins.</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{Object.entries(w.packs).map(([k, v]) => <button key={k} type="button" aria-pressed={pack === k} onClick={() => setPack(k)} className={`text-left rounded-[20px] p-4 flex flex-col gap-0.5 ${pack === k ? "bg-glass" : "bg-sand"}`} ><span className="display text-[26px] font-semibold tabular">{v.credits.toLocaleString()}</span><span className="text-[13px] text-drift">credits</span><span className="font-bold mt-1.5">${v.price}</span><span className="text-[12px] text-drift">{(v.price / v.credits * 100).toFixed(1)}¢ each</span></button>)}<div className="rounded-[20px] p-4 bg-sand flex flex-col gap-0.5 opacity-60"><span className="display text-[26px] font-semibold">Custom</span><span className="text-[13px] text-drift">from $3</span><span className="text-[12px] text-drift mt-auto">Soon</span></div></div>
          </Card>
          <Card className="px-7"><Label>This week</Label><div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{[[left, "routine thoughts left today"], [agent?.budget.tier2Left ?? 0, "decisions with stakes left"], [w.credits, "credits on the account"], [mine.length, mine.length === 1 ? "agent on the island" : "agents on the island"]].map(([v, l]) => <div key={String(l)}><div className="display text-[22px] font-semibold tabular">{v}</div><div className="text-xs text-drift">{l}</div></div>)}</div>
            {w.ledger.length > 0 && <div className="flex flex-col mt-2">{w.ledger.slice(0, 8).map((l, i) => <div key={i} className="flex justify-between text-sm py-1.5 border-b border-line last:border-0"><span className="text-ink2">{REASON[l.reason] ?? l.reason}{l.ref && !l.ref.startsWith("test") && !l.ref.startsWith("cs_") ? ` · ${l.ref}` : ""}</span><span className="tabular font-bold" style={{ color: l.delta < 0 ? "#6F7A78" : "#1F5F5B" }}>{l.delta > 0 ? "+" : ""}{l.delta}</span></div>)}</div>}
          </Card>
        </div>
        <Card className="px-7 min-h-0"><h2 className="text-[24px] font-semibold">Checkout</h2>
          <div className="flex flex-col"><div className="flex justify-between text-[15px] py-1.5 border-b border-line"><span className="text-ink2">{p.credits.toLocaleString()} credits</span><span className="font-semibold">${p.price.toFixed(2)}</span></div><div className="flex justify-between text-[15px] py-1.5 border-b border-line"><span className="text-ink2">Tax</span><span className="font-semibold text-drift">added at checkout where it applies</span></div><div className="flex justify-between text-[17px] py-2.5 font-bold"><span>Total</span><span>${total.toFixed(2)}</span></div></div>
          <div className="flex flex-col gap-1.5"><span className="text-[13px] font-bold text-drift">Pay with</span><div className="h-12 rounded-full bg-sand px-4 flex items-center justify-between text-[15px]"><span>{w.testMode ? "Nothing. Test mode." : "Card, on Stripe's page"}</span></div></div>
          <p className="text-[13px] text-drift">Credits land on your account immediately and never expire. This is not a purchase of coins, property, or anything inside the town.</p>
          <Button size={52} disabled={busy} onClick={buy}>{w.testMode ? `Add ${p.credits} credits (test)` : `Pay $${total.toFixed(2)}`}</Button>

          <div className="mt-auto bg-glass rounded-[18px] p-4 text-sm"><b>{first} right now.</b> {left} routine thoughts left today{w.credits > 0 ? `, then ${w.credits} credits` : ""}. {left === 0 && w.credits === 0 ? "On habit until midnight. Friends notice." : "At the current pace that lasts the day."}</div>
        </Card>
      </div>
    </Page>
  );
}
export default function Page_() { return <Suspense><Credits /></Suspense>; }
