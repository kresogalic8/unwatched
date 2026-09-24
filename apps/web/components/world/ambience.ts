/**
 * The island's sound. Real recordings or generated clips when they exist under /sound, mixed and crossfaded by the
 * weather, the hour, and where the camera is; a synthesized stand-in for any layer that has no file yet, so the
 * world is never silent in a fresh clone. It starts muted, because browsers require a gesture, and a toggle turns it on.
 *
 * Files: /sound/manifest.json maps a layer, a one-shot, or a music bed (music-<scene>) to a file.
 * `scripts/gen-music.mjs` makes the beds with Lyria; effects can be recordings or generated any way, by the same names.
 */
export type Scene = { weather: string; hour: number; district: string; place: string; crowd: number; season: string; mood?: MusicScene | null; /** a fire is kept where the camera is */ hearth?: boolean; /** the one the camera follows is on their feet */ walking?: boolean; wind?: number; /** how near the camera is to the waterline: 1 on it, 0 well inland or out at sea */ shore?: number; /** the camera is far out, over the whole island: the near sounds fall away */ far?: boolean; /** the day is playing back fast: no clock bell, no footsteps */ fast?: boolean };

export const LAYERS = ["sea", "rain", "wind", "murmur", "work", "forest", "night", "market", "hearth", "leaves", "cicadas"] as const;
export const ONESHOTS = ["gull", "bell", "horn", "creak", "thunder", "bark", "meow", "cluck", "flap", "oars", "step"] as const;
export const MUSIC = ["day", "rain", "night", "tavern", "storm", "fog", "winter"] as const;
export type MusicScene = (typeof MUSIC)[number];
export type LayerName = (typeof LAYERS)[number]; export type ShotName = (typeof ONESHOTS)[number];
type Manifest = Partial<Record<LayerName | ShotName | `music-${MusicScene}`, string>>;

function noiseBuffer(ctx: AudioContext, seconds = 4): AudioBuffer {
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate); const d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0526; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.12; }
  return buf;
}

/** One looping layer with a level that eases to its target. */
class Layer {
  gain: GainNode; private target = 0;
  constructor(readonly ctx: AudioContext, out: AudioNode) { this.gain = ctx.createGain(); this.gain.gain.value = 0; this.gain.connect(out); }
  set(v: number, seconds = 1.5) { if (Math.abs(v - this.target) < 0.005) return; this.target = v; this.gain.gain.setTargetAtTime(v, this.ctx.currentTime, seconds); }
}

export class Ambience {
  private ctx: AudioContext | null = null; private master: GainNode | null = null;
  private layers = new Map<LayerName, Layer>();
  private beds = new Map<MusicScene, Layer>(); private bed: MusicScene | null = null;
  private files = new Map<string, AudioBuffer>(); private manifest: Manifest = {};
  private lastBellHour = -1; private lastGull = 0; private lastCreak = 0; private lastThunder = 0; private lastHorn = 0; private cues: number[] = []; private walking = false; private stepAt = 0;
  muted = true;

  /** Must be called from a user gesture. Loads whatever files the manifest lists; synthesizes the rest. */
  async enable(): Promise<void> {
    if (!this.ctx) {
      this.ctx = new AudioContext(); this.master = this.ctx.createGain(); this.master.gain.value = 0.9; this.master.connect(this.ctx.destination);
      try { this.manifest = (await (await fetch("/sound/manifest.json", { cache: "no-store" })).json()) as Manifest; } catch { this.manifest = {}; }
      // effects load now; music beds are large once decoded, so each is fetched when its scene first plays (see bedFor)
      await Promise.all(Object.entries(this.manifest).filter(([name]) => !name.startsWith("music-")).map(async ([name, file]) => { try { const ab = await (await fetch(`/sound/${file}`)).arrayBuffer(); this.files.set(name, await this.ctx!.decodeAudioData(ab)); } catch { /* the stand-in plays */ } }));
      this.build();
    }
    await this.ctx.resume(); this.muted = false;
  }
  async disable(): Promise<void> { this.muted = true; await this.ctx?.suspend(); }
  /** Which layers play from files, for the ops room and the toggle's title. */
  sources(): Record<string, "file" | "synth" | "none"> { const out: Record<string, "file" | "synth" | "none"> = {}; for (const n of [...LAYERS, ...ONESHOTS]) out[n] = this.files.has(n) ? "file" : "synth"; for (const m of MUSIC) out[`music-${m}`] = this.manifest[`music-${m}`] ? "file" : "none"; return out; }

  private loopFile(name: string, dest: AudioNode): AudioBufferSourceNode[] | null {
    const buf = this.files.get(name); if (!buf || !this.ctx) return null;
    // two overlapping copies so the loop seam never clicks
    const sources: AudioBufferSourceNode[] = [];
    for (const offset of [0, buf.duration / 2]) { const src = this.ctx.createBufferSource(); src.buffer = buf; src.loop = true; const g = this.ctx.createGain(); g.gain.value = 0.7; src.connect(g); g.connect(dest); src.start(this.ctx.currentTime + 0.01, offset % buf.duration); sources.push(src); }
    return sources;
  }
  /** The playing copies of each loaded bed, and when it last fell silent, so a bed nobody has heard for a while can be let go. */
  private bedSources = new Map<MusicScene, AudioBufferSourceNode[]>(); private bedLoading = new Set<MusicScene>(); private bedQuietSince = new Map<MusicScene, number>();
  /** Fetch and start a scene's bed the first time it is wanted; its layer's level is already easing, so it comes in under the crossfade. */
  private bedFor(m: MusicScene): void {
    const name = `music-${m}` as const, file = this.manifest[name], L = this.beds.get(m);
    if (!file || !L || !this.ctx || this.bedSources.has(m) || this.bedLoading.has(m)) return;
    this.bedLoading.add(m);
    void fetch(`/sound/${file}`).then((r) => r.arrayBuffer()).then((ab) => this.ctx!.decodeAudioData(ab)).then((buf) => { this.files.set(name, buf); const src = this.loopFile(name, L.gain); if (src) this.bedSources.set(m, src); }).catch(() => { /* silence under the effects, never a substitute */ }).finally(() => this.bedLoading.delete(m));
  }
  /** A bed silent for a minute is stopped and its decoded audio dropped; it is fetched again (from the HTTP cache) if its scene returns. */
  private releaseQuietBeds(): void {
    const now = performance.now();
    for (const [m, src] of this.bedSources) {
      if (m === this.bed) { this.bedQuietSince.delete(m); continue; }
      const since = this.bedQuietSince.get(m); if (since === undefined) { this.bedQuietSince.set(m, now); continue; }
      if (now - since < 60000) continue;
      for (const s of src) { try { s.stop(); } catch { /* already stopped */ } s.disconnect(); }
      this.bedSources.delete(m); this.bedQuietSince.delete(m); this.files.delete(`music-${m}`);
    }
  }
  private build(): void {
    const ctx = this.ctx!, out = this.master!; const noise = noiseBuffer(ctx);
    const looped = (dest: AudioNode, filter: (n: BiquadFilterNode) => void) => { const src = ctx.createBufferSource(); src.buffer = noise; src.loop = true; const f = ctx.createBiquadFilter(); filter(f); src.connect(f); f.connect(dest); src.start(); return f; };
    const lfo = (target: AudioParam, hz: number, depth: number, type: OscillatorType = "sine") => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = hz; const g = ctx.createGain(); g.gain.value = depth; o.connect(g); g.connect(target); o.start(); };
    const make = (name: LayerName, synth: (dest: AudioNode) => void) => { const L = new Layer(ctx, out); if (!this.loopFile(name, L.gain)) synth(L.gain); this.layers.set(name, L); };
    make("sea", (d) => { const f = looped(d, (n) => { n.type = "lowpass"; n.frequency.value = 380; }); lfo(f.frequency, 1 / 8, 200); const g = ctx.createGain(); g.gain.value = 0.6; lfo(g.gain, 1 / 8, 0.35); });
    // rain is thousands of small impacts, not a hiss: a soft bed, then drops scheduled one by one, with the odd heavy drip off the eaves
    make("rain", (d) => {
      const bed = ctx.createGain(); bed.gain.value = 0.25; bed.connect(d); looped(bed, (n) => { n.type = "bandpass"; n.frequency.value = 3200; n.Q.value = 0.4; });
      const drop = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.03), ctx.sampleRate); const dd = drop.getChannelData(0);
      for (let i = 0; i < dd.length; i++) { const env = Math.exp(-i / (dd.length * 0.18)); dd[i] = (Math.random() * 2 - 1) * env; }
      const rainDrops = () => {
        if (!this.ctx) return; const level = this.layers.get("rain")?.gain.gain.value ?? 0;
        if (level > 0.01) {
          const n = Math.round(6 + level * 28); const t0 = ctx.currentTime;
          for (let i = 0; i < n; i++) {
            const src = ctx.createBufferSource(); src.buffer = drop; const f = ctx.createBiquadFilter(); const heavy = Math.random() < 0.06;
            f.type = "bandpass"; f.frequency.value = heavy ? 700 + Math.random() * 500 : 2500 + Math.random() * 4500; f.Q.value = heavy ? 2 : 1.2;
            const g = ctx.createGain(); g.gain.value = heavy ? 0.5 : 0.12 + Math.random() * 0.18; src.playbackRate.value = heavy ? 0.5 : 0.8 + Math.random() * 0.8;
            src.connect(f); f.connect(g); g.connect(d); src.start(t0 + Math.random() * 0.25);
          }
        }
        setTimeout(rainDrops, 250);
      };
      rainDrops();
    });
    make("wind", (d) => { const f = looped(d, (n) => { n.type = "bandpass"; n.frequency.value = 480; n.Q.value = 3; }); lfo(f.frequency, 0.07, 320); });
    make("murmur", (d) => { const f = looped(d, (n) => { n.type = "bandpass"; n.frequency.value = 320; n.Q.value = 1.4; }); lfo(f.frequency, 2.1, 140); });
    make("market", (d) => { const f = looped(d, (n) => { n.type = "bandpass"; n.frequency.value = 600; n.Q.value = 1.1; }); lfo(f.frequency, 3.3, 220); });
    make("forest", (d) => { const f = looped(d, (n) => { n.type = "bandpass"; n.frequency.value = 900; n.Q.value = 4; }); lfo(f.frequency, 0.05, 500); });
    make("night", (d) => { const f = looped(d, (n) => { n.type = "bandpass"; n.frequency.value = 3800; n.Q.value = 12; }); lfo(f.frequency, 5.5, 60, "square"); });
    // music beds: only from files, one per scene, crossfaded in tick(); Lyria writes them, the world never synthesizes music
    for (const m of MUSIC) { if (!this.manifest[`music-${m}`]) continue; this.beds.set(m, new Layer(ctx, out)); } // silent until bedFor fetches the file
    // a kept fire: a low draw up the flue and the pops of the wood, at the pace of a fire not a fuse
    make("hearth", (d) => { const low = ctx.createGain(); low.gain.value = 0.35; low.connect(d); looped(low, (n) => { n.type = "lowpass"; n.frequency.value = 140; }); const pop = () => { if (!this.ctx) return; const lv = this.layers.get("hearth")?.gain.gain.value ?? 0; if (lv > 0.01) { const t = ctx.currentTime; const src = ctx.createBufferSource(); src.buffer = noise; src.loop = true; const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 1400 + Math.random() * 1800; f.Q.value = 2.5; const g = ctx.createGain(); g.gain.setValueAtTime(0.9 + Math.random() * 0.6, t); g.gain.exponentialRampToValueAtTime(0.01, t + 0.02 + Math.random() * 0.03); src.connect(f); f.connect(g); g.connect(d); src.start(t, Math.random() * 3); src.stop(t + 0.1); } setTimeout(pop, 90 + Math.random() * 420); }; pop(); });
    // cicadas in the pines on a summer afternoon: a dry buzz, chopped fast, swelling and falling back as the chorus takes it up
    make("cicadas", (d) => { const swell = ctx.createGain(); swell.gain.value = 0.55; swell.connect(d); lfo(swell.gain, 0.09, 0.4); const chop = ctx.createGain(); chop.gain.value = 0.5; chop.connect(swell); lfo(chop.gain, 43, 0.5, "square"); looped(chop, (n) => { n.type = "bandpass"; n.frequency.value = 5400; n.Q.value = 5; }); const hi = ctx.createGain(); hi.gain.value = 0.25; hi.connect(swell); lfo(hi.gain, 0.13, 0.2); looped(hi, (n) => { n.type = "bandpass"; n.frequency.value = 7600; n.Q.value = 9; }); });
    // dry leaves in the wind, autumn only
    make("leaves", (d) => { const f = looped(d, (n) => { n.type = "bandpass"; n.frequency.value = 3600; n.Q.value = 0.8; }); const g = ctx.createGain(); g.gain.value = 0.5; lfo(g.gain, 0.23, 0.45); lfo(f.frequency, 0.31, 900); });
    make("work", (d) => { const g = ctx.createGain(); g.gain.value = 0; g.connect(d); looped(g, (n) => { n.type = "lowpass"; n.frequency.value = 240; }); const tick = () => { if (!this.ctx) return; const t = ctx.currentTime; g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.02, t + 0.18); setTimeout(tick, 900 + Math.random() * 500); }; tick(); });
  }

  /** Play a one-shot from its file, or return false so the synthesized one plays. */
  private shot(name: ShotName, level = 0.5, dest: AudioNode = this.master!): boolean { const buf = this.files.get(name); if (!buf || !this.ctx) return false; const src = this.ctx.createBufferSource(); src.buffer = buf; const g = this.ctx.createGain(); g.gain.value = level; src.connect(g); g.connect(dest); src.start(); return true; }
  private gull(dest: AudioNode = this.master!): void { if (this.shot("gull", 0.35, dest)) return; const c = this.ctx!, t = c.currentTime; const o = c.createOscillator(); o.type = "sine"; const g = c.createGain(); g.gain.value = 0; o.connect(g); g.connect(dest); o.frequency.setValueAtTime(1100, t); o.frequency.exponentialRampToValueAtTime(1600, t + 0.12); o.frequency.exponentialRampToValueAtTime(900, t + 0.42); g.gain.linearRampToValueAtTime(0.05, t + 0.05); g.gain.linearRampToValueAtTime(0, t + 0.45); o.start(t); o.stop(t + 0.5); }
  private bell(n: number): void { if (this.shot("bell", 0.5)) return; const c = this.ctx!; for (let i = 0; i < Math.min(n, 12); i++) { const t = c.currentTime + i * 1.4; for (const [f, a] of [[520, 0.12], [1040, 0.05], [1560, 0.02]] as const) { const o = c.createOscillator(); o.frequency.value = f; const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0005, t + 2.4); o.connect(g); g.connect(this.master!); o.start(t); o.stop(t + 2.5); } } }
  /** The bell tolls, from the chapel, for a wedding or a funeral. */
  toll(n: number): void { if (!this.ctx || this.muted) return; this.bell(n); }
  horn(level = 1, dest: AudioNode = this.master!): void { if (!this.ctx || this.muted) return; if (this.shot("horn", 0.6 * level, dest)) return; const c = this.ctx, t = c.currentTime; for (const [f, s] of [[110, 0], [138, 1.1]] as const) { const o = c.createOscillator(); o.type = "sawtooth"; o.frequency.value = f; const fl = c.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.value = 500; const g = c.createGain(); g.gain.setValueAtTime(0, t + s); g.gain.linearRampToValueAtTime(0.12 * level, t + s + 0.15); g.gain.setValueAtTime(0.12 * level, t + s + 0.8); g.gain.linearRampToValueAtTime(0, t + s + 1.05); o.connect(fl); fl.connect(g); g.connect(dest); o.start(t + s); o.stop(t + s + 1.1); } }
  private creak(dest: AudioNode = this.master!): void { if (this.shot("creak", 0.3, dest)) return; const c = this.ctx!, t = c.currentTime; const o = c.createOscillator(); o.type = "triangle"; o.frequency.setValueAtTime(180, t); o.frequency.linearRampToValueAtTime(140, t + 0.3); const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.03, t + 0.05); g.gain.linearRampToValueAtTime(0, t + 0.35); o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.4); }
  private thunder(): void { if (this.shot("thunder", 0.7)) return; const c = this.ctx!, t = c.currentTime; const src = c.createBufferSource(); src.buffer = noiseBuffer(c, 3); const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.setValueAtTime(600, t); f.frequency.exponentialRampToValueAtTime(80, t + 2.5); const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5, t + 0.08); g.gain.exponentialRampToValueAtTime(0.001, t + 2.8); src.connect(f); f.connect(g); g.connect(this.master!); src.start(t); src.stop(t + 3); }

  private bark(dest: AudioNode): void { if (this.shot("bark", 0.4, dest)) return; const c = this.ctx!; const n = Math.random() < 0.6 ? 2 : 1; for (let i = 0; i < n; i++) { const t = c.currentTime + i * (0.2 + Math.random() * 0.08); const o = c.createOscillator(); o.type = "sawtooth"; o.frequency.setValueAtTime(240 + Math.random() * 60, t); o.frequency.exponentialRampToValueAtTime(150, t + 0.13); const f = c.createBiquadFilter(); f.type = "bandpass"; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(500, t + 0.13); f.Q.value = 1.2; const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.22, t + 0.012); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15); o.connect(f); f.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.16); } }
  private meow(dest: AudioNode): void { if (this.shot("meow", 0.3, dest)) return; const c = this.ctx!, t = c.currentTime; const o = c.createOscillator(); o.type = "triangle"; o.frequency.setValueAtTime(480, t); o.frequency.exponentialRampToValueAtTime(820, t + 0.2); o.frequency.exponentialRampToValueAtTime(430, t + 0.62); const v = c.createOscillator(); v.frequency.value = 6.5; const vg = c.createGain(); vg.gain.value = 18; v.connect(vg); vg.connect(o.frequency); const f = c.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 1300; f.Q.value = 0.9; const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.06, t + 0.06); g.gain.setValueAtTime(0.06, t + 0.35); g.gain.linearRampToValueAtTime(0, t + 0.65); o.connect(f); f.connect(g); g.connect(dest); o.start(t); v.start(t); o.stop(t + 0.7); v.stop(t + 0.7); }
  private cluck(dest: AudioNode, alarmed = false): void { if (this.shot("cluck", 0.3, dest)) return; const c = this.ctx!; const n = alarmed ? 5 + Math.floor(Math.random() * 3) : 2 + Math.floor(Math.random() * 3); for (let i = 0; i < n; i++) { const last = alarmed && i === n - 1; const t = c.currentTime + i * (alarmed ? 0.11 : 0.16) + Math.random() * 0.03; const o = c.createOscillator(); o.type = "triangle"; o.frequency.setValueAtTime(last ? 950 : 640 + Math.random() * 90, t); o.frequency.exponentialRampToValueAtTime(last ? 520 : 400, t + (last ? 0.24 : 0.06)); const f = c.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 1500; f.Q.value = 1.4; const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(last ? 0.11 : 0.07, t + 0.008); g.gain.exponentialRampToValueAtTime(0.001, t + (last ? 0.26 : 0.07)); o.connect(f); f.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.3); } }
  private flap(dest: AudioNode, n = 4, level = 1): void { if (this.shot("flap", 0.25 * level, dest)) return; const c = this.ctx!; for (let i = 0; i < n; i++) { const t = c.currentTime + i * (0.085 + Math.random() * 0.02); const src = c.createBufferSource(); src.buffer = noiseBuffer(c, 0.2); const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 1400; f.Q.value = 0.7; const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5 * level, t + 0.012); g.gain.exponentialRampToValueAtTime(0.001, t + 0.07); src.connect(f); f.connect(g); g.connect(dest); src.start(t); src.stop(t + 0.1); } }
  private oars(dest: AudioNode): void { if (this.shot("oars", 0.3, dest)) return; const c = this.ctx!, t = c.currentTime; this.creak(dest); const src = c.createBufferSource(); src.buffer = noiseBuffer(c, 0.6); const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.setValueAtTime(1200, t + 0.12); f.frequency.exponentialRampToValueAtTime(300, t + 0.5); const g = c.createGain(); g.gain.setValueAtTime(0, t + 0.1); g.gain.linearRampToValueAtTime(0.25, t + 0.16); g.gain.exponentialRampToValueAtTime(0.001, t + 0.55); src.connect(f); f.connect(g); g.connect(dest); src.start(t + 0.1); src.stop(t + 0.6); }
  private step(dest: AudioNode, cobbles: boolean): void { if (this.shot("step", 0.2, dest)) return; const c = this.ctx!, t = c.currentTime; const src = c.createBufferSource(); src.buffer = noiseBuffer(c, 0.1); const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = cobbles ? 900 : 260; const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(cobbles ? 0.16 : 0.2, t + 0.006); g.gain.exponentialRampToValueAtTime(0.001, t + (cobbles ? 0.045 : 0.07)); src.connect(f); f.connect(g); g.connect(dest); src.start(t); src.stop(t + 0.1); }
  /** A bus for one sound at one place: quieter with distance from the camera, panned to its side. */
  private bus(dist: number, dx: number, level: number): GainNode | null { if (!this.ctx || this.muted) return null; const far = Math.max(0, 1 - dist / 760); if (far <= 0.02) return null; const now = performance.now(); this.cues = this.cues.filter((t) => now - t < 1000); if (this.cues.length >= 7) return null; this.cues.push(now); const g = this.ctx.createGain(); g.gain.value = level * (0.25 + 0.75 * far * far); const pan = new StereoPannerNode(this.ctx, { pan: Math.max(-1, Math.min(1, dx / 520)) }); g.connect(pan); pan.connect(this.master!); return g; }
  /** Something on the island made a sound at (dist, dx) from the camera. */
  cue(name: ShotName, dist: number, dx: number, level = 1): void {
    const d = this.bus(dist, dx, level); if (!d) return;
    switch (name) { case "gull": this.gull(d); break; case "bark": this.bark(d); break; case "meow": this.meow(d); break; case "cluck": this.cluck(d, level >= 1); break; case "flap": this.flap(d, level >= 1 ? 4 : 2, level >= 1 ? 1 : 0.6); break; case "oars": this.oars(d); break; case "creak": this.creak(d); break; case "step": this.step(d, level >= 1); break; case "horn": this.horn(level, d); break; default: break; }
  }
  /** Called often; cheap. Sets every layer's level from the scene and fires the one-shots. */
  tick(s: Scene): void {
    if (!this.ctx || this.muted) return;
    const night = s.hour < 6 || s.hour >= 21;
    const rain = s.weather === "rain" ? 0.5 : s.weather === "storm" ? 0.85 : 0; // snow falls without a sound
    const coast = s.shore !== undefined ? s.shore > 0.45 : s.district === "harbor" || s.district === "north shore";
    // far out over the island the near sounds (a crowd, a forge, the market) fall away under the sea and the weather
    const near = s.far ? 0.35 : 1;
    const L = (n: LayerName) => this.layers.get(n)!;
    L("sea").set((s.shore !== undefined ? (s.far ? 0.26 : 0.1 + 0.34 * s.shore) : coast ? 0.4 : s.district === "pinewood" ? 0.1 : 0.18) * (s.weather === "storm" ? 1.6 : s.weather === "jugo" ? 1.5 : s.weather === "bura" ? 1.3 : 1)); // the jugo brings the swell in
    const hot = s.season === "summer" && s.hour >= 9 && s.hour < 19 && !rain && !["fog", "wind", "bura"].includes(s.weather);
    L("cicadas").set(hot ? (s.hour >= 12 && s.hour < 17 ? 0.13 : 0.07) * (1 - 0.6 * (s.shore ?? (coast ? 1 : 0))) * (s.district === "pinewood" || s.district === "hill" ? 1.5 : 1) : 0);
    L("rain").set(rain);
    L("wind").set(s.weather === "storm" || s.weather === "bura" ? 0.55 : s.weather === "wind" ? 0.4 : s.weather === "jugo" ? 0.22 : s.weather === "snow" ? 0.2 : s.weather === "fog" ? 0.06 : s.district === "pinewood" || s.district === "hill" ? 0.16 : 0.06);
    L("forest").set(s.district === "pinewood" && !night ? 0.3 : 0);
    L("night").set(night && !rain && s.season !== "winter" ? 0.25 : 0);
    const social = s.place === "tavern" || s.place === "inn";
    L("murmur").set(social && s.crowd > 1 && !night ? Math.min(0.4, 0.1 + s.crowd * 0.05) * near : 0);
    L("market").set(s.place === "market" && s.crowd > 2 && s.hour >= 7 && s.hour < 19 ? Math.min(0.4, 0.1 + s.crowd * 0.04) * near : 0);
    L("work").set((s.place === "smithy" || s.place === "mill" || s.place === "sawpit" || s.place === "quarry") && s.hour >= 7 && s.hour < 17 ? 0.3 * near : 0);
    L("hearth").set(s.hearth ? 0.22 : 0);
    L("leaves").set(s.season === "autumn" && (s.district === "pinewood" || s.district === "hill" || s.district === "north shore") ? 0.08 + (s.wind ?? 0.2) * 0.3 : 0);
    // the one the camera follows: their steps, on cobbles in the old town and on earth everywhere else
    this.walking = !!s.walking && !s.fast; if (this.walking && !this.stepAt) { this.stepAt = 1; const cob = s.district === "old town" || s.district === "harbor"; const walk = () => { if (!this.walking || this.muted || !this.ctx) { this.stepAt = 0; return; } this.step(this.master!, cob); setTimeout(walk, 400 + Math.random() * 60); }; walk(); }
    // the bed for this scene, crossfaded over a few seconds; a missing bed means silence under the effects, never a substitute
    const scene: MusicScene = s.mood ? s.mood : s.weather === "storm" ? "storm" : s.weather === "fog" ? "fog" : (s.place === "tavern" || s.place === "inn") && s.hour >= 17 && s.crowd > 1 ? "tavern" : night ? "night" : rain > 0 ? "rain" : s.season === "winter" ? "winter" : "day";
    if (scene !== this.bed) { this.bed = scene; this.bedFor(scene); for (const [m, L] of this.beds) L.set(m === scene ? 0.32 : 0, 4); }
    this.releaseQuietBeds();
    const now = performance.now();
    if (!night && rain < 0.7 && s.weather !== "bura" && coast && now - this.lastGull > 4000 + Math.random() * 9000) { this.lastGull = now; this.gull(); if (Math.random() < 0.4) setTimeout(() => !this.muted && this.gull(), 300 + Math.random() * 400); }
    if (s.district === "harbor" && now - this.lastCreak > 6000 + Math.random() * 8000) { this.lastCreak = now; this.creak(); }
    if (s.weather === "storm" && now - this.lastThunder > 12000 + Math.random() * 20000) { this.lastThunder = now; this.thunder(); }
    // the lighthouse sounds its horn in fog, far off unless you are on the point
    if (s.weather === "fog" && now - this.lastHorn > 24000 + Math.random() * 18000) { this.lastHorn = now; this.horn(s.district === "pinewood" ? 0.5 : 0.18); }
    if (s.hour !== this.lastBellHour) { this.lastBellHour = s.hour; if (!s.fast && s.hour >= 7 && s.hour <= 20 && (s.district === "old town" || s.district === "hill")) this.bell(s.hour > 12 ? s.hour - 12 : s.hour); }
  }
}
