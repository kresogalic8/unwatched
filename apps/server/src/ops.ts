import type { AgentState, Brain, ChildContext, ConverseContext, DigestContext, PaperContext, LifeContext, JudgeContext, PlanContext, ReflectContext, Tier } from "@unwatched/engine";
import type { ActionProposal, DayPlan, DigestText, Dialogue, Paper, LifeText, Judgement, Perception, Persona, Reflection } from "@unwatched/protocol";
import type { ProviderUsage } from "@unwatched/cognition";

/** List prices per million tokens, input and output, for when a provider does not say what a call cost. */
const PRICE: Record<string, [number, number]> = { "claude-haiku-4-5": [1, 5], "claude-sonnet-5": [2, 10], "claude-opus-5": [5, 25] };
/** Anything unpriced is counted at a high rate, so an unknown model trips the ceiling early rather than late. */
const UNKNOWN_PRICE: [number, number] = [5, 25];
const priceOf = (model: string) => PRICE[model.toLowerCase().replace(/^anthropic\//, "").replace(/\./g, "-").replace(/-\d{8}$/, "")] ?? UNKNOWN_PRICE;
/** Who pays for a call: the island's own mind, a subscriber's plan (both the operator's bill), or an owner's own key. */
export type Funding = "world" | "subscriber" | "user_key";
/** What a call cost: what the provider billed, or its tokens at the model's list price, cache reads at a tenth. */
export function costOf(u: Pick<ProviderUsage, "model" | "promptTokens" | "completionTokens" | "cachedTokens" | "costUsd">): number {
  if (typeof u.costUsd === "number") return u.costUsd;
  const [i, o] = priceOf(u.model); const fresh = Math.max(0, u.promptTokens - u.cachedTokens);
  return (fresh * i + u.cachedTokens * i * 0.1 + u.completionTokens * o) / 1e6;
}

export interface HourBucket { hour: number; day: number; t1: number; t2: number; t3: number; converse: number; ms: number[]; /** the operator's spend: the world and subscribers */ cost: number; /** owners' own keys, which the ceiling does not count */ userKeyCost: number }

/**
 * Sees every thought the town spends, and what it cost. Wraps the router the engine calls to count the thoughts; the cost comes
 * from every provider call as it is reported (`record`), with what was spent earlier today carried over a restart (`carry`).
 */
export class Metrics implements Brain {
  readonly name: string;
  onAttempt: ((a:AgentState|undefined,kind:string,outcome:string,duration:number,t:number)=>void)|null=null;
  hours: HourBucket[] = [];
  holds: { id: number; level: "hold" | "watch" | "ok"; text: string; at: number; source: string; done: boolean }[] = [];
  private nextHold = 1;
  private carried = new Map<number, number>();
  tickMs: number[] = [];
  constructor(private inner: Brain, private clock: () => { day: number; hour: number; t: number }) { this.name = inner.name; }
  private bucket(): HourBucket {
    const c = this.clock(); let b = this.hours[this.hours.length - 1];
    if (!b || b.hour !== c.hour || b.day !== c.day) { b = { hour: c.hour, day: c.day, t1: 0, t2: 0, t3: 0, converse: 0, ms: [], cost: 0, userKeyCost: 0 }; this.hours.push(b); if (this.hours.length > 48) this.hours.shift(); }
    return b;
  }
  /** One provider call, as its brain reported it. Owners' own keys are kept apart: they are not the operator's to cap. */
  record(u: ProviderUsage, funding: Funding): void { const b = this.bucket(); const c = costOf(u); if (funding === "user_key") b.userKeyCost += c; else b.cost += c; }
  /** What the operator had already spent on an island day before this process started. */
  carry(day: number, cost: number): void { this.carried.set(day, cost); }
  private async timed<T>(b: HourBucket, f: () => Promise<T>, agent?:AgentState, kind="other"): Promise<T> { const s = Date.now(); let outcome="completed"; try { return await f(); } catch(e){outcome="failed";throw e;} finally { const duration=Date.now()-s;b.ms.push(duration); if (b.ms.length > 500) b.ms.shift();this.onAttempt?.(agent,kind,outcome,duration,this.clock().t); } }
  async decide(p: Perception, a: AgentState, tier: Tier): Promise<ActionProposal> { const b = this.bucket(); if (tier >= 2) b.t2++; else b.t1++; const out = await this.timed(b, () => this.inner.decide(p, a, tier),a,"decide"); return out; }
  async converse(ctx: ConverseContext): Promise<Dialogue> { const b = this.bucket(); b.converse++; const out = await this.timed(b, () => this.inner.converse(ctx),ctx.a,"converse"); return out; }
  async reflect(ctx: ReflectContext): Promise<Reflection> { const b = this.bucket(); b.t3++; const out = await this.timed(b, () => this.inner.reflect(ctx),ctx.agent,"reflect"); return out; } // a quiet night runs on the stakes mind, so the day's cost counts it there
  async plan(ctx: PlanContext, tier: Tier): Promise<DayPlan> { const b = this.bucket(); if (tier >= 2) b.t2++; else b.t1++; const out = await this.timed(b, () => this.inner.plan(ctx, tier),ctx.agent,"plan"); return out; }
  async digest(ctx: DigestContext): Promise<DigestText> { const b = this.bucket(); b.t2++; const out = await this.timed(b, () => this.inner.digest(ctx),ctx.agent,"digest"); return out; }
  fallbacks: { at: number; what: string; model: string; reason: string }[] = [];
  fallback(f: { what: string; model: string; reason: string }) { this.fallbacks.unshift({ at: Date.now(), ...f }); if (this.fallbacks.length > 200) this.fallbacks.pop(); this.hold("watch", `The town's mind could not use a ${f.model} answer for ${f.what} (${f.reason}); the plain fallback stood in.`, "models"); }
  async child(ctx: ChildContext): Promise<Persona> { const b = this.bucket(); b.t2++; const out = await this.timed(b, () => this.inner.child(ctx)); return out; }
  async writePaper(ctx: PaperContext): Promise<Paper> { const b = this.bucket(); const out = await this.timed(b, () => this.inner.writePaper(ctx)); return out; }
  async judge(ctx: JudgeContext): Promise<Judgement> { const b = this.bucket(); b.t1++; const out = await this.timed(b, () => this.inner.judge(ctx)); return out; }
  async life(ctx: LifeContext): Promise<LifeText> { const b = this.bucket(); const out = await this.timed(b, () => this.inner.life(ctx)); return out; }
  hold(level: "hold" | "watch" | "ok", text: string, source: string) { this.holds.unshift({ id: this.nextHold++, level, text, at: Date.now(), source, done: false }); if (this.holds.length > 100) this.holds.pop(); }
  today(day: number) { const hs = this.hours.filter((h) => h.day === day); const ms = hs.flatMap((h) => h.ms).sort((a, b) => a - b); return { t1: hs.reduce((s, h) => s + h.t1, 0), t2: hs.reduce((s, h) => s + h.t2, 0), t3: hs.reduce((s, h) => s + h.t3, 0), converse: hs.reduce((s, h) => s + h.converse, 0), cost: hs.reduce((s, h) => s + h.cost, 0) + (this.carried.get(day) ?? 0), userKeyCost: hs.reduce((s, h) => s + h.userKeyCost, 0), p50: ms.length ? ms[Math.floor(ms.length / 2)]! : 0, p95: ms.length ? ms[Math.floor(ms.length * 0.95)]! : 0 }; }
}
