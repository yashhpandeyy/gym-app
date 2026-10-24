import { useMemo } from 'react';

import { useApp, useMe } from '@/store';

import { addDays, diffDays, startOfWeek, type ISODate } from './date';
import {
  badges,
  bestLifts,
  bodyweightOn,
  LEAGUES,
  leaderboard,
  leagueStandings,
  levelFor,
  prCount,
  strengthHistory,
  strengthScore,
  tierFor,
  unopened,
  weekRings,
  xpBetween,
  xpTotal,
} from './game';

/** Everything the Club tab and Home need about the signed-in member's progress. */
export function useGame(t: ISODate) {
  const me = useMe();
  const members = useApp((s) => s.members);
  const xp = useApp((s) => s.xp);
  const chests = useApp((s) => s.chests);
  const lifts = useApp((s) => s.lifts);
  const progress = useApp((s) => s.progress);
  const workouts = useApp((s) => s.workouts);
  const workoutLog = useApp((s) => s.workoutLog);
  const mealLog = useApp((s) => s.mealLog);
  const dietPlans = useApp((s) => s.dietPlans);
  const checkins = useApp((s) => s.checkins);
  const leagueTier = useApp((s) => s.leagueTier);
  const challenges = useApp((s) => s.challenges);
  const challengeEntries = useApp((s) => s.challengeEntries);
  const guestPasses = useApp((s) => s.guestPasses);
  const mindLog = useApp((s) => s.mindLog);
  const ringClaims = useApp((s) => s.ringClaims);

  return useMemo(() => {
    if (!me) return undefined;
    const total = xpTotal(xp, me.id);
    const level = levelFor(total);
    const week = startOfWeek(t);
    const weekXp = xpBetween(xp, me.id, week, t);

    const rings = weekRings({
      member: me,
      checkins,
      workoutLog: workoutLog[me.id],
      workout: workouts[me.id],
      mealLog: mealLog[me.id],
      diet: dietPlans[me.id],
      t,
    });

    const standings = leagueStandings({ members, me, xp, week, t });
    const myIndex = standings.findIndex((r) => r.me);
    const above = myIndex > 0 ? standings[myIndex - 1] : undefined;
    const tier = leagueTier[me.id] ?? 0;

    const bw = bodyweightOn(progress[me.id], t);
    const best = bestLifts(lifts, me.id);
    const score = strengthScore(best, bw);
    const strength = { best, bw, score, tier: tierFor(score), history: strengthHistory(lifts, me.id, progress[me.id], 10, t) };

    const month = t.slice(0, 7);
    const slotIds = new Set(members.filter((m) => m.preferredSlotId === me.preferredSlotId).map((m) => m.id));
    const mineThisMonth = challengeEntries.filter((e) => e.date.startsWith(month));
    const boards = challenges
      .filter((c) => c.active)
      .map((c) => {
        const all = mineThisMonth;
        const slot = leaderboard(c, all, me.id, slotIds);
        const gym = leaderboard(c, all, me.id);
        return { challenge: c, slot, gym, mine: slot.find((r) => r.me), mineGym: gym.find((r) => r.me) };
      });

    const ringWeeks = Object.values(ringClaims[me.id] ?? {}).filter((k) => k.includes('all')).length;
    const list = badges({
      visits: checkins.filter((c) => c.memberId === me.id).map((c) => c.at),
      prs: prCount(lifts, me.id),
      score,
      guests: guestPasses.filter((g) => g.hostId === me.id).length,
      mindMinutes: mindLog.filter((m) => m.memberId === me.id).reduce((s, m) => s + m.minutes, 0),
      ringWeeks,
      legend: boards.some((b) => b.mine?.rank === 1),
      kings: boards.map((b) => ({ id: b.challenge.id, name: b.challenge.name, won: b.mine?.rank === 1 })),
    });

    return {
      me,
      total,
      level,
      weekXp,
      rings,
      league: {
        name: LEAGUES[tier],
        tier,
        standings,
        rank: myIndex + 1,
        gap: above ? above.xp - standings[myIndex].xp + 1 : 0,
        above,
        daysLeft: diffDays(t, addDays(week, 6)) + 1,
      },
      strength,
      boards,
      badges: list,
      chests: unopened(chests, me.id),
    };
  }, [me, t, xp, chests, lifts, progress, workouts, workoutLog, mealLog, dietPlans, checkins, members, leagueTier, challenges, challengeEntries, guestPasses, mindLog, ringClaims]);
}

export type GameState = NonNullable<ReturnType<typeof useGame>>;
