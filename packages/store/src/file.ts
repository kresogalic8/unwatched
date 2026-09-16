import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import type { Town, AgentState, TownSnapshot, AgentSnapshot } from "@unwatched/engine";
import { compress } from "@unwatched/engine";
import type { TownEvent, Paper } from "@unwatched/protocol";
import type { LifeRow, BrainRow, Wallet, TownStore, OwnerPrefs, OwnerRead, CreditSpending, SubscriptionCitizen } from "./index.ts";

/** The record's shape, whichever thing keeps it. Both the Supabase store and the file store answer to this. */
export type Store = Pick<TownStore, keyof TownStore>;

interface Data {
  town: { id: string; name: string; seed: number; sim_t: number; day: number; weather: string; flour_shortage: boolean; places: unknown[]; jobs: unknown[]; children?: unknown[]; civic?: unknown; created_at: string } | null;
  waiting?: AgentSnapshot[];
  agents: { id: string; owner_id: string | null; name: string; persona: unknown; appearance: unknown; brain: string; funded: boolean; arrived_t: number | null; left_t: number | null; state: Record<string, unknown> }[];
  events: TownEvent[];
  memories: { agent_id: string; t: number; kind: string; text: string; importance: number }[];
  relationships: { agent_id: string; other_id: string; trust: number; affection: number; last_seen: number; opinion: string }[];
  letters: { id: number; agent_id: string; owner_id: string | null; direction: "to_agent" | "to_owner"; text: string; t: number; read_at: number | null }[];
  papers: Paper[];
  lives?: LifeRow[];
  looks?: { hash: string; look: string; svg: string; source: string; created_at: string }[];
  laws: { text: string; by: string; yes: number; no: number; open: boolean; voters?: string[] }[];
  brains: BrainRow[];
  wallets: Wallet[];
  subscriptionCitizens?: SubscriptionCitizen[];
  spending?: Record<string,{autoSpend:boolean;dailyLimit:number|null}>;
  creditOperations?: Record<string,{owner:string;delta:number;reason:string;ref:string|null;refundOf:string|null;at:string}>;
  ledger: { owner_id: string; delta: number; reason: string; ref: string | null; at: string }[];
  instructions: Record<string, string>;
  prefs?: OwnerPrefs[];
  reads?: OwnerRead[];
}
const empty = (): Data => ({ town: null, agents: [], events: [], memories: [], relationships: [], letters: [], papers: [], laws: [], brains: [], wallets: [], ledger: [], instructions: {} });

/**
 * The town's record in one JSON file. No account, no keys, no network: a clone of the repo keeps its island across restarts.
 * It is not for a public town, only for running one on your own machine or in CI. The shape is the Supabase store's, row for row.
 */
export class FileStore {
  private d: Data; private file: string; private pending: TownEvent[] = []; private dirty = false;
  constructor(dir: string, readonly townId: string) {
    mkdirSync(dir, { recursive: true }); this.file = join(dir, `${townId}.json`);
    this.d = existsSync(this.file) ? (JSON.parse(readFileSync(this.file, "utf8")) as Data) : empty();
    if(!this.d.spending)this.d.spending=Object.fromEntries(this.d.wallets.map(w=>[w.ownerId,{autoSpend:true,dailyLimit:null}]));
    if(!this.d.subscriptionCitizens){this.d.subscriptionCitizens=[];for(const a of this.d.agents){if(a.owner_id&&a.brain==="hosted"&&a.left_t===null&&!this.d.waiting?.some(x=>x.id===a.id)&&this.d.wallets.some(w=>w.ownerId===a.owner_id&&w.plan!=="none"))this.d.subscriptionCitizens.push({agentId:a.id,ownerId:a.owner_id,grandfathered:this.d.subscriptionCitizens.some(x=>x.ownerId===a.owner_id),subscriptionId:null});}}

  }
  static fromEnv(townId = "island"): FileStore { return new FileStore(process.env.UW_DATA_DIR ?? "out/town", townId); }
  private save(): void { const tmp = `${this.file}.tmp`; writeFileSync(tmp, JSON.stringify(this.d)); renameSync(tmp, this.file); this.dirty = false; }

  async probe(): Promise<string | null> { return null; }
  async towns() { const t = this.d.town; return t ? [{ id: t.id, name: t.name, seed: t.seed, sim_t: t.sim_t, day: t.day, weather: t.weather, flour_shortage: t.flour_shortage, created_at: t.created_at, population: this.d.agents.filter((a) => a.left_t === null && a.arrived_t !== null).length }] : []; }
  async ensureTown(name: string, seed: number): Promise<void> { if (!this.d.town) { this.d.town = { id: this.townId, name, seed, sim_t: 0, day: 1, weather: "clear", flour_shortage: false, places: [], jobs: [], created_at: new Date().toISOString() }; this.save(); } }
  sink(e: TownEvent): void { this.pending.push(e); }
  async flush(): Promise<void> { if (!this.pending.length) return; this.d.events.push(...this.pending); this.pending = []; if (this.d.events.length > 20000) this.d.events = this.d.events.slice(-20000); this.dirty = true; }
  async snapshot(town: Town, _strict = false): Promise<void> {
    await this.flush();
    const snap = town.snapshot();
    const rows = new Map(this.d.agents.map((a) => [a.id, a]));
    for (const a of town.agents.values()) { const sa = snap.agents.find((x) => x.id === a.id)!; const prev = rows.get(a.id); rows.set(a.id, { id: a.id, owner_id: a.owner, name: a.persona.name, persona: a.persona, appearance: a.appearance ?? {}, brain: prev?.brain ?? "hosted", funded: a.funded, arrived_t: a.arrivedAt, left_t: prev?.left_t ?? null, state: { ...sa.state, owner: a.owner } }); }
    this.d.agents = [...rows.values()];
    this.d.town = { ...(this.d.town ?? { id: this.townId, name: "The island", seed: 0, created_at: new Date().toISOString() }), sim_t: town.t, day: town.day, weather: town.weather, flour_shortage: town.flourShortage, places: snap.places ?? [], jobs: snap.jobs ?? [], children: snap.children ?? [], civic: snap.civic ?? { mayor: null, elected: 0, works: [] } };
    const ids = new Set(town.agents.keys());
    this.d.relationships = this.d.relationships.filter((r) => !ids.has(r.agent_id));
    for (const a of town.agents.values()) for (const [other, r] of a.relationships) this.d.relationships.push({ agent_id: a.id, other_id: other, trust: r.trust, affection: r.affection, last_seen: r.lastSeen, opinion: r.opinion });
    this.d.papers = town.papers.slice(-14); this.d.laws = town.laws.map((l) => ({ text: l.text, by: l.by, yes: l.yes, no: l.no, open: l.open, voters: [...(l.voters ?? [l.by])] })); // who has voted, or a restart lets them vote again
    this.save();
  }
  async appendMemories(a: AgentState, sinceT: number): Promise<void> { for (const m of a.memory) if (m.t >= sinceT) this.d.memories.push({ agent_id: a.id, t: m.t, kind: m.kind, text: m.text, importance: m.importance }); this.dirty = true; }
  async loadSnapshot(): Promise<TownSnapshot | null> {
    const t = this.d.town; if (!t) return null;
    this.d.events = this.d.events.filter((e) => e.t <= t.sim_t); this.d.memories = this.d.memories.filter((m) => m.t <= t.sim_t);
    // a letter delivered after the last snapshot belongs to a timeline about to be re-lived: it goes back in the post, and a letter home that was never written is struck from the record
    for (const l of this.d.letters) if (l.direction === "to_agent" && l.read_at !== null && l.read_at > t.sim_t) l.read_at = null;
    this.d.letters = this.d.letters.filter((l) => !(l.direction === "to_owner" && l.t > t.sim_t));
    const agents: AgentSnapshot[] = this.d.agents.filter((r) => r.left_t === null && r.arrived_t !== null).map((r) => {
      const st = r.state as AgentSnapshot["state"] & { owner?: string | null };
      const memory = this.d.memories.filter((m) => m.agent_id === r.id).map((m) => ({ t: m.t, kind: m.kind as "obs", text: m.text, importance: m.importance }));
      return { id: r.id, persona: r.persona as AgentSnapshot["persona"], owner: r.owner_id ?? st.owner ?? null, funded: r.funded, appearance: (r.appearance as Record<string, unknown>) ?? null, arrivedAt: r.arrived_t ?? 0, state: st, relationships: this.d.relationships.filter((x) => x.agent_id === r.id).map((x) => ({ other: x.other_id, trust: x.trust, affection: x.affection, lastSeen: x.last_seen, opinion: x.opinion })), memory: compress(memory) };
    });
    return { t: t.sim_t, day: t.day, weather: t.weather, flourShortage: t.flour_shortage, places: (t.places ?? []) as NonNullable<TownSnapshot["places"]>, jobs: (t.jobs ?? []) as NonNullable<TownSnapshot["jobs"]>, children: (t.children ?? []) as NonNullable<TownSnapshot["children"]>, ...(t.civic ? { civic: t.civic as NonNullable<TownSnapshot["civic"]> } : {}), agents, papers: this.d.papers, laws: this.d.laws };
  }
  async recentEvents(n = 300): Promise<TownEvent[]> { return this.d.events.slice(-n); }
  async markLeft(agentId: string, t: number): Promise<void> { const r = this.d.agents.find((a) => a.id === agentId); if (r) { r.left_t = t; this.dirty = true; } }
  async saveInstructions(agentId: string, text: string): Promise<void> { this.d.instructions[agentId] = text; this.dirty = true; }
  async lifeOf(agentId: string) { return { events: this.d.events.filter((e) => e.actors.includes(agentId)), memories: this.d.memories.filter((m) => m.agent_id === agentId).map(({ t, kind, text, importance }) => ({ t, kind, text, importance })), letters: this.d.letters.filter((l) => l.agent_id === agentId).map(({ direction, text, t }) => ({ direction, text, t })) }; }
  async deleteOwner(ownerId: string): Promise<void> { if(this.d.spending)delete this.d.spending[ownerId];this.d.subscriptionCitizens=(this.d.subscriptionCitizens??[]).filter(s=>s.ownerId!==ownerId); this.d.waiting=(this.d.waiting??[]).filter(a=>a.owner!==ownerId); for (const a of this.d.agents) if (a.owner_id === ownerId) a.owner_id = null; this.d.wallets = this.d.wallets.filter((w) => w.ownerId !== ownerId); this.d.letters = this.d.letters.filter((l) => l.owner_id !== ownerId); this.d.prefs = (this.d.prefs ?? []).filter((p) => p.ownerId !== ownerId); this.d.reads = (this.d.reads ?? []).filter((r) => r.ownerId !== ownerId); this.save(); }
  async loadBrains(): Promise<BrainRow[]> { return this.d.brains; }
  async waitingCitizens():Promise<AgentSnapshot[]> {return structuredClone(this.d.waiting??[]);}
  async parkCitizens(agents:AgentSnapshot[]):Promise<void> {const byId=new Map((this.d.waiting??[]).map(a=>[a.id,a]));for(const a of agents)byId.set(a.id,structuredClone(a));this.d.waiting=[...byId.values()];this.save();}
  async resumeCitizen(staged:Town,id:string):Promise<void> {const sa=staged.snapshot().agents.find(a=>a.id===id)!;const row=this.d.agents.find(a=>a.id===id);if(!row)throw new Error("Citizen not found");if(!(this.d.waiting??[]).some(a=>a.id===id&&a.owner===sa.owner))throw new Error("Citizen is not waiting for this owner");for(const m of sa.memory)if(!this.d.memories.some(x=>x.agent_id===id&&x.t===m.t&&x.kind===m.kind&&x.text===m.text))this.d.memories.push({agent_id:id,...m});this.d.relationships=this.d.relationships.filter(r=>r.agent_id!==id);for(const r of sa.relationships)this.d.relationships.push({agent_id:id,other_id:r.other,trust:r.trust,affection:r.affection,last_seen:r.lastSeen,opinion:r.opinion});row.state={...sa.state,owner:sa.owner};row.brain=sa.state.brainKind??"hosted";this.d.waiting=(this.d.waiting??[]).filter(a=>a.id!==id);this.save();}
  async admitCitizen(staged: Town, id:string, brain:BrainRow|null):Promise<void> {
    if(this.d.agents.some(a=>a.id===id))return;
    const a=staged.agents.get(id)!;const snap=staged.snapshot().agents.find(x=>x.id===id)!;
    this.d.agents.push({id,owner_id:a.owner,name:a.persona.name,persona:a.persona,appearance:a.appearance??{},brain:a.brainKind,funded:a.funded,arrived_t:a.arrivedAt,left_t:null,state:{...snap.state,owner:a.owner}});
    if(brain)this.d.brains.push(brain);this.save();
  }
  async saveBrain(row: BrainRow): Promise<void> { this.d.brains = [...this.d.brains.filter((b) => b.agent_id !== row.agent_id), row]; this.save(); }
  async subscriptionCitizens():Promise<SubscriptionCitizen[]> {return this.d.subscriptionCitizens??[];}
  async subscriptionAvailable(ownerId:string,agentId:string):Promise<boolean>{return (this.d.subscriptionCitizens??[]).some(s=>s.ownerId===ownerId&&s.agentId===agentId)||!(this.d.subscriptionCitizens??[]).some(s=>s.ownerId===ownerId&&!s.grandfathered&&!this.d.agents.some(a=>a.id===s.agentId&&a.left_t!==null&&!this.d.waiting?.some(w=>w.id===a.id)));}
  async claimSubscription(ownerId:string,agentId:string,subscriptionId:string|null=null):Promise<void> {
    this.d.subscriptionCitizens=(this.d.subscriptionCitizens??[]).filter(s=>s.ownerId!==ownerId||s.grandfathered||!this.d.agents.some(a=>a.id===s.agentId&&a.left_t!==null&&!this.d.waiting?.some(w=>w.id===a.id)));
    const seats=this.d.subscriptionCitizens;const found=seats.find(x=>x.agentId===agentId);
    if(found){if(found.ownerId!==ownerId)throw new Error("Citizen belongs to another owner");return;}
    if((await this.wallet(ownerId)).plan==="none"||seats.some(x=>x.ownerId===ownerId&&!x.grandfathered))throw new Error("Subscription already assigned or unavailable");
    seats.push({ownerId,agentId,grandfathered:false,subscriptionId});this.save();
  }
  private spendingNow(ownerId:string):CreditSpending {
    const day=new Date().toISOString().slice(0,10);const ops=Object.values(this.d.creditOperations??{});
    const entries=Object.entries(this.d.creditOperations??{});
    const spentToday=entries.filter(([id,o])=>o.owner===ownerId&&o.delta<0&&o.at.startsWith(day)&&!ops.some(r=>r.refundOf===id)).reduce((n,[,o])=>n-o.delta,0);
    return {...(this.d.spending?.[ownerId]??{autoSpend:false,dailyLimit:null}),spentToday,resetsAt:new Date(Date.parse(day)+86400000).toISOString()};
  }
  async creditSpending(ownerId:string):Promise<CreditSpending>{return this.spendingNow(ownerId);}
  async setCreditSpending(ownerId:string,autoSpend:boolean,dailyLimit:number|null):Promise<void>{(this.d.spending??={})[ownerId]={autoSpend,dailyLimit};this.save();}
  async changeCredits(ownerId:string,delta:number,reason:string,ref:string|null,operationId:string,refundOf:string|null=null):Promise<{ok:boolean;credits:number}> {
    const ops=this.d.creditOperations??={};let w=this.d.wallets.find(x=>x.ownerId===ownerId);
    if(!w){w={ownerId,plan:"none",credits:0,stripeCustomer:null};this.d.wallets.push(w);}
    if(ops[operationId]||reason==="purchase"&&Object.values(ops).some(o=>o.owner===ownerId&&o.reason===reason&&o.ref===ref))return {ok:true,credits:w.credits};
    if(refundOf){const debit=ops[refundOf];if(!debit||debit.owner!==ownerId||debit.delta!==-delta||delta<=0)throw new Error("Invalid refund");if(Object.values(ops).some(o=>o.refundOf===refundOf))return {ok:true,credits:w.credits};}
    const policy=this.spendingNow(ownerId);
    if(delta<0&&(!policy.autoSpend||w.credits+delta<0||policy.dailyLimit!==null&&policy.spentToday-delta>policy.dailyLimit))return {ok:false,credits:w.credits};
    w.credits+=delta;ops[operationId]={owner:ownerId,delta,reason,ref,refundOf,at:new Date().toISOString()};
    this.d.ledger.push({owner_id:ownerId,delta,reason,ref,at:new Date().toISOString()});this.save();return {ok:true,credits:w.credits};
  }
  async wallet(ownerId: string): Promise<Wallet> { return this.d.wallets.find((w) => w.ownerId === ownerId) ?? { ownerId, plan: "none", credits: 0, stripeCustomer: null }; }
  async saveWallet(w: Wallet): Promise<void> { const current=this.d.wallets.find(x=>x.ownerId===w.ownerId);this.d.wallets = [...this.d.wallets.filter((x) => x.ownerId !== w.ownerId), {...w,credits:current?.credits??w.credits}]; this.save(); }
  async ledger(ownerId: string, n = 30) { return this.d.ledger.filter((l) => l.owner_id === ownerId).slice(-n).reverse().map(({ delta, reason, ref, at }) => ({ delta, reason, ref, at })); }
  async credit(ownerId: string, delta: number, reason: string, ref: string | null = null): Promise<void> { this.d.ledger.push({ owner_id: ownerId, delta, reason, ref, at: new Date().toISOString() }); this.dirty = true; }
  async allWallets(): Promise<Wallet[]> { return this.d.wallets; }
  async eventsBetween(from: number, to: number): Promise<TownEvent[]> { return this.d.events.filter((e) => e.t >= from && e.t < to); }
  async saveLook(row: { hash: string; look: string; svg: string; source: string }): Promise<void> { this.d.looks = [...(this.d.looks ?? []).filter((l) => l.hash !== row.hash), { ...row, created_at: new Date().toISOString() }]; this.save(); }
  async loadLook(hash: string): Promise<{ look: string; svg: string } | null> { const l = (this.d.looks ?? []).find((x) => x.hash === hash); return l ? { look: l.look, svg: l.svg } : null; }
  async listLooks(): Promise<{ hash: string; look: string; created_at: string }[]> { return (this.d.looks ?? []).map(({ hash, look, created_at }) => ({ hash, look, created_at })); }
  async saveLife(row: LifeRow): Promise<void> { this.d.lives = [...(this.d.lives ?? []).filter((l) => l.agentId !== row.agentId), row]; this.save(); }
  async lives(): Promise<LifeRow[]> { return [...(this.d.lives ?? [])].sort((x, y) => y.leftDay - x.leftDay); }
  async life(agentId: string): Promise<LifeRow | null> { return (this.d.lives ?? []).find((l) => l.agentId === agentId) ?? null; }
  async savePaper(paper: Paper): Promise<void> { this.d.papers = [...this.d.papers.filter((p) => p.edition !== paper.edition), paper].slice(-14); this.save(); }
  async saveLetter(agentId: string, ownerId: string | null, direction: "to_agent" | "to_owner", text: string, t: number, readAt: number | null = null): Promise<void> { this.d.letters.push({ id: 1 + Math.max(0, ...this.d.letters.map((l) => l.id)), agent_id: agentId, owner_id: ownerId, direction, text, t, read_at: readAt ?? (direction === "to_agent" ? null : t) }); this.save(); }
  async undeliveredLetters() { return this.d.letters.filter((l) => l.direction === "to_agent" && l.read_at === null).map(({ id, agent_id, text }) => ({ id, agent_id, text })); }
  async markDelivered(ids: number[], t: number): Promise<void> { for (const l of this.d.letters) if (ids.includes(l.id)) l.read_at = t; this.dirty = true; }
  async ownerPrefs(ownerId: string): Promise<OwnerPrefs> { return (this.d.prefs ?? []).find((p) => p.ownerId === ownerId) ?? { ownerId, notifyDigest: true, notifyLetters: true, lastMailedDay: null }; }
  async saveOwnerPrefs(p: OwnerPrefs): Promise<void> { this.d.prefs = [...(this.d.prefs ?? []).filter((x) => x.ownerId !== p.ownerId), p]; this.save(); }
  /** A dev name has no inbox. UW_DEV_EMAILS="mira=mira@example.com,..." gives one locally, for trying the morning mail. */
  async ownerEmail(ownerId: string): Promise<string | null> { const m = /(?:^|,)\s*([^=,]+)=([^,]+)/g; for (const [, k, v] of (process.env.UW_DEV_EMAILS ?? "").matchAll(m)) if (k!.trim() === ownerId) return v!.trim(); return null; }
  async ownerRead(ownerId: string, agentId: string): Promise<OwnerRead> { return (this.d.reads ?? []).find((r) => r.ownerId === ownerId && r.agentId === agentId) ?? { ownerId, agentId, lastDigestT: null, lastLetterMailDay: null }; }
  async saveOwnerRead(r: OwnerRead): Promise<void> { this.d.reads = [...(this.d.reads ?? []).filter((x) => !(x.ownerId === r.ownerId && x.agentId === r.agentId)), r]; this.save(); }
  async pendingArrivals() { return this.d.agents.filter((a) => a.arrived_t === null).map((a) => ({ id: a.id, owner_id: a.owner_id, name: a.name, persona: a.persona, appearance: a.appearance, brain: a.brain })); }
}
