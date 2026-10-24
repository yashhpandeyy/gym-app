import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { useTheme } from '@/theme';

import { Text } from './ui';

/** Vertical bars with the highlighted bar labelled. Used for monthly revenue. */
export function BarChart({
  data,
  height = 140,
  format,
}: {
  data: { label: string; value: number; highlight?: boolean }[];
  height?: number;
  format: (v: number) => string;
}) {
  const { c } = useTheme();
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <View accessible accessibilityLabel={data.map((d) => `${d.label} ${format(d.value)}`).join(', ')}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, height }}>
        {data.map((d) => {
          const h = Math.max(4, (d.value / max) * (height - 26));
          return (
            <View key={d.label} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
              {d.highlight ? (
                <Text variant="caption" tone="primary" numberOfLines={1}>
                  {format(d.value)}
                </Text>
              ) : null}
              <View
                style={{
                  width: '100%',
                  height: h,
                  borderRadius: 6,
                  backgroundColor: d.highlight ? c.primary : c.primaryLine,
                }}
              />
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
        {data.map((d) => (
          <Text key={d.label} variant="caption" tone={d.highlight ? 'ink' : 'faint'} align="center" style={{ flex: 1 }}>
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

/** Line with dots for weight-style trends. Y range pads 10% so small changes still show. */
export function LineChart({
  values,
  height = 150,
  goal,
}: {
  values: number[];
  height?: number;
  goal?: number;
}) {
  const { c } = useTheme();
  const [w, setW] = useState(0);
  const all = goal !== undefined ? [...values, goal] : values;
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const pad = Math.max(0.5, (hi - lo) * 0.12);
  const min = lo - pad;
  const max = hi + pad;
  const x = (i: number) => (values.length <= 1 ? w / 2 : 8 + (i / (values.length - 1)) * (w - 16));
  const y = (v: number) => 8 + (1 - (v - min) / (max - min)) * (height - 16);
  const d = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <View style={{ height }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 && values.length > 0 ? (
        <Svg width={w} height={height}>
          {goal !== undefined ? (
            <Line x1={0} x2={w} y1={y(goal)} y2={y(goal)} stroke={c.success.solid} strokeWidth={1.5} strokeDasharray="5 5" />
          ) : null}
          <Path d={d} stroke={c.primary} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          {values.map((v, i) => (
            <Circle
              key={i}
              cx={x(i)}
              cy={y(v)}
              r={i === values.length - 1 ? 5 : 2.5}
              fill={i === values.length - 1 ? c.primary : c.surface}
              stroke={c.primary}
              strokeWidth={i === values.length - 1 ? 0 : 1.5}
            />
          ))}
        </Svg>
      ) : null}
    </View>
  );
}

/** Hour-by-hour load for a day, with the current hour marked. */
export function HourBars({ data, nowHour }: { data: { hour: number; ratio: number }[]; nowHour?: number }) {
  const { c } = useTheme();
  if (!data.length) return null;
  const labelAt = new Set(data.filter((d) => d.hour % 3 === 0).map((d) => d.hour));
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 64 }}>
        {data.map((d) => {
          const now = d.hour === nowHour;
          return (
            <View
              key={d.hour}
              style={{
                flex: 1,
                height: Math.max(4, d.ratio * 64),
                borderRadius: 3,
                backgroundColor: now ? c.primary : c.primaryLine,
              }}
            />
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', gap: 3, marginTop: 6 }}>
        {data.map((d) => (
          <View key={d.hour} style={{ flex: 1, alignItems: 'center', overflow: 'visible' }}>
            {labelAt.has(d.hour) ? (
              <Text variant="micro" tone={d.hour === nowHour ? 'ink' : 'faint'} align="center" style={{ width: 32 }}>
                {`${d.hour % 12 === 0 ? 12 : d.hour % 12}${d.hour < 12 ? 'am' : 'pm'}`}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}
