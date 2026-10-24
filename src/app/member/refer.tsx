import { View } from 'react-native';

import { PlateRings } from '@/components/Brand';
import { Button, Empty, Group, Row, Screen, SectionHeader, Text } from '@/components/ui';
import { fmtDate } from '@/lib/date';
import { firstName } from '@/lib/format';
import { share } from '@/lib/native';
import { useApp, useMe } from '@/store';
import { makeStyles, useTheme } from '@/theme';

export default function Refer() {
  const { c, brand, alpha } = useTheme();
  const s = useStyles();
  const me = useMe();
  const members = useApp((st) => st.members);
  if (!me) return null;

  const code = `${firstName(me.name).toUpperCase()}${me.code.split('-')[1] ?? ''}`;
  const joined = members.filter((m) => m.referredBy === me.id);
  const message = `I train at ${brand.name}. Join with my code ${code} and ${brand.referral.reward.charAt(0).toLowerCase()}${brand.referral.reward.slice(1)}`;

  const steps = [
    'Share your code with a friend.',
    `They give the code at the ${brand.shortName} desk when they join.`,
    'Once they’ve paid, the gym adds the reward to both memberships.',
  ];

  return (
    <Screen header="stack" title="Refer a friend">
      <View style={[s.card, { backgroundColor: c.primary }]}>
        <PlateRings size={220} color={alpha(c.onPrimary, 0.1)} style={{ right: -70, top: -60 }} />
        <Text variant="smallStrong" color={alpha(c.onPrimary, 0.85)}>
          Your code
        </Text>
        <Text variant="display" color={c.onPrimary} selectable style={{ letterSpacing: 1 }}>
          {code}
        </Text>
        <Text variant="small" color={alpha(c.onPrimary, 0.85)}>
          {brand.referral.reward}
        </Text>
        <Button title="Share invite" icon="share-social-outline" variant="onPrimary" onPress={() => share(message)} style={{ marginTop: 8 }} />
      </View>

      <SectionHeader title="How it works" />
      <View style={{ gap: 14 }}>
        {steps.map((step, i) => (
          <View key={step} style={s.step}>
            <View style={[s.num, { backgroundColor: c.primarySoft }]}>
              <Text variant="label" tone="primary">
                {i + 1}
              </Text>
            </View>
            <Text variant="body" style={{ flex: 1 }}>
              {step}
            </Text>
          </View>
        ))}
      </View>

      <SectionHeader title="Friends who joined" />
      {joined.length ? (
        <Group inset={16}>
          {joined.map((m) => (
            <Row key={m.id} title={m.name} value={fmtDate(m.joinedOn)} />
          ))}
        </Group>
      ) : (
        <Empty icon="people-outline" title="No one yet" body="When a friend joins with your code, they show up here and your extra days are added." />
      )}
    </Screen>
  );
}

const useStyles = makeStyles((t) => ({
  card: { borderRadius: t.radius.xl, padding: 20, gap: 6, overflow: 'hidden' },
  step: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  num: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
}));
