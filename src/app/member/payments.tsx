import { useState } from 'react';

import { Button, Empty, Group, Row, Screen, Sheet, Text } from '@/components/ui';
import { fmtDate } from '@/lib/date';
import { money } from '@/lib/format';
import { share } from '@/lib/native';
import { useApp, useMe, type Payment } from '@/store';
import { useTheme } from '@/theme';

export default function MemberPayments() {
  const { brand } = useTheme();
  const me = useMe();
  const payments = useApp((s) => s.payments);
  const plans = useApp((s) => s.plans);
  const [open, setOpen] = useState<Payment | null>(null);
  if (!me) return null;

  const mine = payments.filter((p) => p.memberId === me.id).sort((a, b) => (a.date < b.date ? 1 : -1));
  const total = mine.reduce((s, p) => s + p.amount, 0);
  const planName = (id?: string) => plans.find((p) => p.id === id)?.name;

  return (
    <Screen header="stack" title="Payments" subtitle={`${money(total)} paid across ${mine.length} payments.`}>
      {mine.length ? (
        <Group inset={16}>
          {mine.map((p) => (
            <Row
              key={p.id}
              title={money(p.amount)}
              subtitle={`${fmtDate(p.date)}, ${p.method}${planName(p.planId) ? `, ${planName(p.planId)}` : ''}`}
              value={p.invoice}
              valueTone="faint"
              onPress={() => setOpen(p)}
            />
          ))}
        </Group>
      ) : (
        <Empty icon="receipt-outline" title="No payments yet" body="Receipts for renewals and dues show up here." />
      )}

      <Sheet
        visible={!!open}
        onClose={() => setOpen(null)}
        title="Receipt"
        subtitle={open?.invoice}
        footer={
          open ? (
            <Button
              title="Share receipt"
              icon="share-outline"
              variant="soft"
              full
              onPress={() =>
                share(
                  `${brand.name}\nReceipt ${open.invoice}\n${me.name} (${me.code})\n${planName(open.planId) ?? 'Payment'}: ${money(open.amount)} by ${open.method}\nPaid on ${fmtDate(open.date)}`,
                )
              }
            />
          ) : null
        }>
        {open ? (
          <>
            <Text variant="display">{money(open.amount)}</Text>
            <Group inset={16}>
              <Row title="Paid on" value={fmtDate(open.date)} />
              <Row title="Method" value={open.method} />
              {planName(open.planId) ? <Row title="Plan" value={planName(open.planId)} /> : null}
              {open.note ? <Row title="Note" value={open.note} /> : null}
              <Row title="Member" value={`${me.name}, ${me.code}`} />
            </Group>
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}
