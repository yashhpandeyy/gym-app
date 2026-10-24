import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';

import { Bouncy, XPBar } from '@/components/fun/Motion';
import { Card, Empty, Icon, Screen, SectionHeader, Text } from '@/components/ui';
import { fmtDay, fmtTime } from '@/lib/date';
import { fuelOnTrack } from '@/lib/game';
import { useNow } from '@/lib/hooks';
import { haptic } from '@/lib/native';
import { useApp, useMe } from '@/store';
import { makeStyles, useTheme } from '@/theme';

function Check({ on }: { on: boolean }) {
  const { c } = useTheme();
  const scale = useSharedValue(1);
  useEffect(() => {
    if (on) scale.value = withSequence(withSpring(1.3, { damping: 6, stiffness: 400 }), withSpring(1, { damping: 8 }));
  }, [on, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View
      style={[
        { width: 30, height: 30, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
        on ? { backgroundColor: c.success.solid, borderColor: c.success.solid } : { borderColor: c.lineStrong },
        style,
      ]}>
      {on ? <Icon name="checkmark" size={18} color="#FFFFFF" /> : null}
    </Animated.View>
  );
}

function Glass({ full, onPress, index }: { full: boolean; onPress: () => void; index: number }) {
  const { c } = useTheme();
  return (
    <Bouncy onPress={onPress} accessibilityLabel={`Glass ${index + 1}${full ? ', drunk' : ''}`} style={{ alignItems: 'center' }}>
      <Icon name={full ? 'water' : 'water-outline'} size={30} color={full ? c.ice.solid : c.lineStrong} />
    </Bouncy>
  );
}

export default function Diet() {
  const { c } = useTheme();
  const s = useStyles();
  const now = useNow(60_000);
  const me = useMe();
  const plans = useApp((st) => st.dietPlans);
  const mealLog = useApp((st) => st.mealLog);
  const water = useApp((st) => st.water);
  const trainers = useApp((st) => st.trainers);
  const toggleMeal = useApp((st) => st.toggleMeal);
  const setWater = useApp((st) => st.setWater);
  if (!me) return null;
  const plan = plans[me.id];

  if (!plan) {
    return (
      <Screen header="stack" title="Diet plan">
        <Empty
          icon="restaurant-outline"
          title="No diet plan yet"
          body="Ask a coach to set one up for your goal. It appears here with your meals for the day."
          action="Talk to a coach"
          onAction={() => router.push('/member/trainers')}
        />
      </Screen>
    );
  }

  const done = mealLog[me.id]?.[now.date] ?? [];
  const eaten = plan.meals.filter((m) => done.includes(m.id));
  const kcal = eaten.reduce((sum, m) => sum + m.kcal, 0);
  const protein = eaten.reduce((sum, m) => sum + m.protein, 0);
  const glasses = water[me.id]?.[now.date] ?? 0;
  const coach = trainers.find((t) => t.id === plan.coachId);
  const onTrack = fuelOnTrack(done, plan);

  return (
    <Screen header="stack" title="Diet plan">
      <Text variant="h2">{plan.title}</Text>
      <Text tone="soft" style={{ marginTop: 2 }}>
        {plan.goal} From {coach?.name ?? 'your coach'}, updated {fmtDay(plan.updatedOn)}.
      </Text>

      <Card style={{ gap: 14, marginTop: 16 }}>
        <View style={s.macroRow}>
          <View style={{ flex: 1, gap: 6 }}>
            <Text variant="caption" tone="soft">
              Calories today
            </Text>
            <Text variant="h3">
              {kcal} <Text variant="small" tone="soft">of {plan.kcal}</Text>
            </Text>
            <XPBar progress={kcal / plan.kcal} color={c.warning.solid} height={8} />
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <Text variant="caption" tone="soft">
              Protein today
            </Text>
            <Text variant="h3">
              {protein} g <Text variant="small" tone="soft">of {plan.protein} g</Text>
            </Text>
            <XPBar progress={protein / plan.protein} color={c.success.solid} height={8} />
          </View>
        </View>
        <Text variant="caption" tone={onTrack ? 'success' : 'soft'}>
          {onTrack ? 'On track today. This counts towards your Fuel ring.' : `Tick off ${Math.ceil(plan.meals.length * 0.75)} meals to count today towards your Fuel ring.`}
        </Text>
      </Card>

      <SectionHeader title="Water" hint={`${glasses} of ${plan.waterGlasses} glasses`} />
      <Card style={s.water}>
        {Array.from({ length: plan.waterGlasses }).map((_, i) => (
          <Glass
            key={i}
            index={i}
            full={i < glasses}
            onPress={() => {
              if (i < glasses) haptic.tap();
              else if (i + 1 >= plan.waterGlasses) haptic.success();
              else haptic.pop();
              setWater(now.date, i < glasses ? i : i + 1);
            }}
          />
        ))}
      </Card>

      <SectionHeader title="Today’s meals" hint="Tap a meal once you’ve had it." />
      <View style={{ gap: 10 }}>
        {plan.meals.map((m) => {
          const on = done.includes(m.id);
          return (
            <Pressable
              key={m.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              onPress={() => {
                if (on) haptic.tap();
                else haptic.success();
                toggleMeal(now.date, m.id);
              }}>
              <Card style={[s.meal, on && { opacity: 0.75 }]}>
                <Check on={on} />
                <View style={{ flex: 1, gap: 3 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <Text variant="label">{m.name}</Text>
                    <Text variant="caption" tone="soft">
                      {fmtTime(m.time)}
                    </Text>
                  </View>
                  {m.items.map((it) => (
                    <Text key={it} variant="small" tone="soft">
                      {it}
                    </Text>
                  ))}
                  <Text variant="caption" tone="faint">
                    {m.kcal} kcal, {m.protein} g protein
                  </Text>
                  {m.swap ? (
                    <Text variant="caption" tone="primary">
                      {m.swap}
                    </Text>
                  ) : null}
                </View>
              </Card>
            </Pressable>
          );
        })}
      </View>

      {plan.notes ? (
        <Card variant="soft" style={{ marginTop: 16, gap: 4 }}>
          <Text variant="smallStrong" tone="primary">
            Note from {coach?.name.split(' ')[0] ?? 'your coach'}
          </Text>
          <Text variant="small">{plan.notes}</Text>
        </Card>
      ) : null}

      <Text variant="caption" tone="faint" style={{ marginTop: 16 }}>
        Daily targets: {plan.kcal} kcal, {plan.protein} g protein, {plan.carbs} g carbs, {plan.fat} g fat. If you have a medical condition, check this plan with
        your doctor.
      </Text>
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  macroRow: { flexDirection: 'row', gap: 16 },
  water: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  meal: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
}));
