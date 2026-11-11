import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Chip, Group, Input, Row, Screen, SectionHeader, Stepper, Text, toast, ToggleRow } from '@/components/ui';
import { AWAY_MESSAGE } from '@/data/constants';
import { awayAfterDays, awayMessageFor, awayTemplate } from '@/lib/domain';
import type { FeatureKey } from '@/config/brand';
import { fmtTime } from '@/lib/date';
import { useIsOwner } from '@/lib/hooks';
import { setFeature } from '@/lib/remote';
import { useApp } from '@/store';
import { useTheme } from '@/theme';

export default function Settings() {
  const { brand } = useTheme();
  const settings = useApp((s) => s.settings);
  const update = useApp((s) => s.updateSettings);
  const owner = useIsOwner();
  const [saving, setSaving] = useState<FeatureKey>();
  const [awayText, setAwayText] = useState(awayTemplate(settings));
  const saveAwayText = () => {
    const text = awayText.trim();
    if (text === awayTemplate(settings)) return;
    update({ awayMessage: text && text !== AWAY_MESSAGE ? text.slice(0, 600) : undefined });
    toast.success('Message saved.');
  };
  const pausesOn = brand.features.pauses !== false;

  const toggleFeature = async (key: FeatureKey, on: boolean, label: string) => {
    setSaving(key);
    const r = await setFeature(key, on);
    setSaving(undefined);
    if (!r.ok) return toast.error(r.message);
    toast.success(on ? `${label} is on for members.` : `${label} is off. Members no longer see it.`);
  };

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
        {owner ? (
          <ToggleRow
            title="Members can pause"
            subtitle="Turn off and members can’t ask for a pause. You can still pause someone from their profile."
            value={pausesOn}
            disabled={saving === 'pauses'}
            onChange={(v) => void toggleFeature('pauses', v, 'Pausing')}
          />
        ) : null}
        {pausesOn ? (
          <>
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
            <Row title="Pause days per plan" subtitle="How many days each plan allows in one term" onPress={() => router.push('/manage/plans')} />
          </>
        ) : null}
      </Group>
      {pausesOn ? (
        <Text variant="caption" tone="soft" style={{ marginTop: 8 }}>
          To give one member more or fewer pause days, open their profile.
        </Text>
      ) : null}

      {owner || brand.features.guestPass ? <SectionHeader title="Guest passes" /> : null}
      {owner ? (
        <Group inset={16}>
          <ToggleRow
            title="Members can bring guests"
            subtitle="Turn off and the guest pass disappears from the members’ app"
            value={brand.features.guestPass !== false}
            disabled={saving === 'guestPass'}
            onChange={(v) => void toggleFeature('guestPass', v, 'Guest passes')}
          />
        </Group>
      ) : null}
      {brand.features.guestPass ? (
        <>
          <Group inset={16} style={owner ? { marginTop: 10 } : undefined}>
            <Row
              title="Free days per guest"
              subtitle="Counted from their first visit"
              chevron={false}
              right={<Stepper value={settings.guestPassDays} min={1} max={30} label="guest days" format={(v) => `${v}d`} onChange={(v) => update({ guestPassDays: v })} />}
            />
            <Row
              title="Passes per member"
              subtitle="Every month"
              chevron={false}
              right={<Stepper value={settings.guestPassesPerMonth} min={0} max={10} label="passes per month" onChange={(v) => update({ guestPassesPerMonth: v })} />}
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

      <SectionHeader title="Members who stop coming" hint="They show under Not coming on the Members tab, with a button to send them this message on WhatsApp." />
      <Group inset={16}>
        <Row
          title="Not coming after"
          subtitle="Days without a visit. Paused members don’t count."
          chevron={false}
          right={<Stepper value={awayAfterDays(settings)} min={2} max={60} label="days without a visit" format={(v) => `${v}d`} onChange={(v) => update({ awayAfterDays: v })} />}
        />
      </Group>
      <View style={{ gap: 8, marginTop: 12 }}>
        <Input label="Message" value={awayText} onChangeText={setAwayText} onBlur={saveAwayText} multiline maxLength={600} />
        <Text variant="caption" tone="soft">
          {'{name}'} becomes their first name, {'{days}'} the days since their last visit and {'{gym}'} your gym’s name. Preview: {awayMessageFor(awayText || AWAY_MESSAGE, { name: 'Priya Sharma' }, awayAfterDays(settings) + 2, brand.name)}
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button title="Save message" size="sm" variant="soft" disabled={awayText.trim() === awayTemplate(settings)} onPress={saveAwayText} />
          {settings.awayMessage ? (
            <Button
              title="Use the standard message"
              size="sm"
              variant="ghost"
              onPress={() => {
                setAwayText(AWAY_MESSAGE);
                update({ awayMessage: undefined });
              }}
            />
          ) : null}
        </View>
      </View>

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
