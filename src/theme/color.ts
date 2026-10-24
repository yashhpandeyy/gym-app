type RGB = { r: number; g: number; b: number };

export function isHex(value: string) {
  return /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
}

export function hexToRgb(hex: string): RGB {
  let h = hex.trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }: RGB) {
  const to = (x: number) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase();
}

/** Blend `b` into `a`. amount = 0 returns a, 1 returns b. */
export function mix(a: string, b: string, amount: number) {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return rgbToHex({
    r: x.r + (y.r - x.r) * amount,
    g: x.g + (y.g - x.g) * amount,
    b: x.b + (y.b - x.b) * amount,
  });
}

export function alpha(hex: string, a: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

function channel(v: number) {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function luminance(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrast(a: string, b: string) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Pick whichever of the two text colours reads better on `bg`. */
export function readableOn(bg: string, light = '#FFFFFF', dark = '#121620') {
  return contrast(bg, light) >= contrast(bg, dark) ? light : dark;
}

/** Push `fg` toward `toward` until it reaches the target contrast against `bg`. */
export function ensureContrast(fg: string, bg: string, target: number, toward: string) {
  let out = fg;
  for (let i = 1; i <= 12 && contrast(out, bg) < target; i++) {
    out = mix(fg, toward, i * 0.08);
  }
  return out;
}
