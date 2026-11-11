import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { monthLabel, MonthSwitcher } from '@/components/MonthSwitcher';
import { Button, Card, Chip, Empty, Fact, Group, Input, ProgressBar, Row, Screen, SectionHeader, Sheet, Text, toast } from '@/components/ui';
import { fmtDate, MONTHS_SHORT, monthKey, parts, type ISODate } from '@/lib/date';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, monthBooks, monthsUpTo } from '@/lib/domain';
import { money } from '@/lib/format';
import { useIsOwner, useNow } from '@/lib/hooks';
import { addMonths } from '@/lib/date';
import { confirm } from '@/lib/native';
import { useApp, type LedgerDir, type PayMethod } from '@/store';
import { makeStyles, useTheme } from '@/theme';

const METHODS: PayMethod[] = ['UPI', 'Cash', 'Card'];
type Draft = { dir: LedgerDir; category: string; amount: string; date: string; note: string; method: PayMethod };
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

/** Profit and loss: what came in, what went out and where, month by month. The owner's eyes only. */
export default function Books() {
  const { c, brand } = useTheme();
  const s = useStyles();
  const owner = useIsOwner();
  const now = useNow(60_000);
  const payments = useApp((st) => st.payments);
  const sales = useApp((st) => st.sales);
  const ledger = useApp((st) => st.ledger);
  const team = useApp((st) => st.team);
  const members = useApp((st) => st.members);
  const addLedger = useApp((st) => st.addLedger);
  const removeLedger = useApp((st) => st.removeLedger);
  const thisMonth = now.date.slice(0, 7);
  const [month, setMonth] = useState(thisMonth);
  const [draft, setDraft] = useState<Draft | null>(null);

  const books = useMemo(() => monthBooks(month, payments, sales, ledger), [month, payments, sales, ledger]);
  const trend = useMemo(() => monthsUpTo(month, 6).map((m) => ({ m, b: monthBooks(m, payments, sales, ledger) })).reverse(), [month, payments, sales, ledger]);
  const entries = ledger.filter((e) => monthKey(e.date) === month).sort((a, b) => (a.date < b.date ? 1 : -1));

  // Dashboard stats
  const activeMembers = useMemo(() => members.filter((m) => m.endDate >= now.date).length, [members, now.date]);
  const newJoins = useMemo(() => members.filter((m) => monthKey(m.startDate) === month).length, [members, month]);
  const totalDues = useMemo(() => members.reduce((sum, m) => sum + (m.dues ?? 0), 0), [members]);
  const prevMonth = useMemo(() => addMonths(`${month}-01`, -1).slice(0, 7), [month]);
  const prevBooks = useMemo(() => monthBooks(prevMonth, payments, sales, ledger), [prevMonth, payments, sales, ledger]);
  const momChange = prevBooks.totalIn > 0 ? Math.round(((books.totalIn - prevBooks.totalIn) / prevBooks.totalIn) * 100) : null;

  if (!owner) {
    return (
      <Screen header="stack" title="Profit and loss">
        <Empty icon="lock-closed-outline" title="Only the owner sees the books" body="Ask the owner if you need a figure from here." />
      </Screen>
    );
  }

  const start = (dir: LedgerDir) => setDraft({ dir, category: dir === 'out' ? 'Rent' : 'Personal training', amount: '', date: month === thisMonth ? now.date : `${month}-01`, note: '', method: 'UPI' });
  const save = () => {
    if (!draft) return;
    const amount = parseInt(draft.amount, 10);
    if (!(amount >= 1)) return toast.error('Enter the amount.');
    if (!isDate(draft.date)) return toast.error('Enter the date as YYYY-MM-DD.');
    addLedger({ dir: draft.dir, category: draft.category, amount, date: draft.date as ISODate, note: draft.note.trim() || undefined, method: draft.method });
    toast.success(`${draft.dir === 'out' ? 'Expense' : 'Income'} of ${money(amount)} added.`);
    setDraft(null);
    if (monthKey(draft.date) !== month) setMonth(monthKey(draft.date));
  };

  const margin = books.totalIn ? Math.round((books.profit / books.totalIn) * 100) : 0;
  const whoFor = (teamId?: string) => (teamId ? team.find((t) => t.id === teamId)?.name : undefined);

  return (
    <Screen header="stack" title="Profit and loss" subtitle="Memberships, shop sales and other income, against everything you spend.">
      <MonthSwitcher value={month} onChange={setMonth} latest={thisMonth} />

      {/* ── Dashboard stats ── */}
      <Card style={{ gap: 0 }}>
        <View style={s.statsRow}>
          <View style={s.statCell}>
            <Text variant="caption" tone="soft">Active members</Text>
            <Text variant="h3">{activeMembers}</Text>
          </View>
          <View style={[s.statCell, s.statBorder]}>
            <Text variant="caption" tone="soft">New this month</Text>
            <Text variant="h3">{newJoins}</Text>
          </View>
          <View style={[s.statCell, s.statBorder]}>
            <Text variant="caption" tone="soft">Pending dues</Text>
            <Text variant="h3" tone={totalDues > 0 ? 'danger' : 'ink'}>{money(totalDues, { compact: true })}</Text>
          </View>
          <View style={[s.statCell, s.statBorder]}>
            <Text variant="caption" tone="soft">vs last month</Text>
            <Text variant="h3" tone={momChange === null ? 'soft' : momChange >= 0 ? 'success' : 'danger'}>
              {momChange === null ? '—' : `${momChange >= 0 ? '+' : ''}${momChange}%`}
            </Text>
          </View>
        </View>
      </Card>

      <Card style={{ gap: 14 }}>
        <View>
          <Text variant="small" tone="soft">
            {books.profit >= 0 ? 'Profit' : 'Loss'} in {monthLabel(month)}
          </Text>
          <Text variant="display" tone={books.profit < 0 ? 'danger' : 'ink'}>
            {money(books.profit)}
          </Text>
          {books.totalIn && books.profit > 0 ? (
            <Text variant="small" tone="soft">
              You kept {margin}% of what came in
            </Text>
          ) : null}
        </View>
        <View style={s.facts}>
          <Fact label="Money in" value={money(books.totalIn)} tone="success" />
          <Fact label="Money out" value={money(books.totalOut)} tone="danger" />
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button title="Add expense" icon="remove-circle-outline" size="md" style={{ flex: 1 }} onPress={() => start('out')} />
          <Button title="Add income" icon="add-circle-outline" variant="soft" size="md" style={{ flex: 1 }} onPress={() => start('in')} />
        </View>
      </Card>

      <SectionHeader title="Money in" />
      {books.income.length ? (
        <Group inset={16}>
          {books.income.map((l) => (
            <Row
              key={l.label}
              title={l.label}
              value={money(l.amount)}
              valueTone="ink"
              onPress={l.label === 'Memberships' ? () => router.push('/manage/payments') : l.label === 'Shop sales' ? () => router.push('/manage/store') : undefined}
              chevron={l.label === 'Memberships' || l.label === 'Shop sales'}
            />
          ))}
        </Group>
      ) : (
        <Text tone="soft">Nothing came in this month yet.</Text>
      )}

      <SectionHeader title="Money out" hint={books.expenses.length ? 'Where it went, biggest first.' : undefined} />
      {books.expenses.length ? (
        <Card style={{ gap: 14 }}>
          {books.expenses.map((l) => (
            <View key={l.label} style={{ gap: 6 }}>
              <View style={s.line}>
                <Text variant="label" style={{ flex: 1 }}>
                  {l.label}
                </Text>
                <Text variant="smallStrong">{money(l.amount)}</Text>
              </View>
              <ProgressBar value={l.amount / books.totalOut} color={c.danger.solid} />
            </View>
          ))}
        </Card>
      ) : (
        <Text tone="soft">No expenses recorded for this month.</Text>
      )}

      <SectionHeader title="Last six months" />
      <Card style={{ gap: 12 }}>
        {/* Bar chart */}
        <View style={s.chartArea}>
          {(() => {
            const maxVal = Math.max(...trend.map((t) => Math.max(t.b.totalIn, t.b.totalOut)), 1);
            return trend.map(({ m, b }) => (
              <View key={m} style={s.chartCol}>
                <View style={s.bars}>
                  <View style={[s.bar, { height: Math.max(4, (b.totalIn / maxVal) * 80), backgroundColor: c.success.solid }]} />
                  <View style={[s.bar, { height: Math.max(4, (b.totalOut / maxVal) * 80), backgroundColor: c.danger.solid, opacity: 0.7 }]} />
                </View>
                <Text variant="caption" tone={m === month ? 'primary' : 'soft'} style={{ textAlign: 'center' }}>
                  {MONTHS_SHORT[parts(`${m}-01`).m]}
                </Text>
              </View>
            ));
          })()}
        </View>
        {/* Legend */}
        <View style={{ flexDirection: 'row', gap: 16, justifyContent: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: c.success.solid }} />
            <Text variant="caption" tone="soft">Income</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: c.danger.solid }} />
            <Text variant="caption" tone="soft">Expenses</Text>
          </View>
        </View>
        {/* Numbers below chart */}
        <View style={{ gap: 2 }}>
          {trend.map(({ m, b }) => (
            <Row
              key={m}
              title={`${MONTHS_SHORT[parts(`${m}-01`).m]} ${m.slice(0, 4)}`}
              subtitle={`In ${money(b.totalIn, { compact: true })}, out ${money(b.totalOut, { compact: true })}`}
              value={money(b.profit, { compact: true })}
              valueTone={b.profit < 0 ? 'danger' : b.profit > 0 ? 'success' : 'faint'}
              onPress={() => setMonth(m)}
              chevron={false}
            />
          ))}
        </View>
      </Card>

      <SectionHeader title="Entries" hint="Salaries paid from Staff and salaries show up here too. Tap an entry to delete it." action="Salaries" onAction={() => router.push('/manage/payroll')} />
      {entries.length ? (
        <Group inset={16}>
          {entries.map((e) => (
            <Row
              key={e.id}
              title={whoFor(e.teamId) ? `${e.category}: ${whoFor(e.teamId)}` : e.category}
              subtitle={[fmtDate(e.date), e.method, e.teamId ? undefined : e.note].filter(Boolean).join(', ')}
              value={`${e.dir === 'out' ? '−' : '+'}${money(e.amount)}`}
              valueTone={e.dir === 'out' ? 'danger' : 'success'}
              chevron={false}
              onPress={() =>
                confirm({
                  title: 'Delete this entry?',
                  message: `${e.category}, ${money(e.amount)} on ${fmtDate(e.date)}.`,
                  confirmText: 'Delete',
                  destructive: true,
                  onConfirm: () => removeLedger(e.id),
                })
              }
            />
          ))}
        </Group>
      ) : (
        <Text tone="soft">Rent, electricity, stock and machines you add show up here.</Text>
      )}

      <Sheet
        visible={!!draft}
        onClose={() => setDraft(null)}
        title={draft?.dir === 'in' ? 'Add income' : 'Add expense'}
        subtitle={draft?.dir === 'out' ? 'Machines and other big buys count in the month you pay for them.' : 'Memberships and shop sales are added for you.'}
        footer={<Button title="Save" full onPress={save} />}>
        {draft ? (
          <View style={{ gap: 12 }}>
            <View style={s.chips}>
              {(draft.dir === 'out' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).map((cat) => (
                <Chip key={cat} label={cat} selected={draft.category === cat} onPress={() => setDraft({ ...draft, category: cat })} />
              ))}
            </View>
            <Input label="Amount" prefix={brand.currency.symbol} value={draft.amount} onChangeText={(v) => setDraft({ ...draft, amount: v.replace(/\D/g, '').slice(0, 9) })} keyboardType="number-pad" />
            <Input label="Date" value={draft.date} onChangeText={(v) => setDraft({ ...draft, date: v.replace(/[^\d-]/g, '').slice(0, 10) })} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
            <Input label="Note (optional)" value={draft.note} onChangeText={(v) => setDraft({ ...draft, note: v })} placeholder={draft.dir === 'out' ? 'e.g. 2 treadmills from FitPro' : 'e.g. PT package, Rahul'} />
            <View style={s.chips}>
              {METHODS.map((m) => (
                <Chip key={m} label={m} selected={draft.method === m} onPress={() => setDraft({ ...draft, method: m })} />
              ))}
            </View>
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}

const useStyles = makeStyles(({ c }) => ({
  facts: { flexDirection: 'row', gap: 32 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  // stats row
  statsRow: { flexDirection: 'row' },
  statCell: { flex: 1, padding: 14, gap: 4 },
  statBorder: { borderLeftWidth: 1, borderLeftColor: c.line },
  // bar chart
  chartArea: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 100, paddingHorizontal: 4 },
  chartCol: { flex: 1, alignItems: 'center', gap: 6 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, flex: 1, width: '100%' },
  bar: { flex: 1, borderRadius: 3 },
}));
