import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Chip, Empty, IconButton, Input, Pill, Screen, Segmented, Sheet, Text, toast } from '@/components/ui';
import { fmtRelativeInline } from '@/lib/date';
import { firstName, phoneDisplay } from '@/lib/format';
import { useNow } from '@/lib/hooks';
import { call, whatsapp } from '@/lib/native';
import { useApp, type Lead, type LeadStage } from '@/store';
import { makeStyles, useTheme } from '@/theme';

const STAGES: { value: LeadStage; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'trial', label: 'Trial' },
  { value: 'joined', label: 'Joined' },
  { value: 'lost', label: 'Lost' },
];
const SOURCES = ['Walk-in', 'Instagram', 'Google', 'Referral', 'Phone call'];
const INTERESTS = ['Weight loss', 'Strength', 'General fitness', 'Yoga', 'Personal training', 'Zumba'];

export default function Leads() {
  const { brand } = useTheme();
  const s = useStyles();
  const now = useNow(60_000);
  const leads = useApp((st) => st.leads);
  const addLead = useApp((st) => st.addLead);
  const updateLead = useApp((st) => st.updateLead);
  const [stage, setStage] = useState<LeadStage>('new');
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [source, setSource] = useState(SOURCES[0]);
  const [interest, setInterest] = useState(INTERESTS[0]);
  const [note, setNote] = useState('');

  const counts = Object.fromEntries(STAGES.map((x) => [x.value, leads.filter((l) => l.stage === x.value).length])) as Record<LeadStage, number>;
  const visible = leads.filter((l) => l.stage === stage);

  const save = () => {
    if (name.trim().length < 2 || phone.replace(/\D/g, '').length !== 10) {
      toast.error('Add a name and a 10-digit number.');
      return;
    }
    addLead({ name: name.trim(), phone: phone.replace(/\D/g, ''), source, interest, note: note.trim() || undefined });
    setAdding(false);
    setName('');
    setPhone('');
    setNote('');
    setStage('new');
    toast.success('Enquiry saved. Follow up today while they’re keen.');
  };

  const move = (l: Lead, to: LeadStage) => {
    updateLead(l.id, { stage: to });
    toast.success(`${firstName(l.name)} moved to ${STAGES.find((x) => x.value === to)!.label.toLowerCase()}.`);
  };

  return (
    <Screen
      header="stack"
      title="Enquiries"
      right={<IconButton icon="add" label="Add enquiry" variant="soft" onPress={() => setAdding(true)} />}>
      <Text tone="soft" style={{ marginBottom: 14 }}>
        Everyone who called, walked in or messaged about joining. Move them along as they come for a trial and sign up.
      </Text>
      <Segmented<LeadStage> value={stage} onChange={setStage} options={STAGES.map((x) => ({ ...x, count: counts[x.value] }))} />

      <View style={{ gap: 10, marginTop: 14 }}>
        {visible.length ? (
          visible.map((l) => (
            <Card key={l.id} style={{ gap: 10 }}>
              <View style={s.head}>
                <View style={{ flex: 1 }}>
                  <Text variant="label">{l.name}</Text>
                  <Text variant="caption" tone="soft">
                    {phoneDisplay(l.phone)}, asked {fmtRelativeInline(l.date, now.date)}
                  </Text>
                </View>
                <Pill label={l.source} />
              </View>
              <Text variant="small">
                Interested in {l.interest.toLowerCase()}
                {l.note ? `. ${l.note}` : ''}
              </Text>
              <View style={s.actions}>
                <IconButton icon="call-outline" label={`Call ${l.name}`} size={36} onPress={() => call(l.phone)} />
                <IconButton
                  icon="logo-whatsapp"
                  label={`WhatsApp ${l.name}`}
                  size={36}
                  onPress={() =>
                    whatsapp(
                      l.phone,
                      `Hi ${firstName(l.name)}, thanks for asking about ${brand.name}! Come in for a free trial session any day this week. What time suits you?`,
                    )
                  }
                />
                <View style={{ flex: 1 }} />
                {l.stage === 'new' ? <Button title="Trial booked" size="sm" variant="soft" onPress={() => move(l, 'trial')} /> : null}
                {l.stage === 'new' || l.stage === 'trial' ? (
                  <Button
                    title="Sign up"
                    size="sm"
                    onPress={() => router.push({ pathname: '/manage/add-member', params: { name: l.name, phone: l.phone, leadId: l.id } })}
                  />
                ) : null}
                {l.stage === 'lost' ? <Button title="Reopen" size="sm" variant="soft" onPress={() => move(l, 'new')} /> : null}
              </View>
              {l.stage === 'new' || l.stage === 'trial' ? (
                <Text variant="caption" tone="faint" onPress={() => move(l, 'lost')} suppressHighlighting>
                  Not interested? Tap to mark as lost.
                </Text>
              ) : null}
            </Card>
          ))
        ) : (
          <Empty
            icon="person-add-outline"
            title={stage === 'new' ? 'No new enquiries' : `Nobody in ${STAGES.find((x) => x.value === stage)!.label.toLowerCase()}`}
            body={stage === 'new' ? 'Log walk-ins and calls here so nobody slips through.' : undefined}
            action={stage === 'new' ? 'Add enquiry' : undefined}
            onAction={() => setAdding(true)}
          />
        )}
      </View>

      <Sheet visible={adding} onClose={() => setAdding(false)} title="New enquiry" footer={<Button title="Save enquiry" full onPress={save} />}>
        <Input label="Name" value={name} onChangeText={setName} autoCapitalize="words" />
        <Input label="Mobile number" prefix="+91" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Text variant="smallStrong" tone="soft">
          How they found you
        </Text>
        <View style={s.wrap}>
          {SOURCES.map((x) => (
            <Chip key={x} label={x} selected={source === x} onPress={() => setSource(x)} />
          ))}
        </View>
        <Text variant="smallStrong" tone="soft">
          Interested in
        </Text>
        <View style={s.wrap}>
          {INTERESTS.map((x) => (
            <Chip key={x} label={x} selected={interest === x} onPress={() => setInterest(x)} />
          ))}
        </View>
        <Input label="Note (optional)" value={note} onChangeText={setNote} placeholder="Budget, timings, questions they asked" />
      </Sheet>
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
}));
