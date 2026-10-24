import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { ChestArt } from '@/components/fun/Chest';
import { Confetti } from '@/components/fun/SkiaConfetti';
import { CountUp, PopIn, Wiggle } from '@/components/fun/Motion';
import { Button, Card, Empty, Group, Icon, Pill, Row, Screen, SectionHeader, Text, toast, type IconName } from '@/components/ui';
import { fmtStamp, fmtStampInline } from '@/lib/date';
import { CHEST_TEASE, prizeCode } from '@/lib/game';
import { haptic } from '@/lib/native';
import { openChestRemote } from '@/lib/remote';
import { useApp, useMe, type Prize } from '@/store';
import { makeStyles, useTheme } from '@/theme';

const PRIZE_ICON: Record<Prize['kind'], IconName> = {
  xp: 'flash',
  shake: 'cafe',
  guestPass: 'ticket',
  pauseDay: 'airplane',
  merch: 'shirt',
};

export default function Rewards() {
  const { c, brand } = useTheme();
  const s = useStyles();
  const me = useMe();
  const chests = useApp((st) => st.chests);
  const xp = useApp((st) => st.xp);
  const [opening, setOpening] = useState<{ id: string; prize: Prize | null; stage: 'shaking' | 'open' } | null>(null);
  if (!me) return null;

  const closed = chests.filter((x) => x.memberId === me.id && !x.openedAt).sort((a, b) => (a.earnedAt < b.earnedAt ? -1 : 1));
  const perks = chests
    .filter((x) => x.memberId === me.id && x.prize && x.prize.kind !== 'xp')
    .sort((a, b) => ((a.openedAt ?? '') < (b.openedAt ?? '') ? 1 : -1));
  const history = xp
    .filter((e) => e.memberId === me.id)
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .reduce<{ key: string; reason: string; at: string; amount: number; count: number }[]>((rows, e) => {
      const key = `${e.reason}-${e.at.slice(0, 10)}`;
      const row = rows.find((r) => r.key === key);
      if (row) {
        row.amount += e.amount;
        row.count += 1;
      } else rows.push({ key, reason: e.reason, at: e.at, amount: e.amount, count: 1 });
      return rows;
    }, [])
    .slice(0, 12);
  const next = opening ? undefined : closed[0];

  const open = async (id: string) => {
    haptic.heavy();
    setOpening({ id, prize: null, stage: 'shaking' });
    // The server draws the prize. A short beat of anticipation while it does.
    const [r] = await Promise.all([openChestRemote(id), new Promise((done) => setTimeout(done, 900))]);
    if (!r.ok) {
      setOpening(null);
      return toast.error(r.message);
    }
    haptic.reward();
    setOpening({ id, prize: r.prize as Prize, stage: 'open' });
  };

  return (
    <Screen header="stack" title="Rewards">
      {opening ? (
        <Card style={s.stage}>
          {opening.stage === 'open' ? <Confetti seed={opening.id} count={40} origin={{ y: 120 }} /> : null}
          <Wiggle active={opening.stage === 'shaking'}>
            <ChestArt size={150} open={opening.stage === 'open'} />
          </Wiggle>
          {opening.stage === 'open' && opening.prize ? (
            <PopIn style={{ alignItems: 'center', gap: 6 }}>
              <View style={[s.prizeIcon, { backgroundColor: opening.prize.kind === 'xp' ? c.warning.solid : c.primary }]}>
                <Icon name={PRIZE_ICON[opening.prize.kind]} size={30} color="#FFFFFF" />
              </View>
              {opening.prize.kind === 'xp' ? (
                <CountUp value={opening.prize.amount} duration={1000} format={(n) => `+${n} XP`} variant="display" color={c.warning.fg} />
              ) : (
                <Text variant="h2" align="center">
                  {opening.prize.label}
                </Text>
              )}
              <Text tone="soft" align="center">
                {opening.prize.kind === 'xp'
                  ? opening.prize.amount >= 250
                    ? 'Jackpot. That’s the biggest prize in the chest.'
                    : 'Added to your total.'
                  : opening.prize.kind === 'shake'
                    ? 'Show this screen at the protein bar to collect it.'
                    : opening.prize.kind === 'guestPass'
                      ? 'You can bring one more friend for a free week.'
                      : 'Added to your pause balance.'}
              </Text>
            </PopIn>
          ) : (
            <Text variant="h3" tone="soft">
              Opening…
            </Text>
          )}
          {opening.stage === 'open' ? (
            <Button title={closed.length ? `Next chest (${closed.length} left)` : 'Done'} full onPress={() => setOpening(null)} />
          ) : null}
        </Card>
      ) : next ? (
        <Card style={s.stage}>
          <Text variant="h2" align="center">
            {closed.length === 1 ? 'You have a chest' : `You have ${closed.length} chests`}
          </Text>
          <Pressable onPress={() => open(next.id)} accessibilityRole="button" accessibilityLabel="Open chest">
            <Wiggle>
              <ChestArt size={150} />
            </Wiggle>
          </Pressable>
          <Text variant="small" tone="soft" align="center">
            Earned for: {next.reason.toLowerCase()}. {CHEST_TEASE}
          </Text>
          <Button title="Tap to open" full onPress={() => open(next.id)} />
        </Card>
      ) : (
        <Empty icon="gift-outline" title="No chests right now" body="You get a chest every day you check in, for personal records, and for closing all three rings." />
      )}

      {perks.length ? (
        <>
          <SectionHeader title="Prizes to collect" hint={`Show these at the ${brand.shortName} desk.`} />
          <View style={{ gap: 10 }}>
            {perks.map((p) => (
              <Animated.View key={p.id} entering={FadeIn}>
                <Card style={s.perk}>
                  <View style={[s.perkIcon, { backgroundColor: p.redeemedAt ? c.surfaceAlt : c.primarySoft }]}>
                    <Icon name={PRIZE_ICON[p.prize!.kind]} size={22} tone={p.redeemedAt ? 'faint' : 'primary'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="label">{p.prize!.label}</Text>
                    <Text variant="caption" tone="soft">
                      Code {prizeCode(p.id)}, won {fmtStampInline(p.openedAt!)}
                    </Text>
                  </View>
                  {p.prize!.kind === 'shake' || p.prize!.kind === 'merch' ? (
                    <Pill label={p.redeemedAt ? 'Collected' : 'To collect'} tone={p.redeemedAt ? 'neutral' : 'success'} />
                  ) : (
                    <Pill label="Added" tone="neutral" />
                  )}
                </Card>
              </Animated.View>
            ))}
          </View>
        </>
      ) : null}

      <SectionHeader title="Recent XP" />
      <Group inset={16}>
        {history.map((e) => (
          <Row key={e.key} title={e.count > 1 ? `${e.reason} ×${e.count}` : e.reason} subtitle={fmtStamp(e.at)} value={`+${e.amount}`} valueTone="warning" />
        ))}
      </Group>
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  stage: { alignItems: 'center', gap: 16, paddingVertical: 26, overflow: 'hidden' },
  prizeIcon: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  perk: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  perkIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
}));
