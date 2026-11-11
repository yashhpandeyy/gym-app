import { View } from 'react-native';

import { addMonths, MONTHS_LONG, parts } from '@/lib/date';

import { IconButton, Text } from './ui';

export const monthLabel = (month: string) => `${MONTHS_LONG[parts(`${month}-01`).m]} ${month.slice(0, 4)}`;

/** Steps through months (YYYY-MM), never past `latest`. */
export function MonthSwitcher({ value, onChange, latest }: { value: string; onChange: (month: string) => void; latest: string }) {
  const step = (n: number) => onChange(addMonths(`${value}-01`, n).slice(0, 7));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
      <IconButton icon="chevron-back" label="Previous month" onPress={() => step(-1)} />
      <Text variant="h3" align="center" style={{ flex: 1 }} accessibilityLiveRegion="polite">
        {monthLabel(value)}
      </Text>
      {value < latest ? <IconButton icon="chevron-forward" label="Next month" onPress={() => step(1)} /> : <View style={{ width: 40 }} />}
    </View>
  );
}
