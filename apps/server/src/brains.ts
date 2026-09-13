import { randomBytes } from "node:crypto";
import type { WebSocket } from "ws";
import type { ActionProposal, DayPlan, DigestText, Dialogue, Paper, LifeText, Judgement, Perception, Persona, Reflection } from "@unwatched/protocol";
import { ActionProposal as ActionProposalSchema, DayPlan as DayPlanSchema, Reflection as ReflectionSchema } from "@unwatched/protocol";
import type { AgentState, Brain, ChildContext, ConverseContext, DigestContext, PaperContext, LifeContext, JudgeContext, PlanContext, ReflectContext, Tier } from "@unwatched/engine";
import { MockBrain, OpenRouterBrain } from "@unwatched/cognition";
import type { BrainRow } from "@unwatched/store";

/** Rough per-million-token prices, in dollars, to hold an own-key agent under its owner's daily cap. */
const PRICE: Record<string, [number, number]> = { "anthropic/claude-haiku-4.5": [1, 5], "anthropic/claude-sonnet-5": [2, 10], "anthropic/claude-opus-5": [5, 25] };
const costOf = (model: string, prompt: number, completion: number) => { const [i, o] = PRICE[model] ?? [3, 15]; return (prompt * i + completion * o) / 1e6; };

/** An owner's key, our prompts. Metered against their cap, not our credits. */
export class OwnKeyBrain implements Brain {
  readonly name = "own_key";
  private inner: OpenRouterBrain;
  private last = { calls: 0, prompt: 0, completion: 0 };
  spentToday = 0; day = 0;
  constructor(readonly row: BrainRow, log: (l: string) => void, onUsage?: (u:import("@unwatched/cognition").ProviderUsage)=>void) {
    const m = row.models ?? { routine: "anthropic/claude-haiku-4.5", stakes: "anthropic/claude-sonnet-5", reflect: "anthropic/claude-opus-5" };
    this.inner = new OpenRouterBrain({ apiKey: row.api_key ?? "", routine: m.routine, stakes: m.stakes, reflect: m.reflect, log });
    this.inner.onUsage=onUsage??null;
  }
  private meter(model: string) { const u = this.inner.usage(); this.spentToday += costOf(model, u.prompt - this.last.prompt, u.completion - this.last.completion); this.last = u; }
  private capped(day: number) { if (day !== this.day) { this.day = day; this.spentToday = 0; } return this.row.daily_cap_usd !== null && this.spentToday >= this.row.daily_cap_usd; }
  async decide(p: Perception, a: AgentState, tier: Tier): Promise<ActionProposal> {
    if (this.capped(p.time.day)) return { action: { kind: "wait" }, remember: [] };
    const out = await this.inner.decide(p, a, tier); this.meter(tier >= 2 ? (this.row.models?.stakes ?? "anthropic/claude-sonnet-5") : (this.row.models?.routine ?? "anthropic/claude-haiku-4.5")); return out;
  }
  async converse(ctx: ConverseContext): Promise<Dialogue> { const out = await this.inner.converse(ctx); this.meter(this.row.models?.routine ?? "anthropic/claude-haiku-4.5"); return out; }
  async reflect(ctx: ReflectContext): Promise<Reflection> { if (this.capped(ctx.day)) return new MockBrain(3).reflect(ctx); const out = await this.inner.reflect(ctx); this.meter(this.row.models?.reflect ?? "anthropic/claude-opus-5"); return out; }
  async plan(ctx: PlanContext, tier: Tier): Promise<DayPlan> { if (this.capped(ctx.day)) return new MockBrain(3).plan(ctx, tier); const out = await this.inner.plan(ctx, tier); this.meter(tier >= 2 ? (this.row.models?.stakes ?? "anthropic/claude-sonnet-5") : (this.row.models?.routine ?? "anthropic/claude-haiku-4.5")); return out; }
  async digest(ctx: DigestContext): Promise<DigestText> { return this.inner.digest(ctx); } // the telling is the town's; never metered to the owner
  async child(ctx: ChildContext): Promise<Persona> { return this.inner.child(ctx); }
  async writePaper(ctx: PaperContext): Promise<Paper> { return this.inner.writePaper(ctx); }
  async life(ctx: LifeContext): Promise<LifeText> { return this.inner.life(ctx); }
  async judge(ctx: JudgeContext): Promise<Judgement> { return this.inner.judge(ctx); }
  status() { return { spentToday: Math.round(this.spentToday * 100) / 100, calls: this.last.calls }; }
}

/** Somebody else's process, on the other end of a WebSocket. We send what the agent perceives; they answer with one action. */
export class OwnBrain implements Brain {
  readonly name = "own_brain";
  socket: WebSocket | null = null;
  lastHeartbeat = 0; answered = 0; missed = 0; latencies: number[] = [];
  exchanges: { t: string; sent: unknown; got: unknown }[] = [];
  private pending = new Map<string, { resolve: (v: unknown) => void; timer: NodeJS.Timeout }>();
  private fallback = new MockBrain(5);
  onBad: ((text: string) => void) | null = null;
  constructor(readonly row: BrainRow, private log: (l: string) => void) {}

  attach(ws: WebSocket) {
    if (this.socket && this.socket !== ws) { try { this.socket.close(4000, "replaced by a newer connection"); } catch {} }
    this.socket = ws; this.lastHeartbeat = Date.now();
    ws.on("message", (raw) => {
      this.lastHeartbeat = Date.now();
      let msg: { type?: string; request_id?: string } & Record<string, unknown>;
      try { msg = JSON.parse(String(raw)); } catch { return; }
      if (msg.type === "ping") { ws.send(JSON.stringify({ type: "pong", t: Date.now() })); return; }
      const p = msg.request_id ? this.pending.get(msg.request_id) : undefined;
      if (p) { clearTimeout(p.timer); this.pending.delete(msg.request_id as string); p.resolve(msg); }
    });
    ws.on("close", () => { if (this.socket === ws) this.socket = null; });
  }
  get connected() { return !!this.socket && this.socket.readyState === 1; }

  private ask(payload: Record<string, unknown>, ms: number): Promise<unknown | null> {
    if (!this.connected) return Promise.resolve(null);
    const request_id = randomBytes(6).toString("hex");
    const started = Date.now();
    return new Promise((resolve) => {
      const timer = setTimeout(() => { this.pending.delete(request_id); this.missed++; resolve(null); }, ms);
      this.pending.set(request_id, { resolve: (v) => { this.answered++; this.latencies.push(Date.now() - started); if (this.latencies.length > 50) this.latencies.shift(); resolve(v); }, timer });
      this.socket!.send(JSON.stringify({ ...payload, request_id }));
    });
  }

  async verify(p: Perception): Promise<boolean> {
    const got=await this.ask({...p,deadline_ms:8000},8000);
    return !!got && ActionProposalSchema.safeParse(got).success;
  }

  async decide(p: Perception, _a: AgentState, _tier: Tier): Promise<ActionProposal> {
    const got = await this.ask({ ...p }, p.deadline_ms);
    const parsed = got ? ActionProposalSchema.safeParse(got) : null;
    const out = parsed?.success ? parsed.data : { action: { kind: "wait" as const }, remember: [] };
    if (got && !parsed?.success) { this.log(`own brain for ${p.agent_id} answered badly: ${parsed?.error.issues[0]?.message}`); this.onBad?.(`Own brain for ${p.agent_id} answered with something the town could not read: ${parsed?.error.issues[0]?.message ?? "?"}. Fell back to habit.`); }
    this.exchanges.push({ t: p.time.sim, sent: { location: p.self.location, nearby: p.nearby.map((n) => n.name), heard: p.heard.map((h) => h.text) }, got: got ?? "missed" }); if (this.exchanges.length > 8) this.exchanges.shift();
    return out;
  }
  async converse(ctx: ConverseContext): Promise<Dialogue> { return this.fallback.converse(ctx); } // never called: own-brains talk turn by turn
  async reflect(ctx: ReflectContext): Promise<Reflection> {
    const got = await this.ask({ type: "reflect", agent_id: ctx.agent.id, day: ctx.day, day_memories: ctx.dayMemories, key_memories: ctx.keyMemories, relationships: ctx.relationships, coins: ctx.agent.coins, job: ctx.agent.job, unread_letters: ctx.unreadLetters, plan: ctx.plan, projects: ctx.projects, beliefs: ctx.beliefs, watch: ctx.watch, quiet: ctx.quiet }, 30000); // an own brain sees the same night a hosted one does
    const parsed = got ? ReflectionSchema.safeParse(got) : null;
    return parsed?.success ? parsed.data : this.fallback.reflect(ctx);
  }
  async plan(ctx: PlanContext, tier: Tier): Promise<DayPlan> {
    const got = await this.ask({ type: "plan", agent_id: ctx.agent.id, day: ctx.day, hour: ctx.hour, weather: ctx.weather, yesterday: ctx.yesterday, intentions: ctx.intentions, key_memories: ctx.keyMemories, relationships: ctx.relationships, places: ctx.places, jobs_open: ctx.jobsOpen, letters: ctx.unreadLetters, coins: ctx.agent.coins, job: ctx.agent.job }, 12000);
    const parsed = got ? DayPlanSchema.safeParse(got) : null;
    return parsed?.success ? parsed.data : this.fallback.plan(ctx, tier);
  }
  async digest(ctx: DigestContext): Promise<DigestText> { return this.fallback.digest(ctx); } // replaced by the town's mind in the router
  async child(ctx: ChildContext): Promise<Persona> { return this.fallback.child(ctx); }
  async writePaper(ctx: PaperContext): Promise<Paper> { return this.fallback.writePaper(ctx); } // the paper is the town's, never one brain's
  async life(ctx: LifeContext): Promise<LifeText> { return this.fallback.life(ctx); }
  async judge(ctx: JudgeContext): Promise<Judgement> { return this.fallback.judge(ctx); } // the referee is the town's, never one brain's
  status() {
    const sorted = [...this.latencies].sort((a, b) => a - b);
    return { connected: this.connected, lastHeartbeat: this.lastHeartbeat, answered: this.answered, missed: this.missed, medianMs: sorted.length ? sorted[Math.floor(sorted.length / 2)] : null, exchanges: this.exchanges.slice(-5) };
  }
}

/** One brain per agent, the town's brain for everyone else. The engine sees a single Brain. */
export class BrainRouter implements Brain {
  onUsage: ((u:import("@unwatched/cognition").ProviderUsage)=>void) | null = null;
  readonly name: string;
  readonly perAgent = new Map<string, OwnKeyBrain | OwnBrain>();
  onBad: ((text: string) => void) | null = null;
  constructor(readonly town: Brain, private log: (l: string) => void, private hostedFor?: (a: AgentState) => Brain | undefined) { this.name = town.name; }
  private forAgent(a: AgentState) { return this.perAgent.get(a.id) ?? this.hostedFor?.(a) ?? this.town; }
  set(agentId: string, row: BrainRow | null): void {
    this.perAgent.delete(agentId);
    if (!row || row.kind === "hosted") return;
    if (row.kind === "own_key" && row.api_key) this.perAgent.set(agentId, new OwnKeyBrain(row, this.log, u=>this.onUsage?.(u)));
    if (row.kind === "own_brain") { const b = new OwnBrain(row, this.log); b.onBad = this.onBad; this.perAgent.set(agentId, b); }
  }
  ownBrainByToken(token: string): OwnBrain | null { for (const b of this.perAgent.values()) if (b instanceof OwnBrain && b.row.token === token) return b; return null; }
  decide(p: Perception, a: AgentState, tier: Tier) { return this.forAgent(a).decide(p, a, tier); }
  converse(ctx: ConverseContext) { return (this.perAgent.get(ctx.a.id) ?? this.perAgent.get(ctx.b.id) ?? this.hostedFor?.(ctx.a) ?? this.hostedFor?.(ctx.b) ?? this.town).converse(ctx); }
  reflect(ctx: ReflectContext) { return this.forAgent(ctx.agent).reflect(ctx); }
  plan(ctx: PlanContext, tier: Tier) { return this.forAgent(ctx.agent).plan(ctx, tier); }
  digest(ctx: DigestContext) { return this.forAgent(ctx.agent).digest(ctx); }
  child(ctx: ChildContext) { return this.town.child(ctx); }
  writePaper(ctx: PaperContext) { return this.town.writePaper(ctx); }
  life(ctx: LifeContext) { return this.town.life(ctx); }
  judge(ctx: JudgeContext) { return this.forAgent(ctx.agent).judge(ctx); }
}

export const newToken = () => `ft_agent_${randomBytes(18).toString("base64url")}`;
