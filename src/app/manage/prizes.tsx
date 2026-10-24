import { View } from 'react-native';

import { Avatar, Button, Card, Empty, Group, Row, Screen, SectionHeader, Text, toast } from '@/components/ui';
import { fmtStamp, fmtStampInline } from '@/lib/date';
import { CHEST_TEASE, prizeCode } from '@/lib/game';
import { useApp } from '@/store';

export default function Prizes() {
  const chests = useApp((s) => s.chests);
  const members = useApp((s) => s.members);
  const redeem = useApp((s) => s.redeemPrize);
  const physical = chests.filter((c) => c.prize && (c.prize.kind === 'shake' || c.prize.kind === 'merch'));
  const pending = physical.filter((c) => !c.redeemedAt).sort((a, b) => ((a.openedAt ?? '') < (b.openedAt ?? '') ? -1 : 1));
  const done = physical.filter((c) => c.redeemedAt).sort((a, b) => ((a.redeemedAt ?? '') < (b.redeemedAt ?? '') ? 1 : -1)).slice(0, 10);
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? 'Former member';

  return (
    <Screen header="stack" title="Prizes to hand out">
      <Text tone="soft">
        Members win these from chests. They show the prize and its code in their app. Hand it over and mark it collected so it can’t be claimed twice.
      </Text>
      <View style={{ gap: 10, marginTop: 16 }}>
        {pending.length ? (
          pending.map((c) => (
            <Card key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Avatar name={nameOf(c.memberId)} size={40} />
              <View style={{ flex: 1 }}>
                <Text variant="label">{c.prize!.label}</Text>
                <Text variant="caption" tone="soft">
                  {nameOf(c.memberId)}, code {prizeCode(c.id)}, won {fmtStampInline(c.openedAt!)}
                </Text>
              </View>
              <Button
                title="Handed over"
                size="sm"
                onPress={() => {
                  redeem(c.id);
                  toast.success('Marked as collected.');
                }}
              />
            </Card>
          ))
        ) : (
          <Empty icon="gift-outline" title="Nothing to hand out" body="When a member wins a shake or merch from a chest, it shows up here." />
        )}
      </View>

      {done.length ? (
        <>
          <SectionHeader title="Recently collected" />
          <Group inset={16}>
            {done.map((c) => (
              <Row key={c.id} title={c.prize!.label} subtitle={nameOf(c.memberId)} value={fmtStamp(c.redeemedAt!)} valueTone="faint" />
            ))}
          </Group>
        </>
      ) : null}

      <SectionHeader title="What’s in a chest" />
      <Text variant="small" tone="soft">
        {CHEST_TEASE} Members get one for each day they check in, each personal record, and for closing all three weekly rings. Real prizes are rare by
        design, about 1 chest in 14.
      </Text>
    </Screen>
  );
}
