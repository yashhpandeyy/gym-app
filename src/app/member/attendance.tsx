import { useState } from 'react';
import { View } from 'react-native';

import { MonthGrid } from '@/components/Calendar';
import { Card, Fact, Group, Row, Screen, SectionHeader, Stepper, Text } from '@/components/ui';
import { addMonths, fmtTime, parts, plural, type ISODate } from '@/lib/date';
import { isPausedOn, visitStats } from '@/lib/domain';
import { useNow } from '@/lib/hooks';
import { useApp, useMe } from '@/store';
import { makeStyles, useTheme } from '@/theme';

export default function Attendance() {
  const { c } = useTheme();
  const s = useStyles();
  const now = useNow(60_000);
  const me = useMe();
  const checkins = useApp((st) => st.checkins);
  const pauses = useApp((st) => st.pauses);
  const updateMe = useApp((st) => st.updateMe);
  const [month, setMonth] = useState<ISODate>(now.date);
  if (!me) return null;

  const stats = visitStats(checkins, me.id, me.weeklyGoal, now.date, (d) => isPausedOn(me.id, d, pauses));
  const visited = new Set(stats.dates);
  const monthVisits = stats.dates.filter((d) => d.slice(0, 7) === month.slice(0, 7)).length;

  return (
    <Screen header="stack" title="Attendance">
      <Card style={s.facts}>
        <Fact label="This month" value={String(stats.thisMonth)} />
        <Fact label="Per week" value={stats.avgPerWeek.toFixed(1)} />
        <Fact label="Streak" value={plural(stats.streak, 'week')} />
        <Fact label="Usual time" value={stats.favHour !== undefined ? fmtTime(`${String(stats.favHour).padStart(2, '0')}:00`) : '–'} />
      </Card>

      <Card style={{ marginTop: 12 }}>
        <MonthGrid
          month={month}
          onMonthChange={setMonth}
          minMonth={addMonths(now.date, -6)}
          maxMonth={now.date}
          renderDay={(d) => {
            const went = visited.has(d);
            const paused = isPausedOn(me.id, d, pauses);
            const isToday = d === now.date;
            return (
              <View
                style={[
                  s.day,
                  went && { backgroundColor: c.primary },
                  !went && paused && { backgroundColor: c.ice.bg },
                  !went && isToday && { borderWidth: 1.5, borderColor: c.lineStrong },
                ]}>
                <Text variant="smallStrong" color={went ? c.onPrimary : d > now.date ? c.inkFaint : paused ? c.ice.fg : c.ink}>
                  {parts(d).d}
                </Text>
              </View>
            );
          }}
        />
        <View style={s.legend}>
          <Legend color={c.primary} label={`${plural(monthVisits, 'visit')} this month`} />
          <Legend color={c.ice.bg} label="Paused" />
        </View>
      </Card>

      <SectionHeader title="Weekly goal" hint="Your streak grows each week you hit it." />
      <Group inset={16}>
        <Row
          title="Visits a week"
          chevron={false}
          right={<Stepper value={me.weeklyGoal} min={1} max={7} onChange={(v) => updateMe({ weeklyGoal: v })} label="weekly goal" />}
        />
      </Group>
    </Screen>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: color }} />
      <Text variant="caption" tone="soft">
        {label}
      </Text>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  facts: { flexDirection: 'row', justifyContent: 'space-between' },
  day: { width: '82%', aspectRatio: 1, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  legend: { flexDirection: 'row', gap: 18, marginTop: 12 },
}));
