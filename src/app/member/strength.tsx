import { useState } from 'react';
import { View } from 'react-native';

import { LineChart } from '@/components/Charts';
import { LogSetSheet } from '@/components/fun/LogSetSheet';
import { XPBar } from '@/components/fun/Motion';
import { Button, Card, Group, Row, Screen, SectionHeader, Text } from '@/components/ui';
import { fmtDay } from '@/lib/date';
import { e1rm, LIFT_KEYS, LIFT_LABEL, nextMilestone, round1, STANDARD, TIERS } from '@/lib/game';
import { useNow } from '@/lib/hooks';
import { useGame } from '@/lib/useGame';
import { useApp, type LiftKey } from '@/store';
import { useTheme } from '@/theme';

/** Exercise names in the workout plan for each scored lift, so logs from either screen line up. */
const PLAN_NAME: Record<LiftKey, string> = {
  squat: 'Back squat',
  bench: 'Bench press',
  deadlift: 'Deadlift',
  ohp: 'Standing overhead press',
};

export default function Strength() {
  const { c } = useTheme();
  const now = useNow(60_000);
  const game = useGame(now.date);
  const lifts = useApp((st) => st.lifts);
  const [logging, setLogging] = useState<LiftKey | null>(null);
  if (!game) return null;
  const { strength } = game;
  const tier = strength.tier;
  const span = tier.next ? tier.next.floor - tier.floor : 1;

  const prs = lifts
    .filter((l) => l.memberId === game.me.id)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .reduce<{ list: typeof lifts; best: Record<string, number> }>(
      (acc, l) => {
        const v = e1rm(l.weight, l.reps);
        if (acc.best[l.exercise] !== undefined && v > acc.best[l.exercise] + 0.01) acc.list.push(l);
        acc.best[l.exercise] = Math.max(acc.best[l.exercise] ?? 0, v);
        return acc;
      },
      { list: [], best: {} },
    )
    .list.reverse()
    .slice(0, 6);

  return (
    <Screen header="stack" title="Strength score">
      <Card style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View>
            <Text variant="hero">{strength.score}</Text>
            <Text variant="h3" tone="primary">
              {tier.name}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 2, marginBottom: 6 }}>
            <Text variant="label" tone="success">
              +{strength.score - strength.history[0].score} in 10 weeks
            </Text>
            <Text variant="caption" tone="soft">
              at {round1(strength.bw)} kg bodyweight
            </Text>
          </View>
        </View>
        {tier.next ? (
          <View style={{ gap: 6 }}>
            <XPBar progress={(strength.score - tier.floor) / span} color={c.primary} height={10} />
            <Text variant="caption" tone="soft">
              {tier.toNext} points to {tier.next.name}
            </Text>
          </View>
        ) : null}
        <LineChart values={strength.history.map((h) => h.score)} height={110} />
      </Card>

      <SectionHeader title="Your lifts" hint="Each lift is scored against your bodyweight. Here’s the next milestone for each." />
      <View style={{ gap: 10 }}>
        {LIFT_KEYS.map((k) => {
          const b = strength.best[k];
          const m = b ? nextMilestone(b.e1rm, strength.bw) : undefined;
          return (
            <Card key={k} style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View>
                  <Text variant="h3">{LIFT_LABEL[k]}</Text>
                  <Text variant="caption" tone="soft">
                    {b ? `Best set ${b.entry.weight} kg × ${b.entry.reps} on ${fmtDay(b.entry.date)}` : 'Not logged yet'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text variant="h2">{b ? `${round1(b.e1rm)} kg` : '–'}</Text>
                  <Text variant="caption" tone="soft">
                    {b ? `${m!.ratio}× bodyweight` : `Target ${STANDARD[k]}×`}
                  </Text>
                </View>
              </View>
              {m ? (
                <View style={{ gap: 6 }}>
                  <XPBar progress={m.progress} color={c.success.solid} height={8} />
                  <Text variant="caption" tone="soft">
                    Next milestone: {m.nextRatio}× bodyweight, an estimated max of {m.kg} kg.
                  </Text>
                </View>
              ) : null}
              <Button title="Log a set" size="sm" variant="outline" icon="add" onPress={() => setLogging(k)} />
            </Card>
          );
        })}
      </View>

      {prs.length ? (
        <>
          <SectionHeader title="Recent personal records" />
          <Group inset={16}>
            {prs.map((l) => (
              <Row key={l.id} title={l.exercise} subtitle={fmtDay(l.date)} value={`${l.weight} kg × ${l.reps}`} valueTone="success" />
            ))}
          </Group>
        </>
      ) : null}

      <SectionHeader title="How it works" />
      <Text variant="small" tone="soft">
        Your best estimated one-rep max for each lift is divided by your bodyweight and compared with what a trained intermediate lifter can do. Each lift is
        worth up to about 425 points. Tiers: {TIERS.map((t) => `${t.name} ${t.floor}+`).join(', ')}.
      </Text>

      {logging ? (
        <LogSetSheet
          key={logging}
          visible
          onClose={() => setLogging(null)}
          exercise={PLAN_NAME[logging]}
          liftKey={logging}
        />
      ) : null}
    </Screen>
  );
}

