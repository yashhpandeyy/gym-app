import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { DateStrip } from '@/components/DateStrip';
import { SpotMeter } from '@/components/Meters';
import { Avatar, Button, Card, Chip, Divider, Empty, Icon, Input, Pill, Screen, Sheet, Stepper, Text, ToggleRow, toast } from '@/components/ui';
import { addDays, fmtDay, fmtTimeRange, stampToDate, WEEKDAYS_SHORT, type ISODate } from '@/lib/date';
import { slotsOn, slotState } from '@/lib/domain';
import { useGym, useNow } from '@/lib/hooks';
import { confirm, haptic } from '@/lib/native';
import { useApp } from '@/store';
import { makeStyles, useTheme } from '@/theme';

export default function Slots() {
  const { c } = useTheme();
  const s = useStyles();
  const now = useNow();
  const gym = useGym();
  const setSlotCapacity = useApp((st) => st.setSlotCapacity);
  const toggleClosure = useApp((st) => st.toggleClosure);
  const addSlot = useApp((st) => st.addSlot);
  const removeSlot = useApp((st) => st.removeSlot);
  const days = Array.from({ length: 14 }, (_, i) => addDays(now.date, i));
  const [date, setDate] = useState<ISODate>(now.date);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [start, setStart] = useState('06:00');
  const [end, setEnd] = useState('07:00');
  const [spots, setSpots] = useState('12');
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
  const formOk = HHMM.test(start) && HHMM.test(end) && end > start && Number(spots) >= 1 && weekdays.length > 0;
  const submitSlot = () => {
    const r = addSlot({ start, end, capacity: Number(spots), days: weekdays });
    if (r.ok) {
      toast.success(r.message ?? 'Slot added.');
      setAdding(false);
    } else toast.error(r.message);
  };

  const slots = slotsOn(gym.slots, date).map((slot) => ({ slot, st: slotState(gym, date, slot, 'slot', undefined, now) }));
  const dayClosed = gym.closures.some((cl) => cl.date === date && cl.slotId === null);
  const booked = slots.reduce((sum, x) => sum + x.st.count, 0);
  const capacity = slots.filter((x) => !x.st.closure).reduce((sum, x) => sum + x.st.capacity, 0);
  const closures = new Set(gym.closures.map((cl) => cl.date));
  const nameOf = (id: string) => gym.members.find((m) => m.id === id)?.name ?? 'Member';
  const checkedIn = new Set(gym.checkins.filter((ci) => stampToDate(ci.at) === date).map((ci) => ci.memberId));

  return (
    <Screen title="Slots" subtitle="Who’s coming, how full each slot is, and when you’re closed.">
      <DateStrip days={days} value={date} onChange={setDate} marked={closures} />

      <View style={s.summary}>
        <View style={{ flex: 1 }}>
          <Text variant="h3">{dayClosed ? 'Closed all day' : `${booked} of ${capacity} spots booked`}</Text>
          <Text variant="small" tone="soft">
            {fmtDay(date)}, {slots.length} slots
          </Text>
        </View>
        <Button
          title={dayClosed ? 'Reopen day' : 'Close day'}
          size="sm"
          variant={dayClosed ? 'soft' : 'outline'}
          onPress={() =>
            dayClosed
              ? toggleClosure(date, null)
              : confirm({
                  title: `Close the gym on ${fmtDay(date)}?`,
                  message: 'Members booked that day get a notification and their bookings are cancelled. Post an announcement to explain why.',
                  confirmText: 'Close day',
                  destructive: true,
                  onConfirm: () => {
                    toggleClosure(date, null, 'Holiday');
                    toast.success(`Closed on ${fmtDay(date)}. Members were told.`);
                  },
                })
          }
        />
      </View>
      {dayClosed ? (
        <Button title="Post an announcement" variant="soft" size="md" icon="megaphone-outline" onPress={() => router.push('/manage/announcements')} />
      ) : null}

      {gym.slots.length === 0 ? (
        <Empty icon="time-outline" title="No slots yet" body="Add the times your gym is open for training and how many people fit in each. Members book from these." action="Add your first slot" onAction={() => setAdding(true)} />
      ) : null}
      <View style={{ gap: 10, marginTop: 6 }}>
        {slots.map(({ slot, st }) => {
          const expanded = open === slot.id;
          const people = st.storedBooked.map((b) => b.memberId);
          return (
            <Card key={slot.id} padded={false} style={st.over ? { opacity: 0.6 } : undefined}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                onPress={() => {
                  haptic.tap();
                  setOpen(expanded ? null : slot.id);
                }}
                style={s.slotHead}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text variant="h3" style={{ flex: 1 }}>
                    {fmtTimeRange(slot.start, slot.end)}
                  </Text>
                  {st.closure ? (
                    <Pill label={st.closure.reason} tone="neutral" />
                  ) : (
                    <Text variant="label" tone={st.level === 'full' ? 'danger' : 'soft'}>
                      {st.count}/{st.capacity}
                    </Text>
                  )}
                  <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={18} tone="faint" />
                </View>
                {!st.closure ? <SpotMeter count={st.count} capacity={st.capacity} level={st.level} height={8} /> : null}
                {st.waitlist.length ? (
                  <Text variant="caption" tone="warning">
                    {st.waitlist.length} on the waitlist. Add spots to let them in.
                  </Text>
                ) : null}
              </Pressable>

              {expanded ? (
                <View style={s.body}>
                  <Divider />
                  <View style={s.capRow}>
                    <View style={{ flex: 1 }}>
                      <Text variant="label">Spots in this slot</Text>
                      <Text variant="caption" tone="soft">
                        Applies to every week
                      </Text>
                    </View>
                    <Stepper
                      value={slot.capacity}
                      min={5}
                      max={80}
                      label="spots"
                      onChange={(v) => setSlotCapacity(slot.id, v)}
                    />
                  </View>
                  <View style={{ paddingHorizontal: 14, paddingBottom: 6 }}>
                    <Button
                      title="Remove this slot"
                      variant="ghost"
                      size="sm"
                      onPress={() =>
                        confirm({
                          title: `Remove the ${fmtTimeRange(slot.start, slot.end)} slot?`,
                          message: 'It disappears from the timetable for every day.',
                          confirmText: 'Remove',
                          destructive: true,
                          onConfirm: () => {
                            const r = removeSlot(slot.id);
                            if (r.ok) toast.success(r.message ?? 'Removed.');
                            else toast.error(r.message);
                          },
                        })
                      }
                    />
                  </View>
                  {!dayClosed ? (
                    <ToggleRow
                      title={`Closed on ${fmtDay(date)}`}
                      subtitle="Cancels bookings and tells those members"
                      value={!!st.closure}
                      onChange={() => toggleClosure(date, slot.id, 'Closed by the gym')}
                    />
                  ) : null}
                  {!st.closure ? (
                    <View style={{ gap: 10, paddingHorizontal: 14, paddingBottom: 14 }}>
                      <Text variant="smallStrong" tone="soft">
                        Booked ({people.length})
                      </Text>
                      {people.length ? (
                        <View style={s.people}>
                          {people.slice(0, 16).map((id) => {
                            const isIn = st.started && checkedIn.has(id);
                            return (
                              <Pressable key={id} onPress={() => router.push(`/manage/member/${id}`)} style={s.person}>
                                <Avatar name={nameOf(id)} size={30} />
                                <Text variant="small" numberOfLines={1} style={{ flex: 1 }}>
                                  {nameOf(id)}
                                </Text>
                                {isIn ? <Icon name="checkmark-circle" size={16} color={c.success.solid} /> : null}
                              </Pressable>
                            );
                          })}
                        </View>
                      ) : (
                        <Text variant="small" tone="faint">
                          No bookings yet.
                        </Text>
                      )}
                      {people.length > 16 ? (
                        <Text variant="caption" tone="soft">
                          and {people.length - 16} more
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              ) : null}
            </Card>
          );
        })}
      </View>
      {gym.slots.length > 0 ? <Button title="Add a slot" icon="add" variant="outline" full style={{ marginTop: 16 }} onPress={() => setAdding(true)} /> : null}

      <Sheet visible={adding} onClose={() => setAdding(false)} title="Add a slot" subtitle="Members can book it from the next day it runs." footer={<Button title="Add slot" full disabled={!formOk} onPress={submitSlot} />}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Input label="Starts" value={start} onChangeText={setStart} placeholder="06:00" maxLength={5} keyboardType="numbers-and-punctuation" />
          </View>
          <View style={{ flex: 1 }}>
            <Input label="Ends" value={end} onChangeText={setEnd} placeholder="07:00" maxLength={5} keyboardType="numbers-and-punctuation" />
          </View>
          <View style={{ flex: 1 }}>
            <Input label="Spots" value={spots} onChangeText={(v) => setSpots(v.replace(/\D/g, '').slice(0, 3))} keyboardType="number-pad" />
          </View>
        </View>
        <Text variant="caption" tone="soft">
          Use 24-hour times, like 18:30 for 6:30 pm.
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {WEEKDAYS_SHORT.map((d, i) => (
            <Chip key={d} label={d} selected={weekdays.includes(i)} onPress={() => setWeekdays((cur) => (cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i]))} />
          ))}
        </View>
      </Sheet>
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  summary: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18, marginBottom: 10 },
  slotHead: { padding: 14, gap: 10 },
  body: { gap: 0 },
  capRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  people: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 10 },
  person: { width: '50%', flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 8 },
}));
