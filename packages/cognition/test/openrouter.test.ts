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
  it("does not replay a timed-out request that may already have been billed", async () => {
    const seen: AbortSignal[] = [];
    vi.stubGlobal("fetch", vi.fn((_url: string, init: { signal: AbortSignal }) => new Promise((_, reject) => { seen.push(init.signal); init.signal.addEventListener("abort", () => reject(init.signal.reason)); })));
    const lines: string[] = [];
    const b = new OpenRouterBrain({ apiKey: "k", ...models, timeoutMs: 30, reflectTimeoutMs: 30, log: (l) => lines.push(l) });
    const out = await b.judge({ agent: citizen("ada"), what: "whistle", withName: null, place: "square", placeKind: "square", hour: 9, weather: "fair", nearby: [], inventory: [], coins: 0, stock: [] } as JudgeContext);
    expect(seen).toHaveLength(1); expect(isFromFallback(out)).toBe(true);
    expect(lines[0]).toBe("openrouter no answer in 0s; not replaying an uncertain request");
  });
});

describe("voices on every brain", () => {
  it("the duck-typed check finds enrich on the hosted brains and not on the mock", () => {
    fakeFetch([]);
    expect(canEnrich(new OpenRouterBrain({ apiKey: "k" }))).toBe(true);
    expect(canEnrich(new MockBrain(1))).toBe(false);
  });
});

describe("an answer that arrives broken", () => {
  const judgeCtx = { what: "whistle", withName: null, place: "square", placeKind: "square", hour: 9, weather: "fair", nearby: [], inventory: [], coins: 0, stock: [] };
  it("a body that never finishes falls back and ops hear of it, instead of escaping the brain", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => { const e = new Error("The operation was aborted due to timeout"); e.name = "TimeoutError"; throw e; }, text: async () => "" } as unknown as Response)));
    const lines: string[] = []; const falls: string[] = [];
    const b = new OpenRouterBrain({ apiKey: "k", ...models, timeoutMs: 30, reflectTimeoutMs: 30, log: (l) => lines.push(l) }); b.onFallback = (f) => falls.push(f.reason);
    const out = await b.judge({ agent: citizen("ada"), ...judgeCtx } as JudgeContext);
    expect(isFromFallback(out)).toBe(true);
    expect(falls).toEqual(["no answer in 0s"]);
    expect(lines[0]).toBe("openrouter no answer in 0s; not replaying an uncertain request");
  });
  it("an answer with nothing in it is simply asked again, with no empty turn a provider would refuse", async () => {
    const bodies: { messages: { role: string; content: unknown }[] }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init: { body: string }) => { bodies.push(JSON.parse(init.body)); return new Response(JSON.stringify({ choices: [{ message: { content: bodies.length === 1 ? "" : JSON.stringify({ happened: "a whistle", plausible: true, coins_spent: 0, item_gained: null, item_lost: null, eases: null, trust: [] }) } }] }), { status: 200 }); }));
    const b = new OpenRouterBrain({ apiKey: "k", ...models });
    const out = await b.judge({ agent: citizen("ada"), ...judgeCtx } as JudgeContext);
    expect(isFromFallback(out)).toBe(false); expect(out.happened).toBe("a whistle");
    expect(bodies).toHaveLength(2);
    expect(bodies[1]!.messages).toHaveLength(bodies[0]!.messages.length); // the second ask is a fresh one, not a repair on an empty answer
  });
  it("does not sleep after it has already decided to fall back", async () => {
    fakeFetch([{ status: 503 }, { status: 503 }]);
    const b = new OpenRouterBrain({ apiKey: "k", ...models });
    const started = Date.now();
    await b.judge({ agent: citizen("ada"), ...judgeCtx } as JudgeContext);
    expect(Date.now() - started).toBeLessThan(2500); // one backoff, not two
  }, 10_000);
});

describe('paid service integrity', () => {
  const ctx = (a: AgentState): ReflectContext => ({agent:a,day:1,dayMemories:[],keyMemories:[],relationships:[],unreadLetters:[],plan:null,projects:[],beliefs:[],watch:[],quiet:true});
  it('does not substitute a cheaper model for an included paid reflection', async () => {
    const {bodies}=fakeFetch([{summary:'Quiet.',insights:[],opinions:[],intentions:[],letter_to_owner:null}]);
    const a=citizen('ada');a.budget={tier1Max:50,tier1Left:50,tier2Max:6,tier2Left:6,reflectionIncluded:true};
    await new OpenRouterBrain({apiKey:'test',...models,allowFallback:false}).reflect(ctx(a));
    expect(bodies[0]?.model).toBe('opus');
  });
  it('rejects provider credit exhaustion without fake output or repeated paid requests during cooldown', async () => {
    const {fetch}=fakeFetch([{status:402}]);const b=new OpenRouterBrain({apiKey:'test',...models,allowFallback:false});
    await expect(b.reflect(ctx(citizen('ada')))).rejects.toThrow('no synthetic response');
    await expect(b.reflect(ctx(citizen('ada')))).rejects.toThrow('cooldown');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe('provider cost attribution',()=>{
 it('reports each billable response including schema repair, with its citizen and actual cost',async()=>{
  const fetch=vi.fn().mockImplementationOnce(async()=>new Response(JSON.stringify({choices:[{message:{content:'not json'}}],usage:{prompt_tokens:100,completion_tokens:10,cost:0.001}}))).mockImplementationOnce(async()=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({text:'A calm day.',headline:'Calm'})}}],usage:{prompt_tokens:120,completion_tokens:20,cost:0.002,prompt_tokens_details:{cached_tokens:80}}})));
  vi.stubGlobal('fetch',fetch);const b=new OpenRouterBrain({apiKey:'test',...models});const usage:unknown[]=[];b.onUsage=u=>usage.push(u);
  await b.digest({agent:citizen('patron'),name:'Patron',day:1,daysAway:1,events:[],plan:null,letter:null,people:[],coins:0,job:null,home:null,reflection:null,intentions:[],projects:[],trust:[]} as DigestContext);
  expect(usage).toEqual([expect.objectContaining({agentId:'patron',kind:'digest',model:'sonnet',costUsd:.001}),expect.objectContaining({agentId:'patron',costUsd:.002,cachedTokens:80})]);
 });
 it('keeps unknown provider costs unknown',async()=>{
  fakeFetch([{text:'A day.',headline:'Day'}]);const b=new OpenRouterBrain({apiKey:'test',...models});const usage=vi.fn();b.onUsage=usage;
  await b.digest({agent:citizen('a'),name:'A',day:1,daysAway:1,events:[],plan:null,letter:null,people:[],coins:0,job:null,home:null,reflection:null,intentions:[],projects:[],trust:[]} as DigestContext);
  expect(usage).toHaveBeenCalledWith(expect.objectContaining({costUsd:null}));
 });
 it('uses a reading model without downgrading paid reflections',async()=>{
  const {bodies}=fakeFetch([{text:'A day.',headline:'Day'},{summary:'Quiet.',insights:[],opinions:[],intentions:[],letter_to_owner:null}]);
  const b=new OpenRouterBrain({apiKey:'test',...models});b.modelsFor=()=>({stakes:'opus',reflect:'opus'});b.digestModel='sonnet';
  const a=citizen('patron');a.budget={tier1Max:120,tier1Left:120,tier2Max:15,tier2Left:15,reflectionIncluded:true};
  await b.digest({agent:a,name:'A',day:1,daysAway:1,events:[],plan:null,letter:null,people:[],coins:0,job:null,home:null,reflection:null,intentions:[],projects:[],trust:[]} as DigestContext);
  await b.reflect({agent:a,day:1,dayMemories:[],keyMemories:[],relationships:[],unreadLetters:[],plan:null,projects:[],beliefs:[],watch:[],quiet:true});
  expect(bodies.map(x=>x.model)).toEqual(['sonnet','opus']);
 });
 it('does not retry an exhausted daily key every five minutes',async()=>{
  let now=1000;const time=vi.spyOn(Date,'now').mockImplementation(()=>now);const fetch=vi.fn(async()=>new Response('Key limit exceeded (daily limit)',{status:403}));vi.stubGlobal('fetch',fetch);
  try{
   const b=new OpenRouterBrain({apiKey:'test',...models,allowFallback:false});const ctx={agent:citizen('a'),name:'A',day:1,daysAway:1,events:[],plan:null,letter:null,people:[],coins:0,job:null,home:null,reflection:null,intentions:[],projects:[],trust:[]} as DigestContext;
   await expect(b.digest(ctx)).rejects.toThrow();now+=10*60000;await expect(b.digest(ctx)).rejects.toThrow('cooldown');expect(fetch).toHaveBeenCalledTimes(1);
  }finally{time.mockRestore();}
 });
});

it('isolates an injected experiment transport and reports its usage', async () => {
  const network = vi.fn(); vi.stubGlobal('fetch', network);
  const transport = vi.fn(async () => new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({happened:'Nothing changed.',plausible:true})}}],usage:{prompt_tokens:100,completion_tokens:20,cost:.001}})));
  const b = new OpenRouterBrain({apiKey:'test',allowFallback:false,transport});
  const report = vi.fn(); b.onUsage=report;
  await b.judge({agent:citizen('ada'),what:'observe',withName:null,place:'square',placeKind:'square',hour:9,weather:'clear',nearby:[],inventory:[],coins:0,stock:[]} as JudgeContext);
  expect(transport).toHaveBeenCalledTimes(1); expect(network).not.toHaveBeenCalled();
  expect(report).toHaveBeenCalledWith(expect.objectContaining({costUsd:.001,promptTokens:100}));
});

it('counts nested optional parameters in provider schemas', async () => {
  const {optionalPropertyCount}=await import('../src/openrouter.ts');
  expect(optionalPropertyCount({type:'object',properties:{action:{anyOf:[{type:'object',properties:{kind:{const:'wait'},note:{type:'string'}},required:['kind']}]},intent:{type:'string'}},required:['action']})).toBe(2);
});

it('validates large Anthropic decision schemas locally while keeping small schemas structured', async () => {
  const {Town,Rng}=await import('@unwatched/engine');
  const {seedPersonas}=await import('../src/index.ts');
  const town=new Town({seed:19,brain:new MockBrain(19)});
  const a=town.addAgent({persona:seedPersonas(new Rng(19),1)[0]!});
  const {bodies}=fakeFetch([{action:{kind:'wait'}},{happened:'Quiet.',plausible:true}]);
  const brain=new OpenRouterBrain({apiKey:'test',routine:'anthropic/claude-haiku-4.5',allowFallback:false});
  expect((await brain.decide(town.perceive(a),a,1)).action).toEqual({kind:'wait'});
  expect(bodies[0]).not.toHaveProperty('response_format');
  expect(JSON.stringify(bodies[0]?.messages)).toContain('JSON schema');
  await brain.judge({agent:a,what:'observe',withName:null,place:'square',placeKind:'square',hour:9,weather:'clear',nearby:[],inventory:[],coins:0,stock:[]} as JudgeContext);
  expect(bodies[1]).toHaveProperty('response_format');
});

it('omits desire linkage when none exists and constrains links to active IDs', async()=>{
 const {Town,Rng}=await import('@unwatched/engine');const {seedPersonas}=await import('../src/index.ts');
 const town=new Town({seed:19,brain:new MockBrain(19)});const a=town.addAgent({persona:seedPersonas(new Rng(19),1)[0]!});
 const {bodies}=fakeFetch([{action:{kind:'wait'},desire_id:'An invented goal '.repeat(5)},{action:{kind:'wait'},desire_id:'active-one'}]);
 const brain=new OpenRouterBrain({apiKey:'test',routine:'anthropic/claude-haiku-4.5',allowFallback:false});
 expect((await brain.decide(town.perceive(a),a,1)).desire_id).toBeUndefined();
 a.desires=[{id:'active-one',title:'Build something',why:'Curiosity',state:'active',since:0,updated:0,attempts:[],history:[]}];
 expect((await brain.decide(town.perceive(a),a,1)).desire_id).toBe('active-one');
 expect(JSON.stringify(bodies[1]?.messages)).toContain('active-one');
});
