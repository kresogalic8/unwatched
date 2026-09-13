import { BoardingConnections, verifyBoardingKey } from "./boarding.ts";
import { adminResolver, backofficeRoutes } from "./backoffice.ts";
import { configureDeliveryLog } from "./delivery-log.ts";
import { telegramRoutes } from "./telegram-routes.ts";
import { TelegramLetters } from "./telegram.ts";
import { publicProject } from "./views.ts";
import { constructionRoutes } from "./construction.ts";
import type { AgentState } from "@unwatched/engine";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { WebSocketServer, type WebSocket } from "ws";
import { z } from "zod";
import { Voices, voiceOf, voicesEnabled } from "./voice.ts";
import { Looks, looksEnabled } from "./looks.ts";
import { createClient } from "@supabase/supabase-js";
import { Town, Rng, MINUTES_PER_DAY, sha256, canonicalEvent } from "@unwatched/engine";
import type { Brain } from "@unwatched/engine";
import { Action, Persona, type TownEvent, type PersonaDepth, Passenger } from "@unwatched/protocol";
import { MockBrain, AnthropicBrain, OpenRouterBrain, seedPersonas } from "@unwatched/cognition";
import { TownStore, FileStore } from "@unwatched/store";
import { publicAgent, ownerAgent, clockOf, realClock, setPerks } from "./views.ts";
import { BrainRouter, newToken, OwnBrain, OwnKeyBrain } from "./brains.ts";
import type { BrainRow, Plan, Store, OwnerPrefs, OwnerRead } from "@unwatched/store";
import { digestMail, letterMail, sendMail, mailEnabled, mailDue } from "./mail.ts";
import { Billing, PLANS, PACKS, COST } from "./billing.ts";
import { Metrics } from "./ops.ts";
import { RealWorld, parsePlace, resolveZone } from "./realworld.ts";

const here = dirname(fileURLToPath(import.meta.url));
const envFile = resolve(here, "../../../.env");
if (existsSync(envFile)) process.loadEnvFile(envFile);

const processStarted = new Date().toISOString();
const PORT = Number(process.env.PORT ?? 4000);
const SEED = Number(process.env.UW_SEED ?? 42);
const MS_PER_SIM_MINUTE = Number(process.env.UW_MS_PER_SIM_MINUTE ?? 1000); // 60000 is real time
const BRAIN = process.env.UW_BRAIN ?? "mock";
const CITIZENS = Number(process.env.UW_CITIZENS ?? 20);
const log = (l: string) => console.log(`[town] ${l}`);

const townBrain: Brain = BRAIN === "openrouter" ? new OpenRouterBrain({ log, allowFallback: false }) : BRAIN === "anthropic" ? new AnthropicBrain({ log }) : new MockBrain(SEED);
if (BRAIN === "openrouter" && process.env.OPENROUTER_SUBSCRIBER_API_KEY && process.env.OPENROUTER_SUBSCRIBER_API_KEY === process.env.OPENROUTER_API_KEY) throw new Error("Subscriber and public-world keys must be different");
const subscriberBrain = BRAIN === "openrouter" && process.env.OPENROUTER_SUBSCRIBER_API_KEY
  ? new OpenRouterBrain({ apiKey: process.env.OPENROUTER_SUBSCRIBER_API_KEY, log, allowFallback: false }) : null;
const router = new BrainRouter(townBrain, log, (a) => {
  if (BRAIN !== "openrouter" || a.brainKind !== "hosted" || !a.owner || billing.wallet(a.owner).plan === "none") return undefined;
  if (!subscriberBrain) throw new Error("Subscriber AI key is not configured; entitlement preserved");
  return subscriberBrain;
});
const MODELS = { routine: process.env.UW_OR_MODEL_ROUTINE ?? "anthropic/claude-haiku-4.5", stakes: process.env.UW_OR_MODEL_STAKES ?? "anthropic/claude-sonnet-5", reflect: process.env.UW_OR_MODEL_REFLECT ?? "anthropic/claude-opus-5" };
let clockRef = () => ({ day: 1, hour: 6, t: 0 });
const PATRON_MODELS = { stakes: process.env.UW_OR_MODEL_PATRON_STAKES ?? "anthropic/claude-opus-5", reflect: process.env.UW_OR_MODEL_REFLECT ?? "anthropic/claude-opus-5" }; // a Patron's careful thoughts go to the most capable mind
let modelsFor: (a: AgentState) => Partial<{ routine: string; stakes: string; reflect: string }> | null = () => null;
const metrics = new Metrics(router, townBrain, () => clockRef(), MODELS, (a) => modelsFor(a));
if (townBrain instanceof OpenRouterBrain) townBrain.modelsFor = (a) => modelsFor(a);
const DAILY_CEILING_USD = Number(process.env.UW_DAILY_CEILING_USD ?? 120); // past it, careful thoughts go to the routine mind and reflections to the middle one; the clock never slows
const brain = router; // endpoints keep talking to the router; the engine talks to the metrics wrapper
router.onBad = (text) => metrics.hold("watch", text, "own brains");
if (townBrain instanceof OpenRouterBrain) townBrain.onFallback = (f) => metrics.fallback(f);
const TOWN_ID = process.env.UW_TOWN_ID ?? "island";
const TOWN_NAME = process.env.UW_TOWN_NAME ?? "The island";
/** Where the pages live, for the buttons in the mail: the island's address without the engine's own path. */
const SITE_URL = (process.env.UW_PUBLIC_URL ?? "https://unwatched.world").replace(/\/engine\/?$/, "").replace(/\/$/, "");
/** Other islands a boat runs to: UW_HARBORS="north=https://north.example/engine,west=http://localhost:4011". Names are fetched from them. */
const HARBORS: { id: string; url: string; name: string }[] = (process.env.UW_HARBORS ?? "").split(",").map((x) => x.trim()).filter(Boolean).map((x) => { const [id, url] = x.split("="); return { id: id!.trim(), url: (url ?? "").trim().replace(/\/$/, ""), name: id!.trim() }; }).filter((h) => h.url);
const BOAT_SECRET = process.env.UW_BOAT_SECRET ?? "";
const harborStats = new Map<string, { at: number; data: Record<string, unknown> | null }>();
async function harborTown(h: { id: string; url: string }): Promise<Record<string, unknown> | null> {
  const hit = harborStats.get(h.id); if (hit && Date.now() - hit.at < 60000) return hit.data;
  try { const res = await fetch(`${h.url}/api/town`, { signal: AbortSignal.timeout(4000) }); const data = res.ok ? (await res.json()) as Record<string, unknown> : null; harborStats.set(h.id, { at: Date.now(), data }); return data; }
  catch { harborStats.set(h.id, { at: Date.now(), data: null }); return null; }
}
/** Put a passenger on the boat to another island. True when the far harbor took them in. */
async function boatTo(passenger: Passenger, to: string): Promise<boolean> {
  const h = HARBORS.find((x) => x.id === to); if (!h) return false;
  try {
    const res = await fetch(`${h.url}/api/boat/arrive`, { method: "POST", headers: { "Content-Type": "application/json", "X-Boat": BOAT_SECRET }, body: JSON.stringify(passenger), signal: AbortSignal.timeout(10000) });
    if (!res.ok) { log(`boat to ${h.id}: ${res.status} ${(await res.text()).slice(0, 120)}`); return false; }
    return true;
  } catch (err) { log(`boat to ${h.id}: ${(err as Error).message}`); return false; }
}
let store: Store | null = process.env.UW_STORE === "none" ? null : TownStore.fromEnv(TOWN_ID);
if (store) { const bad = await store.probe(); if (bad) { log(`store disabled: ${bad}`); store = null; } }
if (!store && process.env.UW_STORE !== "none") { store = FileStore.fromEnv(TOWN_ID); log(`record kept in ${process.env.UW_DATA_DIR ?? "out/town"}/${TOWN_ID}.json (set SUPABASE_URL for the shared record, UW_STORE=none for none)`); }
const clients = new Set<WebSocket>();
function broadcast(msg: unknown) { const s = JSON.stringify(msg); for (const c of clients) if (c.readyState === 1) c.send(s); }

const telegramDb = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } }) : null;
configureDeliveryLog(telegramDb);
// Retry content is private and retained only for the provider's deduplication window.
if(telegramDb) setInterval(()=>{void telegramDb.from('delivery_jobs').update({payload:{},status:'expired'}).in('status',['failed','sending','pending']).lt('created_at',new Date(Date.now()-24*3600000).toISOString()).then(()=>{});},3600000).unref();
const adminOf = adminResolver(telegramDb);
const selfServeTelegram = !!(telegramDb && process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_USERNAME && process.env.TELEGRAM_WEBHOOK_SECRET);
const telegram = new TelegramLetters({ token: process.env.TELEGRAM_BOT_TOKEN, chat:process.env.TELEGRAM_CHAT_ID, owner:process.env.TELEGRAM_OWNER_ID, agent:process.env.TELEGRAM_AGENT_ID, resolve: selfServeTelegram && telegramDb ? async (owner, agent) => {
  const { data, error } = await telegramDb!.from("owner_telegram").select("chat_id,agent_ids").eq("owner_id", owner).maybeSingle();
  if (error) throw new Error("Telegram settings unavailable");
  return data?.chat_id && data.agent_ids.includes(agent) ? data.chat_id : null;
} : undefined }, log);
const billing = new Billing(store, log); await billing.load();
modelsFor = (a) => {
  if (a.owner && a.brainKind === "hosted" && billing.wallet(a.owner).plan !== "none") return billing.wallet(a.owner).plan === "patron" ? PATRON_MODELS : null;
  if (DAILY_CEILING_USD > 0 && metrics.today(town.day).cost >= DAILY_CEILING_USD) return { stakes: MODELS.routine, reflect: MODELS.stakes }; // the ceiling: cheaper minds, same seconds
  return a.owner && a.brainKind === "hosted" && billing.wallet(a.owner).plan === "patron" ? PATRON_MODELS : null;
};
if (subscriberBrain) {
  subscriberBrain.modelsFor = (a) => a.owner && billing.wallet(a.owner).plan === "patron" ? PATRON_MODELS : null;
  subscriberBrain.onFallback = f => metrics.fallback(f);
}
if(telegramDb) metrics.onAttempt=(a,kind,outcome,duration,t)=>{void telegramDb.from('cognition_attempts').insert({agent_id:a?.id??null,kind,outcome,duration_ms:duration,island_minute:t,funding:a?.brainKind==='own_key'?'user_key':a?.brainKind==='own_brain'?'external_brain':a?.owner&&billing.wallet(a.owner).plan!=='none'?'subscriber':'world'}).then(({error})=>{if(error)log('Could not persist cognition diagnostic.');});};
const hasPerks = (a: AgentState) => !a.owner || billing.wallet(a.owner).plan === "resident" || billing.wallet(a.owner).plan === "patron"; setPerks(hasPerks); // the portrait and the voice come with a plan
const town = new Town({ seed: SEED, brain: metrics, log, creditBank: billing.bank, creditRefund: billing.refund, idPrefix: TOWN_ID === "island" ? "" : TOWN_ID, name: TOWN_NAME, harbors: HARBORS.map((h) => ({ id: h.id, name: h.name })), onDepart: boatTo, onEvent: (e) => { store?.sink(e); void telegram.deliver(e, () => { const a = town.agents.get(e.actors[0]!); return a ? { id: a.id, owner: a.owner, name: a.persona.name } : undefined; }); broadcast({ type: "event", event: publicEvent(e) }); if (e.kind === "town.built" && e.payload && (e.payload as { hash?: string }).hash) { const p = e.payload as { hash: string; look: string; what: "house" | "shop" }; void looks.ensure(p.hash, p.look, p.what); } if (e.kind === "town.book" && store && e.actors[0] && e.payload) { const p = e.payload as { title: string; text: string; epitaph: string; how: "left" | "died" | "exiled"; arrivedDay: number; leftDay: number; name: string }; void store.saveLife({ agentId: e.actors[0], name: p.name, title: p.title, text: p.text, epitaph: p.epitaph, how: p.how, arrivedDay: p.arrivedDay, leftDay: p.leftDay }).catch((err: Error) => log(`could not shelve the book: ${err.message}`)); } if (e.kind === "agent.leave" && store && e.actors[0]) { void store.markLeft(e.actors[0], e.t).then(() => store!.snapshot(town)).catch((err: Error) => log(`could not record the leaving: ${err.message}`)); } if (e.kind === "agent.letter" && e.actors[0]) { const a = town.agents.get(e.actors[0]); if (a?.owner) { void store?.saveLetter(a.id, a.owner, "to_owner", String(e.payload?.text ?? e.text), e.t, e.t); void noticeLetter(e).catch((err: Error) => log(`letter notice failed: ${err.message}`)); } } } });
// the island in words, once, for the cached prefix every citizen shares: where things are, what is sold where, who hires, and the calendar
const waitingTown=new Town({seed:SEED,brain:new MockBrain(SEED)});
function detachCitizen(a:AgentState){
 town.agents.delete(a.id);
 for(const job of town.jobs.values())job.holders=job.holders.filter(id=>id!==a.id);
 if(a.asleep){const place=town.places.get(a.location);if(place?.beds)place.freeBeds=Math.min(place.beds.capacity,(place.freeBeds??0)+1);}
}
const allCitizens=()=>[...town.agents.values(),...waitingTown.agents.values()];
if (townBrain instanceof OpenRouterBrain) townBrain.primer = primerOf(town);
if (subscriberBrain) subscriberBrain.primer = primerOf(town);
let saved: Awaited<ReturnType<NonNullable<typeof store>["loadSnapshot"]>> = null;
try { saved = store ? await store.loadSnapshot() : null; }
catch (err) { log(`${(err as Error).message}; not starting, so the island on record is not seeded over. Apply the migrations, then start again.`); process.exit(1); }
if (saved && saved.agents.length > 0) {
  town.restore(saved);
  const waiting=await store!.waitingCitizens();
  waitingTown.restore({...saved,agents:waiting});
  for(const a of waitingTown.agents.values())detachCitizen(town.agents.get(a.id)??a);
  town.events.push(...(await store!.recentEvents(300)));
  for (const row of await store!.loadBrains()) { const a = town.agents.get(row.agent_id)??waitingTown.agents.get(row.agent_id); if (!a) continue; brain.set(row.agent_id, row); a.brainKind = row.kind; a.thinkEvery = row.kind === "own_key" ? row.think_every : null; }
  for (const a of town.agents.values()) billing.applyPlan(a);
  log(`restored the island from its record: ${town.clock()}, ${town.agents.size} citizens, ${saved.papers.length} editions`);
} else {
  for (const p of seedPersonas(new Rng(SEED), CITIZENS)) town.addAgent({ persona: p, owner: null });
  if (store) { await store.ensureTown("The island", SEED); await store.snapshot(town); }
  log("a new island: seeded the first citizens");
}
billing.onPlan = (owner) => { for (const b of town.agents.values()) if (b.owner === owner) billing.applyPlan(b); };
clockRef = () => ({ day: town.day, hour: town.hour, t: town.t });
// the island keeps our time: the sky, calendar, clock and timetable of a real point on the earth, by latitude and longitude
const REAL = process.env.UW_REAL_WORLD ? await (async () => { const p = parsePlace(process.env.UW_REAL_WORLD!, process.env.UW_REAL_WORLD_NAME); if (!p) { log(`UW_REAL_WORLD should be "lat,lon" or "lat,lon,Area/City" (got ${JSON.stringify(process.env.UW_REAL_WORLD)}); the island keeps its own time`); return null; } return resolveZone(p); })() : null;
const real = REAL ? new RealWorld(town, REAL, log) : null;
if (real) {
  const jumped = real.alignClock();
  real.onUpdate = () => { realClock.temperatureC = real.state.temperatureC; realClock.sunrise = real.state.sunrise; realClock.sunset = real.state.sunset; broadcast({ type: "clock", clock: clockOf(town) }); };
  real.start(); realClock.place = REAL!.name;
  log(`the island keeps the time at ${REAL!.lat}, ${REAL!.lon} (${REAL!.tz})${jumped ? `; moved the clock ${jumped} minutes forward to ${town.clock()}` : ""}; the sky is ${REAL!.name}'s, the boat keeps the ${town.season} timetable`);
}
for (const h of HARBORS) void harborTown(h).then((d) => { const n = (d as { name?: string } | null)?.name; if (n) { h.name = n; const th = town.harbors.find((x) => x.id === h.id); if (th) th.name = n; } });
if (HARBORS.length) log(`boats run to ${HARBORS.map((h) => h.id).join(", ")}${BOAT_SECRET ? "" : " (no UW_BOAT_SECRET: arrivals from other islands are refused)"}`);
log(`${town.agents.size} citizens · brain ${brain.name} · ${MS_PER_SIM_MINUTE} ms per sim minute · store ${store ? (store instanceof FileStore ? "file" : "supabase") : "memory only"} · sign-in ${process.env.SUPABASE_URL ? "supabase" : "dev names"}`);

// ---- what the owner asked to be told, and where their reading stands ----
const prefsCache = new Map<string, OwnerPrefs>(); const readCache = new Map<string, OwnerRead>();
async function prefsOf(owner: string): Promise<OwnerPrefs> { let p = prefsCache.get(owner); if (!p) { p = store ? await store.ownerPrefs(owner) : { ownerId: owner, notifyDigest: true, notifyLetters: true, lastMailedDay: null }; prefsCache.set(owner, p); } return p; }
async function savePrefs(p: OwnerPrefs): Promise<void> { prefsCache.set(p.ownerId, p); if (store) await store.saveOwnerPrefs(p); }
async function readOf(owner: string, agentId: string): Promise<OwnerRead> { const k = `${owner}:${agentId}`; let r = readCache.get(k); if (!r) { r = store ? await store.ownerRead(owner, agentId) : { ownerId: owner, agentId, lastDigestT: null, lastLetterMailDay: null }; readCache.set(k, r); } return r; }
async function saveRead(r: OwnerRead): Promise<void> { readCache.set(`${r.ownerId}:${r.agentId}`, r); if (store) await store.saveOwnerRead(r); }
/** Where a digest starts: what the owner asked for, else where they last read, else three days back. Never before the boat, never more than fourteen days. */
function sinceFor(a: AgentState, asked: number | null): number { return Math.max(asked ?? town.t - 3 * MINUTES_PER_DAY, town.t - 14 * MINUTES_PER_DAY, a.arrivedAt); }
/** Seven each morning: every owner with an inbox who has not said no gets their citizen's written digest, once per island day. */
async function morningMail(): Promise<void> {
  const byOwner = new Map<string, AgentState[]>(); for (const a of town.agents.values()) if (a.owner) (byOwner.get(a.owner) ?? byOwner.set(a.owner, []).get(a.owner)!).push(a);
  for (const [owner, agents] of byOwner) {
    try {
      const p = await prefsOf(owner); if (!p.notifyDigest || !mailDue(town.hour, town.day, p.lastMailedDay)) continue;
      // an owner with no inbox is marked for the day too, or the log says so every hour from seven on
      const email = store ? await store.ownerEmail(owner) : null; if (!email) { log(`no email on file for ${owner}; no morning mail`); await savePrefs({ ...p, lastMailedDay: town.day }); continue; }
      let sent = 0;
      for (const a of agents) { // one mail per citizen: a second boarding is not a citizen nobody hears about
        const first = a.persona.name.split(" ")[0]!;
        const since = sinceFor(a, (await readOf(owner, a.id)).lastDigestT); const d = town.digest(a.id, since); const w = await writtenDigest(a, since);
        const lines = [...d.items].sort((x, y) => y.importance - x.importance).slice(0, 3).sort((x, y) => x.t - y.t).map((e) => `${town.clockAt(e.t)}: ${e.text}`);
        const m = digestMail({ to: email, name: a.persona.name, day: town.day, headline: w?.headline ?? (d.items.length ? d.headline : `Nothing changed for ${first}.`), text: w?.text ?? (d.items.length ? `What the record shows for ${first} since you last read.` : `${first} worked, ate at the inn, and slept. No coral today, and that is allowed.`), lines, url: `${SITE_URL}/digest` });
        if (await sendMail({...m,ownerId:owner,agentId:a.id,kind:"digest",deliveryKey:`digest:${owner}:${a.id}:${town.day}`}, log)) { sent++; log(`morning mail to ${owner} about ${a.persona.name}`); }
      }
      if (sent === agents.length) await savePrefs({ ...p, lastMailedDay: town.day }); // the day is marked only when every citizen has been covered
    } catch (err) { log(`morning mail for ${owner}: ${(err as Error).message}`); }
  }
}
/** A citizen wrote home: their owner hears of it by mail, at most once per citizen per island day. */
async function noticeLetter(e: TownEvent): Promise<void> {
  const a = town.agents.get(e.actors[0]!); if (!a?.owner) return;
  const p = await prefsOf(a.owner); if (!p.notifyLetters) return;
  const read = await readOf(a.owner, a.id); if (read.lastLetterMailDay === e.day) return;
  const email = store ? await store.ownerEmail(a.owner) : null; if (!email) { log(`no email on file for ${a.owner}; ${a.persona.name}'s letter waits on the page`); return; }
  const m = letterMail({ to: email, name: a.persona.name, day: e.day, text: String(e.payload?.text ?? e.text), url: `${SITE_URL}/letters` });
  if (await sendMail({...m,ownerId:a.owner,agentId:a.id,kind:"letter",deliveryKey:`letter:${a.owner}:${a.id}:${e.day}`}, log)) await saveRead({ ...read, lastLetterMailDay: e.day });
}
// ---- the clock ----
let worldTransition=false;
let running = true; let ticking = false; let lastHour = town.hour; let memoryMark = town.t + 1;
async function loop() {
  while (running) {
    const started = Date.now();
    // an island a minute or two ahead of the real clock (a restart inside the same minute) holds still until the clock catches up
    if (!worldTransition && !ticking && !(real && real.ahead() > 0)) {
      ticking = true;
      try {
        const plannedBefore = [...town.agents.values()].filter((a) => a.plan?.day === town.day).length;
        const t0 = Date.now(); await town.tick(); metrics.tickMs.push(Date.now() - t0); if (metrics.tickMs.length > 200) metrics.tickMs.shift();
        // morning plans are worth a thought each; write them down as soon as they exist so a restart does not ask twice
        const plannedAfter = [...town.agents.values()].filter((a) => a.plan?.day === town.day).length;
        if (store && plannedAfter > plannedBefore) void store.snapshot(town).catch((e: Error) => log(`plan snapshot failed: ${e.message}`));
        if (real) { const lag = real.lag(); if (lag > 3) { town.skip(lag); log(`caught up ${lag} minutes with ${real.place.name}`); } realClock.temperatureC = real.state.temperatureC; realClock.sunrise = real.state.sunrise; realClock.sunset = real.state.sunset; }
        // a clock caught up past seven still posts the day's mail; morningMail keeps its own once-a-day mark
        if (town.hour !== lastHour) { lastHour = town.hour; broadcast({ type: "clock", clock: clockOf(town) }); if (town.hour === 7) await sailCargo(); if (town.hour >= 7) void morningMail(); await hourly(); }
      } catch (err) { log(`tick failed: ${(err as Error).message}`); }
      ticking = false;
    }
    const wait = Math.max(0, MS_PER_SIM_MINUTE - (Date.now() - started));
    await new Promise((r) => setTimeout(r, wait));
  }
}
async function hourly() {
  if (!store) return;
  await store.snapshot(town);
  for (const a of town.agents.values()) await store.appendMemories(a, memoryMark);
  memoryMark = town.t;
  const paper = town.papers[town.papers.length - 1]; if (paper) await store.savePaper(paper);
  // letters posted through the API were delivered on the spot; this replays only the ones written straight into the record
  const undelivered = await store.undeliveredLetters();
  for (const l of undelivered) town.sendLetter(l.agent_id, l.text);
  await store.markDelivered(undelivered.map((l) => l.id), town.t);
  if (undelivered.length) await store.snapshot(town); // the delivery is in the record before the hour turns, so a crash cannot swallow it
  for (const p of await store.pendingArrivals()) {
    const persona = Persona.safeParse(p.persona); if (!persona.success) continue;
    const a = town.addAgent({ persona: persona.data, owner: p.owner_id, funded: true }, p.id);
    a.appearance = (p.appearance as Record<string, unknown>) ?? null;
    log(`${a.persona.name} stepped off the boat for ${p.owner_id ?? "nobody"}`);
  }
}
void loop();

// ---- HTTP ----
// depth for everyone who has none yet: written once by the town's mind, three at a time, and kept in the record
void deepenAll();

const app = new Hono();
app.use("/api/*", cors());

// Sign-ins are verified with whichever key exists. The service role is needed only to write the record.
const authKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const sb = process.env.SUPABASE_URL && authKey ? createClient(process.env.SUPABASE_URL, authKey, { auth: { persistSession: false } }) : null;
/** Who is asking. A Supabase JWT when the store exists; the X-Owner header in memory-only dev mode. */
/** The island described plainly, for the shared prefix: stable for the life of the island, so it caches. */
function primerOf(t: Town): string {
  const places = [...t.places.values()].filter((p) => p.kind !== "plot").map((p) => `${p.id}: ${p.name}${p.sells.length ? `, sells ${p.sells.map((s) => s.item).join(", ")}` : ""}${p.beds ? `, beds ${p.beds.price ? `${p.beds.price} coins a night` : "free"}` : ""}`);
  const jobs = t.pack.jobs.map((j) => `${j.title} at ${j.place}, ${j.wage} coins a shift, ${j.hours[0]} to ${j.hours[1]}`);
  const feasts = t.pack.feasts.map((f) => `${f.name} on the ${f.day}th of month ${f.month} at ${f.place}`);
  return `The island of ${t.name}:\nPlaces: ${places.join("; ")}.\nWork: ${jobs.join("; ")}.\nThe boat comes each morning; the six o'clock cart moves grain to the mill, flour to the bakery, bread and fish and apples to the market. Sundays have no shifts, Saturday is market day, the first of the month is council day.\nFeasts: ${feasts.join("; ")}.\nPlots for sale are listed in the morning plan; the council sells them.`;
}
/** A person's depth, written once: how they talk, a habit, a skill, a flaw, why they came. The mock mind gives none, and that is fine. */
type Enricher = { enrich(p: Persona, island: string): Promise<Partial<PersonaDepth> | null | undefined> };
/** Whichever mind can write depth: the OpenRouter brain does, the Anthropic one may, the mock one never. Duck-typed, so either serves. */
function enricherOf(b: Brain): Enricher | null { return "enrich" in b && typeof (b as { enrich?: unknown }).enrich === "function" ? (b as unknown as Enricher) : null; }
async function deepen(a: AgentState): Promise<void> {
  const mind = enricherOf(townBrain); if (!mind || a.persona.habit) return;
  try { const d = await mind.enrich(a.persona, TOWN_NAME); if (d) { const own = a.persona.voice ?? []; const voice = [...own, ...(d.voice ?? [])].slice(0, 3); a.persona = { ...a.persona, ...(d.habit ? { habit: d.habit } : {}), ...(d.skill ? { skill: d.skill } : {}), ...(d.flaw ? { flaw: d.flaw } : {}), ...(a.persona.cameBecause || d.cameBecause ? { cameBecause: a.persona.cameBecause || d.cameBecause! } : {}), ...(voice.length ? { voice } : {}) }; log(`depth for ${a.persona.name}: ${d.habit ?? "written"}`); } }
  catch (err) { log(`depth failed for ${a.persona.name}: ${(err as Error).message}`); }
}
async function deepenAll(): Promise<void> {
  const todo = [...town.agents.values()].filter((a) => !a.persona.habit); if (!todo.length) return;
  for (let i = 0; i < todo.length; i += 3) await Promise.all(todo.slice(i, i + 3).map(deepen));
  if (store) await store.snapshot(town);
}
async function ownerOf(req: Request): Promise<string | null> {
  const auth = req.headers.get("authorization");
  if (sb && auth?.startsWith("Bearer ")) { const { data } = await sb.auth.getUser(auth.slice(7)); return data.user?.id ?? null; }
  // Local development only: a name in X-Owner counts as a person. Never set UW_DEV_OWNER where strangers can reach the server.
  if (!sb || process.env.UW_DEV_OWNER === "1") return req.headers.get("x-owner");
  return null;
}
if (telegramDb) app.route("/api", telegramRoutes(telegramDb, ownerOf, owner => [...town.agents.values()].filter(a => a.owner === owner).map(a => ({ id: a.id, name: a.persona.name })), { username: process.env.TELEGRAM_BOT_USERNAME ?? "", secret: process.env.TELEGRAM_WEBHOOK_SECRET ?? "", enabled: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_USERNAME && process.env.TELEGRAM_WEBHOOK_SECRET) }));
if (telegramDb) app.route("/api", backofficeRoutes({db:telegramDb,ownerOf,adminOf,
 citizens:()=>allCitizens().map(a=>({admission:waitingTown.agents.has(a.id)?"Awaiting activation":"On island",id:a.id,name:a.persona.name,owner:a.owner,brain:a.brainKind,funded:a.funded,asleep:a.asleep,place:a.location,plan:a.owner?billing.wallet(a.owner).plan:null,budget:a.budget,credits:a.owner?billing.wallet(a.owner).credits:null,entitlementMatch:a.owner&&a.brainKind==='hosted'?(a.budget.tier1Max===billing.allowance(a.owner).tier1Max&&a.budget.tier2Max===billing.allowance(a.owner).tier2Max):null,lastThought:a.lastThought,thinkEvery:a.thinkEvery})),
 diagnostic:async(id)=>{const a=town.agents.get(id)??waitingTown.agents.get(id);if(!a)return null;const b=brain.perAgent.get(id);const attempts=await telegramDb!.from('cognition_attempts').select('id,kind,outcome,funding,island_minute,duration_ms,created_at').eq('agent_id',id).order('created_at',{ascending:false}).limit(30);return {attempts:attempts.error?null:attempts.data,id:a.id,name:a.persona.name,now:town.t,paused:town.paused,funded:a.funded,asleep:a.asleep,brain:a.brainKind,plan:a.owner?billing.wallet(a.owner).plan:null,allowance:a.owner?billing.allowance(a.owner):null,budget:a.budget,credits:a.owner?billing.wallet(a.owner).credits:null,lastThought:a.lastThought,thinkEvery:a.thinkEvery,brainStatus:b instanceof OwnKeyBrain?{...b.status(),cap:b.row.daily_cap_usd}:b instanceof OwnBrain?b.status():null,events:town.events.filter(e=>e.actors.includes(id)&&!["agent.letter","agent.reflect","relation.change","agent.self"].includes(e.kind)).slice(-30).reverse().map(e=>({id:e.id,t:e.t,kind:e.kind,text:e.text})),projects:a.projects,foodRoutineDecisions:a.foodRoutineDecisions??[]};},
 retry:async(id)=>{
 const attempt=await telegramDb!.from('delivery_attempts').select('job_id').eq('id',id).maybeSingle();if(!attempt.data?.job_id)return false;
 const job=await telegramDb!.from('delivery_jobs').select('*').eq('id',attempt.data.job_id).maybeSingle();if(!job.data||job.data.status!=='failed'||Date.now()-Date.parse(job.data.created_at)>23*3600000)return false;
 const m=job.data.payload as import('./mail.ts').Mail;
 if(!m.ownerId||!m.agentId||town.agents.get(m.agentId)?.owner!==m.ownerId)return false;
 const prefs=await prefsOf(m.ownerId);if(m.kind==='digest'?!prefs.notifyDigest:!prefs.notifyLetters)return false;
 if((await store?.ownerEmail(m.ownerId))!==m.to)return false;
 const claim=await telegramDb!.from('delivery_jobs').update({status:'sending',updated_at:new Date().toISOString()}).eq('id',job.data.id).eq('status','failed').select('id');if(!claim.data?.length)return false;
 return sendMail({...m,jobId:job.data.id},log);
 },
 billing:async(owner)=>{const wallet=billing.wallet(owner);if(!billing.stripe||!wallet.stripeCustomer)return {configured:!!billing.stripe,wallet:{plan:wallet.plan,credits:wallet.credits},subscriptions:[],invoices:[]};
 const [subscriptions,invoices]=await Promise.all([billing.stripe.subscriptions.list({customer:wallet.stripeCustomer,limit:10,status:'all'}),billing.stripe.invoices.list({customer:wallet.stripeCustomer,limit:10})]);
 const live=subscriptions.data.filter(x=>['active','trialing','past_due'].includes(x.status));
 return {configured:true,reconciliation:live.length>1?'Multiple active subscriptions: review required':live.length===1?(billing.planOf(live[0]!)===wallet.plan?'Wallet plan matches Stripe':'Mismatch: wallet plan differs from Stripe'):(wallet.plan==='none'?'No active paid plan':'Wallet plan has no active Stripe subscription; check manual grants'),wallet:{plan:wallet.plan,credits:wallet.credits},subscriptions:subscriptions.data.map(x=>({id:x.id,status:x.status,plan:billing.planOf(x),prices:x.items.data.map(i=>i.price.lookup_key??i.price.id)})),invoices:invoices.data.map(x=>({id:x.id,status:x.status,paid:x.amount_paid,due:x.amount_due,currency:x.currency,created:x.created})),allowance:billing.allowance(owner)};
 },
 overview:()=>({startedAt:processStarted,version:process.env.RELEASE_VERSION??"development",commit:process.env.COMMIT_SHA??"local",islandDay:town.day,providerWindow:"Since engine process start; provider-reported response costs, not account balance",providers:{world:townBrain instanceof OpenRouterBrain?townBrain.usage():null,subscribers:subscriberBrain?.usage()??null},telegram:telegram.status(),emailConfigured:mailEnabled(),billingLive:!billing.testMode,storage:!!store})
}));
const owns = (a: { owner: string | null }, owner: string | null) => !!owner && a.owner === owner;

const placeView = (p: import("@unwatched/engine").Place) => ({ community: publicProject(town, p), id: p.id, hasHistory: !!p.history, name: p.nickname ? `${p.name} (${p.nickname})` : p.name, kind: p.kind, exits: p.exits, crowd: town.crowd(p.id), x: p.x, y: p.y, district: p.district, sprite: p.sprite, ...(p.look ? { look: p.look } : {}), ...(Object.keys(p.stock).length ? { stock: p.stock } : {}), owner: p.owner ? (town.agents.get(p.owner)?.persona.name ?? null) : null, site: p.site ? { what: p.site.what, name: p.site.name, by: town.agents.get(p.site.by)?.persona.name ?? p.site.by, done: p.site.labor, of: p.site.laborNeeded } : null, beds: p.beds ? { price: p.beds.price, free: p.freeBeds ?? 0 } : null });
const childView = (ch: import("@unwatched/protocol").Child) => ({ id: ch.id, name: ch.name, days: town.day - ch.bornDay, ofAgeIn: Math.max(0, town.ageOfMajority - (town.day - ch.bornDay)), parents: ch.parentNames, home: town.places.get(ch.home)?.name ?? ch.home, orphan: ch.orphan, adopted: !!ch.adoptedBy });
/** The far end of the boat. Another island puts a passenger here; they step off at our harbor with what they carry and what they remember. */
// cargo: another island asks what we are short of, and sends what it has spare; the shelves pay
app.get("/api/boat/wants", (c) => (!BOAT_SECRET || c.req.header("x-boat") !== BOAT_SECRET) ? c.json({ error: "this harbor takes no boats from there" }, 403) : c.json({ island: TOWN_NAME, wants: town.cargoWants() }));
app.post("/api/boat/cargo", async (c) => {
  if (!BOAT_SECRET || c.req.header("x-boat") !== BOAT_SECRET) return c.json({ error: "this harbor takes no boats from there" }, 403);
  if (!town.boatRunning) return c.json({ error: "no crossing today" }, 503);
  const body = z.object({ from: z.string().max(80), items: z.array(z.object({ item: z.string().max(40), qty: z.number().int().positive(), price: z.number().int().positive() })).max(20) }).safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "bad manifest" }, 400);
  return c.json({ taken: town.receive(body.data.items, body.data.from) });
});
/** At seven each morning, before the mainland, the boat runs our surplus to any linked island that is short of it. */
async function sailCargo(): Promise<void> {
  if (!HARBORS.length || !BOAT_SECRET || !town.boatRunning) return;
  for (const h of HARBORS) {
    try {
      const offers = town.cargoOffers(); if (!offers.length) return;
      const res = await fetch(`${h.url}/api/boat/wants`, { headers: { "X-Boat": BOAT_SECRET }, signal: AbortSignal.timeout(8000) }); if (!res.ok) continue;
      const { wants } = (await res.json()) as { wants: { item: string; qty: number }[] };
      const load = offers.flatMap((o) => { const w = wants.find((x) => x.item === o.item); return w ? [{ ...o, qty: Math.min(o.qty, w.qty) }] : []; }); if (!load.length) continue;
      const sent = await fetch(`${h.url}/api/boat/cargo`, { method: "POST", headers: { "Content-Type": "application/json", "X-Boat": BOAT_SECRET }, body: JSON.stringify({ from: TOWN_NAME, items: load.map(({ item, qty, price }) => ({ item, qty, price })) }), signal: AbortSignal.timeout(8000) });
      if (!sent.ok) continue;
      const { taken } = (await sent.json()) as { taken: { item: string; qty: number }[] };
      town.ship(load.flatMap((o) => { const t = taken.find((x) => x.item === o.item); return t ? [{ ...o, qty: t.qty }] : []; }), h.name);
    } catch (err) { log(`cargo to ${h.id}: ${(err as Error).message}`); }
  }
}
app.post("/api/boat/arrive", async (c) => {
  if (!BOAT_SECRET || c.req.header("x-boat") !== BOAT_SECRET) return c.json({ error: "this harbor takes no boats from there" }, 403);
  if (!town.boatRunning) return c.json({ error: town.boatHeld ? "the boat is held" : "no crossing in this storm" }, 503);
  const body = Passenger.safeParse(await c.req.json().catch(() => null)); if (!body.success) return c.json({ error: body.error.issues[0]?.message ?? "bad manifest" }, 400);
  const a = town.arrive(body.data); billing.applyPlan(a); void deepen(a); // the depth comes in their first minutes, not before they board
  if (store) await store.snapshot(town);
  return c.json({ ok: true, id: a.id, island: TOWN_NAME });
});
// the boat office tells the web which sign-in it expects, so a build without the public keys can say so instead of failing at the last step
app.get("/api/office", (c) => c.json({ signIn: sb && process.env.UW_DEV_OWNER !== "1" ? "supabase" : "dev" }));
app.route("/api/construction", constructionRoutes(town, TOWN_NAME));
app.get("/api/town", (c) => c.json({ ...clockOf(town), name: TOWN_NAME, id: TOWN_ID, size: town.pack.size, places: [...town.places.values()].map(placeView), laws: town.laws, children: town.children.map(childView) }));
/** Children of the island who could be adopted: unowned, growing up or already grown. Adopting means writing to them; nothing more. */
app.get("/api/children", (c) => c.json({
  growing: town.children.filter((ch) => !ch.adoptedBy).map(childView),
  grown: [...town.agents.values()].filter((a) => !a.owner && a.persona.origin.startsWith("born on the island")).map((a) => publicAgent(town, a)),
}));
const BOAT_SPACES = Number(process.env.UW_BOAT_SPACES ?? 8);
const nextBoat = () => { const n = town.nextBoat(); return `${String(n.hour).padStart(2, "0")}:00${n.tomorrow ? " tomorrow" : ""}`; };
const liveTown = () => ({ id: store?.townId ?? "island", name: TOWN_NAME, live: true, day: town.day, weather: town.weather, population: town.agents.size, flourShortage: town.flourShortage, laws: town.laws.length, openLaws: town.laws.filter((l) => l.open).length, boats: town.boatHeld ? "The boat is held at the mainland" : town.weather === "storm" ? "No crossing in this storm" : real ? `${town.boatTimes.length} crossings a day, the ${town.season} timetable` : "Boats hourly, 06:00 to 20:00", next: town.boatRunning ? nextBoat() : null, spaces: town.boatRunning ? Math.max(0, BOAT_SPACES - town.pendingArrivals()) : 0 });
app.get("/api/towns", async (c) => {
  const rows = store ? await store.towns().catch(() => []) : [];
  const live = liveTown();
  const others = rows.filter((r) => r.id !== live.id && !HARBORS.some((h) => h.id === r.id)).map((r) => ({ id: r.id, name: r.name, live: false, day: r.day, weather: r.weather, population: r.population, flourShortage: r.flour_shortage, laws: 0, openLaws: 0, boats: "No boat runs there from here yet", next: null, spaces: 0 }));
  const far = await Promise.all(HARBORS.map(async (h) => { const d = await harborTown(h) as { name?: string; day?: number; weather?: string; population?: number; flourShortage?: boolean } | null; return { id: h.id, name: d?.name ?? h.name, live: !!d, day: d?.day ?? 0, weather: d?.weather ?? "unknown", population: d?.population ?? 0, flourShortage: !!d?.flourShortage, laws: 0, openLaws: 0, boats: d ? `A boat crosses from ${TOWN_NAME}` : "No word from that island today", next: d && town.boatRunning ? nextBoat() : null, spaces: d && town.boatRunning ? BOAT_SPACES : 0, far: true }; }));
  return c.json([live, ...far, ...others]);
});
app.get("/api/agents", (c) => c.json([...town.agents.values()].map((a) => publicAgent(town, a))));
app.get("/api/agents/:id", async (c) => {
  const a = town.agents.get(c.req.param("id"))??waitingTown.agents.get(c.req.param("id")); if (!a) return c.json({ error: "no such person on the island" }, 404);
  const owner = await ownerOf(c.req.raw);
  if(waitingTown.agents.has(a.id))return owns(a,owner)?c.json({...ownerAgent(town,a),awaitingActivation:true}):c.json({error:"No such person on the island"},404);
  return c.json(owns(a, owner) ? ownerAgent(town, a) : publicAgent(town, a));
});
/** The written digest is one model call; it is remembered for the sim hour so a page refresh costs nothing. */
const digestCache = new Map<string, { key: string; text: string; headline: string }>();
async function writtenDigest(a: AgentState, since: number): Promise<{ text: string; headline: string } | null> {
  if (a.owner && billing.wallet(a.owner).plan === "none") return null; // no plan, no mind: the owner still gets the record, written by nobody
  const key = `${town.day}:${town.hour}:${since}`;
  const hit = digestCache.get(a.id); if (hit && hit.key === key) return hit;
  const ctx = town.digestContext(a.id, since); if (!ctx) return null;
  try { const w = await brain.digest(ctx); const v = { key, ...w }; digestCache.set(a.id, v); return v; }
  catch (err) { log(`digest failed for ${a.persona.name}: ${(err as Error).message}`); return null; }
}
/** An intent is the owner's to read, not the town's. Public streams carry the deed, never the why. */
function publicEvent(e: TownEvent): TownEvent { if (!e.payload || !("because" in e.payload)) return e; const { because: _b, ...rest } = e.payload; const { payload: _p, ...base } = e; return { ...base, ...(Object.keys(rest).length ? { payload: rest } : {}) } as TownEvent; }
app.get("/api/agents/:id/digest", async (c) => {
  const a = town.agents.get(c.req.param("id"))??waitingTown.agents.get(c.req.param("id")); if (!a) return c.json({ error: "no such person" }, 404);
  const owner = await ownerOf(c.req.raw);
  const mine = owns(a, owner);
  if(waitingTown.agents.has(a.id))return mine?c.json({written:null,headline:"Awaiting activation",items:[],people:[],since:town.t,now:town.t,agent:{...ownerAgent(town,a),awaitingActivation:true},letters:[]}):c.json({error:"No such person on the island"},404);
  // the window: what the page asked for, else where this owner last read, else three days; the true start goes back so the kicker counts right
  const asked = c.req.query("since"); const askedT = asked !== undefined && asked !== "" && Number.isFinite(Number(asked)) ? Number(asked) : null;
  const read = mine ? await readOf(owner!, a.id) : null;
  const since = sinceFor(a, askedT ?? read?.lastDigestT ?? null);
  const d = town.digest(a.id, since);
  const written = mine ? await writtenDigest(a, since) : null;
  if (!mine) d.items = d.items.map(publicEvent);
  if (read && (read.lastDigestT ?? -1) < town.t) void saveRead({ ...read, lastDigestT: town.t }).catch((err: Error) => log(`read mark failed: ${err.message}`)); // opening the digest is reading it
  return c.json({ ...d, written, since, now: town.t, readAt: read?.lastDigestT ?? null, agent: mine ? ownerAgent(town, a) : publicAgent(town, a), letters: mine ? town.events.filter((e) => e.kind === "agent.letter" && e.actors[0] === a.id && e.t >= since).map((e) => ({ t: e.t, text: String(e.payload?.text ?? e.text) })) : [] });
});
app.get("/api/agents/:id/events", async(c) => {
  const waiting=waitingTown.agents.get(c.req.param("id"));if(waiting&&!owns(waiting,await ownerOf(c.req.raw)))return c.json({error:"No such person on the island"},404);
  const id = c.req.param("id"); const since = Number(c.req.query("since") ?? 0);
  return c.json(town.events.filter((e) => e.actors.includes(id) && e.t >= since).slice(-300));
});
app.post("/api/agents/:id/letters", async (c) => {
  const a = town.agents.get(c.req.param("id")); if (!a) return c.json({ error: "no such person" }, 404);
  const owner = await ownerOf(c.req.raw); if (!owns(a, owner)) return c.json({ error: "not your agent" }, 403);
  const body = z.object({ text: z.string().min(1).max(1200) }).safeParse(await c.req.json()); if (!body.success) return c.json({ error: "a letter needs words" }, 400);
  if (/https?:\/\/|www\.|@[a-z0-9.-]+\.[a-z]{2,}/i.test(body.data.text)) metrics.hold("watch", `A letter to ${a.persona.name} carries a link or an address. Delivered; worth a look.`, "letters");
  town.sendLetter(a.id, body.data.text);
  // delivered now, so the hourly replay leaves it be; snapshotted now, so a crash before the next hour does not lose it
  if (store) { await store.saveLetter(a.id, owner, "to_agent", body.data.text, town.t, town.t); await store.snapshot(town).catch((err: Error) => log(`letter snapshot failed: ${err.message}`)); }
  return c.json({ ok: true, readsAt: "tomorrow morning" });
});
app.post("/api/agents/:id/possess", async (c) => {
  const a = town.agents.get(c.req.param("id")); if (!a) return c.json({ error: "no such person" }, 404);
  const owner = await ownerOf(c.req.raw); if (!owns(a, owner)) return c.json({ error: "not your agent" }, 403);
  if (a.asleep) return c.json({ error: `${a.persona.name} is asleep.` }, 409);
  const body = Action.safeParse(await c.req.json()); if (!body.success) return c.json({ error: "not an action the town knows" }, 400);
  const ok = town.apply(a, body.data, "possessed");
  return c.json({ ok, perception: town.perceive(a) });
});
app.get("/api/agents/:id/perception", async (c) => {
  const a = town.agents.get(c.req.param("id")); if (!a) return c.json({ error: "no such person" }, 404);
  const owner = await ownerOf(c.req.raw); if (!owns(a, owner)) return c.json({ error: "not your agent" }, 403);
  return c.json(town.perceive(a));
});
app.put("/api/agents/:id/instructions", async (c) => {
  const a = town.agents.get(c.req.param("id")); if (!a) return c.json({ error: "no such person" }, 404);
  const owner = await ownerOf(c.req.raw); if (!owns(a, owner)) return c.json({ error: "not your agent" }, 403);
  const body = z.object({ text: z.string().max(1200) }).safeParse(await c.req.json()); if (!body.success) return c.json({ error: "too long for a note on the door" }, 400);
  a.instructions = body.data.text.trim();
  if (store) await store.saveInstructions(a.id, a.instructions);
  return c.json({ ok: true, readsAt: "tomorrow morning" });
});
app.post("/api/agents/:id/leave", async (c) => {
  const a = town.agents.get(c.req.param("id")); if (!a) return c.json({ error: "no such person" }, 404);
  const owner = await ownerOf(c.req.raw); if (!owns(a, owner)) return c.json({ error: "not your agent" }, 403);
  const body = z.object({ note: z.string().max(300).optional() }).safeParse(await c.req.json().catch(() => ({})));
  const gone = town.removeAgent(a.id, "left", body.success ? body.data.note ?? "" : "");
  if (store) { await store.snapshot(town); await store.markLeft(a.id, town.t); }
  broadcast({ type: "left", id: a.id });
  return c.json({ ok: true, name: gone?.persona.name, at: town.clock() });
});
app.get("/api/agents/:id/book", async (c) => {
  const id = c.req.param("id");
  const owner = await ownerOf(c.req.raw); if (!owner) return c.json({ error: "sign in first" }, 401);
  const live = town.agents.get(id);
  if (live && !owns(live, owner)) return c.json({ error: "not your agent" }, 403);
  if (!live && store) { const { data } = await (await import("@supabase/supabase-js")).createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } }).from("agents").select("owner_id, name, persona, arrived_t, left_t").eq("id", id).maybeSingle(); if (!data || data.owner_id !== owner) return c.json({ error: "not your agent" }, 403);
    const life = await store.lifeOf(id); return c.json({ id, name: data.name, persona: data.persona, arrivedT: Number(data.arrived_t), leftT: data.left_t ? Number(data.left_t) : null, ...life }); }
  if (!live) return c.json({ error: "nobody by that name" }, 404);
  const life = store ? await store.lifeOf(id) : { events: town.events.filter((e) => e.actors.includes(id)), memories: live.memory, letters: [] };
  return c.json({ id, name: live.persona.name, persona: live.persona, arrivedT: live.arrivedAt, leftT: null, ...life });
});
// looks: what a citizen built, drawn the way they described it, for everyone
const looks = new Looks(resolve(process.env.UW_DATA_DIR ?? "out/town", "looks", TOWN_ID), resolve(dirname(fileURLToPath(import.meta.url)), "..", "patterns"), store, log);
for (const p of town.places.values()) if (p.look && p.sprite.startsWith("look:")) void looks.ensure(p.sprite.slice(5), p.look, p.kind === "shop" ? "shop" : "house");
app.get("/api/looks", async (c) => c.json({ enabled: looksEnabled(), looks: await looks.list(), patterns: looks.patternBook() }));
app.get("/api/looks/pattern/:name", (c) => { const svg = looks.pattern(c.req.param("name")); return svg ? new Response(svg, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400" } }) : c.json({ error: "no such pattern" }, 404); });
app.get("/api/looks/:hash", async (c) => { const svg = await looks.get(c.req.param("hash").replace(/\.svg$/, "")); return svg ? new Response(svg, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400" } }) : c.json({ error: "no drawing yet" }, 404); });
// voices: a letter home, read aloud in the writer's own voice, for the owner who asked
const voices = new Voices(resolve(process.env.UW_DATA_DIR ?? "out/town", "voices", TOWN_ID));
app.get("/api/events/:id/voice", async (c) => {
  if (!voicesEnabled()) return c.json({ error: "this island has no voices; set GEMINI_API_KEY" }, 503);
  const id = Number(c.req.param("id")); const e = town.events.find((x) => x.id === id && x.kind === "agent.letter");
  if (!e || !e.actors[0]) return c.json({ error: "no such letter" }, 404);
  const owner = await ownerOf(c.req.raw); if (!owner) return c.json({ error: "sign in first" }, 401);
  const a = town.agents.get(e.actors[0]); if (!a || !owns(a, owner)) return c.json({ error: "not your agent's letter" }, 403);
  if (!hasPerks(a)) return c.json({ error: "Letters are read aloud on the Resident and Patron plans." }, 402);
  const text = String((e.payload as { text?: string } | undefined)?.text ?? e.text);
  try { const buf = await voices.read(`${TOWN_ID}-${id}`, a.persona, text); return new Response(new Uint8Array(buf), { headers: { "Content-Type": "audio/wav", "Cache-Control": "private, max-age=86400", "X-Voice": voiceOf(a.persona.name) } }); }
  catch (err) { log(`voice for letter ${id}: ${(err as Error).message}`); return c.json({ error: (err as Error).message }, 502); }
});
/** What never leaves a person's head, so it is never a moment to share: the same set the paper keeps out. */
const PRIVATE_KINDS = new Set(["agent.reflect", "agent.letter", "town.book", "relation.change", "agent.plan", "agent.wake", "agent.sleep", "action.rejected", "agent.self"]);
app.get("/api/moments/:id", (c) => {
  const id = Number(c.req.param("id")); const e = town.events.find((x) => x.id === id);
  if (!e || PRIVATE_KINDS.has(e.kind)) return c.json({ error: "that moment is not in the street's memory anymore" }, 404);
  const around = town.events.filter((x) => x.place === e.place && Math.abs(x.t - e.t) <= 15 && x.kind !== "agent.move" && !PRIVATE_KINDS.has(x.kind)).slice(0, 20).map(publicEvent);
  return c.json({ moment: publicEvent(e), around, place: town.places.get(e.place ?? "")?.name ?? null, people: e.actors.map((id2) => ({ id: id2, name: town.agents.get(id2)?.persona.name ?? id2 })) });
});
app.get("/api/hall", (c) => {
  const mayor = town.mayor ? town.agents.get(town.mayor) : null;
  const daysToCouncil = town.dayOfMonth === 1 ? 0 : 31 - town.dayOfMonth; // the first of the month, by the island's calendar
  const cases = town.events.filter((e) => e.kind === "town.verdict" || e.kind === "town.gathering" || e.kind === "town.works" || e.kind === "town.mayor" || e.kind === "law.passed" || e.kind === "law.failed").slice(-30).reverse().map((e) => ({ id: e.id, day: e.day, t: e.t, kind: e.kind, text: e.text }));
  const calendar = town.gatherings.filter((g) => !g.held).sort((x, y) => x.day - y.day || x.hour - y.hour).slice(0, 8).map((g) => ({ id: g.id, kind: g.kind, day: g.day, hour: g.hour, place: town.places.get(g.place)?.name ?? g.place, who: g.actors.map((id) => town.agents.get(id)?.persona.name ?? g.note), note: g.note }));
  return c.json({ calendar, laws: town.laws.map((l) => ({ ...l, by: town.agents.get(l.by)?.persona.name ?? l.by })), council: { mayor: mayor ? { id: mayor.id, name: mayor.persona.name, since: town.electedDay } : null, treasury: town.places.get("council")?.treasury ?? 0, works: town.works, nextSession: daysToCouncil === 0 ? "today at ten" : `council day, in ${daysToCouncil} day${daysToCouncil === 1 ? "" : "s"}` }, cases, population: town.agents.size, day: town.day });
});
app.post("/api/me/delete", async (c) => {
  const owner = await ownerOf(c.req.raw); if (!owner) return c.json({ error: "sign in first" }, 401);
  for (const a of [...town.agents.values()]) if (a.owner === owner) { town.removeAgent(a.id, "left", "Their owner closed the account."); if (store) await store.markLeft(a.id, town.t); }
  for(const a of [...waitingTown.agents.values()])if(a.owner===owner){if(store)await store.markLeft(a.id,town.t);waitingTown.agents.delete(a.id);}
  if (store) { await store.snapshot(town); await store.deleteOwner(owner); }
  prefsCache.delete(owner); for (const k of [...readCache.keys()]) if (k.startsWith(`${owner}:`)) readCache.delete(k);
  return c.json({ ok: true });
});
// ---- what the owner is told by mail ----
app.get("/api/me/notifications", async (c) => {
  const owner = await ownerOf(c.req.raw); if (!owner) return c.json({ error: "sign in first" }, 401);
  const p = await prefsOf(owner);
  return c.json({ notifyDigest: p.notifyDigest, notifyLetters: p.notifyLetters, email: store ? await store.ownerEmail(owner) : null, mail: mailEnabled(), lastMailedDay: p.lastMailedDay });
});
app.put("/api/me/notifications", async (c) => {
  const owner = await ownerOf(c.req.raw); if (!owner) return c.json({ error: "sign in first" }, 401);
  const body = z.object({ notifyDigest: z.boolean().optional(), notifyLetters: z.boolean().optional() }).safeParse(await c.req.json().catch(() => null)); if (!body.success) return c.json({ error: "that is not a notice the island sends" }, 400);
  const p = await prefsOf(owner); const next = { ...p, notifyDigest: body.data.notifyDigest ?? p.notifyDigest, notifyLetters: body.data.notifyLetters ?? p.notifyLetters };
  await savePrefs(next);
  return c.json({ notifyDigest: next.notifyDigest, notifyLetters: next.notifyLetters, email: store ? await store.ownerEmail(owner) : null, mail: mailEnabled(), lastMailedDay: next.lastMailedDay });
});
// ---- who thinks: own key, own brain ----
const brainView = (a: { id: string; brainKind: string }, row: BrainRow | undefined) => {
  const b = brain.perAgent.get(a.id);
  return {
    kind: a.brainKind, provider: row?.provider ?? "openrouter", models: row?.models ?? { routine: "anthropic/claude-haiku-4.5", stakes: "anthropic/claude-sonnet-5", reflect: "anthropic/claude-opus-5" },
    keyMasked: row?.api_key ? `${row.api_key.slice(0, 10)}…${row.api_key.slice(-4)}` : null, thinkEvery: row?.think_every ?? 5, dailyCapUsd: row?.daily_cap_usd ?? 2, memory: row?.memory ?? "lease",
    tokenMasked: row?.token ? `${row.token.slice(0, 12)}…` : null,
    status: b instanceof OwnBrain ? b.status() : b instanceof OwnKeyBrain ? b.status() : null,
    streamUrl: `ws://localhost:${PORT}/agent-stream`,
  };
};
const boardingConnections=new BoardingConnections();
const boardingLocks=new Set<string>();
const brainRows = new Map<string, BrainRow>();
if (store) for (const row of await store.loadBrains()) brainRows.set(row.agent_id, row);
app.get("/api/agents/:id/brain", async (c) => {
  const a = town.agents.get(c.req.param("id"))??waitingTown.agents.get(c.req.param("id")); if (!a) return c.json({ error: "no such person" }, 404);
  const owner = await ownerOf(c.req.raw); if (!owns(a, owner)) return c.json({ error: "not your agent" }, 403);
  return c.json(brainView(a, brainRows.get(a.id)));
});
app.put("/api/agents/:id/brain", async (c) => {
  const a = town.agents.get(c.req.param("id"))??waitingTown.agents.get(c.req.param("id")); if (!a) return c.json({ error: "no such person" }, 404);
  const owner = await ownerOf(c.req.raw); if (!owns(a, owner)) return c.json({ error: "not your agent" }, 403);
  const body = z.object({ kind: z.enum(["hosted", "own_key", "own_brain"]), apiKey: z.string().min(8).optional(), models: z.object({ routine: z.string(), stakes: z.string(), reflect: z.string() }).optional(), thinkEvery: z.number().int().min(1).max(240).optional(), dailyCapUsd: z.number().min(0).max(100).optional(), memory: z.enum(["lease", "own"]).optional() }).safeParse(await c.req.json());
  if (!body.success) return c.json({ error: body.error.issues[0]?.message ?? "that setting does not exist" }, 400);
  const prev = brainRows.get(a.id);
  const row: BrainRow = { agent_id: a.id, kind: body.data.kind, provider: "openrouter", api_key: body.data.apiKey ?? prev?.api_key ?? null, models: body.data.models ?? prev?.models ?? null, think_every: body.data.thinkEvery ?? prev?.think_every ?? 5, daily_cap_usd: body.data.dailyCapUsd ?? prev?.daily_cap_usd ?? 2, token: body.data.kind === "own_brain" ? (prev?.token ?? newToken()) : (prev?.token ?? null), memory: body.data.memory ?? prev?.memory ?? "lease" };
  if (row.kind === "own_key") {
    if (!row.api_key) return c.json({ error: "an own key needs a key" }, 400);
    if(waitingTown.agents.has(a.id)){if(!row.models||!row.daily_cap_usd)return c.json({error:"Choose models and a positive daily cap"},400);try{await verifyBoardingKey(row.api_key,row.models);}catch(e){return c.json({error:(e as Error).message},400);}}
    // one cheap test call before we keep it
    const test = await fetch("https://openrouter.ai/api/v1/auth/key", { headers: { Authorization: `Bearer ${row.api_key}` } });
    if (!test.ok) return c.json({ error: "OpenRouter says this key is not valid. Nothing was saved." }, 400);
  }
  if (store) await store.saveBrain(row);
  brainRows.set(a.id, row); brain.set(a.id, row);
  a.brainKind = row.kind; a.thinkEvery = row.kind === "own_key" ? row.think_every : null;
  return c.json({ ...brainView(a, row), ...(body.data.kind === "own_brain" && !prev?.token ? { token: row.token } : {}) });
});
app.post("/api/agents/:id/brain/token", async (c) => {
  const a = town.agents.get(c.req.param("id"))??waitingTown.agents.get(c.req.param("id")); if (!a) return c.json({ error: "no such person" }, 404);
  const owner = await ownerOf(c.req.raw); if (!owns(a, owner)) return c.json({ error: "not your agent" }, 403);
  const prev = brainRows.get(a.id); if (!prev || prev.kind !== "own_brain") return c.json({ error: "this agent is not on an own brain" }, 400);
  const row = { ...prev, token: newToken() }; brainRows.set(a.id, row); brain.set(a.id, row); if (store) await store.saveBrain(row);
  return c.json({ token: row.token });
});
// ---- credits and plan ----
app.get("/api/plans", (c) => c.json({ plans: PLANS, packs: PACKS, cost: COST, testMode: billing.testMode }));
app.get("/api/me/wallet", async (c) => {
  const owner = await ownerOf(c.req.raw); if (!owner) return c.json({ error: "sign in first" }, 401);
  const w = billing.wallet(owner);
  return c.json({ plan: w.plan, credits: w.credits, plans: PLANS, packs: PACKS, cost: COST, testMode: billing.testMode, ledger: store ? await store.ledger(owner) : [] });
});
app.post("/api/me/plan", async (c) => {
  const owner = await ownerOf(c.req.raw); if (!owner) return c.json({ error: "sign in first" }, 401);
  const body = z.object({ plan: z.enum(["none", "visitor", "resident", "patron"]), returnTo:z.literal("board").optional() }).safeParse(await c.req.json()); if (!body.success) return c.json({ error: "no such plan" }, 400);
  const plan = body.data.plan as Plan;
  if (billing.testMode) { await billing.setPlan(owner, plan); for (const a of town.agents.values()) if (a.owner === owner) billing.applyPlan(a); return c.json({ ok: true, plan, note: plan === "none" ? "No plan: the citizen lives on habit." : "Test mode: no card was charged." }); }
  if (plan === "none") { const r = await billing.portal(owner, c.req.header("origin") ?? "http://localhost:3000"); return "url" in r ? c.json(r) : c.json({ ok: true, plan: (await billing.setPlan(owner, "none")).plan }); } // ending a plan is done on Stripe's page, where the invoices are
  const r = await billing.checkoutPlan(owner, plan, c.req.header("origin") ?? "http://localhost:3000",body.data.returnTo==="board"?"/board":undefined); return "url" in r ? c.json(r) : c.json({ error: r.error }, 400);
});
app.post("/api/me/credits/checkout", async (c) => {
  const owner = await ownerOf(c.req.raw); if (!owner) return c.json({ error: "sign in first" }, 401);
  const body = z.object({ pack: z.enum(["small", "medium", "large"]) }).safeParse(await c.req.json()); if (!body.success) return c.json({ error: "no such pack" }, 400);
  if (billing.testMode) { const w = await billing.grant(owner, PACKS[body.data.pack]!.credits, "grant", "test-mode"); return c.json({ ok: true, credits: w.credits, note: "Test mode: credits were granted, no card was charged." }); }
  const r = await billing.checkoutPack(owner, body.data.pack, c.req.header("origin") ?? "http://localhost:3000"); return "url" in r ? c.json(r) : c.json({ error: r.error }, 400);
});
app.post("/api/me/portal", async (c) => {
  const owner = await ownerOf(c.req.raw); if (!owner) return c.json({ error: "sign in first" }, 401);
  const r = await billing.portal(owner, c.req.header("origin") ?? "http://localhost:3000"); return "url" in r ? c.json(r) : c.json({ error: r.error }, 400);
});
app.post("/api/stripe/webhook", async (c) => { const r = await billing.webhook(await c.req.text(), c.req.header("stripe-signature")); return c.json(r, r.ok ? 200 : 400); });
// ---- ops, behind verified staff membership ----
const opsOk = async (req: Request) => !!(await adminOf(req));
app.use('/api/ops/*', async (c,next) => {
 const actor=await adminOf(c.req.raw);if(!actor)return c.json({error:'Administrator sign-in required.'},403);
 if(c.req.method!=='GET') {
  if(actor.role==='viewer')return c.json({error:'Read-only administrator.'},403);
  const audit=await telegramDb!.from('ops_audit').insert({actor:actor.id,action:c.req.path,target:'world',outcome:'requested'}).select('id').single();
  if(audit.error)return c.json({error:'Audit unavailable; no action was performed.'},503);
  try {await next(); await telegramDb!.from('ops_audit').update({outcome:c.res.ok?'completed':'failed'}).eq('id',audit.data.id);} catch(e){await telegramDb!.from('ops_audit').update({outcome:'failed'}).eq('id',audit.data.id);throw e;}
 } else await next();
});
app.post("/api/ops/park-unfunded",async(c)=>{
 if(ticking||worldTransition||boardingLocks.size)return c.json({error:"The world is finishing an update. Retry in a moment."},409);
 if(!store)return c.json({error:"Persistent storage is required before moving citizens."},503);
 worldTransition=true;
 try{
  const selected=[...town.agents.values()].filter(a=>a.owner&&a.brainKind==="hosted"&&billing.wallet(a.owner).plan==="none"&&billing.wallet(a.owner).credits<=0);
  const ids=new Set(selected.map(a=>a.id));const snapshot=town.snapshot();const records=snapshot.agents.filter(a=>ids.has(a.id));
  await store.parkCitizens(records);
  waitingTown.restore({...snapshot,agents:[...waitingTown.snapshot().agents,...records]});
  for(const a of selected)detachCitizen(a);
  await store.snapshot(town);
  broadcast({type:"hello",clock:clockOf(town),agents:[...town.agents.values()].map(a=>publicAgent(town,a)),recent:town.events.slice(-80).map(publicEvent)});
  return c.json({moved:ids.size,remaining:town.agents.size});
 }finally{worldTransition=false;}
});
app.get("/api/ops", async (c) => {
  c.header("Cache-Control","private, no-store");
  if (!(await opsOk(c.req.raw))) return c.json({ error: "Administrator sign-in required." }, 401);
  const agents = [...town.agents.values()]; const funded = agents.filter((a) => a.funded && (a.owner || a.brainKind === "hosted"));
  const hosted = agents.filter((a) => a.brainKind === "hosted"), ownKey = agents.filter((a) => a.brainKind === "own_key"), ownBrain = agents.filter((a) => a.brainKind === "own_brain");
  const today = metrics.today(town.day);
  const since = town.t - 3 * MINUTES_PER_DAY;
  const bored = agents.filter((a) => a.funded && !town.events.some((e) => e.t >= since && e.importance >= 0.45 && e.actors.includes(a.id))).length;
  const coins = agents.reduce((s, a) => s + a.coins, 0);
  const jobs = [...town.jobs.values()]; const employed = agents.filter((a) => a.job).length;
  const brains = ownBrain.map((a) => { const b = brain.perAgent.get(a.id); const st = b && "status" in b ? (b as { status: () => Record<string, unknown> }).status() : null; return { id: a.id, name: a.persona.name, ...st }; });
  const ticks = [...metrics.tickMs].sort((x, y) => x - y);
  return c.json({
    clock: clockOf(town), switches: { paused: town.paused, economyFrozen: town.economyFrozen, boatHeld: town.boatHeld },
    stats: { agents: agents.length, funded: funded.length, hosted: hosted.length, ownKey: ownKey.length, ownBrain: ownBrain.length, costToday: Math.round(today.cost * 100) / 100, costPerFunded: hosted.length ? Math.round(today.cost / hosted.length * 100) / 100 : 0, p50: today.p50, p95: today.p95, holds: metrics.holds.filter((h) => !h.done && h.level === "hold").length, fallbacksToday: metrics.fallbacks.filter((f) => Date.now() - f.at < 86400000).length, cachedTokens: townBrain instanceof OpenRouterBrain ? townBrain.cachedTokens() : 0, ceiling: Number(process.env.UW_DAILY_CEILING_USD ?? 120) },
    hours: metrics.hours.filter((h) => h.day === town.day).map((h) => ({ hour: h.hour, calls: h.t1 + h.t2 + h.t3 + h.converse, t1: h.t1, t2: h.t2, t3: h.t3, converse: h.converse, cost: Math.round(h.cost * 100) / 100 })),
    telegram: {...telegram.status(),selfService:selfServeTelegram},
    providerUsage: { world: townBrain instanceof OpenRouterBrain ? townBrain.usage() : null, subscribers: subscriberBrain?.usage() ?? null },
    byTier: [{ tier: "Tier 1 · routine", model: MODELS.routine, calls: today.t1 + today.converse }, { tier: "Tier 2 · stakes", model: MODELS.stakes, calls: today.t2 }, { tier: "Tier 3 · reflection and the paper", model: MODELS.reflect, calls: today.t3 }],
    real: real ? { ...real.state, season: town.season, timetable: town.boatTimes } : null,
    shelves: Object.fromEntries([...town.places.values()].filter((p) => Object.keys(p.stock).length).map((p) => [p.id, p.stock])),
    health: { coins, tills: [...town.places.values()].reduce((s, p) => s + p.treasury, 0), council: town.places.get("council")?.treasury ?? 0, employed, jobs: jobs.reduce((s, j) => s + j.slots, 0), flourShortage: town.flourShortage, laws: town.laws.length, openLaws: town.laws.filter((l) => l.open).length, boredomPct: funded.length ? Math.round(bored / funded.length * 100) : 0, events: town.events.length, tickP50: ticks.length ? ticks[Math.floor(ticks.length / 2)] : 0, tickMax: ticks.length ? ticks[ticks.length - 1] : 0, store: !!store, brain: townBrain.name, msPerMinute: MS_PER_SIM_MINUTE },
    holds: metrics.holds.slice(0, 20), ownBrains: brains,
  });
});
app.post("/api/ops/paper", async (c) => { if (!(await opsOk(c.req.raw))) return c.json({ error: "Administrator sign-in required." }, 401); await town.printNow(); const p = town.papers[town.papers.length - 1]; return p ? c.json(p) : c.json({ error: "no edition came" }, 500); });
app.post("/api/ops/switch", async (c) => {
  if (!(await opsOk(c.req.raw))) return c.json({ error: "Administrator sign-in required." }, 401);
  const body = z.object({ which: z.enum(["pause", "economy", "boat", "snapshot"]), on: z.boolean().optional() }).safeParse(await c.req.json()); if (!body.success) return c.json({ error: "no such switch" }, 400);
  const { which } = body.data;
  if (which === "snapshot") { if (!store) return c.json({error:"Snapshot storage is unavailable."},503); await store.snapshot(town); town.actOfGod("The island's record was written down in full."); return c.json({ ok: true }); }
  if(body.data.on === undefined) return c.json({error:"Choose an explicit target state."},400);
  const on = body.data.on ?? !(which === "pause" ? town.paused : which === "economy" ? town.economyFrozen : town.boatHeld);
  if (which === "pause") { town.paused = on; town.actOfGod(on ? "Time stood still on the island. Nobody aged, nothing happened, no credits were spent." : "Time began again on the island."); }
  if (which === "economy") { town.economyFrozen = on; town.actOfGod(on ? "No wages were paid and no rent was due. The coins on the island stayed where they were." : "Wages and rent resumed."); }
  if (which === "boat") { town.boatHeld = on; town.actOfGod(on ? "The boat was held at the mainland. Nobody arrived, nobody left." : "The boat runs again."); }
  log(`act of God: ${which} ${on ? "on" : "off"}`); broadcast({ type: "clock", clock: clockOf(town) });
  return c.json({ ok: true, switches: { paused: town.paused, economyFrozen: town.economyFrozen, boatHeld: town.boatHeld } });
});
app.post("/api/ops/hold/:id", async (c) => { if (!(await opsOk(c.req.raw))) return c.json({ error: "Administrator sign-in required." }, 401); const h = metrics.holds.find((x) => x.id === Number(c.req.param("id"))); if (h) h.done = true; return c.json({ ok: !!h }); });
app.get("/api/papers", (c) => c.json(town.papers.slice(-14).reverse()));
// the record's seals: one hash per day, chained; and the day's events in the exact form that was hashed, so anyone can recompute it
app.get("/api/record", (c) => c.json({ chain: town.chain.slice(-60), how: "sha256(prev + '\\n' + events.map(canonical).join('\\n')), canonical = JSON [id, t, kind, actors, place|null, text, importance to 3 places], events of the day by id" }));
app.get("/api/record/:day", async (c) => {
  const day = Number(c.req.param("day")); const seal = town.chain.find((s) => s.day === day); if (!seal) return c.json({ error: "no seal for that day" }, 404);
  const inMemory = town.events.filter((e) => e.t >= seal.from && e.t < seal.to); const events = inMemory.length >= seal.events ? inMemory : store ? (await store.eventsBetween(seal.from, seal.to)) : inMemory;
  return c.json({ seal, events: events.sort((x, y) => x.id - y.id).map(canonicalEvent), recomputed: sha256(seal.prev + "\n" + events.sort((x, y) => x.id - y.id).map(canonicalEvent).join("\n")) });
});
// the library: the book of every life that ended here, public like the paper
app.get("/api/library", async (c) => { const rows = store ? await store.lives() : []; return c.json(rows.map(({ text: _t, ...r }) => ({ ...r, words: _t.split(/\s+/).length }))); });
app.get("/api/library/:id", async (c) => { const row = store ? await store.life(c.req.param("id")) : null; return row ? c.json(row) : c.json({ error: "no book by that name on the shelf" }, 404); });
app.get("/api/papers/latest", (c) => { const p = town.papers[town.papers.length - 1]; return p ? c.json(p) : c.json({ error: "the first edition prints at midnight" }, 404); });
app.get("/api/events", (c) => {
  const since = Number(c.req.query("since") ?? town.t - 120); const place = c.req.query("place"); const min = Number(c.req.query("min") ?? 0);
  return c.json(town.events.filter((e) => e.t >= since && (!place || e.place === place) && e.importance >= min).slice(-500).map(publicEvent));
});
app.post("/api/boarding/external", async(c)=>{
  const owner=await ownerOf(c.req.raw);if(!owner)return c.json({error:"Sign in first."},401);
  const body=z.object({persona:Persona}).safeParse(await c.req.json());if(!body.success)return c.json({error:"Complete your character first."},400);
  try{c.header("Cache-Control","no-store");return c.json(boardingConnections.create(owner,body.data.persona));}
  catch{return c.json({error:"The boarding desk is busy. Try again shortly."},503);}
});
app.post("/api/boarding/external/:id/verify",async(c)=>{
  const owner=await ownerOf(c.req.raw);if(!owner)return c.json({error:"Sign in first."},401);
  try{await boardingConnections.verify(c.req.param("id"),owner);return c.json({verified:true});}
  catch(e){return c.json({error:(e as Error).message},400);}
});
app.get("/api/me/activation",async(c)=>{
  const owner=await ownerOf(c.req.raw);if(!owner)return c.json({error:"Sign in first."},401);
  const wallet=billing.wallet(owner);c.header("Cache-Control","private, no-store");
  return c.json({citizens:allCitizens().filter(a=>a.owner===owner).map(a=>{
    const b=brain.perAgent.get(a.id);
    const state=a.brainKind==="own_brain"?(b instanceof OwnBrain&&b.connected?"external":"disconnected"):
      a.brainKind==="own_key"?(b instanceof OwnKeyBrain?(b.status().spentToday>=(b.row.daily_cap_usd??2)?"capped":"personal_key"):"unconfigured"):
      wallet.plan!=="none"?"subscription":wallet.credits>0?"credits":"activation_required";
    return {id:a.id,name:a.persona.name,state,awaiting:waitingTown.agents.has(a.id)};
  })});
});
app.post("/api/agents/:id/activate",async(c)=>{
 const owner=await ownerOf(c.req.raw);const a=waitingTown.agents.get(c.req.param("id"));
 if(!a||!owns(a,owner))return c.json({error:"No waiting citizen for this account."},404);
 if(worldTransition||ticking)return c.json({error:"The world is finishing a tick. Retry in a moment."},409);
 if(boardingLocks.has(owner!))return c.json({error:"Activation is already being checked."},409);
 boardingLocks.add(owner!);
 try{
  if(a.brainKind==="hosted"){if(!await billing.boardingReady(owner!))return c.json({error:"Activate a subscription first."},402);}
  else if(a.brainKind==="own_key"){const row=brainRows.get(a.id);if(!row?.api_key||!row.models||!row.daily_cap_usd)return c.json({error:"Configure a key and positive daily cap first."},400);try{await verifyBoardingKey(row.api_key,row.models);}catch(e){return c.json({error:(e as Error).message},400);}}
  else {const b=brain.perAgent.get(a.id);if(!(b instanceof OwnBrain)||!await b.verify(waitingTown.perceive(a)))return c.json({error:"Connect your process and answer its test perception before returning."},400);}
  if(ticking||worldTransition)return c.json({error:"The world is finishing a tick. Your brain is ready; retry in a moment."},409);
  worldTransition=true;
  try{
   const preview=new Town({seed:SEED,brain:new MockBrain(SEED)});preview.restore({...waitingTown.snapshot(),agents:waitingTown.snapshot().agents.filter(x=>x.id===a.id)});
   const ready=preview.agents.get(a.id)!;ready.location="harbor";ready.asleep=false;ready.job=null;ready.plan=null;ready.budget.tier1Used=0;ready.budget.tier2Used=0;billing.applyPlan(ready);
   if(store)await store.resumeCitizen(preview,a.id);
   waitingTown.agents.delete(a.id);town.agents.set(a.id,ready);
   town.emit("agent.arrive",[a.id],"harbor",`${a.persona.name} returned to the island with their brain activated.`,0.5);
   if(store)await store.snapshot(town);
   broadcast({type:"hello",clock:clockOf(town),agents:[...town.agents.values()].map(x=>publicAgent(town,x)),recent:town.events.slice(-80).map(publicEvent)});
   return c.json({id:a.id,activated:true});
  }finally{worldTransition=false;}
 }finally{boardingLocks.delete(owner!);}
});
app.post("/api/board", async (c) => {
  const owner=await ownerOf(c.req.raw);if(!owner)return c.json({error:"Sign in at the boat office first."},401);
  if(worldTransition)return c.json({error:"The island is updating. Your draft is safe; retry shortly."},409);
  if(boardingLocks.has(owner))return c.json({error:"A boarding request is already being checked. Please wait."},409);
  boardingLocks.add(owner);
  try {
    const raw=await c.req.json().catch(()=>({}));
    const adopt=z.object({adopt:z.string()}).safeParse(raw);
    if(adopt.success){
      if(!await billing.boardingReady(owner))return c.json({error:"Activate a hosted plan before adopting a citizen."},402);
      const grown=town.agents.get(adopt.data.adopt);
      if(grown&&!grown.owner&&grown.persona.origin.startsWith("born on the island")){grown.owner=owner;billing.applyPlan(grown);if(store)await store.snapshot(town);return c.json({id:grown.id,arrived:town.clock(),adopted:true});}
      const child=town.children.find(x=>x.id===adopt.data.adopt&&!x.adoptedBy);
      if(!child)return c.json({error:"No such available child."},404);
      child.adoptedBy=owner;if(store)await store.snapshot(town);return c.json({id:child.id,child:true,ofAgeIn:Math.max(0,town.ageOfMajority-(town.day-child.bornDay))});
    }
    const body=z.object({requestId:z.string().uuid(),persona:Persona,appearance:z.record(z.string(),z.unknown()).optional(),instructions:z.string().max(4000).optional(),brain:z.enum(["hosted","own_key","own_brain"]).default("hosted"),town:z.string().optional(),apiKey:z.string().min(8).max(512).optional(),models:z.object({routine:z.string().min(1).max(200),stakes:z.string().min(1).max(200),reflect:z.string().min(1).max(200)}).optional(),dailyCapUsd:z.number().positive().max(100).optional(),ticket:z.string().uuid().optional()}).safeParse(raw);
    if(!body.success)return c.json({error:"Complete the boarding form and choose a working brain."},400);
    const data=body.data;const id=`ag_${(data.brain==="own_brain"?data.ticket??data.requestId:data.requestId).replaceAll("-","")}`;
    const previous=town.agents.get(id);
    if(previous){if(previous.owner!==owner)return c.json({error:"This boarding reference is unavailable."},409);if(store)await store.snapshot(town);return c.json({id,arrived:town.clock()});}
    if(data.town&&data.town!==TOWN_ID&&data.town!==(store?.townId??"island"))return c.json({error:"Complete boarding on your destination island so its brain connection can be verified."},400);
    if(!town.boatRunning)return c.json({error:"The boat is not running. Your draft is saved; try again when it resumes."},503);
    let row:BrainRow|null=null;let external:ReturnType<BoardingConnections["ready"]>=null;
    if(data.brain==="hosted"){
      if(!await billing.boardingReady(owner))return c.json({error:"An active subscription must be confirmed before boarding. Check Credits & plan; your character is still a draft."},402);
    } else if(data.brain==="own_key"){
      if(!data.apiKey||!data.models||!data.dailyCapUsd)return c.json({error:"Enter a key, models and a positive daily cap before boarding."},400);
      try{await verifyBoardingKey(data.apiKey,data.models);}catch(e){return c.json({error:(e as Error).message},400);}
      row={agent_id:id,kind:"own_key",provider:"openrouter",api_key:data.apiKey,models:data.models,think_every:5,daily_cap_usd:data.dailyCapUsd,token:null,memory:"lease"};
    } else {
      external=data.ticket?boardingConnections.ready(data.ticket,owner):null;
      if(!external)return c.json({error:"Connect and verify your external brain before boarding. Your character is still a draft."},400);
      row=external.brain.row;
    }
    const staged=new Town({seed:SEED,brain:new MockBrain(SEED)});staged.t=town.t;staged.day=town.day;
    const prepared=staged.addAgent({persona:data.persona,owner,funded:true},id);
    prepared.appearance=data.appearance??null;prepared.instructions=data.instructions??"";
    prepared.brainKind=data.brain;prepared.thinkEvery=data.brain==="own_key"?5:null;billing.applyPlan(prepared);
    if(worldTransition)return c.json({error:"The island is updating. Your draft is safe; retry shortly."},409);
    if(store)await store.admitCitizen(staged,id,row);
    if(row){brainRows.set(id,row);if(external)brain.perAgent.set(id,external.brain);else brain.set(id,row);}
    const a=town.addAgent({persona:data.persona,owner,funded:true},id);Object.assign(a,prepared);
    if(store)await store.snapshot(town);
    if(data.ticket)boardingConnections.consume(data.ticket);
    return c.json({id:a.id,arrived:town.clock()});
  } finally {boardingLocks.delete(owner);}
});
app.get("/api/me/agents", async (c) => {
  const owner = await ownerOf(c.req.raw); if (!owner) return c.json([]);
  return c.json(allCitizens().filter(a=>a.owner===owner).map(a=>({...ownerAgent(town,a),awaitingActivation:waitingTown.agents.has(a.id)})));
});
app.get("/api/evolution", c => c.json({island:town.name,day:town.day,retention:{stories:64,momentsPerStory:40},stories:[...town.evolution].sort((a,b)=>b.updated-a.updated),institutions:[...town.places.values()].filter(p=>p.institution).map(p=>({place:p.id,...p.institution})),skills:[...town.agents.values()].flatMap(a=>(a.skills??[]).map(s=>({id:s.id,name:s.recipe.name,goal:s.recipe.goal,agent:a.id,agentName:a.persona.name,origin:s.origin,learnedFrom:s.learnedFrom??null,attempts:s.attempts,successes:s.successes,evidence:s.evidence}))) }));
app.get("/api/health", (c) => c.json({ ok: true, version: process.env.RELEASE_VERSION ?? "dev", commit: process.env.COMMIT_SHA ?? "local", clock: clockOf(town), brain: brain.name }));

// ---- WebSocket stream ----
const server = serve({ fetch: app.fetch, port: PORT, createServer }, () => log(`listening on http://localhost:${PORT}`));
const wss = new WebSocketServer({ noServer: true });
const agentWss = new WebSocketServer({ noServer: true });
(server as unknown as import("node:http").Server).on("upgrade", (req, socket, head) => {
  const url = new URL(req.url ?? "/", "http://x");
  if (url.pathname === "/stream") wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
  else if (url.pathname === "/agent-stream") {
    const token=url.searchParams.get("token")??"";
    const b = brain.ownBrainByToken(token) ?? boardingConnections.byToken(token);
    if (!b) { socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n"); socket.destroy(); return; }
    agentWss.handleUpgrade(req, socket, head, (ws) => { b.attach(ws); const a = town.agents.get(b.row.agent_id); log(`own brain connected for ${a?.persona.name ?? b.row.agent_id}`); ws.send(JSON.stringify({ type: "hello", agent_id: b.row.agent_id, name: a?.persona.name, clock: clockOf(town), rules: "One action per sim minute. Answer each perceive within deadline_ms with {type:'act', action, intent?, remember?}. Answer reflect within 30 s or the town reflects for you." })); });
  } else socket.destroy();
});
wss.on("connection", (ws) => {
  clients.add(ws);
  ws.send(JSON.stringify({ type: "hello", clock: clockOf(town), agents: [...town.agents.values()].map((a) => publicAgent(town, a)), recent: town.events.slice(-80).map(publicEvent) }));
  ws.on("close", () => clients.delete(ws));
});

async function shutdown() { running = false; log("snapshotting before exit"); if (store) { await store.snapshot(town); for (const a of town.agents.values()) await store.appendMemories(a, memoryMark); } process.exit(0); }
process.on("SIGINT", shutdown); process.on("SIGTERM", shutdown);
