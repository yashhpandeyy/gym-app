import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Avatar, Button, Card, Empty, Fact, IconButton, Pill, Screen, Segmented, Text } from '@/components/ui';
import { addDays, diffDays, fmtDay, plural } from '@/lib/date';
import { firstName, phoneDisplay } from '@/lib/format';
import { useNow } from '@/lib/hooks';
import { call, whatsapp } from '@/lib/native';
import { useApp, type GuestPass } from '@/store';
import { useTheme } from '@/theme';

type Tab = 'active' | 'waiting' | 'done';

export default function Guests() {
  const { brand } = useTheme();
  const now = useNow(60_000);
  const passes = useApp((s) => s.guestPasses);
  const members = useApp((s) => s.members);
  const leads = useApp((s) => s.leads);
  const settings = useApp((s) => s.settings);
  const [tab, setTab] = useState<Tab>('active');
  const days = settings.guestPassDays;

  const phase = (g: GuestPass): Tab => {
    if (g.joinedAs) return 'done';
    if (!g.activatedOn) return now.date > addDays(g.createdOn, 30) ? 'done' : 'waiting';
    return now.date > addDays(g.activatedOn, days - 1) ? 'done' : 'active';
  };
  const groups = { active: passes.filter((g) => phase(g) === 'active'), waiting: passes.filter((g) => phase(g) === 'waiting'), done: passes.filter((g) => phase(g) === 'done') };
  const joined = passes.filter((g) => g.joinedAs).length;
  const used = passes.filter((g) => g.activatedOn).length;
  const hostName = (id: string) => members.find((m) => m.id === id)?.name ?? 'Former member';

  return (
    <Screen header="stack" title="Guest passes">
      <Text tone="soft">
        Members can bring a friend free for {days} days. Every guest is also saved in Enquiries, so the desk can follow up before the week ends.
      </Text>
      <Card style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
        <Fact label="Training now" value={String(groups.active.length)} />
        <Fact label="Not used yet" value={String(groups.waiting.length)} />
        <Fact label="Joined" value={String(joined)} tone="success" />
        <Fact label="Conversion" value={used ? `${Math.round((joined / used) * 100)}%` : '–'} />
      </Card>
      <View style={{ marginTop: 16, marginBottom: 12 }}>
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'active', label: 'On their week', count: groups.active.length },
            { value: 'waiting', label: 'Not used' },
            { value: 'done', label: 'Finished' },
          ]}
        />
      </View>
      <View style={{ gap: 10 }}>
        {groups[tab].length ? (
          groups[tab].map((g) => {
            const lead = leads.find((l) => l.phone === g.phone);
            const day = g.activatedOn ? Math.min(days, diffDays(g.activatedOn, now.date) + 1) : 0;
            return (
              <Card key={g.id} style={{ gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Avatar name={g.name} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text variant="label">{g.name}</Text>
                    <Text variant="caption" tone="soft">
                      Guest of {hostName(g.hostId)}, {g.code}, {phoneDisplay(g.phone)}
                    </Text>
                  </View>
                  {g.joinedAs ? (
                    <Pill label="Joined" tone="success" />
                  ) : g.activatedOn ? (
                    <Pill label={phase(g) === 'active' ? `Day ${day} of ${days}` : 'Week over'} tone={phase(g) === 'active' ? 'warning' : 'neutral'} />
                  ) : (
                    <Pill label="Not used" tone="primary" />
                  )}
                </View>
                <Text variant="small" tone="soft">
                  {g.visits.length ? `${plural(g.visits.length, 'visit')}, last on ${fmtDay(g.visits[g.visits.length - 1])}.` : `Created ${fmtDay(g.createdOn)}, no visits yet.`}
                </Text>
                {!g.joinedAs ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <IconButton icon="call-outline" label={`Call ${g.name}`} size={36} onPress={() => call(g.phone)} />
                    <IconButton
                      icon="logo-whatsapp"
                      label={`WhatsApp ${g.name}`}
                      size={36}
                      onPress={() =>
                        whatsapp(
                          g.phone,
                          `Hi ${firstName(g.name)}, hope you’re enjoying your free week at ${brand.name}! Want to keep going after it? Reply and we’ll help you pick a plan.`,
                        )
                      }
                    />
                    <View style={{ flex: 1 }} />
                    <Button
                      title="Sign up"
                      size="sm"
                      onPress={() =>
                        router.push({ pathname: '/manage/add-member', params: { name: g.name, phone: g.phone, ...(lead ? { leadId: lead.id } : {}) } })
                      }
                    />
                  </View>
                ) : null}
              </Card>
            );
          })
        ) : (
          <Empty icon="ticket-outline" title="No guests here" body="Members create guest passes from their app. Each one shows up here." />
        )}
      </View>
    </Screen>
  );
}
