import { router } from 'expo-router';
import { View } from 'react-native';

import { Group, Row, Screen, SectionHeader, Segmented, Text } from '@/components/ui';
import { plural } from '@/lib/date';
import { money } from '@/lib/format';
import { signOut } from '@/lib/remote';
import { confirm } from '@/lib/native';
import { useApp, type Prefs } from '@/store';
import { useTheme } from '@/theme';

export default function More() {
  const { brand } = useTheme();
  const session = useApp((s) => s.session);
  const pauses = useApp((s) => s.pauses);
  const ptRequests = useApp((s) => s.ptRequests);
  const tickets = useApp((s) => s.tickets);
  const leads = useApp((s) => s.leads);
  const members = useApp((s) => s.members);
  const plans = useApp((s) => s.plans);
  const announcements = useApp((s) => s.announcements);
  const chests = useApp((s) => s.chests);
  const guestPasses = useApp((s) => s.guestPasses);
  const challenges = useApp((s) => s.challenges);
  const prefs = useApp((s) => s.prefs);
  const setPrefs = useApp((s) => s.setPrefs);

  const pendingPauses = pauses.filter((p) => p.status === 'pending').length;
  const pendingCoach = ptRequests.filter((r) => r.status === 'pending').length;
  const openTickets = tickets.filter((t) => t.status === 'open').length;
  const newLeads = leads.filter((l) => l.stage === 'new' || l.stage === 'trial').length;
  const dues = members.reduce((sum, m) => sum + m.dues, 0);

  return (
    <Screen title="Manage" subtitle={session?.staffName ? `Signed in as ${session.staffName}` : undefined}>
      <SectionHeader title="Requests" style={{ marginTop: 6 }} />
      <Group>
        <Row
          icon="airplane-outline"
          title="Pause requests"
          value={pendingPauses ? `${pendingPauses} waiting` : 'None waiting'}
          valueTone={pendingPauses ? 'warning' : 'faint'}
          onPress={() => router.push('/manage/requests')}
        />
        {brand.features.trainers ? (
          <Row
            icon="barbell-outline"
            title="Coaching requests"
            value={pendingCoach ? `${pendingCoach} waiting` : 'None waiting'}
            valueTone={pendingCoach ? 'warning' : 'faint'}
            onPress={() => router.push({ pathname: '/manage/requests', params: { tab: 'coach' } })}
          />
        ) : null}
        <Row
          icon="construct-outline"
          title="Complaints and feedback"
          value={openTickets ? `${openTickets} open` : 'All resolved'}
          valueTone={openTickets ? 'warning' : 'faint'}
          onPress={() => router.push('/manage/tickets')}
        />
      </Group>

      <SectionHeader title="Business" />
      <Group>
        <Row icon="wallet-outline" title="Payments and dues" value={dues ? `${money(dues)} due` : undefined} onPress={() => router.push('/manage/payments')} />
        <Row icon="pricetags-outline" title="Plans and prices" value={`${plans.filter((p) => p.active).length} live`} onPress={() => router.push('/manage/plans')} />
        {brand.features.leads ? (
          <Row icon="person-add-outline" title="Enquiries" value={newLeads ? `${newLeads} to follow up` : undefined} onPress={() => router.push('/manage/leads')} />
        ) : null}
        <Row icon="person-add" title="Add a member" onPress={() => router.push('/manage/add-member')} />
      </Group>

      <SectionHeader title="Engagement" />
      <Group>
        {brand.features.guestPass ? (
          <Row icon="ticket-outline" title="Guest passes" value={plural(guestPasses.filter((g) => !g.joinedAs).length, 'guest')} onPress={() => router.push('/manage/guests')} />
        ) : null}
        {brand.features.gamification ? (
          <Row icon="stopwatch-outline" title="Station challenges" value={`${challenges.filter((c) => c.active).length} live`} onPress={() => router.push('/manage/challenges')} />
        ) : null}
        {brand.features.gamification ? (
          <Row
            icon="gift-outline"
            title="Prizes to hand out"
            value={(() => {
              const n = chests.filter((x) => x.prize && (x.prize.kind === 'shake' || x.prize.kind === 'merch') && !x.redeemedAt).length;
              return n ? `${n} waiting` : 'None waiting';
            })()}
            onPress={() => router.push('/manage/prizes')}
          />
        ) : null}
      </Group>

      <SectionHeader title="Members’ app" />
      <Group>
        <Row icon="megaphone-outline" title="Announcements" value={`${announcements.length} posted`} onPress={() => router.push('/manage/announcements')} />
        <Row icon="options-outline" title="Booking and pause rules" onPress={() => router.push('/manage/settings')} />
      </Group>

      <SectionHeader title="Your gym" />
      <Group>
        <Row icon="color-palette-outline" title="Gym settings" subtitle="Name, logo, colours, hours and features" onPress={() => router.push('/live/setup')} />
        <Row icon="pricetag-outline" title="Plans and prices" onPress={() => router.push('/manage/plans')} />
        {brand.features.classes ? <Row icon="people-outline" title="Classes" subtitle="Yoga, Zumba and other timetabled sessions" onPress={() => router.push('/manage/classes')} /> : null}
        {brand.features.trainers ? <Row icon="barbell-outline" title="Coaches" subtitle="Who members can train with" onPress={() => router.push('/manage/trainers')} /> : null}
        <Row icon="key-outline" title="Staff logins" subtitle="Front-desk PINs" onPress={() => router.push('/manage/staff')} />
      </Group>

      <SectionHeader title="Appearance" />
      <Segmented<Prefs['scheme']>
        value={prefs.scheme}
        onChange={(v) => setPrefs({ scheme: v })}
        options={[
          { value: 'system', label: 'Match phone' },
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
        ]}
      />


      <Group style={{ marginTop: 28 }}>
        <Row
          icon="log-out-outline"
          iconTone="danger"
          title="Log out"
          titleTone="danger"
          chevron={false}
          onPress={() =>
            confirm({
              title: 'Log out of the manager app?',
              confirmText: 'Log out',
              destructive: true,
              onConfirm: () => {
                signOut();
                router.replace('/');
              },
            })
          }
        />
      </Group>
      <View style={{ marginTop: 18 }}>
        <Text variant="caption" tone="faint" align="center">
          {brand.name} manager app, version 1.0
        </Text>
      </View>
    </Screen>
  );
}
