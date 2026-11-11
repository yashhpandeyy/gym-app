import { View } from 'react-native';

import { LineChart } from '@/components/Charts';
import { CountUp } from '@/components/fun/Motion';
import { Card, ProgressBar, Ring, Text } from '@/components/ui';
import { fmtDate, fmtDay } from '@/lib/date';
import { fmtTestValue, testBand } from '@/lib/domain';
import type { TestResult } from '@/store';
import { useTheme, type Palette } from '@/theme';

/** Red to green as the score climbs, so progress reads at a glance. */
export function scoreColor(c: Palette, score: number) {
  if (score >= 75) return c.success.solid;
  if (score >= 50) return c.primary;
  if (score >= 30) return c.warning.solid;
  return c.danger.solid;
}

/** The big score ring, what it means, and how it moved since the last test. */
export function ScoreHero({ result, previous, animate }: { result: TestResult; previous?: TestResult; animate?: boolean }) {
  const { c } = useTheme();
  const band = testBand(result.score);
  const delta = previous ? result.score - previous.score : null;
  return (
    <Card style={{ alignItems: 'center', gap: 12, paddingVertical: 22 }}>
      <Ring size={200} stroke={16} value={result.score / 100} color={scoreColor(c, result.score)}>
        {animate ? <CountUp variant="hero" value={result.score} from={0} duration={1200} /> : <Text variant="hero">{result.score}</Text>}
        <Text variant="smallStrong" tone="soft">
          out of 100
        </Text>
      </Ring>
      <View style={{ alignItems: 'center', gap: 4 }}>
        <Text variant="h2">{band.label}</Text>
        <Text variant="small" tone="soft" align="center">
          {band.note}
        </Text>
      </View>
      {delta !== null ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: delta >= 0 ? c.success.bg : c.danger.bg, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
          <Text variant="smallStrong" tone={delta >= 0 ? 'success' : 'danger'}>
            {delta > 0 ? `Up ${delta}` : delta < 0 ? `Down ${-delta}` : 'Same score'} since {fmtDay(previous!.date)}
          </Text>
        </View>
      ) : (
        <Text variant="caption" tone="faint">
          Tested {fmtDate(result.date)}
          {result.by ? ` with ${result.by}` : ''}
        </Text>
      )}
    </Card>
  );
}

/** Each exercise as a bar: how close the result came to full marks, and the change since last time. */
export function ScoreLines({ result, previous }: { result: TestResult; previous?: TestResult }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 10 }}>
      {result.lines.map((l) => {
        const before = previous?.lines.find((p) => p.itemId === l.itemId);
        const better = before ? (l.better === 'lower' ? l.value < before.value : l.value > before.value) : false;
        const worse = before ? (l.better === 'lower' ? l.value > before.value : l.value < before.value) : false;
        return (
          <Card key={l.itemId} style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="label">{l.name}</Text>
                <Text variant="caption" tone="soft">
                  {fmtTestValue(l.measure, l.value)}
                  {l.target ? `, full marks at ${l.better === 'lower' ? 'under ' : ''}${fmtTestValue(l.measure, l.target)}` : ''}
                  {before ? `. Last time ${fmtTestValue(before.measure, before.value)}` : ''}
                </Text>
              </View>
              <Text variant="num" color={scoreColor(c, l.score)}>
                {l.score}
              </Text>
            </View>
            <ProgressBar value={l.score / 100} color={scoreColor(c, l.score)} />
            {better || worse ? (
              <Text variant="caption" tone={better ? 'success' : 'warning'}>
                {better ? 'Better than last time' : 'A little off last time'}
              </Text>
            ) : null}
          </Card>
        );
      })}
      {result.skipped?.length ? (
        <Text variant="caption" tone="faint">
          Skipped: {result.skipped.join(', ')}. Skipped exercises don’t count towards the score.
        </Text>
      ) : null}
    </View>
  );
}

/** The score after every test, oldest first. */
export function ScoreHistory({ history }: { history: TestResult[] }) {
  if (history.length < 2) return null;
  const first = history[0];
  const last = history[history.length - 1];
  return (
    <Card style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <Text variant="label">Every test</Text>
        <Text variant="caption" tone="soft">
          {first.score} on {fmtDay(first.date)}, {last.score} now
        </Text>
      </View>
      <LineChart values={history.map((h) => h.score)} height={120} />
    </Card>
  );
}
