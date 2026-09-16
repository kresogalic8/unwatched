/** Isolated local preview. No store, credentials, paid brains or real citizens. */
import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { Town, Rng } from "@unwatched/engine";
import { MockBrain, seedPersonas } from "@unwatched/cognition";
import { clockOf, publicAgent, ownerAgent } from "../src/views.ts";
import { Action } from "@unwatched/protocol";

const brain = new MockBrain(4);
Object.defineProperty(brain, "name", {value: "none"});
const wss = new WebSocketServer({ noServer: true });
function broadcast(data: unknown) { for (const ws of wss.clients) if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data)); }
const town = new Town({seed: 4, brain, onEvent: event => broadcast({type: "event", event})});
town.t = 9 * 60; town.weather = "clear";
const mara = town.addAgent({persona: {...seedPersonas(new Rng(4), 1)[0]!, name: "Mara · preview"}});
mara.location = "harbor"; mara.needs.hunger = .1; mara.needs.rest = .1;
mara.home = {place: "boatshed", nightsPaid: 10};
mara.inventory = ["suitcase", "timber", "timber", "timber", "rope", "rope", "rope", "stone", "planks"];
const people = () => [...town.agents.values()].map(a => publicAgent(town, a));
let sellAt: number | null = null;
const server = createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (origin === "http://localhost:3000") res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  if (req.url === "/api/town") return res.end(JSON.stringify({...clockOf(town), size: town.pack.size, places: [...town.places.values()].map(p => ({...p, storedCount: [...town.agents.values()].reduce((n,a)=>n+(a.storage?.find(s=>s.place===p.id)?.items.length ?? 0),0), looseCount:p.looseItems?.length ?? 0, crowd: town.crowd(p.id), site: null}))}));
  if (req.url === "/api/agents") return res.end(JSON.stringify(people()));
  if (req.url === "/preview-owner" || req.url === `/api/agents/${mara.id}`) return res.end(JSON.stringify(ownerAgent(town, mara)));
  if (req.url === "/preview-action" && req.method === "POST" && origin === "http://localhost:3000") {
    try {
      let body = "";
      for await (const chunk of req) {body += chunk; if (body.length > 4096) throw new Error("Action too large");}
      const action = Action.parse(JSON.parse(body));
      const ok = town.apply(mara, action);
      broadcast({type: "hello", agents: people(), clock: clockOf(town), recent: town.events.slice(-12)});
      res.statusCode = ok ? 200 : 400;
      return res.end(JSON.stringify({ok, error: ok ? null : town.events.at(-1)?.text}));
    } catch {res.statusCode = 400;return res.end(JSON.stringify({error:"Invalid preview action"}));}
  }
  if (req.method === "POST" && origin === "http://localhost:3000" && req.url === "/attempt") {
    sellAt = null;
    mara.location = "harbor"; mara.activity = null; mara.lastFishingDay = -1; mara.needs.hunger = .1; mara.needs.rest = .1; town.weather = "clear";
    const ok = town.apply(mara, {kind: "fish"}); broadcast({type: "hello", agents: people(), clock: clockOf(town), recent: town.events.slice(-6)});
    return res.end(JSON.stringify({ok}));
  }
  if (req.method === "POST" && origin === "http://localhost:3000" && req.url === "/sell") {
    const ok = mara.inventory.includes("fish") && town.apply(mara, {kind: "move", to: "fishhouse"});
    if (ok) sellAt = town.t + 12;
    return res.end(JSON.stringify({ok}));
  }
  if (req.method === "POST" && origin === "http://localhost:3000" && req.url === "/storm") {town.weather = "storm"; return res.end("{}");}
  res.statusCode = 404; res.end("{}");
});
server.on("upgrade", (req, socket, head) => {
  if (req.headers.origin !== "http://localhost:3000") return socket.destroy();
  wss.handleUpgrade(req, socket, head, ws => {
    ws.send(JSON.stringify({type: "hello", agents: people(), clock: clockOf(town), recent: town.events.slice(-6)}));
  });
});
let busy = false;
setInterval(async () => {
  if (busy || !wss.clients.size) return;
  busy = true;
  try {
    // Advance the same engine used by the world; only the initial choice is scripted.
    if (mara.activity?.kind === "fish") await town.tick(); else town.t++;
    if (sellAt !== null && town.t >= sellAt) { sellAt = null; town.apply(mara, {kind: "trade", sell: "fish"}); }
    broadcast({type: "hello", agents: people(), clock: clockOf(town), recent: town.events.slice(-6)});
  } finally { busy = false; }
}, 1000);
server.listen(4011, "127.0.0.1", () => console.log("Isolated Harbor preview: http://localhost:4011"));
