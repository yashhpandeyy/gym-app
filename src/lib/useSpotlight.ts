import { useMemo } from 'react';

import { useApp, useMe } from '@/store';

import type { ISODate } from './date';
import { spotlight, type SpotlightInput } from './spotlight';

/** Inputs for the spotlight and leaderboards, rebuilt only when the underlying data changes. */
export function useSpotlightInput(t: ISODate): SpotlightInput | undefined {
  const me = useMe();
  const members = useApp((s) => s.members);
  const plans = useApp((s) => s.plans);
  const pauses = useApp((s) => s.pauses);
  const lifts = useApp((s) => s.lifts);
  const progress = useApp((s) => s.progress);
  const challenges = useApp((s) => s.challenges);
  const challengeEntries = useApp((s) => s.challengeEntries);
  const checkins = useApp((s) => s.checkins);
  const slots = useApp((s) => s.slots);
  return useMemo(
    () => (me ? { me, members, plans, pauses, lifts, progress, challenges, challengeEntries, checkins, slots, t } : undefined),
    [me, members, plans, pauses, lifts, progress, challenges, challengeEntries, checkins, slots, t],
  );
}

export function useSpotlight(t: ISODate) {
  const input = useSpotlightInput(t);
  return useMemo(() => (input ? spotlight(input) : []), [input]);
}
