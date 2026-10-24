import { useEffect, useMemo, useState } from 'react';

import { useApp } from '@/store';

import { toISO } from './date';
import { membership } from './domain';

/** Current date and minute-of-day, refreshed on an interval so time-based UI stays honest. */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return { date: toISO(now), mins: now.getHours() * 60 + now.getMinutes(), hour: now.getHours() };
}

/** The slices most domain helpers need, selected one by one so references stay stable. */
export function useGym() {
  const slots = useApp((s) => s.slots);
  const classes = useApp((s) => s.classes);
  const members = useApp((s) => s.members);
  const plans = useApp((s) => s.plans);
  const pauses = useApp((s) => s.pauses);
  const closures = useApp((s) => s.closures);
  const bookings = useApp((s) => s.bookings);
  const checkins = useApp((s) => s.checkins);
  return useMemo(
    () => ({ slots, classes, members, plans, pauses, closures, bookings, checkins }),
    [slots, classes, members, plans, pauses, closures, bookings, checkins],
  );
}

export type Gym = ReturnType<typeof useGym>;

/** The signed-in member plus their membership summary for `date`. */
export function useMyMembership(date: string) {
  const id = useApp((s) => s.session?.memberId);
  const member = useApp((s) => s.members.find((m) => m.id === id));
  const plans = useApp((s) => s.plans);
  const pauses = useApp((s) => s.pauses);
  const info = useMemo(() => (member ? membership(member, plans, pauses, date) : undefined), [member, plans, pauses, date]);
  return { member, info };
}
