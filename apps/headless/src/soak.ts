import { mkdirSync, writeFileSync, createWriteStream, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Town, MINUTES_PER_DAY } from "@unwatched/engine";
import type { Brain } from "@unwatched/engine";
import { MockBrain, AnthropicBrain, OpenRouterBrain, seedPersonas } from "@unwatched/cognition";
import { Rng } from "@unwatched/engine";

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : def;
}

const days = Number(arg("days", "7"));
const agents = Number(arg("agents", "20"));
const seed = Number(arg("seed", "42"));
const brainName = arg("brain", "mock");
const tick = Number(arg("tick", "1"));
const outDir = arg("out", "out");
const owner = arg("owner", "you");

// Load .env from the repo root, wherever this is run from.
const here = dirname(fileURLToPath(import.meta.url));
const envFile = resolve(here, "../../../.env");
if (existsSync(envFile)) process.loadEnvFile(envFile);

if (brainName === "anthropic" && !process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
  console.error("The Anthropic brain needs credentials. Put ANTHROPIC_API_KEY=... in " + envFile + " (copy .env.example), or export it in your shell, then run again.");
  process.exit(1);
}
if (brainName === "openrouter" && !process.env.OPENROUTER_API_KEY) {
  console.error("The OpenRouter brain needs a key. Put OPENROUTER_API_KEY=... in " + envFile + " (copy .env.example), or export it in your shell, then run again.");
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
const eventsFile = createWriteStream(`${outDir}/events.jsonl`);
const log = (l: string) => process.stderr.write(`  ${l}\n`);

const brain: Brain = brainName === "anthropic" ? new AnthropicBrain({ log }) : brainName === "openrouter" ? new OpenRouterBrain({ log }) : new MockBrain(seed);
const town = new Town({ seed, brain, minutesPerTick: tick, onEvent: (e) => eventsFile.write(JSON.stringify(e) + "\n"), log });

const personas = seedPersonas(new Rng(seed), agents);
for (const [i, p] of personas.entries()) town.addAgent({ persona: p, owner: i < 3 ? owner : null });
const mira = town.agents.values().next().value!;

console.log(`Unwatched · ${agents} citizens · ${days} days · brain ${brain.name} · seed ${seed}`);
const t0 = Date.now();
let lastDay = town.day;
const startT = town.t;

await (async () => {
  while (town.day <= days) {
    await town.tick();
    if (town.day === 2 && town.hour === 6 && town.minuteOfDay === 360) town.sendLetter(mira.id, "Find honest work first. Don't borrow. Write to me before any big decision.");
    if (town.day !== lastDay) {
      const d = lastDay;
      const paper = town.papers[town.papers.length - 1];
      if (paper) {
        const md = [`# The Gazette · edition ${paper.edition} · ${paper.date} · ${paper.weather}`, "", `## ${paper.lead.headline}`, `*${paper.lead.deck}*`, "", paper.lead.body, "", ...paper.briefs.flatMap((b) => [`### ${b.headline}`, b.body, ""]), "## Notices", ...paper.notices.map((n) => `- ${n}`), ""].join("\n");
        writeFileSync(`${outDir}/gazette-day${d}.md`, md);
        console.log(`\n${md.split("\n").slice(0, 4).join("\n")}`);
      }
      const coins = [...town.agents.values()].reduce((s, a) => s + a.coins, 0);
      const jobs = [...town.agents.values()].filter((a) => a.job).length;
      const broke = [...town.agents.values()].filter((a) => a.coins <= 2).length;
      console.log(`  day ${d}: coins in circulation ${coins} · employed ${jobs}/${town.agents.size} · broke ${broke} · events ${town.events.length} · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      lastDay = town.day;
    }
  }
})();

const digest = town.digest(mira.id, startT + MINUTES_PER_DAY * Math.max(0, days - 3));
const summary = {
  seed, days, agents, brain: brain.name, elapsedMs: Date.now() - t0, events: town.events.length,
  digestFor: mira.persona.name, digest,
  citizens: [...town.agents.values()].map((a) => ({ name: a.persona.name, coins: a.coins, job: a.job, home: a.home, memories: a.memory.length, relationships: a.relationships.size })),
};
writeFileSync(`${outDir}/summary.json`, JSON.stringify(summary, null, 2));
writeFileSync(`${outDir}/construction.json`, JSON.stringify({ town: `Island · seed ${seed}`, source: `${brain.name} simulation · ${days} days · seed ${seed}`, size: town.pack.size, buildings: [...town.places.values()].filter(p => p.history).map(p => ({x:p.x,y:p.y,district:p.district,history:p.history})) }, null, 2));
eventsFile.end();

console.log(`\nWhile you were away · ${mira.persona.name} · last 3 days`);
console.log(`  ${digest.headline}`);
for (const e of digest.items.slice(0, 8)) console.log(`  ${town.clock(e.t)}  ${e.text.slice(0, 140)}`);
if (brain instanceof OpenRouterBrain) { const u = brain.usage(); console.log(`\nOpenRouter: ${u.calls} calls · ${u.prompt} prompt tokens · ${u.completion} completion tokens`); }
console.log(`\nWrote ${outDir}/events.jsonl, ${outDir}/gazette-day*.md, ${outDir}/summary.json`);
