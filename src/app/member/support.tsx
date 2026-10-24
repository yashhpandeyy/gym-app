import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Card, Chip, Group, Icon, Input, Screen, SectionHeader, StatusPill, Text, toast } from '@/components/ui';
import { fmtStamp, plural } from '@/lib/date';
import { call, email, gymWhatsApp, haptic } from '@/lib/native';
import { useApp, useMe, type TicketCategory } from '@/store';
import { makeStyles, useTheme } from '@/theme';

const CATEGORIES: TicketCategory[] = ['Equipment', 'Cleanliness', 'Staff', 'Billing', 'Suggestion', 'Other'];

export default function Support() {
  const { brand } = useTheme();
  const s = useStyles();
  const me = useMe();
  const tickets = useApp((st) => st.tickets);
  const settings = useApp((st) => st.settings);
  const addTicket = useApp((st) => st.addTicket);
  const [category, setCategory] = useState<TicketCategory>('Equipment');
  const [message, setMessage] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  if (!me) return null;

  const mine = tickets.filter((t) => t.memberId === me.id);
  const faqs = [
    {
      q: 'How do I pause my membership?',
      a: `Go to Membership and tap Pause membership. Pick the days you’re away (at least ${plural(settings.minPauseDays, 'day')}). Your end date moves forward by the same number of days.`,
    },
    {
      q: 'Can I change my slot on the day?',
      a: `Yes. Open Book, pick another slot with free spots and tap Switch here. You can cancel up to ${settings.cancelCutoffMinutes} minutes before a slot starts.`,
    },
    {
      q: 'What happens when a slot is full?',
      a: settings.waitlist
        ? 'Join the waitlist. If someone cancels or the gym adds spots, you’re booked in automatically and we let you know.'
        : 'Pick another slot. The colours on each slot show how busy it is before you book.',
    },
    {
      q: 'Can I bring a friend?',
      a: 'Check the notice board for guest offers, or ask at the desk. Annual members get guest passes with their plan.',
    },
  ];

  const send = () => {
    if (toast.result(addTicket(category, message))) setMessage('');
  };

  return (
    <Screen header="stack" title="Help">
      <View style={s.contact}>
        <ContactButton icon="call-outline" label="Call" onPress={() => call(brand.contact.phone)} />
        <ContactButton
          icon="logo-whatsapp"
          label="WhatsApp"
          onPress={() => gymWhatsApp(`Hi ${brand.shortName}, this is ${me.name} (${me.code}). `)}
        />
        <ContactButton icon="mail-outline" label="Email" onPress={() => email(brand.contact.email, `Question from ${me.name} (${me.code})`)} />
      </View>

      <SectionHeader title="Report a problem" hint="Broken kit, a cleanliness issue or an idea. The gym team sees it right away." />
      <Card style={{ gap: 14 }}>
        <View style={s.chips}>
          {CATEGORIES.map((cat) => (
            <Chip key={cat} label={cat} selected={category === cat} onPress={() => setCategory(cat)} />
          ))}
        </View>
        <Input
          placeholder={category === 'Equipment' ? 'Which machine, and what’s wrong with it?' : 'What happened?'}
          value={message}
          onChangeText={setMessage}
          multiline
          maxLength={400}
        />
        <Button title="Send to the gym" full onPress={send} disabled={message.trim().length < 6} />
      </Card>

      {mine.length ? (
        <>
          <SectionHeader title="Your reports" />
          <View style={{ gap: 10 }}>
            {mine.map((t) => (
              <Card key={t.id} style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text variant="smallStrong">{t.category}</Text>
                  <StatusPill status={t.status} />
                </View>
                <Text variant="small">{t.message}</Text>
                {t.reply ? (
                  <Card variant="inset" style={{ gap: 2 }} padded>
                    <Text variant="caption" tone="soft">
                      Reply from {brand.shortName}
                    </Text>
                    <Text variant="small">{t.reply}</Text>
                  </Card>
                ) : null}
                <Text variant="caption" tone="faint">
                  {fmtStamp(t.createdAt)}
                </Text>
              </Card>
            ))}
          </View>
        </>
      ) : null}

      <SectionHeader title="Common questions" />
      <Group inset={16}>
        {faqs.map((f, i) => (
          <Pressable
            key={f.q}
            accessibilityRole="button"
            accessibilityState={{ expanded: openFaq === i }}
            onPress={() => {
              haptic.tap();
              setOpenFaq(openFaq === i ? null : i);
            }}
            style={s.faq}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Text variant="label" style={{ flex: 1 }}>
                {f.q}
              </Text>
              <Icon name={openFaq === i ? 'chevron-up' : 'chevron-down'} size={18} tone="faint" />
            </View>
            {openFaq === i ? (
              <Text variant="small" tone="soft" style={{ marginTop: 8 }}>
                {f.a}
              </Text>
            ) : null}
          </Pressable>
        ))}
      </Group>
    </Screen>
  );
}

function ContactButton({ icon, label, onPress }: { icon: 'call-outline' | 'logo-whatsapp' | 'mail-outline'; label: string; onPress: () => void }) {
  const s = useStyles();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [s.contactBtn, pressed && { opacity: 0.7 }]}>
      <Icon name={icon} size={24} tone="primary" />
      <Text variant="smallStrong">{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((t) => ({
  contact: { flexDirection: 'row', gap: 10 },
  contactBtn: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 16,
    borderRadius: t.radius.lg,
    backgroundColor: t.c.surface,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  faq: { paddingHorizontal: 16, paddingVertical: 14 },
}));
