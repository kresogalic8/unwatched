import type { Brain } from "@unwatched/engine";
import type { Persona, PersonaDepth } from "@unwatched/protocol";
export { MockBrain } from "./mock.ts";
export { AnthropicBrain } from "./anthropic.ts";
export type { AnthropicBrainOptions } from "./anthropic.ts";
export { seedPersonas } from "./personas.ts";
export { OpenRouterBrain, chooseModel, SLOT_OF, PROSE_CAPS, trimProse, truncateProse, repairNote, markFallback, isFromFallback } from "./openrouter.ts";
export type { OpenRouterBrainOptions, ProviderUsage, CallKind, Slot, Models } from "./openrouter.ts";

/** A brain that can give a person depth beyond the sheet. Both hosted brains do; the mock does not, and that is fine. */
export interface Enricher { enrich(p: Persona, island: string): Promise<PersonaDepth | null> }
export const canEnrich = (b: Brain): b is Brain & Enricher => typeof (b as Partial<Enricher>).enrich === "function";
export { JevDecider } from "./jev.ts";
