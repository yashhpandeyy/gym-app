import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Avatar, Button, Card, Chip, Empty, Fact, Group, Input, Row, Screen, Segmented, Sheet, Text, toast } from '@/components/ui';
import { fmtDate, MONTHS_LONG, monthKey, parts } from '@/lib/date';
import { firstName, money } from '@/lib/format';
import { useNow } from '@/lib/hooks';
import { whatsapp } from '@/lib/native';
import { useApp, type Member, type PayMethod } from '@/store';
import { makeStyles, useTheme } from '@/theme';

type Tab = 'received' | 'dues';

export default function Payments() {
  const { brand } = useTheme();
  const s = useStyles();
  const params = useLocalSearchParams<{ tab?: Tab }>();
  const now = useNow(60_000);
  const payments = useApp((st) => st.payments);
  const members = useApp((st) => st.members);
  const recordPayment = useApp((st) => st.recordPayment);
  const [tab, setTab] = useState<Tab>(params.tab === 'dues' ? 'dues' : 'received');
  const [collect, setCollect] = useState<Member | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PayMethod>('UPI');

  const month = monthKey(now.date);
  const thisMonth = payments.filter((p) => monthKey(p.date) === month);
  const total = thisMonth.reduce((sum, p) => sum + p.amount, 0);
  const byMethod = (['UPI', 'Cash', 'Card'] as PayMethod[]).map((m) => ({
    m,
    sum: thisMonth.filter((p) => p.method === m).reduce((x, p) => x + p.amount, 0),
  }));
  const owing = members.filter((m) => m.dues > 0).sort((a, b) => b.dues - a.dues);
  const recent = [...payments].sort((a, b) => (a.date === b.date ? (a.invoice < b.invoice ? 1 : -1) : a.date < b.date ? 1 : -1)).slice(0, 40);
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? 'Former member';

  const save = () => {
    if (!collect) return;
    const amt = parseInt(amount, 10);
    if (!amt) return toast.error('Enter the amount you collected.');
    const p = recordPayment(collect.id, amt, method);
    toast.success(`${money(amt)} from ${firstName(collect.name)}. Invoice ${p.invoice}.`);
    setCollect(null);
  };

  return (
    <Screen header="stack" title="Payments">
      <Card style={{ gap: 14 }}>
        <View>
          <Text variant="small" tone="soft">
            Collected in {MONTHS_LONG[parts(now.date).m]}
          </Text>
          <Text variant="display">{money(total)}</Text>
          <Text variant="small" tone="soft">
            {thisMonth.length} payments
          </Text>
        </View>
        <View style={s.facts}>
          {byMethod.map((x) => (
            <Fact key={x.m} label={x.m} value={money(x.sum, { compact: true })} />
          ))}
          <Fact label="Dues" value={money(owing.reduce((sum, m) => sum + m.dues, 0), { compact: true })} tone="danger" />
        </View>
      </Card>

      <View style={{ marginTop: 16, marginBottom: 14 }}>
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'received', label: 'Received' },
            { value: 'dues', label: 'Dues', count: owing.length },
          ]}
        />
      </View>

      {tab === 'received' ? (
        <Group inset={16}>
          {recent.map((p) => (
            <Row
              key={p.id}
              title={nameOf(p.memberId)}
              subtitle={`${fmtDate(p.date)}, ${p.method}, ${p.invoice}`}
              value={money(p.amount)}
              valueTone="ink"
              onPress={() => router.push(`/manage/member/${p.memberId}`)}
              chevron={false}
            />
          ))}
        </Group>
      ) : owing.length ? (
        <Group>
          {owing.map((m) => (
            <Row
              key={m.id}
              leading={<Avatar name={m.name} size={36} />}
              title={m.name}
              subtitle={`${money(m.dues)} due`}
              chevron={false}
              onPress={() => router.push(`/manage/member/${m.id}`)}
              action={
                <>
                  <Button
                    title="Remind"
                    size="sm"
                    variant="soft"
                    onPress={() =>
                      whatsapp(
                        m.phone,
                        `Hi ${firstName(m.name)}, a friendly reminder from ${brand.name}: ${money(m.dues)} is pending on your membership. You can pay by UPI or at the desk. Thank you!`,
                      )
                    }
                  />
                  <Button
                    title="Collect"
                    size="sm"
                    onPress={() => {
                      setAmount(String(m.dues));
                      setMethod('UPI');
                      setCollect(m);
                    }}
                  />
                </>
              }
            />
          ))}
        </Group>
      ) : (
        <Empty icon="checkmark-done-outline" title="No dues" body="Everyone is paid up." />
      )}

      <Sheet
        visible={!!collect}
        onClose={() => setCollect(null)}
        title={`Collect from ${collect ? firstName(collect.name) : ''}`}
        subtitle={collect ? `${money(collect.dues)} due` : undefined}
        footer={<Button title="Save payment" full onPress={save} />}>
        <Input label="Amount" prefix={brand.currency.symbol} value={amount} onChangeText={(v) => setAmount(v.replace(/\D/g, ''))} keyboardType="number-pad" />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['UPI', 'Cash', 'Card'] as PayMethod[]).map((x) => (
            <Chip key={x} label={x} selected={method === x} onPress={() => setMethod(x)} />
          ))}
        </View>
      </Sheet>
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  facts: { flexDirection: 'row', justifyContent: 'space-between' },
}));
