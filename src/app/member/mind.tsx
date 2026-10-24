import { router } from 'expo-router';
import { View } from 'react-native';

import { Bouncy } from '@/components/fun/Motion';
import { Card, Fact, Icon, Pill, Screen, SectionHeader, Text, type IconName } from '@/components/ui';
import { MIND_PROGRAMS, type MindProgram } from '@/data/mind';
import { useNow } from '@/lib/hooks';
import { useApp, useMe } from '@/store';
import { makeStyles, useTheme } from '@/theme';

const KIND_ICON: Record<MindProgram['kind'], IconName> = {
  Focus: 'locate-outline',
  Recovery: 'heart-outline',
  Sleep: 'moon-outline',
  Stress: 'leaf-outline',
};

export default function Mind() {
  const { c } = useTheme();
  const s = useStyles();
  const now = useNow(60_000);
  const me = useMe();
  const log = useApp((st) => st.mindLog);
  if (!me) return null;
  const mine = log.filter((x) => x.memberId === me.id);
  const month = mine.filter((x) => x.at.slice(0, 7) === now.date.slice(0, 7));

  return (
    <Screen header="stack" title="Breathe">
      <Text tone="soft">
        Short guided breathing for before a lift, after training and before sleep. Recovery is when you actually get stronger.
      </Text>
      <Card style={s.stats}>
        <Fact label="Minutes this month" value={String(month.reduce((sum, x) => sum + x.minutes, 0))} />
        <Fact label="Sessions" value={String(month.length)} />
        <Fact label="All time" value={`${mine.reduce((sum, x) => sum + x.minutes, 0)} min`} />
      </Card>

      <SectionHeader title="Sessions" />
      <View style={{ gap: 10 }}>
        {MIND_PROGRAMS.map((p) => (
          <Bouncy key={p.id} onPress={() => router.push({ pathname: '/member/breathe/[id]', params: { id: p.id } })} accessibilityLabel={`${p.title}, ${p.minutes} minutes`}>
            <Card style={s.row}>
              <View style={[s.icon, { backgroundColor: c.ice.bg }]}>
                <Icon name={KIND_ICON[p.kind]} size={24} color={c.ice.fg} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text variant="label">{p.title}</Text>
                  <Pill label={`${p.minutes} min`} tone="ice" />
                </View>
                <Text variant="caption" tone="soft">
                  {p.when}. {p.about}
                </Text>
              </View>
              <Icon name="play-circle" size={30} tone="primary" />
            </Card>
          </Bouncy>
        ))}
      </View>
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  stats: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
}));
