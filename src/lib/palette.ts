import UPNG from 'upng-js';

const toHex = (r: number, g: number, b: number) => `#${[r, g, b].map((n) => Math.round(n).toString(16).padStart(2, '0')).join('')}`.toUpperCase();

function hsv(r: number, g: number, b: number) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return { s: max === 0 ? 0 : (max - min) / max, v: max / 255 };
}

/**
 * Picks up to `count` brand colours from RGBA pixels. Transparent, near-white and near-black
 * pixels are skipped, and vivid colours that cover a lot of the logo rank highest. Colours that
 * look alike are merged so the swatches are genuinely different.
 */
export function paletteFromPixels(rgba: Uint8Array | Uint8ClampedArray, count = 5): string[] {
  const bins = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    const [r, g, b, a] = [rgba[i], rgba[i + 1], rgba[i + 2], rgba[i + 3]];
    if (a < 128) continue;
    const { s, v } = hsv(r, g, b);
    if (v < 0.18 || (v > 0.94 && s < 0.12)) continue;
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bin = bins.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    bin.n++;
    bin.r += r;
    bin.g += g;
    bin.b += b;
    bins.set(key, bin);
  }
  const ranked = [...bins.values()]
    .map((b) => {
      const [r, g, bl] = [b.r / b.n, b.g / b.n, b.b / b.n];
      return { r, g, b: bl, score: b.n * (0.25 + hsv(r, g, bl).s) };
    })
    .sort((x, y) => y.score - x.score);
  const picked: typeof ranked = [];
  for (const c of ranked) {
    if (picked.every((p) => Math.hypot(p.r - c.r, p.g - c.g, p.b - c.b) > 70)) picked.push(c);
    if (picked.length === count) break;
  }
  return picked.map((c) => toHex(c.r, c.g, c.b));
}

/** Decodes a PNG given as base64 and returns its main colours. */
export function paletteFromPngBase64(base64: string, count = 5): string[] {
  const bytes = Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0));
  const img = UPNG.decode(bytes.buffer);
  const frame = UPNG.toRGBA8(img)[0];
  return paletteFromPixels(new Uint8Array(frame), count);
}
