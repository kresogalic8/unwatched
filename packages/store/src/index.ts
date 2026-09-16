import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { TownEvent, Paper } from "@unwatched/protocol";
import type { Town, AgentState, TownSnapshot, AgentSnapshot } from "@unwatched/engine";

export type Plan = "none" | "visitor" | "resident" | "patron";
export interface CreditSpending { autoSpend: boolean; dailyLimit: number | null; spentToday: number; resetsAt: string }
export interface SubscriptionCitizen { agentId: string; ownerId: string; grandfathered: boolean; subscriptionId: string | null }
export interface Wallet { ownerId: string; plan: Plan; credits: number; stripeCustomer: string | null }
/** What an owner asked to be told by mail, and the last island day the morning digest went out. Both notices are on until turned off. */
export interface OwnerPrefs { ownerId: string; notifyDigest: boolean; notifyLetters: boolean; lastMailedDay: number | null }
/** Where one owner's reading of one citizen stands: the digest watermark, and the last island day a letter notice was mailed. */
export interface OwnerRead { ownerId: string; agentId: string; lastDigestT: number | null; lastLetterMailDay: number | null }
export interface BrainRow { agent_id: string; kind: "hosted" | "own_key" | "own_brain"; provider: string | null; api_key: string | null; models: { routine: string; stakes: string; reflect: string } | null; think_every: number | null; daily_cap_usd: number | null; token: string | null; memory: "lease" | "own" }
import { compress, asksSomething } from "@unwatched/engine";

/**
 * The town's record on Supabase. The engine writes with the service role; owners and visitors read through RLS.
 * Writes are batched so a busy tick does not become a thousand round trips.
 */
/** One book on the library shelf. */
export interface LifeRow { agentId: string; name: string; title: string; text: string; epitaph: string; how: "left" | "died" | "exiled"; arrivedDay: number; leftDay: number }

export class TownStore {
  private sb: SupabaseClient;
  private eventQueue: TownEvent[] = [];
  private flushing = false;
  private timer: NodeJS.Timeout | null = null;
  constructor(url: string, serviceKey: string, readonly townId: string) {
    this.sb = createClient(url, serviceKey, { auth: { persistSession: false } });
  }

  static fromEnv(townId = "island"): TownStore | null {
    const url = process.env.SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    return new TownStore(url, key, townId);
  }

  /** One cheap read at startup. Returns a reason when the key or the project is wrong. */
  async probe(): Promise<string | null> {
    const { error } = await this.sb.from("towns").select("id").limit(1);
    if (!error) return null;
    if (/invalid api key|jwt/i.test(error.message)) return "the service role key is not valid for this project; re-copy it from Settings, then API";
    return error.message;
  }

  /** Every island the record knows about, with how many people are on each. */
  async towns(): Promise<{ id: string; name: string; seed: number; sim_t: number; day: number; weather: string; flour_shortage: boolean; created_at: string; population: number }[]> {
    const [{ data: towns }, { data: heads }] = await Promise.all([
      this.sb.from("towns").select("id, name, seed, sim_t, day, weather, flour_shortage, created_at").order("created_at", { ascending: true }),
      this.sb.from("agents").select("town_id").is("left_t", null).not("arrived_t", "is", null),
    ]);
    const pop = new Map<string, number>(); for (const h of heads ?? []) pop.set(h.town_id as string, (pop.get(h.town_id as string) ?? 0) + 1);
    return (towns ?? []).map((t) => ({ ...t, sim_t: Number(t.sim_t), population: pop.get(t.id as string) ?? 0 }));
  }
  async ensureTown(name: string, seed: number): Promise<void> {
    await this.sb.from("towns").upsert({ id: this.townId, name, seed }, { onConflict: "id", ignoreDuplicates: true });
  }

  /** Event sink for the engine. Queues and flushes every 500 ms or 200 events. */
  sink = (e: TownEvent): void => {
    this.eventQueue.push(e);
    if (this.eventQueue.length >= 200) void this.flush();
    else if (!this.timer) this.timer = setTimeout(() => void this.flush(), 500);
  };

  async flush(): Promise<void> {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (this.flushing || this.eventQueue.length === 0) return;
    this.flushing = true;
    const batch = this.eventQueue.splice(0, this.eventQueue.length);
    try {
      const { error } = await this.sb.from("events").insert(batch.map((e) => ({ town_id: this.townId, t: e.t, day: e.day, kind: e.kind, actors: e.actors, place: e.place ?? null, text: e.text, importance: e.importance, payload: e.payload ?? null })));
      if (error) console.error("events insert failed:", error.message);
    } finally { this.flushing = false; }
    if (this.eventQueue.length) void this.flush();
  }

  /** Snapshot every agent and the clock. Called at the end of each sim hour and on shutdown. */
  async snapshot(town: Town, strict = false): Promise<void> {
    await this.flush();
    const snap = town.snapshot();
    const agents = [...town.agents.values()].map((a) => this.agentRow(a));
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      this.sb.from("agents").upsert(agents, { onConflict: "id" }),
      this.sb.from("towns").update({ sim_t: town.t, day: town.day, weather: town.weather, flour_shortage: town.flourShortage, places: snap.places ?? [], jobs: snap.jobs ?? [], children: snap.children ?? [], civic: snap.civic ?? { mayor: null, elected: 0, works: [] } }).eq("id", this.townId),
    ]);
    if (strict && (e1 || e2)) throw new Error(`Snapshot failed: ${(e1 || e2)!.message}`);
    if (e1) console.error("agents upsert failed:", e1.message);
    if (e2) console.error("town update failed:", e2.message);
    const rels: { agent_id: string; town_id: string; other_id: string; trust: number; affection: number; last_seen: number; opinion: string }[] = [];
    for (const a of town.agents.values()) for (const [other, r] of a.relationships) rels.push({ agent_id: a.id, town_id: this.townId, other_id: other, trust: r.trust, affection: r.affection, last_seen: r.lastSeen, opinion: r.opinion });
    if (rels.length) { const { error } = await this.sb.from("relationships").upsert(rels, { onConflict: "agent_id,other_id" }); if (error && strict) throw new Error(`Relationships snapshot failed: ${error.message}`); if (error) console.error("relationships upsert failed:", error.message); }
  }

  /** Memories are appended, never rewritten. Pass only the ones written since the last call. */
  async appendMemories(a: AgentState, sinceT: number): Promise<void> {
    const rows = a.memory.filter((m) => m.t >= sinceT).map((m) => ({ agent_id: a.id, town_id: this.townId, t: m.t, kind: m.kind, text: m.text, importance: m.importance }));
    if (!rows.length) return;
    const { error } = await this.sb.from("memories").insert(rows);
    if (error) console.error("memories insert failed:", error.message);
  }

  /** The town as it was at the last snapshot, or null when nothing has been saved yet. */
  async loadSnapshot(): Promise<TownSnapshot | null> {
    const { data: town, error: townErr } = await this.sb.from("towns").select("sim_t, day, weather, flour_shortage, places, jobs, children, civic").eq("id", this.townId).maybeSingle();
    // a read that fails is not an empty record: seeding a new island over a bad read would overwrite the one that exists
    if (townErr) throw new Error(`the record could not be read: ${townErr.message}`);
    if (!town) return null;
    // Anything recorded after the last snapshot belongs to a timeline that is about to be re-lived. Drop it, or the record doubles.
    await this.sb.from("events").delete().eq("town_id", this.townId).gt("t", Number(town.sim_t));
    // the same for the post: a letter delivered after that minute goes back to undelivered, and a letter home the re-lived day never wrote is struck
    await this.sb.from("letters").update({ read_at: null }).eq("town_id", this.townId).eq("direction", "to_agent").gt("read_at", Number(town.sim_t));
    await this.sb.from("letters").delete().eq("town_id", this.townId).eq("direction", "to_owner").gt("t", Number(town.sim_t));
    const { data: ids0 } = await this.sb.from("agents").select("id").eq("town_id", this.townId);
    if (ids0?.length) await this.sb.from("memories").delete().in("agent_id", ids0.map((r) => r.id as string)).gt("t", Number(town.sim_t));
    const { data: rows, error } = await this.sb.from("agents").select("id, owner_id, name, persona, appearance, funded, arrived_t, state").eq("town_id", this.townId).is("left_t", null).not("arrived_t", "is", null);
    if (error) throw new Error(`the citizens could not be read: ${error.message}`); // never seed over a record that is merely unreadable
    if (!rows || rows.length === 0) return null;
    const ids = rows.map((r) => r.id as string);
    const [{ data: rels }, { data: mems }, { data: papers }, { data: laws }] = await Promise.all([
      this.sb.from("relationships").select("agent_id, other_id, trust, affection, last_seen, opinion").in("agent_id", ids),
      this.sb.from("memories").select("agent_id, t, kind, text, importance").in("agent_id", ids).order("t", { ascending: false }).limit(400 * ids.length),
      this.sb.from("papers").select("paper").eq("town_id", this.townId).order("edition", { ascending: false }).limit(14),
      this.sb.from("laws").select("text, proposed_by, yes, no, open").eq("town_id", this.townId),
    ]);
    const relBy = new Map<string, AgentSnapshot["relationships"]>(); for (const r of rels ?? []) (relBy.get(r.agent_id) ?? relBy.set(r.agent_id, []).get(r.agent_id)!).push({ other: r.other_id, trust: r.trust, affection: r.affection, lastSeen: Number(r.last_seen), opinion: r.opinion });
    const memBy = new Map<string, AgentSnapshot["memory"]>(); for (const m of mems ?? []) (memBy.get(m.agent_id) ?? memBy.set(m.agent_id, []).get(m.agent_id)!).push({ t: Number(m.t), kind: m.kind, text: m.text, importance: m.importance });
    const agents: AgentSnapshot[] = rows.map((r) => {
      const st = (r.state ?? {}) as Partial<AgentSnapshot["state"]>;
      return {
        id: r.id, persona: r.persona as AgentSnapshot["persona"], owner: r.owner_id ?? (st as { owner?: string | null }).owner ?? null, funded: r.funded, appearance: (r.appearance as Record<string, unknown>) ?? null, arrivedAt: Number(r.arrived_t),
        // whatever the engine put in state comes back; the defaults are only for a row written before the field existed
        state: { ...st, needs: st.needs ?? { hunger: 0.3, rest: 0.2, social: 0.4 }, location: st.location ?? "harbor", coins: st.coins ?? 40, inventory: st.inventory ?? [], job: st.job ?? null, home: st.home ?? null, asleep: st.asleep ?? false, budget: st.budget ?? { tier1Max: 50, tier2Max: 5, tier1Left: 50, tier2Left: 5 }, intentions: st.intentions ?? [], plan: st.plan ?? null, debts: st.debts ?? [], starving: st.starving ?? 0, roofless: st.roofless ?? 0, rumors: st.rumors ?? [], letters: st.letters ?? [] },
        relationships: relBy.get(r.id) ?? [],
        memory: compress((memBy.get(r.id) ?? []).reverse()),
      };
    });
    return {
      t: Number(town.sim_t), day: town.day, weather: town.weather, flourShortage: town.flour_shortage,
      places: (town.places ?? []) as NonNullable<TownSnapshot["places"]>, jobs: (town.jobs ?? []) as NonNullable<TownSnapshot["jobs"]>, children: (town.children ?? []) as NonNullable<TownSnapshot["children"]>, ...(town.civic ? { civic: town.civic as NonNullable<TownSnapshot["civic"]> } : {}),
      agents, papers: (papers ?? []).map((p) => p.paper as Paper).reverse(),
      laws: (laws ?? []).map((l) => ({ text: l.text, by: l.proposed_by ?? "", yes: l.yes, no: l.no, open: l.open })),
    };
  }

  /** The tail of the record, so the street feed is not empty after a restart. */
  async recentEvents(n = 300): Promise<TownEvent[]> {
    const { data, error } = await this.sb.from("events").select("id, t, day, kind, actors, place, text, importance, payload").eq("town_id", this.townId).order("id", { ascending: false }).limit(n);
    if (error || !data) return [];
    return data.reverse().map((r) => ({ id: Number(r.id), t: Number(r.t), day: r.day, kind: r.kind as TownEvent["kind"], actors: r.actors, text: r.text, importance: r.importance, ...(r.place ? { place: r.place } : {}), ...(r.payload ? { payload: r.payload as Record<string, unknown> } : {}) }));
  }

  async markLeft(agentId: string, t: number): Promise<void> {
    const { error } = await this.sb.from("agents").update({ left_t: t }).eq("id", agentId);
    if(error)throw new Error(`Could not record departure: ${error.message}`);
  }
  async saveInstructions(agentId: string, text: string): Promise<void> {
    await this.sb.from("standing_instructions").upsert({ agent_id: agentId, text, updated_at: new Date().toISOString() }, { onConflict: "agent_id" });
  }
  /** Everything on the record about one person: for the book after they leave, and for the owner's profile. */
  async lifeOf(agentId: string): Promise<{ events: TownEvent[]; memories: { t: number; kind: string; text: string; importance: number }[]; letters: { direction: string; text: string; t: number }[] }> {
    const [{ data: ev }, { data: mem }, { data: let_ }] = await Promise.all([
      this.sb.from("events").select("id, t, day, kind, actors, place, text, importance, payload").eq("town_id", this.townId).contains("actors", [agentId]).order("t", { ascending: true }).limit(2000),
      this.sb.from("memories").select("t, kind, text, importance").eq("agent_id", agentId).order("t", { ascending: true }).limit(3000),
      this.sb.from("letters").select("direction, text, t").eq("agent_id", agentId).order("t", { ascending: true }),
    ]);
    return {
      events: (ev ?? []).map((r) => ({ id: Number(r.id), t: Number(r.t), day: r.day, kind: r.kind as TownEvent["kind"], actors: r.actors, text: r.text, importance: r.importance, ...(r.place ? { place: r.place } : {}), ...(r.payload ? { payload: r.payload as Record<string, unknown> } : {}) })),
      memories: (mem ?? []).map((m) => ({ t: Number(m.t), kind: m.kind, text: m.text, importance: m.importance })),
      letters: (let_ ?? []).map((l) => ({ direction: l.direction, text: l.text, t: Number(l.t) })),
    };
  }
  async deleteOwner(ownerId: string): Promise<void> {
    const waitingDelete=await this.sb.from("waiting_citizens").delete().eq("owner_id",ownerId);
    if(waitingDelete.error)throw new Error("Could not remove private waiting data");
    for(const table of ["credit_settings","subscription_citizens"]){const {error}=await this.sb.from(table).delete().eq("owner_id",ownerId);if(error)throw new Error("Could not remove private billing settings");}
    await this.sb.from("letters").delete().eq("owner_id", ownerId);
    await this.sb.from("owner_prefs").delete().eq("owner_id", ownerId);
    await this.sb.from("owner_reads").delete().eq("owner_id", ownerId);
    await this.sb.from("agents").update({ owner_id: null }).eq("owner_id", ownerId);
    await this.sb.auth.admin.deleteUser(ownerId);
  }

  /** Per-agent minds. The key column is readable by the service role only; there are no RLS policies on this table. */
  async loadBrains(): Promise<BrainRow[]> {
    // only the minds of people on this island; ids are unique per island now, but the record predates that
    const { data: mine } = await this.sb.from("agents").select("id").eq("town_id", this.townId);
    const ids = new Set((mine ?? []).map((r) => r.id as string));
    const { data, error } = await this.sb.from("agent_brains").select("agent_id, kind, provider, api_key, models, think_every, daily_cap_usd, token, memory");
    if (error) { console.error("brains read failed:", error.message); return []; }
    return ((data ?? []) as BrainRow[]).filter((r) => ids.has(r.agent_id));
  }
  async waitingCitizens():Promise<AgentSnapshot[]> {
    const {data,error}=await this.sb.from("waiting_citizens").select("snapshot").eq("town_id",this.townId);
    if(error)throw new Error("Could not read waiting citizens");return (data??[]).map(r=>r.snapshot as AgentSnapshot);
  }
  async parkCitizens(agents:AgentSnapshot[]):Promise<void> {
    if(!agents.length)return;
    const {error}=await this.sb.from("waiting_citizens").upsert(agents.map(a=>({agent_id:a.id,town_id:this.townId,owner_id:a.owner,snapshot:a})),{onConflict:"agent_id"});
    if(error)throw new Error("Could not preserve waiting citizens; no cleanup performed");
  }
  async resumeCitizen(staged:Town,id:string):Promise<void> {
    const a=staged.agents.get(id)!;const {error}=await this.sb.rpc("resume_waiting_citizen",{p_agent:{...this.agentRow(a),brain:a.brainKind}});
    if(error)throw new Error("Could not resume citizen; please retry");
  }
  async admitCitizen(staged: Town, id: string, brain: BrainRow|null): Promise<void> {
    const a=staged.agents.get(id);if(!a)throw new Error("Missing staged citizen");
    const {error}=await this.sb.rpc("admit_citizen",{p_agent:{...this.agentRow(a),brain:a.brainKind},p_brain:brain});
    if(error)throw new Error("Could not save boarding. Your draft is safe; please retry.");
  }
  async saveBrain(row: BrainRow): Promise<void> {
    const { error } = await this.sb.from("agent_brains").upsert({ ...row, town_id: this.townId }, { onConflict: "agent_id" });
    if (error) throw new Error("Could not save brain settings. Please retry.");
  }

  async subscriptionCitizens(): Promise<SubscriptionCitizen[]> {
    const {data,error}=await this.sb.from("subscription_citizens").select("agent_id,owner_id,grandfathered,subscription_id");
    if(error)throw new Error("Subscription assignments could not be loaded.");
    return (data??[]).map(r=>({agentId:r.agent_id,ownerId:r.owner_id,grandfathered:r.grandfathered,subscriptionId:r.subscription_id}));
  }
  async subscriptionAvailable(ownerId:string,agentId:string):Promise<boolean>{
    const {data,error}=await this.sb.rpc("subscription_available",{p_owner:ownerId,p_agent:agentId});
    if(error)throw new Error("Could not check subscription assignment.");return data===true;
  }
  async claimSubscription(ownerId:string,agentId:string,subscriptionId:string|null=null):Promise<void> {
    const {error}=await this.sb.rpc("claim_subscription_citizen",{p_owner:ownerId,p_agent:agentId,p_subscription:subscriptionId});
    if(error)throw new Error("Your subscription is already assigned or unavailable. Use your own key or external brain for another citizen.");
  }
  async creditSpending(ownerId:string):Promise<CreditSpending> {
    const {data,error}=await this.sb.rpc("credit_spending",{p_owner:ownerId});
    if(error)throw new Error("Could not load credit spending controls.");return data as CreditSpending;
  }
  async setCreditSpending(ownerId:string,autoSpend:boolean,dailyLimit:number|null):Promise<void> {
    const {error}=await this.sb.from("credit_settings").upsert({owner_id:ownerId,auto_spend:autoSpend,daily_limit:dailyLimit,updated_at:new Date().toISOString()});
    if(error)throw new Error("Could not save credit spending controls.");
  }
  async changeCredits(ownerId:string,delta:number,reason:string,ref:string|null,operationId:string,refundOf:string|null=null):Promise<{ok:boolean;credits:number}> {
    const {data,error}=await this.sb.rpc("change_credits",{p_owner:ownerId,p_delta:delta,p_reason:reason,p_ref:ref,p_operation:operationId,p_refund:refundOf});
    if(error)throw new Error("Credit transaction could not be confirmed.");return data as {ok:boolean;credits:number};
  }
  async wallet(ownerId: string): Promise<Wallet> {
    const { data } = await this.sb.from("owner_wallets").select("owner_id, plan, credits, stripe_customer").eq("owner_id", ownerId).maybeSingle();
    return data ? { ownerId: data.owner_id, plan: data.plan, credits: data.credits, stripeCustomer: data.stripe_customer } : { ownerId, plan: "none", credits: 0, stripeCustomer: null };
  }
  async saveWallet(w: Wallet): Promise<void> {
    const seed = await this.sb.from("owner_wallets").upsert({owner_id:w.ownerId,plan:"none",credits:0},{onConflict:"owner_id",ignoreDuplicates:true});
    if(seed.error)throw new Error("Wallet could not be initialized.");
    const { error } = await this.sb.from("owner_wallets").update({plan:w.plan,stripe_customer:w.stripeCustomer,updated_at:new Date().toISOString()}).eq("owner_id",w.ownerId);
    if (error) throw new Error("Wallet metadata could not be saved.");
  }
  async ledger(ownerId: string, n = 30): Promise<{ delta: number; reason: string; ref: string | null; at: string }[]> {
    const { data } = await this.sb.from("credit_ledger").select("delta, reason, ref, created_at").eq("owner_id", ownerId).order("id", { ascending: false }).limit(n);
    return (data ?? []).map((r) => ({ delta: r.delta, reason: r.reason, ref: r.ref, at: r.created_at }));
  }
  async credit(ownerId: string, delta: number, reason: string, ref: string | null = null): Promise<void> {
    await this.sb.from("credit_ledger").insert({ owner_id: ownerId, delta, reason, ref });
  }
  async allWallets(): Promise<Wallet[]> {
    const { data } = await this.sb.from("owner_wallets").select("owner_id, plan, credits, stripe_customer");
    return (data ?? []).map((d) => ({ ownerId: d.owner_id, plan: d.plan, credits: d.credits, stripeCustomer: d.stripe_customer }));
  }

  /** Every event between two minutes, for sealing and verifying a day. */
  async eventsBetween(from: number, to: number): Promise<TownEvent[]> {
    const { data } = await this.sb.from("events").select("id, t, day, kind, actors, place, text, importance, payload").eq("town_id", this.townId).gte("t", from).lt("t", to).order("id", { ascending: true }).limit(20000);
    return (data ?? []).map((r) => ({ id: Number(r.id), t: Number(r.t), day: r.day, kind: r.kind as TownEvent["kind"], actors: r.actors, text: r.text, importance: r.importance, ...(r.place ? { place: r.place } : {}), ...(r.payload ? { payload: r.payload as Record<string, unknown> } : {}) }));
  }
  /** The drawing of a building a citizen described. */
  async saveLook(row: { hash: string; look: string; svg: string; source: string }): Promise<void> { const { error } = await this.sb.from("looks").upsert({ town_id: this.townId, hash: row.hash, look: row.look, svg: row.svg, source: row.source }, { onConflict: "town_id,hash" }); if (error) console.error("look save failed:", error.message); }
  async loadLook(hash: string): Promise<{ look: string; svg: string } | null> { const { data } = await this.sb.from("looks").select("look, svg").eq("town_id", this.townId).eq("hash", hash).maybeSingle(); return data ? { look: data.look, svg: data.svg } : null; }
  async listLooks(): Promise<{ hash: string; look: string; created_at: string }[]> { const { data } = await this.sb.from("looks").select("hash, look, created_at").eq("town_id", this.townId).order("created_at", { ascending: false }).limit(200); return (data ?? []).map((r) => ({ hash: r.hash, look: r.look, created_at: r.created_at })); }
  /** The book of a life, on the shelf for anyone to read. */
  async saveLife(row: LifeRow): Promise<void> {
    const { error } = await this.sb.from("lives").upsert({ town_id: this.townId, agent_id: row.agentId, name: row.name, title: row.title, text: row.text, epitaph: row.epitaph, how: row.how, arrived_day: row.arrivedDay, left_day: row.leftDay }, { onConflict: "town_id,agent_id" });
    if (error) console.error("life save failed:", error.message);
  }
  async lives(): Promise<LifeRow[]> {
    const { data } = await this.sb.from("lives").select("agent_id, name, title, text, epitaph, how, arrived_day, left_day").eq("town_id", this.townId).order("left_day", { ascending: false }).limit(200);
    return (data ?? []).map((r) => ({ agentId: r.agent_id, name: r.name, title: r.title, text: r.text, epitaph: r.epitaph, how: r.how as LifeRow["how"], arrivedDay: r.arrived_day, leftDay: r.left_day }));
  }
  async life(agentId: string): Promise<LifeRow | null> {
    const { data } = await this.sb.from("lives").select("agent_id, name, title, text, epitaph, how, arrived_day, left_day").eq("town_id", this.townId).eq("agent_id", agentId).maybeSingle();
    return data ? { agentId: data.agent_id, name: data.name, title: data.title, text: data.text, epitaph: data.epitaph, how: data.how as LifeRow["how"], arrivedDay: data.arrived_day, leftDay: data.left_day } : null;
  }
  async savePaper(paper: Paper): Promise<void> {
    const { error } = await this.sb.from("papers").upsert({ town_id: this.townId, edition: paper.edition, paper }, { onConflict: "town_id,edition" });
    if (error) console.error("paper upsert failed:", error.message);
  }

  /** A letter on the record. `readAt` is set when the engine already delivered it, so the hourly replay does not deliver it again. */
  async saveLetter(agentId: string, ownerId: string | null, direction: "to_agent" | "to_owner", text: string, t: number, readAt: number | null = null): Promise<void> {
    const { error } = await this.sb.from("letters").insert({ agent_id: agentId, town_id: this.townId, owner_id: ownerId && /^[0-9a-f-]{36}$/.test(ownerId) ? ownerId : null, direction, text, t, read_at: readAt }); // dev owners are names, not ids
    if (error) console.error("letter insert failed:", error.message);
  }

  /** Letters written straight into the record (another process, the web app's own insert) that the engine has not delivered yet. */
  async undeliveredLetters(): Promise<{ id: number; agent_id: string; text: string }[]> {
    const { data, error } = await this.sb.from("letters").select("id, agent_id, text").eq("town_id", this.townId).eq("direction", "to_agent").is("read_at", null);
    if (error) { console.error("letters read failed:", error.message); return []; }
    return data ?? [];
  }
  async markDelivered(ids: number[], t: number): Promise<void> {
    if (!ids.length) return;
    await this.sb.from("letters").update({ read_at: t }).eq("town_id", this.townId).in("id", ids);
  }

  /** What an owner asked to be told by mail. Defaults are on: a morning digest and a note when their citizen writes. */
  async ownerPrefs(ownerId: string): Promise<OwnerPrefs> {
    const { data } = await this.sb.from("owner_prefs").select("owner_id, notify_digest, notify_letters, last_mailed_day").eq("owner_id", ownerId).maybeSingle();
    return data ? { ownerId: data.owner_id, notifyDigest: data.notify_digest, notifyLetters: data.notify_letters, lastMailedDay: data.last_mailed_day } : { ownerId, notifyDigest: true, notifyLetters: true, lastMailedDay: null };
  }
  async saveOwnerPrefs(p: OwnerPrefs): Promise<void> {
    const { error } = await this.sb.from("owner_prefs").upsert({ owner_id: p.ownerId, notify_digest: p.notifyDigest, notify_letters: p.notifyLetters, last_mailed_day: p.lastMailedDay, updated_at: new Date().toISOString() }, { onConflict: "owner_id" });
    if (error) console.error("prefs save failed:", error.message);
  }
  /** Where the owner's email lives: the owners row the sign-in trigger fills, or the auth record behind it. Dev names have none. */
  async ownerEmail(ownerId: string): Promise<string | null> {
    if (!/^[0-9a-f-]{36}$/.test(ownerId)) return null;
    const { data } = await this.sb.from("owners").select("email").eq("id", ownerId).maybeSingle();
    if (data?.email) return data.email as string;
    const { data: u } = await this.sb.auth.admin.getUserById(ownerId).catch(() => ({ data: { user: null } }));
    return u?.user?.email ?? null;
  }
  /** The owner's reading of one citizen: the digest watermark and the last day a letter notice went out. */
  async ownerRead(ownerId: string, agentId: string): Promise<OwnerRead> {
    const { data } = await this.sb.from("owner_reads").select("last_digest_t, last_letter_mail_day").eq("owner_id", ownerId).eq("agent_id", agentId).maybeSingle();
    return { ownerId, agentId, lastDigestT: data?.last_digest_t == null ? null : Number(data.last_digest_t), lastLetterMailDay: data?.last_letter_mail_day ?? null };
  }
  async saveOwnerRead(r: OwnerRead): Promise<void> {
    const { error } = await this.sb.from("owner_reads").upsert({ owner_id: r.ownerId, agent_id: r.agentId, last_digest_t: r.lastDigestT, last_letter_mail_day: r.lastLetterMailDay, updated_at: new Date().toISOString() }, { onConflict: "owner_id,agent_id" });
    if (error) console.error("read save failed:", error.message);
  }

  /** Agents boarded through the web app that the engine has not admitted yet: state is null until the boat docks. */
  async pendingArrivals(): Promise<{ id: string; owner_id: string | null; name: string; persona: unknown; appearance: unknown; brain: string }[]> {
    const { data, error } = await this.sb.from("agents").select("id, owner_id, name, persona, appearance, brain").eq("town_id", this.townId).is("arrived_t", null);
    if (error) { console.error("arrivals read failed:", error.message); return []; }
    return data ?? [];
  }

  private agentRow(a: AgentState) {
    return {
      id: a.id, town_id: this.townId, owner_id: a.owner && /^[0-9a-f-]{36}$/.test(a.owner) ? a.owner : null, name: a.persona.name, persona: a.persona,
      appearance: a.appearance ?? {},
      brain: "hosted", funded: a.funded, arrived_t: a.arrivedAt,
      // the same fields the engine snapshots, or a restart on Postgres quietly forgets who someone was becoming
      state: { desires: structuredClone(a.desires ?? []), skills: structuredClone(a.skills ?? []), practice: structuredClone(a.practice ?? null), lastSkillTrialDay: a.lastSkillTrialDay ?? -1, foodLessons: structuredClone(a.foodLessons ?? []), foodAdvice: structuredClone(a.foodAdvice ?? []), foodRoutineDecisions: structuredClone(a.foodRoutineDecisions ?? []), deals: a.deals.filter((d) => d.state === "offered" || d.state === "open"), needs: a.needs, location: a.location, coins: a.coins, inventory: a.inventory, job: a.job, home: a.home, asleep: a.asleep, budget: a.budget, intentions: a.intentions, rumors: a.rumors.slice(-5), letters: a.letters.filter((l) => !l.read || (!l.answered && asksSomething(l.text))), lastConversation: a.lastConversation, lastThought: a.lastThought, instructions: a.instructions, owner: a.owner, plan: a.plan, lastPlan: a.lastPlan, debts: a.debts, starving: a.starving, roofless: a.roofless, brainKind: a.brainKind, thinkEvery: a.thinkEvery, convictions: a.convictions, secretsKnown: a.secretsKnown, watch: a.watch, selves: a.selves, lastSelfDay: a.lastSelfDay, projects: a.projects, beliefs: a.beliefs, trustLog: a.trustLog.slice(-60), replyTo: a.replyTo, lastHungerThought: a.lastHungerThought, starvingThoughtDay: a.starvingThoughtDay, debtThoughtDay: a.debtThoughtDay, gatheringThoughtId: a.gatheringThoughtId },
    };
  }
}

export { FileStore } from "./file.ts";
export type { Store } from "./file.ts";
