import { Container, Graphics } from 'pixi.js';

type Point = { x: number; y: number };
type Visitor = Point & { id: string; moving?: boolean };
const TAU = Math.PI * 2;
const noise = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

/** Ambient ecology only. Fish are not inventory and these crabs are not agents. */
export class CoastalLife {
  readonly root = new Container();
  readonly glow = new Graphics();
  private bed = new Graphics();
  private water = new Graphics();
  private animals = new Graphics();
  private lastTime = -1;
  private lastAppearance = '';
  private steps = new Map<string, Point & { left: boolean }>();
  private prints: (Point & { angle: number; at: number })[] = [];
  private schools: { x: number; y: number; angle: number; fear: number }[];
  private crabs: { x: number; y: number; hide: number }[];

  constructor(private shore: (angle: number, radius: number) => Point, private inside: (x: number, y: number) => number) {
    this.root.eventMode = 'none';
    this.glow.eventMode = 'none'; this.glow.blendMode = 'add';
    this.root.addChild(this.bed, this.water, this.animals);
    this.schools = Array.from({ length: 18 }, (_, i) => ({ ...shore(i / 18 * TAU, 1.065), angle: 0, fear: 0 }));
    this.crabs = Array.from({ length: 26 }, (_, i) => ({ ...shore((i + .4) / 26 * TAU, .998), hide: 0 }));
    // Shells, rounded pebbles and small patches of sea grass follow the actual coastline.
    for (let i = 0; i < 180; i++) {
      const p = shore(i / 180 * TAU, .987 + noise(i) * .025);
      const r = 1.2 + noise(i + 20) * 2.5;
      this.bed.ellipse(p.x, p.y + 1, r + .8, r * .48).fill({ color: 0x5d786e, alpha: .18 });
      this.bed.ellipse(p.x, p.y, r, r * .52).fill({ color: i % 4 === 0 ? 0xe7d9bb : 0x9fa995, alpha: .72 });
      if (i % 4 === 0) for (let k = -1; k <= 1; k++) this.bed.moveTo(p.x, p.y + 1).lineTo(p.x + k * 1.4, p.y - r * .45).stroke({ width: .45, color: 0xa79578, alpha: .5 });
    }
  }

  update(time: number, night: number, weather: string, boats: Point[], people: Visitor[], reduced: boolean, wonder = false) {
    // At most 30 geometry rebuilds per second; no timers or allocations per fish.
    const appearance = `${Math.round(night * 20)}:${weather}:${reduced}:${wonder}`;
    if (this.lastTime >= 0 && time - this.lastTime < 1 / 30 && appearance === this.lastAppearance) return;
    const dt = this.lastTime < 0 ? 0 : Math.min(.1, Math.max(0, time - this.lastTime));
    this.lastTime = time;
    this.lastAppearance = appearance;
    const dark = Math.min(1, Math.max(0, night));
    const clarity = (1 - dark * .65) * (weather === 'storm' ? .35 : weather === 'rain' ? .65 : 1);
    this.water.clear(); this.animals.clear(); this.glow.clear();
    if(wonder) for(let i=0;i<360;i++) {
      const p=this.shore(i/360*TAU,1.014+Math.sin(time*.45+i*.3)*.005);
      const next=this.shore((i+1)/360*TAU,1.014+Math.sin(time*.45+(i+1)*.3)*.005);
      const intensity=(.25+.75*Math.max(0,Math.sin(time*.8+i*.23)))*dark;
      this.glow.moveTo(p.x,p.y).lineTo(next.x,next.y).stroke({color:0x35c5c1,width:14,alpha:intensity*.05});
      this.glow.moveTo(p.x,p.y).lineTo(next.x,next.y).stroke({color:0x58e9d6,width:5,alpha:intensity*.15});
      this.glow.moveTo(p.x,p.y).lineTo(next.x,next.y).stroke({color:0xa4fff0,width:1.1,alpha:intensity*.35});
    }
    const present = new Set(people.map(p => p.id));
    for (const id of this.steps.keys()) if (!present.has(id)) this.steps.delete(id);
    for (const p of people) {
      const previous = this.steps.get(p.id);
      if (!previous) { this.steps.set(p.id, { ...p, left: false }); continue; }
      const distance = Math.hypot(p.x - previous.x, p.y - previous.y);
      if (distance < 12) continue;
      const angle = Math.atan2(p.y - previous.y, p.x - previous.x);
      const shoreDistance = this.inside(p.x, p.y);
      if (p.moving && !reduced && distance < 50 && shoreDistance > .91 && shoreDistance < 1.006) {
        const side = previous.left ? 2 : -2;
        this.prints.push({ x: p.x - Math.sin(angle) * side, y: p.y + Math.cos(angle) * side, angle, at: time });
      }
      this.steps.set(p.id, { ...p, left: !previous.left });
    }
    this.prints = this.prints.filter(p => time - p.at < 24).slice(-160);
    for (const p of this.prints) {
      const alpha = Math.max(0, 1 - (time - p.at) / 24) * .22;
      this.animals.moveTo(p.x, p.y).lineTo(p.x + Math.cos(p.angle) * 3, p.y + Math.sin(p.angle) * 3).stroke({ color: 0x647362, width: 1.8, cap: 'round', alpha });
    }
    // Small mooring markers sit offshore; each float and its reflection share one position.
    for (let i = 0; i < 6; i++) {
      const p = this.shore((i + .3) / 6 * TAU, 1.105);
      const bob = reduced ? 0 : Math.sin(time * 1.7 + i * 2) * (weather === 'storm' ? 2.7 : 1.1);
      const g = this.animals;
      this.water.ellipse(p.x, p.y + 2, 8 + Math.sin(time + i), 2.6).stroke({ color: 0xdde5c9, width: .8, alpha: clarity * .32 });
      g.ellipse(p.x + 1, p.y + 4, 2.8, 3).fill({ color: 0x567f72, alpha: .2 });
      g.ellipse(p.x, p.y + bob, 3.4, 4.5).fill({ color: i % 2 ? 0xc8774c : 0xd7c494, alpha: .85 });
      g.moveTo(p.x - 2.5, p.y + bob).lineTo(p.x + 2.5, p.y + bob).stroke({ color: 0xebe2bf, width: 1.8, alpha: .8 });
      g.moveTo(p.x, p.y - 3 + bob).lineTo(p.x, p.y - 9 + bob).stroke({ color: 0x657267, width: 1 });
    }
    for (let i = 0; i < 72; i++) {
      const p = this.shore(i / 72 * TAU, 1.018 + noise(i + 300) * .033);
      const sway = Math.sin(time * 1.2 + i) * 3;
      // Submerged grass fans: rooted, with only their tips following the current.
      if (i % 2 === 0) for (let k = -1; k <= 1; k++) this.water.moveTo(p.x, p.y).quadraticCurveTo(p.x + k * 4, p.y - 6, p.x + k * 6 + sway, p.y - 12 - noise(i) * 6).stroke({ color: 0x467f78, width: 1.4, alpha: clarity * .28 });
      const phase = .5 + .5 * Math.sin(time * .8 + i * 2.3);
      this.water.moveTo(p.x - 9, p.y + 7).quadraticCurveTo(p.x + sway, p.y + 4, p.x + 12, p.y + 6).stroke({ color: 0xe5edcf, width: .9, alpha: phase * clarity * .24 });
    }
    this.schools.forEach((s, i) => {
      const a = i / 18 * TAU + Math.sin(time * .055 + i) * .055;
      const target = this.shore(a, 1.07 + Math.sin(time * .13 + i * 2) * .024);
      let dx = (target.x - s.x) * .55, dy = (target.y - s.y) * .55, alarm = false;
      for (const b of boats) {
        const bx = s.x - b.x, by = s.y - b.y, distance = Math.hypot(bx, by);
        if (distance < 110) { const strength = (1 - distance / 110) * 95; dx += bx / Math.max(1, distance) * strength; dy += by / Math.max(1, distance) * strength; alarm = true; }
      }
      for (const p of people) if (p.moving) {
        const px = s.x - p.x, py = s.y - p.y, distance = Math.hypot(px, py);
        if (distance < 75) { dx += px / Math.max(1, distance) * 30; dy += py / Math.max(1, distance) * 30; alarm = true; }
      }
      s.fear += ((alarm ? 1 : 0) - s.fear) * Math.min(1, dt * 3);
      const nx = s.x + dx * dt, ny = s.y + dy * dt;
      if (this.inside(nx, ny) > 1.025 && this.inside(nx, ny) < 1.2) { s.x = nx; s.y = ny; }
      if (Math.hypot(dx, dy) > .3) { const desired = Math.atan2(dy, dx); s.angle += Math.atan2(Math.sin(desired - s.angle), Math.cos(desired - s.angle)) * Math.min(1, dt * 2.5); }
      for (let j = 0; j < 7; j++) {
        const spread = 1 + s.fear * 1.5;
        const x = s.x + Math.cos(j * 2.4 + i) * (7 + j * 3) * spread;
        const y = s.y + Math.sin(j * 2.4 + i) * (5 + j * 2) * spread;
        if (this.inside(x, y) < 1.022) continue;
        const angle = s.angle + Math.sin(time * 1.5 + j) * .14;
        const ux = Math.cos(angle), uy = Math.sin(angle), vx = -uy, vy = ux;
        const size = 4 + noise(i * 13 + j) * 3, tail = Math.sin(time * (8 + s.fear * 9) + j) * 1.6;
        const g = this.animals;
        g.moveTo(x + ux * size, y + uy * size).quadraticCurveTo(x + vx * 2.2, y + vy * 2.2, x - ux * size, y - uy * size).quadraticCurveTo(x - vx * 2.2, y - vy * 2.2, x + ux * size, y + uy * size).fill({ color: 0x386f6b, alpha: clarity * .66 });
        g.poly([x - ux * (size - 1), y - uy * (size - 1), x - ux * (size + 4) + vx * (2 + tail), y - uy * (size + 4) + vy * (2 + tail), x - ux * (size + 4) + vx * (-2 + tail), y - uy * (size + 4) + vy * (-2 + tail)]).fill({ color: 0x477e75, alpha: clarity * .55 });
        g.moveTo(x + ux * size * .5, y + uy * size * .5 - .7).lineTo(x - ux * size * .5, y - uy * size * .5 - .7).stroke({ color: 0xbcd5bc, width: .8, alpha: clarity * .55 });
        if(wonder) g.ellipse(x-ux*8,y-uy*8,9,2).fill({color:0x6df5e6,alpha:dark*(.12+s.fear*.2)});
      }
      // An occasional surface ring, without implying an invented fishing catch.
      const ring = (time * .13 + i * .37) % 1;
      if (ring < .18 && !reduced) this.water.ellipse(s.x, s.y, 3 + ring * 100, 1 + ring * 36).stroke({ color: 0xe4e7cb, width: .8, alpha: (1 - ring / .18) * clarity * .4 });
    });
    this.crabs.forEach((c, i) => {
      const scared = people.some(p => p.moving && Math.hypot(p.x - c.x, p.y - c.y) < 85);
      c.hide += ((scared ? 1 : 0) - c.hide) * Math.min(1, dt * (scared ? 4 : .35));
      const patrol = Math.max(0, Math.sin(time * .28 + i * 2));
      const target = this.shore((i + .4) / 26 * TAU + Math.sin(time * .14 + i) * .009 * (1 - c.hide), .998 - c.hide * .009);
      c.x += (target.x - c.x) * Math.min(1, dt * (scared ? 6 : 1.4)); c.y += (target.y - c.y) * Math.min(1, dt * (scared ? 6 : 1.4));
      const alpha = (1 - c.hide) * (1 - dark * .4);
      if (alpha < .06) return;
      const g = this.animals, x = c.x, y = c.y;
      g.ellipse(x, y + 2, 6, 2).fill({ color: 0x426258, alpha: alpha * .2 });
      for (const side of [-1, 1]) for (let leg = 0; leg < 3; leg++) {
        const step = Math.sin(time * 12 + leg * 2) * patrol;
        g.moveTo(x + side * 3, y + leg - 1).lineTo(x + side * (6 + step), y + leg * 2 - 3).lineTo(x + side * 7, y + leg * 2 - 1).stroke({ color: 0x956947, width: .9, alpha });
      }
      g.ellipse(x, y, 4.2, 2.8).fill({ color: 0xbb7950, alpha });
      g.ellipse(x - 1, y - .8, 2.3, .7).fill({ color: 0xe0aa71, alpha: alpha * .65 });
      for (const side of [-1, 1]) { g.circle(x + side * 5.5, y - 3.5, 1.5).fill({ color: 0xb5754c, alpha }); g.circle(x + side * 1.6, y - 2.2, .65).fill({ color: 0x374f42, alpha }); }
    });
  }
}
