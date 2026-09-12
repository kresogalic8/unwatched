/**
 * Looks. When a citizen builds something and says how it should look, the island draws it: Recraft's vector model
 * paints an SVG in the island's palette and projection, and a deterministic pass after it strips what does not belong
 * (metadata, gradients, a painted background) and snaps every colour to the palette. The result is kept on disk and,
 * when there is a shared record, in it, and served to every viewer as a scalable drawing. No key, no drawing: the street
 * shows the plain house or shop until a drawing exists, and a drawing can be dropped into the looks folder by hand.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** The island's palette, the same hexes the code-drawn buildings use. */
export const PALETTE = ["#F7F5EE", "#E9E5D8", "#1F5F5B", "#174A47", "#E8735A", "#B9D9C6", "#9FC2AD", "#1E2A2B", "#C9B58F", "#8A6A45", "#B97754", "#92553E", "#76846A", "#D1C6AD"];
const BACKGROUND = "#EFEDE4";
const MODEL = process.env.UW_LOOK_MODEL ?? "recraftv4_1_vector";

export interface LookStore { saveLook(row: { hash: string; look: string; svg: string; source: string }): Promise<void>; loadLook(hash: string): Promise<{ look: string; svg: string } | null>; listLooks(): Promise<{ hash: string; look: string; created_at: string }[]> }

export function looksEnabled(): boolean { return !!process.env.RECRAFT_API_KEY; }
/** Generated drawings are off unless asked for: the hand-drawn set is the island's look, and a described build shows the plain house or shop. Set UW_LOOKS=patterns to open the pattern book, or a Recraft key for exact drawings. */
export function looksWanted(): boolean { return looksEnabled() || process.env.UW_LOOKS === "patterns"; }

/** The pattern book: buildings drawn ahead of time, in the island's hand, for the looks people most often ask for. Each pattern is a file in apps/server/patterns and a few words that call it. */
export const PATTERNS: { name: string; words: RegExp }[] = [
  { name: "tower", words: /tower|lookout|watch|lighthouse|tall/ },
  { name: "boathouse", words: /boat|harbou?r|pier|jetty|dock/ },
  { name: "fishhut", words: /fish|net|hut on posts|stilt/ },
  { name: "smokehouse", words: /smoke|cur(e|ing)|kiln/ },
  { name: "forge", words: /forge|smith|anvil|iron|metal/ },
  { name: "chapel", words: /chapel|church|bell|shrine|temple/ },
  { name: "warehouse", words: /warehouse|store ?room|storage|depot|barn|granar/ },
  { name: "granary", words: /granary|grain|silo/ },
  { name: "tavern", words: /tavern|inn\b|bar\b|cafe|café|pub|drink|awning|soup|food|bread|eat|sell/ },
  { name: "workshop", words: /workshop|carpent|joiner|sawy|wood|bench|studio|atelier/ },
  { name: "bathhouse", words: /bath|spa|steam|wash/ },
  { name: "cabin", words: /cabin|log|timber|wooden/ },
  { name: "cottage", words: /cottage|stone|house|home|small/ },
];
export function patternFor(look: string, kind: "house" | "shop"): string { const l = look.toLowerCase(); return PATTERNS.find((p) => p.words.test(l))?.name ?? (kind === "shop" ? "workshop" : "cottage"); }

/** The prompt that keeps every generated building in the island's hand. */
export function lookPrompt(look: string, kind: "house" | "shop"): string {
  return `Flat vector illustration of ${look}, a small ${kind === "shop" ? "shop or workshop" : "house"} on a Mediterranean island, drawn in dimetric projection (2:1 isometric, seen from the front-right corner at a 30 degree angle), for a hand-drawn game map. Style: a handcrafted Mediterranean diorama, clean vector shapes with fine muted olive outlines, warm limestone blocks and plaster, individually drawn terracotta roof tiles, recessed windows with olive wooden shutters, pale stone sills, warm tan wood, subtle material facets and a darker right-facing wall; no gradients or raster textures. Preserve the citizen's explicitly described architectural features and colors; use these materials as defaults where unspecified. Centered, the whole building visible, nothing else in the frame: no ground, no shadow, no people, no text, no background.`;
}

const hexOf = (m: RegExpMatchArray) => "#" + [m[1], m[2], m[3]].map((v) => Number(v).toString(16).padStart(2, "0")).join("").toUpperCase();
const dist = (a: string, b: string) => { const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); const [r1, g1, b1] = p(a), [r2, g2, b2] = p(b); return (r1! - r2!) ** 2 + (g1! - g2!) ** 2 + (b1! - b2!) ** 2; };
const nearest = (hex: string) => PALETTE.reduce((best, c) => (dist(c, hex) < dist(best, hex) ? c : best), PALETTE[0]!);

/** The deterministic pass: nothing the model adds survives unless it belongs. */
export function disciplineSvg(svg: string): string {
  let s = svg.replace(/<metadata>[\s\S]*?<\/metadata>/g, "").replace(/\s*xmlns:c2pa="[^"]*"/g, "").replace(/<defs>[\s\S]*?<\/defs>/g, "");
  s = s.replace(/\s*preserveAspectRatio="none"/g, "").replace(/\s*style="display:\s*block;?"/g, "");
  // rgb() and hex fills snap to the palette; gradients become the wall colour
  s = s.replace(/fill="rgb\((\d+),\s*(\d+),\s*(\d+)\)"/g, (_m, r, g, b) => `fill="${nearest(hexOf([_m, r, g, b] as unknown as RegExpMatchArray))}"`);
  s = s.replace(/fill="(#[0-9a-fA-F]{6})"/g, (_m, h: string) => `fill="${nearest(h.toUpperCase())}"`);
  s = s.replace(/fill="url\(#[^)]*\)"/g, `fill="${PALETTE[0]}"`);
  // a painted background: the first path when it is the background colour or white, or covers the whole canvas
  s = s.replace(/(<svg[^>]*>)\s*(<path[^>]*>)/, (_m, open: string, first: string) => { const fill = /fill="(#[0-9A-F]{6})"/.exec(first)?.[1]; const bg = fill === nearest(BACKGROUND) || fill === "#FFFFFF" || fill === PALETTE[0] && /M ?0[ ,]0/.test(first); return bg ? open : `${open}${first}`; });
  return s.trim();
}

export class Looks {
  private mem = new Map<string, string>(); private inflight = new Map<string, Promise<string | null>>();
  constructor(private dir: string, private patterns: string, private store: LookStore | null, private log: (l: string) => void) { mkdirSync(dir, { recursive: true }); }
  /** The pattern book itself, for the shelf. */
  patternBook(): string[] { return existsSync(this.patterns) ? readdirSync(this.patterns).filter((n) => n.endsWith(".svg")).map((n) => n.slice(0, -4)) : []; }
  pattern(name: string): string | null { const f = join(this.patterns, `${name.replace(/[^a-z-]/g, "")}.svg`); return existsSync(f) ? readFileSync(f, "utf8") : null; }
  private file(hash: string) { return join(this.dir, `${hash}.svg`); }
  /** The drawing for a look, if the island has it. */
  async get(hash: string): Promise<string | null> {
    const m = this.mem.get(hash); if (m) return m;
    const f = this.file(hash); if (existsSync(f)) { const s = readFileSync(f, "utf8"); this.mem.set(hash, s); return s; }
    const row = await this.store?.loadLook(hash).catch(() => null); if (row) { this.mem.set(hash, row.svg); try { writeFileSync(f, row.svg); } catch { /* memory is enough */ } return row.svg; }
    return null;
  }
  /** What is on the shelf: every look the island has drawn. */
  async list(): Promise<{ hash: string; look: string }[]> {
    const rows = this.store ? await this.store.listLooks().catch(() => []) : [];
    const local = existsSync(this.dir) ? readdirSync(this.dir).filter((n) => n.endsWith(".svg")).map((n) => ({ hash: n.slice(0, -4), look: "" })) : [];
    const seen = new Set(rows.map((r) => r.hash)); return [...rows.map((r) => ({ hash: r.hash, look: r.look })), ...local.filter((l) => !seen.has(l.hash))];
  }
  /** Make sure a drawing exists for a look: draw it once, keep it, and never draw it twice. */
  ensure(hash: string, look: string, kind: "house" | "shop"): Promise<string | null> {
    const going = this.inflight.get(hash); if (going) return going;
    const p = (async () => {
      const have = await this.get(hash); if (have) return have;
      if (!looksWanted()) { this.inflight.delete(hash); return null; }
      let svg: string | null = null; let source = MODEL;
      if (looksEnabled()) { try { svg = disciplineSvg(await this.draw(look, kind)); } catch (err) { this.log(`could not draw “${look}”: ${(err as Error).message}`); } }
      if (!svg) {
        // no key, or the model failed: the nearest page of the pattern book stands in, and the exact drawing can come later
        const name = patternFor(look, kind); const f = join(this.patterns, `${name}.svg`);
        if (existsSync(f)) { svg = readFileSync(f, "utf8"); source = `pattern:${name}`; this.log(`“${look}” drawn from the pattern book as ${name}${looksEnabled() ? "" : " (set RECRAFT_API_KEY for an exact drawing)"}`); }
        else { this.log(`no drawing for “${look}” (${hash}); no pattern ${name} either`); this.inflight.delete(hash); return null; }
      } else this.log(`drew “${look}” as ${hash} (${svg.length} bytes)`);
      this.mem.set(hash, svg); try { writeFileSync(this.file(hash), svg); } catch { /* memory is enough */ }
      await this.store?.saveLook({ hash, look, svg, source }).catch((e: Error) => this.log(`look not recorded: ${e.message}`));
      this.inflight.delete(hash); return svg;
    })();
    this.inflight.set(hash, p); return p;
  }
  /** Recraft's vector model, straight from the documented endpoint. */
  private async draw(look: string, kind: "house" | "shop"): Promise<string> {
    const res = await fetch("https://external.api.recraft.ai/v1/images/generations", {
      method: "POST", headers: { Authorization: `Bearer ${process.env.RECRAFT_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: lookPrompt(look, kind), model: MODEL, style: "vector_illustration", size: "1024x1024", n: 1, response_format: "url", negative_prompt: "ground, shadow, people, text, watermark, gradient, texture, perspective", controls: { colors: PALETTE.map((h) => ({ rgb: [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)] })) } }),
      signal: AbortSignal.timeout(90000),
    });
    if (!res.ok) throw new Error(`recraft ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = (await res.json()) as { data?: { url?: string }[] }; const url = data.data?.[0]?.url; if (!url) throw new Error("recraft returned no image");
    const svg = await (await fetch(url, { signal: AbortSignal.timeout(30000) })).text(); if (!/<svg/i.test(svg)) throw new Error("recraft did not return an SVG");
    return svg;
  }
}
