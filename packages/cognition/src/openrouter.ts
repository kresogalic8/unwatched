import { z } from "zod";
import { ActionProposal, Dialogue, Paper, Reflection, type Perception, DayPlan, DigestText, Persona, LifeText, Judgement, PersonaDepth } from "@unwatched/protocol";
import type { AgentState, Brain, ConverseContext, PaperContext, ReflectContext, Tier, PlanContext, DigestContext, ChildContext, LifeContext, JudgeContext } from "@unwatched/engine";
import { MockBrain } from "./mock.ts";
import { WORLD, personaBlock, decidePrompt, conversePrompt, reflectPrompt, paperSystem, paperPrompt, lifeSystem, lifePrompt, judgeSystem, judgePrompt, planPrompt, digestSystem, digestPrompt, childSystem, childPrompt, depthSystem, depthPrompt } from "./prompts.ts";

export interface OpenRouterBrainOptions {
  apiKey?: string;
  routine?: string;
  stakes?: string;
  reflect?: string;
  log?: (line: string) => void;
  /** Milliseconds before a routine or stakes call is given up on (env UW_OR_TIMEOUT_MS, default 45s) and a reflect-tier one (env UW_OR_TIMEOUT_REFLECT_MS, default 90s). */
  timeoutMs?: number;
  reflectTimeoutMs?: number;
}

/** Every kind of call the brain makes, by the name the ops room sees it under. */
export type CallKind = "action_proposal" | "dialogue" | "reflection" | "day_plan" | "persona_depth" | "digest" | "child" | "paper" | "judgement" | "life";
export type Slot = "routine" | "stakes" | "reflect";
export type Models = Record<Slot, string>;
/** Which of the three minds each call goes to when nothing else is said. decide and plan step up to stakes at tier 2; a quiet reflection steps down to stakes. */
export const SLOT_OF: Record<CallKind, Slot> = { action_proposal: "routine", dialogue: "routine", judgement: "routine", day_plan: "routine", digest: "stakes", child: "stakes", reflection: "reflect", persona_depth: "reflect", paper: "reflect", life: "reflect" };
/** The one chooser: the town's models, the per-citizen override (the daily ceiling, a Patron's upgrade), and the slot the call wants. */
export function chooseModel(kind: CallKind, models: Models, override: Partial<Models> | null | undefined, slot: Slot = SLOT_OF[kind]): { model: string; slot: Slot } {
  return { model: override?.[slot] ?? models[slot], slot };
}

/** Prose fields long enough to spill over their caps, by call kind: trimmed at a sentence before zod sees them. `voice[]` means every element. */
export const PROSE_CAPS: Partial<Record<CallKind, Record<string, number>>> = {
  paper: { "lead.body": 2600 },
  life: { text: 4400 },
  reflection: { summary: 1500 },
  digest: { text: 1400 },
  persona_depth: { habit: 240, skill: 120, flaw: 240, cameBecause: 200, "voice[]": 240 }, // the protocol's caps for PersonaDepth
};
/** Cuts a paragraph at the last sentence end that fits the cap; failing that at a word; failing that at the cap itself. */
export function trimProse(s: string, cap: number): string {
  if (s.length <= cap) return s;
  const head = s.slice(0, cap);
  const sentence = Math.max(head.lastIndexOf(". "), head.lastIndexOf("? "), head.lastIndexOf("! "), head.lastIndexOf(".\n"), head.endsWith(".") || head.endsWith("?") || head.endsWith("!") ? cap - 1 : -1);
  if (sentence >= cap / 2) return head.slice(0, sentence + 1).trimEnd();
  const word = head.lastIndexOf(" ");
  return (word >= cap / 2 ? head.slice(0, word) : head).trimEnd();
}
/** Applies PROSE_CAPS to a raw answer in place, before the schema rejects a paragraph that ran long. */
export function truncateProse(kind: CallKind, raw: unknown): unknown {
  const caps = PROSE_CAPS[kind]; if (!caps || !raw || typeof raw !== "object") return raw;
  for (const [path, cap] of Object.entries(caps)) {
    const keys = path.split("."); let node: unknown = raw;
    for (let i = 0; i < keys.length - 1; i++) { node = node && typeof node === "object" ? (node as Record<string, unknown>)[keys[i]!] : undefined; }
    if (!node || typeof node !== "object") continue;
    const last = keys[keys.length - 1]!; const o = node as Record<string, unknown>;
    if (last.endsWith("[]")) { const arr = o[last.slice(0, -2)]; if (Array.isArray(arr)) for (let i = 0; i < arr.length; i++) if (typeof arr[i] === "string") arr[i] = trimProse(arr[i] as string, cap); }
    else if (typeof o[last] === "string") o[last] = trimProse(o[last] as string, cap);
  }
  return raw;
}
/** The user turn that asks for the same answer inside the limits, naming the path and the cap the model overran. */
export function repairNote(issue: { path: PropertyKey[]; message: string; code?: string; maximum?: unknown; origin?: string }, raw: unknown): string {
  const path = issue.path.map(String).join(".") || "the answer";
  let node: unknown = raw; for (const k of issue.path) node = node && typeof node === "object" ? (node as Record<string, unknown>)[String(k)] : undefined;
  if (issue.code === "too_big" && typeof issue.maximum === "number") {
    const unit = issue.origin === "array" ? "items" : "characters"; const size = typeof node === "string" ? node.length : Array.isArray(node) ? node.length : typeof node === "number" ? node : null;
    return `Your answer did not fit: ${path} was ${size === null ? "over the limit" : `${size.toLocaleString("en-US")} ${unit}`}; the limit is ${issue.maximum.toLocaleString("en-US")}. Return the same answer within the limits, as JSON only.`;
  }
  return `Your answer did not fit the schema: ${path}: ${issue.message}. Return the same answer corrected to fit, as JSON only.`;
}
/** A fallback answer wears a mark ops can see without the shape changing: the flag is not enumerable, so it never reaches the record. */
export function markFallback<T extends object>(x: T): T { Object.defineProperty(x, "fromFallback", { value: true, enumerable: false, configurable: true }); return x; }
export const isFromFallback = (x: unknown): boolean => !!x && typeof x === "object" && (x as { fromFallback?: boolean }).fromFallback === true;

/** Town-level calls (the Gazette, a child, the digest of someone who has left) have no citizen; the hook sees the town, which has no owner, so only the ceiling applies. */
const TOWN = Object.freeze({ id: "town", owner: null, brainKind: "hosted", funded: true }) as unknown as AgentState;

/**
 * The "your own key" path from the design: same prompts and same schemas as the hosted brain,
 * sent to OpenRouter, which fronts Claude and everything else. The engine cannot tell the difference.
 */
export class OpenRouterBrain implements Brain {
  readonly name = "openrouter";
  private key: string;
  private models: Models;
  private log: (l: string) => void;
  private fallback = new MockBrain(13);
  private spent = { calls: 0, prompt: 0, completion: 0 };
  private timeoutMs: number; private reflectTimeoutMs: number;

  constructor(o: OpenRouterBrainOptions = {}) {
    const key = o.apiKey ?? process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error("OPENROUTER_API_KEY is not set");
    this.key = key;
    this.models = {
      routine: o.routine ?? process.env.UW_OR_MODEL_ROUTINE ?? "anthropic/claude-haiku-4.5",
      stakes: o.stakes ?? process.env.UW_OR_MODEL_STAKES ?? "anthropic/claude-sonnet-5",
      reflect: o.reflect ?? process.env.UW_OR_MODEL_REFLECT ?? "anthropic/claude-opus-5",
    };
    this.timeoutMs = o.timeoutMs ?? envMs("UW_OR_TIMEOUT_MS", 45_000);
    this.reflectTimeoutMs = o.reflectTimeoutMs ?? envMs("UW_OR_TIMEOUT_REFLECT_MS", 90_000);
    this.log = o.log ?? (() => {});
  }

  usage() { return { ...this.spent }; }
  private cached = 0;
  /** Prompt tokens served from the cache so far. */
  cachedTokens() { return this.cached; }
  /** Called whenever an answer could not be used and the plain fallback stood in. The ops room listens. */
  onFallback: ((f: { what: string; model: string; reason: string }) => void) | null = null;
  /** The models for one citizen when they differ from the town's: a Patron's careful thoughts and reflection go to the most capable mind; under the daily ceiling everyone thinks on cheaper minds. Consulted for every call. */
  modelsFor: ((a: AgentState) => Partial<Models> | null) | null = null;
  /** The island itself, in words, the same for every citizen: places, work, the calendar. Set by the server; part of the shared cached prefix. */
  primer = "";
  /** Which model a call goes to, for a citizen or for the town. A hook that throws is a hook that said nothing. */
  private pick(kind: CallKind, a: AgentState | null, slot?: Slot) {
    let o: Partial<Models> | null = null;
    try { o = this.modelsFor?.(a ?? TOWN) ?? null; } catch (err) { this.log(`warn: modelsFor threw for ${kind}: ${(err as Error).message}`); }
    return chooseModel(kind, this.models, o, slot);
  }
  /**
   * Whether this citizen's persona block is worth a cache marker of its own. The write costs a quarter more and the read a tenth of the price,
   * so the marker pays off only when the next call comes inside the five-minute cache life: a hosted Resident thinks about every twenty minutes
   * and a Patron about every eight, so for them it is a tax; an own-key citizen at the default five minutes gets it.
   */
  private cachePersona(a: AgentState) { return a.thinkEvery !== null && a.thinkEvery !== undefined && a.thinkEvery <= 5; }
  private stood<T extends object>(kind: CallKind, model: string, out: T): T { this.log(`warn: fallback stood in for ${kind} (${model})`); return markFallback(out); }

  private async post(body: unknown, model: string, name: CallKind, slot: Slot): Promise<{ text: string } | null> {
    const ms = slot === "reflect" ? this.reflectTimeoutMs : this.timeoutMs;
    for (let attempt = 0; attempt < 2; attempt++) {
      let res: Response;
      try {
        res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json", "HTTP-Referer": "https://unwatched.town", "X-Title": "Unwatched" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(ms),
        });
      } catch (err) {
        const why = (err as Error).name === "TimeoutError" || (err as Error).name === "AbortError" ? `no answer in ${Math.round(ms / 1000)}s` : `fetch failed: ${(err as Error).message}`;
        this.log(`openrouter ${why}; ${attempt === 0 ? "retrying" : "falling back"}`); if (attempt === 1) this.onFallback?.({ what: name, model, reason: why }); continue;
      }
      if (res.status === 429 || res.status >= 500) { this.log(`openrouter ${res.status}; ${attempt === 0 ? "retrying" : "falling back"}`); if (attempt === 1) this.onFallback?.({ what: name, model, reason: `openrouter ${res.status}` }); await new Promise((r) => setTimeout(r, 1500)); continue; }
      if (!res.ok) { const msg = (await res.text()).slice(0, 600); this.log(`openrouter ${res.status}: ${msg}`); this.onFallback?.({ what: name, model, reason: `openrouter ${res.status}` }); return null; }
      const data = await res.json() as { choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } } };
      this.spent.calls++; this.spent.prompt += data.usage?.prompt_tokens ?? 0; this.spent.completion += data.usage?.completion_tokens ?? 0; this.cached += data.usage?.prompt_tokens_details?.cached_tokens ?? 0;
      return { text: data.choices?.[0]?.message?.content ?? "" };
    }
    return null;
  }

  private async call<T>(name: CallKind, model: string, slot: Slot, system: { shared: string; own?: string; cacheOwn?: boolean }, user: string, schema: z.ZodType<T>, maxTokens: number): Promise<T | null> {
    // Providers behind OpenRouter accept a subset of JSON Schema: no regex patterns, no defaults, anyOf not oneOf.
    // The schema goes in the request as a strict format and in the system prompt as belt and braces.
    const jsonSchema = wantsStrict(model) ? strictSchema(cleanSchema(z.toJSONSchema(schema))) : cleanSchema(z.toJSONSchema(schema));
    const messages: { role: string; content: unknown }[] = [{ role: "system", content: [
      // The prefix is built to cache: the world's rules, the island and the schema are the same for every citizen and every call of a kind
      // (one block, over four thousand tokens, which is what Haiku needs before it will cache at all). Anthropic bills a cached read at a tenth of the price.
      // The second block is marked only when it will be read again inside the cache's life (see cachePersona); a conversation's block names the hour and the weather and never is.
      { type: "text", text: `${system.shared}${this.primer ? `\n\n${this.primer}` : ""}\n\nAnswer with a single JSON object matching this JSON schema exactly, no prose:\n${JSON.stringify(jsonSchema)}`, cache_control: { type: "ephemeral" } },
      ...(system.own ? [system.cacheOwn ? { type: "text", text: system.own, cache_control: { type: "ephemeral" } } : { type: "text", text: system.own }] : []),
    ] }, { role: "user", content: user }];
    const body = { model, max_tokens: maxTokens, messages, response_format: { type: "json_schema", json_schema: { name, strict: true, schema: jsonSchema } } };
    for (let attempt = 0; attempt < 2; attempt++) {
      const got = await this.post(body, model, name, slot); if (!got) return null;
      const text = got.text;
      let raw: unknown;
      try { raw = JSON.parse(text.trim().replace(/^```json\s*|```$/g, "")); }
      catch { this.log(`not json from ${model}: ${text.slice(0, 80)}`); if (attempt === 1) { this.onFallback?.({ what: name, model, reason: "not json" }); return null; } messages.push({ role: "assistant", content: text }, { role: "user", content: "That was not a single JSON object. Return the same answer as JSON only, matching the schema." }); continue; }
      const parsed = schema.safeParse(truncateProse(name, wantsStrict(model) ? stripNulls(raw) : raw));
      if (parsed.success) return parsed.data;
      const issue = parsed.error.issues[0];
      this.log(`schema mismatch from ${model}: ${issue?.message ?? "?"} at ${issue?.path.join(".") || "root"}; got ${text.slice(0, 160)}`);
      if (attempt === 1 || !issue) { this.onFallback?.({ what: name, model, reason: `schema: ${issue?.message ?? "?"}` }); return null; }
      // the repair: the model sees its own answer and the one thing wrong with it, and gives the same answer inside the limits
      messages.push({ role: "assistant", content: text }, { role: "user", content: repairNote(issue as Parameters<typeof repairNote>[0], raw) });
    }
    return null;
  }

  async decide(p: Perception, a: AgentState, tier: Tier): Promise<ActionProposal> {
    const { model, slot } = this.pick("action_proposal", a, tier >= 2 ? "stakes" : "routine");
    const out = await this.call("action_proposal", model, slot, { shared: WORLD, own: personaBlock(a), cacheOwn: this.cachePersona(a) }, decidePrompt(p), ActionProposal, 1024);
    return out ?? this.stood("action_proposal", model, await this.fallback.decide(p, a, tier));
  }
  async converse(ctx: ConverseContext): Promise<Dialogue> {
    const { model, slot } = this.pick("dialogue", ctx.a);
    const out = await this.call("dialogue", model, slot, { shared: WORLD, own: conversePrompt.system(ctx) }, conversePrompt.user(ctx), Dialogue, 1500);
    return out ?? this.stood("dialogue", model, await this.fallback.converse(ctx));
  }
  async reflect(ctx: ReflectContext): Promise<Reflection> {
    // a quiet night (nothing of importance happened, says the engine) is thought through on the middle mind, briefly; the prompt is the same
    const quiet = (ctx as { quiet?: boolean }).quiet === true;
    const { model, slot } = this.pick("reflection", ctx.agent, quiet ? "stakes" : "reflect");
    const out = await this.call("reflection", model, slot, { shared: WORLD, own: personaBlock(ctx.agent), cacheOwn: this.cachePersona(ctx.agent) }, reflectPrompt(ctx), Reflection, quiet ? 900 : 2000);
    return out ?? this.stood("reflection", model, await this.fallback.reflect(ctx));
  }
  async plan(ctx: PlanContext, tier: Tier): Promise<DayPlan> {
    const { model, slot } = this.pick("day_plan", ctx.agent, tier >= 2 ? "stakes" : "routine");
    const out = await this.call("day_plan", model, slot, { shared: WORLD, own: personaBlock(ctx.agent), cacheOwn: this.cachePersona(ctx.agent) }, planPrompt(ctx), DayPlan, 1200);
    return out ?? this.stood("day_plan", model, await this.fallback.plan(ctx, tier));
  }
  /** The depth a person has beyond the sheet, written once by the strongest mind and kept with them. */
  async enrich(p: Persona, island: string): Promise<PersonaDepth | null> { const { model, slot } = this.pick("persona_depth", null); return this.call("persona_depth", model, slot, { shared: depthSystem }, depthPrompt(p, island), PersonaDepth, 900); }
  async digest(ctx: DigestContext): Promise<DigestText> {
    const { model, slot } = this.pick("digest", ctx.agent); // the owner's reading is the product: the middle mind writes it
    const out = await this.call("digest", model, slot, { shared: digestSystem }, digestPrompt(ctx), DigestText, 700);
    return out ?? this.stood("digest", model, await this.fallback.digest(ctx));
  }
  async child(ctx: ChildContext): Promise<Persona> {
    const { model, slot } = this.pick("child", null);
    const out = await this.call("child", model, slot, { shared: childSystem }, childPrompt(ctx), Persona, 900);
    return out ?? this.stood("child", model, await this.fallback.child(ctx));
  }
  async writePaper(ctx: PaperContext): Promise<Paper> {
    const { model, slot } = this.pick("paper", null);
    const out = await this.call("paper", model, slot, { shared: paperSystem }, paperPrompt(ctx), Paper, 3000);
    return out ?? this.stood("paper", model, await this.fallback.writePaper(ctx));
  }
  async judge(ctx: JudgeContext): Promise<Judgement> {
    const { model, slot } = this.pick("judgement", ctx.agent);
    const out = await this.call("judgement", model, slot, { shared: judgeSystem }, judgePrompt(ctx), Judgement, 400);
    return out ?? this.stood("judgement", model, await this.fallback.judge(ctx));
  }
  async life(ctx: LifeContext): Promise<LifeText> {
    const { model, slot } = this.pick("life", null);
    const out = await this.call("life", model, slot, { shared: lifeSystem }, lifePrompt(ctx), LifeText, 3200);
    return out ?? this.stood("life", model, await this.fallback.life(ctx));
  }
}

function envMs(name: string, dflt: number): number { const v = Number(process.env[name]); return Number.isFinite(v) && v > 0 ? v : dflt; }

function cleanSchema(x: unknown): unknown {
  if (Array.isArray(x)) return x.map(cleanSchema);
  if (x && typeof x === "object") {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(x as Record<string, unknown>)) {
      if (k === "pattern" || k === "$schema" || k === "default") continue;
      o[k === "oneOf" ? "anyOf" : k] = cleanSchema(v);
    }
    return o;
  }
  return x;
}
/**
 * OpenAI's strict mode wants every property listed as required, every object closed, and no bounds: an optional field becomes
 * nullable and required, and the nulls are stripped again before the answer meets the zod schema (see stripNulls).
 */
function strictSchema(x: unknown): unknown {
  if (Array.isArray(x)) return x.map(strictSchema);
  if (x && typeof x === "object") {
    const src = x as Record<string, unknown>; const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(src)) { if (["minimum", "maximum", "minLength", "maxLength", "minItems", "maxItems", "exclusiveMinimum", "exclusiveMaximum", "format"].includes(k)) continue; o[k] = strictSchema(v); }
    if (o.type === "object" && o.properties && typeof o.properties === "object") {
      const props = o.properties as Record<string, unknown>; const required = new Set((o.required as string[] | undefined) ?? []);
      for (const name of Object.keys(props)) if (!required.has(name)) props[name] = { anyOf: [props[name], { type: "null" }] };
      o.required = Object.keys(props); o.additionalProperties = false;
    }
    return o;
  }
  return x;
}
function stripNulls(x: unknown): unknown {
  if (Array.isArray(x)) return x.map(stripNulls);
  if (x && typeof x === "object") { const o: Record<string, unknown> = {}; for (const [k, v] of Object.entries(x as Record<string, unknown>)) if (v !== null) o[k] = stripNulls(v); return o; }
  return x;
}
const wantsStrict = (model: string) => model.startsWith("openai/") || model.startsWith("~openai/");
