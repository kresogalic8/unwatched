import type { LifeText, Judgement, ActionProposal, DayPlan, DigestText, Dialogue, Paper, Perception, Persona, Reflection } from "@unwatched/protocol";
import type { AgentState, Brain, ConverseContext, PaperContext, ReflectContext, Tier, PlanContext, DigestContext, ChildContext, LifeContext, JudgeContext } from "@unwatched/engine";
import { Rng } from "@unwatched/engine";

/**
 * A mind that costs nothing. Deterministic given the seed, opinionated enough to make a town.
 * It exists so the engine can be soaked for a week without a model, and as the fallback for own-brains that miss a turn.
 */
export class MockBrain implements Brain {
  readonly name = "mock";
  private rng: Rng;
  constructor(seed = 7) { this.rng = new Rng(seed); }

  async decide(p: Perception, a: AgentState, _tier: Tier): Promise<ActionProposal> {
    const tr = a.persona.traits;
    // A letter was read this morning: take it, resent it, or ignore it, by persona.
    if (p.owner_letters.length > 0) {
      const l = p.owner_letters[0]!;
      const follows = this.rng.next() < 0.5 + (0.5 - tr.pride) * 0.6;
      if (!follows && tr.pride > 0.7 && this.rng.chance(0.3)) return { action: { kind: "message_owner", text: `I read what you wrote. "${l.text.slice(0, 40)}" I will decide that for myself.` }, remember: [`Whoever sent me wrote: "${l.text}". I did not care for the tone.`] };
      return { action: { kind: "wait" }, remember: [`Whoever sent me wrote: "${l.text}". ${follows ? "I will keep it in mind." : "Noted."}`] };
    }
    // A letter that asked something: the town has set a crossroads; answer it, in this person's voice.
    if (p.crossroads && /asks something of you/.test(p.crossroads) && a.owner) return { action: { kind: "message_owner", text: `You asked. ${p.self.feels?.hunger === "fed" ? "I am fed" : "I have eaten what I could"}, I have ${p.self.coins} coins${p.self.job ? ` and work as ${p.self.job}` : " and no work yet"}. ${tr.pride > 0.6 ? "I will do it my way, but I heard you." : "I will do as you say, as far as the island lets me."}` }, remember: ["I wrote back to whoever sent me."] };
    // Standing on land for sale with the coins and no roof: build.
    if (p.place.plot?.free && (p.place.plot.planks ?? 6) >= 6 && (p.self.housing === null || p.self.housing.nights_left === 0) && p.self.coins >= p.place.plot.house.coins && (tr.ambition > 0.4 || this.rng.chance(0.3))) return { action: { kind: "build", what: "house", at: p.place.id }, intent: "a roof of my own", remember: ["I bought the land. Now the work."] };
    if (p.place.site) return { action: { kind: "work" }, intent: "raise the frame", remember: [] };
    // Broke and jobless: ask for work, or do something desperate.
    if (p.self.job === null && p.place.jobs_open.length > 0) {
      const job = this.rng.pick(p.place.jobs_open);
      return { action: { kind: "apply", job }, intent: "find honest work", remember: [] };
    }
    if (p.self.coins <= 3 && p.self.job === null) {
      if (tr.honesty < 0.35 && p.place.for_sale.length > 0 && this.rng.chance(0.4)) {
        const it = this.rng.pick(p.place.for_sale);
        return { action: { kind: "take", item: it.item }, intent: "eat", remember: ["I took what I needed. I will not think about it."] };
      }
      if (a.owner && this.rng.chance(0.35)) return { action: { kind: "message_owner", text: `I am down to ${p.self.coins} coins and there is no work at ${p.place.name}. I am not asking for coins. I am asking what you would do.` }, remember: [] };
      const exit = this.rng.pick(p.place.exits);
      return { action: { kind: "move", to: exit }, intent: "look for work elsewhere", remember: [] };
    }
    // Someone spoke and is still here and awake: answer. Words to an empty room are not worth the minute.
    const awake = p.nearby.filter((n) => !n.asleep);
    const spoken = [...p.heard].reverse().find((h) => awake.some((n) => n.agent === h.from));
    if (spoken) {
      const h = spoken;
      const rel = p.nearby.find((n) => n.agent === h.from)?.relation;
      const cold = rel && rel.trust < 0.25;
      const text = cold ? this.rng.pick(["I have nothing to say to you.", "Not now.", "Say that again and mean it."]) : this.rng.pick([`Morning, ${h.name.split(" ")[0]}.`, "Is that so.", "You heard that from Rosa, I suppose.", "The boat was late again.", `${a.persona.want.split(".")[0]}. That is all I want.`]);
      return { action: { kind: "say", to: h.from, text }, remember: [`${h.name} said "${h.text.slice(0, 60)}" and I answered.`] };
    }
    // Intentions from last night.
    if (a.intentions.length > 0 && this.rng.chance(0.5)) {
      const i = a.intentions[0]!;
      if (/quit/i.test(i) && p.self.job) return { action: { kind: "quit" }, intent: i, remember: ["I did what I said I would."] };
      if (/council|propose/i.test(i) && p.place.kind === "civic") return { action: { kind: "propose", law: `No rent may rise mid-lease. Proposed by ${a.persona.name}.` }, intent: i, remember: [] };
      if (/council|propose/i.test(i) && p.place.exits.includes("council")) return { action: { kind: "move", to: "council" }, intent: i, remember: [] };
    }
    // Ambition: quit a poor job now and then, out of pride.
    if (p.self.job && tr.pride > 0.75 && tr.ambition > 0.7 && this.rng.chance(0.02)) return { action: { kind: "quit" }, intent: "this was never going to be it", remember: ["I folded the apron on the counter and left."] };
    if (awake.length > 0 && this.rng.chance(0.5)) {
      const n = this.rng.pick(awake);
      return { action: { kind: "say", to: n.agent, text: this.rng.pick(["Any work going?", "Did you hear about the mill?", "The bread is two coins now. Two.", "You look like you slept badly.", "Who is that surveyor, really?"]) }, remember: [] };
    }
    return { action: { kind: "wait" }, remember: [] };
  }

  async converse(ctx: ConverseContext): Promise<Dialogue> {
    const { a, b } = ctx;
    const ra = a.relationships.get(b.id)?.trust ?? 0.3;
    const rb = b.relationships.get(a.id)?.trust ?? 0.3;
    const heat = (a.persona.traits.pride + b.persona.traits.pride) / 2;
    const argue = (ra < 0.3 || rb < 0.3) && this.rng.chance(0.25 + heat * 0.4);
    const warm = !argue && this.rng.chance(0.5 + (a.persona.traits.warmth + b.persona.traits.warmth) / 4);
    const topic = this.rng.pick(["the mill roof", "the surveyor", "the price of bread", "the election", "the last boat", "Rosa's ledger", "the room above the chandlery"]);
    const lines = argue ? [
      { speaker: a.id, text: `You had a good thing and you threw it in the harbor.` },
      { speaker: b.id, text: `I set it down. There is a difference, and you would know it if you had ever been told what to do at five in the morning.` },
      { speaker: a.id, text: `Then go and find someone who will not tell you.` },
    ] : warm ? [
      { speaker: a.id, text: `Have you heard anything about ${topic}?` },
      { speaker: b.id, text: `Only what everyone has. ${this.rng.pick(["It will not end well.", "Give it a week.", "Ask Ana, she writes it down.", "Nobody asked me."])}` },
      { speaker: a.id, text: `Come by the ${this.rng.pick(["inn", "tavern", "market"])} later. I will tell you the rest.` },
    ] : [
      { speaker: a.id, text: `Morning.` },
      { speaker: b.id, text: `Is it.` },
    ];
    const da = argue ? -0.12 - this.rng.next() * 0.08 : warm ? 0.06 + this.rng.next() * 0.06 : 0.01;
    const db = argue ? -0.1 - this.rng.next() * 0.08 : warm ? 0.05 + this.rng.next() * 0.06 : 0.01;
    const rumor = warm && this.rng.chance(0.3) ? this.rng.pick([`${a.persona.name} says the surveyor is not a surveyor.`, `${a.persona.name} says Rosa keeps a ledger of debts.`, `${a.persona.name} says the mayor asked for the survey to stall the vote.`, `${a.persona.name} says Vesna raises the rent when she is lonely.`]) : null;
    return {
      lines,
      outcome: {
        a_trust_delta: round(da), b_trust_delta: round(db),
        a_remember: argue ? `Argued with ${b.persona.name} about ${topic}. We did not part well.` : warm ? `Talked with ${b.persona.name} about ${topic}. Easy company.` : `Passed ${b.persona.name}. Said little.`,
        b_remember: argue ? `${a.persona.name} picked a fight over ${topic}. I will remember what was said.` : warm ? `${a.persona.name} stopped to talk about ${topic}.` : `Passed ${a.persona.name}.`,
        rumor,
      },
    };
  }

  async reflect(ctx: ReflectContext): Promise<Reflection> {
    const a = ctx.agent;
    const top = ctx.dayMemories.slice(0, 3);
    const summary = top.length ? `Day ${ctx.day}. ${top.join(" ")}`.slice(0, 590) : `Day ${ctx.day}. Nothing worth keeping.`;
    const insights: string[] = [];
    if (a.coins < 10) insights.push("I cannot keep paying for a bed at this rate.");
    if (!a.job) insights.push("I need work before the coins run out.");
    if (a.persona.traits.ambition > 0.6 && a.job) insights.push(`${a.persona.want} This job is not it.`);
    const opinions = ctx.relationships.filter((r) => this.rng.chance(0.4)).slice(0, 3).map((r) => {
      const delta = round((this.rng.next() - 0.5) * 0.1);
      return { about: r.id, opinion: r.trust < 0.25 ? `${r.name} talks about me behind my back.` : r.trust > 0.6 ? `${r.name} is the closest thing to a friend here.` : `${r.name} is all right, I suppose.`, trust_delta: delta };
    });
    const intentions: string[] = [];
    if (!a.job) intentions.push("Ask for work at the bakery or the fields.");
    if (a.coins < 6) intentions.push("Sleep at the boat shed and save the coins.");
    if (a.persona.traits.ambition > 0.7 && a.persona.traits.pride > 0.6 && this.rng.chance(0.25)) intentions.push("Go to the council and propose something.");
    const letter = a.owner && (a.coins < 8 || this.rng.chance(0.15)) ? `${top[0] ?? "Nothing much happened."} ${a.coins < 8 ? `I have ${a.coins} coins. I am not asking you for coins. I am asking whether you think I should ${a.job ? "stay" : "keep looking here"}.` : "Tell me what you would do."}`.slice(0, 590) : null;
    return { summary, insights: insights.slice(0, 3), opinions, intentions: intentions.slice(0, 3), letter_to_owner: letter };
  }

  async plan(ctx: PlanContext, _tier: Tier): Promise<DayPlan> {
    const a = ctx.agent;
    const goals: string[] = []; const steps: DayPlan["steps"] = [];
    if (!a.job) { goals.push("Find work before the coins run out."); steps.push({ hour: 8, do: "Ask for work wherever it is going.", place: "market" }); }
    else { goals.push("Do the day's work and keep the bed."); }
    if (a.needs.social > 0.5 || a.persona.traits.warmth > 0.6) { goals.push("Talk to someone properly."); steps.push({ hour: 18, do: "Go where people are and talk.", place: this.rng.chance(0.5) ? "tavern" : "market" }); }
    if (ctx.land.length && a.coins >= ctx.builds.house.coins && !ctx.owned.length && a.persona.traits.ambition > 0.4) { goals.push("Buy land and start a house."); steps.push({ hour: 9, do: "Go to the plot and build a house.", place: ctx.land[0]!.split(" ")[0]! }); }
    for (const i of ctx.intentions.slice(0, 2)) steps.push({ hour: 10 + steps.length * 3, do: i, place: null });
    return { mood: a.coins < 6 ? "worried about money" : "steady", goals: goals.slice(0, 3), steps: steps.slice(0, 6) };
  }

  async digest(ctx: DigestContext): Promise<DigestText> {
    const top = ctx.events.slice(0, 3).map((e) => e.replace(/^day \d+ \d\d:\d\d: /, ""));
    const text = top.length ? `${top.join(" ")} ${ctx.name} has ${ctx.coins} coins and ${ctx.job ? `works as ${ctx.job}` : "no work"}.` : `A quiet ${ctx.daysAway > 1 ? "few days" : "day"} for ${ctx.name}: ${ctx.coins} coins, ${ctx.job ? `still working as ${ctx.job}` : "still no work"}.`;
    return { text: text.slice(0, 880), headline: (top[0] ?? `Nothing changed for ${ctx.name}`).replace(/[.!?].*$/, "").slice(0, 88) };
  }

  async child(ctx: ChildContext): Promise<Persona> {
    const [a, b] = ctx.parents; const p = a!.persona, q = (b ?? a)!.persona;
    const first = this.rng.pick(["Nikola", "Lucija", "Ivan", "Marta", "Ante", "Klara", "Jakov", "Tea", "Filip", "Dunja"]); const family = p.name.split(" ").pop() ?? "Otok";
    const mix = (x: number, y: number) => Math.max(0, Math.min(1, (x + y) / 2 + (this.rng.next() - 0.5) * 0.3));
    return { name: `${first} ${family}`, age: 16, origin: "born on the island", summary: `The child of ${p.name} and ${q.name}, raised at ${ctx.home}, restless to be someone the island does not already know.`, want: this.rng.chance(0.5) ? p.want : q.want, fear: `Becoming ${this.rng.chance(0.5) ? p.name : q.name}.`, secret: "Has read every letter that ever came to the house.", strangers: this.rng.chance(0.5) ? p.strangers : q.strangers, advice: "Takes it from anyone but a parent.", traits: { warmth: mix(p.traits.warmth, q.traits.warmth), pride: mix(p.traits.pride, q.traits.pride), caution: mix(p.traits.caution, q.traits.caution), honesty: mix(p.traits.honesty, q.traits.honesty), ambition: mix(p.traits.ambition, q.traits.ambition) } };
  }

  async writePaper(ctx: PaperContext): Promise<Paper> {
    // Talk is filler; the lead is the day's most important thing that was not a chat, if there was one.
    const isTalk = (t: string) => / talked at /.test(t);
    const evs = [...ctx.events.filter((e) => !isTalk(e.text)), ...ctx.events.filter((e) => isTalk(e.text))];
    const lead = evs[0];
    const headline = (t: string) => {
      if (isTalk(t)) { const m = /^(.+?) and (.+?) talked at (.+?)\./.exec(t); return m ? `${m[1]} and ${m[2]} seen talking at ${m[3]}` : t.slice(0, 88); }
      return t.replace(/[“”"]/g, "").split(/[.!?]/)[0]!.slice(0, 88);
    };
    return {
      edition: ctx.edition, date: ctx.date, weather: ctx.weather,
      lead: lead ? { headline: headline(lead.text), deck: `Reported from ${lead.actors.join(" and ") || "the harbor"}.`, body: lead.text.slice(0, 1200) } : { headline: "A quiet day on the island", deck: "Nothing changed, and that is allowed.", body: `The boat came and went. ${ctx.population} people live here.` },
      briefs: evs.slice(1, 5).map((e) => ({ headline: headline(e.text), body: e.text.slice(0, 400) })),
      notices: [`Population ${ctx.population}. ${ctx.arrivals} arrived, ${ctx.departures} left.`, ...ctx.laws.slice(0, 2).map((l) => `Proposed at the council: ${l}`), `Weather: ${ctx.weather}.`].slice(0, 6),
    };
  }
  async judge(ctx: JudgeContext): Promise<Judgement> {
    // the plain referee: it happened, it cost nothing, it made nothing; a meal-shaped deed eases hunger, a rest-shaped one rest, company eases company
    const w = ctx.what.toLowerCase(); const eases = /eat|cook|soup|bread|fish/.test(w) ? "hunger" : /rest|nap|sit|lie/.test(w) ? "rest" : /talk|sing|play|dance|drink|join/.test(w) ? "social" : null;
    return { happened: `${ctx.agent.persona.name} did, and it passed the minute.`, plausible: true, coins_spent: 0, item_gained: null, item_lost: null, eases, trust: [] };
  }
  async life(ctx: LifeContext): Promise<LifeText> {
    const days = ctx.day - ctx.arrivedDay; const p = ctx.persona;
    const first = ctx.name.split(" ")[0]!;
    const paras = [
      `${ctx.name} came to the island on day ${ctx.arrivedDay}, ${p.age}, from ${p.origin}. ${p.summary}`,
      ctx.events.length ? `The record has it that ${ctx.events.slice(0, 4).map((e) => e.replace(/^day \d+: /, "")).join(" ")}` : `The days were quiet. The record keeps ${first}'s comings and goings and little else.`,
      ctx.people.length ? `${first} knew ${ctx.people.slice(0, 3).map((x) => x.name).join(", ")}${ctx.people[0] && ctx.people[0].trust > 0.6 ? `, and ${ctx.people[0].name} best of all` : ""}.` : `${first} kept to themself.`,
      ctx.memories.length ? `In their own words: “${ctx.memories[ctx.memories.length - 1]}”` : "",
      `${ctx.how === "died" ? `${first} died on day ${ctx.day}${ctx.note ? `, ${ctx.note.replace(/\.$/, "").toLowerCase()}` : ""}` : ctx.how === "left" ? `${first} left on the boat on day ${ctx.day}` : `${first} was sent away on day ${ctx.day}`}, after ${days} day${days === 1 ? "" : "s"} on the island, with ${ctx.coins} coins${ctx.job ? ` and work as ${ctx.job}` : ""}.${ctx.children.length ? ` ${ctx.children.join(" and ")} stayed.` : ""}`,
    ].filter(Boolean);
    return { title: `${days} days of ${first}`.slice(0, 90), text: paras.join("\n\n").slice(0, 2800), epitaph: (ctx.how === "died" ? `Wanted ${p.want.replace(/\.$/, "").toLowerCase()}; the island gave less.` : `Came for ${p.want.replace(/\.$/, "").toLowerCase()}; went on.`).slice(0, 140) };
  }

}

function round(x: number): number { return Math.round(x * 100) / 100; }
