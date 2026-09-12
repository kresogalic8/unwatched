import type { LifeText, DayPlan, DigestText, Child, Judgement } from "@unwatched/protocol";
import type { AgentId, PlaceId, Persona, TownEvent, Perception, ActionProposal, Reflection, Dialogue, Paper } from "@unwatched/protocol";

export type PlaceKind = "harbor" | "inn" | "market" | "shop" | "workplace" | "public" | "home" | "civic" | "plot" | "wild";

export interface Place {
  id: PlaceId;
  name: string;
  kind: PlaceKind;
  exits: PlaceId[];
  sells: { item: string; base: number }[];
  /** Recipes learned here: one thing from others on hand. */
  recipes?: { item: string; from: string[]; by: AgentId }[];
  /** What people have called this place, and who; a name three people use is the island's. */
  aliases?: { name: string; by: AgentId[] }[];
  nickname?: string;
  beds?: { price: number; capacity: number };
  freeBeds?: number;
  /** Where it stands on the island, in map units, and which district. The client draws from this. */
  x: number; y: number; district: string; sprite: string;
  /** Who owns it. Rent and takings go to them; they sleep free; they pay the wages of anyone they employ. */
  owner: AgentId | null;
  /** Coins the business holds when nobody owns it. Wages come out of here; takings and the mainland's payment for produce go in. */
  treasury: number;
  /** What is on the shelves and in the store room. Nothing sells that is not here; shifts make more of it. */
  stock: Record<string, number>;
  /** The day a broken place works again, if a storm took its roof. */
  brokenUntil?: number;
  /** An unfinished building on a plot. Work adds labor; at laborNeeded it becomes a place. */
  site: { what: "house" | "shop"; name: string; by: AgentId; labor: number; laborNeeded: number; startedDay: number; look?: string; project?: string; workedDay?: Record<AgentId, number> } | null;
  /** How the builder wanted it to look, in their words. The island draws it from this; the hash of it names the sprite. */
  look?: string;
}

export interface Job {
  id: string;
  title: string;
  place: PlaceId;
  wage: number;
  hours: [number, number];
  slots: number;
  holders: AgentId[];
}

/** A promise between two people that the town remembers until it is kept or broken. */
export interface Deal {
  /** Only labor performed after acceptance counts, on this particular building site. */
  construction?: { site: PlaceId; mornings: number; done: number; startedDay: number };
  id: number;
  with: AgentId;
  /** what the one who promised will do */
  what: string;
  /** what is paid for it, if anything */
  coins: number;
  /** true on the side that has to do the thing */
  mine: boolean;
  state: "offered" | "open" | "kept" | "broken" | "refused";
  /** the minute it comes due, or null for a promise with no day on it */
  due: number | null;
  at: number;
}

export interface Relation {
  trust: number;
  affection: number;
  lastSeen: number;
  opinion: string;
  /** Where this person was the last time they were actually seen. Nothing is known unless it was perceived, so this is all anyone can say about where another person is. */
  lastPlace: PlaceId | null;
}

export interface Memory {
  t: number;
  text: string;
  importance: number;
  kind: "obs" | "reflect" | "letter" | "rumor" | "plan";
  /** Cached embedding, computed on first retrieval. Never serialized. */
  vec?: Float32Array;
}

export interface Budget {
  tier1Max: number;
  tier2Max: number;
  tier1Left: number;
  tier2Left: number;
}

export interface OwnerLetter { id: number; text: string; t: number; read: boolean; /** set once the citizen has written back to this letter; one answer per letter */ answered?: boolean }

export interface AgentState {
  id: AgentId;
  persona: Persona;
  needs: { hunger: number; rest: number; social: number };
  location: PlaceId;
  coins: number;
  inventory: string[];
  job: string | null;
  /** Where they live, the nights already paid for, and what has run up unpaid since. */
  home: { place: PlaceId; nightsPaid: number; arrears?: number } | null;
  asleep: boolean;
  arrivedAt: number;
  relationships: Map<AgentId, Relation>;
  memory: Memory[];
  budget: Budget;
  funded: boolean;
  owner: string | null;
  letters: OwnerLetter[];
  intentions: string[];
  lastConversation: number;
  lastThought: number;
  heard: { from: AgentId; name: string; text: string; t: number }[];
  workedToday: boolean;
  rumors: string[];
  appearance: Record<string, unknown> | null;
  /** Read every morning. Advice, not orders. */
  instructions: string;
  /** Who thinks for this person. The engine only cares for two things: own-brains talk turn by turn, and cadence adds thoughts. */
  brainKind: "hosted" | "own_key" | "own_brain";
  /** For own-key agents: think at least this often, in sim minutes, while awake. */
  thinkEvery: number | null;
  /** Today's plan, made on waking. Null before the first morning, or for a person who cannot afford to plan. */
  plan: ActivePlan | null;
  /** The plan of the last day they planned, as it stood when that day ended: what the morning digest reports against. */
  lastPlan: ActivePlan | null;
  /** A word from the world for the next thought only: someone is here and something is at stake. Never persisted. */
  hint: string | null;
  /** something just happened that whoever sent them would want to hear; cleared by the next thought */
  crossroads: string | null; ownerLetterDay: number;
  /** Coins owed to others, with the sim minute they are due. Repaying is giving. */
  debts: { to: AgentId; coins: number; due: number }[];
  /** Promises. Both sides carry the same row under the same id: `mine` says who has to do the thing. */
  deals: Deal[];
  /** Where they are walking to, when it is more than one road away. Habit takes the next road each minute until they arrive. */
  heading: PlaceId | null;
  /** Days in a row that ended hungry, and days in a row that ended without a roof. Two hungry days makes you weak; five can kill. */
  starving: number; roofless: number;
  /** Times the council found against them. The second time is the boat. */
  convictions: number;
  /** Other people's secrets this person has learned, by whose id. */
  secretsKnown: Record<AgentId, string>;
  /** What they chose to keep an eye on: names of people, places, things. Their attention goes there. */
  watch: string[];
  /** Who they were before they rewrote themselves: each earlier self, with the day it ended. */
  selves: { day: number; summary: string; want: string; fear: string; strangers: string; advice: string }[];
  lastSelfDay: number;
  /** Free deeds today; bounded, because each one is a thought of the town's. */
  doToday: number;
  /** What they are working toward over weeks, in their own words. */
  projects: { title: string; why: string; progress: string; since: number; done: boolean; doneDay?: number; construction?: { site: PlaceId; labor: number; needed: number } }[];
  /** What they have come to believe, true or not, and how sure they are. Fades unless renewed. */
  beliefs: { about: string; belief: string; confidence: number; since: number }[];
  /** Someone this person went over to talk with this minute; the next conversation pairs them. */
  seek: AgentId | null;
  /** Who they have been in the same place as today. With the people they know, this is the town sheet they carry. Cleared at midnight. */
  seenToday: AgentId[];
  /** Trust in each person as the day began, and how it moved on the days before: the digest reads the gap. */
  trustDawn: Record<AgentId, number>; trustLog: { day: number; other: AgentId; delta: number }[];
  /** When the body and the calendar last interrupted the mind: hunger every two hours at most, the first day of starving once, a debt due once a day, a gathering once. */
  lastHungerThought: number; starvingThoughtDay: number; debtThoughtDay: number; gatheringThoughtId: number | null;
  /** The owner letter the next letter home answers, so a reply is not held to the daily cap and a letter is answered once. */
  replyTo: number | null;
}

/** A DayPlan once the engine has it: dated, each step done when they were at its place from its hour, missed when the hour went by without them. */
export interface ActivePlan { day: number; mood: DayPlan["mood"]; goals: DayPlan["goals"]; steps: { hour: number; do: string; place: PlaceId | null; done: boolean; missed?: boolean }[] }

export type Tier = 1 | 2 | 3;

export interface ConverseContext {
  a: AgentState; b: AgentState; place: Place; time: string; weather: string;
  aMemories: string[]; bMemories: string[];
  rumorsA: string[];
  /** whether they have dealt with each other before, and what each wants from today */
  known?: boolean; aToday?: string | null; bToday?: string | null;
}

export interface ReflectContext {
  agent: AgentState; day: number; dayMemories: string[]; keyMemories: string[];
  relationships: { id: AgentId; name: string; trust: number; opinion: string }[];
  unreadLetters: string[];
  /** What they meant to do this morning and what came of each step; what they carry across weeks; what they believe; what they chose to watch. Shown so a night's answer keeps what it means to keep. */
  plan: { mood: string; goals: string[]; steps: { hour: number; do: string; place: string | null; done: boolean; missed: boolean }[] } | null;
  projects: { title: string; why: string; progress: string; since: number }[];
  beliefs: { about: string; belief: string; confidence: number }[];
  watch: string[];
  /** A day with nothing in it: no event of weight, no trust moved, no letter either way, nothing begun or finished. A cheaper mind may take these. */
  quiet: boolean;
}

export interface PlanContext {
  projects?: { title: string; progress: string; since: number }[];
  agent: AgentState; day: number; weather: string; hour: number;
  yesterday: string | null; intentions: string[]; keyMemories: string[];
  relationships: { id: AgentId; name: string; trust: number; opinion: string }[];
  places: { id: string; name: string; kind: string }[]; jobsOpen: string[]; unreadLetters: string[];
  land: string[]; building: string[]; owned: string[]; builds: { house: { coins: number; labor: number; describe: string }; shop: { coins: number; labor: number; describe: string } };
}

export interface DigestContext {
  agent: AgentState; name: string; day: number; daysAway: number;
  events: string[]; plan: { mood: string; goals: string[]; steps: { hour: number; do: string; place: string | null; done: boolean; missed: boolean }[] } | null; letter: string | null; people: { name: string; trust: number; opinion: string }[];
  coins: number; job: string | null; home: string | null;
  /** their own words, from the last reflection, and what they mean to do next */
  reflection: string | null; intentions: string[];
  /** what they are working toward over weeks, and whose trust in them moved since the owner last looked, by how much */
  projects: { title: string; progress: string; since: number }[]; trust: { name: string; delta: number }[];
}

/** What the town's mind is told when a child is born: who the parents are, what shaped them. It answers with who the child will be. */
export interface ChildContext {
  parents: { persona: Persona; keyMemories: string[]; coins: number; job: string | null }[];
  home: string; day: number; siblings: string[];
}

/** Everything the town knows of a life, for the book written when it ends here. */
export interface LifeContext {
  name: string; persona: Persona; how: "left" | "died" | "exiled"; note: string;
  arrivedDay: number; day: number; coins: number; job: string | null; home: string | null;
  events: string[]; memories: string[]; people: { name: string; trust: number; opinion: string }[]; letters: number; children: string[];
  /** their own voice: a few of the letters they sent home, and the last thing they thought; what they owned at the end */
  lettersHome: string[]; lastThought: string | null; owned: string[]; convictions: number;
}
export interface PaperContext {
  edition: number; date: string; weather: string;
  events: { text: string; importance: number; actors: string[] }[];
  laws: string[]; population: number; arrivals: number; departures: number;
  /** yesterday's front page, so a story that moved is followed and one that did not is not repeated */
  yesterday: { headline: string; deck: string; briefs: string[] } | null;
  /** the shelf at the market and what things cost; the boat, the cargo, who came and went; what tomorrow holds */
  market: { item: string; price: number | null; stock: number }[]; harbor: string[]; came: string[]; went: string[]; tomorrow: string; mayor: string | null;
  /** what citizens wrote for others to read today: exposés, notices of their own */
  writings: string[];
}

/** What the engine needs from any mind. Hosted, own-key, and own-brain all implement this. */
export interface Brain {
  readonly name: string;
  decide(p: Perception, agent: AgentState, tier: Tier): Promise<ActionProposal>;
  converse(ctx: ConverseContext): Promise<Dialogue>;
  reflect(ctx: ReflectContext): Promise<Reflection>;
  /** Once a morning: what this person means to do today. Tier 2 when they can afford it, tier 1 otherwise. */
  plan(ctx: PlanContext, tier: Tier): Promise<DayPlan>;
  /** The owner's daily reading, written from the record. Always the town's mind, never a private one. */
  digest(ctx: DigestContext): Promise<DigestText>;
  /** A newborn's persona, from the parents. The town's mind, never a private one. */
  child(ctx: ChildContext): Promise<Persona>;
  writePaper(ctx: PaperContext): Promise<Paper>;
  /** The book of a life, written by the town when someone leaves it. */
  life(ctx: LifeContext): Promise<LifeText>;
  /** The referee: what a free deed came to, within the rules. The town's mind, never a private one. */
  judge(ctx: JudgeContext): Promise<Judgement>;
}
export interface JudgeContext { agent: AgentState; what: string; withName: string | null; place: string; placeKind: string; hour: number; weather: string; nearby: string[]; inventory: string[]; coins: number; stock: string[] }

export type EventSink = (e: TownEvent) => void;

/** Everything needed to bring a town back exactly as it was. */
export interface AgentSnapshot {
  id: AgentId;
  persona: Persona;
  owner: string | null;
  funded: boolean;
  appearance: Record<string, unknown> | null;
  arrivedAt: number;
  state: {
    needs: AgentState["needs"]; location: PlaceId; coins: number; inventory: string[]; job: string | null;
    home: AgentState["home"]; asleep: boolean; budget: Budget; intentions: string[]; rumors: string[];
    deals?: Deal[];
    letters?: OwnerLetter[]; lastConversation?: number; lastThought?: number; instructions?: string; brainKind?: AgentState["brainKind"]; thinkEvery?: number | null; plan?: ActivePlan | null; debts?: { to: AgentId; coins: number; due: number }[]; starving?: number; roofless?: number; convictions?: number; secretsKnown?: Record<AgentId, string>; watch?: string[]; selves?: AgentState["selves"]; lastSelfDay?: number; projects?: AgentState["projects"]; beliefs?: AgentState["beliefs"]; trustLog?: AgentState["trustLog"];
    /** kept so a restart does not ask the same question twice, or forget a letter it promised to answer */
    lastPlan?: ActivePlan | null; replyTo?: number | null; lastHungerThought?: number; starvingThoughtDay?: number; debtThoughtDay?: number; gatheringThoughtId?: number | null;
  };
  relationships: { other: AgentId; trust: number; affection: number; lastSeen: number; opinion: string }[];
  memory: Memory[];
}
/** Something the whole town comes to: a wedding, a funeral, a hearing, an election, a feast. Summoned an hour before, held on the hour, in front of everyone who came. */
export interface Gathering { id: number; kind: "wedding" | "funeral" | "hearing" | "election" | "feast" | "fire"; place: PlaceId; day: number; hour: number; actors: AgentId[]; note: string; held: boolean }
/** One day of the record, sealed: the hash of its events, chained to the day before. */
export interface Seal { day: number; hash: string; prev: string; events: number; from: number; to: number }
/** A law with teeth: what the council's words were read to mean, and what the engine now does. */
export type Rule = { kind: "tax"; percent: number; text: string } | { kind: "cap"; item: string; price: number; text: string } | { kind: "curfew"; hour: number; text: string };
export interface TownSnapshot {
  t: number; day: number; weather: string; flourShortage: boolean;
  /** Places whose state can change: plots, sites, what people built, beds and owners. Positions come from the code. */
  places?: Place[];
  jobs?: { id: string; title: string; place: PlaceId; wage: number; hours: [number, number]; slots: number }[];
  agents: AgentSnapshot[];
  papers: Paper[];
  laws: { text: string; by: AgentId; yes: number; no: number; open: boolean; voters?: AgentId[] }[];
  children?: Child[];
  /** The institutions: who is mayor, since when, and what the council has built. */
  civic?: { nextDealId?: number; mayor: AgentId | null; elected: number; works: string[]; gatherings?: Gathering[]; wedded?: string[]; chain?: Seal[]; rules?: Rule[]; sayings?: { text: string; by: AgentId[] }[] };
}
