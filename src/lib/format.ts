import { activeBrand } from '@/config/active';

/** Indian digit grouping (1,84,200) for INR, western grouping otherwise. */
function group(n: number, indian: boolean) {
  const s = Math.round(Math.abs(n)).toString();
  if (!indian || s.length <= 3) return s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${rest},${last3}`;
}

export function money(amount: number, opts: { compact?: boolean } = {}) {
  const { symbol, code } = activeBrand().currency;
  const indian = code === 'INR';
  const sign = amount < 0 ? '−' : '';
  const abs = Math.abs(amount);
  if (opts.compact && indian && abs >= 100000) {
    const l = abs / 100000;
    return `${sign}${symbol}${l >= 10 ? l.toFixed(1) : l.toFixed(2)}L`;
  }
  if (opts.compact && abs >= 1000) {
    const k = abs / 1000;
    return `${sign}${symbol}${k >= 100 ? Math.round(k) : k.toFixed(1)}k`;
  }
  return `${sign}${symbol}${group(abs, indian)}`;
}

export function phoneDisplay(phone: string) {
  const d = phone.replace(/\D/g, '').slice(-10);
  if (d.length !== 10) return phone;
  return `+91 ${d.slice(0, 5)} ${d.slice(5)}`;
}

export function initials(name: string) {
  const w = name.trim().split(/\s+/);
  return ((w[0]?.[0] ?? '') + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase();
}

export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? name;
}

let counter = 0;
export function uid(prefix = '') {
  counter = (counter + 1) % 1296;
  return `${prefix}${Date.now().toString(36)}${counter.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

/** Deterministic PRNG so the demo gym looks the same on every device. */
export function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function rng(seed: number | string) {
  let a = typeof seed === 'string' ? hash(seed) : seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
