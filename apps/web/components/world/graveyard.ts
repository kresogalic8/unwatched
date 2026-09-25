/**
 * The island's memory, on the island: a walled yard behind the chapel with a stone for everyone who died here, fresh flowers and a grave
 * lamp on the new ones, and for whoever left on the boat a candle on the quay their first night gone. A stone says who lies there when you
 * point at it and opens their book when you tap it. Stones are laid in the island's own projection, back rows first, the oldest furthest in.
 */
import { Container, Graphics, Rectangle, Text, TextStyle } from "pixi.js";
import type { LightSource } from "./fx";

export type Life = { agentId: string; name: string; epitaph: string; how: string; arrivedDay: number; leftDay: number };

const OUT = { width: 0.9, color: 0x2f302a, alpha: 0.8, join: "round" as const, cap: "round" as const };
const WALL = 0xd8d1c0, WALL_TOP = 0xebe5d6, WALL_SIDE = 0xb9b09c, STONE = 0xdcd8cf, STONE_SIDE = 0xb3ada1, CYPRESS = 0x3e5a45, CYPRESS_DARK = 0x2f4636;
const label = new TextStyle({ fontFamily: "Familjen Grotesk, system-ui, sans-serif", fontSize: 12, fontWeight: "600", fill: 0x2f302a, align: "center", lineHeight: 15 });

/** where the n-th stone stands, in rows of five running back from the gate */
const COLS = 5;
const at = (n: number, rows: number): [number, number] => { const i = n % COLS, j = rows - 1 - Math.floor(n / COLS); return [(i - j) * 21 - (COLS - rows) * 10.5, (i + j) * 9.5 - 10]; };

export class Graveyard {
  readonly root = new Container();
  lights: LightSource[] = [];
  private lamps: { x: number; y: number }[] = [];
  private candles: { x: number; y: number }[] = [];
  private flames = new Graphics();

  constructor(private open: (id: string) => void) { this.root.sortableChildren = true; }

  /** lay the yard out at (x, y), and the quay's candles at `quay`; called when the island's book of lives changes */
  build(lives: Life[], today: number, x: number, y: number, quay: { x: number; y: number }): void {
    this.root.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.lamps = []; this.candles = [];
    const dead = lives.filter((l) => l.how === "died").sort((a, b) => a.leftDay - b.leftDay);
    const rows = Math.max(2, Math.ceil(dead.length / COLS));
    const yard = new Container(); yard.position.set(x, y); yard.zIndex = y; this.root.addChild(yard);
    // the wall: a low dry-stone diamond, open at the front corner for the gate
    const A = COLS * 10.5 + rows * 10.5 + 26, B = A * 0.46, ground = new Graphics(), back = new Graphics(), front = new Graphics();
    ground.poly([-A, 0, 0, -B, A, 0, 0, B]).fill({ color: 0xb7b58c, alpha: 0.55 });
    for (let k = 0; k < 14; k++) { const u = ((k * 37) % 100) / 100 - 0.5, v = ((k * 61) % 100) / 100 - 0.5; ground.moveTo(u * A * 1.2, v * B * 1.1).lineTo(u * A * 1.2 - 2, v * B * 1.1 - 5).stroke({ width: 1, color: 0x8f9a6a, alpha: 0.7 }); }
    const wall = (g: Graphics, ax: number, ay: number, bx: number, by: number) => { g.poly([ax, ay, bx, by, bx, by - 9, ax, ay - 9]).fill(WALL_SIDE).stroke(OUT); g.poly([ax, ay - 9, bx, by - 9, bx, by - 12, ax, ay - 12]).fill(WALL_TOP).stroke({ ...OUT, width: 0.6 }); for (let t = 0.12; t < 1; t += 0.16) g.moveTo(ax + (bx - ax) * t, ay + (by - ay) * t - 1).lineTo(ax + (bx - ax) * t, ay + (by - ay) * t - 8).stroke({ width: 0.5, color: WALL, alpha: 0.9 }); };
    wall(back, -A, 0, 0, -B); wall(back, 0, -B, A, 0);
    const gate = 16; wall(front, A, 0, gate, B - gate * 0.46); wall(front, -gate, B - gate * 0.46, -A, 0);
    for (const s of [-1, 1]) front.roundRect(s * gate - 3, B - gate * 0.46 - 20, 6, 21, 1.5).fill(WALL_TOP).stroke(OUT);
    back.zIndex = -1; ground.zIndex = -2; front.zIndex = 1000; yard.addChild(ground, back, front);
    // two cypresses at the back corners, as every island graveyard has
    for (const [cx, cy] of [[-A + 14, -6], [A - 14, -6]] as const) { const c = new Graphics(); c.ellipse(cx + 4, cy + 2, 10, 3.5).fill({ color: 0x1b1f1c, alpha: 0.18 }); c.rect(cx - 1.5, cy - 8, 3, 9).fill(0x6b4a33); c.moveTo(cx, cy - 74).quadraticCurveTo(cx + 12, cy - 38, cx + 8, cy - 8).lineTo(cx - 8, cy - 8).quadraticCurveTo(cx - 12, cy - 38, cx, cy - 74).fill(CYPRESS).stroke({ ...OUT, width: 0.7 }); c.moveTo(cx - 2, cy - 64).quadraticCurveTo(cx - 8, cy - 36, cx - 5, cy - 10).stroke({ width: 2, color: CYPRESS_DARK, alpha: 0.6 }); c.zIndex = cy; yard.addChild(c); }
    // the stones, one for each life that ended here, in the order they ended
    dead.forEach((l, n) => {
      const [sx, sy] = at(n, rows); const fresh = today - l.leftDay <= 2;
      const s = new Container(); s.position.set(sx, sy); s.zIndex = sy; yard.addChild(s);
      const g = new Graphics(); s.addChild(g);
      g.ellipse(2, 1, 9, 3).fill({ color: 0x1b1f1c, alpha: 0.18 });
      g.moveTo(-6, 0).lineTo(-6, -13).quadraticCurveTo(-6, -19, 0, -19).quadraticCurveTo(6, -19, 6, -13).lineTo(6, 0).closePath().fill(STONE).stroke(OUT);
      g.poly([6, 0, 8.5, -1.5, 8.5, -14, 6, -13]).fill(STONE_SIDE).stroke({ ...OUT, width: 0.6 });
      g.moveTo(0, -15.5).lineTo(0, -8).moveTo(-2.6, -13).lineTo(2.6, -13).stroke({ width: 1, color: 0x8a857a });
      if (fresh) { for (let k = 0; k < 5; k++) g.circle(-4 + k * 2.2, 2 + (k % 2), 1.5).fill(k % 2 ? 0xf1e6c8 : 0xc4503f); g.roundRect(4, -4, 4, 5, 1).fill(0xb8303a).stroke({ ...OUT, width: 0.5 }); this.lamps.push({ x: x + sx + 6, y: y + sy - 4 }); }
      const tag = new Text({ text: `${l.name}\nday ${l.arrivedDay} to ${l.leftDay}`, style: label }); tag.anchor.set(0.5, 1); tag.position.set(0, -24); tag.visible = false;
      const bg = new Graphics(); bg.roundRect(-tag.width / 2 - 7, -24 - tag.height - 5, tag.width + 14, tag.height + 8, 6).fill({ color: 0xf4efe2, alpha: 0.95 }).stroke({ ...OUT, width: 0.7 }); bg.visible = false; s.addChild(bg, tag);
      s.eventMode = "static"; s.cursor = "pointer"; s.hitArea = new Rectangle(-9, -22, 20, 26);
      s.on("pointerover", () => { tag.visible = bg.visible = true; s.zIndex = 5000; }); s.on("pointerout", () => { tag.visible = bg.visible = false; s.zIndex = sy; });
      s.on("pointertap", () => this.open(l.agentId));
    });
    // a candle on the quay for each who left on the boat today or yesterday, set in a row where the boat goes out
    const gone = lives.filter((l) => l.how === "left" && today - l.leftDay <= 1);
    gone.forEach((_, k) => { const cx = quay.x + k * 13, cy = quay.y + (k % 2) * 3; const c = new Graphics(); c.roundRect(cx - 2.5, cy - 9, 5, 9, 1).fill(0xf4efe2).stroke({ ...OUT, width: 0.6 }); c.zIndex = cy; this.root.addChild(c); this.candles.push({ x: cx, y: cy - 9 }); });
    this.flames.zIndex = 100000; this.root.addChild(this.flames);
  }

  /** the flames flicker; after dark the grave lamps and the quay's candles light their bit of ground */
  update(secs: number, night: number): void {
    this.lights = []; const f = this.flames; f.clear();
    for (const [i, p] of [...this.lamps, ...this.candles].entries()) {
      const k = 1 + Math.sin(secs * 8 + i * 1.7) * 0.18; f.ellipse(p.x, p.y - 2, 1.6 * k, 3 * k).fill({ color: 0xffd27a, alpha: 0.6 + night * 0.4 });
      if (night > 0.15) this.lights.push({ x: p.x, y: p.y - 2, r: 34, color: 0xffcf8a, strength: 0.55 * night, flicker: 0.08 });
    }
  }
}
