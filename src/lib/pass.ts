import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

/**
 * A check-in pass is the gym, the member ID and the current 30-second window, signed with a key only
 * that member's phone and the gym's staff hold. A photo of a pass can't be used to work out the next
 * one. The desk checks it on the phone itself, so scanning keeps working without a connection.
 */

const SIGNATURE_LENGTH = 24;

const windowAt = (windowSeconds: number, at: number) => Math.floor(at / (windowSeconds * 1000));

const sign = (key: string, gymId: string, code: string, window: number) =>
  bytesToHex(hmac(sha256, utf8ToBytes(key), utf8ToBytes(`${gymId}:${code}:${window}`))).slice(0, SIGNATURE_LENGTH);

export function makePass(key: string, gymId: string, code: string, windowSeconds = 30, at = Date.now()) {
  const window = windowAt(windowSeconds, at);
  return `GYMPASS2:${gymId}:${code}:${window}:${sign(key, gymId, code, window)}`;
}

export function readPass(value: string, gymId: string, windowSeconds = 30, at = Date.now()) {
  const text = value.trim();
  const m = /^GYMPASS2:([^:]+):([^:]+):(\d+):([0-9a-f]+)$/.exec(text);
  if (!m) {
    return { ok: false as const, reason: text.startsWith('GYMPASS:') ? 'This pass is from an older version of the app. Ask the member to update it, or use Find by name.' : 'This isn’t a member pass.' };
  }
  if (m[1] !== gymId) return { ok: false as const, reason: 'This pass belongs to a different gym.' };
  const window = Number(m[3]);
  if (Math.abs(windowAt(windowSeconds, at) - window) > 2) return { ok: false as const, reason: 'This code has expired. Ask the member to reopen their pass.' };
  return { ok: true as const, gymId, code: m[2], window, signature: m[4] };
}

export function passIsGenuine(key: string | undefined, pass: { gymId: string; code: string; window: number; signature: string }) {
  return !!key && sign(key, pass.gymId, pass.code, pass.window) === pass.signature;
}
