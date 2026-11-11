import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { DateStrip } from '@/components/DateStrip';
import { Card, Chip, Empty, Screen, Text } from '@/components/ui';
import { addDays, fmtLongDay, weekday } from '@/lib/date';
import { useIsOwner, useNow } from '@/lib/hooks';
import { useApp, type Mark } from '@/store';
import { makeStyles } from '@/theme';

const MARKS: { mark: Mark; label: string }[] = [
  { mark: 'P', label: 'Present' },
  { mark: 'H', label: 'Half day' },
  { mark: 'L', label: 'Leave' },
  { mark: 'A', label: 'Absent' },
];

/**
 * Who came in to work. Everyone counts as present unless marked otherwise, so the desk only taps the
 * exceptions. Salaries are worked out from this, but the desk never sees what anyone is paid.
 */
export default function Attendance() {
  const s = useStyles();
  const now = useNow(60_000);
  const owner = useIsOwner();
  const team = useApp((st) => st.team);
  const attendance = useApp((st) => st.attendance);
  const markAttendance = useApp((st) => st.markAttendance);
  const [date, setDate] = useState(now.date);

  // Today first, then the days before it, so the day the desk usually marks is never scrolled out of view.
  const days = Array.from({ length: 7 }, (_, i) => addDays(now.date, -i));
  const people = team.filter((t) => t.active && t.joinedOn <= date).sort((a, b) => a.name.localeCompare(b.name));
  const day = attendance[date] ?? {};
  const working = people.filter((t) => !t.offDays.includes(weekday(date)));
  const away = working.filter((t) => day[t.id] === 'A' || day[t.id] === 'L').length;

  return (
    <Screen header="stack" title="Staff attendance" subtitle="Everyone counts as present, so mark only who wasn’t. Leave is paid, absent isn’t.">
      <DateStrip days={days} value={date} onChange={setDate} />
      {people.length ? (
        <>
          <Text variant="small" tone="soft" style={{ marginTop: 14, marginBottom: 10 }}>
            {fmtLongDay(date)}: {working.length - away} of {working.length} in
          </Text>
          <View style={{ gap: 10 }}>
            {people.map((t) => {
              const off = t.offDays.includes(weekday(date));
              const mark = day[t.id] ?? 'P';
              return (
                <Card key={t.id} style={{ gap: 10, opacity: off ? 0.7 : 1 }}>
                  <View style={s.head}>
                    <Text variant="label" style={{ flex: 1 }} numberOfLines={1}>
                      {t.name}
                    </Text>
                    <Text variant="small" tone="soft">
                      {off ? 'Weekly day off' : t.role}
                    </Text>
                  </View>
                  {!off ? (
                    <View style={s.chips}>
                      {MARKS.map((m) => (
                        <Chip key={m.mark} label={m.label} selected={mark === m.mark} onPress={() => markAttendance(date, t.id, m.mark)} />
                      ))}
                    </View>
                  ) : null}
                </Card>
              );
            })}
          </View>
        </>
      ) : (
        <Empty
          icon="people-outline"
          title="No staff added yet"
          body={owner ? 'Add your coaches and desk staff with their pay, then mark attendance here.' : 'The owner adds staff. Once they do, you can mark attendance here.'}
          action={owner ? 'Add staff' : undefined}
          onAction={owner ? () => router.push('/manage/payroll') : undefined}
        />
      )}
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
}));
