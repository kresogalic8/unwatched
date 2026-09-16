"use client";
import { authHeaders } from "./auth";

export const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
export const WS = API.replace(/^http/, "ws") + "/stream";

/** A binary answer from the boat office, with the same sign-in: a voice, a file. */
export async function apiBlob(path: string): Promise<Blob> {
  const res = await fetch(`${API}${path}`, { headers: await authHeaders(), cache: "no-store" });
  if (!res.ok) { const body = await res.json().catch(() => ({})); throw new Error((body as { error?: string }).error ?? `The boat office answered ${res.status}.`); }
  return res.blob();
}
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = { "Content-Type": "application/json", ...(await authHeaders()), ...(init?.headers as Record<string, string> | undefined) };
  const res = await fetch(`${API}${path}`, { ...init, headers, cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error((body as { error?: string }).error ?? `The boat office answered ${res.status}.`),{status:res.status});
  return body as T;
}

export function clock(t: number): string {
  const d = Math.floor(t / 1440) + 1; const m = t % 1440;
  return `day ${d} ${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
export function hhmm(t: number): string { const m = t % 1440; return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; }
export function dayOf(t: number): number { return Math.floor(t / 1440) + 1; }

export type TownEvent = { id: number; t: number; day: number; kind: string; actors: string[]; place?: string; text: string; importance: number; payload?: Record<string, unknown> };
export type SharedKnowledge = { from:string; name:string; place:string; item:string; confidence:number; sourceT:number; sharedT:number; eventId:number };
export type PublicAgent = { gear?: {name:string;condition:number|null} | null; packCount?:number; packCapacity?:number; activity?: {kind: "fish" | "work"; place: string; started: number; until: number} | null; sharedKnowledge?: SharedKnowledge[]; observedPurchases?: {place:string;item:string;receipts:{t:number;eventId:number;cost:number}[]}[]; id: string; name: string; age: number; origin: string; summary: string; location: string; place: string; asleep: boolean; job: string | null; home: string | null; arrivedDay: number; funded: boolean; ownerId: string | null; appearance: Record<string, unknown> | null; pose?: "sleep" | "work" | "sit" | "idle"; weak?: boolean; daysHungry?: number; perks?: boolean; broke?: boolean; roofless?: boolean; roof?: boolean; carrying?: string | null };
export type Person = { id: string; name: string; trust: number; affection: number; opinion: string; lastSeen: number; tide: string };
export type OwnerAgent = PublicAgent & { belongings?: import("@unwatched/protocol").InventoryView; desires?: import("@unwatched/protocol").Desire[]; foodAdvice?: {from:string;place:string;item:string;confidence:number;sourceT:number;sharedT:number;eventId:number;tested?:{t:number;success:boolean;matched:boolean}}[]; foodRoutineDecisions?: {t:number;from:string;next:string;baseline:string;preferred:string}[]; foodLessons?: {place:string;item:string;evidence:{t:number;success:boolean;cost:number;eventId?:number}[]}[]; persona: Record<string, unknown>; needs: { hunger: number; rest: number; social: number }; coins: number; inventory: string[]; nightsPaid: number; budget: { tier1Left: number; tier2Left: number; tier1Max: number; tier2Max: number }; intentions: string[]; plan: { mood: string; goals: string[]; steps: { hour: number; do: string; place: string | null; done: boolean }[] } | null; people: Person[]; memories: { t: number; text: string; importance: number; kind: string }[]; letters: { id: number; text: string; t: number; read: boolean }[]; instructions?: string; watch?: string[]; selves?: { day: number; summary: string; want: string; fear: string; strangers: string; advice: string }[]; doToday?: number; projects?: { title: string; why: string; progress: string; since: number; done: boolean; doneDay?: number }[]; beliefs?: { about: string; belief: string; confidence: number; since: number }[] };
export type Digest = { written: { text: string; headline: string } | null; headline: string; items: TownEvent[]; people: { name: string; trust: number; opinion: string }[]; since: number; now: number; readAt?: number | null; agent: OwnerAgent | PublicAgent; letters: { t: number; text: string }[] };
/** What never leaves a person's head: never a moment to share, never on the street. The same set the paper keeps out. */
export const PRIVATE_KINDS = new Set(["agent.reflect", "agent.letter", "town.book", "relation.change", "agent.plan", "agent.wake", "agent.sleep", "action.rejected", "agent.self"]);
export type Notifications = { notifyDigest: boolean; notifyLetters: boolean; email: string | null; mail: boolean; lastMailedDay: number | null };
export type PaperScene = { place: string; placeName: string; sprite: string; actors: string[]; hour: number; weather: string; caption: string };
export type Paper = { edition: number; date: string; weather: string; lead: { headline: string; deck: string; body: string }; briefs: { headline: string; body: string }[]; notices: string[]; market?: string; harbor?: string; tomorrow?: string; scene?: PaperScene; seal?: { day: number; hash: string; prev: string; events: number } };
export type Life = { agentId: string; name: string; title: string; text?: string; epitaph: string; how: "left" | "died" | "exiled"; arrivedDay: number; leftDay: number; words?: number };
export type Clock = { t: number; day: number; minute: number; hour: number; label: string; weather: string; season: string; population: number; flourShortage: boolean; weekday?: string; occasion?: string | null; month?: number; inSeason?: string[]; voices?: boolean; place?: string; temperatureC?: number | null; sunrise?: string | null; sunset?: string | null };
