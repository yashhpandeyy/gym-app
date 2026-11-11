import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { DateStrip } from '@/components/DateStrip';
import { SpotMeter } from '@/components/Meters';
import { Avatar, Button, Card, Chip, Divider, Empty, Icon, Input, Pill, Screen, Sheet, Stepper, Text, ToggleRow, toast } from '@/components/ui';
import { addDays, fmtDay, fmtTime, fmtTimeRange, parseClock, stampToDate, weekday, WEEKDAYS_LONG, WEEKDAYS_SHORT, type ISODate } from '@/lib/date';
import { slotsOn, slotState } from '@/lib/domain';
import { useGym, useNow } from '@/lib/hooks';
import { confirm, haptic } from '@/lib/native';
import { useApp, type Slot } from '@/store';
import { makeStyles, useTheme } from '@/theme';

export default function Slots() {
  const { c } = useTheme();
  const s = useStyles();
  const now = useNow();
  const gym = useGym();
  const setSlotCapacity = useApp((st) => st.setSlotCapacity);
  const toggleClosure = useApp((st) => st.toggleClosure);
  const addSlot = useApp((st) => st.addSlot);
  const updateSlot = useApp((st) => st.updateSlot);
  const removeSlot = useApp((st) => st.removeSlot);
  const days = Array.from({ length: 14 }, (_, i) => addDays(now.date, i));
  const [date, setDate] = useState<ISODate>(now.date);
  const [open, setOpen] = useState<string | null>(null);
  // The sheet adds a slot, or edits the one whose id it holds.
  const [form, setForm] = useState<string | null>(null);
  const [start, setStart] = useState('6:00 am');
  const [end, setEnd] = useState('7:00 am');
  const [spots, setSpots] = useState('12');
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [formError, setFormError] = useState<string>();

  const openForm = (slot?: Slot) => {
    setStart(fmtTime(slot?.start ?? '06:00'));
    setEnd(fmtTime(slot?.end ?? '07:00'));
    setSpots(String(slot?.capacity ?? 12));
    setWeekdays(slot?.days ?? [1, 2, 3, 4, 5, 6]);
    setFormError(undefined);
    setForm(slot?.id ?? 'new');
  };
  const startAt = parseClock(start);
  const endAt = parseClock(end);
  // An end typed without am or pm that falls before the start, like 6 to 7:30 in the evening, means pm.
  const endFixed =
    startAt && endAt && endAt <= startAt && Number(endAt.slice(0, 2)) < 12 && !/[ap]/i.test(end) ? `${String(Number(endAt.slice(0, 2)) + 12).padStart(2, '0')}${endAt.slice(2)}` : endAt;
  const submitSlot = () => {
    const capacity = Number(spots);
    let error: string | undefined;
    if (!startAt) error = 'Enter when the slot starts, like 6, 6:30 or 6:30 pm.';
    else if (!endFixed) error = 'Enter when the slot ends, like 7, 7:30 or 7:30 pm.';
    else if (endFixed <= startAt) error = `The slot has to end after it starts (${fmtTime(startAt)}).`;
    else if (!(capacity >= 1)) error = 'Enter how many people fit, at least 1.';
    else if (weekdays.length === 0) error = 'Pick at least one day it runs.';
    if (error || !startAt || !endFixed) return setFormError(error);
    const input = { start: startAt, end: endFixed, capacity, days: weekdays };
    const r = form && form !== 'new' ? updateSlot(form, input) : addSlot(input);
    if (!r.ok) return setFormError(r.message);
    const sorted = [...weekdays].sort();
    const runs = sorted.length === 7 ? 'every day' : sorted.join() === '1,2,3,4,5,6' ? 'Monday to Saturday' : sorted.map((d) => WEEKDAYS_SHORT[d]).join(', ');
    // Show the slot straight away: if it doesn't run on the day being looked at, move to the next day it does.
    if (!weekdays.includes(weekday(date))) {
      const next = days.find((d) => weekdays.includes(weekday(d)));
      if (next) setDate(next);
    }
    toast.success(`${r.message ?? 'Saved.'} ${fmtTimeRange(startAt, endFixed)}, ${runs}.`);
    setForm(null);
  };
  const toggleDay = (i: number) => {
    setFormError(undefined);
    setWeekdays((cur) => (cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i]));
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
        <Empty icon="time-outline" title="No slots yet" body="Add the times your gym is open for training and how many people fit in each. Members book from these." action="Add your first slot" onAction={() => openForm()} />
      ) : slots.length === 0 ? (
        <Card variant="soft" style={{ gap: 4, marginTop: 6 }}>
          <Text variant="label">No slots on {WEEKDAYS_LONG[weekday(date)]}s</Text>
          <Text variant="small" tone="soft">
            Your {gym.slots.length === 1 ? 'slot runs' : `${gym.slots.length} slots run`} on other days. Pick another day above, or add a slot for {WEEKDAYS_LONG[weekday(date)]}s.
          </Text>
        </Card>
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
                      min={1}
                      max={500}
                      label="spots"
                      onChange={(v) => setSlotCapacity(slot.id, v)}
                    />
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 14, paddingBottom: 6 }}>
                    <Button title="Edit times and days" variant="soft" size="sm" icon="create-outline" onPress={() => openForm(slot)} />
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
      {gym.slots.length > 0 ? <Button title="Add a slot" icon="add" variant="outline" full style={{ marginTop: 16 }} onPress={() => openForm()} /> : null}

      <Sheet
        visible={form !== null}
        onClose={() => setForm(null)}
        title={form === 'new' ? 'Add a slot' : 'Edit slot'}
        subtitle={form === 'new' ? 'Members can book it from the next day it runs.' : 'Changes apply to every week. Existing bookings stay.'}
        footer={
          <>
            {formError ? (
              <Text variant="small" tone="danger">
                {formError}
              </Text>
            ) : null}
            <Button title={form === 'new' ? 'Add slot' : 'Save slot'} full onPress={submitSlot} />
          </>
        }>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1.2 }}>
            <Input
              label="Starts"
              value={start}
              onChangeText={(v) => {
                setStart(v);
                setFormError(undefined);
              }}
              onBlur={() => startAt && setStart(fmtTime(startAt))}
              placeholder="6:00 am"
              maxLength={9}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
              error={start.trim() && !startAt ? 'Not a time' : undefined}
            />
          </View>
          <View style={{ flex: 1.2 }}>
            <Input
              label="Ends"
              value={end}
              onChangeText={(v) => {
                setEnd(v);
                setFormError(undefined);
              }}
              onBlur={() => endFixed && setEnd(fmtTime(endFixed))}
              placeholder="7:00 am"
              maxLength={9}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
              error={end.trim() && !endAt ? 'Not a time' : undefined}
            />
          </View>
          <View style={{ flex: 0.8 }}>
            <Input
              label="Spots"
              placeholder="12"
              value={spots}
              onChangeText={(v) => {
                setSpots(v.replace(/\D/g, '').slice(0, 3));
                setFormError(undefined);
              }}
              keyboardType="number-pad"
            />
          </View>
        </View>
        <Text variant="caption" tone="soft">
          {startAt && endFixed && endFixed > startAt ? `${fmtTimeRange(startAt, endFixed)}. ` : ''}Type it any way: 6, 6:30, 18:30 or 6:30 pm.
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {WEEKDAYS_SHORT.map((d, i) => (
            <Chip key={d} label={d} selected={weekdays.includes(i)} onPress={() => toggleDay(i)} />
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
