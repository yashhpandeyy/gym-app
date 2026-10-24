const enc = new TextEncoder();

function toB64Url(bytes: Uint8Array) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function toHex(buf: ArrayBuffer) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function randomToken(bytes = 32) {
  return toB64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export function newId(prefix: string) {
  return `${prefix}_${randomToken(9)}`;
}

/** A uniformly random n-digit code, by rejection sampling so no digit is favoured. */
export function randomDigits(n: number) {
  const max = 10 ** n;
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) return String(buf[0] % max).padStart(n, '0');
  }
}

export async function sha256(text: string) {
  return toHex(await crypto.subtle.digest('SHA-256', enc.encode(text)));
}

export function safeEqual(a: string, b: string) {
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/**
 * Passwords and staff PINs. Slow hashes such as PBKDF2 need more CPU than Cloudflare's free plan
 * allows per request, so these are HMAC-SHA256 keyed with a server-side secret (a "pepper") plus a
 * per-user salt. Guessing is stopped online by the sign-in lockout, and a stolen copy of the
 * database is useless on its own because the key lives only in the Worker's secrets.
 */
export async function hashSecret(secret: string, pepper: string) {
  const salt = randomToken(12);
  return `hmac$${salt}$${await hmacCode(pepper, salt, secret)}`;
}

export async function verifySecret(secret: string, stored: string, pepper: string) {
  const [kind, salt, hash] = stored.split('$');
  if (kind !== 'hmac' || !salt || !hash) return false;
  return safeEqual(await hmacCode(pepper, salt, secret), hash);
}

/**
 * Keyed hash for short invite codes. A 6-digit code has only a million values, so a plain hash
 * would be reversible instantly. Keying it with a server secret means a copy of the database
 * alone can't be used to recover codes.
 */
export async function hmacCode(secret: string, salt: string, code: string) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toHex(await crypto.subtle.sign('HMAC', key, enc.encode(`${salt}:${code}`)));
}
