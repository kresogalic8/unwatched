/**
 * The GPU's share of the world: light that the night does not reach, and water that moves.
 * Both sit on top of the drawn island without changing a line of it, so the old and the new can be compared on the same street.
 */
import { AlphaFilter, BlurFilter, Container, Filter, GlProgram, Graphics, Sprite, Texture } from "pixi.js";
import { LIGHT } from "./palette";

/** A soft disc, white at the centre and gone at the edge, drawn once; every light is this texture scaled and tinted. */
function softDisc(size = 256): Texture {
  const c = document.createElement("canvas"); c.width = size; c.height = size;
  const ctx = c.getContext("2d")!; const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.35, "rgba(255,255,255,0.72)"); g.addColorStop(0.7, "rgba(255,255,255,0.22)"); g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  return Texture.from(c);
}

/** A small seeded random, so every drop has its own start and speed and the rain has no pattern in it. */
function rnd(seed: number): () => number { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** Two colours, a way between them. */
export function mix(a: number, b: number, t: number): number { t = Math.max(0, Math.min(1, t)); const ch = (sh: number) => Math.round(((a >> sh) & 255) * (1 - t) + ((b >> sh) & 255) * t); return (ch(16) << 16) | (ch(8) << 8) | ch(0); }

export type LightSource = { x: number; y: number; r: number; color: number; strength: number; flicker?: number; noHole?: boolean; aspect?: number };

/** A streak of rain: a thin line, bright in the middle, gone at both ends. */
function streak(): Texture {
  const c = document.createElement("canvas"); c.width = 6; c.height = 36; const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, 36); g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.5, "rgba(255,255,255,1)"); g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g; ctx.fillRect(1.5, 0, 3, 36); return Texture.from(c);
}

/**
 * Night as a shade that the lights cut through. The dark layer is one rectangle over the world; each light erases a soft hole in it,
 * and a second, additive layer lays warm colour where the light falls. The dark layer carries a filter so the erasing stays inside it.
 */
export class Lighting {
  readonly dark = new Container();
  readonly glow = new Container();
  private shade = new Graphics();
  private holes: Sprite[] = [];
  private warms: Sprite[] = [];
  private cores: Sprite[] = [];
  private disc = softDisc();
  constructor(world: Container, W: number, H: number) {
    this.shade.rect(-3000, -3000, W + 6000, H + 6000).fill(0xffffff); this.dark.addChild(this.shade);
    this.dark.filters = [new AlphaFilter({ alpha: 1 })]; // renders the layer on its own, so 'erase' only ever cuts the shade
    this.glow.filters = [new BlurFilter({ strength: 5, quality: 3 })]; // the bloom: the warm layer smeared a little past its edge
    world.addChild(this.glow); world.addChild(this.dark);
    this.dark.visible = false; this.glow.visible = false;
  }
  /** amount is the night as the island reckons it, 0 by day to 0.42 in the dark; the shade goes deeper than the old flat one because the lights answer it. */
  update(amount: number, sources: LightSource[], tick: number, flash = 0, tint = LIGHT.night): void {
    const k = Math.min(1, amount / 0.42);
    this.dark.visible = this.glow.visible = k > 0.02;
    if (!this.dark.visible) return;
    this.shade.tint = tint; this.shade.alpha = 0.64 * k * Math.max(0, 1 - flash * 1.4); // a bolt lights every facade for a frame
    while (this.holes.length < sources.length) { const h = new Sprite(this.disc); h.anchor.set(0.5); h.blendMode = "erase"; this.dark.addChild(h); this.holes.push(h); const w = new Sprite(this.disc); w.anchor.set(0.5); w.blendMode = "add"; this.glow.addChild(w); this.warms.push(w); const c = new Sprite(this.disc); c.anchor.set(0.5); c.blendMode = "add"; this.glow.addChild(c); this.cores.push(c); }
    for (let i = 0; i < this.holes.length; i++) {
      const s = sources[i]; const h = this.holes[i]!, w = this.warms[i]!, c = this.cores[i]!;
      if (!s) { h.visible = w.visible = c.visible = false; continue; }
      const fl = s.flicker ? 1 + Math.sin(tick / 3.7 + i * 1.9) * s.flicker * 0.5 + Math.sin(tick / 1.3 + i) * s.flicker * 0.25 : 1;
      const r = s.r * fl; const aspect = s.aspect ?? 1;
      h.visible = !s.noHole; w.visible = c.visible = true;
      h.position.set(s.x, s.y); h.width = r * 2.2; h.height = r * 2.2 * aspect; h.alpha = Math.min(1, s.strength) * k;
      w.position.set(s.x, s.y); w.width = r * 1.8; w.height = r * 1.8 * aspect; w.tint = s.color; w.alpha = 0.15 * s.strength * k;
      c.position.set(s.x, s.y); c.width = r * .3; c.height = r * .3 * aspect; c.tint = s.color; c.alpha = 0.3 * s.strength * k; // the bright heart of the bloom
    }
  }
}

const VERT = /* glsl */ `
in vec2 aPosition;
out vec2 vTextureCoord;
out vec2 vWorld;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;
uniform vec3 uCam;
vec4 filterVertexPosition(void) {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  return vec4(position, 0.0, 1.0);
}
vec2 filterTextureCoord(void) { return aPosition * (uOutputFrame.zw * uInputSize.zw); }
void main(void) {
  gl_Position = filterVertexPosition();
  vTextureCoord = filterTextureCoord();
  vWorld = (aPosition * uOutputFrame.zw + uOutputFrame.xy - uCam.xy) / uCam.z;
}`;

const FRAG = /* glsl */ `
precision highp float;
in vec2 vTextureCoord;
in vec2 vWorld;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform float uTime;
uniform vec3 uSun;      // where the light in the sky is, in world units, and how strong
uniform vec3 uColor;    // the water by day
uniform vec3 uDeep;     // the trough of a wave
uniform vec3 uAbyss;    // the open sea, far from any shore
uniform vec3 uShallow;  // the turquoise over the sand
uniform vec3 uGlint;    // the colour the light leaves on the water
uniform float uRough;   // 0 calm, 1 storm
uniform float uNight;   // 0 day, 1 full night
uniform float uZoom;    // the camera's zoom, so fine detail fades on the map
uniform vec4 uIsland;   // the island: centre and radii, so the sea knows how far it is from the shore
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { return noise(p) * 0.55 + noise(p * 2.1 + 3.7) * 0.3 + noise(p * 4.3 + 9.1) * 0.15; }
// 1 at the shore, less inside, more out to sea; the same curve the island is drawn with
float shore(vec2 w) { vec2 q = (w - uIsland.xy) / uIsland.zw; float a = atan(q.y, q.x); float wob = 1.0 + 0.14 * sin(a * 3.0 + 0.7) + 0.08 * cos(a * 5.0 + 2.0); return length(q) / wob; }
void main(void) {
  vec4 src = texture(uTexture, vTextureCoord);
  if (src.a < 0.01) { finalColor = src; return; }
  vec2 p = vWorld * 0.011;
  float t = uTime;
  float d = shore(vWorld);
  float depth = smoothstep(1.02, 1.75, d);          // 0 over the sand, 1 in open water
  float bank = 1.0 - smoothstep(1.0, 1.14, d);      // the shallows, brightest right at the shore
  // the swell: two long waves and a grain of noise, slower and longer out at sea
  float w = sin(p.x * 2.2 + t * 0.5 + sin(p.y * 1.4 + t * 0.3)) * 0.5
          + sin(p.y * 3.1 - t * 0.4 + p.x * 0.9) * 0.3
          + (fbm(p * 3.0 + vec2(t * 0.1, -t * 0.08)) - 0.5) * 0.7;
  float h = clamp(w * 0.5 + 0.5, 0.0, 1.0);
  vec3 base = mix(uColor, uAbyss, depth * 0.85);
  vec3 col = mix(mix(base, uDeep, 0.45 * (1.0 - depth * 0.5)), base, smoothstep(0.2, 0.85, h));
  // the shallows: turquoise over the sand, with light dancing on the bottom
  float caustic = pow(fbm(p * 7.0 + vec2(t * 0.25, t * 0.18)), 2.2) * bank;
  col = mix(col, uShallow, bank * 0.75);
  col += vec3(0.20, 0.22, 0.18) * caustic * (1.0 - uNight * 0.8);
  // foam: a broken line where the swell meets the sand, wider and whiter in a blow
  float edge = 1.0 - smoothstep(1.0, 1.035 + uRough * 0.03, d);
  float broken = smoothstep(0.35, 0.75, fbm(vec2(atan(vWorld.y - uIsland.y, vWorld.x - uIsland.x) * 14.0, d * 40.0) + vec2(t * 0.35, -t * 0.6)));
  float foam = edge * broken * (0.55 + 0.45 * sin(t * 0.9 + d * 90.0));
  float crest = smoothstep(0.86, 0.98, h) * uRough * 0.9;
  col = mix(col, vec3(0.96, 0.95, 0.9), clamp(foam * 0.85 + crest * 0.4, 0.0, 1.0));
  // the light on the water: a path toward the sun, and sparkles stretched along the swell
  vec2 dv = vWorld - uSun.xy;
  float below = step(0.0, dv.y);
  float streak = exp(-abs(dv.x) * 0.0042) * exp(-dv.y * 0.0007) * below;
  float sparkle = pow(noise(vec2(p.x * 9.0, p.y * 26.0) + vec2(t * 1.3, -t * 0.8)), 14.0) * clamp(uZoom, 0.15, 1.0);   // short dashes, the way light lies on a swell
  float glitter = pow(noise(vec2(p.x * 16.0, p.y * 44.0) + vec2(-t * 0.9, t * 1.1)), 20.0) * depth * clamp(uZoom, 0.2, 1.0);
  col += uGlint * min(0.6, streak * uSun.z * (0.22 + sparkle * 0.9) + glitter * uSun.z * (0.03 + streak * 0.45));
  col = mix(col, col * vec3(0.30, 0.36, 0.52) + uGlint * streak * uSun.z * 0.15, uNight);
  finalColor = vec4(col, 1.0) * src.a;
}`;

/** The sea as a shader: waves that move with the clock, crests in a blow, and the sun or the moon lying on the water. */
export class WaterFilter extends Filter {
  constructor() {
    super({
      glProgram: GlProgram.from({ vertex: VERT, fragment: FRAG, name: "water" }),
      resources: {
        waterUniforms: {
          uTime: { value: 0, type: "f32" },
          uCam: { value: new Float32Array([0, 0, 1]), type: "vec3<f32>" },
          uSun: { value: new Float32Array([0, 0, 0]), type: "vec3<f32>" },
          uColor: { value: new Float32Array([0.56, 0.75, 0.76]), type: "vec3<f32>" },
          uDeep: { value: new Float32Array([0.36, 0.58, 0.62]), type: "vec3<f32>" },
          uAbyss: { value: new Float32Array([0.27, 0.52, 0.62]), type: "vec3<f32>" },
          uShallow: { value: new Float32Array([0.66, 0.86, 0.85]), type: "vec3<f32>" },
          uIsland: { value: new Float32Array([0, 0, 1, 1]), type: "vec4<f32>" },
          uGlint: { value: new Float32Array([1.0, 0.93, 0.72]), type: "vec3<f32>" },
          uRough: { value: 0, type: "f32" },
          uNight: { value: 0, type: "f32" },
          uZoom: { value: 1, type: "f32" },
        },
      },
    });
  }
  private set(name: string, v: number | number[]): void {
    const u = (this.resources as { waterUniforms: { uniforms: Record<string, number | Float32Array> } }).waterUniforms.uniforms;
    if (typeof v === "number") u[name] = v; else (u[name] as Float32Array).set(v);
  }
  /** The island the sea surrounds: centre and radii of its outline, so the shader knows shore from open water. */
  island(cx: number, cy: number, rx: number, ry: number): void { this.set("uIsland", [cx, cy, rx, ry]); }
  update(o: { time: number; cam: { x: number; y: number; zoom: number }; sun: { x: number; y: number; strength: number }; color: number; deep: number; abyss?: number; shallow?: number; glint: number; rough: number; night: number }): void {
    this.set("uTime", o.time); if (o.abyss !== undefined) this.set("uAbyss", rgb(o.abyss)); if (o.shallow !== undefined) this.set("uShallow", rgb(o.shallow)); this.set("uCam", [o.cam.x, o.cam.y, o.cam.zoom]); this.set("uSun", [o.sun.x, o.sun.y, o.sun.strength]);
    this.set("uColor", rgb(o.color)); this.set("uDeep", rgb(o.deep)); this.set("uGlint", rgb(o.glint)); this.set("uRough", o.rough); this.set("uNight", o.night); this.set("uZoom", o.cam.zoom);
  }
}
const rgb = (hex: number): number[] => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];

/** What falls and what lingers: rain and snow as particles blown by the wind, and fog as slow drifts of shell over the ground. */
export class Weather {
  readonly rain = new Container();
  readonly snow = new Container();
  readonly fog = new Container();
  private drops: Sprite[] = [];
  private flakes: Sprite[] = [];
  private banks: Sprite[] = [];
  private dropSeed: { x: number; y: number; v: number; len: number; a: number }[] = [];
  private flakeSeed: { x: number; y: number; v: number; sway: number; size: number; a: number }[] = [];
  private bankSeed: { x: number; y: number; v: number; w: number; h: number; a: number }[] = [];
  private veil = new Graphics();
  private streakTex = streak();
  private disc = softDisc(96);
  private fogTarget = 0; private fogAlpha = 0;
  constructor(private W: number, private H: number) {
    // plain sprites: the batcher takes a thousand of them without noticing, and they draw the same on every screen
    const r = rnd(7);
    for (let i = 0; i < 900; i++) { const d = new Sprite(this.streakTex); d.anchor.set(0.5); d.alpha = 0; this.rain.addChild(d); this.drops.push(d); this.dropSeed.push({ x: r() * (W + 600) - 300, y: r() * (H + 400) - 200, v: 0.8 + r() * 0.5, len: 0.9 + r() * 0.7, a: 0.45 + r() * 0.35 }); }
    for (let i = 0; i < 500; i++) { const f = new Sprite(this.disc); f.anchor.set(0.5); f.scale.set(0.08); f.alpha = 0; this.snow.addChild(f); this.flakes.push(f); this.flakeSeed.push({ x: r() * (W + 600) - 300, y: r() * (H + 300) - 150, v: 0.7 + r() * 0.6, sway: r() * Math.PI * 2, size: 0.06 + r() * 0.06, a: 0.7 + r() * 0.3 }); }
    this.veil.rect(-3000, -3000, W + 6000, H + 6000).fill(0xffffff); this.fog.addChild(this.veil);
    for (let i = 0; i < 16; i++) { const b = new Sprite(this.disc); b.anchor.set(0.5); b.alpha = 0; this.fog.addChild(b); this.banks.push(b); this.bankSeed.push({ x: r() * (W + 1400) - 700, y: r() * (H + 300) - 150, v: 0.6 + r() * 0.8, w: 800 + r() * 700, h: 240 + r() * 200, a: 0.34 + r() * 0.2 }); }
    this.rain.visible = false; this.snow.visible = false; this.fog.visible = false;
  }
  update(o: { weather: string; wind: number; snowing: boolean; wet: boolean; tick: number; night: number; fogColor: number; rainColor: number }): void {
    const { W, H } = this; const t = o.tick;
    const raining = o.wet && !o.snowing, snowing = o.wet && o.snowing;
    const n = raining ? (o.weather === "storm" ? 900 : 520) : 0;
    const tilt = o.wind * 0.55;
    this.rain.visible = raining; this.snow.visible = snowing;
    const wrap = (v: number, lo: number, span: number) => ((((v - lo) % span) + span) % span) + lo;
    for (let i = 0; i < this.drops.length; i++) {
      const d = this.drops[i]!; const sd = this.dropSeed[i]!;
      if (i >= n) { d.alpha = 0; continue; }
      const speed = (24 + (o.weather === "storm" ? 16 : 0)) * sd.v;
      const x = wrap(sd.x + t * speed * tilt + Math.sin(t / 40 + sd.x * 0.01) * o.wind * 4, -300, W + 600);
      const y = wrap(sd.y + t * speed, -200, H + 400);
      d.position.set(x, y); d.rotation = -tilt; d.scale.set(1, sd.len * (1 + (o.weather === "storm" ? 0.6 : 0.2))); d.tint = o.rainColor; d.alpha = sd.a;
    }
    const m = snowing ? (o.weather === "storm" ? 500 : 300) : 0;
    for (let i = 0; i < this.flakes.length; i++) {
      const f = this.flakes[i]!; const sd = this.flakeSeed[i]!;
      if (i >= m) { f.alpha = 0; continue; }
      const speed = 3.4 * sd.v;
      const x = wrap(sd.x + t * speed * o.wind * 0.9 + Math.sin(t / 30 + sd.sway) * 14, -300, W + 600);
      const y = wrap(sd.y + t * speed, -150, H + 300);
      f.position.set(x, y); f.scale.set(sd.size); f.tint = o.night > 0.3 ? 0xffffff : 0xcfd9de; f.alpha = sd.a;
    }
    // fog: banks that drift with the wind; a thin haze in rain; nothing on a clear day
    this.fogTarget = o.weather === "fog" ? 1 : raining ? 0.22 : 0;
    this.fogAlpha += (this.fogTarget - this.fogAlpha) * 0.06;
    this.fog.visible = this.fogAlpha > 0.01;
    this.veil.tint = o.fogColor; this.veil.alpha = 0.34 * this.fogAlpha * (1 - o.night * 0.5);
    if (this.fog.visible) for (let i = 0; i < this.banks.length; i++) {
      const b = this.banks[i]!; const sd = this.bankSeed[i]!;
      const x = wrap(sd.x + t * sd.v * (0.5 + o.wind * 1.2), -700, W + 1400), y = sd.y + Math.sin(t / 90 + i) * 18;
      b.position.set(x, y); b.width = sd.w; b.height = sd.h; b.tint = 0xffffff; b.alpha = sd.a * this.fogAlpha * (1 - o.night * 0.4);
    }
  }
}

/** Clouds: their shadows cross the ground, and the clouds themselves ride a nearer layer, so the camera feels the height between them. */
export class Clouds {
  readonly puffs = new Container();
  readonly shadows = new Container();
  private disc = softDisc(128);
  private seeds: { x: number; y: number; w: number; h: number; speed: number }[] = [];
  constructor(private W: number, private H: number) {
    for (let i = 0; i < 9; i++) {
      const seed = { x: (i * 613) % (W + 800) - 400, y: (i * 389) % (H + 400) - 200, w: 420 + (i % 4) * 160, h: 150 + (i % 3) * 60, speed: 0.35 + (i % 3) * 0.12 };
      this.seeds.push(seed);
      for (const layer of [this.shadows, this.puffs]) for (let k = 0; k < 3; k++) { const c = new Sprite(this.disc); c.anchor.set(0.5); c.alpha = 0; layer.addChild(c); }
    }
    this.puffs.visible = false; this.shadows.visible = false;
  }
  update(o: { tick: number; wind: number; sunUp: number; night: number; weather: string; /** the low sun on their undersides */ warm?: number }): void {
    const { W } = this; const t = o.tick;
    const overcast = o.weather === "storm" || o.weather === "rain" || o.weather === "snow";
    const show = o.weather !== "fog"; this.puffs.visible = show; this.shadows.visible = show && o.sunUp > 0.05;
    if (!show) return;
    const puffTint = o.weather === "storm" ? 0xb9c1c8 : overcast ? 0xdfe4e8 : mix(0xffffff, 0xffc4a0, o.warm ?? 0);
    for (let i = 0; i < this.seeds.length; i++) {
      const sd = this.seeds[i]!;
      const x = ((sd.x + t * sd.speed * (0.6 + o.wind * 1.6) + 400) % (W + 800)) - 400, y = sd.y + Math.sin(t / 700 + i) * 12;
      for (let k = 0; k < 3; k++) {
        const dx = (k - 1) * sd.w * 0.28, dy = (k === 1 ? -sd.h * 0.18 : sd.h * 0.08);
        const p = this.puffs.children[i * 3 + k] as Sprite, sh = this.shadows.children[i * 3 + k] as Sprite;
        p.position.set(x + dx, y + dy); p.width = sd.w * (k === 1 ? 0.9 : 0.62); p.height = sd.h * (k === 1 ? 1.1 : 0.8); p.tint = puffTint; p.alpha = (overcast ? 0.42 : 0.26) * (1 - o.night * 0.7);
        sh.position.set(x + dx + 60, y + dy + 120); sh.width = sd.w * (k === 1 ? 0.95 : 0.66); sh.height = sd.h * (k === 1 ? 1.15 : 0.85); sh.tint = 0x0a1018; sh.alpha = (overcast ? 0.05 : 0.075) * o.sunUp;
      }
    }
  }
}

/**
 * The hour when the sun is low: a warm cast over everything with the light coming from the sun's side of the sky,
 * and the blue half hour either side of it. Multiply for the cast, add for the light, so the drawn colours keep
 * their lines and only their temperature changes. Off by day and by night; the Lighting takes over after dark.
 */
export class Sky {
  /** the cast, over the whole island */
  readonly veil: Sprite;
  /** the light itself, at the sun, and its wide halo */
  readonly glow: Sprite; readonly halo: Sprite;
  constructor(W: number, H: number) {
    this.veil = new Sprite(Texture.WHITE); this.veil.position.set(-3000, -3000); this.veil.width = W + 6000; this.veil.height = H + 6000; this.veil.blendMode = "multiply"; this.veil.alpha = 0;
    const disc = softDisc(); this.glow = new Sprite(disc); this.glow.anchor.set(0.5); this.glow.blendMode = "add"; this.glow.alpha = 0; this.halo = new Sprite(disc); this.halo.anchor.set(0.5); this.halo.blendMode = "add"; this.halo.alpha = 0;
  }
  /** golden and blue are 0..1; phase says which end of the day; sun is where the sun is, even below the horizon. */
  update(o: { golden: number; blue: number; phase: "rise" | "set"; sun: { x: number; y: number }; cover: number }): void {
    const g = o.golden * (1 - o.cover * 0.7), b = o.blue * (1 - o.cover * 0.4);
    const rise = o.phase === "rise";
    // the cast: peach at sunrise, amber at sunset, a cold slate in the blue hour; the two are never both strong
    const warmCast = rise ? 0xffdcc2 : 0xffc9a4, blueCast = 0xb6c1dd;
    const castT = g + b > 0.001 ? b / (g + b) : 0;
    this.veil.tint = mix(warmCast, blueCast, castT); this.veil.alpha = Math.min(1, g * 0.9 + b * 0.75);
    this.veil.visible = this.veil.alpha > 0.01;
    // the light: at the sun, wide, warmer at sunset
    const col = rise ? 0xffb98a : 0xff9a5c;
    // the sun sits high behind the island, so its light has to be wide to reach the streets: a broad wash from its side of the sky
    this.glow.position.set(o.sun.x, o.sun.y + 300); this.glow.width = this.glow.height = 4200; this.glow.tint = col; this.glow.alpha = (rise ? 0.26 : 0.32) * g;
    this.halo.position.set(o.sun.x, o.sun.y + 600); this.halo.width = this.halo.height = 8000; this.halo.tint = col; this.halo.alpha = 0.12 * g;
    this.glow.visible = this.halo.visible = g > 0.01;
  }
}
