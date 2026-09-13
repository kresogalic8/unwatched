import type { AgentState, Brain, ChildContext, ConverseContext, DigestContext, PaperContext, LifeContext, JudgeContext, PlanContext, ReflectContext, Tier } from "@unwatched/engine";
import type { ActionProposal, DayPlan, DigestText, Dialogue, Paper, LifeText, Judgement, Perception, Persona, Reflection } from "@unwatched/protocol";
import { OpenRouterBrain } from "@unwatched/cognition";

const PRICE: Record<string, [number, number]> = { "anthropic/claude-haiku-4.5": [1, 5], "anthropic/claude-sonnet-5": [2, 10], "anthropic/claude-opus-5": [5, 25], "claude-haiku-4-5": [1, 5], "claude-sonnet-5": [2, 10], "claude-opus-5": [5, 25] };

export interface HourBucket { hour: number; day: number; t1: number; t2: number; t3: number; converse: number; ms: number[]; cost: number }

/**
 * Sees every thought the town spends, and what it cost. Wraps the router the engine calls, so nothing is missed.
 */
export class Metrics implements Brain {
  readonly name: string;
  onAttempt: ((a:AgentState|undefined,kind:string,outcome:string,duration:number,t:number)=>void)|null=null;
  hours: HourBucket[] = [];
  holds: { id: number; level: "hold" | "watch" | "ok"; text: string; at: number; source: string; done: boolean }[] = [];
  private nextHold = 1;
  private lastUsage = { prompt: 0, completion: 0 };
  tickMs: number[] = [];
  constructor(private inner: Brain, private townBrain: Brain, private clock: () => { day: number; hour: number; t: number }, private models: { routine: string; stakes: string; reflect: string }, private modelsFor: ((a: AgentState) => Partial<{ routine: string; stakes: string; reflect: string }> | null) | null = null) { this.name = inner.name; }
  private bucket(): HourBucket {
    const c = this.clock(); let b = this.hours[this.hours.length - 1];
    if (!b || b.hour !== c.hour || b.day !== c.day) { b = { hour: c.hour, day: c.day, t1: 0, t2: 0, t3: 0, converse: 0, ms: [], cost: 0 }; this.hours.push(b); if (this.hours.length > 48) this.hours.shift(); }
    return b;
  }
  private modelOf(a: AgentState, which: "routine" | "stakes" | "reflect") { return this.modelsFor?.(a)?.[which] ?? this.models[which]; }
  private meter(b: HourBucket, model: string) {
    if (this.townBrain instanceof OpenRouterBrain) { const u = this.townBrain.usage(); const [i, o] = PRICE[model] ?? [3, 15]; b.cost += ((u.prompt - this.lastUsage.prompt) * i + (u.completion - this.lastUsage.completion) * o) / 1e6; this.lastUsage = { prompt: u.prompt, completion: u.completion }; }
  }
  private async timed<T>(b: HourBucket, f: () => Promise<T>, agent?:AgentState, kind="other"): Promise<T> { const s = Date.now(); let outcome="completed"; try { return await f(); } catch(e){outcome="failed";throw e;} finally { const duration=Date.now()-s;b.ms.push(duration); if (b.ms.length > 500) b.ms.shift();this.onAttempt?.(agent,kind,outcome,duration,this.clock().t); } }
  async decide(p: Perception, a: AgentState, tier: Tier): Promise<ActionProposal> { const b = this.bucket(); if (tier >= 2) b.t2++; else b.t1++; const out = await this.timed(b, () => this.inner.decide(p, a, tier),a,"decide"); if (a.brainKind === "hosted") this.meter(b, this.modelOf(a, tier >= 2 ? "stakes" : "routine")); return out; }
  async converse(ctx: ConverseContext): Promise<Dialogue> { const b = this.bucket(); b.converse++; const out = await this.timed(b, () => this.inner.converse(ctx),ctx.a,"converse"); this.meter(b, this.modelOf(ctx.a, "routine")); return out; }
  async reflect(ctx: ReflectContext): Promise<Reflection> { const b = this.bucket(); b.t3++; const out = await this.timed(b, () => this.inner.reflect(ctx),ctx.agent,"reflect"); if (ctx.agent.brainKind === "hosted") this.meter(b, this.modelOf(ctx.agent, ctx.quiet && ctx.agent.budget.reflectionIncluded !== true ? "stakes" : "reflect")); return out; } // a quiet night runs on the stakes mind, so the day's cost counts it there
  async plan(ctx: PlanContext, tier: Tier): Promise<DayPlan> { const b = this.bucket(); if (tier >= 2) b.t2++; else b.t1++; const out = await this.timed(b, () => this.inner.plan(ctx, tier),ctx.agent,"plan"); if (ctx.agent.brainKind === "hosted") this.meter(b, this.modelOf(ctx.agent, tier >= 2 ? "stakes" : "routine")); return out; }
  async digest(ctx: DigestContext): Promise<DigestText> { const b = this.bucket(); b.t2++; const out = await this.timed(b, () => this.inner.digest(ctx),ctx.agent,"digest"); this.meter(b, this.modelOf(ctx.agent, "stakes")); return out; }
  fallbacks: { at: number; what: string; model: string; reason: string }[] = [];
  fallback(f: { what: string; model: string; reason: string }) { this.fallbacks.unshift({ at: Date.now(), ...f }); if (this.fallbacks.length > 200) this.fallbacks.pop(); this.hold("watch", `The town's mind could not use a ${f.model} answer for ${f.what} (${f.reason}); the plain fallback stood in.`, "models"); }
  async child(ctx: ChildContext): Promise<Persona> { const b = this.bucket(); b.t2++; const out = await this.timed(b, () => this.inner.child(ctx)); this.meter(b, this.models.stakes); return out; }
  async writePaper(ctx: PaperContext): Promise<Paper> { const b = this.bucket(); const out = await this.timed(b, () => this.inner.writePaper(ctx)); this.meter(b, this.models.reflect); return out; }
  async judge(ctx: JudgeContext): Promise<Judgement> { const b = this.bucket(); b.t1++; const out = await this.timed(b, () => this.inner.judge(ctx)); this.meter(b, this.models.routine); return out; }
  async life(ctx: LifeContext): Promise<LifeText> { const b = this.bucket(); const out = await this.timed(b, () => this.inner.life(ctx)); this.meter(b, this.models.reflect); return out; }
  hold(level: "hold" | "watch" | "ok", text: string, source: string) { this.holds.unshift({ id: this.nextHold++, level, text, at: Date.now(), source, done: false }); if (this.holds.length > 100) this.holds.pop(); }
  today(day: number) { const hs = this.hours.filter((h) => h.day === day); const ms = hs.flatMap((h) => h.ms).sort((a, b) => a - b); return { t1: hs.reduce((s, h) => s + h.t1, 0), t2: hs.reduce((s, h) => s + h.t2, 0), t3: hs.reduce((s, h) => s + h.t3, 0), converse: hs.reduce((s, h) => s + h.converse, 0), cost: hs.reduce((s, h) => s + h.cost, 0), p50: ms.length ? ms[Math.floor(ms.length / 2)]! : 0, p95: ms.length ? ms[Math.floor(ms.length * 0.95)]! : 0 }; }
}
