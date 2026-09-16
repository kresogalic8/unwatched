import { z } from "zod";
import { InventoryView, ItemInstance } from "./items";
export * from "./items";

/** Identifiers */
export const AgentId = z.string().regex(/^ag_[a-z0-9]+$/);
/** A place, by id or by the name a person would use. The engine resolves names; nothing downstream relies on the pattern. */
export const PlaceId = z.string().min(1).max(80);
export type AgentId = z.infer<typeof AgentId>;
/** How a brain may refer to a person: by id or by name. The engine resolves it. */
export const AgentRef = z.string().min(1).max(60);
export type AgentRef = z.infer<typeof AgentRef>;
export type PlaceId = z.infer<typeof PlaceId>;

/** Who a person is. Written once at boarding; everything after is memory. */
export const Persona = z.object({
  name: z.string().min(1),
  age: z.number().int().min(16).max(99),
  origin: z.string(),
  summary: z.string().describe("One sentence, who they are"),
  want: z.string(),
  fear: z.string(),
  secret: z.string().describe("Known to nobody on the island"),
  strangers: z.string().describe("How they treat strangers"),
  advice: z.string().describe("How they take advice"),
  traits: z.object({
    warmth: z.number().min(0).max(1),
    pride: z.number().min(0).max(1),
    caution: z.number().min(0).max(1),
    honesty: z.number().min(0).max(1),
    ambition: z.number().min(0).max(1),
  }),
  /** The depth a person has beyond the sheet: how they talk, a habit, a skill, a flaw, why they came. Written once by the town's mind when missing. */
  voice: z.array(z.string().max(240)).max(3).optional().describe("Two or three lines the way this person actually talks"),
  habit: z.string().max(240).optional().describe("A tic or a habit others notice"),
  skill: z.string().max(120).optional().describe("One thing they are genuinely good at"),
  flaw: z.string().max(240).optional().describe("The thing that costs them"),
  cameBecause: z.string().max(200).optional().describe("Why they came to the island, in a sentence"),
});
export type Persona = z.infer<typeof Persona>;
/** What the town's mind answers when asked to deepen a person. */
export const PersonaDepth = z.object({ voice: z.array(z.string().max(240)).min(2).max(3), habit: z.string().max(240), skill: z.string().max(120), flaw: z.string().max(240), cameBecause: z.string().max(200) });
export type PersonaDepth = z.infer<typeof PersonaDepth>;

/** Bounded reusable procedures: no recursion, code execution, messages or privileged actions. */
export const SkillStep = z.discriminatedUnion("kind", [
  z.object({kind:z.literal("craft"), recipe:z.string().min(1).max(40)}),
  z.object({kind:z.literal("move"),to:PlaceId}),
  z.object({kind:z.literal("trade"),buy:z.string().min(1).max(30).optional(),sell:z.string().min(1).max(30).optional()}),
  z.object({kind:z.literal("repair")}),
  z.object({kind:z.literal("use"),item:z.string().min(1).max(30)}),
  z.object({kind:z.literal("work")}),
  z.object({kind:z.literal("apply")}),
  z.object({kind:z.literal("make"),item:z.string().min(2).max(30),from:z.array(z.string().max(30)).min(1).max(4)}),
]);
export const SkillRecipe = z.object({name:z.string().trim().min(3).max(60),goal:z.enum(["eat","earn","repair","produce"]),steps:z.array(SkillStep).min(1).max(8)});
export type SkillRecipe = z.infer<typeof SkillRecipe>;
export const TravellingSkill = z.object({recipe:SkillRecipe,origin:z.object({island:z.string().max(100),author:z.string().max(100),name:z.string().max(100)})});

/** The action kinds the town can carry out. Nothing else exists. */
export const ActionKind = z.enum([
  "craft", "equip", "stow", "retrieve", "drop", "pickup", "repair_tool",
  "fish",
  "decorate", "move", "say", "give", "take", "use", "work", "apply", "quit", "trade",
  "propose", "vote", "write", "build", "message_owner", "sleep", "wait",
  "hire", "lend", "lodge", "leave",
  "fund", "accuse", "search", "do", "stock", "make", "call",
  "start_project", "contribute_project", "withdraw_project", "teach", "propose_skill", "test_skill", "practice_skill", "share_skill", "repair", "found_institution", "join_institution", "leave_institution",
]);
export type ActionKind = z.infer<typeof ActionKind>;

export const CommunityProject = z.object({
  name: z.string(), why: z.string(), by: AgentId, proposed: z.number(),
  phase: z.enum(["funding", "building", "complete"]), coins: z.number(), target: z.number(),
  members: z.array(z.object({ id: AgentId, coins: z.number(), help: z.boolean(), labor: z.number() })),
  completedDay: z.number().optional(), tendedDay: z.record(z.string(), z.number()).optional(),
  harvests: z.number(), foodProduced: z.number(),
});
export type CommunityProject = z.infer<typeof CommunityProject>;

export const Decoration = z.object({ kind: z.enum(["flowers", "bench", "cairn"]), by: AgentId, name: z.string(), why: z.string(), day: z.number(), t: z.number() });
export type Decoration = z.infer<typeof Decoration>;

export const Action = z.discriminatedUnion("kind", [
  z.object({kind:z.literal("craft"),recipe:z.string().min(1).max(40)}),
  z.object({kind:z.literal("equip"),item:z.string().nullable()}),
  z.object({kind:z.literal("stow"),item:z.string()}),
  z.object({kind:z.literal("retrieve"),item:z.string()}),
  z.object({kind:z.literal("drop"),item:z.string()}),
  z.object({kind:z.literal("pickup"),item:z.string()}),
  z.object({kind:z.literal("repair_tool"),item:z.string()}),
  /** A twenty-minute attempt at the harbor, once a day. The engine decides the catch. */
  z.object({ kind: z.literal("fish") }),
  z.object({kind:z.literal("decorate"),what:z.enum(["flowers","bench","cairn"]),why:z.string().trim().min(3).max(200)}),
  z.object({kind:z.literal("found_institution"),name:z.string().trim().min(3).max(60),charter:z.string().trim().min(10).max(400)}),
  z.object({kind:z.literal("join_institution")}),z.object({kind:z.literal("leave_institution")}),
  z.object({kind:z.literal("repair")}),
  z.object({kind:z.literal("propose_skill"),recipe:SkillRecipe}),
  z.object({kind:z.literal("test_skill"),id:z.string().max(20)}),
  z.object({kind:z.literal("practice_skill"),id:z.string().max(20)}),
  z.object({kind:z.literal("share_skill"),id:z.string().max(20),to:AgentRef}),
  z.object({ kind: z.literal("start_project"), at: PlaceId, name: z.string().trim().min(2).max(60), why: z.string().trim().min(3).max(240) }),
  z.object({ kind: z.literal("contribute_project"), at: PlaceId, coins: z.number().int().min(0).max(500).default(0), help: z.boolean().default(true) }),
  z.object({ kind: z.literal("withdraw_project"), at: PlaceId }),
  z.object({ kind: z.literal("teach"), to: AgentRef, place: PlaceId, item: z.string().trim().min(1).max(30) }),
  z.object({ kind: z.literal("move"), to: PlaceId }),
  /** Words, to everyone here or to one person. With "to" and no text it means: go and talk with them; the town then lets the two of you speak, turn by turn. */
  z.object({ kind: z.literal("say"), to: AgentRef.optional(), text: z.string().max(400).optional() }),
  z.object({ kind: z.literal("give"), to: AgentRef, coins: z.number().int().positive().optional(), item: z.string().optional() }),
  z.object({ kind: z.literal("take"), item: z.string(), from: AgentRef.optional() }),
  z.object({ kind: z.literal("use"), item: z.string() }),
  z.object({ kind: z.literal("work") }),
  /** Ask for work. Name the job, or leave it out to ask for whatever is open where you stand. */
  z.object({ kind: z.literal("apply"), job: z.string().optional() }),
  z.object({ kind: z.literal("quit") }),
  /** Buy or sell, with a person here or with the place you stand in. Left blank, it means: buy the cheapest food this place sells. */
  z.object({ kind: z.literal("trade"), with: AgentRef.optional(), buy: z.string().optional(), sell: z.string().optional(), coins: z.number().int().nonnegative().optional() }),
  z.object({ kind: z.literal("propose"), law: z.string().max(200) }),
  z.object({ kind: z.literal("vote"), proposal: z.string(), yes: z.boolean() }),
  /** Write something. Name someone in "about" and, if you know their secret, it is an exposé: the whole island reads it by evening. */
  z.object({ kind: z.literal("write"), title: z.string().max(80), text: z.string().max(2000), about: AgentRef.optional() }),
  /** Go through someone's things where they sleep, while they are out. You learn what nobody knows; anyone present sees you do it. */
  z.object({ kind: z.literal("search") }),
  /** Anything not on the list, in your own words. The town decides what it comes to, within the rules: it takes your minute, it may cost you, it never makes coins. */
  z.object({ kind: z.literal("do"), what: z.string().min(3).max(200), with: AgentRef.optional() }),
  /** At a place you own: put something on sale at a price, or take it off (price 0). It must be something the island has. */
  z.object({ kind: z.literal("stock"), item: z.string().max(30), price: z.number().int().min(0).max(30) }),
  /** At a workplace or shop where you work or that you own: make one new thing out of things on hand here, and the island learns the recipe. */
  z.object({ kind: z.literal("make"), item: z.string().min(2).max(30), from: z.array(z.string().max(30)).min(1).max(4) }),
  /** Call the place you stand in by a name of your own. When three people call it that, the island does too. */
  z.object({ kind: z.literal("call"), name: z.string().min(2).max(40) }),
  /** Build on the plot you stand on. "what" is the kind of place (a house, a shop, a workshop); "look" is how it should look, in a sentence, and the island draws it that way. */
  z.object({ kind: z.literal("build"), what: z.string(), at: PlaceId, name: z.string().max(60).optional(), look: z.string().max(200).optional(), project: z.string().trim().min(1).max(80).optional() }),
  z.object({ kind: z.literal("message_owner"), text: z.string().min(1).max(1200) }),
  z.object({ kind: z.literal("sleep") }),
  z.object({ kind: z.literal("wait") }),
  /** At a place you own: create a job for one helper. The wage comes out of your own coins each shift. */
  z.object({ kind: z.literal("hire"), title: z.string().max(60), wage: z.number().int().min(1).max(6) }),
  /** Coins now, remembered by both, due in so many days. Repay with give. */
  z.object({ kind: z.literal("lend"), to: AgentRef, coins: z.number().int().positive(), days: z.number().int().min(1).max(30) }),
  // a promise the town remembers: what you will do for someone, by when, and for how many coins if any
  z.object({ kind: z.literal("offer"), to: AgentRef, what: z.string().min(3).max(200), coins: z.number().int().min(0).max(500).optional(), days: z.number().int().min(1).max(30).optional(), construction: z.object({ site: PlaceId, mornings: z.number().int().min(1).max(30) }).optional() }),
  z.object({ kind: z.literal("accept"), deal: z.number().int().optional(), from: AgentRef.optional() }),
  z.object({ kind: z.literal("refuse"), deal: z.number().int().optional(), from: AgentRef.optional(), why: z.string().max(200).optional() }),
  z.object({ kind: z.literal("settle"), deal: z.number().int().optional(), to: AgentRef.optional() }),
  /** Take someone into a house you own. They sleep free until you say otherwise. */
  z.object({ kind: z.literal("lodge"), who: AgentRef }),
  /** Board the boat and leave the island for good. Only from the harbor, only when a boat runs. */
  z.object({ kind: z.literal("leave"), why: z.string().max(200).optional(), to: z.string().max(80).optional() }),
  /** The mayor pays for public works out of the council treasury: a granary, a bathhouse, a bridge. */
  z.object({ kind: z.literal("fund"), what: z.string().max(40) }),
  /** Bring someone before the council. The record decides: a fine, exile, or a fine for the accuser. */
  z.object({ kind: z.literal("accuse"), who: AgentRef, of: z.string().max(200) }),
]);
export type Action = z.infer<typeof Action>;

/** A private, evolving want. Evidence records experiences, not proof of an interpretation. */
export const DesireUpdate = z.object({
  id: z.string().max(40).optional(),
  title: z.string().trim().min(3).max(100),
  why: z.string().trim().min(3).max(300),
  state: z.enum(["active", "set_aside", "fulfilled"]),
  evidence: z.array(z.number().int().nonnegative()).min(1).max(3),
});
export type DesireUpdate = z.infer<typeof DesireUpdate>;
export const Desire = z.object({
  id: z.string(), title: z.string(), why: z.string(), state: z.enum(["active", "set_aside", "fulfilled"]), since: z.number(), updated: z.number(),
  history: z.array(z.object({ t: z.number(), title: z.string(), why: z.string(), state: z.enum(["active", "set_aside", "fulfilled"]), evidence: z.array(z.object({ id: z.number(), t: z.number(), kind: z.string(), text: z.string() })) })),
  attempts: z.array(z.object({ t: z.number(), action: z.string(), accepted: z.boolean(), events: z.array(z.object({ id: z.number(), text: z.string() })) })),
});
export type Desire = z.infer<typeof Desire>;

/** What an agent returns when it thinks. The model proposes, the engine disposes. */
export const ActionProposal = z.object({
  desire_id: z.string().max(40).optional(),
  action: Action,
  intent: z.string().max(600).optional(),
  remember: z.array(z.string().max(400)).max(3).default([]),
});
export type ActionProposal = z.infer<typeof ActionProposal>;

/** What an agent sees when it is its turn to think. Never ground truth. */
/** What a person means to do with the day. Written each morning from their own wants, yesterday, and the people they know. */
export const DayPlan = z.object({
  mood: z.string().max(160),
  goals: z.array(z.string().max(240)).min(1).max(3),
  steps: z.array(z.object({ hour: z.number().int().min(5).max(23), do: z.string().max(240).optional(), place: PlaceId.nullable().optional() })).min(1).max(6),
});
export type DayPlan = z.infer<typeof DayPlan>;

/** The day, told. Three or four sentences in the town's voice, from the record and nothing else. */
/** A child of the island: born to a household, raised by the town, a citizen when they come of age. */
export const Child = z.object({
  id: z.string(), name: z.string(), bornDay: z.number().int(), parents: z.array(AgentId).min(1).max(2), parentNames: z.array(z.string()),
  home: PlaceId, persona: Persona, adoptedBy: z.string().nullable(), orphan: z.boolean(),
});
export type Child = z.infer<typeof Child>;

/** What crosses on the boat between islands: a person, with what they carry and what they remember, and the news from home. */
export const Passenger = z.object({
  from: z.object({ id: z.string(), name: z.string(), url: z.string().optional() }),
  persona: Persona, appearance: z.record(z.string(), z.unknown()).nullable(), owner: z.string().nullable(),
  coins: z.number().int().min(0), inventory: z.array(z.string()),
  carriedItems: z.array(ItemInstance).optional(), equippedItem: z.string().nullable().optional(),
  memories: z.array(z.object({ t: z.number(), text: z.string(), importance: z.number(), kind: z.string() })).max(240),
  opinions: z.array(z.object({ name: z.string(), trust: z.number(), opinion: z.string() })).max(40),
  instructions: z.string(), why: z.string().nullable(),
  news: z.array(z.string()).max(6),
  skills: z.array(TravellingSkill).max(12).optional(),
});
export type Passenger = z.infer<typeof Passenger>;

export const DigestText = z.object({ text: z.string().max(1400), headline: z.string().max(90) });
export type DigestText = z.infer<typeof DigestText>;

export const Perception = z.object({
  type: z.literal("perceive"),
  agent_id: AgentId,
  /** The island's ways: the rules the council has passed that bite, and the sayings it has kept; and the town sheet: where the people this person knows or saw today are right now. */
  town: z.object({ rules: z.array(z.string()), sayings: z.array(z.string()), people: z.array(z.object({ name: z.string(), place: PlaceId, asleep: z.boolean() })).optional(), projects: z.array(CommunityProject.extend({ place: PlaceId })).optional() }).optional(),
  time: z.object({ sim: z.string(), day: z.number().int(), minute: z.number().int(), season: z.string(), weather: z.string(), weekday: z.string().optional(), occasion: z.string().optional(), gathering: z.string().optional(), temperature_c: z.number().optional() }),
  self: z.object({
    belongings: InventoryView.optional(),
    learned_food: z.array(z.object({ place: PlaceId, item: z.string(), confidence: z.number(), observations: z.number() })).optional(),
    location: PlaceId,
    needs: z.object({ hunger: z.number(), rest: z.number(), social: z.number() }),
    coins: z.number().int(),
    inventory: z.array(z.string()),
    job: z.string().nullable(),
    /** The post they hold: where, what it pays, and the hours; null without one. */
    shift: z.object({ place: PlaceId, wage: z.number().int(), hours: z.tuple([z.number().int(), z.number().int()]) }).nullable().optional(),
    /** The needs in words, on a scale that ends in the body failing. */
    feels: z.object({ hunger: z.string(), rest: z.string(), social: z.string() }).optional(),
    debts: z.array(z.object({ to: z.string(), coins: z.number().int(), overdue: z.boolean() })).optional(),
    /** Promises: yours to keep, and the ones made to you. An offered one is waiting on an answer; an open one is owed. */
    deals: z.array(z.object({ id: z.number().int(), with: z.string(), what: z.string(), coins: z.number().int(), mine: z.boolean(), state: z.enum(["offered", "open"]), due_in_days: z.number().int().nullable(), construction: z.object({ site: PlaceId, mornings: z.number().int(), done: z.number().int() }).optional() })).optional(),
    family: z.object({ partner: z.string().nullable(), children: z.array(z.string()) }).optional(),
    /** Days without a proper meal, and whether the body has begun to fail. */
    days_hungry: z.number().int().optional(), weak: z.boolean().optional(),
    mayor: z.boolean().optional(), convictions: z.number().int().optional(),
    /** What this person chose to keep an eye on. */
    watching: z.array(z.string()).optional(),
    /** What they are working toward over weeks, and where each stands. */
    desires: z.array(Desire.pick({ id: true, title: true, why: true, state: true, since: true, updated: true }).extend({ last_attempt: z.object({ t: z.number(), action: z.string(), accepted: z.boolean() }).optional() })).max(5).optional(),
    projects: z.array(z.object({ title: z.string(), progress: z.string(), since_day: z.number().int(), construction: z.object({ site: PlaceId, labor: z.number().int(), needed: z.number().int() }).optional() })).optional(),
    food_advice: z.array(z.object({ from: AgentId, name: z.string(), place: PlaceId, item: z.string(), confidence: z.number(), source_t: z.number(), shared_t: z.number(), trust: z.number(), tested: z.boolean().optional() })).optional(),
    /** What they believe, and how sure they are. Not necessarily true. */
    believes: z.array(z.object({ about: z.string(), belief: z.string(), confidence: z.number() })).optional(),
    /** Secrets learned by going through someone's things, or read in an exposé. Heavy to carry; heavier to use. */
    knows: z.array(z.object({ who: z.string(), secret: z.string() })).optional(),
    skills: z.array(z.object({id:z.string(),recipe:SkillRecipe,attempts:z.number(),successes:z.number(),learned_from:z.string().optional(),trial:z.object({success:z.boolean(),accepted:z.number(),total:z.number()}).optional()})).optional(),
    owns: z.array(z.string()).optional(),
    housing: z.object({ kind: z.string(), nights_left: z.number().int() }).nullable(),
  }),
  nearby: z.array(z.object({
    agent: AgentId, name: z.string(),
    relation: z.object({ trust: z.number(), affection: z.number(), opinion: z.string().optional() }).optional(),
    asleep: z.boolean().optional(),
  })),
  place: z.object({ loose_items: z.array(ItemInstance).optional(), id: PlaceId, name: z.string(), kind: z.string(), for_sale: z.array(z.object({ item: z.string(), price: z.number() })), jobs_open: z.array(z.string()), exits: z.array(PlaceId),
    institution: z.object({name:z.string(),charter:z.string(),founder:z.string(),members:z.array(z.string()),founded:z.number()}).optional(),
    community: CommunityProject.optional(),
    decorations: z.array(Decoration).optional(),
    owner: z.string().nullable().optional(),
    /** For someone who works here: what is in the store room, and whether the place is broken. */
    stock: z.record(z.string(), z.number()).optional(), broken: z.boolean().optional(),
    plot: z.object({ free: z.boolean(), house: z.object({ coins: z.number(), mornings: z.number() }), shop: z.object({ coins: z.number(), mornings: z.number() }), planks: z.number().int().optional() }).optional(),
    site: z.object({ what: z.string(), name: z.string(), by: z.string(), done: z.number(), of: z.number(), worked_today: z.boolean().optional() }).optional(),
    /** At the harbor: the other islands a boat runs to. Leave with `to` to cross; you arrive there with what you carry and what you remember. */
    boats_to: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
    /** What the island calls this place, if it has come to call it something. */
    known_as: z.string().optional(),
    /** Recipes known here: what can be made from what. */
    recipes: z.array(z.object({ item: z.string(), from: z.array(z.string()) })).optional(),
    /** At the council hall: who is mayor, what the treasury holds, what has been built, what the mayor could fund. */
    council: z.object({ mayor: z.string().nullable(), treasury: z.number().int(), works: z.array(z.string()), can_fund: z.array(z.object({ what: z.string(), coins: z.number().int() })), open_laws: z.array(z.string()) }).optional() }),
  heard: z.array(z.object({ from: AgentId, name: z.string(), text: z.string() })),
  recent: z.array(z.string()),
  owner_letters: z.array(z.object({ id: z.number().int(), text: z.string() })),
  hint: z.string().optional(),
  /** Something just happened that whoever sent them would want to hear about; the minute to write home, if they will. */
  crossroads: z.string().optional(),
  today: z.object({ mood: z.string(), goals: z.array(z.string()), steps: z.array(z.object({ hour: z.number().int(), do: z.string(), place: PlaceId.nullable(), done: z.boolean(), missed: z.boolean().optional() })) }).nullable(),
  options: z.array(ActionKind),
  deadline_ms: z.number().int(),
});
export type Perception = z.infer<typeof Perception>;

/** Everything that happens is one of these. */
export const EventKind = z.enum([
  "item.crafted", "item.equipped", "item.stored", "item.retrieved", "item.dropped", "item.picked-up", "item.repaired",
  "agent.fishing", "agent.fishing-ended", "agent.activity",
  "tick.day", "boat.dock", "boat.depart", "agent.arrive", "agent.leave",
  "institution.founded", "institution.joined", "institution.left", "building.repaired", "skill.proposed", "skill.tested", "skill.practiced", "skill.shared",
  "town.wonder", "place.decorated", "project.proposed", "project.contributed", "project.withdrawn", "garden.harvest", "knowledge.shared",
  "agent.move", "agent.say", "agent.give", "agent.take", "agent.trade",
  "agent.work", "agent.hired", "agent.quit", "agent.fired", "agent.sleep", "agent.wake",
  "agent.eat", "agent.rent", "agent.evicted", "agent.reflect", "agent.letter",
  "relation.change", "economy.price", "weather.change", "law.proposed", "law.vote", "law.passed", "law.failed",
  "deal.offered", "deal.accepted", "deal.refused", "deal.kept", "deal.broken",
  "conversation", "action.rejected", "town.notice", "town.book", "town.mayor", "town.works", "town.verdict", "town.gathering", "town.fire", "boat.cargo", "cart.leg", "agent.do", "agent.became", "town.recipe", "town.named", "town.rule", "town.saying", "agent.search", "town.expose", "law.passed", "law.failed", "agent.plan", "agent.build", "town.built", "agent.unpaid", "agent.hire", "agent.lend", "agent.lodge", "agent.debt", "agent.weak", "agent.died", "town.born", "town.of_age", "agent.inherit", "boat.news",
]);
export type EventKind = z.infer<typeof EventKind>;

export const TownEvent = z.object({
  id: z.number().int(),
  t: z.number().int().describe("sim minute since founding"),
  day: z.number().int(),
  kind: EventKind,
  actors: z.array(AgentId),
  place: PlaceId.optional(),
  text: z.string(),
  importance: z.number().min(0).max(1),
  payload: z.record(z.string(), z.unknown()).optional(),
});
export type TownEvent = z.infer<typeof TownEvent>;

/** Nightly reflection, produced by a brain. */
export const Reflection = z.object({
  desires: z.array(DesireUpdate).max(2).optional(),
  summary: z.string().max(1500),
  insights: z.array(z.string().max(600)).max(3),
  opinions: z.array(z.object({ about: AgentRef, opinion: z.string().max(600), trust_delta: z.number().min(-0.3).max(0.3) })).max(5),
  intentions: z.array(z.string().max(240)).max(3),
  letter_to_owner: z.string().max(1200).nullable(),
  /** If the day changed who you are, the parts of yourself you would now write differently. Most nights this is empty. */
  self: z.object({ summary: z.string().max(400).optional(), want: z.string().max(240).optional(), fear: z.string().max(240).optional(), strangers: z.string().max(240).optional(), advice: z.string().max(240).optional() }).optional(),
  /** What you mean to keep an eye on: a few names of people, places or things. Your attention goes where you put it. */
  watch: z.array(z.string().max(60)).max(4).optional(),
  /** The things you are working toward over weeks, in your own words, with where they stand tonight. Repeat a title to update it; mark it done when it is. */
  projects: z.array(z.object({ title: z.string().max(80), why: z.string().max(200).optional(), progress: z.string().max(240).optional(), done: z.boolean().optional() })).max(3).optional(),
  /** What you have come to believe about the world and the people in it, with how sure you are. A belief repeated is strengthened; one unmentioned fades. */
  beliefs: z.array(z.object({ about: z.string().max(60), belief: z.string().max(200), confidence: z.number().min(0).max(1) })).max(4).optional(),
  /** A phrase of yours, if you have one: something you find yourself saying. When two people say the same, the island keeps it. */
  saying: z.string().max(80).optional(),
});
export type Reflection = z.infer<typeof Reflection>;

/** A short exchange between two agents, produced in one call when no human is present. */
export const Dialogue = z.object({
  lines: z.array(z.object({ speaker: AgentRef, text: z.string().max(400) })).min(1).max(8),
  outcome: z.object({
    a_trust_delta: z.number().min(-0.2).max(0.2),
    b_trust_delta: z.number().min(-0.2).max(0.2),
    a_remember: z.string().max(400),
    b_remember: z.string().max(400),
    rumor: z.string().max(600).nullable(),
  }),
});
export type Dialogue = z.infer<typeof Dialogue>;

/** The Gazette. */
/** The picture on the front page: the engine chooses the moment from the record; the reader's screen paints it. */
export const PaperScene = z.object({ place: z.string(), placeName: z.string(), sprite: z.string(), actors: z.array(z.string()).max(4), hour: z.number().int(), weather: z.string(), caption: z.string().max(200) });
export type PaperScene = z.infer<typeof PaperScene>;
export const Paper = z.object({
  edition: z.number().int(),
  date: z.string(),
  weather: z.string(),
  lead: z.object({ headline: z.string().max(120), deck: z.string().max(240), body: z.string().max(2600) }),
  briefs: z.array(z.object({ headline: z.string().max(120), body: z.string().max(1200) })).max(4),
  notices: z.array(z.string().max(240)).max(6),
  /** The standing columns: the shelf and its prices, the boat and who came and went, and what tomorrow holds. */
  market: z.string().max(420).optional(),
  harbor: z.string().max(420).optional(),
  tomorrow: z.string().max(240).optional(),
  scene: PaperScene.optional(),
  /** The day's seal: a hash of every event of the day, chained to the day before. Anyone with the record can recompute it. */
  seal: z.object({ day: z.number().int(), hash: z.string(), prev: z.string(), events: z.number().int() }).optional(),
});
export type Paper = z.infer<typeof Paper>;

/** The written life: what the town says of someone once they have left it, for good or on the boat. */
export const LifeText = z.object({ title: z.string().max(90), text: z.string().max(4400), epitaph: z.string().max(140) });
export type LifeText = z.infer<typeof LifeText>;

export const OPTIONS_DEFAULT: ActionKind[] = ["move", "say", "give", "take", "use", "work", "apply", "quit", "trade", "propose", "vote", "write", "message_owner", "sleep", "wait", "do"];
/** What the town's own mind decides a free deed came to. Bounded: coins can only be spent, never made. */
export const Judgement = z.object({
  happened: z.string().max(240),
  plausible: z.boolean(),
  coins_spent: z.number().int().min(0).max(20).default(0),
  item_gained: z.string().max(24).nullable().default(null),
  item_lost: z.string().max(24).nullable().default(null),
  eases: z.enum(["hunger", "rest", "social"]).nullable().default(null),
  trust: z.array(z.object({ who: AgentRef, delta: z.number().min(-0.2).max(0.2) })).max(3).default([]),
});
export type Judgement = z.infer<typeof Judgement>;
/** A public construction record. No thoughts, memories or owner messages belong here. */
export type BuildingMoment = {
  sequence: number; t: number; day: number;
  kind: "started" | "worked" | "finished" | "offered" | "accepted" | "refused" | "paid" | "broken";
  text: string; labor: number;
  people: { id: string; name: string }[];
  deal?: number; coins?: number;
};
export type BuildingHistory = {
  place: string; name: string; project: string; what: "house" | "shop" | "garden";
  builder: { id: string; name: string }; needed: number; started: number;
  landCoins: number; materialCoins: number; planks: number;
  moments: BuildingMoment[];
};
export type BuildingReplay = {
  town: string; source: string;
  size: { w: number; h: number };
  buildings: { x: number; y: number; district: string; history: BuildingHistory }[];
};
export function constructionStage(labor: number, needed: number): string {
  const progress = labor / Math.max(1, needed);
  return progress >= 1 ? "Built" : progress >= 0.8 ? "Roof going on" : progress >= 0.3 ? "Walls rising" : "Foundations";
}

/** A rare natural phenomenon, shared by perception and rendering; never a staged citizen action. */
export function coastalWonder(day: number, hour: number, season: string, weather: string): boolean {
  const eveningDay = hour < 3 ? day - 1 : day;
  return Number.isInteger(day) && day > 0 && eveningDay % 5 === 4 && (hour >= 21 || hour < 3) && season === "summer" && (weather === "clear" || weather === "wind");
}
