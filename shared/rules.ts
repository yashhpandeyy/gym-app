/**
 * Game rules that the app shows and the server enforces. Pure and dependency-free, so both the
 * React Native app and the Cloudflare Worker import this same file.
 */

export type PrizeKind = 'xp' | 'shake' | 'guestPass' | 'pauseDay' | 'merch';
export type Prize = { kind: PrizeKind; amount: number; label: string };

export const XP = {
  checkIn: 20,
  exercise: 5,
  pr: 40,
  meal: 2,
  mind: 15,
  attempt: 10,
  guest: 25,
  guestVisit: 10,
  referral: 150,
  ring: 30,
  allRings: 75,
} as const;

/** Each level needs 50 more XP than the last: 100, 150, 200… */
export function levelFor(total: number) {
  let level = 1;
  let floor = 0;
  let next = 100;
  while (total >= next) {
    level += 1;
    floor = next;
    next = floor + 100 + 50 * (level - 1);
  }
  return { level, floor, next, into: total - floor, span: next - floor, progress: (total - floor) / (next - floor) };
}

const PRIZES: { weight: number; make: (r: () => number) => Prize }[] = [
  { weight: 44, make: (r) => ({ kind: 'xp', amount: 10 + Math.round(r() * 15), label: 'XP' }) },
  { weight: 28, make: (r) => ({ kind: 'xp', amount: 30 + Math.round(r() * 30), label: 'XP' }) },
  { weight: 15, make: (r) => ({ kind: 'xp', amount: 80 + Math.round(r() * 70), label: 'XP' }) },
  { weight: 6, make: () => ({ kind: 'xp', amount: 250, label: 'XP jackpot' }) },
  { weight: 4, make: () => ({ kind: 'shake', amount: 1, label: 'Free protein shake' }) },
  { weight: 2, make: () => ({ kind: 'guestPass', amount: 1, label: 'Extra guest pass' }) },
  { weight: 1, make: () => ({ kind: 'pauseDay', amount: 1, label: 'Extra pause day' }) },
];

/** The prize is drawn when the chest is opened, not when it's earned, so the size really is unknown. */
export function drawPrize(random: () => number = Math.random): Prize {
  const total = PRIZES.reduce((s, p) => s + p.weight, 0);
  let roll = random() * total;
  for (const p of PRIZES) {
    roll -= p.weight;
    if (roll <= 0) return p.make(random);
  }
  return PRIZES[0].make(random);
}
