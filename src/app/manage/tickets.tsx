import { useState } from 'react';
import { View } from 'react-native';

import { Avatar, Button, Card, Empty, Input, Pill, Screen, Segmented, Sheet, Text, toast } from '@/components/ui';
import { fmtStamp } from '@/lib/date';
import { firstName } from '@/lib/format';
import { useApp, type Ticket } from '@/store';

export default function Tickets() {
  const tickets = useApp((s) => s.tickets);
  const members = useApp((s) => s.members);
  const resolve = useApp((s) => s.resolveTicket);
  const [tab, setTab] = useState<'open' | 'resolved'>('open');
  const [replying, setReplying] = useState<Ticket | null>(null);
  const [reply, setReply] = useState('');

  const list = tickets.filter((t) => t.status === tab).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? 'Former member';

  const send = () => {
    if (!replying) return;
    if (reply.trim().length < 4) return toast.error('Write a short reply so the member knows what happened.');
    resolve(replying.id, reply.trim());
    toast.success(`Resolved. ${firstName(nameOf(replying.memberId))} will see your reply.`);
    setReplying(null);
    setReply('');
  };

  return (
    <Screen header="stack" title="Complaints and feedback">
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'open', label: 'Open', count: tickets.filter((t) => t.status === 'open').length },
          { value: 'resolved', label: 'Resolved' },
        ]}
      />
      <View style={{ gap: 10, marginTop: 14 }}>
        {list.length ? (
          list.map((t) => (
            <Card key={t.id} style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Avatar name={nameOf(t.memberId)} size={34} />
                <View style={{ flex: 1 }}>
                  <Text variant="label">{nameOf(t.memberId)}</Text>
                  <Text variant="caption" tone="soft">
                    {fmtStamp(t.createdAt)}
                  </Text>
                </View>
                <Pill label={t.category} tone={t.category === 'Equipment' ? 'warning' : 'neutral'} />
              </View>
              <Text variant="body">{t.message}</Text>
              {t.reply ? (
                <Card variant="inset">
                  <Text variant="caption" tone="soft">
                    Your reply
                  </Text>
                  <Text variant="small">{t.reply}</Text>
                </Card>
              ) : (
                <Button
                  title="Reply and resolve"
                  size="sm"
                  onPress={() => {
                    setReply('');
                    setReplying(t);
                  }}
                />
              )}
            </Card>
          ))
        ) : (
          <Empty
            icon={tab === 'open' ? 'checkmark-done-outline' : 'chatbubbles-outline'}
            title={tab === 'open' ? 'Nothing open' : 'No resolved reports yet'}
            body={tab === 'open' ? 'Members report broken kit and other problems from the Help page in their app.' : undefined}
          />
        )}
      </View>

      <Sheet
        visible={!!replying}
        onClose={() => setReplying(null)}
        title="Reply to member"
        subtitle={replying?.message}
        footer={<Button title="Send and resolve" full onPress={send} />}>
        <Input placeholder="Fixed the treadmill belt this morning. Thanks for telling us." value={reply} onChangeText={setReply} multiline autoFocus />
      </Sheet>
    </Screen>
  );
}
