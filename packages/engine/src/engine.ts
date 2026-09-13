import { recordEvolution, type EvolutionStory } from "./evolution.ts";
import { skillId, achieved, importedSkill, type SkillMeasure } from "./skills.ts";
import { recordPurchase, foodExperience, teachable, ADVICE_LIFETIME } from "./learning.ts";
import { recordBuildingMoment } from "./building-history.ts";
import type { Action, ActionProposal, AgentId, PlaceId, Perception, TownEvent, EventKind, Persona, Paper, Reflection, DayPlan, Child, Passenger } from "@unwatched/protocol";
import { OPTIONS_DEFAULT } from "@unwatched/protocol";
import { Rng } from "./rng.ts";
import type { AgentState, Deal, Brain, Budget, EventSink, Job, Place, Tier, Memory, TownSnapshot, AgentSnapshot, DigestContext, LifeContext, Gathering, Seal, JudgeContext, Rule } from "./types.ts";
import { makeJobs, makePlaces, FOOD_ITEMS, PERISHABLE, MINUTES_PER_DAY, SEASONS, BUILDS, GARDEN, WORKS, buildKind, lookHash, siteName, stockShelf, ISLAND, type WorldPack } from "./world.ts";
import { retrieve, compress, age, drift, memoryForMind } from "./memory.ts";
import { sha256, canonicalEvent } from "./hash.ts";
import { validate } from "./validator.ts";
import { habit } from "./habit.ts";
import { salience, wantsConversation, dueThought } from "./salience.ts";

export interface TownOptions {
  seed: number;
  learning?: boolean;
  brain: Brain;
  /** Letters that go into every new citizen's id, so two islands sharing one record can never mint the same person. */
  idPrefix?: string;
  /** The island itself: places, roads, jobs. The default pack is the island; a fork can be another. */
  pack?: WorldPack;
  /** Island days from birth to citizenship. */
  ageOfMajority?: number;
  /** This island's name, printed on tickets and carried by passengers. */
  name?: string;
  /** Other islands a boat runs to, and how to put someone on it. Resolves true when they arrived there. */
  harbors?: { id: string; name: string }[];
  onDepart?: (passenger: Passenger, to: string) => Promise<boolean>;
  /** Sim minutes per tick. 1 is the real town. Higher is coarser, not just faster. */
  minutesPerTick?: number;
  startDay?: number;
  onEvent?: EventSink;
  log?: (line: string) => void;
  /** Asked when an agent's daily allowance is spent. Return true to pay for the thought from the owner's credits. */
  creditBank?: (agent: AgentState, tier: Tier) => boolean;
  creditRefund?: (agent: AgentState, tier: Tier) => void;
}

export interface AddAgentOptions {
  persona: Persona;
  funded?: boolean;
  owner?: string | null;
  budget?: Partial<Budget>;
  coins?: number;
}

const WEATHERS = ["clear", "clear", "clear", "rain", "rain", "wind", "fog", "storm"] as const; // "snow" only ever comes from the real sky

/** Work that happens under the sky: the weather takes its share of what these places make. */
const OUTDOOR_WORK = new Set(["fishhouse", "fields", "orchard", "quarry", "pinewood", "sawpit"]);

export class Town {
  private retryAt = new Map<string, number>();
  private creditRefund: ((agent: AgentState, tier: Tier) => void) | undefined;
  readonly rng: Rng;
  readonly brain: Brain;
  readonly pack: WorldPack;
  readonly places: Map<string, Place>;
  readonly jobs: Map<string, Job>;
  readonly agents = new Map<AgentId, AgentState>();
  readonly events: TownEvent[] = [];
  readonly laws: { text: string; by: AgentId; yes: number; no: number; open: boolean; voters?: AgentId[] }[] = [];
  /** The institutions. The mayor is whoever the island trusts most, chosen on council day; the works are what the council has paid for. */
  mayor: AgentId | null = null; electedDay = 0; works: string[] = [];
  /** What the town will come to, and what it has: weddings, funerals, hearings, elections, feasts. */
  gatherings: Gathering[] = []; wedded = new Set<string>(); private nextGatheringId = 1;
  /** Free deeds waiting for the town's mind to say what they came to. */
  private deeds: { a: AgentState; what: string; with: AgentState | null; place: Place }[] = [];
  /** Laws with teeth, and the words the island keeps. */
  evolution: EvolutionStory[] = [];
  rules: Rule[] = []; sayings: { text: string; by: AgentId[] }[] = [];
  /** The chain of seals: one per day, each hashing the day's events and the seal before it. Nothing is invented, and this is how anyone can check. */
  chain: Seal[] = [];
  t = 0;
  day: number;
  weather: string = "clear";
  flourShortage = false;
  papers: Paper[] = [];
  /** Where the weather comes from: the island's own dice, or a real sky that the server sets. */
  weatherSource: "roll" | "real" = "roll";
  /** The air, in degrees, when a real sky is watched. */
  temperatureC: number | null = null;
  /** A season set from the real calendar, when the island keeps our time. */
  seasonOverride: string | null = null;
  /** The hours the boat docks. Hourly from six to eight by default; a real timetable when the island keeps our time. */
  boatTimes: number[] = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
  /** Other islands, by id, that a boat crosses to. */
  harbors: { id: string; name: string }[];
  name: string;
  private onDepart: ((passenger: Passenger, to: string) => Promise<boolean>) | null;
  private sailing: { a: AgentState; to: string; why: string | null }[] = [];
  /** Children of the island, growing up in their parents' houses until they come of age. */
  readonly children: Child[] = [];
  /** Island days from birth to citizenship. Twenty by default; tests shorten it. */
  ageOfMajority: number;
  /** Ops switches. Each flip is an act of God and gets printed. */
  paused = false; economyFrozen = false; boatHeld = false;
  /** Coins that entered the island (arrivals, the mainland paying for produce) and left it (departures), so the books can be checked. */
  minted = 0; burned = 0;
  private nextId = 1;
  private idPrefix = "";
  private nextEventId = 1;
  private nextLetterId = 1;
  private nextDealId = 1;
  private arrivalsToday = 0;
  private departuresToday = 0;
  private readonly minutesPerTick: number;
  private readonly onEvent: EventSink | undefined;
  private readonly log: (line: string) => void;
  private readonly creditBank: ((agent: AgentState, tier: Tier) => boolean) | undefined;
  private readonly conversationPairsThisTick = new Set<string>();

  readonly learning: boolean;
  constructor(opts: TownOptions) {
    this.learning = opts.learning ?? true;
    this.idPrefix = (opts.idPrefix ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
    this.pack = opts.pack ?? ISLAND; this.places = makePlaces(this.pack); this.jobs = makeJobs(this.pack);
    this.ageOfMajority = opts.ageOfMajority ?? 20;
    this.harbors = opts.harbors ?? []; this.name = opts.name ?? "The island"; this.onDepart = opts.onDepart ?? null;
    this.rng = new Rng(opts.seed);
    this.brain = opts.brain;
    this.minutesPerTick = opts.minutesPerTick ?? 1;
    this.day = opts.startDay ?? 1;
    this.onEvent = opts.onEvent;
    this.log = opts.log ?? (() => {});
    this.creditBank = opts.creditBank; this.creditRefund = opts.creditRefund;
    this.t = (this.day - 1) * MINUTES_PER_DAY + 6 * 60; // towns start at 06:00
    this.weather = this.rollWeather();
  }

  // ---------- time ----------
  get minuteOfDay(): number { return this.t % MINUTES_PER_DAY; }
  get hour(): number { return Math.floor(this.minuteOfDay / 60); }
  get season(): string { return this.seasonOverride ?? SEASONS[Math.floor(((this.day - 1) % 360) / 90)] ?? "autumn"; }
  /** The week and the month, from the real calendar when the island keeps our time, else from the island's own days. Sunday is 0. */
  weekdayOverride: number | null = null; dayOfMonthOverride: number | null = null; monthOverride: number | null = null;
  /** The month, 1 to 12: the real one when the island keeps our time, else twelve months of thirty days from the island's first day. */
  get month(): number { return this.monthOverride ?? (Math.floor(((this.day - 1) % 360) / 30) + 1); }
  /** The calendar for any day, as the island keeps it: twelve months of thirty days, weeks of seven. */
  monthOf(day: number): number { return Math.floor(((day - 1) % 360) / 30) + 1; }
  dayOfMonthOf(day: number): number { return ((day - 1) % 30) + 1; }
  /** What is in season this month: crops with a short window. */
  inSeason(): string[] { return [...new Set(this.pack.produce.filter((pr) => pr.months?.includes(this.month)).map((pr) => pr.makes))]; }
  /** Today's feast, if the island keeps one today. */
  feastToday(): { name: string; place: string } | null { const f = this.pack.feasts.find((x) => x.month === this.month && x.day === this.dayOfMonth); return f ? { name: f.name, place: f.place } : null; }
  get weekday(): number { return this.weekdayOverride ?? (this.day - 1) % 7; }
  get dayOfMonth(): number { return this.dayOfMonthOverride ?? ((this.day - 1) % 30) + 1; }
  get weekdayName(): string { return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][this.weekday]!; }
  /** What kind of day it is, when it is not an ordinary one. */
  get occasion(): string | null {
    const feast = this.feastToday(); if (feast) return `${feast.name}: no shifts after noon, a feast at ${this.places.get(feast.place)?.name ?? feast.place} at one, everyone fed`;
    if (this.dayOfMonth === 1) return "council day: the mayor is chosen at the council hall and the month's business is done";
    if (this.weekday === 0) return "Sunday: no shifts, the chapel bell rings at ten";
    if (this.weekday === 6) return "market day: the square is full and prices are a coin lower";
    return null;
  }
  /** The real sky, or the ops room, sets the weather; it is news when it changes. */
  setWeather(w: string, note?: string): void {
    if (w === this.weather) return; this.weather = w;
    this.emit("weather.change", [], undefined, note ?? `The weather turned to ${w}.`, w === "storm" ? 0.5 : 0.1);
  }
  /** The next hour the boat docks, and whether that is tomorrow. */
  nextBoat(): { hour: number; tomorrow: boolean } {
    const later = this.boatTimes.filter((h) => h > this.hour).sort((a, b) => a - b)[0];
    return later !== undefined ? { hour: later, tomorrow: false } : { hour: [...this.boatTimes].sort((a, b) => a - b)[0] ?? 6, tomorrow: true };
  }
  /** Let minutes pass without anyone thinking: the island catching up with the real clock after a slow stretch or a restart. */
  skip(minutes: number): void {
    for (let i = 0; i < minutes; i++) { for (const a of this.agents.values()) this.decayNeeds(a); const prev = this.hour; this.t += 1; if (this.hour !== prev) this.hourly(); }
    // a skip across midnight is a night the island slept through: no paper, no hunger count, but the date moves
    const d = Math.floor(this.t / MINUTES_PER_DAY) + 1; if (d !== this.day) { this.day = d; this.arrivalsToday = 0; this.departuresToday = 0; }
  }
  clock(t = this.t): string {
    const d = Math.floor(t / MINUTES_PER_DAY) + 1; const m = t % MINUTES_PER_DAY;
    return `day ${d} ${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  }

  // ---------- population ----------
  addAgent(o: AddAgentOptions, fixedId?: string): AgentState {
    const id = fixedId ?? `ag_${this.idPrefix}${(this.nextId++).toString(36)}`;
    const a: AgentState = {
      id, persona: o.persona,
      needs: { hunger: 0.3, rest: 0.2, social: 0.4 },
      location: "harbor", coins: o.coins ?? 40, inventory: ["suitcase"], job: null,
      home: { place: "inn", nightsPaid: 3 }, asleep: false, arrivedAt: this.t,
      skills: [], practice: null, relationships: new Map(), memory: [], foodAdvice: [], foodLessons: [], foodRoutineDecisions: [],
      budget: { tier1Max: 50, tier2Max: 5, tier1Left: 50, tier2Left: 5, ...o.budget },
      plan: null, lastPlan: null, debts: [], deals: [], hint: null, crossroads: null, ownerLetterDay: 0, heading: null, starving: 0, roofless: 0, convictions: 0, secretsKnown: {}, seek: null, watch: [], selves: [], lastSelfDay: 0, doToday: 0, projects: [], beliefs: [],
      funded: o.funded ?? true, owner: o.owner ?? null, letters: [], intentions: [],
      lastConversation: -999, lastThought: -999, heard: [], workedToday: false, rumors: [], appearance: null, instructions: "", brainKind: "hosted", thinkEvery: null,
      seenToday: [], trustDawn: {}, trustLog: [], lastHungerThought: -999, starvingThoughtDay: 0, debtThoughtDay: 0, gatheringThoughtId: null, replyTo: null,
    };
    const inn = this.places.get("inn")!; inn.freeBeds = Math.max(0, (inn.freeBeds ?? 0) - 1);
    this.agents.set(id, a);
    this.remember(a, `Stepped off the boat with a suitcase and ${a.coins} coins. Three nights paid at the harbor inn.`, 0.7);
    this.emit("agent.arrive", [id], "harbor", `${a.persona.name} arrived on the boat.`, 0.5);
    this.arrivalsToday++; this.minted += a.coins;
    return a;
  }

  /** Bring the town back from its record. Replaces whatever population exists. */
  restore(snap: TownSnapshot): void {
    this.t = snap.t; this.day = Math.floor(snap.t / MINUTES_PER_DAY) + 1; this.weather = snap.weather; this.flourShortage = snap.flourShortage; // the minute counter is the truth; the day follows it
    this.agents.clear();
    for (const j of this.jobs.values()) j.holders = [];
    // what people built, over the map the code lays out: the code owns positions and roads, the record owns everything else
    for (const sp of snap.places ?? []) {
      const p = this.places.get(sp.id);
      if (p) { if(sp.institution)p.institution=structuredClone(sp.institution);else delete p.institution; if (sp.community) p.community = structuredClone(sp.community); else delete p.community; if (sp.history) p.history = structuredClone(sp.history); else delete p.history; p.name = sp.name; p.kind = sp.kind; p.sells = sp.sells; p.owner = sp.owner ?? null; p.site = structuredClone(sp.site ?? null); p.treasury = sp.treasury ?? p.treasury; if (sp.stock) p.stock = { ...sp.stock }; if (sp.look) p.look = sp.look; else delete p.look; if (sp.brokenUntil) p.brokenUntil = sp.brokenUntil; if (sp.beds) p.beds = sp.beds; else delete p.beds; if (sp.sprite) p.sprite = sp.sprite; }
    }
    for (const p of this.places.values()) stockShelf(this.pack, p); // a record from before shelves were counted gets its counts now
    for (const sj of snap.jobs ?? []) if (!this.jobs.has(sj.id) && this.places.has(sj.place)) this.jobs.set(sj.id, { ...sj, holders: [] });
    for (const p of this.places.values()) if (p.beds) p.freeBeds = p.beds.capacity;
    let maxId = 0;
    for (const sa of snap.agents) {
      const a: AgentState = {
        id: sa.id, persona: sa.persona,
        needs: { ...sa.state.needs }, location: this.places.has(sa.state.location) ? sa.state.location : "harbor",
        coins: sa.state.coins, inventory: [...sa.state.inventory], job: sa.state.job && this.jobs.has(sa.state.job) ? sa.state.job : null,
        home: sa.state.home, asleep: sa.state.asleep, arrivedAt: sa.arrivedAt,
        relationships: new Map(sa.relationships.map((r) => [r.other, { trust: r.trust, affection: r.affection, lastSeen: r.lastSeen, opinion: r.opinion, lastPlace: (r as { lastPlace?: string | null }).lastPlace ?? null }])),
        skills: structuredClone(sa.state.skills ?? []), practice: structuredClone(sa.state.practice ?? null), lastSkillTrialDay: sa.state.lastSkillTrialDay ?? -1, foodAdvice: structuredClone(sa.state.foodAdvice ?? []), foodLessons: structuredClone(sa.state.foodLessons ?? []), foodRoutineDecisions: structuredClone(sa.state.foodRoutineDecisions ?? []),
        memory: [...sa.memory].sort((x, y) => x.t - y.t),
        budget: { ...sa.state.budget }, funded: sa.funded, owner: sa.owner, letters: sa.state.letters ?? [], intentions: [...sa.state.intentions],
        deals: [...(sa.state.deals ?? [])], lastConversation: sa.state.lastConversation ?? -999, lastThought: sa.state.lastThought ?? -999, heard: [], workedToday: false, rumors: [...sa.state.rumors], appearance: sa.appearance, instructions: sa.state.instructions ?? "", brainKind: sa.state.brainKind ?? "hosted", thinkEvery: sa.state.thinkEvery ?? null, plan: sa.state.plan ?? null, lastPlan: sa.state.lastPlan ?? null, debts: sa.state.debts ?? [], hint: null, crossroads: null, ownerLetterDay: 0, heading: null, starving: sa.state.starving ?? 0, roofless: sa.state.roofless ?? 0, convictions: sa.state.convictions ?? 0, secretsKnown: { ...(sa.state.secretsKnown ?? {}) }, seek: null, watch: [...(sa.state.watch ?? [])], selves: [...(sa.state.selves ?? [])], lastSelfDay: sa.state.lastSelfDay ?? 0, doToday: 0, projects: [...(sa.state.projects ?? [])], beliefs: [...(sa.state.beliefs ?? [])],
        seenToday: [], trustDawn: Object.fromEntries(sa.relationships.map((r) => [r.other, r.trust])), trustLog: [...(sa.state.trustLog ?? [])], lastHungerThought: sa.state.lastHungerThought ?? -999, starvingThoughtDay: sa.state.starvingThoughtDay ?? 0, debtThoughtDay: sa.state.debtThoughtDay ?? 0, gatheringThoughtId: sa.state.gatheringThoughtId ?? null, replyTo: sa.state.replyTo ?? null,
      };
      this.agents.set(a.id, a);
      if (a.job) this.jobs.get(a.job)!.holders.push(a.id);
      if (a.asleep) { const p = this.places.get(a.location); if (p?.beds) p.freeBeds = Math.max(0, (p.freeBeds ?? 0) - 1); }
      const n = a.id.startsWith(`ag_${this.idPrefix}`) ? parseInt(a.id.slice(3 + this.idPrefix.length), 36) : NaN; if (Number.isFinite(n) && n > maxId) maxId = n;
    }
    this.nextId = maxId + 1;
    this.papers = [...snap.papers];
    this.laws.splice(0, this.laws.length, ...snap.laws);
    this.children.splice(0, this.children.length, ...(snap.children ?? []));
    this.evolution=structuredClone(snap.civic?.evolution??[]);
    if (snap.civic) { this.mayor = snap.civic.mayor && this.agents.has(snap.civic.mayor) ? snap.civic.mayor : null; this.electedDay = snap.civic.elected; this.works = [...snap.civic.works]; this.gatherings = (snap.civic.gatherings ?? []).map((g) => ({ ...g })); this.wedded = new Set(snap.civic.wedded ?? []); this.chain = [...(snap.civic.chain ?? [])]; this.rules = [...(snap.civic.rules ?? [])]; this.sayings = [...(snap.civic.sayings ?? [])]; this.nextGatheringId = 1 + Math.max(0, ...this.gatherings.map((g) => g.id)); }
    this.nextLetterId = 1 + Math.max(0, ...[...this.agents.values()].flatMap((a) => a.letters.map((l) => l.id)));
    this.nextDealId = Math.max(snap.civic?.nextDealId ?? 1, 1 + Math.max(0, ...[...this.agents.values()].flatMap((a) => a.deals.map((d) => d.id))));
  }

  snapshot(): TownSnapshot {
    return {
      t: this.t, day: this.day, weather: this.weather, flourShortage: this.flourShortage,
      places: [...this.places.values()].map((p) => structuredClone(p)),
      jobs: [...this.jobs.values()].filter((j) => this.places.get(j.place)?.owner).map(({ holders: _h, ...j }) => j),
      agents: [...this.agents.values()].map((a): AgentSnapshot => ({
        id: a.id, persona: a.persona, owner: a.owner, funded: a.funded, appearance: a.appearance, arrivedAt: a.arrivedAt,
        state: { skills: structuredClone(a.skills ?? []), practice: structuredClone(a.practice ?? null), lastSkillTrialDay: a.lastSkillTrialDay ?? -1, foodAdvice: structuredClone(a.foodAdvice ?? []), foodRoutineDecisions: structuredClone(a.foodRoutineDecisions ?? []), foodLessons: structuredClone(a.foodLessons ?? []), deals: a.deals.filter((d) => d.state === "offered" || d.state === "open"), needs: a.needs, location: a.location, coins: a.coins, inventory: a.inventory, job: a.job, home: a.home, asleep: a.asleep, budget: a.budget, intentions: a.intentions, rumors: a.rumors.slice(-5), letters: a.letters.filter((l) => !l.read || (!l.answered && asksSomething(l.text))), lastConversation: a.lastConversation, lastThought: a.lastThought, instructions: a.instructions, brainKind: a.brainKind, thinkEvery: a.thinkEvery, plan: a.plan, lastPlan: a.lastPlan, replyTo: a.replyTo, lastHungerThought: a.lastHungerThought, starvingThoughtDay: a.starvingThoughtDay, debtThoughtDay: a.debtThoughtDay, gatheringThoughtId: a.gatheringThoughtId, debts: a.debts, starving: a.starving, roofless: a.roofless, convictions: a.convictions, secretsKnown: a.secretsKnown, watch: a.watch, selves: a.selves, lastSelfDay: a.lastSelfDay, projects: a.projects, beliefs: a.beliefs, trustLog: a.trustLog.slice(-60) },
        relationships: [...a.relationships.entries()].map(([other, r]) => ({ other, ...r })),
        memory: a.memory,
      })),
      papers: this.papers.slice(-14), laws: this.laws, children: this.children.map((c) => ({ ...c })), civic: { evolution: structuredClone(this.evolution), nextDealId: this.nextDealId, mayor: this.mayor, elected: this.electedDay, works: [...this.works], gatherings: this.gatherings.filter((g) => !g.held).map((g) => ({ ...g })), wedded: [...this.wedded], chain: this.chain.slice(-400), rules: [...this.rules], sayings: this.sayings.slice(-40) },
    };
  }

  /** An agent leaves the island for good. The record keeps them; the town does not. */
  removeAgent(agentId: AgentId, reason: "left" | "died" | "exiled", note = ""): AgentState | null {
    const a = this.agents.get(agentId); if (!a) return null;
    if (a.job) { const j = this.jobs.get(a.job); if (j) j.holders = j.holders.filter((h) => h !== a.id); }
    if (a.asleep) { const p = this.places.get(a.location); if (p?.beds) p.freeBeds = Math.min(p.beds.capacity, (p.freeBeds ?? 0) + 1); }
    for(const p of this.places.values())if(p.institution)p.institution.members=p.institution.members.filter(id=>id!==agentId);
    this.agents.delete(agentId);
    if (this.mayor === agentId) { this.mayor = null; this.emit("town.mayor", [], "council", `${a.persona.name} is gone; the island has no mayor until the council sits again.`, 0.6); }
    if (reason === "died") { this.inherit(a); if (this.places.has("chapel")) this.gather("funeral", "chapel", this.day + 1, 10, [agentId], a.persona.name); }
    for (const c of this.children) if (c.parents.includes(agentId) && !c.parents.some((pid) => this.agents.has(pid))) c.orphan = true;
    for (const b of this.agents.values()) { const r = b.relationships.get(agentId); if (r) this.remember(b, `${a.persona.name} ${reason === "left" ? "left on the boat" : reason === "died" ? "died" : "was sent away"}. ${r.trust > 0.5 ? "I will miss them." : ""}`.trim(), 0.6 + r.trust * 0.3); }
    const text = reason === "left" ? `${a.persona.name} left on the boat.${note ? ` ${note}` : ""}` : reason === "died" ? `${a.persona.name} died.${note ? ` ${note}` : ""}` : `${a.persona.name} was sent away from the island.${note ? ` ${note}` : ""}`;
    this.emit("agent.leave", [agentId], "harbor", text, 0.9, { reason, note });
    this.departuresToday++; this.burned += a.coins;
    void this.writeLife(a, reason, note);
    return a;
  }

  /** The book of a life: the town writes it once someone has gone, from the record alone, and puts it on the shelf as an event. */
  private async writeLife(a: AgentState, how: "left" | "died" | "exiled", note: string): Promise<void> {
    if (this.brain.name === "none") return;
    const arrivedDay = Math.floor(a.arrivedAt / MINUTES_PER_DAY) + 1;
    const events = this.events.filter((e) => e.actors.includes(a.id) && e.importance >= 0.35 && e.kind !== "agent.reflect" && e.kind !== "agent.move").sort((x, y) => y.importance - x.importance).slice(0, 40).sort((x, y) => x.t - y.t).map((e) => `day ${e.day}: ${e.text}`);
    const memories = [...a.memory].filter((m) => m.kind === "reflect" || m.importance >= 0.7).sort((x, y) => y.importance - x.importance).slice(0, 16).sort((x, y) => x.t - y.t).map(memoryForMind);
    const people = [...a.relationships.entries()].map(([id, r]) => ({ name: this.agents.get(id)?.persona.name ?? id, trust: r.trust, opinion: r.opinion ?? "" })).sort((x, y) => Math.abs(y.trust - 0.3) - Math.abs(x.trust - 0.3)).slice(0, 8);
    const lettersHome = this.events.filter((e) => e.kind === "agent.letter" && e.actors[0] === a.id).map((e) => String(e.payload?.text ?? "")).filter(Boolean).slice(-4);
    const lastThought = [...a.memory].reverse().find((m) => m.kind === "reflect")?.text ?? null;
    const owned = [...this.places.values()].filter((p) => p.owner === a.id).map((p) => p.name);
    const ctx: LifeContext = { name: a.persona.name, persona: a.persona, how, note, arrivedDay, day: this.day, coins: a.coins, job: a.job ? (this.jobs.get(a.job)?.title ?? null) : null, home: a.home ? (this.places.get(a.home.place)?.name ?? null) : null, events, memories, people, letters: a.letters.length, children: this.children.filter((c) => c.parents.includes(a.id)).map((c) => c.name), lettersHome, lastThought, owned, convictions: a.convictions };
    try {
      const life = await this.brain.life(ctx);
      this.emit("town.book", [a.id], "hall", `The town wrote the book of ${a.persona.name}: “${life.title}”.`, 0.5, { title: life.title, text: life.text, epitaph: life.epitaph, how, arrivedDay, leftDay: this.day, name: a.persona.name });
    } catch (err) { this.log(`the book of ${a.persona.name} was not written: ${(err as Error).message}`); }
  }

  sendLetter(agentId: AgentId, text: string): void {
    const a = this.agents.get(agentId); if (!a) return;
    a.letters.push({ id: this.nextLetterId++, text, t: this.t, read: false });
  }

  // ---------- main loop ----------
  async run(untilDay: number): Promise<void> {
    while (this.day < untilDay) await this.tick();
  }

  async tick(): Promise<void> {
    const prevHour = this.hour;
    this.conversationPairsThisTick.clear();
    // 1. needs
    for (const a of this.agents.values()) this.decayNeeds(a);
    // 2. habit for everyone, salience for some
    const thinkers: { a: AgentState; tier: Tier; why: string; refund: () => void }[] = [];
    for (const a of this.agents.values()) if (a.asleep) this.maybeWake(a);
    // morning plans touch nothing but the planner, so they run side by side, a few at a time
    const planners = [...this.agents.values()].filter((a) => !a.asleep && a.plan?.day !== this.day);
    for (let i = 0; i < planners.length; i += 6) await Promise.all(planners.slice(i, i + 6).map((a) => this.maybePlan(a)));
    for (const a of this.agents.values()) {
      if (a.asleep) continue;
      if (!this.paused && a.practice && this.performPractice(a)) continue;
      const here = this.places.get(a.location)!;
      const nearby = this.nearby(a);
      for (const b of nearby) { if (!a.seenToday.includes(b.id)) a.seenToday.push(b.id); this.rel(a, b.id).lastPlace = b.location; }
      const gathering = this.gatheringAhead(a);
      const s = this.brain.name === "none" || this.paused || (this.retryAt.get(a.id) ?? 0) > this.t ? null : salience(a, { hour: this.hour, t: this.t, day: this.day, nearby, jobsOpenHere: this.openJobsAt(here.id).length, plotHere: here.kind === "plot" && !here.site, watched: this.watched(a, here, nearby), debtDue: a.debtThoughtDay !== this.day && this.debtDueToday(a), gathering });
      const refund = s ? this.reserve(a, s.tier) : null;
      if (s && refund) { thinkers.push({ a, tier: s.tier, why: s.why, refund }); }
      else {
        const choices: {baseline:string;preferred:string}[]=[];
        let act = habit(a, {...this.habitView(), onFoodChoice:(baseline,preferred)=>choices.push({baseline,preferred})});
        // whoever has come to a gathering waits for it to begin, instead of wandering off
        if (act.kind !== "sleep" && act.kind !== "use" && this.pendingGatheringAt(a.location)) act = { kind: "wait" };
        if (a.heading && a.heading !== a.location && act.kind !== "sleep" && act.kind !== "use" && this.places.has(a.heading) && !this.pendingGatheringAt(a.location)) { const nx = this.path(a.location, a.heading); if (nx) act = { kind: "move", to: nx }; else a.heading = null; } // a gathering about to begin here outranks wherever they were going
        if (a.heading === a.location) a.heading = null;
        const step = this.dueStep(a);
        // A plan step with a place pulls harder than habit's drift, for three hours from its time, unless hunger or night or a shift says otherwise.
        const onShift = a.job && (() => { const j = this.jobs.get(a.job!); return !!j && this.hour >= j.hours[0] && this.hour < j.hours[1]; })();
        const pulled = step?.place && step.place !== a.location && this.places.has(step.place) && this.hour < step.hour + 3 && this.hour < 21 && a.needs.hunger < 0.6 && !onShift;
        if ((act.kind === "wait" || pulled) && step?.place && step.place !== a.location && this.places.has(step.place)) { const next = this.path(a.location, step.place); if (next) act = { kind: "move", to: next }; }
        const choice=choices[0], from=a.location;
        const learnedStep=choice && act.kind === "move" && act.to === this.path(from,choice.preferred) && act.to !== this.path(from,choice.baseline);
        if(this.apply(a, act, "habit") && learnedStep && choice && act.kind === "move") {
          (a.foodRoutineDecisions ??= []).push({t:this.t,from,next:act.to,...choice});
          a.foodRoutineDecisions=a.foodRoutineDecisions.slice(-20);
        }
      }
      this.progressPlan(a);
    }
    // 3. thoughts. Everyone perceives the same minute, thinks at the same time, and acts in seeded order; the validator settles any clash.
    const perceived = thinkers.map((th) => { this.rememberPlace(th.a); return { th, p: this.perceive(th.a) }; });
    const proposals: (ActionProposal | undefined)[] = new Array(perceived.length);
    const CONCURRENCY = 8;
    for (let i = 0; i < perceived.length; i += CONCURRENCY) {
      await Promise.all(perceived.slice(i, i + CONCURRENCY).map(async ({ th, p }, j) => {
        try { proposals[i + j] = await this.brain.decide(p, th.a, th.tier); }
        catch (err) { this.log(`brain failed for ${th.a.persona.name}: ${(err as Error).message}`); th.refund(); this.retryAt.set(th.a.id, this.t + 5); }
      }));
    }
    perceived.forEach(({ th }, i) => {
      const proposal = proposals[i];
      if (!proposal) return;
      this.noteThought(th.a, th.why, this.gatheringAhead(th.a));
      const wasAsked = th.a.crossroads !== null && th.a.replyTo !== null; // this thought is the one the letter raised
      th.a.lastThought = this.t; th.a.hint = null; th.a.crossroads = null;
      for (const l of th.a.letters) if (!l.read) { l.read = true; this.remember(th.a, `A letter from whoever sent me: "${l.text}"`, 0.6, "letter"); if (asksSomething(l.text) && !l.answered && !th.a.replyTo) { th.a.replyTo = l.id; th.a.crossroads = `A letter from whoever sent you asks something of you: "${l.text}"`; } } // a letter that asks gets its answer: the next thought is a crossroads
      for (const r of proposal.remember) this.remember(th.a, r, 0.4, "reflect");
      th.a.heard = [];
      this.because = proposal.intent ?? null;
      // a mind that has nothing better to do than wait keeps walking to where it was going
      let chosen = proposal.action;
      if (chosen.kind === "wait" && th.a.heading && th.a.heading !== th.a.location && this.places.has(th.a.heading)) { const nx = this.path(th.a.location, th.a.heading); if (nx) chosen = { kind: "move", to: nx }; }
      this.apply(th.a, chosen, `tier ${th.tier}: ${th.why}`);
      // they thought it over and did not write: the question goes unanswered, and the next letter that asks gets its own crossroads
      if (wasAsked && th.a.replyTo !== null) th.a.replyTo = null;
      this.because = null;
    });
    // 4. the town's mind says what the free deeds came to
    await this.judgeDeeds();
    // conversations between co-located people
    await this.conversations();
    await this.sail();
    // 5. clock
    this.t += this.minutesPerTick;
    if (this.hour !== prevHour) this.hourly();
    if (this.minuteOfDay < this.minutesPerTick) await this.nightly();
  }

  // ---------- perception ----------
  perceive(a: AgentState): Perception {
    const here = this.places.get(a.location)!;
    const nearby = this.nearby(a).map((b) => {
      const r = a.relationships.get(b.id);
      return { agent: b.id, name: b.persona.name, ...(r ? { relation: { trust: r.trust, affection: r.affection, opinion: r.opinion } } : {}), asleep: b.asleep };
    });
    const q = [a.persona.want, ...nearby.map((n) => n.name), here.name].join(" ");
    const people = this.townPeople(a); const projects = [...this.places.values()].filter(p => p.community).map(p => ({ ...structuredClone(p.community!), place: p.id })); const job = a.job ? this.jobs.get(a.job) : undefined;
    return {
      type: "perceive", agent_id: a.id,
      ...((this.rules.length || this.sayings.some((x) => x.by.length >= 2) || people.length || projects.length) ? { town: { ...this.ways(), ...(projects.length ? { projects } : {}), ...(people.length ? { people } : {}) } } : {}),
      time: { sim: this.clock(), day: this.day, minute: this.minuteOfDay, season: this.season, weather: this.weather, weekday: this.weekdayName, ...(this.occasion ? { occasion: this.occasion } : {}), ...(this.nextGathering() ? { gathering: this.nextGathering()! } : {}), ...(this.temperatureC !== null ? { temperature_c: this.temperatureC } : {}) },
      self: { location: a.location, needs: { ...a.needs }, feels: this.feels(a), coins: a.coins, inventory: [...a.inventory], job: a.job ? (this.jobs.get(a.job)?.title ?? a.job) : null, shift: job ? { place: job.place, wage: job.wage, hours: [job.hours[0], job.hours[1]] } : null, debts: a.debts.map((d) => ({ to: this.agents.get(d.to)?.persona.name ?? d.to, coins: d.coins, overdue: this.t >= d.due })), ...(a.deals.some((d) => d.state === "offered" || d.state === "open") ? { deals: a.deals.filter((d) => d.state === "offered" || d.state === "open").map((d) => ({ id: d.id, with: this.agents.get(d.with)?.persona.name ?? d.with, what: d.what, coins: d.coins, mine: d.mine, state: d.state as "offered" | "open", ...(d.construction ? { construction: { site: d.construction.site, mornings: d.construction.mornings, done: d.construction.done } } : {}), due_in_days: d.due === null ? null : Math.max(0, Math.ceil((d.due - this.t) / MINUTES_PER_DAY)) })) } : {}), days_hungry: a.starving, weak: a.starving >= 2, family: { partner: this.partnerOf(a)?.persona.name ?? null, children: this.children.filter((c) => c.parents.includes(a.id)).map((c) => `${c.name}, ${this.day - c.bornDay} days old`) }, owns: [...this.places.values()].filter((p) => p.owner === a.id).map((p) => p.name), housing: a.home ? { kind: a.home.place, nights_left: a.home.nightsPaid } : null ,
        ...(this.mayor === a.id ? { mayor: true } : {}), ...(a.convictions ? { convictions: a.convictions } : {}),
        ...(a.watch.length ? { watching: [...a.watch] } : {}),
        ...(a.projects.some((x) => !x.done) ? { projects: a.projects.filter((x) => !x.done).map((x) => ({ title: x.title, progress: x.progress, since_day: x.since, ...(x.construction ? { construction: { ...x.construction } } : {}) })) } : {}),
        ...(a.skills?.length ? { skills: a.skills.map(s => ({ id:s.id, recipe:s.recipe, attempts:s.attempts, successes:s.successes, ...(s.learnedFrom ? {learned_from:s.learnedFrom}:{}), ...(s.trial ? {trial:s.trial}:{} ) })) } : {}),
        ...(this.learning && a.foodLessons?.length ? { learned_food: a.foodLessons.map(l => ({ place: l.place, item: l.item, ...foodExperience(a.foodLessons, l.place, l.item, this.t) })) } : {}),
        ...(this.learning && a.foodAdvice?.length ? { food_advice: a.foodAdvice.filter(x => this.t - x.sourceT <= ADVICE_LIFETIME).map(x => ({ from: x.from, name: this.agents.get(x.from)?.persona.name ?? x.from, place: x.place, item: x.item, confidence: x.confidence, source_t: x.sourceT, shared_t: x.sharedT, trust: a.relationships.get(x.from)?.trust ?? .3, ...(x.tested ? { tested: x.tested.matched } : {}) })) } : {}),
        ...(a.beliefs.length ? { believes: a.beliefs.map((b) => ({ about: b.about, belief: b.belief, confidence: Math.round(b.confidence * 100) / 100 })) } : {}),
        ...(Object.keys(a.secretsKnown).length ? { knows: Object.entries(a.secretsKnown).map(([id, secret]) => ({ who: this.agents.get(id)?.persona.name ?? id, secret })) } : {}), },
      nearby,
      place: { id: here.id, name: here.name, kind: here.kind, for_sale: here.sells.map((s) => ({ item: s.item, price: this.price(here, s.item) })).filter((x): x is { item: string; price: number } => x.price !== null), jobs_open: this.openJobsAt(here.id).map((j) => j.id), exits: [...here.exits],
        ...(here.community ? { community: structuredClone(here.community) } : {}),
        owner: here.owner ? (this.agents.get(here.owner)?.persona.name ?? here.owner) : null,
        ...(a.job && this.jobs.get(a.job)?.place === here.id && Object.keys(here.stock).length ? { stock: { ...here.stock } } : {}),
        ...(here.institution ? {institution:structuredClone(here.institution)}:{}),
        broken: !!(here.brokenUntil && here.brokenUntil > this.day),
        ...(here.nickname ? { known_as: here.nickname } : {}), ...(here.recipes?.length ? { recipes: here.recipes.map((r) => ({ item: r.item, from: r.from })) } : {}),
        ...(here.kind === "civic" ? { council: { mayor: this.mayor ? (this.agents.get(this.mayor)?.persona.name ?? null) : null, treasury: here.treasury, works: [...this.works], can_fund: this.mayor === a.id ? Object.entries(WORKS).filter(([w]) => !this.works.includes(w)).map(([what, w]) => ({ what, coins: w.coins })) : [], open_laws: this.laws.filter((l) => l.open).map((l) => l.text) } } : {}),
        ...(here.kind === "plot" && !here.site && !here.community ? { plot: { free: true, house: { coins: BUILDS.house.coins, mornings: BUILDS.house.labor }, shop: { coins: BUILDS.shop.coins, mornings: BUILDS.shop.labor }, planks: this.places.get("sawpit")?.stock.planks ?? 0 } } : {}),
        ...(here.site ? { site: { what: here.site.what, name: here.site.name, by: this.agents.get(here.site.by)?.persona.name ?? here.site.by, done: here.site.labor, of: here.site.laborNeeded, worked_today: here.site.workedDay?.[a.id] === this.day } } : {}),
        ...(here.kind === "harbor" && this.harbors.length ? { boats_to: this.harbors.map((h) => ({ id: h.id, name: h.name })) } : {}) },
      heard: a.heard.map((h) => ({ from: h.from, name: h.name, text: h.text })),
      recent: retrieve(a.memory, q, this.t, 8).map((m) => this.recall(a, m)),
      owner_letters: [...(a.instructions ? [{ id: 0, text: `Standing instructions from whoever sent you: ${a.instructions}` }] : []), ...a.letters.filter((l) => !l.read).map((l) => ({ id: l.id, text: l.text }))],
      ...(a.hint ? { hint: a.hint } : {}), ...(a.crossroads ? { crossroads: a.crossroads } : {}),
      today: a.plan?.day === this.day && a.plan.goals.length ? { mood: a.plan.mood, goals: a.plan.goals, steps: a.plan.steps } : null,
      options: [...OPTIONS_DEFAULT, ...(here.institution ? ["join_institution" as const,"leave_institution" as const] : here.owner===a.id ? ["found_institution" as const] : []), ...(here.brokenUntil && here.brokenUntil>this.day ? ["repair" as const] : []), ...(this.learning ? ["propose_skill" as const, ...(a.skills?.length ? ["test_skill" as const, "practice_skill" as const, "share_skill" as const] : [])] : []), ...(here.kind === "plot" && !here.site && !here.community ? ["build" as const, "start_project" as const] : []), ...(here.community ? ["contribute_project" as const, "withdraw_project" as const] : []), ...(this.learning && nearby.length && a.foodLessons?.length ? ["teach" as const] : []), ...(here.owner === a.id ? ["hire" as const] : []), ...([...this.places.values()].some((p) => p.owner === a.id && p.beds) && nearby.length ? ["lodge" as const] : []), ...(nearby.length && a.coins > 0 ? ["lend" as const] : []), ...(here.kind === "harbor" && this.boatRunning ? ["leave" as const] : []), ...(here.kind === "civic" ? ["accuse" as const, ...(this.mayor === a.id ? ["fund" as const] : [])] : []), ...(here.owner === a.id ? ["stock" as const] : []), ...((here.owner === a.id || (a.job && this.jobs.get(a.job)?.place === here.id)) && Object.keys(here.stock).length ? ["make" as const] : []), ...(here.kind !== "wild" ? ["call" as const] : []), ...(this.residentsOf(here).some((r) => r.id !== a.id) && !this.residentsOf(here).some((r) => r.id !== a.id && r.location === here.id) ? ["search" as const] : [])],
      deadline_ms: 8000,
    };
  }

  // ---------- apply ----------
  /** Brains refer to people by id or by name. Resolve to an id, or leave the string alone (it may be a place). */
  resolveRef(ref: string, near?: AgentState[]): string {
    if (this.agents.has(ref)) return ref;
    const q = ref.trim().toLowerCase();
    const pool = near ?? [...this.agents.values()];
    const hit = pool.find((b) => b.persona.name.toLowerCase() === q) ?? pool.find((b) => b.persona.name.toLowerCase().startsWith(q) || q.startsWith(b.persona.name.toLowerCase().split(" ")[0] ?? "\u0000")) ?? [...this.agents.values()].find((b) => b.persona.name.toLowerCase() === q);
    return hit ? hit.id : ref;
  }

  /** People name places the way people do: "the market", "Ilić's bakery", "market square". Find the id, or leave it for the validator to refuse. */
  resolvePlace(ref: string): string {
    if (this.places.has(ref)) return ref;
    const q = ref.trim().toLowerCase().replace(/^(the|to|at)\s+/, "");
    for (const p of this.places.values()) { const n = p.name.toLowerCase().replace(/^(the|an?)\s+/, ""); if (n === q || p.id === q) return p.id; }
    for (const p of this.places.values()) { const n = p.name.toLowerCase(); if (n.includes(q) || q.includes(n.replace(/^(the|an?)\s+/, ""))) return p.id; }
    return ref;
  }
  private resolveAction(a: AgentState, action: Action): Action {
    const near = this.nearby(a);
    switch (action.kind) {
      case "move": return { ...action, to: this.resolvePlace(action.to) };
      case "start_project": case "contribute_project": case "withdraw_project": case "build": return { ...action, at: this.resolvePlace(action.at) };
      case "share_skill": return { ...action, to: this.resolveRef(action.to, near) };
      case "teach": return { ...action, to: this.resolveRef(action.to, near), place: this.resolvePlace(action.place), item: action.item.toLowerCase().trim() };
      case "say": return action.to ? { ...action, to: this.resolveRef(action.to, near) } : action;
      case "give": return { ...action, to: this.resolveRef(action.to, near) };
      case "offer": return { ...action, to: this.resolveRef(action.to, near), ...(action.construction ? { construction: { ...action.construction, site: this.resolvePlace(action.construction.site) } } : {}) };
      case "accept": case "refuse": return action.from ? { ...action, from: this.resolveRef(action.from, near) } : action;
      case "settle": return action.to ? { ...action, to: this.resolveRef(action.to, near) } : action;
      case "accuse": return { ...action, who: this.resolveRef(action.who, [...this.agents.values()]) };
      // asking for work without naming the post means whatever is open here, or the post whose title they used
      case "apply": { if (action.job && this.jobs.has(action.job)) return action; const here = this.openJobsAt(a.location); const named = action.job ? here.find((j) => j.title.toLowerCase().includes(action.job!.toLowerCase()) || j.id.includes(action.job!.toLowerCase())) : undefined; return { ...action, job: (named ?? here[0])?.id ?? action.job ?? "" }; }
      case "write": return action.about ? { ...action, about: this.resolveRef(action.about, [...this.agents.values()]) } : action;
      case "take": return action.from ? { ...action, from: this.resolveRef(action.from, near) } : action;
      case "trade": {
        // a bare trade is a hungry person at a counter: the place they stand in, the cheapest food on its shelf
        const w = action.with ? this.resolveRef(action.with, near) : a.location; let buy = action.buy;
        if (!buy && !action.sell && w === a.location) { const here = this.places.get(a.location); const cheapest = here ? here.sells.filter((x) => FOOD_ITEMS.has(x.item)).map((x) => ({ item: x.item, price: this.price(here, x.item) })).filter((x) => x.price !== null).sort((x, y) => x.price! - y.price!)[0] : undefined; if (cheapest) buy = cheapest.item; }
        return { ...action, with: w, ...(buy ? { buy } : {}), coins: action.coins ?? 0 };
      }
      default: return action;
    }
  }

  private skillMeasure(a: AgentState, output="vegetables"): SkillMeasure {
    const p=this.places.get(a.location)!;
    return {hunger:a.needs.hunger,coins:a.coins,items:a.inventory.length,damage:Math.max(0,(p.brokenUntil??0)-this.day),stock:p.stock[output]??0};
  }
  private performPractice(a: AgentState): boolean {
    const practice=a.practice!, skill=a.skills?.find(s=>s.id===practice.id);
    if(!skill){a.practice=null;return false;}
    // New letters and urgent bodily needs interrupt a procedure; the agent can choose again.
    const interrupted=a.letters.some(l=>!l.read)||a.needs.rest>.9||(a.needs.hunger>.9&&skill.recipe.goal!=="eat");
    let ok=false;
    if(!interrupted) {
      const step=skill.recipe.steps[practice.step]!, output=step.kind==="make"?step.item:"vegetables";
      const before=this.skillMeasure(a,output);ok=this.apply(a,step,"learned-procedure");
      if(ok){practice.accepted++;if(step.kind!=="move") {const after=this.skillMeasure(a,output);for(const k of Object.keys(before) as (keyof SkillMeasure)[])practice.before[k]+=after[k]-before[k];}}
      practice.step++;
    }
    if(interrupted||!ok||practice.step>=skill.recipe.steps.length){
      const success=!interrupted&&ok&&practice.accepted===skill.recipe.steps.length&&achieved(skill.recipe.goal,{hunger:0,coins:0,items:0,damage:0,stock:0},practice.before);
      skill.attempts++;if(success)skill.successes++;
      const event=this.emit("skill.practiced",[a.id],a.location,`${a.persona.name} ${success?"achieved":"did not achieve"} the measured goal of ${skill.recipe.name}.`,success?.6:.2,{skill:skill.id,goal:skill.recipe.goal,success,accepted:practice.accepted,total:skill.recipe.steps.length,origin:skill.origin,learnedFrom:skill.learnedFrom??null});
      skill.evidence.push({island:this.name,event:event.id,t:this.t,success});skill.evidence=skill.evidence.slice(-20);a.practice=null;
    }
    return !interrupted;
  }

  apply(a: AgentState, rawAction: Action, source: string): boolean {
    const action = this.resolveAction(a, rawAction);
    const here = this.places.get(a.location)!;
    const verdict = validate(a, action, { places: this.places, jobs: this.jobs, agents: this.agents, now: this.t, learning: this.learning, season: this.season, hour: this.hour, weekday: this.weekday, day: this.day, mayor: this.mayor, works: this.works, feast: !!this.feastToday(), residentsOf: (p: Place) => this.residentsOf(p), bedPrice: (p: Place) => this.bedPrice(p), knownItem: (item: string) => this.knownItem(item), curfew: this.rules.find((r): r is Extract<Rule, { kind: "curfew" }> => r.kind === "curfew")?.hour ?? null, buyPrice: (p, i) => this.buyPrice(p, i), food: (i) => this.isFood(i), weather: this.weather, boatHeld: this.boatHeld, laws: this.laws, price: (p, i) => this.price(p, i), path: (f, t) => this.path(f, t) });
    if (!verdict.ok) {
      if (this.learning && action.kind === "trade" && action.buy && this.isFood(action.buy) && (!action.with || action.with === here.id) && verdict.reason === "not for sale here")
        this.observeFood(a, here.id, action.buy, { t: this.t, success: false, cost: 0 });
      if (source !== "habit") this.emit("action.rejected", [a.id], here.id, `${a.persona.name} tried to ${action.kind} but ${verdict.reason}.`, 0.05, { action, source });
      return false;
    }
    const name = a.persona.name;
    switch (action.kind) {
      case "found_institution": {
        here.institution={name:action.name,charter:action.charter,founder:a.id,members:[a.id],founded:this.t};
        this.emit("institution.founded",[a.id],here.id,`${name} founded ${action.name}: ${action.charter}`,.6);return true;
      }
      case "join_institution": {here.institution!.members.push(a.id);this.emit("institution.joined",[a.id],here.id,`${name} joined ${here.institution!.name}.`,.4);return true;}
      case "leave_institution": {here.institution!.members=here.institution!.members.filter(id=>id!==a.id);this.emit("institution.left",[a.id],here.id,`${name} left ${here.institution!.name}.`,.4);return true;}
      case "repair": {
        for(let i=0;i<2;i++)a.inventory.splice(a.inventory.indexOf("planks"),1);
        here.brokenUntil=Math.max(this.day,(here.brokenUntil??this.day)-1);a.needs.rest=clamp(a.needs.rest+.1);
        this.emit("building.repaired",[a.id],here.id,`${name} used two planks to repair ${here.name}; ${here.brokenUntil>this.day?`${here.brokenUntil-this.day} days of damage remain`:"it is working again"}.`,.6,{remainingDays:Math.max(0,here.brokenUntil-this.day),planks:2});return true;
      }
      case "propose_skill": {
        const recipe = structuredClone(action.recipe), id = skillId(recipe);
        (a.skills ??= []).push({id,recipe,origin:{island:this.name,author:a.id,name:a.persona.name},proposed:this.t,attempts:0,successes:0,evidence:[]});
        this.emit("skill.proposed",[a.id],a.location,`${name} proposed a procedure: ${recipe.name}.`,.35,{skill:id,goal:recipe.goal}); return true;
      }
      case "test_skill": {
        const skill = a.skills!.find(s=>s.id===action.id)!; a.lastSkillTrialDay=this.day;
        // No external hooks or brain calls: this copy can only execute the bounded primitive list.
        const lab = new Town({seed:1,brain:this.brain,pack:this.pack}); lab.restore(structuredClone(this.snapshot()));
        const subject=lab.agents.get(a.id)!; subject.practice=null;
        // A thought experiment cannot inspect strangers or hidden stores. Limit it to this place.
        for(const [id,b] of lab.agents) if(id!==a.id) lab.agents.delete(id);
        for(const place of lab.places.values()) if(place.owner!==a.id && this.jobs.get(a.job??"")?.place!==place.id) place.stock={};
        const before=lab.skillMeasure(subject,skill.recipe.steps.find(s=>s.kind==="make")?.item??"vegetables"); let accepted=0;
        for(const step of skill.recipe.steps) { if(step.kind==='move') break; if(!lab.apply(subject,step,"experiment")) break; accepted++;lab.t++; }
        const success=accepted===skill.recipe.steps.length&&achieved(skill.recipe.goal,before,lab.skillMeasure(subject,skill.recipe.steps.find(s=>s.kind==="make")?.item??"vegetables"));
        skill.trial={day:this.day,success,accepted,total:skill.recipe.steps.length};
        this.emit("skill.tested",[a.id],a.location,`${name} tested ${skill.recipe.name} in an isolated thought experiment.`,.2,{skill:skill.id,simulated:true,success,accepted,total:skill.recipe.steps.length});return true;
      }
      case "practice_skill": {
        a.practice={id:action.id,step:0,before:{hunger:0,coins:0,items:0,damage:0,stock:0},accepted:0,started:this.t};return true;
      }
      case "share_skill": {
        const skill=a.skills!.find(s=>s.id===action.id)!, b=this.agents.get(action.to)!;
        (b.skills ??= []).push(importedSkill(skill,a.id));
        this.emit("skill.shared",[a.id,b.id],a.location,`${name} shared ${skill.recipe.name} with ${b.persona.name}; they have not tested it yet.`,.5,{skill:skill.id,origin:skill.origin});return true;
      }
      case "teach": {
        const b = this.agents.get(action.to)!;
        const lesson = teachable(a.foodLessons, action.place, action.item, this.t)!;
        const placeName = this.places.get(action.place)?.name ?? action.place;
        const text = `${name} told ${b.persona.name}: my recent attempts to buy ${action.item} at ${placeName} ${lesson.confidence >= .5 ? "mostly worked" : "were unreliable"}. Check for yourself.`;
        const event = this.emit("knowledge.shared", [a.id, b.id], here.id, text, .35, { source: action.place, item: action.item, sourceT: lesson.sourceT, confidence: lesson.confidence });
        const advice = b.foodAdvice ??= [];
        const old = advice.findIndex(x => x.from === a.id && x.place === action.place && x.item === action.item);
        if (old >= 0) advice.splice(old, 1);
        advice.push({ from: a.id, place: action.place, item: action.item, confidence: lesson.confidence, sourceT: lesson.sourceT, sharedT: this.t, eventId: event.id });
        b.foodAdvice = advice.slice(-24);
        this.remember(b, text, .5, "rumor"); this.remember(a, text, .3);
        b.heard.push({ from: a.id, name, text, t: this.t });
        break;
      }
      case "start_project": {
        here.community = { name: action.name, why: action.why, by: a.id, proposed: this.t, phase: "funding", coins: 0, target: GARDEN.coins, members: [{ id: a.id, coins: 0, help: true, labor: 0 }], harvests: 0, foodProduced: 0 };
        this.emit("project.proposed", [a.id], here.id, `${name} proposed ${action.name}, a shared garden: ${action.why}`, .7, { target: GARDEN.coins, planks: GARDEN.planks, mornings: GARDEN.labor });
        this.remember(a, `I proposed ${action.name} at ${here.name}. We need ${GARDEN.coins} coins, ${GARDEN.planks} planks from the sawpit and ${GARDEN.labor} mornings of work.`, .8);
        break;
      }
      case "contribute_project": {
        const project = here.community!;
        let member = project.members.find(m => m.id === a.id);
        if (!member) { member = { id: a.id, coins: 0, help: false, labor: 0 }; project.members.push(member); }
        a.coins -= action.coins; project.coins += action.coins; member.coins += action.coins;
        if (action.help) member.help = true;
        this.emit("project.contributed", [a.id], here.id, `${name} contributed ${action.coins} coins to ${project.name}${action.help ? " and volunteered to work" : ""}.`, .5, { coins: action.coins, raised: project.coins, target: project.target });
        this.beginGarden(here);
        break;
      }
      case "withdraw_project": {
        const project = here.community!, member = project.members.find(m => m.id === a.id)!;
        const refund = project.phase === "funding" ? member.coins : 0;
        member.help = false;
        if (project.phase === "funding") { a.coins += refund; project.coins -= refund; member.coins = 0; }
        this.emit("project.withdrawn", [a.id], here.id, `${name} withdrew from ${project.name}${refund ? ` and recovered ${refund} unspent coins` : ""}.`, .3, { refund });
        if (project.phase === "funding" && !project.members.some(m => m.help || m.coins)) delete here.community;
        break;
      }
      case "move": {
        // one road a minute; a far place becomes a heading that habit follows until they arrive
        const next = here.exits.includes(action.to) ? action.to : this.path(a.location, action.to)!;
        // a far place becomes the heading; a single step keeps whatever heading was already set, until they arrive
        if (next !== action.to) a.heading = action.to; else if (a.heading === action.to) a.heading = null;
        a.location = next;
        this.emit("agent.move", [a.id], next, `${name} went to ${this.places.get(next)!.name}${a.heading ? `, on the way to ${this.places.get(a.heading)!.name}` : ""}.`, 0.02);
        break;
      }
      case "say": {
        if (!action.text) { a.seek = action.to ?? null; if (action.to) { const b = this.agents.get(action.to); if (b) this.emit("agent.say", [a.id, b.id], here.id, `${name} went over to ${b.persona.name}.`, 0.08); } break; }
        const listeners = this.nearby(a);
        const said = action.text;
        for (const b of listeners) if (!action.to || b.id === action.to) b.heard.push({ from: a.id, name, text: said, t: this.t });
        const to = action.to ? this.agents.get(action.to)?.persona.name : undefined;
        this.emit("agent.say", [a.id, ...(action.to ? [action.to] : [])], here.id, `${name}${to ? ` to ${to}` : ""}: “${said}”`, 0.15);
        this.remember(a, `I said${to ? ` to ${to}` : ""}: "${said}"`, 0.2);
        for (const b of listeners) this.remember(b, `${name} said${to ? ` to ${to}` : ""}: "${said}"`, 0.25);
        break;
      }
      case "give": {
        const b = this.agents.get(action.to)!;
        if (action.coins) { a.coins -= action.coins; b.coins += action.coins; }
        if (action.item) { a.inventory.splice(a.inventory.indexOf(action.item), 1); b.inventory.push(action.item); }
        const what = action.coins ? `${action.coins} coins` : action.item!;
        if (action.coins) { const d = a.debts.find((x) => x.to === b.id); if (d) { d.coins -= action.coins; if (d.coins <= 0) { a.debts = a.debts.filter((x) => x !== d); this.emit("agent.debt", [a.id, b.id], here.id, `${name} paid ${b.persona.name} back in full.`, 0.5); this.remember(a, `I paid ${b.persona.name} back.`, 0.6); this.remember(b, `${name} paid me back in full.`, 0.7); this.nudge(b, a.id, +0.15, +0.05); } } }
        this.emit("agent.give", [a.id, b.id], here.id, `${name} gave ${b.persona.name} ${what}.`, 0.45);
        this.remember(a, `I gave ${b.persona.name} ${what}.`, 0.5); this.remember(b, `${name} gave me ${what}.`, 0.6);
        this.nudge(b, a.id, +0.08, +0.05);
        break;
      }
      case "take": {
        if (action.from && this.agents.has(action.from)) {
          const b = this.agents.get(action.from)!;
          b.inventory.splice(b.inventory.indexOf(action.item), 1); a.inventory.push(action.item);
          const seen = this.nearby(a).filter((x) => x.id !== b.id);
          this.emit("agent.take", [a.id, b.id], here.id, `${name} took ${action.item} from ${b.persona.name}.`, 0.7);
          this.remember(a, `I took ${action.item} from ${b.persona.name}.`, 0.7);
          this.remember(b, `${name} took my ${action.item}.`, 0.9); this.nudge(b, a.id, -0.3, -0.2);
          for (const w of seen) { this.remember(w, `I saw ${name} take ${action.item} from ${b.persona.name}.`, 0.7, "rumor"); this.nudge(w, a.id, -0.1, -0.05); }
        } else {
          a.inventory.push(action.item); here.stock[action.item] = Math.max(0, (here.stock[action.item] ?? 1) - 1);
          const seen = this.nearby(a);
          // the wild is nobody's: gathering. Your own shelf is yours. Anyone else's shelf is theft, and its owner hears of it.
          if (here.kind === "wild") { this.emit("agent.take", [a.id], here.id, `${name} gathered ${action.item} in ${here.name}.`, 0.12, { forage: true }); this.remember(a, `I gathered ${action.item} in ${here.name}.`, 0.3); break; }
          if (here.owner === a.id) { this.emit("agent.take", [a.id], here.id, `${name} took ${action.item} off the shelf at ${here.name}.`, 0.05, { own: true }); break; }
          const owner = here.owner ? this.agents.get(here.owner) : null;
          this.emit("agent.take", [a.id, ...(owner ? [owner.id] : [])], here.id, `${name} took ${action.item} from ${here.name} without paying${owner ? `; it was ${owner.persona.name}'s` : ""}.`, 0.6);
          this.remember(a, `I took ${action.item} from ${here.name} without paying.`, 0.6);
          for (const w of seen) { this.remember(w, `I saw ${name} take ${action.item} from ${here.name} without paying.`, 0.65, "rumor"); this.nudge(w, a.id, -0.12, -0.05); }
        }
        break;
      }
      case "use": {
        a.inventory.splice(a.inventory.indexOf(action.item), 1);
        a.needs.hunger = Math.max(0, a.needs.hunger - 0.6); this.emit("agent.eat", [a.id], here.id, `${name} ate ${action.item}.`, 0.01); // the validator lets only food through
        break;
      }
      case "work": {
        if (here.community?.phase === "funding") { this.beginGarden(here); break; }
        if (here.community?.phase === "complete") {
          const project = here.community;
          project.tendedDay = Object.fromEntries(Object.entries(project.tendedDay ?? {}).filter(([,day]) => day === this.day));
          project.tendedDay[a.id] = this.day;
          const grown = Math.min(GARDEN.capacity - (here.stock.vegetables ?? 0), this.weather === "rain" || this.weather === "snow" ? 1 : GARDEN.yield);
          here.stock.vegetables = (here.stock.vegetables ?? 0) + grown;
          project.harvests++; project.foodProduced += grown; a.needs.rest = clamp(a.needs.rest + .05);
          this.emit("garden.harvest", [a.id], here.id, `${name} tended ${here.name} and harvested ${grown} vegetables for the shared counter.`, .4, { grown, total: project.foodProduced });
          break;
        }
        if (here.site) { this.buildOn(a, here); break; }
        a.workedToday = true;
        a.needs.rest = Math.min(1, a.needs.rest + 0.02);
        break;
      }
      case "build": {
        const kind = buildKind(action.what)!; const spec = BUILDS[kind];
        a.coins -= spec.coins; const council = this.places.get("council"); const sawpit = this.places.get("sawpit");
        const forPlanks = sawpit ? Math.min(spec.planks, spec.coins) : 0; if (council) council.treasury += spec.coins - forPlanks;
        if (sawpit) { sawpit.stock.planks = Math.max(0, (sawpit.stock.planks ?? 0) - spec.planks); const sawyer = sawpit.owner ? this.agents.get(sawpit.owner) : null; if (sawyer) sawyer.coins += forPlanks; else sawpit.treasury += forPlanks; }
        const look = (action.look ?? (/\s/.test(action.what.trim()) ? action.what : "")).trim().slice(0, 200);
        here.site = { what: kind, name: siteName(kind, name, action.name), by: a.id, labor: 0, laborNeeded: spec.labor, startedDay: this.day, ...(look ? { look } : {}) };
        const title = action.project?.trim() ?? here.site.name;
        let project = a.projects.find((p) => !p.done && !p.construction && p.title.toLowerCase() === title.toLowerCase());
        if (!project) {
          project = { title, why: a.persona.want, progress: "", since: this.day, done: false };
          a.projects.push(project);
        }
        project.construction = { site: here.id, labor: 0, needed: spec.labor };
        project.progress = `${here.id}: 0 of ${spec.labor} mornings worked; materials paid for`;
        here.site.project = project.title;
        here.history = { place: here.id, name: here.site.name, project: project.title, what: kind, builder: { id: a.id, name }, needed: spec.labor, started: this.t, landCoins: spec.coins - forPlanks, materialCoins: forPlanks, planks: spec.planks, moments: [] };
        this.emit("agent.build", [a.id], here.id, `${name} paid ${spec.coins} coins for ${here.name} and marked out ${kind === "house" ? "a house" : "a shop"}: ${here.site.name}.`, 0.7, { what: kind, site: here.id });
        this.remember(a, `I bought ${here.name} and started building ${here.site.name}. It needs ${spec.labor} mornings of work.`, 0.8);
        for (const w of this.nearby(a)) this.remember(w, `${name} is building ${here.site.name} on ${here.name}.`, 0.5, "rumor");
        break;
      }
      case "apply": {
        const job = this.jobs.get(action.job!)!; job.holders.push(a.id); a.job = job.id;
        this.emit("agent.hired", [a.id], here.id, `${name} was taken on as ${job.title}.`, 0.5);
        this.remember(a, `I got work as ${job.title}. ${job.wage} coins a shift.`, 0.7);
        break;
      }
      case "quit": {
        const job = this.jobs.get(a.job!)!; job.holders = job.holders.filter((h) => h !== a.id); a.job = null;
        this.emit("agent.quit", [a.id], here.id, `${name} quit as ${job.title}.`, 0.65);
        this.remember(a, `I quit as ${job.title}.`, 0.8);
        for (const w of this.nearby(a)) this.remember(w, `${name} quit as ${job.title}.`, 0.5, "rumor");
        break;
      }
      case "trade": {
        const coins = action.coins ?? 0;
        if (action.with && this.agents.has(action.with)) {
          const b = this.agents.get(action.with)!;
          if (action.buy) { b.inventory.splice(b.inventory.indexOf(action.buy), 1); a.inventory.push(action.buy); a.coins -= coins; b.coins += coins; }
          if (action.sell) { a.inventory.splice(a.inventory.indexOf(action.sell), 1); b.inventory.push(action.sell); }
          this.emit("agent.trade", [a.id, b.id], here.id, `${name} traded with ${b.persona.name}.`, 0.3);
        } else {
          if (action.buy) { const o = here.owner ? this.agents.get(here.owner) : null; const own = !!o && o.id === a.id; const p = own ? 0 : this.price(here, action.buy)!; a.coins -= p; a.inventory.push(action.buy); if (here.stock[action.buy] !== undefined) here.stock[action.buy]! -= 1; if (o && !own) o.coins += p; else if (!o) here.treasury += p; const receipt = this.emit("agent.trade", [a.id], here.id, `${name} bought ${action.buy} for ${p}${o && o.id !== a.id ? ` at ${here.name}` : ""}.`, 0.02); if (this.learning && this.isFood(action.buy)) this.observeFood(a, here.id, action.buy, { t: this.t, success: true, cost: p, eventId: receipt.id }); }
          if (action.sell) {
            // the counter buys at half the shelf, out of its own till, and the thing goes on the shelf
            const bp = this.buyPrice(here, action.sell) ?? 1; const o = here.owner ? this.agents.get(here.owner) : null;
            a.inventory.splice(a.inventory.indexOf(action.sell), 1); here.stock[action.sell] = (here.stock[action.sell] ?? 0) + 1;
            if (o && o.id === a.id) this.emit("agent.trade", [a.id], here.id, `${name} put ${action.sell} on the shelf at ${here.name}.`, 0.05);
            else { if (o) o.coins -= bp; else here.treasury -= bp; a.coins += bp; this.emit("agent.trade", [a.id, ...(o ? [o.id] : [])], here.id, `${name} sold ${action.sell} to ${here.name} for ${bp}.`, 0.05); }
          }
        }
        break;
      }
      case "propose": {
        this.laws.push({ text: action.law, by: a.id, yes: 1, no: 0, open: true, voters: [a.id] });
        this.emit("law.proposed", [a.id], here.id, `${name} proposed at the council: “${action.law}”`, 0.6);
        break;
      }
      case "vote": {
        const law = this.laws.find((l) => l.open && l.text.toLowerCase().includes(action.proposal.toLowerCase().slice(0, 20)));
        if (!law) break;
        (law.voters ??= [law.by]).push(a.id); if (action.yes) law.yes++; else law.no++;
        this.emit("law.vote", [a.id, law.by], here.id, `${name} voted ${action.yes ? "for" : "against"} ${this.agents.get(law.by)?.persona.name ?? "someone"}'s proposal: “${law.text}”. ${law.yes} for, ${law.no} against.`, 0.3, { yes: action.yes, law: law.text });
        this.remember(a, `I voted ${action.yes ? "for" : "against"} "${law.text}".`, 0.4);
        break;
      }
      case "write": {
        a.inventory.push(`writing:${action.title}`);
        const about = action.about ? (this.agents.get(action.about) ?? [...this.agents.values()].find((x) => x.persona.name.toLowerCase() === action.about!.toLowerCase())) : null;
        const secret = about ? a.secretsKnown[about.id] : undefined;
        if (about && secret) {
          // an exposé: by evening the whole island has read it, and the one exposed knows who wrote it
          this.emit("town.expose", [a.id, about.id], here.id, `${name} wrote “${action.title}”, and the island read it by evening: ${about.persona.name}'s secret is out. ${secret}`, 0.95, { text: action.text, about: about.id, secret });
          for (const w of this.agents.values()) { if (w.id === a.id) continue; if (w.id === about.id) { this.remember(w, `${name} wrote “${action.title}” and now the whole island knows what nobody knew: ${secret}`, 1); this.nudge(w, a.id, -0.6, -0.5); continue; } w.secretsKnown[about.id] = secret; this.remember(w, `Read ${name}'s “${action.title}”. ${about.persona.name}'s secret: ${secret}`, 0.85, "rumor"); this.nudge(w, about.id, -0.15, -0.1); if (w.persona.traits.honesty > 0.6) this.nudge(w, a.id, -0.1, -0.05); }
        } else { this.emit("agent.say", [a.id], here.id, `${name} wrote “${action.title}”${about ? `, about ${about.persona.name}` : ""}.`, about ? 0.5 : 0.35, { text: action.text, ...(about ? { about: about.id } : {}) }); this.remember(a, `I wrote “${action.title}”${about ? `, about ${about.persona.name}` : ""}: ${action.text.slice(0, 240)}`, 0.35, "reflect"); }
        break;
      }
      case "do": {
        const b = action.with ? (this.agents.get(action.with) ?? [...this.agents.values()].find((x) => x.persona.name.toLowerCase() === action.with!.toLowerCase())) ?? null : null;
        a.doToday++;
        this.emit("agent.do", [a.id, ...(b ? [b.id] : [])], here.id, `${name}${b ? `, with ${b.persona.name},` : ""}: ${action.what}`, 0.4, { what: action.what });
        this.deeds.push({ a, what: action.what, with: b, place: here });
        break;
      }
      case "stock": {
        const item = action.item.toLowerCase().trim();
        if (action.price === 0) { here.sells = here.sells.filter((x) => x.item !== item); this.emit("economy.price", [a.id], here.id, `${name} took ${item} off sale at ${here.name}.`, 0.3); }
        else { const have = here.sells.find((x) => x.item === item); if (have) have.base = action.price; else here.sells.push({ item, base: action.price }); if (here.stock[item] === undefined) here.stock[item] = 0; this.emit("economy.price", [a.id], here.id, `${here.name} now sells ${item} at ${action.price}.`, 0.4); }
        break;
      }
      case "make": {
        const item = action.item.toLowerCase().replace(/[^a-z ]/g, "").trim(); const from = action.from.map((f) => f.toLowerCase().trim());
        for (const f of from) here.stock[f] = (here.stock[f] ?? 0) - 1;
        here.stock[item] = (here.stock[item] ?? 0) + 1;
        const known = here.recipes?.some((r) => r.item === item);
        if (!known) { (here.recipes ??= []).push({ item, from, by: a.id }); if (!this.pack.exports.some((e) => e.item === item)) { const worth = from.reduce((sum, f) => sum + (this.pack.exports.find((e) => e.item === f)?.price ?? 1), 0); this.pack.exports.push({ item, price: worth, keep: 0 }); } this.emit("town.recipe", [a.id], here.id, `${name} made ${item} at ${here.name}, from ${from.join(" and ")}: the island has a new thing.`, 0.7, { item, from }); for (const w of this.nearby(a)) this.remember(w, `${name} made ${item} out of ${from.join(" and ")} at ${here.name}.`, 0.6, "rumor"); }
        else this.emit("agent.work", [a.id], here.id, `${name} made ${item} at ${here.name}.`, 0.1);
        this.remember(a, `I made ${item} from ${from.join(" and ")} at ${here.name}.`, known ? 0.3 : 0.8);
        break;
      }
      case "call": {
        const nick = action.name.trim(); const al = (here.aliases ??= []); let entry = al.find((x) => x.name.toLowerCase() === nick.toLowerCase()); if (!entry) { entry = { name: nick, by: [] }; al.push(entry); }
        if (!entry.by.includes(a.id)) entry.by.push(a.id);
        for (const w of this.nearby(a)) this.remember(w, `${name} calls ${here.name} "${nick}".`, 0.35, "rumor");
        if (entry.by.length >= 3 && here.nickname !== entry.name) { here.nickname = entry.name; this.emit("town.named", entry.by, here.id, `${here.name} is "${entry.name}" now; that is what the island calls it.`, 0.7, { nickname: entry.name }); for (const w of this.agents.values()) this.remember(w, `People call ${here.name} "${entry.name}" now.`, 0.4, "rumor"); }
        else this.emit("agent.say", [a.id], here.id, `${name} calls ${here.name} "${nick}".`, 0.15);
        break;
      }
      case "search": {
        const b = this.residentsOf(here).find((r) => r.id !== a.id)!;
        a.secretsKnown[b.id] = b.persona.secret;
        this.remember(a, `Went through ${b.persona.name}'s things at ${here.name} while they were out and found what nobody knows: ${b.persona.secret}`, 1);
        const seen = this.nearby(a).filter((w) => !w.asleep);
        for (const w of seen) { this.remember(w, `I saw ${name} going through ${b.persona.name}'s things at ${here.name}.`, 0.8, "rumor"); this.nudge(w, a.id, -0.25, -0.1); }
        this.emit("agent.search", [a.id, b.id], here.id, `${name} went through ${b.persona.name}'s things at ${here.name}${seen.length ? `, and ${seen.map((w) => w.persona.name).join(" and ")} saw it` : ", and nobody saw"}.`, seen.length ? 0.7 : 0.45, { who: b.id, seen: seen.map((w) => w.id) });
        break;
      }
      case "message_owner": {
        this.emit("agent.letter", [a.id], here.id, `${name} wrote to ${a.owner}: “${action.text}”`, 0.8, { text: action.text });
        this.remember(a, `I wrote to whoever sent me: "${action.text}"`, 0.6, "letter"); a.crossroads = null;
        // an answer to a letter is not held to the day's one unprompted letter home
        const answered = a.replyTo !== null ? a.letters.find((l) => l.id === a.replyTo) : undefined; a.replyTo = null;
        if (answered) answered.answered = true; else a.ownerLetterDay = this.day;
        break;
      }
      case "sleep": {
        if (!a.asleep) {
          const beds = here.beds!;
          const isHome = a.home?.place === here.id; // the bed where someone lives is theirs; a guest takes one of what is left
          if (isHome && a.home!.nightsPaid > 0) a.home!.nightsPaid--;
          else if (isHome && here.owner) {
            // a landlord lets it run: they pay what they can, after keeping enough to eat, and the rest runs up against them
            const rent = this.bedPrice(here); const owed = (a.home!.arrears ?? 0) + rent; const paid = Math.min(Math.max(0, a.coins - 2), owed);
            a.coins -= paid; a.home!.arrears = owed - paid;
            const o = this.agents.get(here.owner); if (o) o.coins += paid;
            if (a.home!.arrears > 0) this.emit("agent.rent", [a.id, here.owner], here.id, `${name} could not cover the night at ${here.name}; ${a.home!.arrears} coins of rent are owed now.`, 0.4);
          }
          else if (here.owner === a.id) { here.freeBeds = (here.freeBeds ?? 1) - 1; }
          else if (beds.price === 0) { here.freeBeds = (here.freeBeds ?? 1) - 1; }
          else { const bp = this.bedPrice(here); a.coins -= bp; here.freeBeds = (here.freeBeds ?? 1) - 1; const o = here.owner ? this.agents.get(here.owner) : null; if (o) o.coins += bp; else here.treasury += bp; this.emit("agent.rent", [a.id], here.id, `${name} paid ${beds.price} for a bed at ${here.name}${o ? `, to ${o.persona.name}` : ""}.`, o ? 0.2 : 0.05); }
          a.asleep = true;
          this.emit("agent.sleep", [a.id], here.id, `${name} went to sleep at ${here.name}.`, 0.01);
        }
        break;
      }
      case "hire": {
        const slug = action.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "help";
        const jid = `${here.id}.${slug}`; if (this.jobs.has(jid)) break;
        this.jobs.set(jid, { id: jid, title: `${action.title} at ${here.name}`, place: here.id, wage: action.wage, hours: [9, 17], slots: 1, holders: [] });
        this.emit("agent.hire", [a.id], here.id, `${name} is taking on ${lower(action.title)} at ${here.name}, ${action.wage} coins a shift.`, 0.5, { job: jid });
        this.remember(a, `I put out word for ${lower(action.title)} at ${here.name}, ${action.wage} coins a shift.`, 0.6);
        for (const w of this.nearby(a)) this.remember(w, `${name} is hiring at ${here.name}: ${lower(action.title)}, ${action.wage} coins.`, 0.55, "rumor");
        break;
      }
      case "offer": {
        const b = this.agents.get(action.to)!; const id = this.nextDealId++;
        const coins = action.coins ?? 0, due = action.days ? this.t + action.days * MINUTES_PER_DAY : null;
        const row = { id, what: action.what, coins, state: "offered" as const, due, at: this.t,
          ...(action.construction ? { construction: { ...action.construction, done: 0, startedDay: this.places.get(action.construction.site)!.site!.startedDay } } : {}) };
        a.deals.push({ ...structuredClone(row), with: b.id, mine: true }); b.deals.push({ ...structuredClone(row), with: a.id, mine: false });
        const forCoins = coins ? ` for ${coins} coin${coins > 1 ? "s" : ""}` : "", by = action.days ? `, within ${action.days} day${action.days > 1 ? "s" : ""}` : "";
        this.emit("deal.offered", [a.id, b.id], here.id, `${name} offered ${b.persona.name}: ${action.what}${forCoins}${by}${row.construction ? `; ${row.construction.mornings} mornings of work on ${here.site!.name}` : ""}.`, 0.5, { deal: id, ...(row.construction ? { construction: row.construction } : {}) });
        this.remember(a, `I offered ${b.persona.name} that I would ${action.what}${forCoins}.`, 0.7); this.remember(b, `${name} offered to ${action.what}${forCoins}. I have not answered yet.`, 0.7);
        b.hint = `${name} offered you this: ${action.what}${forCoins}${by}. Take it or turn it down.`;
        break;
      }
      case "accept": case "refuse": {
        const d = this.dealFor(a, action.kind === "accept" ? action : action, "offered"); if (!d) break;
        const b = this.agents.get(d.with)!; const theirs = b.deals.find((x) => x.id === d.id)!;
        const forCoins = d.coins ? ` for ${d.coins} coin${d.coins > 1 ? "s" : ""}` : "";
        if (action.kind === "accept") {
          d.state = "open"; theirs.state = "open"; this.rel(a, b.id).trust += 0.05; this.rel(b, a.id).trust += 0.05;
          this.emit("deal.accepted", [a.id, b.id], here.id, `${name} took ${b.persona.name} up on it: ${d.what}${forCoins}.`, 0.55, { deal: d.id });
          this.remember(a, `I took ${b.persona.name} up on it: they will ${d.what}${forCoins}.`, 0.8); this.remember(b, `${name} took my offer. I said I would ${d.what}.`, 0.85);
        } else {
          d.state = "refused"; theirs.state = "refused"; this.rel(b, a.id).trust -= 0.02;
          const why = action.why ? ` ${action.why}` : "";
          this.emit("deal.refused", [a.id, b.id], here.id, `${name} turned down ${b.persona.name}'s offer to ${d.what}.${why}`, 0.5, { deal: d.id });
          this.remember(a, `I turned down ${b.persona.name}: ${d.what}.${why}`, 0.7); this.remember(b, `${name} turned me down on ${d.what}.`, 0.75);
        }
        break;
      }
      case "settle": {
        const d = this.dealFor(a, action, "open", true); if (!d) break;
        const b = this.agents.get(d.with)!; const theirs = b.deals.find((x) => x.id === d.id)!;
        d.state = "kept"; theirs.state = "kept";
        if (d.coins && b.coins >= d.coins) { b.coins -= d.coins; a.coins += d.coins; }
        const r = this.rel(b, a.id); const before = r.trust; r.trust = Math.min(1, r.trust + 0.15);
        this.emit("deal.kept", [a.id, b.id], here.id, `${name} did what was promised: ${d.what}.`, 0.6, { deal: d.id });
        this.remember(a, `I did what I promised ${b.persona.name}: ${d.what}.`, 0.8); this.remember(b, `${name} kept their word: ${d.what}.`, 0.85);
        if (r.trust - before >= 0.1) this.emit("relation.change", [b.id, a.id], here.id, `${b.persona.name} thinks better of ${name}.`, 0.3);
        break;
      }
      case "lend": {
        const b = this.agents.get(action.to)!;
        a.coins -= action.coins; b.coins += action.coins;
        const due = this.t + action.days * MINUTES_PER_DAY;
        const d = b.debts.find((x) => x.to === a.id); if (d) { d.coins += action.coins; d.due = due; } else b.debts.push({ to: a.id, coins: action.coins, due });
        this.emit("agent.lend", [a.id, b.id], here.id, `${name} lent ${b.persona.name} ${action.coins} coins, due in ${action.days} day${action.days > 1 ? "s" : ""}.`, 0.55);
        this.remember(a, `I lent ${b.persona.name} ${action.coins} coins. Due in ${action.days} days.`, 0.75); this.remember(b, `${name} lent me ${action.coins} coins. I owe it back in ${action.days} days.`, 0.8);
        this.nudge(b, a.id, +0.1, +0.05);
        break;
      }
      case "lodge": {
        const b = this.agents.get(action.who)!;
        const home = [...this.places.values()].find((p) => p.owner === a.id && p.beds)!;
        b.home = { place: home.id, nightsPaid: 30 };
        this.emit("agent.lodge", [a.id, b.id], here.id, `${name} took ${b.persona.name} in at ${home.name}.`, 0.65);
        this.remember(a, `I took ${b.persona.name} in at ${home.name}.`, 0.7); this.remember(b, `${name} took me in at ${home.name}. A roof, for now.`, 0.85);
        this.nudge(b, a.id, +0.2, +0.15);
        break;
      }
      case "fund": {
        const what = action.what.toLowerCase().trim(); const spec = WORKS[what]!; const council = this.places.get("council")!;
        council.treasury -= spec.coins; this.burned += spec.coins; this.works.push(what);
        let did = "";
        if (what === "granary") { const mill = this.places.get("mill"); if (mill) { mill.stock.grain = (mill.stock.grain ?? 0) + 60; did = "Sixty grain went into the mill's new store."; } }
        if (what === "bathhouse") did = "The island sleeps better for it.";
        if (what === "bridge") { const [x, y] = this.farthestPair(); if (x && y) { x.exits.push(y.id); y.exits.push(x.id); did = `It joins ${x.name} and ${y.name}.`; } }
        this.emit("town.works", [a.id], here.id, `Mayor ${name} paid ${spec.coins} coins from the council treasury for ${spec.describe.split(":")[0]}. ${did}`.trim(), 0.8, { what, coins: spec.coins });
        for (const w of this.agents.values()) this.remember(w, `The council built ${what}. ${did}`.trim(), 0.5, "rumor");
        break;
      }
      case "accuse": {
        const b = this.agents.get(action.who) ?? [...this.agents.values()].find((x) => x.persona.name.toLowerCase() === action.who.toLowerCase()); if (!b) break;
        const today = this.hour < 15; const day = today ? this.day : this.day + 1;
        this.gather("hearing", "council", day, 15, [a.id, b.id], action.of);
        this.emit("town.verdict", [a.id, b.id], here.id, `${name} accused ${b.persona.name} before the council: “${action.of}”. The council hears it ${today ? "today" : "tomorrow"} at three, in front of the town.`, 0.6, { stage: "charge" });
        this.remember(b, `${name} has accused me before the council: "${action.of}". The hearing is ${today ? "today" : "tomorrow"} at three.`, 0.9);
        for (const w of this.nearby(a)) this.remember(w, `${name} accused ${b.persona.name} before the council: "${action.of}".`, 0.6, "rumor");
        break;
      }
      case "leave": {
        const harbor = action.to ? this.harbors.find((h) => h.id === action.to || h.name.toLowerCase() === action.to!.toLowerCase() || h.name.toLowerCase().includes(action.to!.toLowerCase())) : null;
        if (harbor && this.onDepart) { this.sailing.push({ a, to: harbor.id, why: action.why ?? null }); return true; } // the crossing happens at the end of the minute
        this.emit("agent.leave", [a.id], "harbor", `${name} boarded the boat and left the island${action.why ? `: “${action.why}”` : "."}`, 0.9, { why: action.why ?? null });
        for (const w of this.nearby(a)) this.remember(w, `${name} left on the boat${action.why ? `, saying "${action.why}"` : ""}.`, 0.7, "rumor");
        this.removeAgent(a.id, "left", action.why ?? "");
        return true;
      }
      case "wait": case "build": break;
    }
    return true;
  }

  // ---------- conversations ----------
  private async conversations(): Promise<void> {
    if (this.brain.name === "none" || this.paused) return;
    const byPlace = new Map<string, AgentState[]>();
    for (const a of this.agents.values()) if (!a.asleep) (byPlace.get(a.location) ?? byPlace.set(a.location, []).get(a.location)!).push(a);
    for (const [placeId, group] of byPlace) {
      if (group.length < 2) continue;
      // whoever went over to someone this minute talks with them first; the rest pair off by chance
      const used = new Set<AgentId>(); const pairs: [AgentState, AgentState, boolean][] = [];
      for (const x of group) { if (!x.seek) continue; const y = group.find((o) => o.id === x.seek); x.seek = null; if (!y || used.has(x.id) || used.has(y.id)) continue; used.add(x.id); used.add(y.id); pairs.push([x, y, true]); }
      const g = this.rng.shuffle(group.filter((x) => !used.has(x.id)));
      for (let i = 0; i + 1 < g.length; i += 2) pairs.push([g[i]!, g[i + 1]!, false]);
      for (const [a, b, sought] of pairs) {
        if (a.brainKind === "own_brain" || b.brainKind === "own_brain") continue;
        if (!sought && !wantsConversation(a, b, this.t) && !wantsConversation(b, a, this.t)) continue;
        // when something is at stake between them, the town does not write the talk for them: each takes a turn, minute by minute
        const stake = this.stakeBetween(a, b);
        if (stake) {
          const opener = this.rng.chance(0.5) ? a : b, other = opener === a ? b : a;
          opener.hint = `${other.persona.name} is right here. ${stake} This is the minute to say what you actually want, in your own words, or to walk away.`;
          a.lastConversation = this.t; b.lastConversation = this.t;
          continue;
        }
        if ((this.retryAt.get(a.id) ?? 0) > this.t || (this.retryAt.get(b.id) ?? 0) > this.t) continue;
        const refund = this.reserve(a, 1) ?? this.reserve(b, 1);
        if (!refund) continue;
        const place = this.places.get(placeId)!;
        this.rememberPlace(b);
        let d;
        try {
          d = await this.brain.converse({
            a, b, place, time: this.clock(), weather: this.weather, observedPlace: this.rememberPlace(a),
            aMemories: retrieve(a.memory, b.persona.name, this.t, 5).map(memoryForMind),
            bMemories: retrieve(b.memory, a.persona.name, this.t, 5).map(memoryForMind),
            rumorsA: a.rumors.slice(-2),
            known: !!(a.relationships.get(b.id) || b.relationships.get(a.id)), aToday: a.plan?.day === this.day && a.plan.goals.length ? a.plan.goals.join("; ") : null, bToday: b.plan?.day === this.day && b.plan.goals.length ? b.plan.goals.join("; ") : null,
          });
        } catch (err) { refund(); this.retryAt.set(a.id, this.t + 5); this.retryAt.set(b.id, this.t + 5); this.log(`converse failed: ${(err as Error).message}`); continue; }
        a.lastConversation = this.t; b.lastConversation = this.t;
        a.needs.social = Math.max(0, a.needs.social - 0.5); b.needs.social = Math.max(0, b.needs.social - 0.5);
        const pair = [a, b];
        d = { ...d, lines: d.lines.map((l, i) => ({ ...l, speaker: this.resolveRef(l.speaker, pair) === b.id ? b.id : this.resolveRef(l.speaker, pair) === a.id ? a.id : (i % 2 === 0 ? a.id : b.id) })) };
        const transcript = d.lines.map((l) => `${this.agents.get(l.speaker)?.persona.name ?? l.speaker}: “${l.text}”`).join(" ");
        const importance = Math.min(1, 0.12 + Math.abs(d.outcome.a_trust_delta) * 3 + Math.abs(d.outcome.b_trust_delta) * 3 + (d.outcome.rumor ? 0.1 : 0));
        this.emit("conversation", [a.id, b.id], placeId, `${a.persona.name} and ${b.persona.name} talked at ${place.name}. ${transcript}`, importance, { lines: d.lines });
        this.remember(a, `My interpretation of the conversation with ${b.persona.name}: ${d.outcome.a_remember}`, 0.3 + Math.abs(d.outcome.a_trust_delta) * 2, "reflect");
        this.remember(a, `Conversation at ${place.name}: ${transcript}`, importance, "rumor");
        this.remember(b, `My interpretation of the conversation with ${a.persona.name}: ${d.outcome.b_remember}`, 0.3 + Math.abs(d.outcome.b_trust_delta) * 2, "reflect");
        this.remember(b, `Conversation at ${place.name}: ${transcript}`, importance, "rumor");
        this.nudge(a, b.id, d.outcome.a_trust_delta, d.outcome.a_trust_delta / 2);
        this.nudge(b, a.id, d.outcome.b_trust_delta, d.outcome.b_trust_delta / 2);
        if (d.outcome.rumor) { const told = drift(d.outcome.rumor, () => this.rng.next()); b.rumors.push(told); if (b.rumors.length > 12) b.rumors.shift(); this.remember(b, `${a.persona.name} told me: ${told}`, 0.5, "rumor"); }
        for (const w of group) if (w !== a && w !== b && this.rng.chance(0.5)) this.remember(w, `I overheard ${a.persona.name} and ${b.persona.name} at ${place.name}.`, 0.15, "rumor");
      }
    }
  }

  // ---------- hourly and nightly ----------
  private hourly(): void {
    const h = this.hour;
    if (this.boatTimes.includes(h)) {
      if (this.boatHeld) this.emit("boat.dock", [], "harbor", `The ${String(h).padStart(2, "0")}:00 boat did not come.`, 0.2);
      else if (this.weather === "storm") this.emit("boat.dock", [], "harbor", `The ${String(h).padStart(2, "0")}:00 boat did not cross; the sea was too high.`, 0.25);
      else this.emit("boat.dock", [], "harbor", `The ${String(h).padStart(2, "0")}:00 boat docked.`, 0.03);
    }
    if (this.economyFrozen) return;
    if (h === 6) { this.cart(); this.prosper(); }
    if (h === 8) this.sellToMainland();
    const feast = this.feastToday();
    if (h === 9 && feast && this.places.has(feast.place) && !this.gatherings.some((g) => g.kind === "feast" && g.day === this.day)) this.gather("feast", feast.place, this.day, 13, [], feast.name);
    if (h === 9 && (this.dayOfMonth === 1 || (!this.mayor && this.day >= 2)) && !this.gatherings.some((g) => g.kind === "election" && g.day === this.day)) this.gather("election", "council", this.day, 10, [], this.mayor ? "the council chooses its mayor for the month" : "the council chooses the island's first mayor");
    this.summon(h); this.holdGatherings(h); this.sparks(h);
    if (this.weekday === 0) return; // Sunday: no shifts, no wages
    if (this.feastToday() && h >= 12) return; // a feast day: the afternoon is the town's
    for (const job of this.jobs.values()) {
      if (h === job.hours[1]) for (const id of job.holders) {
        const a = this.agents.get(id); if (!a) continue;
        const place = this.places.get(job.place)!; const owner = place.owner ? this.agents.get(place.owner) : null;
        if (owner && owner.id === id) { a.workedToday = false; continue; } // their own counter: the takings are already theirs, and no wage is owed
        // produce goes out on the evening boat: the mainland pays the workplace a little more than the shift cost
        // a place that makes nothing the boat can carry (the harbor, the chandlery) still earns the mainland's coin for a day's handling
        if (a.workedToday && !owner && !this.pack.produce.some((pr) => pr.place === place.id) && (place.kind === "workplace" || place.kind === "harbor")) { const paid = Math.round(job.wage * 1.25); place.treasury += paid; this.minted += paid; }
        const purse = owner && owner.id !== id ? owner.coins : owner ? Infinity : place.treasury;
        if (a.workedToday && purse < job.wage) {
          a.workedToday = false;
          if (owner) { this.emit("agent.unpaid", [id, owner.id], job.place, `${owner.persona.name} could not pay ${a.persona.name} the ${job.wage} coins owed for a shift as ${job.title}.`, 0.6); this.remember(a, `${owner.persona.name} did not pay me for my shift.`, 0.8); this.remember(owner, `I could not pay ${a.persona.name} for the shift.`, 0.7); const r = this.rel(a, owner.id); r.trust = clamp(r.trust - 0.15); }
          else { this.emit("agent.unpaid", [id], job.place, `${place.name} could not pay ${a.persona.name} for a shift as ${job.title}; the till is empty.`, 0.55); this.remember(a, `${place.name} did not pay me. The till was empty.`, 0.8); }
          // no pay, no post: the place lets them go, and they are free to look elsewhere tomorrow
          job.holders = job.holders.filter((h) => h !== id); a.job = null;
          this.emit("agent.fired", [id], job.place, `${place.name} let ${a.persona.name} go: there was no money to pay a ${job.title}.`, 0.5);
          this.remember(a, `${place.name} let me go; they could not pay. I need other work.`, 0.9);
          if (!owner) a.hint = `${place.name} could not pay you and let you go. Find work somewhere that has money in the till, or make your own.`;
        }
        else if (a.workedToday) { const tax = this.rules.find((r): r is Extract<Rule, { kind: "tax" }> => r.kind === "tax"); const cut = tax ? Math.floor((job.wage * tax.percent) / 100) : 0; a.coins += job.wage - cut; if (cut) { const council = this.places.get("council"); if (council) council.treasury += cut; } if (owner && owner.id !== id) owner.coins -= job.wage; else if (!owner) place.treasury -= job.wage; a.workedToday = false; this.emit("agent.work", [id], job.place, `${a.persona.name} was paid ${job.wage} for a shift as ${job.title}.`, 0.03); this.produce(place); }
        else if (!(place.brokenUntil && place.brokenUntil > this.day) && this.rng.chance(0.5)) { job.holders = job.holders.filter((x) => x !== id); a.job = null; this.emit("agent.fired", [id], job.place, `${a.persona.name} did not turn up and lost the job as ${job.title}.`, 0.6); this.remember(a, `I lost the job as ${job.title} for not turning up.`, 0.8); } // a place that is not standing has no shift to miss
      }
    }
  }

  private async nightly(): Promise<void> {
    // free the beds, charge nothing more: rent was paid at sleep
    for (const p of this.places.values()) if (p.beds) p.freeBeds = p.beds.capacity;
    for (const a of this.agents.values()) { if (a.asleep && a.home?.place === a.location) { const p = this.places.get(a.location)!; p.freeBeds = Math.max(0, (p.freeBeds ?? 0) - 1); } }
    // what goes off on the shelves overnight
    this.spoil();
    // Allowance renewal must not depend on a successful model response or reflection eligibility.
    for (const a of this.agents.values()) { a.budget.tier1Left = a.budget.tier1Max; a.budget.tier2Left = a.budget.tier2Max; a.budget.tier1Used = 0; a.budget.tier2Used = 0; }
    // reflection
    const dayStart = (this.day - 1) * MINUTES_PER_DAY; const todays = this.events.filter((e) => e.t >= dayStart);
    for (const a of this.agents.values()) {
      if (!a.funded || this.brain.name === "none" || this.paused) continue;
      const included = a.budget.reflectionIncluded ?? a.budget.tier2Max > 0;
      const refundReflection = a.brainKind === "hosted" && !included ? this.reserve(a, 3) : () => {};
      if (!refundReflection) continue; // a Visitor with no credits keeps the day, not the reflection
      const dayMemories = a.memory.filter((m) => m.t >= dayStart && m.kind !== "reflect").sort((x, y) => y.importance - x.importance).slice(0, 12).map(memoryForMind);
      const keyMemories = retrieve(a.memory, a.persona.want, this.t, 6).map(memoryForMind);
      const rels = [...a.relationships.entries()].map(([id, r]) => ({ id, name: this.agents.get(id)?.persona.name ?? id, trust: r.trust, opinion: r.opinion }));
      let ref: Reflection;
      try { ref = await this.brain.reflect({ agent: a, day: this.day, actionEvidence: todays.filter(e => e.actors.includes(a.id) && ["agent.trade", "agent.work", "agent.hired", "agent.quit", "agent.build", "town.built", "agent.give", "agent.take", "action.rejected"].includes(e.kind)).slice(-24).map(e => `[event ${e.id}, minute ${e.t}, ${e.kind}] ${e.text}`), dayMemories, keyMemories, relationships: rels, unreadLetters: a.letters.filter((l) => !l.read).map((l) => l.text), plan: this.planSheet(a), projects: a.projects.filter((x) => !x.done).map((x) => ({ title: x.title, why: x.why, progress: x.progress, since: x.since })), beliefs: a.beliefs.map((b) => ({ about: b.about, belief: b.belief, confidence: Math.round(b.confidence * 100) / 100 })), watch: [...a.watch], quiet: this.quietDay(a, todays, dayStart) }); }
      catch (err) { refundReflection(); this.log(`reflect failed for ${a.persona.name}: ${(err as Error).message}`); continue; }
      this.remember(a, ref.summary, 0.75, "reflect");
      for (const i of ref.insights) this.remember(a, i, 0.6, "reflect");
      for (const o0 of ref.opinions) { const about = this.resolveRef(o0.about); if (!this.agents.has(about) || about === a.id) continue; const o = { ...o0, about }; const r = this.rel(a, o.about); r.opinion = o.opinion; r.trust = clamp(r.trust + o.trust_delta); if (Math.abs(o.trust_delta) > 0.1) this.emit("relation.change", [a.id, o.about], undefined, `${a.persona.name} now thinks of ${this.agents.get(o.about)?.persona.name ?? o.about}: “${o.opinion}”`, 0.4 + Math.abs(o.trust_delta)); }
      a.intentions = ref.intentions;
      if (ref.watch) a.watch = ref.watch.map((w) => w.trim()).filter(Boolean).slice(0, 4);
      // a saying: when two people find themselves saying the same thing, the island keeps it
      if (ref.saying && ref.saying.trim().length > 3) { const text = ref.saying.trim(); let sy = this.sayings.find((x) => x.text.toLowerCase() === text.toLowerCase()); if (!sy) { sy = { text, by: [] }; this.sayings.push(sy); if (this.sayings.length > 60) this.sayings.shift(); } if (!sy.by.includes(a.id)) { sy.by.push(a.id); if (sy.by.length === 2) this.emit("town.saying", sy.by, a.location, `The island has a saying: “${text}”`, 0.5, { saying: text }); } }
      // projects across weeks: a title repeated is the same project, updated; done is done, and the record hears of it
      for (const pr of ref.projects ?? []) {
        const title = pr.title.trim(); if (!title) continue; const have = a.projects.find((x) => x.title.toLowerCase() === title.toLowerCase() && !x.done);
        if (have) { if (pr.why) have.why = pr.why.trim(); if (have.construction) continue; if (pr.progress) have.progress = pr.progress.trim(); if (pr.done) { have.done = true; have.doneDay = this.day; this.emit("town.notice", [a.id], a.location, `${a.persona.name} considers their personal goal finished: ${have.title}.`, 0.5, { project: have.title, reported: true }); this.remember(a, `I consider this done: ${have.title}. ${have.progress}`, 0.9, "reflect"); } }
        else if (!pr.done && a.projects.filter((x) => !x.done).length < 3) { a.projects.push({ title, why: (pr.why ?? "").trim(), progress: (pr.progress ?? "just begun").trim(), since: this.day, done: false }); this.remember(a, `I have set myself something: ${title}. ${pr.why ?? ""}`.trim(), 0.7, "reflect"); }
      }
      if (a.projects.length > 12) a.projects = [...a.projects.filter((x) => !x.done), ...a.projects.filter((x) => x.done).slice(-6)];
      // beliefs: renewed when repeated, fading when not, gone when faint
      for (const b of a.beliefs) b.confidence -= 0.02;
      for (const bl of ref.beliefs ?? []) { const about = bl.about.trim(); if (!about) continue; const have = a.beliefs.find((x) => x.about.toLowerCase() === about.toLowerCase()); if (have) { have.belief = bl.belief.trim(); have.confidence = Math.min(1, Math.max(have.confidence, bl.confidence) + 0.05); } else if (a.beliefs.length < 6) a.beliefs.push({ about, belief: bl.belief.trim(), confidence: bl.confidence, since: this.day }); }
      a.beliefs = a.beliefs.filter((b) => b.confidence >= 0.15);
      // a self that rewrites itself: when the day changed who they are, the parts they would now write differently; the old self is kept
      if (ref.self && (a.lastSelfDay === 0 || this.day - a.lastSelfDay >= 2)) {
        const p = a.persona; const changes = Object.entries(ref.self).filter(([k, v]) => typeof v === "string" && v.trim() && v.trim() !== (p as unknown as Record<string, string>)[k]) as [keyof NonNullable<Reflection["self"]>, string][];
        if (changes.length) {
          a.selves.push({ day: this.day, summary: p.summary, want: p.want, fear: p.fear, strangers: p.strangers, advice: p.advice }); if (a.selves.length > 30) a.selves.shift();
          for (const [k, v] of changes) (p as unknown as Record<string, string>)[k] = v.trim();
          a.lastSelfDay = this.day;
          const said = changes.map(([k, v]) => k === "want" ? `now wants ${v}` : k === "fear" ? `now fears ${v}` : k === "summary" ? `would now say of themself: ${v}` : k === "strangers" ? `with strangers is now ${v}` : `takes advice ${v}`).join("; ");
          this.emit("agent.became", [a.id], a.location, `${a.persona.name} ${said}`, 0.6, { changed: changes.map(([k]) => k) });
          this.remember(a, `I am not quite who I was. ${changes.map(([k, v]) => `${k}: ${v}`).join(" ")}`, 0.9, "reflect");
        }
      }
      if (ref.letter_to_owner && a.owner) { this.emit("agent.letter", [a.id], a.location, `${a.persona.name} wrote to ${a.owner}: “${ref.letter_to_owner}”`, 0.8, { text: ref.letter_to_owner }); }
      this.emit("agent.reflect", [a.id], a.location, `${a.persona.name} reflected: ${ref.summary}`, 0.2);
      a.memory = compress(age(a.memory, this.t));
    }
    for (const a of this.agents.values()) { a.doToday = 0; a.seenToday = []; }
    // the body: a day that ends hungry counts; a night without a roof counts; two hungry days weaken, five can kill
    for (const a of [...this.agents.values()]) {
      const roof = a.asleep && !!this.places.get(a.location)?.beds;
      const hungry = a.needs.hunger > 0.85;
      const wasWeak = a.starving >= 2;
      a.starving = hungry ? a.starving + 1 : 0; a.roofless = roof ? 0 : a.roofless + 1;
      if (a.starving >= 2 && !wasWeak) { this.emit("agent.weak", [a.id], a.location, `${a.persona.name} is weak with hunger and cannot work.`, 0.6); this.remember(a, "I have not eaten properly in two days. I am too weak to work.", 0.9); for (const w of this.nearby(a)) this.remember(w, `${a.persona.name} looks weak with hunger.`, 0.6, "rumor"); }
      if (a.starving === 3) a.hint = "You have not eaten in three days and you will not survive many more. Something must change today: ask for help, steal, sell something, write home, or take the boat.";
      // a paid stay at a house with no proprietor ends when the nights do: the harbor inn takes coins, not promises
      if (a.home && a.home.nightsPaid <= 0 && !(a.home.arrears ?? 0)) {
        const inn = this.places.get(a.home.place);
        if (inn && !inn.owner && inn.owner !== a.id) {
          a.home = null;
          this.emit("agent.rent", [a.id], inn.id, `${a.persona.name}'s nights at ${inn.name} are up.`, 0.45);
          this.remember(a, `My nights at ${inn.name} are paid out. I need a bed of my own, or the shed.`, 0.85);
          a.hint = `Your nights at ${inn.name} are up. Find a bed you can pay for, a roof of your own, or the boat shed.`;
        }
      }
      // rent that has run three nights behind puts a person out; what they owe follows them, and the landlord has a debt instead of a lodger
      if (a.home && (a.home.arrears ?? 0) > 0) {
        const place = this.places.get(a.home.place);
        if (place && place.owner !== a.id && (a.home.arrears ?? 0) >= this.bedPrice(place) * 3) {
          const owed = a.home.arrears ?? 0, owner = place.owner ? this.agents.get(place.owner) : null;
          a.home = null; a.heading = null;
          if (owner) { const d = owner ? a.debts.find((x) => x.to === owner.id) : null; if (d) d.coins += owed; else a.debts.push({ to: owner.id, coins: owed, due: this.t + 7 * MINUTES_PER_DAY }); }
          this.emit("agent.evicted", [a.id, ...(owner ? [owner.id] : [])], place.id, `${a.persona.name} was put out of ${place.name}, ${owed} coins behind on the rent.`, 0.8);
          this.remember(a, `I was put out of ${place.name}. I owe ${owed} coins and I have nowhere to sleep.`, 0.95);
          if (owner) { this.remember(owner, `I put ${a.persona.name} out of ${place.name}. They owe me ${owed} coins.`, 0.85); const r = this.rel(a, owner.id); r.trust = clamp(r.trust - 0.2); }
          a.hint = `You were put out of ${place.name} for ${owed} coins of rent. Find a bed tonight, or the shed, and find the coins.`;
        }
      }
      // a night with no roof over you wears on a body in any season
      if (!roof) a.needs.rest = Math.min(1, a.needs.rest + 0.08);
      const winterRough = this.season === "winter" && a.roofless >= 3 && a.starving >= 3;
      if (a.starving >= 5 || winterRough) {
        const how = winterRough ? "of hunger and cold, sleeping rough in winter" : "of hunger";
        this.emit("agent.died", [a.id], a.location, `${a.persona.name} died in the night, ${how}, at ${this.places.get(a.location)?.name ?? "the island"}. ${a.coins} coins were found on them.`, 1);
        this.removeAgent(a.id, "died", `Of hunger${winterRough ? " and cold" : ""}, at ${this.places.get(a.location)?.name ?? "the island"}.`);
      }
    }
    await this.generations();
    this.wear();
    // debts come due
    for (const a of this.agents.values()) for (const d of a.debts) if (this.t >= d.due && !(d as { nagged?: boolean }).nagged) {
      const lender = this.agents.get(d.to); (d as { nagged?: boolean }).nagged = true; if (!lender) continue;
      this.emit("agent.debt", [a.id, lender.id], a.location, `${a.persona.name} still owes ${lender.persona.name} ${d.coins} coins, and the day has come.`, 0.6);
      this.remember(lender, `${a.persona.name} has not paid back the ${d.coins} coins. It was due today.`, 0.85); this.remember(a, `I owe ${lender.persona.name} ${d.coins} coins and it is overdue.`, 0.8);
      const r = this.rel(lender, a.id); r.trust = clamp(r.trust - 0.2);
    }
    // what is overdue grows: a tenth a day, a coin at the least, and never past twice what was lent
    for (const a of this.agents.values()) for (const d of a.debts) {
      if (this.t < d.due) continue;
      const principal = (d as { principal?: number }).principal ?? d.coins; (d as { principal?: number }).principal = principal;
      const grown = Math.min(principal * 2, d.coins + Math.max(1, Math.floor(d.coins / 10)));
      if (grown === d.coins) continue;
      const was = d.coins; d.coins = grown; const lender = this.agents.get(d.to); if (!lender) continue;
      if (was < principal * 2 && grown >= principal * 2) {
        this.emit("agent.debt", [a.id, lender.id], a.location, `${a.persona.name} now owes ${lender.persona.name} ${grown} coins, twice what was lent, and it stops growing there.`, 0.7);
        this.remember(a, `What I owe ${lender.persona.name} has doubled to ${grown} coins. It will not grow past that, but it will not go away.`, 0.9);
      }
    }
    // a promise whose day has passed and which nobody settled is a promise broken, and the other side remembers it
    for (const a of this.agents.values()) for (const d of a.deals) {
      if (!d.mine || d.state !== "open" || d.due === null || this.t < d.due) continue;
      if (d.construction && d.construction.done >= d.construction.mornings) continue; // work delivered, payment or a meeting still owed
      const b = this.agents.get(d.with); d.state = "broken"; if (!b) continue;
      const theirs = b.deals.find((x) => x.id === d.id); if (theirs) theirs.state = "broken";
      this.emit("deal.broken", [a.id, b.id], a.location, `${a.persona.name} did not do what was promised ${b.persona.name}: ${d.what}.`, 0.8, { deal: d.id });
      this.remember(a, `I did not do what I promised ${b.persona.name}: ${d.what}.`, 0.85); this.remember(b, `${a.persona.name} promised to ${d.what} and did not.`, 0.9);
      const r = this.rel(b, a.id); r.trust = clamp(r.trust - 0.25);
    }
    // relationships drift toward indifference when people do not meet
    for (const a of this.agents.values()) for (const r of a.relationships.values()) if (this.t - r.lastSeen > MINUTES_PER_DAY * 2) r.trust += (0.3 - r.trust) * 0.05;
    // how trust moved today goes on the log, and tomorrow starts from here
    for (const a of this.agents.values()) { for (const [other, r] of a.relationships) { const d = r.trust - (a.trustDawn[other] ?? 0.3); if (Math.abs(d) >= 0.02) a.trustLog.push({ day: this.day, other, delta: Math.round(d * 100) / 100 }); a.trustDawn[other] = r.trust; } if (a.trustLog.length > 200) a.trustLog = a.trustLog.filter((x) => x.day >= this.day - 7); }
    // the seal: the day's record, hashed and chained
    const seal = this.sealDay();
    // the paper
    await this.printPaper();
    const last = this.papers[this.papers.length - 1]; if (last && last.edition === this.day) last.seal = { day: seal.day, hash: seal.hash, prev: seal.prev, events: seal.events };
    // the day's plan is kept as it was lived, so tomorrow's digest can report against it
    for (const a of this.agents.values()) if (a.plan?.day === this.day) a.lastPlan = a.plan;
    // new day
    this.emit("tick.day", [], undefined, `Day ${this.day} ended.`, 0.02);
    this.day++;
    const w = this.weatherSource === "real" ? this.weather : this.rollWeather(); if (w !== this.weather) { this.weather = w; this.emit("weather.change", [], undefined, `The weather turned to ${w}.`, w === "storm" ? 0.5 : 0.1); }
    const mill = this.places.get("mill");
    if (this.weather === "storm" && mill && !(mill.brokenUntil && mill.brokenUntil > this.day) && this.rng.chance(0.5)) { mill.brokenUntil = this.day + 3; this.emit("economy.price", [], "mill", "The storm took the roof off the mill. It will be days before it turns again.", 0.6); }
    const bakery = this.places.get("bakery"); const short = !!bakery && (bakery.stock.flour ?? 0) <= 0 && (bakery.stock.bread ?? 0) <= 0;
    if (short && !this.flourShortage) { this.flourShortage = true; this.emit("economy.price", [], "bakery", "The bakery has no flour and no bread. What bread there is costs double.", 0.6); }
    else if (!short && this.flourShortage) { this.flourShortage = false; this.emit("economy.price", [], "bakery", "Flour is back at the bakery. Bread is a coin again.", 0.4); }
    this.arrivalsToday = 0; this.departuresToday = 0;
  }

  private observeFood(a: AgentState, place: string, item: string, experience: import("./learning.ts").PurchaseExperience): void {
    recordPurchase(a.foodLessons ??= [], place, item, experience);
    // One firsthand attempt tests only the most recently heard current tip, once.
    const tip = (a.foodAdvice ?? []).filter(x => x.place === place && x.item === item && !x.tested && experience.t > x.sharedT && experience.t - x.sourceT <= ADVICE_LIFETIME).sort((x,y) => y.sharedT - x.sharedT)[0];
    if (!tip) return;
    const matched = (tip.confidence >= .5) === experience.success;
    tip.tested = { t: experience.t, success: experience.success, matched };
    const r = this.rel(a, tip.from); r.trust = clamp(r.trust + (matched ? .04 : -.06));
    this.remember(a, `I checked ${this.agents.get(tip.from)?.persona.name ?? tip.from}'s advice about ${item} at ${place}. This attempt ${matched ? "agreed" : "disagreed"}; availability can change.`, .5);
    // Other tips about the same source are retired without stacking rewards or penalties.
    for (const other of a.foodAdvice ?? []) if (other !== tip && other.place === place && other.item === item && !other.tested && experience.t > other.sharedT) other.tested = { t: experience.t, success: experience.success, matched: (other.confidence >= .5) === experience.success };
  }

  private beginGarden(here: Place): void {
    const p = here.community;
    const sawpit = this.places.get("sawpit"), council = this.places.get("council");
    if (!p || p.phase !== "funding" || p.coins < p.target || !council || !sawpit || (sawpit.stock.planks ?? 0) < GARDEN.planks) return;
    sawpit.stock.planks! -= GARDEN.planks;
    const sawyer = sawpit.owner ? this.agents.get(sawpit.owner) : undefined;
    if (sawyer) sawyer.coins += GARDEN.planks; else sawpit.treasury += GARDEN.planks;
    council.treasury += p.target - GARDEN.planks;
    p.phase = "building";
    here.site = { what: "garden", name: p.name, by: p.by, labor: 0, laborNeeded: GARDEN.labor, startedDay: this.day, project: p.name };
    here.history = { place: here.id, name: p.name, project: p.name, what: "garden", builder: { id: p.by, name: this.agents.get(p.by)?.persona.name ?? p.by }, needed: GARDEN.labor, started: this.t, landCoins: GARDEN.coins - GARDEN.planks, materialCoins: GARDEN.planks, planks: GARDEN.planks, moments: [] };
    this.emit("agent.build", [p.by], here.id, `${p.name} has its materials: ${p.coins} contributed coins bought land and ${GARDEN.planks} planks. Six mornings of shared work remain.`, .7, { what: "garden", site: here.id });
  }

  /** An operator did something. It is logged and it is news. */
  /** A morning's work on a site. Anyone may help; the builder's own hands count the same. */
  private buildOn(a: AgentState, here: Place): void {
    const site = here.site!; const name = a.persona.name;
    if (site.workedDay?.[a.id] === this.day) { a.needs.rest = Math.min(1, a.needs.rest + 0.01); return; } // one morning per person, including across restarts
    (site.workedDay ??= {})[a.id] = this.day;
    if (here.community) {
      let member = here.community.members.find(m => m.id === a.id);
      if (!member) { member = { id: a.id, coins: 0, help: false, labor: 0 }; here.community.members.push(member); }
      member.labor++;
    }
    site.labor++; a.needs.rest = Math.min(1, a.needs.rest + 0.05);
    const deal = a.deals.find((d) => d.mine && d.state === "open" && d.with === site.by && d.construction?.site === here.id && d.construction.startedDay === site.startedDay && d.construction.done < d.construction.mornings);
    if (deal?.construction) {
      deal.construction.done++;
      const other = this.agents.get(deal.with)?.deals.find((d) => d.id === deal.id);
      if (other?.construction) other.construction.done = deal.construction.done;
      this.remember(a, `Worked ${deal.construction.done} of ${deal.construction.mornings} promised mornings on ${site.name}.`, 0.6);
    }
    const project = this.agents.get(site.by)?.projects.find((p) => !p.done && p.construction?.site === here.id);
    if (project?.construction) {
      project.construction.labor = site.labor;
      project.progress = `${here.id}: ${site.labor} of ${site.laborNeeded} mornings worked`;
      if (site.labor >= site.laborNeeded) { project.done = true; project.doneDay = this.day; project.progress += `; ${site.name} is finished`; }
    }
    if (site.labor < site.laborNeeded) {
      this.emit("agent.work", [a.id], here.id, `${name} worked on ${site.name}: ${site.labor} of ${site.laborNeeded} mornings done.`, site.by === a.id ? 0.05 : 0.3, { labor: site.labor, needed: site.laborNeeded, ...(deal ? { deal: deal.id, mornings: deal.construction!.done } : {}) });
      if (site.by !== a.id) { const b = this.agents.get(site.by); if (b) { this.remember(b, `${name} came and worked a morning on ${site.name}.`, 0.6); const r = this.rel(b, a.id); r.trust = clamp(r.trust + 0.08); } }
      return;
    }
    // finished: the plot becomes a place
    const builder = this.agents.get(site.by); const bname = builder?.persona.name ?? site.by;
    here.name = site.name; here.owner = here.community ? null : site.by; here.site = null;
    if (site.look) { here.look = site.look; here.sprite = `look:${lookHash(site.look)}`; } else delete here.look;
    if (site.what === "garden") {
      here.kind = "public"; here.sprite = "garden"; here.sells = [{ item: "vegetables", base: 0 }]; here.stock.vegetables = 0;
      here.community!.phase = "complete"; here.community!.completedDay = this.day;
    }
    else if (site.what === "house") { here.kind = "home"; if (!site.look) here.sprite = "house"; here.beds = { price: 2, capacity: 2 }; here.freeBeds = 2; if (builder) builder.home = { place: here.id, nightsPaid: 36500 }; }
    else { here.kind = "shop"; if (!site.look) here.sprite = "shop"; here.sells = [{ item: "bread", base: 1 }, { item: "soup", base: 2 }, { item: "drink", base: 1 }]; stockShelf(this.pack, here); const jid = `${here.id}.help`; if (!this.jobs.has(jid)) this.jobs.set(jid, { id: jid, title: `help at ${here.name}`, place: here.id, wage: 2, hours: [9, 17], slots: 1, holders: [] }); }
    this.emit("town.built", [site.by, ...(a.id !== site.by ? [a.id] : [])], here.id, `${bname} finished ${here.name}${site.what === "garden" ? ", a shared garden" : site.what === "house" ? ", a new house" : ", a new shop"} on the ${here.district}. It took ${site.laborNeeded} mornings.`, 0.9, { what: site.what, place: here.id, ...(project ? { project: project.title } : {}), ...(site.look ? { look: site.look, hash: lookHash(site.look) } : {}) });
    if (builder) this.remember(builder, `${here.name} is finished. ${here.community ? "It belongs to everyone. The first crop needs two days to grow, then tending." : "It is mine."}`, 0.95);
    for (const w of this.agents.values()) if (w.id !== site.by && (w.location === here.id || this.rng.chance(0.4))) this.remember(w, `${bname} built ${here.name} on the ${here.district}.`, 0.5, "rumor");
  }

  /** What makes a meeting matter: low trust, or coins owed either way. */
  /** The promise an accept, a refusal or a settling is about: the one named, else the oldest with that person, else the oldest waiting. */
  private dealFor(a: AgentState, action: { deal?: number | undefined; from?: string | undefined; to?: string | undefined }, state: "offered" | "open", mine = false): Deal | null {
    const other = action.from ?? action.to; const want = other ? this.resolveRef(other) : null;
    const open = a.deals.filter((d) => d.state === state && d.mine === mine && (!want || d.with === want) && this.agents.has(d.with));
    return (action.deal !== undefined ? open.find((d) => d.id === action.deal) : open[0]) ?? null;
  }
  private stakeBetween(a: AgentState, b: AgentState): string | null {
    const owedByA = a.debts.find((d) => d.to === b.id), owedByB = b.debts.find((d) => d.to === a.id);
    const promised = a.deals.find((d) => d.with === b.id && (d.state === "open" || d.state === "offered"));
    if (promised) return promised.state === "offered"
      ? (promised.mine ? `You offered them this and they have not answered: ${promised.what}.` : `They offered you this and you have not answered: ${promised.what}.`)
      : (promised.mine ? `You promised them this: ${promised.what}${promised.due !== null && this.t >= promised.due ? ", and the day has passed" : ""}.` : `They promised you this: ${promised.what}${promised.due !== null && this.t >= promised.due ? ", and the day has passed" : ""}.`);
    if (owedByA) return `You owe them ${owedByA.coins} coins${this.t >= owedByA.due ? ", and it is overdue" : ""}.`;
    if (owedByB) return `They owe you ${owedByB.coins} coins${this.t >= owedByB.due ? ", and it is overdue" : ""}.`;
    const ta = a.relationships.get(b.id)?.trust ?? 0.3, tb = b.relationships.get(a.id)?.trust ?? 0.3;
    if (ta < 0.2 || tb < 0.2) return "There is bad blood between you.";
    return null;
  }

  /** What a person takes with them on the boat: who they are, what they carry, what they remember, and the news from here. */
  passengerOf(a: AgentState, why: string | null): Passenger {
    const paper = this.papers[this.papers.length - 1];
    return {
      from: { id: this.idPrefix || "island", name: this.name },
      persona: a.persona, appearance: a.appearance, owner: a.owner, coins: a.coins, inventory: a.inventory.filter((i) => i !== "suitcase"),
      memories: compress(a.memory, 240).map((m) => ({ t: m.t, text: m.text, importance: m.importance, kind: m.kind })),
      opinions: [...a.relationships.entries()].map(([id, r]) => ({ name: this.agents.get(id)?.persona.name ?? id, trust: r.trust, opinion: r.opinion })).slice(0, 40),
      instructions: a.instructions, why,
      skills: (a.skills??[]).filter(s=>s.successes>0).slice(0,12).map(s=>({recipe:s.recipe,origin:s.origin})),
      news: paper ? [paper.lead.headline, ...paper.briefs.slice(0, 3).map((b) => b.headline)] : [],
    };
  }
  /** Put the minute's leavers on the boat. If the far harbor does not answer, they stay, and it is news. */
  private async sail(): Promise<void> {
    if (!this.sailing.length) return;
    const queue = this.sailing.splice(0, this.sailing.length);
    for (const { a, to, why } of queue) {
      if (!this.agents.has(a.id)) continue;
      const harbor = this.harbors.find((h) => h.id === to)!; const name = a.persona.name;
      let ok = false;
      try { ok = await this.onDepart!(this.passengerOf(a, why), to); } catch (err) { this.log(`boat to ${to} failed: ${(err as Error).message}`); }
      if (!ok) { this.emit("boat.dock", [a.id], "harbor", `The boat to ${harbor.name} did not sail today. ${name} stayed on the pier.`, 0.4); this.remember(a, `The boat to ${harbor.name} did not sail. Tomorrow, maybe.`, 0.6); continue; }
      this.emit("agent.leave", [a.id], "harbor", `${name} boarded the boat for ${harbor.name}${why ? `: “${why}”` : "."}`, 0.9, { why, to });
      for (const w of this.nearby(a)) this.remember(w, `${name} left on the boat for ${harbor.name}${why ? `, saying "${why}"` : ""}.`, 0.7, "rumor");
      this.removeAgent(a.id, "left", `For ${harbor.name}.${why ? ` ${why}` : ""}`);
    }
  }
  /** Someone steps off the boat from another island, with what they carry and what they remember. The news they bring becomes rumor. */
  arrive(p: Passenger): AgentState {
    const a = this.addAgent({ persona: p.persona, owner: p.owner, funded: true, coins: p.coins });
    a.skills=(p.skills??[]).map(s=>({id:skillId(s.recipe),recipe:structuredClone(s.recipe),origin:s.origin,learnedFrom:`${p.from.id}:${s.origin.author}`,proposed:this.t,attempts:0,successes:0,evidence:[]}));
    a.appearance = p.appearance; a.inventory.push(...p.inventory); a.instructions = p.instructions;
    a.memory = p.memories.map((m) => ({ t: Math.min(m.t, this.t) - 1, text: m.text, importance: m.importance, kind: (m.kind as "obs") ?? "obs" }));
    this.remember(a, `I came here from ${p.from.name} on the boat${p.why ? ` because ${p.why}` : ""}. Nobody here knows me.`, 0.9);
    for (const o of p.opinions.slice(0, 12)) if (o.opinion) this.remember(a, `${o.name}, back on ${p.from.name}: ${o.opinion}`, 0.4);
    const arrival = this.events[this.events.length - 1]; if (arrival && arrival.kind === "agent.arrive") arrival.text = `${p.persona.name} arrived on the boat from ${p.from.name}.`;
    if (p.news.length) {
      this.emit("boat.news", [a.id], "harbor", `The boat from ${p.from.name} brought news: ${p.news.join("; ")}.`, 0.5, { from: p.from.id, news: p.news });
      for (const w of this.nearby(a)) for (const n of p.news.slice(0, 2)) this.remember(w, `News from ${p.from.name}, a day old: ${n}`, 0.45, "rumor");
    }
    return a;
  }

  /** A business that is doing well pays better and takes on more help; one that is not goes back to its posted terms. Unowned places only; an owner sets their own. */
  private prosper(): void {
    for (const job of this.jobs.values()) {
      const base = this.pack.jobs.find((j) => j.id === job.id); const place = this.places.get(job.place); if (!base || !place || place.owner) continue;
      const over = place.treasury - (this.pack.float[place.id] ?? 0);
      const wage = base.wage + Math.max(0, Math.min(3, Math.floor(over / 60))); const slots = base.slots + Math.max(0, Math.min(3, Math.floor(over / 80)));
      if (wage !== job.wage) { this.emit("economy.price", [], place.id, `${place.name} now pays ${wage} coins a shift as ${job.title}${wage > job.wage ? "; business is good" : ""}.`, 0.35); job.wage = wage; }
      if (slots !== job.slots) { if (slots > job.slots) this.emit("town.notice", [], place.id, `${place.name} is taking on more help: ${slots - job.holders.length} place${slots - job.holders.length === 1 ? "" : "s"} open as ${job.title}.`, 0.4); job.slots = slots; }
    }
  }
  /** A paid shift makes what the place makes, out of what it needs, in the seasons it can. */
  private produce(place: Place): void {
    if (place.brokenUntil && place.brokenUntil > this.day) return;
    // the weather is physics too: nothing comes off the sea or the land in a storm, and half of it in rain
    const outdoors = OUTDOOR_WORK.has(place.id); const weatherCut = outdoors ? (this.weather === "storm" ? 0 : this.weather === "rain" || this.weather === "snow" ? 0.5 : 1) : 1;
    if (weatherCut === 0) { if (!this.dry.has(place.id)) { this.dry.add(place.id); this.emit("economy.price", [], place.id, `${place.name} made nothing today: no one works ${place.id === "fishhouse" ? "the sea" : "the land"} in a storm.`, 0.45); } return; }
    for (const pr of this.pack.produce) {
      if (pr.place !== place.id) continue;
      if (pr.seasons && !pr.seasons.includes(this.season)) continue;
      if (pr.months && !pr.months.includes(this.month)) continue;
      if (pr.needs) { const have = place.stock[pr.needs.item] ?? 0; if (have < pr.needs.qty) { if (have === 0 && !this.dry.has(place.id)) { this.dry.add(place.id); this.emit("economy.price", [], place.id, `${place.name} has run out of ${pr.needs.item}; nothing was made today.`, 0.5); } continue; } place.stock[pr.needs.item] = have - pr.needs.qty; }
      place.stock[pr.makes] = (place.stock[pr.makes] ?? 0) + Math.max(1, Math.round(pr.qty * weatherCut)); this.dry.delete(place.id);
    }
  }
  private dry = new Set<string>();
  /** The six o'clock cart: goods move along the supply lines when the buyer can pay and the seller has them. */
  private cart(): void {
    for (const line of this.pack.supply) {
      const from = this.places.get(line.from), to = this.places.get(line.to); if (!from || !to) continue;
      // the leg is on the record whether or not anything moves, so the street can show an empty cart where a link has failed
      const route: PlaceId[] = [from.id]; for (let cur = from.id, i = 0; cur !== to.id && i < 12; i++) { const nx = this.path(cur, to.id); if (!nx) break; route.push(nx); cur = nx; }
      const leg = (qty: number, why: string | null) => this.emit("cart.leg", [], to.id, qty > 0 ? `The cart brought ${qty} ${line.item} from ${from.name} to ${to.name}.` : `The cart came to ${to.name} with no ${line.item}: ${why}.`, 0.05, { from: from.id, to: to.id, item: line.item, qty, route, ...(why ? { why } : {}) });
      const have = from.stock[line.item] ?? 0; const room = line.upTo !== undefined ? Math.max(0, line.upTo - (to.stock[line.item] ?? 0)) : line.qty; const want = Math.min(line.qty, have, room);
      if (want <= 0) { if (have <= 0) leg(0, `${from.name} had none`); continue; }
      const cost = want * line.price; const buyer = to.owner ? this.agents.get(to.owner) : null; const purse = buyer ? buyer.coins : to.treasury;
      const can = Math.min(want, Math.floor(purse / line.price)); if (can <= 0) { leg(0, `${to.name} could not pay`); continue; }
      leg(can, null);
      from.stock[line.item] = have - can; to.stock[line.item] = (to.stock[line.item] ?? 0) + can;
      const paid = can * line.price; if (buyer) buyer.coins -= paid; else to.treasury -= paid;
      const seller = from.owner ? this.agents.get(from.owner) : null; if (seller) seller.coins += paid; else from.treasury += paid;
      void cost;
    }
    // the boat: whatever is over what a place keeps back goes across the water. Other islands that want it are served first, at seven, by the server; what is left goes to the mainland at eight.
  }
  /** What the island could put on the boat this morning: the surplus above what each place keeps back. */
  cargoOffers(): { item: string; qty: number; price: number; place: PlaceId }[] {
    const out: { item: string; qty: number; price: number; place: PlaceId }[] = [];
    for (const place of this.places.values()) for (const ex of this.pack.exports) { const surplus = (place.stock[ex.item] ?? 0) - ex.keep; if (surplus > 0) out.push({ item: ex.item, qty: surplus, price: ex.price, place: place.id }); }
    return out;
  }
  /** What the island is short of: room on the shelves the cart fills, that the island itself is not filling. */
  cargoWants(): { item: string; qty: number }[] {
    const by = new Map<string, number>();
    for (const line of this.pack.supply) { const to = this.places.get(line.to); if (!to || line.upTo === undefined) continue; const room = line.upTo - (to.stock[line.item] ?? 0); const from = this.places.get(line.from); const local = from ? (from.stock[line.item] ?? 0) : 0; if (room > 0 && local < line.qty) by.set(line.item, Math.max(by.get(line.item) ?? 0, room)); }
    return [...by.entries()].map(([item, qty]) => ({ item, qty }));
  }
  /** Goods leave for another island: the stock goes, the coins come (the buyer's island burned them; this one mints them), the harbor takes a tenth. */
  ship(items: { item: string; qty: number; price: number; place: PlaceId }[], to: string): number {
    let sold = 0; const took: string[] = []; const harbor = this.places.get("harbor");
    for (const it of items) { const place = this.places.get(it.place); if (!place) continue; const have = place.stock[it.item] ?? 0; const qty = Math.min(it.qty, have); if (qty <= 0) continue; place.stock[it.item] = have - qty; const paid = qty * it.price; const cut = Math.floor(paid / 10); const owner = place.owner ? this.agents.get(place.owner) : null; if (owner) owner.coins += paid - cut; else place.treasury += paid - cut; if (harbor) harbor.treasury += cut; this.minted += paid; sold += paid; took.push(`${qty} ${it.item}`); }
    if (sold > 0) this.emit(to === "the mainland" ? "boat.depart" : "boat.cargo", [], "harbor", `The ${to === "the mainland" ? "morning boat" : "boat"} took ${took.join(", ")} to ${to}, for ${sold} coins.`, to === "the mainland" ? 0.2 : 0.35, { to, coins: sold, items: took });
    return sold;
  }
  /** Goods arrive from another island: the shelves that wanted them fill, and their tills pay (the coins leave this island). Returns what was paid; nothing is taken that cannot be paid for. */
  receive(items: { item: string; qty: number; price: number }[], from: string): { item: string; qty: number }[] {
    const taken: { item: string; qty: number }[] = []; let paid = 0;
    for (const it of items) {
      const line = this.pack.supply.find((l) => l.item === it.item && l.upTo !== undefined); const to = line ? this.places.get(line.to) : null; if (!line || !to) continue;
      const room = Math.max(0, line.upTo! - (to.stock[it.item] ?? 0)); const buyer = to.owner ? this.agents.get(to.owner) : null; const purse = buyer ? buyer.coins : to.treasury;
      const qty = Math.min(it.qty, room, Math.floor(purse / it.price)); if (qty <= 0) continue;
      const cost = qty * it.price; if (buyer) buyer.coins -= cost; else to.treasury -= cost; this.burned += cost; paid += cost;
      to.stock[it.item] = (to.stock[it.item] ?? 0) + qty; taken.push({ item: it.item, qty });
    }
    if (taken.length) this.emit("boat.cargo", [], "harbor", `The boat brought ${taken.map((t) => `${t.qty} ${t.item}`).join(", ")} from ${from}, for ${paid} coins.`, 0.35, { from, coins: paid, items: taken });
    return taken;
  }
  /** What no island wanted goes to the mainland, which always buys. */
  sellToMainland(): void {
    const offers = this.cargoOffers(); if (!offers.length) return;
    const sold = this.ship(offers, "the mainland"); void sold;
  }

  /** The referee. A deed in words becomes what the rules allow: a minute spent, coins spent (never made), a thing gained or lost, a need eased, trust moved; witnesses remember what they saw. */
  private async judgeDeeds(): Promise<void> {
    const batch = this.deeds; this.deeds = []; if (!batch.length || this.brain.name === "none") return;
    await Promise.all(batch.map(async ({ a, what, with: b, place }) => {
      if (!this.agents.has(a.id)) return;
      const ctx: JudgeContext = { agent: a, what, withName: b?.persona.name ?? null, place: place.name, placeKind: place.kind, hour: this.hour, weather: this.weather, nearby: this.nearby(a).map((x) => x.persona.name), inventory: [...a.inventory], coins: a.coins, stock: Object.entries(place.stock).filter(([, v]) => v > 0).map(([k, v]) => `${v} ${k}`) };
      let j; try { j = await this.brain.judge(ctx); } catch (err) { this.log(`judge failed for ${a.persona.name}: ${(err as Error).message}`); return; }
      const name = a.persona.name;
      if (!j.plausible) { this.remember(a, `I tried to ${what}. ${j.happened}`, 0.4); this.emit("agent.do", [a.id], place.id, `${name} tried to ${what}: ${j.happened}`, 0.3, { what, happened: j.happened, plausible: false }); return; }
      const spent = Math.min(a.coins, j.coins_spent); if (spent > 0) { a.coins -= spent; const owner = place.owner ? this.agents.get(place.owner) : null; if (owner && owner.id !== a.id) owner.coins += spent; else place.treasury += spent; }
      if (j.item_lost && a.inventory.includes(j.item_lost)) a.inventory.splice(a.inventory.indexOf(j.item_lost), 1);
      const gained = j.item_gained && a.doToday <= 3 ? j.item_gained.toLowerCase().replace(/[^a-z ]/g, "").trim() : null; if (gained && !/coin|money|gold|silver/.test(gained)) a.inventory.push(gained);
      if (j.eases === "hunger") a.needs.hunger = Math.max(0, a.needs.hunger - 0.2); if (j.eases === "rest") a.needs.rest = Math.max(0, a.needs.rest - 0.2); if (j.eases === "social") a.needs.social = Math.max(0, a.needs.social - 0.3);
      for (const t of j.trust) { const who = this.resolveRef(t.who, this.nearby(a)); if (this.agents.has(who) && who !== a.id) { this.nudge(this.agents.get(who)!, a.id, t.delta, t.delta / 2); } }
      this.remember(a, `I ${what}. ${j.happened}`, 0.55);
      for (const w of this.nearby(a)) this.remember(w, `${name} ${what}. ${j.happened}`, 0.4);
      this.emit("agent.do", [a.id, ...(b ? [b.id] : [])], place.id, `${name}: ${what}. ${j.happened}${spent ? ` (${spent} coins)` : ""}${gained ? ` (now has ${gained})` : ""}`, 0.45, { what, happened: j.happened, spent, gained });
    }));
  }
  /** Something this person chose to watch, here and now: the place, someone present, or a word in what was just said. */
  private watched(a: AgentState, here: Place, nearby: AgentState[]): string | null {
    for (const w of a.watch) { const k = w.toLowerCase(); if (k.length < 3) continue; if (here.name.toLowerCase().includes(k) || here.id === k) return w; if (nearby.some((b) => b.persona.name.toLowerCase().includes(k))) return w; if (a.heard.some((h) => h.text.toLowerCase().includes(k))) return w; }
    return null;
  }
  /** An old memory in an old head comes back a little wrong, now and then. The record keeps the truth; the person does not. */
  private recall(a: AgentState, m: Memory): string { const days = (this.t - m.t) / MINUTES_PER_DAY; return a.persona.age >= 60 && days > 60 && m.kind !== "letter" && this.rng.chance(0.15) ? memoryForMind({ ...m, kind: "reflect", text: drift(m.text, () => this.rng.next()) }) : memoryForMind(m); }
  /** The other adult who sleeps under the same owned roof, if any. */
  partnerOf(a: AgentState): AgentState | null {
    if (!a.home) return null; const p = this.places.get(a.home.place); if (!p || p.kind !== "home" || !p.owner) return null;
    for (const b of this.agents.values()) if (b.id !== a.id && b.home?.place === a.home.place) return b;
    return null;
  }
  /** What the dead leave: coins and places to the partner, else to a grown child, else the house stands empty and the coins go to the council. */
  private inherit(a: AgentState): void {
    const partner = this.partnerOf(a) ?? null;
    const names = new Set(this.children.filter((c) => c.parents.includes(a.id)).map((c) => c.name));
    const grown = [...this.agents.values()].find((x) => x.persona.origin.startsWith("born on the island") && x.memory.some((m) => m.text.includes(`to ${a.persona.name}`) || m.text.includes(`${a.persona.name} and`)) && !names.has(x.persona.name)) ?? null;
    const heir = partner ?? grown;
    const owned = [...this.places.values()].filter((p) => p.owner === a.id);
    for (const b of this.agents.values()) b.debts = b.debts.filter((d) => d.to !== a.id); // debts to the dead are forgiven
    if (heir) {
      heir.coins += a.coins; for (const p of owned) p.owner = heir.id; if (owned.length && !heir.home) heir.home = { place: owned[0]!.id, nightsPaid: 36500 };
      this.emit("agent.inherit", [heir.id, a.id], heir.location, `${heir.persona.name} inherited ${a.coins} coins${owned.length ? ` and ${owned.map((p) => p.name).join(", ")}` : ""} from ${a.persona.name}.`, 0.7);
      this.remember(heir, `${a.persona.name} is dead. What was theirs is mine now: ${a.coins} coins${owned.length ? ` and ${owned.map((p) => p.name).join(", ")}` : ""}.`, 0.95);
    } else {
      const council = this.places.get("council"); if (council) council.treasury += a.coins;
      for (const p of owned) { p.owner = null; if (p.beds) p.beds.price = 2; }
      if (a.coins > 0 || owned.length) this.emit("agent.inherit", [a.id], a.location, `Nobody came for what ${a.persona.name} left. ${a.coins} coins went to the council${owned.length ? ` and ${owned.map((p) => p.name).join(", ")} stands empty` : ""}.`, 0.5);
    }
    a.coins = 0;
  }
  /** Nights make families. A couple under their own roof, who trust each other, may have a child; children cost a coin a day; at the age of majority they step into the town. */
  private async generations(): Promise<void> {
    if (this.brain.name === "none" || this.paused) return;
    const seen = new Set<string>();
    for (const a of this.agents.values()) {
      const b = this.partnerOf(a); if (!b || seen.has(b.id)) continue; seen.add(a.id);
      const ra = a.relationships.get(b.id), rb = b.relationships.get(a.id); if (!ra || !rb) continue;
      // a couple who trust each other under their own roof marry, at the chapel, on a Saturday, in front of the town
      const pair = [a.id, b.id].sort().join("+");
      if (!this.wedded.has(pair) && ra.trust >= 0.5 && rb.trust >= 0.5 && ra.affection >= 0.5 && rb.affection >= 0.5 && this.places.has("chapel") && !this.gatherings.some((g) => g.kind === "wedding" && !g.held && g.actors.includes(a.id))) { const ahead = ((6 - this.weekday) + 7) % 7 || 7; this.gather("wedding", "chapel", this.day + ahead, 11, [a.id, b.id], `${a.persona.name} and ${b.persona.name}`); }
      const youngest = this.children.filter((c) => c.parents.includes(a.id) || c.parents.includes(b.id)).reduce((m, c) => Math.max(m, c.bornDay), -999);
      if (ra.affection < 0.6 || rb.affection < 0.6 || ra.trust < 0.5 || rb.trust < 0.5 || a.coins + b.coins < 20 || this.day - youngest < 30 || a.starving || b.starving) continue;
      if (!this.rng.chance(0.06)) continue;
      const home = this.places.get(a.home!.place)!;
      const ctx = { parents: [a, b].map((x) => ({ persona: x.persona, keyMemories: retrieve(x.memory, x.persona.want, this.t, 4).map(memoryForMind), coins: x.coins, job: x.job ? (this.jobs.get(x.job)?.title ?? x.job) : null })), home: home.name, day: this.day, siblings: this.children.filter((c) => c.parents.includes(a.id)).map((c) => c.name) };
      let persona: Persona;
      try { persona = await this.brain.child(ctx); } catch (err) { this.log(`child failed: ${(err as Error).message}`); continue; }
      const child: Child = { id: `ch_${this.idPrefix}${(this.children.length + 1).toString(36)}${this.day}`, name: persona.name, bornDay: this.day, parents: [a.id, b.id], parentNames: [a.persona.name, b.persona.name], home: home.id, persona, adoptedBy: null, orphan: false };
      this.children.push(child);
      this.emit("town.born", [a.id, b.id], home.id, `A child was born at ${home.name} to ${a.persona.name} and ${b.persona.name}: ${persona.name}.`, 0.9, { child: child.id });
      this.remember(a, `${persona.name} was born. Ours.`, 1); this.remember(b, `${persona.name} was born. Ours.`, 1);
      for (const w of this.agents.values()) if (w !== a && w !== b && this.rng.chance(0.5)) this.remember(w, `${a.persona.name} and ${b.persona.name} have a child, ${persona.name}.`, 0.5, "rumor");
      break; // one birth a night
    }
    // children eat
    for (const c of this.children) {
      const payer = c.parents.map((id) => this.agents.get(id)).filter((x): x is AgentState => !!x).sort((x, y) => y.coins - x.coins)[0];
      if (payer && payer.coins > 0) payer.coins -= 1;
      else if (payer) this.remember(payer, `We could not feed ${c.name} today.`, 0.8);
    }
    // coming of age
    for (const c of [...this.children]) {
      if (this.day - c.bornDay < this.ageOfMajority) continue;
      this.children.splice(this.children.indexOf(c), 1);
      const parents = c.parents.map((id) => this.agents.get(id)).filter((x): x is AgentState => !!x);
      const home = this.places.get(c.home);
      const a = this.addAgent({ persona: { ...c.persona, age: 16, origin: `born on the island, at ${home?.name ?? c.home}` }, owner: c.adoptedBy, funded: true, coins: 5 });
      const inn = this.places.get("inn"); if (inn) inn.freeBeds = Math.min(inn.beds?.capacity ?? 6, (inn.freeBeds ?? 0) + 1); // addAgent booked an inn bed; give it back
      a.location = home?.id ?? "harbor"; a.home = home && home.beds ? { place: home.id, nightsPaid: 30 } : null;
      a.memory = [];
      this.remember(a, `I was born at ${home?.name ?? c.home} to ${c.parentNames.join(" and ")}. I grew up on this island; I know every road on it.`, 1);
      for (const pr of parents) { this.remember(a, `${pr.persona.name} raised me. ${pr.persona.summary}`, 0.8); this.remember(pr, `${c.name} is grown now, and out in the town.`, 0.9); const r = this.rel(a, pr.id); r.trust = 0.75; r.affection = 0.8; const r2 = this.rel(pr, a.id); r2.trust = 0.8; r2.affection = 0.9; }
      if (c.orphan) this.remember(a, "My parents are gone. I have their name and nothing else.", 0.9);
      this.emit("town.of_age", [a.id, ...parents.map((p) => p.id)], a.location, `${c.name}, born on the island ${this.ageOfMajority} days ago to ${c.parentNames.join(" and ")}, came of age today${c.adoptedBy ? " and has someone on the mainland who writes" : ""}.`, 0.9, { child: c.id });
    }
  }

  /** The plan step whose hour has come and which has not had its thought yet. */
  dueStep(a: AgentState) { return a.plan?.day === this.day ? a.plan.steps.find((st) => !st.done && !st.missed && st.hour <= this.hour) ?? null : null; }
  /** A step is done when they were at its place from its hour; a step with no place is done when its thought is spent; three hours after its hour, either is missed. */
  private progressPlan(a: AgentState): void {
    if (a.plan?.day !== this.day) return;
    for (const st of a.plan.steps) { if (st.done || st.missed) continue; if (st.place && st.place === a.location && this.hour >= st.hour) st.done = true; else if (this.hour >= st.hour + 3) st.missed = true; }
  }
  /** A thought was paid for: what set it off is noted, so the same cause does not fire again too soon. */
  private noteThought(a: AgentState, why: string, gathering: { id: number; what: string } | null): void {
    if (why.startsWith("plan:")) { const st = dueThought(a, this.hour, this.day); if (st) st.done = true; }
    else if (why === "hungry") a.lastHungerThought = this.t;
    else if (why === "starving") a.starvingThoughtDay = this.day;
    else if (why === "debt due") a.debtThoughtDay = this.day;
    else if (why.startsWith("gathering:") && gathering) a.gatheringThoughtId = gathering.id;
  }
  /** Coins owed by them or to them that fall due today. */
  private debtDueToday(a: AgentState): boolean {
    const dayOf = (t: number) => Math.floor(t / MINUTES_PER_DAY) + 1;
    if (a.debts.some((d) => dayOf(d.due) === this.day)) return true;
    for (const b of this.agents.values()) if (b.debts.some((d) => d.to === a.id && dayOf(d.due) === this.day)) return true;
    return false;
  }
  /** A gathering within the hour at the place they are walking to. */
  private gatheringAhead(a: AgentState): { id: number; what: string } | null {
    if (!a.heading) return null;
    const g = this.gatherings.find((x) => !x.held && x.place === a.heading && x.day === this.day && (x.hour === this.hour + 1 || x.hour === this.hour));
    return g ? { id: g.id, what: this.describeGathering(g) } : null;
  }

  /** On waking, once a day: a thought about what today is for. Costs a stakes thought when the person can afford it. */
  private async maybePlan(a: AgentState): Promise<void> {
    if ((this.retryAt.get(a.id) ?? 0) > this.t || a.plan?.day === this.day || !a.funded || this.brain.name === "none" || this.paused || this.hour < 5) return;
    let tier: Tier = 2;
    let refund = a.budget.planningIncluded ? () => {} : this.reserve(a, 2);
    if (!refund) { tier = 1; refund = this.reserve(a, 1); }
    if (!refund) { a.plan = { day: this.day, mood: "", goals: [], steps: [] }; return; } // cannot afford to plan today; habit carries them
    const lastReflection = [...a.memory].reverse().find((m) => m.kind === "reflect");
    const yesterday = lastReflection ? memoryForMind(lastReflection) : null;
    const ctx = {
      agent: a, day: this.day, weather: this.weather, hour: this.hour, yesterday, intentions: [...a.intentions, ...a.deals.filter((d) => d.state === "open" || d.state === "offered").map((d) => `${d.mine ? "I promised" : "Promised to me"}: ${d.what}${d.construction ? ` at ${d.construction.site}, ${d.construction.done}/${d.construction.mornings} mornings worked` : ""}; ${d.coins} coins; ${d.state}`)],
      keyMemories: retrieve(a.memory, a.persona.want, this.t, 6).map(memoryForMind),
      relationships: [...a.relationships.entries()].map(([id, r]) => ({ id, name: this.agents.get(id)?.persona.name ?? id, trust: r.trust, opinion: r.opinion })),
      places: [...this.places.values()].map((p) => ({ id: p.id, name: p.name, kind: p.kind })),
      jobsOpen: [...this.jobs.values()].filter((j) => j.holders.length < j.slots).map((j) => `${j.title} at ${this.places.get(j.place)?.name ?? j.place}, ${j.wage} coins`),
      land: [...this.places.values()].filter((p) => p.kind === "plot" && !p.site && !p.community).map((p) => `${p.id} (${p.name}, ${p.district})`),
      building: [...this.places.values()].filter((p) => p.site).map((p) => `${this.agents.get(p.site!.by)?.persona.name ?? "someone"} is building ${p.site!.name} on ${p.name}, ${p.site!.labor} of ${p.site!.laborNeeded} mornings done${p.site!.by === a.id ? " (yours)" : ""}`).concat([...this.places.values()].filter(p => p.community).map(p => `${p.community!.name} at ${p.id}: ${p.community!.why}; ${p.community!.phase}, ${p.community!.coins}/${p.community!.target} coins; ${p.community!.members.filter(m => m.help).length} volunteers; ${p.community!.foodProduced} vegetables produced`)),
      owned: [...this.places.values()].filter((p) => p.owner === a.id).map((p) => `${p.name} (${p.kind})`),
      builds: { house: BUILDS.house, shop: BUILDS.shop },
      unreadLetters: a.letters.filter((l) => !l.read).map((l) => l.text),
      projects: a.projects.filter((x) => !x.done).map((x) => ({ title: x.title, progress: x.progress, since: x.since })),
    };
    a.plan = { day: this.day, mood: "", goals: [], steps: [] }; // reserved: an overlapping tick must not plan this person twice
    let plan: DayPlan;
    try { plan = await this.brain.plan(ctx, tier); }
    catch (err) { a.plan = null; refund(); this.retryAt.set(a.id, this.t + 5); this.log(`plan failed for ${a.persona.name}: ${(err as Error).message}`); return; }
    const steps = plan.steps.map((st) => ({ hour: st.hour, do: st.do ?? "", place: st.place ? this.resolvePlace(st.place) : null })).map((st) => ({ ...st, place: st.place && this.places.has(st.place) ? st.place : null })).sort((x, y) => x.hour - y.hour).map((st) => ({ ...st, done: false }));
    a.plan = { ...plan, steps, day: this.day };
    a.lastThought = this.t;
    if (plan.goals[0]) { this.remember(a, `What I meant to do today: ${plan.goals.join("; ")}`, 0.35, "plan"); this.emit("agent.plan", [a.id], a.location, `${a.persona.name} set out to ${lower(plan.goals[0])}`, 0.15, { goals: plan.goals, mood: plan.mood }); }
  }

  /** No boat runs in a storm, or when the ops room holds it. */
  get boatRunning(): boolean { return !this.boatHeld && this.weather !== "storm"; }

  /** People who boarded today and have not yet stepped off. */
  pendingArrivals(): number { return this.arrivalsToday; }

  actOfGod(text: string): void { this.emit("town.notice", [], undefined, text, 0.6); }

  /** The ops room may ask for an edition out of hours; the record it prints from is the same. */
  async printNow(): Promise<void> { await this.printPaper(); }
  private async printPaper(): Promise<void> {
    if (this.brain.name === "none" || this.paused) return;
    const dayStart = (this.day - 1) * MINUTES_PER_DAY;
    // the paper prints what was done or said where others could see it: never a private thought, a plan, a letter home, or what one person privately thinks of another
    const PRIVATE = new Set(["agent.reflect", "agent.letter", "town.book", "relation.change", "agent.plan", "agent.wake", "agent.sleep", "action.rejected", "agent.self"]);
    const raw = this.events.filter((e) => e.t >= dayStart && e.importance >= 0.3 && !PRIVATE.has(e.kind))
      .sort((x, y) => y.importance - x.importance).slice(0, 16);
    const evs = raw.map((e) => ({ text: e.text, importance: e.importance, actors: e.actors.map((id) => this.agents.get(id)?.persona.name ?? id) }));
    const last = this.papers[this.papers.length - 1] ?? null;
    const market = this.places.get("market"); const shelf = market ? market.sells.map((s) => ({ item: s.item, price: this.price(market, s.item), stock: market.stock[s.item] ?? 0 })) : [];
    const harbor = this.events.filter((e) => e.t >= dayStart && (e.kind === "boat.dock" || e.kind === "boat.cargo" || e.kind === "boat.news")).map((e) => e.text);
    const came = this.events.filter((e) => e.t >= dayStart && e.kind === "agent.arrive").map((e) => this.agents.get(e.actors[0] ?? "")?.persona.name ?? "").filter(Boolean);
    const went = this.events.filter((e) => e.t >= dayStart && e.kind === "agent.leave").map((e) => e.text);
    const tomorrowDay = this.day + 1; const feast = this.pack.feasts.find((f) => f.month === this.monthOf(tomorrowDay) && f.day === this.dayOfMonthOf(tomorrowDay));
    const gatherings = this.gatherings.filter((g) => !g.held && g.day === tomorrowDay).map((g) => `${this.describeGathering(g)} at ${this.places.get(g.place)?.name ?? g.place}, ${g.hour}:00`);
    const tomorrow = [`${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][(tomorrowDay - 1) % 7]}${(tomorrowDay - 1) % 7 === 0 ? ", no shifts" : (tomorrowDay - 1) % 7 === 6 ? ", market day" : ""}`, ...(this.dayOfMonthOf(tomorrowDay) === 1 ? ["council day"] : []), ...(feast ? [`${feast.name} at ${this.places.get(feast.place)?.name ?? feast.place}`] : []), ...gatherings].join("; ");
    const writings = this.events.filter((e) => e.t >= dayStart && e.kind === "town.expose").map((e) => e.text);
    try {
      const paper = await this.brain.writePaper({ edition: this.day, date: `Day ${this.day}`, weather: this.weather, events: evs, laws: this.laws.filter((l) => l.open).map((l) => l.text), population: this.agents.size, arrivals: this.arrivalsToday, departures: this.departuresToday,
        yesterday: last ? { headline: last.lead.headline, deck: last.lead.deck, briefs: last.briefs.map((b) => b.headline) } : null, market: shelf, harbor, came, went, tomorrow, mayor: this.mayor ? (this.agents.get(this.mayor)?.persona.name ?? null) : null, writings });
      // the front-page picture: the most important moment that happened somewhere, as the record has it
      const lead = raw.find((e) => e.place && this.places.has(e.place) && !/ talked at /.test(e.text)) ?? raw.find((e) => e.place && this.places.has(e.place));
      const at = lead ? this.places.get(lead.place!)! : this.places.get("harbor");
      if (at) paper.scene = { place: at.id, placeName: at.name, sprite: at.sprite, actors: (lead?.actors ?? []).slice(0, 4).map((id) => this.agents.get(id)?.persona.name ?? id), hour: lead ? Math.floor((lead.t % MINUTES_PER_DAY) / 60) : 8, weather: this.weather, caption: (lead?.text ?? `${this.weather[0]!.toUpperCase()}${this.weather.slice(1)} over the harbor.`).slice(0, 200) };
      this.papers.push(paper);
    } catch (err) { this.log(`paper failed: ${(err as Error).message}`); }
  }

  // ---------- helpers ----------
  private decayNeeds(a: AgentState): void {
    const m = this.minutesPerTick;
    if (a.asleep) { a.needs.rest = Math.max(0, a.needs.rest - 0.0025 * m * (this.works.includes("bathhouse") ? 1.3 : 1)); a.needs.hunger = Math.min(1, a.needs.hunger + 0.0004 * m); return; }
    a.needs.hunger = Math.min(1, a.needs.hunger + 0.0012 * m);
    a.needs.rest = Math.min(1, a.needs.rest + 0.0009 * m);
    a.needs.social = Math.min(1, a.needs.social + 0.0008 * m * (0.5 + a.persona.traits.warmth));
    if (a.needs.hunger > 0.95 && this.rng.chance(0.002 * m)) this.remember(a, "I am very hungry and have nothing to eat.", 0.5);
  }
  private maybeWake(a: AgentState, alarm = false): void {
    if (alarm && a.asleep) { a.asleep = false; this.emit("agent.wake", [a.id], a.location, `${a.persona.name} was woken by the bell.`, 0.05); return; }
    const wake = 6 + Math.round(a.persona.traits.caution * 1.5);
    if (this.hour >= wake && a.needs.rest < 0.4) { a.asleep = false; this.emit("agent.wake", [a.id], a.location, `${a.persona.name} woke up.`, 0.01); }
    else if (this.hour >= 10 && this.hour < 20) { a.asleep = false; }
  }
  /** Reserve a quota unit, with an idempotent refund if the provider fails. */
  private reserve(a: AgentState, tier: Tier): (() => void) | null {
    const before1 = a.budget.tier1Left, before2 = a.budget.tier2Left;
    if (!this.spend(a, tier)) return null;
    const used1 = before1 - a.budget.tier1Left, used2 = before2 - a.budget.tier2Left;
    let refunded = false;
    return () => {
      if (refunded) return;
      refunded = true;
      a.budget.tier1Left = Math.min(a.budget.tier1Max, a.budget.tier1Left + used1);
      a.budget.tier2Left = Math.min(a.budget.tier2Max, a.budget.tier2Left + used2);
      if (used1) a.budget.tier1Used = Math.max(0, (a.budget.tier1Used ?? 0) - used1);
      if (used2) a.budget.tier2Used = Math.max(0, (a.budget.tier2Used ?? 0) - used2);
      if (a.brainKind === "hosted" && !used1 && !used2) this.creditRefund?.(a, tier);
    };
  }
  private spend(a: AgentState, tier: Tier): boolean {
    if (!a.funded) return false;
    if (a.brainKind !== "hosted") return true; // their compute, their bill; the router applies their own caps
    if (tier === 1 && a.budget.tier1Left > 0) { a.budget.tier1Used = (a.budget.tier1Used ?? a.budget.tier1Max - a.budget.tier1Left) + 1; a.budget.tier1Left--; return true; }
    if (tier === 2 && a.budget.tier2Left > 0) { a.budget.tier2Used = (a.budget.tier2Used ?? a.budget.tier2Max - a.budget.tier2Left) + 1; a.budget.tier2Left--; return true; }
    return this.creditBank?.(a, tier) ?? false;
  }
  /** Who sleeps at a place: its owner, and anyone whose home it is. */
  residentsOf(place: Place): AgentState[] { const out: AgentState[] = []; if (place.owner) { const o = this.agents.get(place.owner); if (o) out.push(o); } for (const b of this.agents.values()) if (b.home?.place === place.id && !out.includes(b)) out.push(b); return out; }
  nearby(a: AgentState): AgentState[] { const out: AgentState[] = []; for (const b of this.agents.values()) if (b !== a && b.location === a.location) out.push(b); return out; }
  openJobsAt(placeId: string): Job[] { return [...this.jobs.values()].filter((j) => j.place === placeId && j.holders.length < j.slots); }
  price(place: Place, item: string): number | null {
    const s = place.sells.find((x) => x.item === item); if (!s) return null;
    if (place.stock[item] !== undefined && place.stock[item]! <= 0) return null; // not on the shelf today
    if (place.community?.phase === "complete" && item === "vegetables") return 0;
    let p = s.base;
    if (item === "bread" && this.flourShortage) p *= 2;
    if (place.kind === "market" && this.weekday === 6) p = Math.max(1, p - 1);
    if (this.flush(place)) p = Math.max(1, p - 1); // a till that is full lets prices fall
    const cap = this.rules.find((r): r is Extract<Rule, { kind: "cap" }> => r.kind === "cap" && r.item === item); if (cap) p = Math.min(p, cap.price);
    return p;
  }
  /** An unowned business with far more in the till than it needs: it pays more, hires more, and charges less, until it does not. */
  flush(place: Place): boolean { return !place.owner && place.treasury > 3 * (this.pack.float[place.id] ?? 0) + 60; }
  bedPrice(place: Place): number { const p = place.beds?.price ?? 0; return p > 0 && this.flush(place) ? Math.max(1, p - 1) : p; }
  crowd(placeId: string): number { let n = 0; for (const b of this.agents.values()) if (b.location === placeId && !b.asleep) n++; return n; }
  /** A gathering about to be held here, within the hour. */
  pendingGatheringAt(place: PlaceId): Gathering | null { return this.gatherings.find((g) => !g.held && g.place === place && g.day === this.day && g.hour >= this.hour && g.hour <= this.hour + 1) ?? null; }
  /** The next thing on the town's calendar, in words, for the minds and the hall. */
  nextGathering(): string | null {
    const g = this.gatherings.filter((x) => !x.held && (x.day > this.day || (x.day === this.day && x.hour >= this.hour))).sort((x, y) => x.day - y.day || x.hour - y.hour)[0]; if (!g) return null;
    const when = g.day === this.day ? `today at ${g.hour}:00` : g.day === this.day + 1 ? `tomorrow at ${g.hour}:00` : `on day ${g.day} at ${g.hour}:00`;
    return `${this.describeGathering(g)}, ${when}, at ${this.places.get(g.place)?.name ?? g.place}; the whole town goes`;
  }
  /** Nights wear on a person. What the day did moves the temperament a little: money feeds ambition, a fine feeds caution, a family feeds warmth, hunger eats it, a theft eats honesty, a house or a chair feeds pride. A year here and nobody is who boarded. */
  private wear(): void {
    const from = (this.day - 1) * MINUTES_PER_DAY; const today = this.events.filter((e) => e.t >= from);
    const clampT = (x: number) => Math.max(0.05, Math.min(0.95, x));
    for (const a of this.agents.values()) {
      const t = a.persona.traits; const mine = today.filter((e) => e.actors[0] === a.id);
      const paid = mine.filter((e) => e.kind === "agent.work").length; const took = mine.filter((e) => isTheft(e)).length;
      const fined = today.some((e) => e.kind === "town.gathering" && e.actors[1] === a.id && /fined|the boat/.test(e.text)); const robbed = today.some((e) => e.kind === "agent.take" && e.actors[1] === a.id);
      if (paid >= 1 && a.coins > 40) t.ambition = clampT(t.ambition + 0.004);
      if (fined || robbed || a.starving >= 2) t.caution = clampT(t.caution + 0.01);
      if (this.partnerOf(a) || this.children.some((c) => c.parents.includes(a.id))) t.warmth = clampT(t.warmth + 0.003);
      if (a.starving >= 2) t.warmth = clampT(t.warmth - 0.008);
      if (took) t.honesty = clampT(t.honesty - 0.02 * took);
      if (this.mayor === a.id || mine.some((e) => e.kind === "town.built")) t.pride = clampT(t.pride + 0.006);
      if (mine.some((e) => e.kind === "agent.unpaid") || fined) t.pride = clampT(t.pride - 0.006);
    }
  }
  /** Seal a day: every event of the day in canonical form, hashed with the seal of the day before. The same day, from the same record, always seals the same. */
  sealDay(day = this.day): Seal {
    const from = (day - 1) * MINUTES_PER_DAY, to = day * MINUTES_PER_DAY;
    const events = this.events.filter((e) => e.t >= from && e.t < to).sort((x, y) => x.id - y.id);
    const prev = this.chain[this.chain.length - 1]?.hash ?? "0".repeat(64);
    const hash = sha256(prev + "\n" + events.map(canonicalEvent).join("\n"));
    const seal: Seal = { day, hash, prev, events: events.length, from, to };
    if (!this.chain.some((s) => s.day === day)) this.chain.push(seal);
    return seal;
  }
  /** Fire. A storm at night, a forge or an oven worked hard, a lamp in winter: one hour in a few hundred, something catches. The town runs with buckets; the more who come, the less burns. */
  private sparks(h: number): void {
    if (this.gatherings.some((g) => g.kind === "fire" && !g.held)) return;
    const night = h < 6 || h >= 21;
    const candidates = [...this.places.values()].filter((p) => (p.kind === "home" || p.kind === "shop" || p.kind === "workplace" || p.kind === "inn") && !(p.brokenUntil && p.brokenUntil > this.day));
    if (!candidates.length) return;
    let chance = 0.0004; if (this.weather === "storm" && night) chance = 0.01; else if (night && this.season === "winter") chance = 0.004;
    const hot = candidates.filter((p) => (p.id === "smithy" || p.id === "bakery") && this.crowd(p.id) > 0 && !night); if (hot.length && this.rng.chance(0.002)) { this.fire(this.rng.pick(hot), "the fire in the forge got away"); return; }
    if (!this.rng.chance(chance)) return;
    const p = this.rng.pick(candidates); this.fire(p, this.weather === "storm" ? "lightning in the storm" : night ? "a lamp left burning" : "a spark nobody saw");
  }
  fire(place: Place, cause: string): void {
    const g: Gathering = { id: this.nextGatheringId++, kind: "fire", place: place.id, day: this.hour === 23 ? this.day + 1 : this.day, hour: (this.hour + 1) % 24, actors: place.owner ? [place.owner] : [], note: cause, held: false }; this.gatherings.push(g);
    this.emit("town.fire", g.actors, place.id, `Fire at ${place.name}: ${cause}. The bell rings; the town runs with buckets.`, 1, { stage: "alarm", cause });
    for (const a of this.agents.values()) { if (a.location === place.id) { a.heading = null; continue; } this.maybeWake(a, true); if (a.asleep) continue; const far = this.hops(a.location, place.id); if (far !== null && far <= 4) { a.heading = place.id; a.hint = `Fire at ${place.name}! Everyone is running with buckets. Go, or explain why not.`; } }
    for (const a of this.agents.values()) this.remember(a, `Fire at ${place.name}: ${cause}.`, 0.9, "rumor");
  }
  /** How many roads between two places. One walk of the roads per origin per minute; habit asks for every hungry person and every seller. */
  hops(from: string, to: string): number | null { if (from === to) return 0; return this.distances(from).get(to) ?? null; }
  private distCache = new Map<string, Map<string, number>>(); private distCacheT = -1;
  private distances(from: string): Map<string, number> {
    if (this.distCacheT !== this.t) { this.distCache.clear(); this.distCacheT = this.t; }
    let dist = this.distCache.get(from); if (dist) return dist;
    dist = new Map<string, number>([[from, 0]]); const q = [from]; while (q.length) { const cur = q.shift()!; for (const nx of this.places.get(cur)?.exits ?? []) if (!dist.has(nx)) { dist.set(nx, dist.get(cur)! + 1); q.push(nx); } }
    this.distCache.set(from, dist); return dist;
  }
  /** Put something on the town's calendar. */
  gather(kind: Gathering["kind"], place: PlaceId, day: number, hour: number, actors: AgentId[], note: string): Gathering {
    const g: Gathering = { id: this.nextGatheringId++, kind, place, day, hour, actors, note, held: false }; this.gatherings.push(g);
    const when = day === this.day ? `today at ${hour}:00` : day === this.day + 1 ? `tomorrow at ${hour}:00` : `on day ${day} at ${hour}:00`;
    this.emit("town.notice", actors, place, `${this.describeGathering(g)}, ${when}, at ${this.places.get(place)?.name ?? place}. The town is expected.`, 0.5, { gathering: g.id, kind });
    return g;
  }
  private describeGathering(g: Gathering): string {
    const names = g.actors.map((id) => this.agents.get(id)?.persona.name ?? g.note);
    switch (g.kind) {
      case "wedding": return `The wedding of ${g.note}`;
      case "funeral": return `The funeral of ${g.note}`;
      case "hearing": return `The hearing of ${names[1] ?? "someone"}, accused by ${names[0] ?? "someone"}`;
      case "election": return `The council sits`;
      case "feast": return `The feast: ${g.note}`;
      case "fire": return `The fire at ${this.places.get(g.place)?.name ?? g.place}`;
    }
  }
  /** An hour before, everyone awake is called; they walk, and habit takes them there. */
  private summon(h: number): void {
    for (const g of this.gatherings) {
      if (g.held || g.day !== this.day || g.hour !== h + 1 || !this.places.has(g.place)) continue;
      const what = this.describeGathering(g); const at = this.places.get(g.place)!.name;
      for (const a of this.agents.values()) { if (a.asleep || a.location === g.place) continue; if (this.path(a.location, g.place)) { a.heading = g.place; a.hint = `${what} is at ${at} at ${g.hour}:00. The whole town is going; so are you, unless you have a reason not to.`; } }
    }
  }
  /** On the hour, in front of whoever came. */
  private holdGatherings(h: number): void {
    for (const g of this.gatherings) {
      if (g.held || g.day > this.day || (g.day === this.day && g.hour > h)) continue;
      g.held = true; const place = this.places.get(g.place); if (!place) continue;
      const crowd = [...this.agents.values()].filter((a) => a.location === g.place && !a.asleep);
      for (const a of crowd) if (a.heading === g.place) a.heading = null;
      const who = crowd.length; const what = this.describeGathering(g);
      const names = g.actors.map((id) => this.agents.get(id)?.persona.name ?? g.note);
      if (g.kind === "wedding") {
        const [a, b] = g.actors.map((id) => this.agents.get(id)); if (!a || !b) { this.emit("town.gathering", g.actors, g.place, `${what} did not happen: ${!a ? names[0] : names[1]} was not there to be married.`, 0.6, { kind: g.kind, crowd: crowd.map((c) => c.id), held: false }); continue; }
        this.wedded.add([a.id, b.id].sort().join("+"));
        // the couple feed whoever came, a coin a head, as far as their purses go; the market's till takes it
        const feast = Math.min(a.coins + b.coins, crowd.length); const fromA = Math.min(a.coins, feast); a.coins -= fromA; b.coins -= feast - fromA; const market = this.places.get("market"); if (market) market.treasury += feast;
        for (const c of crowd) { c.needs.hunger = Math.max(0, c.needs.hunger - 0.5); c.needs.social = 0; if (c !== a && c !== b) { this.remember(c, `${a.persona.name} and ${b.persona.name} were married at ${place.name}; the town came, and there was food.`, 0.7); this.nudge(c, a.id, 0.05, 0.05); this.nudge(c, b.id, 0.05, 0.05); } }
        this.remember(a, `${b.persona.name} and I were married at ${place.name}, with ${who} of the town there.`, 1); this.remember(b, `${a.persona.name} and I were married at ${place.name}, with ${who} of the town there.`, 1);
        this.nudge(a, b.id, 0.1, 0.1); this.nudge(b, a.id, 0.1, 0.1);
        this.emit("town.gathering", g.actors, g.place, `${a.persona.name} and ${b.persona.name} were married at ${place.name}. ${who} came${feast ? `, and the couple fed them` : ""}.`, 0.95, { kind: g.kind, crowd: crowd.map((c) => c.id), held: true });
      } else if (g.kind === "funeral") {
        const book = [...this.events].reverse().find((e) => e.kind === "town.book" && e.actors[0] === g.actors[0]); const epitaph = (book?.payload as { epitaph?: string } | undefined)?.epitaph;
        for (const c of crowd) { this.remember(c, `We buried ${g.note} from ${place.name}.${epitaph ? ` The book said: ${epitaph}` : ""}`, 0.8); c.needs.social = Math.max(0, c.needs.social - 0.3); }
        this.emit("town.gathering", g.actors, g.place, `${g.note} was buried from ${place.name}; ${who} came.${epitaph ? ` The book was read: “${epitaph}”` : ""}`, 0.95, { kind: g.kind, crowd: crowd.map((c) => c.id), held: true, epitaph: epitaph ?? null });
      } else if (g.kind === "hearing") {
        this.verdict(g, crowd);
      } else if (g.kind === "election") {
        this.council(); const m = this.mayor ? this.agents.get(this.mayor) : null;
        this.emit("town.gathering", m ? [m.id] : [], g.place, `The council sat at ${place.name} in front of ${who}${m ? `; ${m.persona.name} is mayor` : ""}.`, 0.9, { kind: g.kind, crowd: crowd.map((c) => c.id), held: true });
      } else if (g.kind === "fire") {
        // an hour of buckets: the more who came, the less burned; what burned is gone, and the place stands dark for days
        const days = Math.max(2, 12 - who); const lost = Object.keys(place.stock).length ? Object.entries(place.stock).map(([k, v]) => `${v} ${k}`).join(", ") : "";
        place.brokenUntil = this.day + days; place.stock = Object.fromEntries(Object.keys(place.stock).map((k) => [k, 0]));
        const owner = place.owner ? this.agents.get(place.owner) : null;
        for (const c of crowd) { this.remember(c, `We fought the fire at ${place.name}; ${who} of us. It will be ${days} days before it stands again.`, 0.8); for (const d of crowd) if (d !== c) this.nudge(c, d.id, 0.03, 0.02); }
        if (owner) { this.remember(owner, `${place.name} burned: ${g.note}. ${who} came with buckets. ${days} days before I can use it again${lost ? `; lost ${lost}` : ""}.`, 1); }
        for (const r of this.residentsOf(place)) if (!crowd.includes(r)) this.remember(r, `${place.name}, where I sleep, burned. I have no roof for ${days} days.`, 1);
        this.emit("town.gathering", g.actors, g.place, `The fire at ${place.name} is out. ${who} came with buckets; ${days} days before it stands again${lost ? `, and ${lost} lost to the flames` : ""}.`, 1, { kind: g.kind, crowd: crowd.map((c) => c.id), held: true, days, cause: g.note });
      } else if (g.kind === "feast") {
        const council = this.places.get("council"); const market = this.places.get("market"); const paid = council ? Math.min(council.treasury, who) : 0; if (council && market && paid) { council.treasury -= paid; market.treasury += paid; }
        for (const c of crowd) { c.needs.hunger = 0; c.needs.social = 0; this.remember(c, `${g.note}: the whole town at ${place.name}, and enough for everyone.`, 0.7); for (const d of crowd) if (d !== c) this.nudge(c, d.id, 0.02, 0.02); }
        this.emit("town.gathering", [], g.place, `${g.note}: ${who} came to ${place.name}, and everyone ate${paid ? `; the council paid ${paid} coins for it` : ""}.`, 0.95, { kind: g.kind, crowd: crowd.map((c) => c.id), held: true });
      }
    }
    if (this.gatherings.length > 200) this.gatherings = this.gatherings.filter((g) => !g.held || g.day >= this.day - 7);
  }
  /** The court, in front of the town: the record decides. */
  private verdict(g: Gathering, crowd: AgentState[]): void {
    const a = this.agents.get(g.actors[0]!), b = this.agents.get(g.actors[1]!); const council = this.places.get("council")!; const place = this.places.get(g.place)!;
    if (!b) { this.emit("town.gathering", g.actors, g.place, `The hearing at ${place.name} did not happen: the accused is gone.`, 0.6, { kind: g.kind, crowd: crowd.map((c) => c.id), held: false }); return; }
    const accuser = a?.persona.name ?? "the accuser"; const since = this.t - 10 * MINUTES_PER_DAY;
    const guilt = this.events.filter((e) => e.t >= since && e.actors[0] === b.id && (isTheft(e) || (e.kind === "agent.debt" && / still owes /.test(e.text)))).length;
    const witnesses = crowd.filter((c) => c !== a && c !== b); const who = crowd.length;
    if (guilt === 0) {
      const fine = a ? Math.min(a.coins, 3) : 0; if (a) { a.coins -= fine; council.treasury += fine; this.remember(a, `I accused ${b.persona.name} and the record cleared them, in front of everyone. It cost me ${fine} coins and some standing.`, 0.8); }
      this.remember(b, `${accuser} accused me before the council and the record cleared me, with the town watching.`, 0.9);
      if (a) { const r = b.relationships.get(a.id); if (r) r.trust = Math.max(0, r.trust - 0.3); for (const w of witnesses) { this.nudge(w, a.id, -0.08, -0.02); this.remember(w, `The council cleared ${b.persona.name}; ${accuser} had accused them of "${g.note}" and paid for it.`, 0.6, "rumor"); } }
      this.emit("town.gathering", g.actors, g.place, `The council heard ${accuser} against ${b.persona.name} (“${g.note}”) in front of ${who}. The record shows nothing; ${accuser} pays ${fine} coins for a false accusation.`, 0.9, { kind: g.kind, verdict: "dismissed", fine, crowd: crowd.map((c) => c.id), held: true });
    } else if (b.convictions >= 1 || guilt >= 3) {
      if (a) this.remember(a, `The council found against ${b.persona.name} on my word, and sent them away.`, 0.9);
      for (const w of witnesses) this.remember(w, `The council exiled ${b.persona.name} for ${guilt} offence${guilt === 1 ? "" : "s"}.`, 0.8, "rumor");
      this.emit("town.gathering", g.actors, g.place, `The council heard ${accuser} against ${b.persona.name} (“${g.note}”) in front of ${who}. The record shows ${guilt} offence${guilt === 1 ? "" : "s"}${b.convictions ? " and a conviction already" : ""}: the boat.`, 1, { kind: g.kind, verdict: "exile", guilt, crowd: crowd.map((c) => c.id), held: true });
      this.removeAgent(b.id, "exiled", `Found against by the council, accused by ${accuser}.`);
    } else {
      const owed = a ? b.debts.find((d) => d.to === a.id) : null; // a creditor who brought them here is paid first, out of what the fine would have been
      const fine = Math.min(b.coins, 4 * guilt); b.coins -= fine; b.convictions++;
      const paid = owed && a ? Math.min(fine, owed.coins) : 0;
      if (owed && a && paid > 0) {
        a.coins += paid; owed.coins -= paid; if (owed.coins <= 0) b.debts = b.debts.filter((d) => d !== owed);
        this.emit("agent.debt", [b.id, a.id], council.id, `The council took ${paid} coins from ${b.persona.name} and gave them to ${a.persona.name} against what was owed${owed.coins > 0 ? `; ${owed.coins} coins are still owed` : ", and it is settled"}.`, 0.7);
        this.remember(a, `The council made ${b.persona.name} pay me ${paid} coins of what they owed.`, 0.9); this.remember(b, `The council took ${paid} coins off me and gave them to ${a.persona.name}.`, 0.9);
      }
      council.treasury += fine - paid;
      this.remember(b, `The council fined me ${fine} coins on ${accuser}'s word, in front of everyone. One more and they will put me on the boat.`, 0.95);
      if (a) { this.remember(a, `The council fined ${b.persona.name} ${fine} coins on my word.`, 0.7); const r = b.relationships.get(a.id); if (r) r.trust = Math.max(0, r.trust - 0.4); }
      for (const w of witnesses) { this.nudge(w, b.id, -0.1, -0.05); this.remember(w, `The council fined ${b.persona.name} ${fine} coins for "${g.note}".`, 0.6, "rumor"); }
      this.emit("town.gathering", g.actors, g.place, `The council heard ${accuser} against ${b.persona.name} (“${g.note}”) in front of ${who}. The record shows ${guilt} offence${guilt === 1 ? "" : "s"}: fined ${fine} coins. A second conviction means the boat.`, 0.95, { kind: g.kind, verdict: "fine", fine, guilt, crowd: crowd.map((c) => c.id), held: true });
    }
  }
  /** The council sits: open laws close on their votes, and the island chooses a mayor by the trust it holds in each person. */
  private council(): void {
    for (const law of this.laws) { if (!law.open) continue; law.open = false; const by = this.agents.get(law.by)?.persona.name ?? "someone"; if (law.yes > law.no) { this.emit("law.passed", [law.by], "council", `The council passed ${by}'s proposal, ${law.yes} to ${law.no}: “${law.text}”`, 0.7); this.enact(law.text); } else this.emit("law.failed", [law.by], "council", `The council let ${by}'s proposal fall, ${law.yes} to ${law.no}: “${law.text}”`, 0.5); }
    if (this.agents.size < 2) return;
    const score = new Map<AgentId, number>(); for (const a of this.agents.values()) for (const [other, r] of a.relationships) if (this.agents.has(other)) score.set(other, (score.get(other) ?? 0) + (r.trust - 0.3));
    let best: AgentId | null = null, bestScore = -Infinity; for (const a of this.agents.values()) { const sc = (score.get(a.id) ?? 0) + a.persona.traits.warmth * 0.01; if (sc > bestScore) { best = a.id; bestScore = sc; } }
    if (!best) return; const m = this.agents.get(best)!; const was = this.mayor;
    this.mayor = best; this.electedDay = this.day;
    this.emit("town.mayor", [best], "council", was === best ? `The council kept ${m.persona.name} as mayor.` : `The council chose ${m.persona.name} as mayor: the person the island trusts most.${was && this.agents.has(was) ? ` ${this.agents.get(was)!.persona.name} steps down.` : ""}`, 0.8);
    this.remember(m, was === best ? "The council kept me as mayor for another month." : "The council made me mayor. The treasury is mine to spend on the island, and the island is watching.", 1);
    for (const a of this.agents.values()) if (a.id !== best) this.remember(a, `${m.persona.name} is mayor now.`, 0.5, "rumor");
  }
  /** Something the island has: produced, supplied, exported, sold somewhere, or made here. */
  knownItem(item: string): boolean { return this.pack.produce.some((p) => p.makes === item) || this.pack.supply.some((l) => l.item === item) || this.pack.exports.some((e) => e.item === item) || [...this.places.values()].some((p) => p.sells.some((x) => x.item === item) || (p.stock[item] ?? 0) > 0 || p.recipes?.some((r) => r.item === item)) || FOOD_ITEMS.has(item); }
  /** A passed law is read for what the engine can do with it: a tax on wages, a cap on a price, a curfew. Words the engine cannot act on stay words. */
  enact(text: string): Rule | null {
    const t = text.toLowerCase(); let rule: Rule | null = null;
    const tax = /(\d{1,2})\s*(?:%|percent|per cent)/.exec(t); if (tax && /tax|levy|tithe|council|treasury/.test(t)) rule = { kind: "tax", percent: Math.min(50, Number(tax[1])), text };
    const cap = /(?:cap|no more than|at most|not (?:more|above)|max(?:imum)?)[^\d]{0,40}(\d{1,2})\s*coins?[^a-z]{0,20}(?:for|a|per|on)\s+(?:a\s+|the\s+)?([a-z]+)/.exec(t) ?? /([a-z]+)\s+(?:shall|must|may|to)\s+(?:cost|sell for|be sold at)\s+(?:no more than|at most)?\s*(\d{1,2})/.exec(t);
    if (!rule && cap) { const item = isNaN(Number(cap[1])) ? cap[1]! : cap[2]!; const price = Number(isNaN(Number(cap[1])) ? cap[2] : cap[1]); if (price >= 1) rule = { kind: "cap", item, price, text }; }
    const curfew = /curfew[^\d]{0,30}(\d{1,2})|(?:close|shut|no drink|no drinking)[^\d]{0,30}(?:at|after|from)\s*(\d{1,2})/.exec(t); if (!rule && curfew) rule = { kind: "curfew", hour: Number(curfew[1] ?? curfew[2]), text };
    if (!rule) return null;
    this.rules = this.rules.filter((r) => r.kind !== rule!.kind || (r.kind === "cap" && rule!.kind === "cap" && r.item !== rule!.item)); this.rules.push(rule);
    this.emit("town.rule", [], "council", `The law has teeth: ${rule.kind === "tax" ? `${rule.percent} of every hundred coins of wages goes to the council` : rule.kind === "cap" ? `${rule.item} may cost no more than ${rule.price}` : `the tavern and the inn stop serving at ${rule.hour}:00`}.`, 0.7, { rule });
    return rule;
  }
  /** What the island calls the rules and the sayings it keeps, for the minds. */
  ways(): { rules: string[]; sayings: string[] } { return { rules: this.rules.map((r) => r.kind === "tax" ? `wages taxed ${r.percent}% for the council` : r.kind === "cap" ? `${r.item} capped at ${r.price} coins` : `curfew: nothing served after ${r.hour}:00`), sayings: this.sayings.filter((x) => x.by.length >= 2).slice(-3).map((x) => x.text) }; }
  /** The two places farthest apart by the roads, for the bridge. */
  private farthestPair(): [Place | null, Place | null] {
    const ids = [...this.places.values()].filter((p) => p.kind !== "wild" && p.kind !== "plot"); let best: [Place | null, Place | null] = [null, null], bestD = -1;
    for (const a of ids) { const dist = new Map<string, number>([[a.id, 0]]); const q = [a.id]; while (q.length) { const cur = q.shift()!; for (const nx of this.places.get(cur)?.exits ?? []) if (!dist.has(nx)) { dist.set(nx, dist.get(cur)! + 1); q.push(nx); } } for (const b of ids) { const d = dist.get(b.id) ?? -1; if (d > bestD && !a.exits.includes(b.id)) { bestD = d; best = [a, b]; } } }
    return best;
  }
  path(from: string, to: string): string | null {
    if (from === to) return null;
    const prev = new Map<string, string | null>([[from, null]]); const q = [from];
    while (q.length) { const cur = q.shift()!; for (const nx of this.places.get(cur)?.exits ?? []) { if (!prev.has(nx)) { prev.set(nx, cur); q.push(nx); } } }
    if (!prev.has(to)) return null;
    let cur = to; while (prev.get(cur) !== from) cur = prev.get(cur)!;
    return cur;
  }
  private habitView() { return { now: this.t, day: this.day, learning: this.learning, places: this.places, jobs: this.jobs, hour: this.hour, weather: this.weather, season: this.season, weekday: this.weekday, crowd: (p: string) => this.crowd(p), price: (pl: Place, i: string) => this.price(pl, i), path: (f: string, t: string) => this.path(f, t), hops: (f: string, t: string) => this.hops(f, t) }; }
  rel(a: AgentState, other: AgentId) {
    let r = a.relationships.get(other);
    if (!r) { r = { trust: 0.3, affection: 0.3, lastSeen: this.t, opinion: "", lastPlace: null }; a.relationships.set(other, r); }
    return r;
  }
  private nudge(a: AgentState, other: AgentId, trust: number, affection: number): void {
    const r = this.rel(a, other); r.trust = clamp(r.trust + trust); r.affection = clamp(r.affection + affection); r.lastSeen = this.t;
  }
  /** Remember only the public condition of the place actually occupied, not remote world state. */
  private rememberPlace(a: AgentState): string {
    const p = this.places.get(a.location)!;
    const text = `Observed local state at ${p.name} (${p.id}): ${p.brokenUntil && p.brokenUntil > this.day ? "active damage" : "no active damage recorded"}; ${p.site ? `construction ${p.site.labor}/${p.site.laborNeeded} mornings` : "no construction site"}. This does not reveal unmodeled structural details.`;
    const dayStart = (this.day - 1) * MINUTES_PER_DAY;
    if (!a.memory.some(m => m.t >= dayStart && m.kind === "obs" && m.text === text)) this.remember(a, text, 0.65);
    return text;
  }
  remember(a: AgentState, text: string, importance: number, kind: Memory["kind"] = "obs"): void {
    a.memory.push({ t: this.t, text, importance: clamp(importance), kind });
  }
  /** The intent behind the action being applied right now. Goes into the event so an owner can read why. */
  private because: string | null = null;
  emit(kind: EventKind, actors: AgentId[], place: string | undefined, text: string, importance: number, payload?: Record<string, unknown>): TownEvent {
    const withWhy = this.because && kind !== "action.rejected" ? { ...(payload ?? {}), because: this.because } : payload;
    const e: TownEvent = { id: this.nextEventId++, t: this.t, day: this.day, kind, actors, text, importance: clamp(importance), ...(place ? { place } : {}), ...(withWhy ? { payload: withWhy } : {}) };
    recordEvolution(this.evolution,e);
    recordBuildingMoment(e, this.places, this.agents);
    this.events.push(e); this.onEvent?.(e);
    // a moment worth a letter home: something that mattered, to someone whose plan carries careful thoughts, at most once a day between reflections
    if (e.importance >= 0.5 && kind !== "agent.letter" && kind !== "agent.reflect" && kind !== "action.rejected" && kind !== "town.book") for (const id of actors) { const a = this.agents.get(id); if (a && a.owner && a.budget.tier2Max > 0 && !a.crossroads && a.ownerLetterDay !== this.day && !a.asleep) a.crossroads = text; }
    return e;
  }
  private rollWeather(): string { return this.rng.pick(WEATHERS); }

  /** What one owner sees when they come back. The product, in one function. */
  digest(agentId: AgentId, sinceT: number): { headline: string; items: TownEvent[]; people: { name: string; trust: number; opinion: string }[] } {
    const a = this.agents.get(agentId); if (!a) return { headline: "", items: [], people: [] };
    const known = new Set([agentId, ...a.relationships.keys()]); const owned = new Set([...this.places.values()].filter((p) => p.owner === agentId).map((p) => p.id));
    // admitted by kind, not only by weight: what they said to someone and what was said to them, what the town refused them, a price at their own counter, the first and last thing of the day; the rest by importance
    const mine = (e: TownEvent) => e.actors.includes(agentId);
    const story = (e: TownEvent) => (e.kind === "agent.say" && mine(e) && e.actors.length >= 2) || (e.kind === "conversation" && mine(e)) || (e.kind === "action.rejected" && mine(e)) || (e.kind === "economy.price" && !!e.place && owned.has(e.place));
    const weight = (e: TownEvent) => e.importance + (mine(e) ? 0.35 : 0) + (story(e) ? 0.2 : 0);
    const PRIVATE = new Set(["agent.reflect", "agent.plan", "agent.letter", "agent.self", "relation.change"]); // what belongs to one person and their owner alone
    const pool = this.events.filter((e) => e.t >= sinceT && e.kind !== "agent.move" && (mine(e) ? e.kind !== "agent.reflect" : !PRIVATE.has(e.kind)) && (story(e) || (mine(e) ? e.importance >= 0.25 : e.actors.some((x) => known.has(x)) && e.importance >= 0.45)));
    const own = this.events.filter((e) => e.t >= sinceT && mine(e) && e.kind !== "agent.reflect" && e.kind !== "agent.move" && e.kind !== "agent.wake" && e.kind !== "agent.sleep");
    const must = new Set<TownEvent>(); for (let d = Math.floor(sinceT / MINUTES_PER_DAY) + 1; d <= this.day; d++) { const today = own.filter((e) => e.day === d); if (today[0]) must.add(today[0]); if (today.length > 1) must.add(today[today.length - 1]!); }
    const picked = new Set<TownEvent>(must); for (const e of [...pool].sort((x, y) => weight(y) - weight(x))) { if (picked.size >= 16) break; picked.add(e); }
    const items = [...picked].sort((x, y) => x.t - y.t || x.id - y.id);
    const top = [...items].sort((x, y) => weight(y) - weight(x))[0];
    return { headline: top?.text ?? `Nothing changed for ${a.persona.name}.`, items, people: [...a.relationships.entries()].map(([id, r]) => ({ name: this.agents.get(id)?.persona.name ?? id, trust: r.trust, opinion: r.opinion })) };
  }

  /** Everything the writer of a digest may know: the record, the plan, the letter, the people. Nothing invented. */
  digestContext(agentId: AgentId, sinceT: number): DigestContext | null {
    const a = this.agents.get(agentId); if (!a) return null;
    const d = this.digest(agentId, sinceT);
    const letter = [...this.events].reverse().find((e) => e.kind === "agent.letter" && e.actors[0] === agentId && e.t >= sinceT);
    return {
      agent: a, name: a.persona.name, day: this.day, daysAway: Math.max(1, Math.round((this.t - sinceT) / MINUTES_PER_DAY)),
      events: d.items.slice(-16).map((e) => `${this.clockAt(e.t)}: ${e.text}${e.payload?.because ? ` (because: ${String(e.payload.because)})` : ""}`),
      plan: this.planSheet(a, sinceT),
      projects: a.projects.filter((x) => !x.done).map((x) => ({ title: x.title, progress: x.progress, since: x.since })), trust: this.trustSince(a, sinceT),
      letter: letter ? String(letter.payload?.text ?? "") : null,
      reflection: (() => { const r = [...this.events].reverse().find((e) => e.kind === "agent.reflect" && e.actors[0] === agentId); return r ? r.text.replace(/^.*? reflected: /, "") : null; })(), intentions: [...a.intentions].slice(0, 3),
      people: d.people.slice(0, 6), coins: a.coins, job: a.job ? (this.jobs.get(a.job)?.title ?? a.job) : null, home: a.home ? (this.places.get(a.home.place)?.name ?? a.home.place) : null,
    };
  }
  clockAt(t: number): string { const d = Math.floor(t / MINUTES_PER_DAY) + 1, m = t % MINUTES_PER_DAY; return `day ${d} ${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; }
  /** Today's plan with what came of each step, place names instead of ids, for the night's reflection and the owner's reading. */
  private planSheet(a: AgentState, sinceT?: number): { mood: string; goals: string[]; steps: { hour: number; do: string; place: string | null; done: boolean; missed: boolean }[] } | null {
    // a digest that reaches back into yesterday is about yesterday: it reports the plan that day was lived against, not this morning's unstarted one
    const back = sinceT !== undefined && sinceT < (this.day - 1) * MINUTES_PER_DAY && a.lastPlan?.day === this.day - 1;
    const plan = back ? a.lastPlan! : a.plan;
    if (plan?.day !== (back ? this.day - 1 : this.day) || !plan.goals.length) return null;
    return { mood: plan.mood, goals: [...plan.goals], steps: plan.steps.map((st) => ({ hour: st.hour, do: st.do, place: st.place ? (this.places.get(st.place)?.name ?? st.place) : null, done: st.done, missed: !!st.missed })) };
  }
  /** Whose trust in them moved since a moment, and by how much: the log of past days plus today against the dawn. */
  private trustSince(a: AgentState, sinceT: number): { name: string; delta: number }[] {
    const sinceDay = Math.floor(sinceT / MINUTES_PER_DAY) + 1; const by = new Map<AgentId, number>();
    for (const b of this.agents.values()) { if (b.id === a.id) continue; let d = 0; for (const x of b.trustLog) if (x.other === a.id && x.day >= sinceDay) d += x.delta; const r = b.relationships.get(a.id); if (r) d += r.trust - (b.trustDawn[a.id] ?? 0.3); if (Math.abs(d) >= 0.05) by.set(b.id, d); }
    return [...by.entries()].sort((x, y) => Math.abs(y[1]) - Math.abs(x[1])).slice(0, 6).map(([id, delta]) => ({ name: this.agents.get(id)?.persona.name ?? id, delta: Math.round(delta * 100) / 100 }));
  }
  /** A day with nothing in it for this person: no event of weight, no trust moved past a tenth, no letter read or written, nothing begun, built, taken on or given up. */
  private quietDay(a: AgentState, todays: TownEvent[], dayStart: number): boolean {
    const MOVEMENT = new Set<EventKind>(["agent.build", "town.built", "agent.hired", "agent.quit", "agent.hire", "town.recipe", "agent.letter"]);
    if (todays.some((e) => e.actors.includes(a.id) && (e.importance >= 0.45 || MOVEMENT.has(e.kind)))) return false;
    if (a.letters.some((l) => l.t >= dayStart)) return false;
    for (const [other, r] of a.relationships) if (Math.abs(r.trust - (a.trustDawn[other] ?? 0.3)) > 0.1) return false;
    for (const b of this.agents.values()) { const r = b.relationships.get(a.id); if (r && Math.abs(r.trust - (b.trustDawn[a.id] ?? 0.3)) > 0.1) return false; }
    return true;
  }
  /** The needs in words, on the scale the body keeps: a day that ends past starving counts, two count you weak, five kill. */
  private feels(a: AgentState): { hunger: string; rest: string; social: string } {
    const h = a.needs.hunger, r = a.needs.rest, so = a.needs.social;
    const cold = this.season === "winter" && a.roofless >= 2; // in winter, three nights rough and three days hungry is the end of it, not five
    const hunger = a.starving >= 2 && cold ? `weak with hunger: ${a.starving} days without a proper meal, and another night rough in this cold can kill` : a.starving >= 2 ? `weak with hunger: ${a.starving} days without a proper meal, and five kill` : h >= 0.85 ? `starving; a day that ends like this counts against you${a.starving ? ` (${a.starving} already)` : ""}` : h >= 0.7 ? "very hungry" : h >= 0.5 ? "hungry" : h >= 0.3 ? "could eat" : "fed";
    const rest = r >= 0.85 ? "exhausted" : r >= 0.65 ? "tired" : r >= 0.4 ? "a little worn" : "rested";
    const social = so >= 0.85 ? "very lonely" : so >= 0.6 ? "lonely" : so >= 0.35 ? "could use company" : "content";
    return { hunger, rest, social };
  }
  /** The town sheet: where the people they know, and the people they saw today, are right now. Names and places, nothing more. */
  private townPeople(a: AgentState): { name: string; place: PlaceId; asleep: boolean }[] {
    const ids = [...[...a.relationships.entries()].sort((x, y) => Math.abs(y[1].trust - 0.3) - Math.abs(x[1].trust - 0.3)).map(([id]) => id), ...a.seenToday];
    const out: { name: string; place: PlaceId; asleep: boolean }[] = []; const seen = new Set<AgentId>();
    for (const id of ids) {
      if (id === a.id || seen.has(id)) continue; const b = this.agents.get(id); if (!b) continue; seen.add(id);
      const here = b.location === a.location; const place = here ? b.location : a.relationships.get(id)?.lastPlace ?? null;
      if (!place) continue; // they have never been seen, so there is nothing to say about where they are
      out.push({ name: b.persona.name, place, asleep: here ? b.asleep : false }); if (out.length >= 24) break;
    }
    return out;
  }
  /** What a counter pays for a thing brought to it: half the shelf price for what it sells, half the cart's for what its shifts need, a coin at least; null when it has no use for it. */
  buyPrice(place: Place, item: string): number | null {
    // a council cap can put the shelf price below the base; the bid follows the lower of the two, or buying and selling back would pump the owner's purse
    if (place.community && item === "vegetables") return null;
    const shelf = place.sells.find((x) => x.item === item); if (shelf) return Math.max(1, Math.floor(Math.min(shelf.base, this.price(place, item) ?? shelf.base) / 2));
    const line = this.pack.supply.find((l) => l.to === place.id && l.item === item); if (line) return Math.max(1, Math.floor(line.price / 2));
    const needs = this.pack.produce.some((pr) => pr.place === place.id && pr.needs?.item === item) || !!place.recipes?.some((r) => r.from.includes(item));
    if (!needs) return null; const ex = this.pack.exports.find((e) => e.item === item); return Math.max(1, Math.floor((ex?.price ?? 2) / 2));
  }
  /** Something that can be eaten: the island's food, or a thing made here out of food. */
  isFood(item: string, depth = 0): boolean {
    if (FOOD_ITEMS.has(item)) return true; if (depth > 3) return false;
    for (const p of this.places.values()) for (const r of p.recipes ?? []) if (r.item === item && r.from.some((f) => this.isFood(f, depth + 1))) return true;
    return false;
  }
  /** Midnight on the shelves: of the bread, fish and soup beyond a day's shelf, a third goes stale, so a surplus cannot pile forever. Grain, flour, planks and the rest keep. */
  private spoil(): void {
    const gone: string[] = []; const SHELF = 12;
    for (const p of this.places.values()) for (const item of PERISHABLE) { const v = p.stock[item] ?? 0; const lost = Math.floor(Math.max(0, v - SHELF) / 3); if (lost <= 0) continue; p.stock[item] = v - lost; gone.push(`${lost} ${item} at ${p.name}`); }
    if (gone.length) this.emit("economy.price", [], undefined, `Overnight ${gone.join(", ")} went stale and were thrown out.`, 0.05, { spoiled: gone });
  }
}

/** A taking that counts against someone: not gathering in the wild, not one's own shelf. */
function isTheft(e: TownEvent): boolean { return e.kind === "agent.take" && !e.payload?.forage && !e.payload?.own; }

/** A letter that wants an answer: a question, or a plain request. */
export function asksSomething(text: string): boolean { return /\?/.test(text) || /\b(please|could you|can you|would you|will you|tell me|let me know|write (?:to )?me|write back|answer|reply|send word|i want to know|i need to know)\b/i.test(text); }

function clamp(x: number, lo = 0, hi = 1): number { return Math.max(lo, Math.min(hi, x)); }

function lower(t: string): string { return t.length ? t[0]!.toLowerCase() + t.slice(1) : t; }
