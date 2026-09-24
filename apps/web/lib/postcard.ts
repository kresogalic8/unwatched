/**
 * A postcard from the island: the picture on screen in a white border, a line of handwriting under it saying who and where, the day and
 * the hour, a stamp in the corner and the post office's mark across it. Drawn on a canvas, so it can be saved or shared as a picture.
 */
export type PostcardText = { title: string; sub: string; day: number };

const PAPER = "#f4efe2", INK = "#2f302a", MUTED = "#6d6a5f", RED = "#c4503f", SEA = "#3f7f78";

export function postcard(photo: HTMLCanvasElement, text: PostcardText): HTMLCanvasElement {
  // a postcard's shape, 3 by 2, turned upright for a picture taken on an upright screen; the photo is cropped to it from the middle
  const upright = photo.height > photo.width * 1.1;
  const W = upright ? 1200 : 1800, H = upright ? 1800 : 1200, pad = 48, strip = 190, pw = W - pad * 2, ph = H - pad - strip;
  const out = document.createElement("canvas"); out.width = W; out.height = H; const g = out.getContext("2d")!;
  g.fillStyle = PAPER; g.fillRect(0, 0, W, H);
  const k = Math.max(pw / photo.width, ph / photo.height), sw = pw / k, sh = ph / k;
  g.drawImage(photo, (photo.width - sw) / 2, (photo.height - sh) / 2, sw, sh, pad, pad, pw, ph);
  g.strokeStyle = "rgba(47,48,42,0.25)"; g.lineWidth = 2; g.strokeRect(pad, pad, pw, ph);
  // the handwriting
  const baseY = pad + ph + 92;
  g.fillStyle = INK; g.font = "italic 600 58px Newsreader, Georgia, 'Times New Roman', serif"; g.textBaseline = "alphabetic";
  let title = text.title; while (g.measureText(title).width > W - pad * 2 - 300 && title.length > 8) title = `${title.slice(0, -2).trimEnd()}…`;
  g.fillText(title, pad + 8, baseY);
  g.fillStyle = MUTED; g.font = "500 32px 'Familjen Grotesk', system-ui, sans-serif"; g.fillText(text.sub, pad + 10, baseY + 52);
  // the stamp: perforated edge, a little island on it, the price and the name
  const sx = W - pad - 170, sy = pad + ph + 22, s = 150, sH = 150;
  g.save(); g.translate(sx + s / 2, sy + sH / 2); g.rotate(-0.04); g.translate(-(sx + s / 2), -(sy + sH / 2));
  g.fillStyle = "#fffdf6"; g.fillRect(sx, sy, s, sH);
  g.fillStyle = PAPER; for (let i = 0; i <= 10; i++) for (const [x, y] of [[sx + (s * i) / 10, sy], [sx + (s * i) / 10, sy + sH], [sx, sy + (sH * i) / 10], [sx + s, sy + (sH * i) / 10]]) { g.beginPath(); g.arc(x!, y!, 5, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = "#cfe3de"; g.fillRect(sx + 14, sy + 14, s - 28, sH - 52);
  g.fillStyle = "#e6dfcd"; g.beginPath(); g.ellipse(sx + s / 2, sy + 72, 42, 18, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = RED; g.fillRect(sx + s / 2 - 8, sy + 50, 16, 12); g.beginPath(); g.moveTo(sx + s / 2 - 11, sy + 51); g.lineTo(sx + s / 2, sy + 42); g.lineTo(sx + s / 2 + 11, sy + 51); g.fill();
  g.fillStyle = SEA; g.font = "700 20px 'Familjen Grotesk', system-ui, sans-serif"; g.textAlign = "center"; g.fillText("UNWATCHED", sx + s / 2, sy + sH - 18); g.textAlign = "left";
  g.restore();
  // the postmark across the stamp's corner: the day, in a ring, and the wavy cancel lines
  const mx = sx - 18, my = sy + 88; g.strokeStyle = "rgba(47,48,42,0.55)"; g.lineWidth = 3;
  g.beginPath(); g.arc(mx, my, 56, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(mx, my, 44, 0, Math.PI * 2); g.stroke();
  g.fillStyle = "rgba(47,48,42,0.6)"; g.font = "700 22px 'Familjen Grotesk', system-ui, sans-serif"; g.textAlign = "center"; g.fillText("DAY", mx, my - 4); g.font = "700 28px 'Familjen Grotesk', system-ui, sans-serif"; g.fillText(String(text.day), mx, my + 26); g.textAlign = "left";
  for (let r = 0; r < 4; r++) { g.beginPath(); for (let x = 0; x <= 150; x += 6) { const y = my - 30 + r * 18 + Math.sin(x / 14) * 5; if (x === 0) g.moveTo(mx + 62 + x, y); else g.lineTo(mx + 62 + x, y); } g.stroke(); }
  g.fillStyle = MUTED; g.font = "500 24px 'Familjen Grotesk', system-ui, sans-serif"; g.textAlign = "right"; g.fillText("unwatched.world", mx - 80, baseY + 52); g.textAlign = "left";
  return out;
}
