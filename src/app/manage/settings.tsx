import { View } from 'react-native';

import { Chip, Group, Row, Screen, SectionHeader, Stepper, Text, ToggleRow } from '@/components/ui';
import { fmtTime } from '@/lib/date';
import { useApp } from '@/store';
import { useTheme } from '@/theme';

export default function Settings() {
  const { brand } = useTheme();
  const settings = useApp((s) => s.settings);
  const update = useApp((s) => s.updateSettings);

  return (
    <Screen header="stack" title="Rules and settings" subtitle="These rules apply in the members’ app as soon as you change them.">
      <SectionHeader title="Slot booking" />
      <Group inset={16}>
        <Row
          title="Book ahead"
          subtitle="How many days members can see and book"
          chevron={false}
          right={<Stepper value={settings.bookingWindowDays} min={1} max={14} label="days ahead" format={(v) => `${v}d`} onChange={(v) => update({ bookingWindowDays: v })} />}
        />
        <Row
          title="Slots per day"
          subtitle="Gym floor bookings a member can hold on one day"
          chevron={false}
          right={<Stepper value={settings.maxBookingsPerDay} min={1} max={3} label="slots per day" onChange={(v) => update({ maxBookingsPerDay: v })} />}
        />
        <ToggleRow title="Waitlist for full slots" subtitle="Members are moved in automatically when a spot opens" value={settings.waitlist} onChange={(v) => update({ waitlist: v })} />
        <ToggleRow title="Booking required" subtitle="Members must book a slot before they come in" value={settings.requireBooking} onChange={(v) => update({ requireBooking: v })} />
      </Group>
      <Text variant="smallStrong" tone="soft" style={{ marginTop: 16, marginBottom: 8 }}>
        Cancel up to
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {[30, 60, 120, 180].map((m) => (
          <Chip key={m} label={m < 60 ? `${m} min before` : `${m / 60} h before`} selected={settings.cancelCutoffMinutes === m} onPress={() => update({ cancelCutoffMinutes: m })} />
        ))}
      </View>

      <SectionHeader title="Pausing" />
      <Group inset={16}>
        <ToggleRow
          title="Approve pauses automatically"
          subtitle="Turn off to review every request yourself"
          value={settings.autoApprovePause}
          onChange={(v) => update({ autoApprovePause: v })}
        />
        <Row
          title="Shortest pause"
          chevron={false}
          right={<Stepper value={settings.minPauseDays} min={1} max={30} label="minimum pause days" format={(v) => `${v}d`} onChange={(v) => update({ minPauseDays: v })} />}
        />
        <Row
          title="Notice needed"
          subtitle="Days before a pause can start"
          chevron={false}
          right={<Stepper value={settings.pauseNoticeDays} min={0} max={7} label="notice days" format={(v) => `${v}d`} onChange={(v) => update({ pauseNoticeDays: v })} />}
        />
      </Group>
      <Text variant="caption" tone="soft" style={{ marginTop: 8 }}>
        How many pause days each plan gets is set in Plans and prices.
      </Text>

      {brand.features.guestPass ? (
        <>
          <SectionHeader title="Guest passes" />
          <Group inset={16}>
            <Row
              title="Free days per guest"
              subtitle="Counted from their first visit"
              chevron={false}
              right={<Stepper value={settings.guestPassDays} min={1} max={14} label="guest days" format={(v) => `${v}d`} onChange={(v) => update({ guestPassDays: v })} />}
            />
            <Row
              title="Passes per member"
              subtitle="Every month"
              chevron={false}
              right={<Stepper value={settings.guestPassesPerMonth} min={0} max={5} label="passes per month" onChange={(v) => update({ guestPassesPerMonth: v })} />}
            />
            <ToggleRow title="Guests come with their host" subtitle="The member checks in first" value={settings.guestWithHost} onChange={(v) => update({ guestWithHost: v })} />
          </Group>
        </>
      ) : null}

      <SectionHeader title="Reminders" />
      <Group inset={16}>
        <Row
          title="Renewal reminder"
          subtitle="Days before a membership ends"
          chevron={false}
          right={<Stepper value={settings.reminderDaysBeforeExpiry} min={1} max={14} label="reminder days" format={(v) => `${v}d`} onChange={(v) => update({ reminderDaysBeforeExpiry: v })} />}
        />
      </Group>

      <SectionHeader title="Gym profile" hint="To change your name, logo, colours or timings, message your app team. They update the app for you." />
      <Group inset={16}>
        <Row title="Name" value={brand.name} />
        <Row title="Phone" value={brand.contact.phoneDisplay} />
        <Row title="Address" subtitle={`${brand.address.line1}, ${brand.address.line2}`} />
        {brand.hours.map((h) => (
          <Row key={h.label} title={h.label} value={`${fmtTime(h.open)} – ${fmtTime(h.close)}`} />
        ))}
      </Group>
    </Screen>
  );
}
