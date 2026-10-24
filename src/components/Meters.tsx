import { View } from 'react-native';

import type { CapacityLevel, CrowdLevel } from '@/lib/domain';
import { useTheme, type Palette } from '@/theme';

import { Text } from './ui';

export function levelColor(c: Palette, level: CapacityLevel) {
  return level === 'full' ? c.danger.solid : level === 'filling' ? c.warning.solid : c.success.solid;
}

/**
 * One tick per spot (up to 30), filled as people book. When the member holds a spot, their
 * tick is taller and drawn in ink, so it stays visible whatever the brand or status colour is.
 */
export function SpotMeter({
  count,
  capacity,
  level,
  mine,
  dim,
  height = 9,
}: {
  count: number;
  capacity: number;
  level: CapacityLevel;
  mine?: boolean;
  dim?: boolean;
  height?: number;
}) {
  const { c } = useTheme();
  const ticks = Math.max(1, Math.min(capacity, 30));
  const filled = capacity > 0 ? Math.round((count / capacity) * ticks) : 0;
  const color = dim ? c.lineStrong : levelColor(c, level);
  const you = mine && !dim ? Math.max(0, filled - 1) : -1;
  return (
    <View
      accessible
      accessibilityLabel={`${count} of ${capacity} spots booked${mine ? ', including you' : ''}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: ticks > 22 ? 2.5 : 3, height: mine ? height + 8 : height }}>
      {Array.from({ length: ticks }).map((_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            borderRadius: 2,
            height: i === you ? height + 8 : height,
            backgroundColor: i === you ? c.ink : i < filled ? color : c.line,
          }}
        />
      ))}
    </View>
  );
}

const CROWD_COPY: Record<CrowdLevel, string> = {
  Closed: 'Closed right now',
  Quiet: 'Quiet, plenty of free racks',
  Steady: 'Steady, a short wait for some kit',
  Busy: 'Busy, expect to share equipment',
  Packed: 'Packed, try a later slot',
};

/** Rising bars, like a signal meter: how full the floor is right now. */
export function CrowdMeter({ ratio, level, inside, closedNote }: { ratio: number; level: CrowdLevel; inside: number; closedNote?: string }) {
  const { c } = useTheme();
  const bars = 8;
  const lit = level === 'Closed' ? 0 : Math.max(1, Math.round(Math.min(1, ratio) * bars));
  const color =
    level === 'Packed' ? c.danger.solid : level === 'Busy' ? c.warning.solid : level === 'Closed' ? c.lineStrong : c.success.solid;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 40 }}>
        {Array.from({ length: bars }).map((_, i) => (
          <View
            key={i}
            style={{
              width: 7,
              height: 10 + i * 4.2,
              borderRadius: 2,
              backgroundColor: i < lit ? color : c.line,
            }}
          />
        ))}
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="h3">{level === 'Closed' ? 'Closed' : `${inside} inside`}</Text>
        <Text variant="small" tone="soft">
          {level === 'Closed' && closedNote ? closedNote : CROWD_COPY[level]}
        </Text>
      </View>
    </View>
  );
}
