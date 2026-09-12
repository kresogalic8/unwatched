import { describe, it, expect, vi, afterEach } from "vitest";
import type { AgentState, ConverseContext, DigestContext, JudgeContext, LifeContext, ReflectContext, Place } from "@unwatched/engine";
import type { Persona } from "@unwatched/protocol";
import { OpenRouterBrain, chooseModel, SLOT_OF, trimProse, truncateProse, repairNote, isFromFallback, canEnrich, MockBrain } from "../src/index.ts";

const persona = (name: string): Persona => ({ name, age: 33, origin: "the mainland", summary: "A restless person.", want: "somewhere better", fear: "staying", secret: "none", strangers: "curious", advice: "weighs it", traits: { warmth: 0.6, pride: 0.4, caution: 0.3, honesty: 0.7, ambition: 0.8 } });
const citizen = (id: string, thinkEvery: number | null = null): AgentState => ({ id, persona: persona(id), owner: "owner-1", brainKind: "hosted", thinkEvery, arrivedAt: 0, coins: 12, job: null, home: null, relationships: new Map(), memory: [], inventory: [] } as unknown as AgentState);
const models = { routine: "haiku", stakes: "sonnet", reflect: "opus" };

/** A fake OpenRouter: records every request body and answers from a queue. */
function fakeFetch(answers: (unknown | { status: number })[]) {
  const bodies: { model: string; max_tokens: number; messages: { role: string; content: unknown }[] }[] = [];
  const fetch = vi.fn(async (_url: string, init: { body: string; signal?: AbortSignal }) => {
    bodies.push(JSON.parse(init.body));
    const next = answers.shift();
    if (next && typeof next === "object" && "status" in next && typeof (next as { status: number }).status === "number") return new Response("down", { status: (next as { status: number }).status });
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(next) } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }), { status: 200, headers: { "Content-Type": "application/json" } });
  });
  vi.stubGlobal("fetch", fetch);
  return { bodies, fetch };
}
afterEach(() => vi.unstubAllGlobals());

describe("the chooser", () => {
  it("sends every kind of call to its slot, and the per-citizen override wins", () => {
    expect(SLOT_OF).toEqual({ action_proposal: "routine", dialogue: "routine", judgement: "routine", day_plan: "routine", digest: "stakes", child: "stakes", reflection: "reflect", persona_depth: "reflect", paper: "reflect", life: "reflect" });
    expect(chooseModel("dialogue", models, null)).toEqual({ model: "haiku", slot: "routine" });
    expect(chooseModel("paper", models, null)).toEqual({ model: "opus", slot: "reflect" });
    expect(chooseModel("paper", models, { reflect: "sonnet" })).toEqual({ model: "sonnet", slot: "reflect" }); // the ceiling
    expect(chooseModel("action_proposal", models, { stakes: "opus" }, "stakes")).toEqual({ model: "opus", slot: "stakes" }); // a Patron at tier 2
    expect(chooseModel("action_proposal", models, { stakes: "opus" })).toEqual({ model: "haiku", slot: "routine" }); // and at tier 1
  });
  it("consults the hook for the Gazette, the books and the digest too", async () => {
    const { bodies } = fakeFetch([{ title: "A life", text: "It was short.", epitaph: "Gone." }, { text: "Quiet.", headline: "Nothing" }]);
    const b = new OpenRouterBrain({ apiKey: "k", ...models });
    const seen: string[] = [];
    b.modelsFor = (a) => { seen.push(a.id); return { reflect: "sonnet", stakes: "haiku" }; };
    const life = await b.life({ name: "Ada", persona: persona("Ada"), how: "left", note: "", arrivedDay: 1, day: 9, coins: 0, job: null, home: null, events: [], memories: [], people: [], letters: 0, children: [], lettersHome: [], lastThought: null, owned: [], convictions: 0 } as unknown as LifeContext);
    expect(life.title).toBe("A life"); expect(bodies[0]!.model).toBe("sonnet"); expect(seen[0]).toBe("town");
    const a = citizen("ada");
    await b.digest({ agent: a, name: "Ada", day: 3, daysAway: 1, events: [], plan: null, letter: null, people: [], coins: 0, job: null, home: null, reflection: null, intentions: [], projects: [], trust: [] } as DigestContext);
    expect(bodies[1]!.model).toBe("haiku"); expect(seen[1]).toBe("ada");
  });
  it("a hook that throws is a hook that said nothing", async () => {
    const { bodies } = fakeFetch([{ happened: "it passed", plausible: true }]);
    const b = new OpenRouterBrain({ apiKey: "k", ...models }); b.modelsFor = () => { throw new Error("no wallet"); };
    await b.judge({ agent: citizen("ada"), what: "whistle", withName: null, place: "square", placeKind: "square", hour: 9, weather: "fair", nearby: [], inventory: [], coins: 0, stock: [] } as JudgeContext);
    expect(bodies[0]!.model).toBe("haiku");
  });
});

describe("a quiet night", () => {
  const ctx = (agent: AgentState, quiet: boolean) => ({ agent, day: 2, dayMemories: [], keyMemories: [], relationships: [], unreadLetters: [], plan: null, projects: [], beliefs: [], watch: [], quiet } as unknown as ReflectContext);
  const answer = { summary: "Nothing much.", insights: [], opinions: [], intentions: [], letter_to_owner: null };
  it("is thought through on the stakes model with fewer tokens, the same prompt otherwise", async () => {
    const { bodies } = fakeFetch([answer, answer]);
    const b = new OpenRouterBrain({ apiKey: "k", ...models });
    await b.reflect(ctx(citizen("ada"), true)); await b.reflect(ctx(citizen("ada"), false));
    expect(bodies[0]!.model).toBe("sonnet"); expect(bodies[0]!.max_tokens).toBe(900);
    expect(bodies[1]!.model).toBe("opus"); expect(bodies[1]!.max_tokens).toBe(2000);
    expect(bodies[0]!.messages[1]).toEqual(bodies[1]!.messages[1]);
  });
});

describe("the cache markers", () => {
  const place = { id: "square", name: "the square", kind: "square" } as unknown as Place;
  it("a conversation's system text carries no marker; the shared block does", async () => {
    const { bodies } = fakeFetch([{ lines: [{ speaker: "ada", text: "Morning." }], outcome: { a_trust_delta: 0, b_trust_delta: 0, a_remember: "we spoke", b_remember: "we spoke", rumor: null } }]);
    const b = new OpenRouterBrain({ apiKey: "k", ...models });
    await b.converse({ a: citizen("ada"), b: citizen("bo"), place, time: "9:00", weather: "rain", aMemories: [], bMemories: [], rumorsA: [] } as ConverseContext);
    const blocks = bodies[0]!.messages[0]!.content as { text: string; cache_control?: unknown }[];
    expect(blocks[0]!.cache_control).toEqual({ type: "ephemeral" }); expect(blocks[1]!.cache_control).toBeUndefined();
  });
  it("the persona block is marked only for a citizen who thinks inside the cache's life", async () => {
    const answer = { summary: "Fine.", insights: [], opinions: [], intentions: [], letter_to_owner: null };
    const { bodies } = fakeFetch([answer, answer]);
    const b = new OpenRouterBrain({ apiKey: "k", ...models });
    const ctx = (a: AgentState) => ({ agent: a, day: 2, dayMemories: [], keyMemories: [], relationships: [], unreadLetters: [], plan: null, projects: [], beliefs: [], watch: [], quiet: false } as unknown as ReflectContext);
    await b.reflect(ctx(citizen("ada"))); await b.reflect(ctx(citizen("bo", 5)));
    expect((bodies[0]!.messages[0]!.content as { cache_control?: unknown }[])[1]!.cache_control).toBeUndefined();
    expect((bodies[1]!.messages[0]!.content as { cache_control?: unknown }[])[1]!.cache_control).toEqual({ type: "ephemeral" });
  });
});

describe("repairing an answer", () => {
  it("trims prose at a sentence, at a word when there is none, and leaves what fits alone", () => {
    expect(trimProse("Short.", 10)).toBe("Short.");
    expect(trimProse("One sentence. Two sentence. Three sentence.", 30)).toBe("One sentence. Two sentence.");
    expect(trimProse("no sentence ends anywhere in this long line at all", 30)).toBe("no sentence ends anywhere in");
    expect(trimProse("x".repeat(50), 30)).toHaveLength(30);
    expect(trimProse("A fine long day. " + "y".repeat(40), 30)).toBe("A fine long day."); // never past the cap, and a sentence when one keeps at least half
    expect(trimProse("A day. " + "y".repeat(40), 30)).toBe("A day. yyyyyyyyyyyyyyyyyyyyyyy"); // a sentence that keeps less than half loses to the word
  });
  it("applies the table by path, into nested objects and every line of a voice", () => {
    const paper = truncateProse("paper", { lead: { body: "A story. " + "z".repeat(3000) } }) as { lead: { body: string } };
    expect(paper.lead.body.length).toBeLessThanOrEqual(2600);
    const depth = truncateProse("persona_depth", { voice: ["short", "w ".repeat(200)], habit: "h ".repeat(200) }) as { voice: string[]; habit: string };
    expect(depth.voice[0]).toBe("short"); expect(depth.voice[1]!.length).toBeLessThanOrEqual(240); expect(depth.habit.length).toBeLessThanOrEqual(240); // the protocol's caps
    expect(truncateProse("judgement", { happened: "x".repeat(500) })).toEqual({ happened: "x".repeat(500) }); // no table, no trim
  });
  it("names the path and the cap", () => {
    expect(repairNote({ path: ["lead", "body"], message: "Too big", code: "too_big", maximum: 2600, origin: "string" }, { lead: { body: "x".repeat(3100) } })).toBe("Your answer did not fit: lead.body was 3,100 characters; the limit is 2,600. Return the same answer within the limits, as JSON only.");
    expect(repairNote({ path: ["plausible"], message: "Invalid input: expected boolean" }, {})).toContain("plausible: Invalid input: expected boolean");
  });
  it("retries once with the answer and the note, then returns the repaired answer", async () => {
    const long = "A day of rain. ".repeat(110); // 1650 characters, trimmed to a sentence under 1400 before zod sees it
    const { bodies } = fakeFetch([{ text: long, headline: "h".repeat(100) }, { text: "Rain.", headline: "Rain all day" }]);
    const b = new OpenRouterBrain({ apiKey: "k", ...models });
    const out = await b.digest({ agent: citizen("ada"), name: "Ada", day: 3, daysAway: 1, events: [], plan: null, letter: null, people: [], coins: 0, job: null, home: null, reflection: null, intentions: [], projects: [], trust: [] } as DigestContext);
    expect(out).toEqual({ text: "Rain.", headline: "Rain all day" });
    expect(bodies).toHaveLength(2);
    const m = bodies[1]!.messages; expect(m).toHaveLength(4); expect(m[2]!.role).toBe("assistant");
    expect(m[3]!.content).toBe("Your answer did not fit: headline was 100 characters; the limit is 90. Return the same answer within the limits, as JSON only.");
  });
  it("a long paragraph alone is trimmed, not rejected", async () => {
    const long = "A day of rain. ".repeat(110);
    const { bodies } = fakeFetch([{ text: long, headline: "Rain" }]);
    const b = new OpenRouterBrain({ apiKey: "k", ...models });
    const out = await b.digest({ agent: citizen("ada"), name: "Ada", day: 3, daysAway: 1, events: [], plan: null, letter: null, people: [], coins: 0, job: null, home: null, reflection: null, intentions: [], projects: [], trust: [] } as DigestContext);
    expect(bodies).toHaveLength(1); expect(out.text.length).toBeLessThanOrEqual(1400); expect(out.text.endsWith("rain.")).toBe(true);
  });
  it("when the fallback still stands in, the answer is marked without changing shape and ops hear of it", async () => {
    fakeFetch([{ status: 500 }, { status: 500 }]);
    const lines: string[] = []; const falls: string[] = [];
    const b = new OpenRouterBrain({ apiKey: "k", ...models, log: (l) => lines.push(l) }); b.onFallback = (f) => falls.push(f.reason);
    const out = await b.judge({ agent: citizen("ada"), what: "whistle", withName: null, place: "square", placeKind: "square", hour: 9, weather: "fair", nearby: [], inventory: [], coins: 0, stock: [] } as JudgeContext);
    expect(isFromFallback(out)).toBe(true); expect(Object.keys(out)).not.toContain("fromFallback"); expect(JSON.stringify(out)).not.toContain("fromFallback");
    expect(lines.some((l) => l.startsWith("warn: fallback stood in for judgement"))).toBe(true); expect(falls).toEqual(["openrouter 500"]);
  }, 10_000);
});

describe("the deadline", () => {
  it("gives up on a call that never answers, retries once, then falls back", async () => {
    const seen: AbortSignal[] = [];
    vi.stubGlobal("fetch", vi.fn((_url: string, init: { signal: AbortSignal }) => new Promise((_, reject) => { seen.push(init.signal); init.signal.addEventListener("abort", () => reject(init.signal.reason)); })));
    const lines: string[] = [];
    const b = new OpenRouterBrain({ apiKey: "k", ...models, timeoutMs: 30, reflectTimeoutMs: 30, log: (l) => lines.push(l) });
    const out = await b.judge({ agent: citizen("ada"), what: "whistle", withName: null, place: "square", placeKind: "square", hour: 9, weather: "fair", nearby: [], inventory: [], coins: 0, stock: [] } as JudgeContext);
    expect(seen).toHaveLength(2); expect(isFromFallback(out)).toBe(true);
    expect(lines[0]).toBe("openrouter no answer in 0s; retrying"); expect(lines[1]).toBe("openrouter no answer in 0s; falling back");
  });
});

describe("voices on every brain", () => {
  it("the duck-typed check finds enrich on the hosted brains and not on the mock", () => {
    fakeFetch([]);
    expect(canEnrich(new OpenRouterBrain({ apiKey: "k" }))).toBe(true);
    expect(canEnrich(new MockBrain(1))).toBe(false);
  });
});
