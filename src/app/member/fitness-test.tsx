import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { ScoreHero, ScoreHistory, ScoreLines } from '@/components/fitness/TestSummary';
import { Button, Card, Group, Row, Screen, SectionHeader, Sheet, Text } from '@/components/ui';
import { diffDays, fmtDate, plural } from '@/lib/date';
import { testHistory, testItems, testPrescription } from '@/lib/domain';
import { useNow } from '@/lib/hooks';
import { useApp, type TestResult } from '@/store';

export default function FitnessTest() {
  const now = useNow(60_000);
  const memberId = useApp((st) => st.session?.memberId);
  const results = useApp((st) => st.testResults);
  const settings = useApp((st) => st.settings);
  const [open, setOpen] = useState<TestResult | null>(null);
  if (!memberId) return null;

  const history = testHistory(results, memberId);
  const latest = history[history.length - 1];
  const previous = history[history.length - 2];
  const items = testItems(settings).filter((i) => i.active);
  const since = latest ? diffDays(latest.date, now.date) : 0;

  return (
    <Screen header="stack" title="Strength test">
      {latest ? (
        <View style={{ gap: 14 }}>
          <ScoreHero result={latest} previous={previous} />
          <ScoreHistory history={history} />
          <Button title={since >= 28 ? 'Time for a retest' : 'Take the test again'} icon="play" full onPress={() => router.push('/member/test-run')} />
          <Text variant="caption" tone="soft" align="center">
            {since === 0 ? 'Last tested today.' : `Last tested ${plural(since, 'day')} ago.`} Retesting every four to six weeks shows real change.
          </Text>
          <SectionHeader title="Your last test" />
          <ScoreLines result={latest} previous={previous} />
          {history.length > 1 ? (
            <>
              <SectionHeader title="Earlier tests" />
              <Group inset={16}>
                {history
                  .slice(0, -1)
                  .reverse()
                  .map((r) => (
                    <Row key={r.id} title={fmtDate(r.date)} subtitle={r.by ? `With ${r.by}` : undefined} value={`${r.score}`} onPress={() => setOpen(r)} />
                  ))}
              </Group>
            </>
          ) : null}
        </View>
      ) : (
        <View style={{ gap: 14 }}>
          <Card style={{ gap: 10 }}>
            <Text variant="h2">How strong and fit are you?</Text>
            <Text tone="soft">
              A short test of strength, endurance and flexibility set by your gym. The timer rings when each set is up, and you get a score out of 100 at the end. Take it again every few weeks to see yourself improve.
            </Text>
          </Card>
          <Group inset={16}>
            {items.map((i) => (
              <Row key={i.id} title={i.name} subtitle={testPrescription(i)} chevron={false} />
            ))}
          </Group>
          <Button title="Start the test" icon="play" full onPress={() => router.push('/member/test-run')} />
        </View>
      )}

      <Sheet visible={!!open} onClose={() => setOpen(null)} title={open ? `Test on ${fmtDate(open.date)}` : ''} subtitle={open ? `Score ${open.score} out of 100` : undefined}>
        {open ? <ScoreLines result={open} previous={history[history.findIndex((h) => h.id === open.id) - 1]} /> : null}
      </Sheet>
    </Screen>
  );
}
