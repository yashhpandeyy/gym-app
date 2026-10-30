import { Pressable, ScrollView, View } from 'react-native';

import { parts, today, WEEKDAYS_SHORT, weekday, type ISODate } from '@/lib/date';
import { haptic } from '@/lib/native';
import { gutter, makeStyles, useTheme } from '@/theme';

import { Text } from './ui';

export function DateStrip({
  days,
  value,
  onChange,
  marked,
}: {
  days: ISODate[];
  value: ISODate;
  onChange: (d: ISODate) => void;
  marked?: Set<ISODate>;
}) {
  const { c } = useTheme();
  const s = useStyles();
  const t = today();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={s.scroll}
      contentContainerStyle={s.row}>
      {days.map((d) => {
        const selected = d === value;
        const fg = selected ? c.surface : c.ink;
        return (
          <Pressable
            key={d}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`${d === t ? 'Today' : WEEKDAYS_SHORT[weekday(d)]} ${parts(d).d}${marked?.has(d) ? ', you have a booking' : ''}`}
            onPress={() => {
              haptic.tap();
              onChange(d);
            }}
            style={({ pressed }) => [
              s.cell,
              { backgroundColor: selected ? c.ink : c.surface },
              pressed && !selected && { backgroundColor: c.surfaceAlt },
            ]}>
            <Text variant="caption" color={selected ? c.surface : c.inkSoft}>
              {d === t ? 'Today' : WEEKDAYS_SHORT[weekday(d)]}
            </Text>
            <Text variant="h2" color={fg}>
              {parts(d).d}
            </Text>
            <View style={[s.mark, { backgroundColor: marked?.has(d) ? (selected ? c.surface : c.primary) : 'transparent' }]} />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const useStyles = makeStyles((t) => ({
  scroll: { marginHorizontal: -gutter, flexGrow: 0, flexShrink: 0 },
  row: { paddingHorizontal: gutter, gap: 8 },
  cell: {
    width: 58,
    paddingTop: 9,
    paddingBottom: 7,
    borderRadius: t.radius.lg,
    alignItems: 'center',
    gap: 1,
  },
  mark: { width: 5, height: 5, borderRadius: 3, marginTop: 2 },
}));
