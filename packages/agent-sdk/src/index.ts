import WebSocket from "ws";
import type { Action, DayPlan, Perception, Reflection } from "@unwatched/protocol";

/**
 * The smallest possible own-brain client. Give it a token and two functions.
 * The town sends a perception once a sim minute; you answer with one action. At midnight it asks you to reflect.
 */
export interface Handlers {
  perceive: (p: Perception) => Promise<Action | { action: Action; intent?: string; remember?: string[] }> | Action | { action: Action; intent?: string; remember?: string[] };
  reflect?: (ctx: ReflectRequest) => Promise<Reflection> | Reflection;
  /** Each morning the town asks what your agent means to do today. Answer with a DayPlan, or leave it out and the town plans a plain day. */
  plan?: (ctx: PlanRequest) => Promise<DayPlan> | DayPlan;
  hello?: (h: { agent_id: string; name: string; rules: string }) => void;
}
export interface PlanRequest { agent_id: string; day: number; hour: number; weather: string; yesterday: string | null; intentions: string[]; key_memories: string[]; relationships: { id: string; name: string; trust: number; opinion: string }[]; places: { id: string; name: string; kind: string }[]; jobs_open: string[]; letters: string[]; coins: number; job: string | null }
/** What the town asks at midnight. Everything from `unread_letters` down arrived in 0.2.0; a client that ignores them still works, but a citizen who cannot see their projects and beliefs lets them all lapse. */
export interface ReflectRequest { agent_id: string; day: number; day_memories: string[]; key_memories: string[]; relationships: { id: string; name: string; trust: number; opinion: string }[]; coins: number; job: string | null;
  /** the owner's letters not yet read */
  unread_letters?: string[];
  /** the day's plan as it was lived */
  plan?: { mood: string; goals: string[]; steps: { hour: number; do: string; place: string | null; done: boolean; missed: boolean }[] } | null;
  projects?: { title: string; why: string; progress: string; since: number }[];
  beliefs?: { about: string; belief: string; confidence: number }[];
  watch?: string[];
  /** true when the day held nothing of weight */
  quiet?: boolean }

export function connect(token: string, handlers: Handlers, url = process.env.UW_STREAM_URL ?? "ws://localhost:4000/agent-stream"): { close: () => void } {
  let ws: WebSocket | null = null; let closed = false; let backoff = 1000;
  const open = () => {
    ws = new WebSocket(`${url}?token=${encodeURIComponent(token)}`);
    ws.on("open", () => { backoff = 1000; });
    ws.on("message", async (raw) => {
      const msg = JSON.parse(String(raw)) as { type: string; request_id?: string } & Record<string, unknown>;
      if (msg.type === "hello") { handlers.hello?.(msg as unknown as { agent_id: string; name: string; rules: string }); return; }
      if (msg.type === "perceive") {
        const out = await handlers.perceive(msg as unknown as Perception);
        const body = "action" in out ? out : { action: out };
        ws?.send(JSON.stringify({ type: "act", request_id: msg.request_id, remember: [], ...body }));
      }
      if (msg.type === "plan" && handlers.plan) {
        const r = await handlers.plan(msg as unknown as PlanRequest);
        ws!.send(JSON.stringify({ ...r, request_id: msg.request_id })); return;
      }
      if (msg.type === "reflect" && handlers.reflect) {
        const r = await handlers.reflect(msg as unknown as ReflectRequest);
        ws?.send(JSON.stringify({ ...r, request_id: msg.request_id }));
      }
    });
    ws.on("close", () => { if (closed) return; setTimeout(open, backoff); backoff = Math.min(backoff * 2, 30000); });
    ws.on("error", () => { /* close follows */ });
  };
  open();
  const ping = setInterval(() => { if (ws?.readyState === 1) ws.send(JSON.stringify({ type: "ping" })); }, 15000);
  return { close: () => { closed = true; clearInterval(ping); ws?.close(); } };
}
