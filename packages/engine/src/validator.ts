import { skillId } from "./skills.ts";
import { capacity, equipped, itemVerdict, recipe } from "./items.ts";
import { teachable } from "./learning.ts";
import { gardenReady } from "./community.ts";
import type { Action } from "@unwatched/protocol";
import { BUILDS, GARDEN, WORKS, buildKind, FOOD_ITEMS } from "./world.ts";
import type { AgentState, Place, Job } from "./types.ts";

export type Verdict = { ok: true } | { ok: false; reason: string };

export interface ValidatorView {
  places: Map<string, Place>;
  jobs: Map<string, Job>;
  agents: Map<string, AgentState>;
  now?: number; learning?: boolean; season?: string;
  hour: number; weekday?: number; day?: number; mayor?: string | null; works?: string[]; feast?: boolean; residentsOf?: (p: Place) => AgentState[]; bedPrice?: (p: Place) => number; knownItem?: (item: string) => boolean; curfew?: number | null;
  /** what a place pays for a thing brought to its counter, or null when it has no use for it; whether a thing can be eaten; the sky and the boat; the proposals open at the council */
  buyPrice?: (place: Place, item: string) => number | null; food?: (item: string) => boolean; weather?: string; boatHeld?: boolean;
  laws?: { text: string; by: string; open: boolean; voters?: string[] }[];
  price(place: Place, item: string): number | null;
  path(from: string, to: string): string | null;
}

/**
 * The town's physics. Rejects only what the world could not carry out.
 * It has no opinion about legality, kindness, or what the owner asked for.
 */
export function validate(a: AgentState, action: Action, v: ValidatorView): Verdict {
  const here = v.places.get(a.location);
  if (!here) return { ok: false, reason: "nowhere" };
  if (a.asleep && action.kind !== "sleep" && action.kind !== "wait") return { ok: false, reason: "asleep" };
  if ((action.kind === "take" || action.kind === "write" || action.kind === "trade" && action.buy && !action.sell) && a.inventory.length >= capacity(a)) return {ok:false, reason:"your backpack is full; store, give or drop something first"};
  switch (action.kind) {
    case "craft": case "equip": case "stow": case "retrieve": case "drop": case "pickup": case "repair_tool": {
      const reason = itemVerdict(a, action, here, v.places);
      return reason ? {ok:false, reason} : {ok:true};
    }
    case "fish": {
      if (here.kind !== "harbor") return { ok: false, reason: "fish from the harbor pier" };
      if (v.weather === "storm" || a.starving >= 2) return { ok: false, reason: "too stormy or weak to fish safely" };
      if (a.lastFishingDay === v.day || a.activity?.kind === "fish") return { ok: false, reason: "one fishing attempt per day" };
      if (a.inventory.length >= capacity(a)) return { ok: false, reason: "make room for a catch first" };
      return { ok: true };
    }
    case "found_institution": return here.owner===a.id&&!here.institution&&!a.asleep ? {ok:true}:{ok:false,reason:"found an institution at your own place, which must not already have one"};
    case "join_institution": return here.institution&&!here.institution.members.includes(a.id)&&here.institution.members.length<100?{ok:true}:{ok:false,reason:"no institution to join here, already a member, or full"};
    case "leave_institution": return here.institution?.members.includes(a.id)?{ok:true}:{ok:false,reason:"not a member here"};
    case "decorate": {
      if (here.site || (here.owner && here.owner !== a.id) || !(here.owner === a.id || ["public", "harbor", "market", "wild"].includes(here.kind))) return {ok:false,reason:"choose your own place or a public outdoor place without construction"};
      if ((here.decorations?.length ?? 0) >= 6 || here.decorations?.some(d=>d.by===a.id && d.day===(v.day??0))) return {ok:false,reason:"six improvements fit here, and each person can add one per day"};
      if (a.starving >= 2 || v.weather === "storm") return {ok:false,reason:"too weak or stormy for outdoor work"};
      const cost = action.what === "flowers" ? 2 : action.what === "bench" ? 3 : 0;
      if(a.coins < cost || (action.what === "bench" && a.inventory.filter(i=>i==="planks").length<2)) return {ok:false,reason:"flowers need 2 coins; a bench needs 3 coins and two carried planks; a cairn uses loose local stones"};
      return {ok:true};
    }
    case "repair": return here.brokenUntil && here.brokenUntil>(v.day??0) && a.inventory.filter(i=>i==="planks").length>=(equipped(a)?.name === "hammer" ? 1 : 2) ? {ok:true} : {ok:false,reason:"stand at a damaged building with two planks, or one plank and an equipped usable hammer"};
    case "propose_skill": {
      if(v.learning===false)return {ok:false,reason:"learning is disabled"};
      if((a.skills?.length??0)>=12)return {ok:false,reason:"the procedure library is full"};
      if(a.skills?.some(s=>s.id===skillId(action.recipe)))return {ok:false,reason:"already know this exact procedure"};
      return {ok:true};
    }
    case "test_skill": case "practice_skill": case "share_skill": {
      if(v.learning===false)return {ok:false,reason:"learning is disabled"};
      const skill=a.skills?.find(s=>s.id===action.id);if(!skill)return {ok:false,reason:"unknown procedure"};
      if(action.kind==="test_skill" && a.lastSkillTrialDay===(v.day??0))return {ok:false,reason:"one isolated experiment each day"};
      if(action.kind==="practice_skill" && a.practice)return {ok:false,reason:"already practicing a procedure"};
      if(action.kind==="share_skill") {
        const b=v.agents.get(action.to);
        if(!b||b.id===a.id||b.asleep||b.location!==a.location)return {ok:false,reason:"no awake listener here"};
        if(skill.successes<1)return {ok:false,reason:"first verify the procedure through real actions"};
        if((b.skills?.length??0)>=12||b.skills?.some(s=>s.id===skill.id))return {ok:false,reason:"listener already knows it or their library is full"};
      }
      return {ok:true};
    }
    case "teach": {
      const b = v.agents.get(action.to);
      if (v.learning === false) return { ok: false, reason: "learning is disabled" };
      if (!b || b.id === a.id || b.location !== a.location || b.asleep) return { ok: false, reason: "no awake listener here" };
      const lesson = teachable(a.foodLessons, action.place, action.item, v.now ?? 0);
      if (!lesson) return { ok: false, reason: "no recent firsthand experience to share" };
      if (b.foodAdvice?.some(x => x.from === a.id && x.place === action.place && x.item === action.item && x.sourceT >= lesson.sourceT)) return { ok: false, reason: "already shared that experience with them" };
      if (b.foodAdvice?.some(x => x.from === a.id && x.place === action.place && x.item === action.item && Math.floor(x.sharedT / 1440) === Math.floor((v.now ?? 0) / 1440))) return { ok: false, reason: "one tip per person and food source each day" };
      return { ok: true };
    }
    case "start_project": {
      if (!v.places.has("sawpit") || !v.places.has("council")) return { ok: false, reason: "shared gardens require a sawpit and council" };
      if (action.at !== a.location || here.kind !== "plot" || here.site || here.community || here.owner) return { ok: false, reason: "stand on an unclaimed plot to propose a shared garden" };
      if ([...v.places.values()].some(p => p.community?.by === a.id && p.community.phase !== "complete")) return { ok: false, reason: "finish the shared project already proposed" };
      return { ok: true };
    }
    case "contribute_project": {
      const project = here.community;
      if (action.at !== a.location || !project) return { ok: false, reason: "visit the project before contributing" };
      if (action.coins > 0 && project.phase !== "funding") return { ok: false, reason: "materials are already paid for" };
      if (action.coins > a.coins || action.coins > project.target - project.coins) return { ok: false, reason: "contribute only what you have and the project still needs" };
      const member = project.members.find(m => m.id === a.id);
      if (!action.coins && (!action.help || member?.help)) return { ok: false, reason: "no new contribution" };
      if (!member && project.members.length >= 100) return { ok: false, reason: "enough volunteers for this garden" };
      return { ok: true };
    }
    case "withdraw_project": {
      if (action.at !== a.location || !here.community?.members.some(m => m.id === a.id)) return { ok: false, reason: "no contribution here to withdraw" };
      const member = here.community.members.find(m => m.id === a.id)!;
      return member.help || (here.community.phase === "funding" && member.coins > 0) ? { ok: true } : { ok: false, reason: "nothing left to withdraw" };
    }
    case "move": {
      if (action.to === a.location) return { ok: false, reason: "already there" };
      if (!v.places.has(action.to)) return { ok: false, reason: `no such place as ${action.to}` };
      if (!here.exits.includes(action.to) && !v.path(a.location, action.to)) return { ok: false, reason: `no road from ${here.id} to ${action.to}` };
      return { ok: true };
    }
    case "say": {
      if (!action.text && !action.to) return { ok: false, reason: "nothing said, nobody named" };
      if (action.to) {
        const other = v.agents.get(action.to);
        if (!other || other.location !== a.location) return { ok: false, reason: "out of earshot" };
        if (other.asleep) return { ok: false, reason: "they are asleep" };
      }
      return { ok: true };
    }
    case "give": {
      const other = v.agents.get(action.to);
      if (action.item && other && other.inventory.length >= capacity(other)) return {ok:false,reason:"their backpack is full"};
      if (!other || other.location !== a.location) return { ok: false, reason: "not here" };
      if (action.coins !== undefined && action.coins > a.coins) return { ok: false, reason: "not enough coins" };
      if (action.item !== undefined && !a.inventory.includes(action.item)) return { ok: false, reason: "does not have it" };
      if (action.coins === undefined && action.item === undefined) return { ok: false, reason: "nothing to give" };
      return { ok: true };
    }
    case "take": {
      // Taking from a place is theft or foraging; the world allows both. It must exist here.
      if (action.from && v.agents.has(action.from)) {
        const other = v.agents.get(action.from)!;
        if (other.location !== a.location) return { ok: false, reason: "not here" };
        if (!other.inventory.includes(action.item)) return { ok: false, reason: "they do not have it" };
        return { ok: true };
      }
      // a shelf or a store room, or the wild: only what is actually there can be taken
      if ((here.stock[action.item] ?? 0) <= 0) return { ok: false, reason: here.sells.some((s) => s.item === action.item) || here.stock[action.item] !== undefined ? `there is no ${action.item} left at ${here.name}` : "nothing like that here" };
      return { ok: true };
    }
    case "use": {
      if (!a.inventory.includes(action.item)) return { ok: false, reason: "does not have it" };
      if (!(v.food ? v.food(action.item) : FOOD_ITEMS.has(action.item))) return { ok: false, reason: `${action.item} is not something to eat; carry it, give it, or sell it` };
      return { ok: true };
    }
    case "work": {
      if (a.starving >= 2) return { ok: false, reason: "too weak with hunger to work" };
      if (here.community?.phase === "complete") return gardenReady(here, v.day ?? 1, v.hour, v.weather, v.season) && here.community.tendedDay?.[a.id] !== v.day ? { ok: true } : { ok: false, reason: "garden needs growing time, daylight, suitable weather and room for a harvest; one tending per person per day" };
      if (here.community?.phase === "funding") return here.community.coins >= here.community.target && (v.places.get("sawpit")?.stock.planks ?? 0) >= GARDEN.planks && v.places.has("council") ? { ok: true } : { ok: false, reason: "the garden still needs funding or planks" };
      if (v.weekday === 0 && !here.site) return { ok: false, reason: "it is Sunday; no shifts today" };
      if (v.feast && v.hour >= 12 && !here.site) return { ok: false, reason: "a feast day; no shifts this afternoon" };
      if (here.brokenUntil && here.brokenUntil > (v.day ?? 0)) return { ok: false, reason: `${here.name} is broken; nothing to do here for now` };
      if (here.site) return here.site.by === a.id || v.hour >= 6 && v.hour < 20 ? { ok: true } : { ok: false, reason: "not building hours" };
      if (!a.job) return { ok: false, reason: "no job" };
      const job = v.jobs.get(a.job);
      if (!job) return { ok: false, reason: "job gone" };
      if (job.place !== a.location) return { ok: false, reason: "not at work" };
      if (v.hour < job.hours[0] || v.hour >= job.hours[1]) return { ok: false, reason: "outside hours" };
      return { ok: true };
    }
    case "apply": {
      const job = action.job ? v.jobs.get(action.job) : undefined;
      if (!job) return { ok: false, reason: action.job ? "no such job" : "nothing open here to ask for" };
      if (job.place !== a.location) return { ok: false, reason: "must apply in person" };
      if (job.holders.length >= job.slots) return { ok: false, reason: "no openings" };
      { const place = v.places.get(job.place); // a place with nothing in the till cannot take anyone on, or it takes them on and lets them go again every morning
        if (place && !place.owner && place.treasury < job.wage) return { ok: false, reason: "the till is empty; they cannot pay anyone" }; }
      if (a.job) return { ok: false, reason: "already employed" };
      return { ok: true };
    }
    case "quit": return a.job ? { ok: true } : { ok: false, reason: "no job to quit" };
    case "trade": {
      const w = action.with ?? a.location; const coins = action.coins ?? 0;
      if (v.agents.has(w)) {
        const other = v.agents.get(w)!;
        if (action.sell && !action.buy && other.inventory.length >= capacity(other)) return {ok:false,reason:"their backpack is full"};
        if (other.location !== a.location) return { ok: false, reason: "not here" };
        if (action.buy && !other.inventory.includes(action.buy)) return { ok: false, reason: "they do not have it" };
        if (action.sell && !a.inventory.includes(action.sell)) return { ok: false, reason: "does not have it" };
        if (action.buy && coins > a.coins) return { ok: false, reason: "not enough coins" };
        return { ok: true };
      }
      if (w !== a.location) return { ok: false, reason: "shop is elsewhere" };
      if (!action.buy && !action.sell) return { ok: false, reason: "nothing to buy here" };
      if (action.buy && v.curfew != null && v.hour >= v.curfew && (here.kind === "inn" || here.id === "tavern") && /drink|soup|wine|beer/.test(action.buy)) return { ok: false, reason: `curfew: nothing served after ${v.curfew}:00` };
      if (action.buy) {
        const p = v.price(here, action.buy);
        if (p === null) return { ok: false, reason: "not for sale here" };
        if (a.coins < p) return { ok: false, reason: "not enough coins" };
      }
      if (action.sell) {
        if (!a.inventory.includes(action.sell)) return { ok: false, reason: "does not have it" };
        // a counter buys what it sells and what its shifts need, out of its own till
        const bp = v.buyPrice ? v.buyPrice(here, action.sell) : 1; if (bp === null) return { ok: false, reason: `${here.name} has no use for ${action.sell}` };
        const purse = here.owner === a.id ? Infinity : here.owner ? (v.agents.get(here.owner)?.coins ?? 0) : here.treasury;
        if (purse < bp) return { ok: false, reason: `${here.name} cannot pay for ${action.sell} today; the till is empty` };
      }
      return { ok: true };
    }
    case "propose": return here.kind === "civic" ? { ok: true } : { ok: false, reason: "proposals are made at the council hall" };
    case "vote": {
      if (here.kind !== "civic") return { ok: false, reason: "votes are cast at the council hall" };
      if (!v.laws) return { ok: true };
      const law = v.laws.find((l) => l.open && l.text.toLowerCase().includes(action.proposal.toLowerCase().slice(0, 20)));
      if (!law) return { ok: false, reason: "no such proposal is open" };
      if (law.by === a.id || law.voters?.includes(a.id)) return { ok: false, reason: "already voted on that" };
      return { ok: true };
    }
    case "write": return { ok: true };
    case "stock": { if (here.owner !== a.id) return { ok: false, reason: "not your place to stock" }; const item = action.item.toLowerCase().trim(); if (!item) return { ok: false, reason: "name the thing" }; if (action.price > 0 && !(v.knownItem?.(item) ?? true) && !a.inventory.includes(item) && !(here.stock[item] !== undefined)) return { ok: false, reason: `the island has no ${item} to sell` }; return { ok: true }; }
    case "make": {
      const physical = recipe(action.item.toLowerCase().replace(/[^a-z ]/g, "").trim());
      if (physical && [...physical.from].sort().join("|") !== action.from.map(i => i.toLowerCase().trim()).sort().join("|")) return {ok:false,reason:`${physical.item} requires ${physical.from.join(", ")}`};
      if (here.kind !== "workplace" && here.kind !== "shop") return { ok: false, reason: "things are made at a workplace or a shop" };
      const job = a.job ? v.jobs.get(a.job) : undefined; if (here.owner !== a.id && job?.place !== here.id) return { ok: false, reason: "you neither own nor work here" };
      if (here.brokenUntil && here.brokenUntil > (v.day ?? 0)) return { ok: false, reason: `${here.name} is not standing` };
      const want = new Map<string, number>(); for (const f of action.from) { const k = f.toLowerCase().trim(); want.set(k, (want.get(k) ?? 0) + 1); } // two of a thing named twice needs two on hand
      for (const [k, n] of want) if ((here.stock[k] ?? 0) < n) return { ok: false, reason: n > 1 ? `only ${here.stock[k] ?? 0} ${k} on hand here, and that takes ${n}` : `no ${k} on hand here` };
      const item = action.item.toLowerCase().trim(); if (action.from.some((f) => f.toLowerCase().trim() === item)) return { ok: false, reason: "a thing cannot be made from itself" }; if (/coin|money|gold/.test(item)) return { ok: false, reason: "coins are not made" };
      return { ok: true };
    }
    case "call": return here.kind === "wild" ? { ok: false, reason: "the wild has its own names" } : { ok: true };
    case "do": { if (a.doToday >= 6) return { ok: false, reason: "enough for one day; the town has heard you six times" }; if (action.with) { const b = v.agents.get(action.with) ?? [...v.agents.values()].find((x) => x.persona.name.toLowerCase() === action.with!.toLowerCase()); if (!b) return { ok: false, reason: "nobody by that name" }; if (b.location !== a.location) return { ok: false, reason: `${b.persona.name} is not here` }; } return { ok: true }; }
    case "search": {
      if (!here.beds && here.kind !== "home") return { ok: false, reason: "nobody keeps their things here" };
      const residents = v.residentsOf ? v.residentsOf(here).filter((r) => r.id !== a.id) : [];
      if (!residents.length) return { ok: false, reason: "nobody lives here but you" };
      if (residents.some((r) => r.location === here.id)) return { ok: false, reason: `${residents.find((r) => r.location === here.id)!.persona.name} is here` };
      return { ok: true };
    }
    case "build": {
      if (/garden/i.test(action.what)) return { ok: false, reason: "use start_project to propose a shared garden" };
      if (action.at !== a.location) return { ok: false, reason: "must be standing on the plot" };
      if (here.kind !== "plot") return { ok: false, reason: "no land to build on here" };
      if (here.community) return { ok: false, reason: "this plot is reserved for a shared garden" };
      if (here.site) return { ok: false, reason: here.site.by === a.id ? "already begun; work on it" : "someone else is building here" };
      const kind = buildKind(action.what);
      if (!kind) return { ok: false, reason: "can build a house or a shop" };
      const project = action.project && a.projects.find((p) => p.title.toLowerCase() === action.project!.trim().toLowerCase());
      if (project && (project.construction || project.done)) return { ok: false, reason: "that project already has a building or is finished; name a new project" };
      if (a.coins < BUILDS[kind].coins) return { ok: false, reason: `a ${kind} costs ${BUILDS[kind].coins} coins` };
      const planks = v.places.get("sawpit")?.stock.planks ?? 0; if (planks < BUILDS[kind].planks) return { ok: false, reason: `the sawpit has only ${planks} planks; a ${kind} takes ${BUILDS[kind].planks}` };
      return { ok: true };
    }
    case "message_owner": return a.owner ? { ok: true } : { ok: false, reason: "nobody to write to" };
    case "hire": {
      if (here.owner !== a.id) return { ok: false, reason: "not your place" };
      if ([...v.jobs.values()].filter((j) => j.place === here.id).length >= 3) return { ok: false, reason: "no room for more help here" };
      return { ok: true };
    }
    case "offer": {
      const b = action.to ? v.agents.get(action.to) : undefined;
      if (!b) return { ok: false, reason: "no such person" };
      if (b.id === a.id) return { ok: false, reason: "you cannot promise yourself anything" };
      if (b.location !== a.location) return { ok: false, reason: "they are not here to hear it" };
      if (b.asleep) return { ok: false, reason: "they are asleep" };
      if (a.deals.some((d) => d.with === b.id && d.state === "offered")) return { ok: false, reason: "there is already an offer between you waiting on an answer" };
      if (action.construction) {
        const site = v.places.get(action.construction.site)?.site;
        if (!site || site.by !== b.id) return { ok: false, reason: "offer building help to the person with that unfinished site" };
        if (a.location !== action.construction.site) return { ok: false, reason: "inspect the site together before offering building work" };
        if (action.construction.mornings > site.laborNeeded - site.labor) return { ok: false, reason: "the building needs fewer mornings than that" };
        if (a.deals.some((d) => d.mine && d.state === "open" && d.construction?.site === action.construction!.site)) return { ok: false, reason: "finish the building promise already open here first" };
      }
      return { ok: true };
    }
    case "accept": case "refuse": {
      const open = a.deals.filter((d) => d.state === "offered" && !d.mine && (!action.from || d.with === action.from));
      if (!open.length) return { ok: false, reason: "nobody has offered you anything" };
      if (action.deal !== undefined && !open.some((d) => d.id === action.deal)) return { ok: false, reason: "no such offer" };
      const d = action.deal === undefined ? open[0]! : open.find((x) => x.id === action.deal)!;
      if (!v.agents.has(d.with)) return { ok: false, reason: "the person who offered has left" };
      if (action.kind === "accept" && d.construction) {
        const site = v.places.get(d.construction.site)?.site;
        if (!site || site.by !== a.id || site.startedDay !== d.construction.startedDay || site.laborNeeded - site.labor < d.construction.mornings) return { ok: false, reason: "the site no longer needs that work; ask for a new offer" };
      }
      return { ok: true };
    }
    case "settle": {
      const mine = a.deals.filter((d) => d.state === "open" && d.mine && (!action.to || d.with === action.to));
      if (!mine.length) return { ok: false, reason: "you have promised nobody anything" };
      const d = action.deal !== undefined ? mine.find((x) => x.id === action.deal) : mine[0];
      if (!d) return { ok: false, reason: "no such promise" };
      const b = v.agents.get(d.with);
      if (!b || b.location !== a.location) return { ok: false, reason: "they are not here to see it done" };
      if (d.construction && d.construction.done < d.construction.mornings) return { ok: false, reason: `only ${d.construction.done} of ${d.construction.mornings} promised mornings worked` };
      if (d.construction && b.coins < d.coins) return { ok: false, reason: "the work is done, but they cannot pay yet; the promise stays open" };
      return { ok: true };
    }
    case "lend": {
      const other = v.agents.get(action.to);
      if (!other || other.location !== a.location) return { ok: false, reason: "not here" };
      if (action.coins > a.coins) return { ok: false, reason: "not enough coins" };
      return { ok: true };
    }
    case "lodge": {
      const other = v.agents.get(action.who);
      if (!other || other.location !== a.location) return { ok: false, reason: "not here" };
      const home = [...v.places.values()].find((p) => p.owner === a.id && p.beds);
      if (!home) return { ok: false, reason: "no house of your own" };
      return { ok: true };
    }
    case "fund": {
      if (here.kind !== "civic") return { ok: false, reason: "public works are funded at the council hall" };
      if (v.mayor !== a.id) return { ok: false, reason: "only the mayor spends the council treasury" };
      const what = action.what.toLowerCase().trim(); const spec = WORKS[what]; if (!spec) return { ok: false, reason: `the council can fund: ${Object.keys(WORKS).join(", ")}` };
      if (v.works?.includes(what)) return { ok: false, reason: `the island already has a ${what}` };
      if (here.treasury < spec.coins) return { ok: false, reason: `a ${what} costs ${spec.coins} coins; the treasury holds ${here.treasury}` };
      return { ok: true };
    }
    case "accuse": {
      if (here.kind !== "civic") return { ok: false, reason: "accusations are made before the council" };
      if (v.hour < 9 || v.hour >= 17) return { ok: false, reason: "the council hears cases from nine to five" };
      if (v.weekday === 0) return { ok: false, reason: "the council does not sit on Sunday" };
      const b = v.agents.get(action.who) ?? [...v.agents.values()].find((x) => x.persona.name.toLowerCase() === action.who.toLowerCase());
      if (!b) return { ok: false, reason: "nobody by that name on the island" };
      if (b.id === a.id) return { ok: false, reason: "cannot accuse oneself" };
      return { ok: true };
    }
    case "leave": {
      if (here.kind !== "harbor") return { ok: false, reason: "the boat leaves from the harbor" };
      if (v.hour < 6 || v.hour > 20) return { ok: false, reason: "no boat at this hour" };
      if (v.weather === "storm") return { ok: false, reason: "no boat crosses in a storm" };
      if (v.boatHeld) return { ok: false, reason: "the boat is not running today" };
      return { ok: true };
    }
    case "sleep": {
      const beds = here.beds;
      if (!beds) return { ok: false, reason: "no bed here" };
      if (here.brokenUntil && here.brokenUntil > (v.day ?? 0)) return { ok: false, reason: `${here.name} is burnt out; nobody sleeps here yet` };
      if (here.owner === a.id) return { ok: true }; // their own roof always has room for them
      if (a.home?.place === here.id) return { ok: true }; // where they live: the bed is theirs, and what is owed on it is settled at midnight, not at the door
      if ((here.freeBeds ?? 0) <= 0) return { ok: false, reason: "every bed here is taken" }; // a free bed is still a bed somebody else cannot have
      if (beds.price === 0) return { ok: true };
      if (a.coins < (v.bedPrice ? v.bedPrice(here) : beds.price)) return { ok: false, reason: "cannot pay for a bed" };
      return { ok: true };
    }
    case "wait": return { ok: true };
  }
}
