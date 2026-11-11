import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { monthLabel, MonthSwitcher } from '@/components/MonthSwitcher';
import { Avatar, Button, Card, Chip, Empty, Fact, Group, Input, Row, Screen, Segmented, Sheet, Text, toast, ToggleRow } from '@/components/ui';
import { fmtDate, plural, WEEKDAYS_SHORT, type ISODate } from '@/lib/date';
import { payFor, TEAM_ROLES } from '@/lib/domain';
import { firstName, money } from '@/lib/format';
import { useIsOwner, useNow } from '@/lib/hooks';
import { useApp, type PayMethod, type PayType, type TeamMember } from '@/store';
import { makeStyles, useTheme } from '@/theme';

const METHODS: PayMethod[] = ['UPI', 'Cash', 'Card'];
type Draft = { id?: string; name: string; role: string; phone: string; payType: PayType; pay: string; offDays: number[]; joinedOn: string; active: boolean };
type SheetState = { kind: 'person'; id: string } | { kind: 'edit'; draft: Draft } | null;

const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

/** Staff, their pay, and what each is owed this month from their attendance. The owner's eyes only. */
export default function Payroll() {
  const { brand } = useTheme();
  const s = useStyles();
  const owner = useIsOwner();
  const now = useNow(60_000);
  const team = useApp((st) => st.team);
  const attendance = useApp((st) => st.attendance);
  const ledger = useApp((st) => st.ledger);
  const saveTeamMember = useApp((st) => st.saveTeamMember);
  const addLedger = useApp((st) => st.addLedger);
  const [month, setMonth] = useState(now.date.slice(0, 7));
  const [sheet, setSheet] = useState<SheetState>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PayMethod>('UPI');

  const thisMonth = now.date.slice(0, 7);
  const monthEnd = `${month}-31`;
  const people = useMemo(
    () =>
      team
        .filter((t) => t.joinedOn <= monthEnd && (t.active || ledger.some((e) => e.teamId === t.id && e.period === month)))
        .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name))
        .map((t) => ({ t, pay: payFor(t, month, attendance, ledger, now.date) })),
    [team, ledger, attendance, month, monthEnd, now.date],
  );
  const owed = people.reduce((sum, p) => sum + p.pay.earned, 0);
  const paid = people.reduce((sum, p) => sum + p.pay.paid, 0);

  if (!owner) {
    return (
      <Screen header="stack" title="Staff and salaries">
        <Empty icon="lock-closed-outline" title="Only the owner sees pay" body="You can still mark who came in to work." action="Mark attendance" onAction={() => router.replace('/manage/attendance')} />
      </Screen>
    );
  }

  const person = sheet?.kind === 'person' ? people.find((p) => p.t.id === sheet.id) : undefined;
  const draft = sheet?.kind === 'edit' ? sheet.draft : undefined;
  const setDraft = (patch: Partial<Draft>) => draft && setSheet({ kind: 'edit', draft: { ...draft, ...patch } });

  const openPerson = (t: TeamMember) => {
    const p = payFor(t, month, attendance, ledger, now.date);
    setAmount(p.balance > 0 ? String(p.balance) : '');
    setMethod('UPI');
    setSheet({ kind: 'person', id: t.id });
  };
  const openEdit = (t?: TeamMember) =>
    setSheet({
      kind: 'edit',
      draft: t
        ? { id: t.id, name: t.name, role: t.role, phone: t.phone ?? '', payType: t.payType ?? 'monthly', pay: t.pay ? String(t.pay) : '', offDays: t.offDays, joinedOn: t.joinedOn, active: t.active }
        : { name: '', role: 'Coach', phone: '', payType: 'monthly', pay: '', offDays: [0], joinedOn: now.date, active: true },
    });

  const saveDraft = () => {
    if (!draft) return;
    if (draft.name.trim().length < 2) return toast.error('Enter their name.');
    const pay = parseInt(draft.pay, 10);
    if (!(pay >= 1)) return toast.error(draft.payType === 'daily' ? 'Enter their pay for a day.' : 'Enter their monthly salary.');
    if (!isDate(draft.joinedOn)) return toast.error('Enter the date they started as YYYY-MM-DD.');
    saveTeamMember({ id: draft.id, name: draft.name.trim(), role: draft.role, phone: draft.phone.replace(/\D/g, '') || undefined, payType: draft.payType, pay, offDays: [...draft.offDays].sort(), joinedOn: draft.joinedOn as ISODate, active: draft.active });
    toast.success(draft.id ? 'Saved.' : `${firstName(draft.name.trim())} added.`);
    setSheet(null);
  };

  const paySalary = () => {
    if (!person) return;
    const amt = parseInt(amount, 10);
    if (!(amt >= 1)) return toast.error('Enter the amount you paid.');
    addLedger({ dir: 'out', date: now.date, category: 'Salaries', amount: amt, method, teamId: person.t.id, period: month, note: `${person.t.name}, ${monthLabel(month)}` });
    toast.success(`${money(amt)} paid to ${firstName(person.t.name)}. It’s in your books.`);
    setSheet(null);
  };

  return (
    <Screen header="stack" title="Staff and salaries" subtitle="Pay is worked out from attendance. Unmarked working days count as present.">
      <MonthSwitcher value={month} onChange={setMonth} latest={thisMonth} />

      <Card style={{ gap: 14 }}>
        <View>
          <Text variant="small" tone="soft">
            {month === thisMonth ? 'Salaries for this month' : `Salaries for ${monthLabel(month)}`}
          </Text>
          <Text variant="display">{money(owed)}</Text>
        </View>
        <View style={s.facts}>
          <Fact label="Paid" value={money(paid)} tone="success" />
          <Fact label="Still to pay" value={money(Math.max(0, owed - paid))} tone={owed > paid ? 'warning' : 'ink'} />
          <Fact label="Staff" value={String(people.filter((p) => p.t.active).length)} />
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button title="Mark attendance" icon="checkbox-outline" variant="soft" size="md" style={{ flex: 1 }} onPress={() => router.push('/manage/attendance')} />
          <Button title="Add staff" icon="person-add-outline" size="md" style={{ flex: 1 }} onPress={() => openEdit()} />
        </View>
      </Card>

      {people.length ? (
        <Group style={{ marginTop: 16 }}>
          {people.map(({ t, pay }) => {
            const away = [pay.absent ? `${pay.absent} absent` : null, pay.half ? plural(pay.half, 'half day') : null, pay.leave ? `${pay.leave} on leave` : null].filter(Boolean).join(', ');
            return (
              <Row
                key={t.id}
                leading={<Avatar name={t.name} size={36} />}
                title={t.name}
                subtitle={`${t.role}${!t.active ? ', left' : ''}. ${away || 'No days missed'}`}
                value={pay.balance > 0 ? `${money(pay.balance)} to pay` : pay.earned ? 'Paid' : undefined}
                valueTone={pay.balance > 0 ? 'warning' : 'success'}
                onPress={() => openPerson(t)}
              />
            );
          })}
        </Group>
      ) : (
        <Empty icon="people-outline" title="No staff yet" body="Add your coaches, desk staff and cleaners with their pay. Their salary is then worked out from attendance." />
      )}

      <Sheet
        visible={!!person}
        onClose={() => setSheet(null)}
        title={person?.t.name ?? ''}
        subtitle={person ? `${person.t.role}, ${person.t.payType === 'daily' ? `${money(person.t.pay ?? 0)} a day` : `${money(person.t.pay ?? 0)} a month`}` : undefined}
        footer={
          <View style={{ gap: 8 }}>
            <Button title={amount ? `Pay ${money(parseInt(amount, 10) || 0)}` : 'Record a payment'} full onPress={paySalary} />
            <Button title="Edit details" variant="ghost" full onPress={() => person && openEdit(person.t)} />
          </View>
        }>
        {person ? (
          <View style={{ gap: 12 }}>
            <Group inset={16}>
              <Row title="Working days" subtitle={person.t.offDays.length ? `Off on ${person.t.offDays.map((d) => WEEKDAYS_SHORT[d]).join(', ')}` : 'No weekly day off'} value={String(person.pay.workDays)} chevron={false} />
              <Row title="Absent" subtitle="Unpaid" value={String(person.pay.absent)} chevron={false} />
              <Row title="Half days" value={String(person.pay.half)} chevron={false} />
              <Row title="Paid leave" value={String(person.pay.leave)} chevron={false} />
              <Row title={person.t.payType === 'daily' ? `Earned so far (${person.pay.daysSoFar} days)` : 'Salary for the month'} subtitle={person.pay.full !== person.pay.earned && person.t.payType !== 'daily' ? `${money(person.pay.full)} before days missed` : undefined} value={money(person.pay.earned)} valueTone="ink" chevron={false} />
              <Row title="Already paid" value={money(person.pay.paid)} valueTone="success" chevron={false} />
            </Group>
            <Input label="Amount paid now" prefix={brand.currency.symbol} value={amount} onChangeText={(v) => setAmount(v.replace(/\D/g, '').slice(0, 7))} keyboardType="number-pad" />
            <View style={s.chips}>
              {METHODS.map((m) => (
                <Chip key={m} label={m} selected={method === m} onPress={() => setMethod(m)} />
              ))}
            </View>
            {ledger.filter((e) => e.teamId === person.t.id && e.period === month).length ? (
              <Text variant="caption" tone="soft">
                Paid for {monthLabel(month)}:{' '}
                {ledger
                  .filter((e) => e.teamId === person.t.id && e.period === month)
                  .map((e) => `${money(e.amount)} on ${fmtDate(e.date)}`)
                  .join(', ')}
              </Text>
            ) : null}
          </View>
        ) : null}
      </Sheet>

      <Sheet visible={!!draft} onClose={() => setSheet(null)} title={draft?.id ? 'Edit staff' : 'Add staff'} footer={<Button title={draft?.id ? 'Save' : 'Add to staff'} full onPress={saveDraft} />}>
        {draft ? (
          <View style={{ gap: 12 }}>
            <Input label="Name" value={draft.name} onChangeText={(v) => setDraft({ name: v })} autoCapitalize="words" />
            <View style={s.chips}>
              {TEAM_ROLES.map((r) => (
                <Chip key={r} label={r} selected={draft.role === r} onPress={() => setDraft({ role: r })} />
              ))}
            </View>
            <Input label="Phone (optional)" prefix="+91" value={draft.phone} onChangeText={(v) => setDraft({ phone: v.replace(/\D/g, '').slice(0, 10) })} keyboardType="number-pad" />
            <Segmented<PayType>
              value={draft.payType}
              onChange={(v) => setDraft({ payType: v })}
              options={[
                { value: 'monthly', label: 'Monthly salary' },
                { value: 'daily', label: 'Paid per day' },
              ]}
            />
            <Input label={draft.payType === 'daily' ? 'Pay for a day' : 'Monthly salary'} prefix={brand.currency.symbol} value={draft.pay} onChangeText={(v) => setDraft({ pay: v.replace(/\D/g, '').slice(0, 7) })} keyboardType="number-pad" />
            <Text variant="smallStrong" tone="soft">
              Weekly day off
            </Text>
            <View style={s.chips}>
              {WEEKDAYS_SHORT.map((d, i) => (
                <Chip key={d} label={d} selected={draft.offDays.includes(i)} onPress={() => setDraft({ offDays: draft.offDays.includes(i) ? draft.offDays.filter((x) => x !== i) : [...draft.offDays, i] })} />
              ))}
            </View>
            <Input label="Started on" value={draft.joinedOn} onChangeText={(v) => setDraft({ joinedOn: v.replace(/[^\d-]/g, '').slice(0, 10) })} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
            {draft.id ? <ToggleRow title="Still works here" subtitle="Switch off when someone leaves. Their past pay stays in the books." value={draft.active} onChange={(v) => setDraft({ active: v })} /> : null}
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  facts: { flexDirection: 'row', justifyContent: 'space-between' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
}));
