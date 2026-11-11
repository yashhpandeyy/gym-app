import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';

import { Icon, Text, type IconName } from '@/components/ui';
import type { Highlight } from '@/lib/spotlight';
import { gutter, makeStyles, useTheme, type Palette } from '@/theme';
import { stagger } from '@/theme/motion';

import { Sheen, TiltCard } from './Effects';
import { CountUp, PopIn } from './Motion';

const CARD_W = 236;

type Look = { colors: [string, string]; ink: string; soft: string; medal: string; medalInk: string };

function lookFor(h: Highlight, c: Palette, mix: (a: string, b: string, n: number) => string): Look {
  if (h.kind === 'rank' && h.rank === 1) return { colors: ['#FFE07A', '#F2A93B'], ink: '#3A2600', soft: 'rgba(58,38,0,0.72)', medal: '#FFF4CC', medalInk: '#8A5A00' };
  if (h.kind === 'rank' && h.rank === 2) return { colors: ['#EEF2F7', '#B3BDCB'], ink: '#1B2330', soft: 'rgba(27,35,48,0.7)', medal: '#FFFFFF', medalInk: '#4A5568' };
  if (h.kind === 'rank' && h.rank === 3) return { colors: ['#F6C08F', '#C9773B'], ink: '#3A1D05', soft: 'rgba(58,29,5,0.72)', medal: '#FFE6CF', medalInk: '#8A4614' };
  if (h.kind === 'improved') return { colors: [c.success.solid, mix(c.success.solid, '#000000', 0.3)], ink: '#FFFFFF', soft: 'rgba(255,255,255,0.82)', medal: 'rgba(255,255,255,0.22)', medalInk: '#FFFFFF' };
  if (h.kind === 'top') return { colors: [c.primary, c.primaryDeep], ink: c.onPrimary, soft: c.onPrimary === '#FFFFFF' ? 'rgba(255,255,255,0.82)' : 'rgba(18,22,32,0.72)', medal: 'rgba(255,255,255,0.2)', medalInk: c.onPrimary };
  return { colors: [c.surface, c.surface], ink: c.ink, soft: c.inkSoft, medal: c.primarySoft, medalInk: c.primaryInk };
}

/** The member's wins, front and centre on Home. Only good news lives here. */
export function StrengthSpotlight({ highlights }: { highlights: Highlight[] }) {
  const { c, mix } = useTheme();
  const s = useStyles();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={CARD_W + 12}
      decelerationRate="fast"
      style={s.scroll}
      contentContainerStyle={s.row}>
      {highlights.map((h, i) => {
        const look = lookFor(h, c, mix);
        const medal = h.kind === 'rank' || h.kind === 'improved';
        return (
          <Animated.View key={h.id} entering={FadeInRight.delay(i * stagger).springify().damping(15)}>
            <TiltCard
              accessibilityLabel={`${h.title}, ${h.where}. ${h.value}`}
              onPress={() => router.push({ pathname: '/member/leaderboards', params: { board: h.board, scope: h.scope } })}
              style={[s.card, h.kind === 'best' && { borderWidth: 1.5, borderColor: c.line }]}>
              <LinearGradient colors={look.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.fill} />
              {h.kind !== 'best' ? <Sheen every={5200} delay={900 + i * 400} opacity={h.rank === 2 ? 0.55 : 0.4} /> : null}
              <View style={s.top}>
                <PopIn delay={200 + i * stagger}>
                  <View style={[s.medal, { backgroundColor: look.medal }]}>
                    {medal && h.rank ? (
                      h.kind === 'improved' ? (
                        <Icon name="trending-up" size={26} color={look.medalInk} />
                      ) : (
                        <CountUp
                          value={h.rank}
                          from={Math.min(h.of ?? h.rank + 9, h.rank + 9)}
                          duration={1100}
                          variant="h2"
                          color={look.medalInk}
                          format={(n) => `${n}`}
                          key={`${h.id}-${h.rank}`}
                        />
                      )
                    ) : (
                      <Icon name={h.icon as IconName} size={24} color={look.medalInk} />
                    )}
                  </View>
                </PopIn>
                <View style={[s.where, { backgroundColor: h.kind === 'best' ? c.surfaceAlt : 'rgba(255,255,255,0.28)' }]}>
                  <Icon name={(h.scope === 'slot' ? 'people' : 'business') as IconName} size={11} color={look.ink} />
                  <Text variant="micro" color={look.ink}>
                    {h.kind === 'best' ? 'Personal' : h.scope === 'slot' ? 'Your crew' : 'Whole gym'}
                  </Text>
                </View>
              </View>
              <Text variant="h3" color={look.ink} numberOfLines={2} style={s.title}>
                {h.title}
              </Text>
              <Text variant="caption" color={look.soft} numberOfLines={1}>
                {h.where}
              </Text>
              <Text variant="smallStrong" color={look.ink} numberOfLines={2} style={{ marginTop: 'auto' }}>
                {h.value}
              </Text>
            </TiltCard>
          </Animated.View>
        );
      })}
    </ScrollView>
  );
}

const useStyles = makeStyles((t) => ({
  scroll: { marginHorizontal: -gutter, flexGrow: 0, flexShrink: 0 },
  row: { paddingHorizontal: gutter, gap: 12, paddingVertical: 4 },
  card: { width: CARD_W, height: 196, borderRadius: t.radius.xl, padding: 16, overflow: 'hidden', gap: 4 },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  medal: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  where: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, height: 22, borderRadius: 11 },
  title: { marginTop: 2 },
}));
