import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, View } from 'react-native';

import { Avatar, Chip, Empty, IconButton, Input, Screen, StatusPill, Text } from '@/components/ui';
import { fmtDay, fmtRelativeInline } from '@/lib/date';
import { membership, type MembershipInfo } from '@/lib/domain';
import { money } from '@/lib/format';
import { useNow } from '@/lib/hooks';
import { useApp, type Member } from '@/store';
import { gutter, makeStyles, useTheme } from '@/theme';

type Filter = 'all' | 'active' | 'ending' | 'paused' | 'expired' | 'dues';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'ending', label: 'Ending soon' },
  { key: 'paused', label: 'Paused' },
  { key: 'expired', label: 'Expired' },
  { key: 'dues', label: 'Dues' },
];

function matches(f: Filter, m: Member, info: MembershipInfo) {
  switch (f) {
    case 'all':
      return true;
    case 'active':
      return info.status === 'active';
    case 'ending':
      return info.expiringSoon;
    case 'paused':
      return info.status === 'paused';
    case 'expired':
      return info.status === 'expired';
    case 'dues':
      return m.dues > 0;
  }
}

export default function Members() {
  const s = useStyles();
  const params = useLocalSearchParams<{ filter?: Filter }>();
  const now = useNow(60_000);
  const members = useApp((st) => st.members);
  const plans = useApp((st) => st.plans);
  const pauses = useApp((st) => st.pauses);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>(params.filter ?? 'all');
  const [lastParam, setLastParam] = useState(params.filter);
  if (params.filter !== lastParam) {
    setLastParam(params.filter);
    if (params.filter) setFilter(params.filter);
  }

  const rows = useMemo(
    () =>
      members
        .map((m) => ({ m, info: membership(m, plans, pauses, now.date) }))
        .sort((a, b) => a.m.name.localeCompare(b.m.name)),
    [members, plans, pauses, now.date],
  );
  const counts = Object.fromEntries(FILTERS.map((f) => [f.key, rows.filter((r) => matches(f.key, r.m, r.info)).length])) as Record<Filter, number>;
  const q = query.trim().toLowerCase();
  const digits = q.replace(/\D/g, '');
  const visible = rows.filter(
    (r) =>
      matches(filter, r.m, r.info) &&
      (!q || r.m.name.toLowerCase().includes(q) || r.m.code.toLowerCase().includes(q) || (digits.length >= 3 && r.m.phone.includes(digits))),
  );

  return (
    <Screen
      title="Members"
      subtitle={`${counts.active} training, ${members.length} on the books`}
      scroll={false}
      right={<IconButton icon="person-add-outline" label="Add member" variant="soft" onPress={() => router.push('/manage/add-member')} />}
      left={<View />}>
      <View style={{ marginTop: -6 }}>
        <Input icon="search" placeholder="Search name, phone or member ID" value={query} onChangeText={setQuery} autoCorrect={false} returnKeyType="search" />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterScroll} contentContainerStyle={s.filters}>
        {FILTERS.map((f) => (
          <Chip key={f.key} label={f.label} count={counts[f.key]} selected={filter === f.key} onPress={() => setFilter(f.key)} />
        ))}
      </ScrollView>
      <FlatList
        data={visible}
        keyExtractor={(r) => r.m.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={s.list}
        initialNumToRender={14}
        ItemSeparatorComponent={() => <View style={s.sep} />}
        ListEmptyComponent={
          <Empty icon="search-outline" title="No members match" body="Try another name or clear the filter." action="Show everyone" onAction={() => { setFilter('all'); setQuery(''); }} />
        }
        renderItem={({ item: { m, info } }) => <MemberRow m={m} info={info} today={now.date} />}
      />
    </Screen>
  );
}

function MemberRow({ m, info, today }: { m: Member; info: MembershipInfo; today: string }) {
  const { c } = useTheme();
  const s = useStyles();
  let line: string;
  switch (info.status) {
    case 'paused':
      line = `Paused until ${fmtDay(info.activePause!.end)}`;
      break;
    case 'expired':
      line = `Ended ${fmtDay(info.end)}`;
      break;
    case 'upcoming':
      line = `Starts ${fmtDay(info.start)}`;
      break;
    default:
      line = info.expiringSoon ? `Ends ${fmtRelativeInline(info.end, today)}` : `${info.plan?.name ?? 'Plan'} until ${fmtDay(info.end)}`;
  }
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/manage/member/${m.id}`)}
      style={({ pressed }) => [s.row, pressed && { backgroundColor: c.surfaceAlt }]}>
      <Avatar name={m.name} size={42} />
      <View style={{ flex: 1, gap: 1 }}>
        <Text variant="label" numberOfLines={1}>
          {m.name}
        </Text>
        <Text variant="small" tone="soft" numberOfLines={1}>
          {line}
          {m.dues > 0 ? `, ${money(m.dues)} due` : ''}
        </Text>
      </View>
      <StatusPill status={info.expiringSoon ? 'expiring' : info.status} />
    </Pressable>
  );
}

const useStyles = makeStyles((t) => ({
  filterScroll: { flexGrow: 0, marginHorizontal: -gutter },
  filters: { paddingHorizontal: gutter, gap: 8, paddingVertical: 14 },
  list: { backgroundColor: t.c.surface, borderRadius: t.radius.lg, overflow: 'hidden', marginBottom: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 11 },
  sep: { height: 1, backgroundColor: t.c.line, marginLeft: 68 },
}));
