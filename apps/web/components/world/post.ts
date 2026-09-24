/**
 * What happens to the picture after the world is drawn: the map as a miniature, the night's lights blooming,
 * and the cinema's grain, vignette and letterbox. Screen space, on the stage, switched by view and by the hour.
 */
import { Application, Container, FillGradient, Filter, GlProgram, Graphics, NoiseFilter } from "pixi.js";
import { AdvancedBloomFilter, TiltShiftFilter } from "pixi-filters";
import { dioramaGrade } from "./diorama";

export type View = "street" | "map" | "cinema";

/** The picture's grade: how saturated, how contrasty, what colour creeps into the shadows (lift) and over the highlights (gain). */
export type Grade = { sat: number; contrast: number; lift: [number, number, number]; gain: [number, number, number] };
export const NEUTRAL: Grade = { sat: 1, contrast: 1, lift: [0, 0, 0], gain: [1, 1, 1] };
const gradeDistance = (g: Grade) => Math.abs(g.sat - 1) + Math.abs(g.contrast - 1) + g.lift.reduce((s, v) => s + Math.abs(v), 0) + g.gain.reduce((s, v) => s + Math.abs(v - 1), 0);

/**
 * The grade for an hour and a sky: warm and a touch richer at golden hour with cool shadows under it, cold in the blue hour,
 * quieter and bluer at night, flat and grey under cloud, milky in fog. A clear noon is the drawing as drawn.
 */
export function gradeFor(o: { golden: number; blue: number; night: number; cover: number; weather: string }): Grade {
  const { golden: g, blue: b, night: n, cover: c } = o; const fog = o.weather === "fog" ? 1 : 0, storm = o.weather === "storm" ? 1 : 0;
  // the bura's air is scoured clear and cold, every edge sharp; the jugo's is warm, thick and a little yellow
  const bura = o.weather === "bura" ? 1 - n * 0.6 : 0, jugo = o.weather === "jugo" ? 1 - n * 0.6 : 0;
  return {
    sat: 1 + 0.1 * g - 0.08 * b - 0.22 * n - 0.2 * c - 0.08 * storm + 0.1 * bura - 0.06 * jugo,
    contrast: 1 + 0.07 * g + 0.04 * n - 0.08 * c - 0.1 * fog + 0.05 * storm + 0.07 * bura - 0.05 * jugo,
    lift: [0.004 * g + 0.02 * fog + 0.02 * jugo, 0.012 * g + 0.012 * b + 0.018 * n + 0.02 * fog + 0.015 * jugo, 0.035 * g + 0.04 * b + 0.045 * n + 0.012 * c + 0.022 * fog],
    gain: [1 + 0.05 * g - 0.03 * b - 0.02 * c - 0.02 * bura + 0.02 * jugo, 1 + 0.012 * g - 0.01 * b - 0.01 * c + 0.005 * jugo, 1 - 0.05 * g + 0.03 * b + 0.015 * c + 0.04 * bura - 0.04 * jugo],
  };
}

const GRADE_VERT = /* glsl */ `
in vec2 aPosition;
out vec2 vTextureCoord;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;
void main(void) {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  gl_Position = vec4(position, 0.0, 1.0);
  vTextureCoord = aPosition * (uOutputFrame.zw * uInputSize.zw);
}`;
const GRADE_FRAG = /* glsl */ `
precision mediump float;
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform float uSat;
uniform float uContrast;
uniform vec3 uLift;
uniform vec3 uGain;
void main(void) {
  vec4 c = texture(uTexture, vTextureCoord);
  if (c.a <= 0.0) { finalColor = c; return; }
  vec3 rgb = c.rgb / c.a;
  float l = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
  rgb = mix(vec3(l), rgb, uSat);
  rgb = (rgb - 0.5) * uContrast + 0.5;
  rgb = rgb * uGain + uLift * (1.0 - rgb);
  finalColor = vec4(clamp(rgb, 0.0, 1.0) * c.a, c.a);
}`;
export class GradeFilter extends Filter {
  constructor() {
    super({ glProgram: GlProgram.from({ vertex: GRADE_VERT, fragment: GRADE_FRAG, name: "grade" }), resources: { gradeUniforms: { uSat: { value: 1, type: "f32" }, uContrast: { value: 1, type: "f32" }, uLift: { value: new Float32Array(3), type: "vec3<f32>" }, uGain: { value: new Float32Array([1, 1, 1]), type: "vec3<f32>" } } } });
  }
  set(g: Grade): void {
    const u = (this.resources as { gradeUniforms: { uniforms: { uSat: number; uContrast: number; uLift: Float32Array; uGain: Float32Array } } }).gradeUniforms.uniforms;
    u.uSat = g.sat; u.uContrast = g.contrast; u.uLift.set(g.lift); u.uGain.set(g.gain);
  }
}

export class Post {
  private tilt = new TiltShiftFilter({ blur: 7, gradientBlur: 900 });
  /** the miniature's lens: a narrow band of focus a little below the middle, where the eye rests, the rest going soft fast */
  private macro = new TiltShiftFilter({ blur: 14, gradientBlur: 500 });
  private bloom = new AdvancedBloomFilter({ threshold: 0.9, bloomScale: 0.55, brightness: 1, blur: 9, quality: 4 });
  private grain = new NoiseFilter({ noise: 0.045 });
  private grade = new GradeFilter();
  private frame = new Container();
  private vignette = new Graphics();
  private bars = new Graphics();
  private w = 0; private h = 0; private view: View = "street"; private nightNow = 0;
  /** how much the device can afford, set by the town from its frame times: 0 everything, 1 a lighter bloom, 2 no bloom */
  private lite: 0 | 1 | 2 = 0;
  setLite(level: 0 | 1 | 2): void {
    if (level === this.lite) return; this.lite = level;
    this.bloom.quality = level ? 2 : 4; this.bloom.blur = level ? 6 : 9; this.bloom.resolution = level ? 0.5 : 1;
  }
  constructor(private app: Application) {
    this.frame.eventMode = "none"; this.frame.addChild(this.vignette, this.bars); app.stage.addChild(this.frame);
  }
  private layout(w: number, h: number): void {
    this.w = w; this.h = h;
    // the vignette: a soft dark ring the light never quite reaches, drawn once per size
    const g = this.vignette; g.clear(); const r = Math.hypot(w, h) * 0.62;
    const grad = new FillGradient({ type: "radial", center: { x: 0.5, y: 0.5 }, innerRadius: 0, outerCenter: { x: 0.5, y: 0.5 }, outerRadius: 0.5, colorStops: [{ offset: 0, color: "rgba(20,22,26,0)" }, { offset: 0.55, color: "rgba(20,22,26,0)" }, { offset: 1, color: "rgba(20,22,26,0.6)" }] });
    g.rect(w / 2 - r, h / 2 - r, r * 2, r * 2).fill(grad);
    const b = this.bars; b.clear(); const bar = Math.round(h * 0.09); b.rect(0, 0, w, bar).rect(0, h - bar, w, bar).fill(0x0b0c0e);
    this.tilt.start = { x: 0, y: h * 0.3 }; this.tilt.end = { x: w, y: h * 0.72 };
    this.macro.start = { x: 0, y: h * 0.54 }; this.macro.end = { x: w, y: h * 0.54 }; this.macro.gradientBlur = h * 0.5;
  }
  /** Called every tick with the view, how deep the night is (0..1), whether effects are on, the hour's grade, and whether the island is the miniature. */
  update(view: View, night: number, effects: boolean, seed: number, grade: Grade = NEUTRAL, miniature = false): void {
    const { width, height } = this.app.screen; if (width !== this.w || height !== this.h) this.layout(width, height);
    this.view = view; this.nightNow = night;
    const cinema = effects && view === "cinema"; const map = effects && view === "map"; const bloom = effects && night > 0.12 && view !== "map" && this.lite < 2;
    this.vignette.visible = false; this.bars.visible = cinema;
    if (cinema && seed % 3 === 0) this.grain.seed = (seed % 997) / 997;
    this.bloom.bloomScale = 0.2 + Math.min(1, night) * 0.4;
    const filters: Filter[] = [];
    if (miniature && effects) { filters.push(this.macro); grade = dioramaGrade(grade); }
    else if (map) filters.push(this.tilt);
    if (bloom) filters.push(this.bloom);
    // the grade only costs a pass when it changes the picture; a clear noon skips it
    if (effects && gradeDistance(grade) > 0.012) { this.grade.set(grade); filters.push(this.grade); }
    if (cinema) filters.push(this.grain);
    const cur = (this.app.stage.filters as Filter[] | null) ?? [];
    if (cur.length !== filters.length || cur.some((f, i) => f !== filters[i])) this.app.stage.filters = filters.length ? filters : null;
  }
  destroy(): void { this.app.stage.filters = null; this.frame.destroy({ children: true }); }
}
