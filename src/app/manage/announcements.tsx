import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Chip, Empty, Group, IconButton, Input, Pill, Screen, SectionHeader, Text, toast, ToggleRow } from '@/components/ui';
import { fmtDate } from '@/lib/date';
import { confirm, share } from '@/lib/native';
import { useApp, type AnnouncementKind } from '@/store';
import { makeStyles, useTheme } from '@/theme';

const KINDS: { value: AnnouncementKind; label: string; tone: 'warning' | 'primary' | 'success' | 'neutral' }[] = [
  { value: 'notice', label: 'Notice', tone: 'neutral' },
  { value: 'holiday', label: 'Hours', tone: 'warning' },
  { value: 'event', label: 'Event', tone: 'primary' },
  { value: 'offer', label: 'Offer', tone: 'success' },
];

export default function Announcements() {
  const { brand } = useTheme();
  const s = useStyles();
  const announcements = useApp((st) => st.announcements);
  const add = useApp((st) => st.addAnnouncement);
  const remove = useApp((st) => st.removeAnnouncement);
  const togglePin = useApp((st) => st.togglePin);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [kind, setKind] = useState<AnnouncementKind>('notice');
  const [pinned, setPinned] = useState(false);

  const post = () => {
    if (title.trim().length < 3 || body.trim().length < 6) {
      toast.error('Add a short title and a message.');
      return;
    }
    add({ title: title.trim(), body: body.trim(), kind, pinned });
    setTitle('');
    setBody('');
    setPinned(false);
    toast.success('Posted. Members see it on their home screen.');
  };

  const sorted = [...announcements].sort((a, b) => (a.pinned !== b.pinned ? (a.pinned ? -1 : 1) : a.date < b.date ? 1 : -1));

  return (
    <Screen header="stack" title="Announcements">
      <Card style={{ gap: 14 }}>
        <Text variant="h3">Post to all members</Text>
        <View style={s.wrap}>
          {KINDS.map((k) => (
            <Chip key={k.value} label={k.label} selected={kind === k.value} onPress={() => setKind(k.value)} />
          ))}
        </View>
        <Input placeholder="Title, e.g. Closed on Sunday for maintenance" value={title} onChangeText={setTitle} maxLength={70} />
        <Input placeholder="What members need to know" value={body} onChangeText={setBody} multiline maxLength={400} />
        <Group style={{ borderWidth: 1, borderColor: 'transparent' }}>
          <ToggleRow title="Pin to the top" subtitle="Stays first on the notice board" value={pinned} onChange={setPinned} />
        </Group>
        <Button title="Post announcement" full onPress={post} />
      </Card>

      <SectionHeader title="Posted" />
      {sorted.length ? (
        <View style={{ gap: 10 }}>
          {sorted.map((a) => {
            const k = KINDS.find((x) => x.value === a.kind)!;
            return (
              <Card key={a.id} style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Pill label={k.label} tone={k.tone} />
                  {a.pinned ? <Pill label="Pinned" icon="pin" /> : null}
                  <Text variant="caption" tone="faint" style={{ flex: 1, textAlign: 'right' }}>
                    {fmtDate(a.date)}
                  </Text>
                </View>
                <Text variant="label">{a.title}</Text>
                <Text variant="small" tone="soft">
                  {a.body}
                </Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                  <IconButton icon={a.pinned ? 'pin' : 'pin-outline'} label={a.pinned ? 'Unpin' : 'Pin'} size={36} onPress={() => togglePin(a.id)} />
                  <IconButton icon="share-social-outline" label="Share to WhatsApp groups" size={36} onPress={() => share(`${brand.name}: ${a.title}\n\n${a.body}`)} />
                  <IconButton
                    icon="trash-outline"
                    label="Delete"
                    size={36}
                    onPress={() =>
                      confirm({
                        title: 'Delete this announcement?',
                        message: 'It disappears from the members’ notice board.',
                        confirmText: 'Delete',
                        destructive: true,
                        onConfirm: () => remove(a.id),
                      })
                    }
                  />
                </View>
              </Card>
            );
          })}
        </View>
      ) : (
        <Empty icon="megaphone-outline" title="Nothing posted yet" body="Holiday hours, events and offers you post show up on every member’s home screen." />
      )}
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
}));
