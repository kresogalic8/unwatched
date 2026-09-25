/**
 * A film of the island: every frame the world draws is copied, cropped to a screen shape, captioned with the day and the hour, and
 * recorded by the browser's own MediaRecorder, so the last day played back in a minute becomes a clip to keep or send.
 */
export type Take = { blob: Blob; url: string; name: string; upright: boolean };

const TYPES = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm"];

export function canFilm(): boolean { return typeof MediaRecorder !== "undefined" && typeof HTMLCanvasElement.prototype.captureStream === "function"; }

export class Film {
  readonly canvas = document.createElement("canvas");
  private g: CanvasRenderingContext2D;
  private rec: MediaRecorder;
  private chunks: Blob[] = [];
  private type: string;
  readonly upright: boolean;

  constructor(upright: boolean) {
    this.upright = upright;
    this.canvas.width = upright ? 720 : 1280; this.canvas.height = upright ? 1280 : 720;
    this.g = this.canvas.getContext("2d")!;
    this.type = TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ?? "video/webm";
    this.rec = new MediaRecorder(this.canvas.captureStream(30), { mimeType: this.type, videoBitsPerSecond: 6_000_000 });
    this.rec.ondataavailable = (e) => { if (e.data.size) this.chunks.push(e.data); };
    this.rec.start(1000);
  }

  /** copy the world's frame, cropped from its middle, and write the day and the hour over its foot */
  frame(src: HTMLCanvasElement, caption: { day: number; time: string; title: string }): void {
    const { g, canvas: c } = this, W = c.width, H = c.height;
    const k = Math.max(W / src.width, H / src.height), sw = W / k, sh = H / k;
    g.drawImage(src, (src.width - sw) / 2, (src.height - sh) / 2, sw, sh, 0, 0, W, H);
    const grad = g.createLinearGradient(0, H - 190, 0, H); grad.addColorStop(0, "rgba(20,26,23,0)"); grad.addColorStop(1, "rgba(20,26,23,0.72)"); g.fillStyle = grad; g.fillRect(0, H - 190, W, 190);
    const pad = this.upright ? 36 : 44;
    g.fillStyle = "#f4efe2"; g.font = "italic 600 44px Newsreader, Georgia, serif"; g.textBaseline = "alphabetic"; g.fillText(`Day ${caption.day} · ${caption.time}`, pad, H - pad - 34);
    g.fillStyle = "rgba(244,239,226,0.85)"; g.font = "500 24px 'Familjen Grotesk', system-ui, sans-serif"; g.fillText(caption.title, pad, H - pad);
    g.textAlign = "right"; g.fillText("unwatched.world", W - pad, H - pad); g.textAlign = "left";
  }

  /** the clip, once the recorder has handed over its last piece */
  stop(day: number): Promise<Take> {
    return new Promise((done) => {
      this.rec.onstop = () => { const blob = new Blob(this.chunks, { type: this.type.split(";")[0] }); done({ blob, url: URL.createObjectURL(blob), name: `unwatched-day-${day}.${this.type.includes("mp4") ? "mp4" : "webm"}`, upright: this.upright }); };
      this.rec.stop();
    });
  }

  cancel(): void { this.rec.onstop = null; if (this.rec.state !== "inactive") this.rec.stop(); }
}
