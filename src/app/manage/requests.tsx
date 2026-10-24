import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Avatar, Button, Card, Empty, Group, Row, Screen, Segmented, StatusPill, Text, toast } from '@/components/ui';
import { addDays, fmtDate, fmtRange, fmtStampInline, plural } from '@/lib/date';
import { membership, pauseLength } from '@/lib/domain';
import { useNow } from '@/lib/hooks';
import { call, confirm } from '@/lib/native';
import { useApp } from '@/store';
import { makeStyles, useTheme } from '@/theme';

type Tab = 'pauses' | 'coach';

export default function Requests() {
  const { brand } = useTheme();
  const s = useStyles();
  const params = useLocalSearchParams<{ tab?: Tab }>();
  const now = useNow(60_000);
  const members = useApp((st) => st.members);
  const plans = useApp((st) => st.plans);
  const pauses = useApp((st) => st.pauses);
  const bookings = useApp((st) => st.bookings);
  const ptRequests = useApp((st) => st.ptRequests);
  const trainers = useApp((st) => st.trainers);
  const decidePause = useApp((st) => st.decidePause);
  const decideTrainer = useApp((st) => st.decideTrainer);
  const [tab, setTab] = useState<Tab>(params.tab === 'coach' ? 'coach' : 'pauses');

  const pending = pauses.filter((p) => p.status === 'pending').sort((a, b) => (a.start < b.start ? -1 : 1));
  const decided = pauses
    .filter((p) => (p.status === 'approved' || p.status === 'rejected') && p.decidedAt)
    .sort((a, b) => (a.decidedAt! < b.decidedAt! ? 1 : -1))
    .slice(0, 12);
  const coachPending = ptRequests.filter((r) => r.status === 'pending');
  const coachDone = ptRequests.filter((r) => r.status !== 'pending');
  const member = (id: string) => members.find((m) => m.id === id);

  return (
    <Screen header="stack" title="Requests">
      {brand.features.trainers ? (
        <View style={{ marginBottom: 16 }}>
          <Segmented<Tab>
            value={tab}
            onChange={setTab}
            options={[
              { value: 'pauses', label: 'Pauses', count: pending.length },
              { value: 'coach', label: 'Coaching', count: coachPending.length },
            ]}
          />
        </View>
      ) : null}

      {tab === 'pauses' ? (
        <>
          {pending.length ? (
            <View style={{ gap: 12 }}>
              {pending.map((p) => {
                const m = member(p.memberId);
                if (!m) return null;
                const info = membership(m, plans, pauses, now.date);
                const days = pauseLength(p);
                const leftBefore = info.pauseLeft + days;
                const clashes = bookings.filter((b) => b.memberId === m.id && b.status !== 'cancelled' && b.date >= p.start && b.date <= p.end).length;
                return (
                  <Card key={p.id} style={{ gap: 12 }}>
                    <View style={s.who}>
                      <Avatar name={m.name} size={40} />
                      <View style={{ flex: 1 }}>
                        <Text variant="label" onPress={() => router.push(`/manage/member/${m.id}`)}>
                          {m.name}
                        </Text>
                        <Text variant="caption" tone="soft">
                          {info.plan?.name}, asked {fmtStampInline(p.createdAt)}
                        </Text>
                      </View>
                    </View>
                    <View>
                      <Text variant="h2">{fmtRange(p.start, p.end)}</Text>
                      <Text variant="small" tone="soft">
                        {plural(days, 'day')}, {p.reason.toLowerCase()}
                        {p.note ? `. “${p.note}”` : ''}
                      </Text>
                    </View>
                    <Card variant="inset" style={{ gap: 4 }}>
                      <Text variant="small">
                        Uses {days} of {leftBefore} pause days left. New end date {fmtDate(addDays(info.end, days))}.
                      </Text>
                      {clashes ? (
                        <Text variant="small" tone="warning">
                          {plural(clashes, 'booking')} inside these dates will be cancelled.
                        </Text>
                      ) : null}
                    </Card>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <Button
                        title="Approve"
                        style={{ flex: 1 }}
                        size="md"
                        onPress={() => {
                          decidePause(p.id, true);
                          toast.success(`Approved. ${m.name.split(' ')[0]} has been told.`);
                        }}
                      />
                      <Button
                        title="Decline"
                        variant="outline"
                        size="md"
                        style={{ flex: 1 }}
                        onPress={() =>
                          confirm({
                            title: `Decline ${m.name.split(' ')[0]}’s pause?`,
                            message: 'They’ll be asked to talk to the front desk about other dates.',
                            confirmText: 'Decline',
                            destructive: true,
                            onConfirm: () => {
                              decidePause(p.id, false, 'Please talk to the front desk about these dates.');
                              toast.info('Declined.');
                            },
                          })
                        }
                      />
                    </View>
                  </Card>
                );
              })}
            </View>
          ) : (
            <Empty icon="checkmark-done-outline" title="No pause requests waiting" body="When a member asks to pause, it lands here for a quick yes or no." />
          )}

          {decided.length ? (
            <>
              <Text variant="h3" style={{ marginTop: 28, marginBottom: 12 }}>
                Recently decided
              </Text>
              <Group>
                {decided.map((p) => {
                  const m = member(p.memberId);
                  return (
                    <Row
                      key={p.id}
                      leading={<Avatar name={m?.name ?? '?'} size={34} />}
                      title={m?.name ?? 'Former member'}
                      subtitle={`${fmtRange(p.start, p.end)}, ${plural(pauseLength(p), 'day')}`}
                      right={<StatusPill status={p.status} />}
                    />
                  );
                })}
              </Group>
            </>
          ) : null}
        </>
      ) : (
        <>
          {coachPending.length ? (
            <View style={{ gap: 12 }}>
              {coachPending.map((r) => {
                const m = member(r.memberId);
                const coach = trainers.find((t) => t.id === r.trainerId);
                if (!m) return null;
                return (
                  <Card key={r.id} style={{ gap: 10 }}>
                    <View style={s.who}>
                      <Avatar name={m.name} size={40} />
                      <View style={{ flex: 1 }}>
                        <Text variant="label">{m.name}</Text>
                        <Text variant="caption" tone="soft">
                          Wants {coach?.name ?? 'a coach'}, {r.preferredTime.toLowerCase()}
                        </Text>
                      </View>
                    </View>
                    <Text variant="body">“{r.goal}”</Text>
                    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                      <Button title="Call member" icon="call-outline" variant="soft" size="sm" onPress={() => call(m.phone)} />
                      <Button
                        title="Trial booked"
                        size="sm"
                        onPress={() => {
                          decideTrainer(r.id, true);
                          toast.success('Marked as scheduled.');
                        }}
                      />
                      <Button title="Decline" size="sm" variant="outline" onPress={() => decideTrainer(r.id, false)} />
                    </View>
                  </Card>
                );
              })}
            </View>
          ) : (
            <Empty icon="barbell-outline" title="No coaching requests" body="Members can ask for a coach from the Coaches page in their app." />
          )}
          {coachDone.length ? (
            <Group style={{ marginTop: 24 }}>
              {coachDone.map((r) => (
                <Row
                  key={r.id}
                  title={member(r.memberId)?.name ?? 'Former member'}
                  subtitle={trainers.find((t) => t.id === r.trainerId)?.name}
                  value={r.status === 'scheduled' ? 'Scheduled' : 'Declined'}
                  valueTone={r.status === 'scheduled' ? 'success' : 'faint'}
                />
              ))}
            </Group>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  who: { flexDirection: 'row', alignItems: 'center', gap: 12 },
}));
