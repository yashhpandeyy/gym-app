import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { addDays, fmtMonthYear, parts, today, type ISODate } from '@/lib/date';
import { haptic } from '@/lib/native';
import { makeStyles, useTheme } from '@/theme';

import { IconButton, Text } from './ui';

const HEAD = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function monthStart(iso: ISODate) {
  return `${iso.slice(0, 7)}-01`;
}

function shiftMonth(first: ISODate, n: number): ISODate {
  const { y, m } = parts(first);
  const d = new Date(Date.UTC(y, m + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

/** Monday-first month grid. Cells are rendered by the caller. */
export function MonthGrid({
  month,
  onMonthChange,
  minMonth,
  maxMonth,
  renderDay,
}: {
  month: ISODate;
  onMonthChange: (m: ISODate) => void;
  minMonth?: ISODate;
  maxMonth?: ISODate;
  renderDay: (date: ISODate) => ReactNode;
}) {
  const s = useStyles();
  const first = monthStart(month);
  const { y, m } = parts(first);
  const lead = (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const cells: (ISODate | null)[] = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => addDays(first, i))];
  while (cells.length % 7) cells.push(null);
  const canPrev = !minMonth || first > monthStart(minMonth);
  const canNext = !maxMonth || first < monthStart(maxMonth);

  return (
    <View>
      <View style={s.head}>
        <Text variant="h3" style={{ flex: 1 }}>
          {fmtMonthYear(first)}
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, opacity: 1 }}>
          <View style={{ opacity: canPrev ? 1 : 0.3 }}>
            <IconButton icon="chevron-back" label="Previous month" size={36} onPress={() => canPrev && onMonthChange(shiftMonth(first, -1))} />
          </View>
          <View style={{ opacity: canNext ? 1 : 0.3 }}>
            <IconButton icon="chevron-forward" label="Next month" size={36} onPress={() => canNext && onMonthChange(shiftMonth(first, 1))} />
          </View>
        </View>
      </View>
      <View style={s.week}>
        {HEAD.map((h, i) => (
          <Text key={i} variant="caption" tone="faint" style={s.weekCell}>
            {h}
          </Text>
        ))}
      </View>
      <View style={s.grid}>
        {cells.map((d, i) => (
          <View key={d ?? `x${i}`} style={s.cell}>
            {d ? renderDay(d) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

/** Pick a start and an end date. Tapping before the start moves the start. */
export function RangeCalendar({
  start,
  end,
  onChange,
  min,
  max,
  maxSpan,
  blocked,
}: {
  start: ISODate | null;
  end: ISODate | null;
  onChange: (start: ISODate | null, end: ISODate | null) => void;
  min: ISODate;
  max: ISODate;
  maxSpan?: number;
  blocked?: (d: ISODate) => boolean;
}) {
  const { c } = useTheme();
  const s = useStyles();
  const [month, setMonth] = useState(start ?? min);
  const t = today();
  const effMax = start && !end && maxSpan ? (addDays(start, maxSpan - 1) < max ? addDays(start, maxSpan - 1) : max) : max;

  const tap = (d: ISODate) => {
    haptic.tap();
    if (!start || end || d < start) onChange(d, null);
    else onChange(start, d);
  };

  return (
    <MonthGrid
      month={month}
      onMonthChange={setMonth}
      minMonth={min}
      maxMonth={max}
      renderDay={(d) => {
        const disabled = d < min || d > effMax || (blocked?.(d) ?? false);
        const isStart = d === start;
        const isEnd = d === end;
        const inRange = !!start && !!end && d > start && d < end;
        const edge = isStart || isEnd;
        const band = (inRange || (isStart && end && end !== start) || (isEnd && start !== end)) && !!end;
        return (
          <Pressable
            disabled={disabled}
            onPress={() => tap(d)}
            accessibilityRole="button"
            accessibilityState={{ disabled, selected: edge || inRange }}
            accessibilityLabel={d}
            style={s.dayPress}>
            {band ? (
              <View
                style={[
                  s.band,
                  { backgroundColor: c.primarySoft },
                  isStart && { left: '50%' },
                  isEnd && { right: '50%' },
                ]}
              />
            ) : null}
            <View
              style={[
                s.day,
                edge && { backgroundColor: c.primary },
                !edge && d === t && { borderWidth: 1.5, borderColor: c.lineStrong },
              ]}>
              <Text
                variant="label"
                color={edge ? c.onPrimary : disabled ? c.inkFaint : c.ink}
                style={disabled && !edge ? { opacity: 0.45 } : undefined}>
                {parts(d).d}
              </Text>
            </View>
          </Pressable>
        );
      }}
    />
  );
}

/** Single-date picker built on the same grid. */
export function DateCalendar({
  value,
  onChange,
  min,
  max,
}: {
  value: ISODate;
  onChange: (d: ISODate) => void;
  min?: ISODate;
  max?: ISODate;
}) {
  const { c } = useTheme();
  const s = useStyles();
  const [month, setMonth] = useState(value);
  return (
    <MonthGrid
      month={month}
      onMonthChange={setMonth}
      minMonth={min}
      maxMonth={max}
      renderDay={(d) => {
        const disabled = (!!min && d < min) || (!!max && d > max);
        const sel = d === value;
        return (
          <Pressable disabled={disabled} onPress={() => onChange(d)} style={s.dayPress} accessibilityLabel={d} accessibilityState={{ selected: sel, disabled }}>
            <View style={[s.day, sel && { backgroundColor: c.primary }]}>
              <Text variant="label" color={sel ? c.onPrimary : disabled ? c.inkFaint : c.ink}>
                {parts(d).d}
              </Text>
            </View>
          </Pressable>
        );
      }}
    />
  );
}

const useStyles = makeStyles(() => ({
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  week: { flexDirection: 'row', marginBottom: 4 },
  weekCell: { width: `${100 / 7}%`, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, padding: 1 },
  dayPress: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  band: { position: 'absolute', left: 0, right: 0, top: '12%', bottom: '12%' },
  day: { width: '80%', aspectRatio: 1, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
}));
