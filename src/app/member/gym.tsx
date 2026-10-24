import { View } from 'react-native';

import { Logo } from '@/components/Brand';
import { Button, Card, Group, Pill, Row, Screen, SectionHeader, Text } from '@/components/ui';
import { fmtTime, weekday } from '@/lib/date';
import { useNow } from '@/lib/hooks';
import { call, openInstagram, openMaps } from '@/lib/native';
import { useApp } from '@/store';
import { makeStyles, useTheme } from '@/theme';

export default function GymInfo() {
  const { brand } = useTheme();
  const s = useStyles();
  const now = useNow(60_000);
  const settings = useApp((st) => st.settings);
  const wd = weekday(now.date);

  return (
    <Screen header="stack" title="Timings and address">
      <View style={s.head}>
        <Logo size={56} />
        <View style={{ flex: 1 }}>
          <Text variant="h2">{brand.name}</Text>
          <Text variant="small" tone="soft">
            {brand.tagline}
          </Text>
        </View>
      </View>

      <Card style={{ gap: 12 }}>
        <View style={{ gap: 2 }}>
          <Text variant="label">{brand.address.line1}</Text>
          <Text variant="small" tone="soft">
            {brand.address.line2}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button title="Directions" icon="navigate-outline" size="md" onPress={() => openMaps(brand.address.mapsQuery)} />
          <Button title="Call" icon="call-outline" size="md" variant="outline" onPress={() => call(brand.contact.phone)} />
        </View>
      </Card>

      <SectionHeader title="Opening hours" />
      <Group inset={16}>
        {brand.hours.map((h) => (
          <Row
            key={h.label}
            title={h.label}
            subtitle={h.days.includes(wd) ? 'Today' : undefined}
            value={`${fmtTime(h.open)} – ${fmtTime(h.close)}`}
            valueTone={h.days.includes(wd) ? 'primary' : 'soft'}
          />
        ))}
      </Group>

      <SectionHeader title="What’s here" />
      <View style={s.amenities}>
        {brand.amenities.map((a) => (
          <Pill key={a} label={a} style={{ height: 30, paddingHorizontal: 12 }} />
        ))}
      </View>

      <SectionHeader title="House rules" />
      <Group inset={16}>
        <Row title="Booking" subtitle={`Book up to ${settings.bookingWindowDays} days ahead, ${settings.maxBookingsPerDay} gym slot a day.`} />
        <Row title="Cancelling" subtitle={`Free up to ${settings.cancelCutoffMinutes} minutes before your slot.`} />
        <Row
          title="Pausing"
          subtitle={`At least ${settings.minPauseDays} days at a time${settings.pauseNoticeDays ? `, with ${settings.pauseNoticeDays === 1 ? '1 day’s' : `${settings.pauseNoticeDays} days’`} notice` : ''}.`}
        />
        <Row title="On the floor" subtitle="Re-rack your weights, wipe down benches and wear clean shoes." />
      </Group>

      {brand.contact.instagram ? (
        <Group style={{ marginTop: 24 }}>
          <Row icon="logo-instagram" title={`@${brand.contact.instagram}`} subtitle="Workouts, events and offers" onPress={() => openInstagram(brand.contact.instagram)} />
        </Group>
      ) : null}
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  head: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  amenities: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
}));
