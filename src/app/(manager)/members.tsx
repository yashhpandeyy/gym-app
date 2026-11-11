import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, View } from 'react-native';

import { Avatar, Chip, Empty, IconButton, Input, Screen, StatusPill, Text } from '@/components/ui';
import { diffDays, fmtDate, fmtDay, fmtRelativeInline, plural } from '@/lib/date';
import { awayAfterDays, awayMembers, awayMessageFor, awayTemplate, membership, type Away, type MembershipInfo } from '@/lib/domain';
import { firstName, money } from '@/lib/format';
import { useNow } from '@/lib/hooks';
import { whatsapp } from '@/lib/native';
import { useApp, type Member } from '@/store';
import { gutter, makeStyles, useTheme } from '@/theme';

type Filter = 'all' | 'active' | 'ending' | 'dues' | 'couples' | 'away' | 'paused' | 'expired';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'ending', label: 'Ending soon' },
  { key: 'dues', label: 'Dues' },
  { key: 'couples', label: 'Couples' },
  { key: 'away', label: 'Not coming' },
  { key: 'paused', label: 'Paused' },
  { key: 'expired', label: 'Expired' },
];

function matches(f: Filter, m: Member, info: MembershipInfo, away: Map<string, Away>) {
  switch (f) {
    case 'all':
      return true;
    case 'away':
      return away.has(m.id);
    case 'active':
      return info.status === 'active';
    case 'ending':
      return info.expiringSoon;
    case 'dues':
      return m.dues > 0;
    case 'couples':
      return !!m.partnerName || !!m.isPartner || m.pricingTag === 'Couple';
    case 'paused':
      return info.status === 'paused';
    case 'expired':
      return info.status === 'expired';
  }
}

export default function Members() {
  const s = useStyles();
  const params = useLocalSearchParams<{ filter?: Filter }>();
  const now = useNow(60_000);
  const members = useApp((st) => st.members);
  const plans = useApp((st) => st.plans);
  const pauses = useApp((st) => st.pauses);
  const checkins = useApp((st) => st.checkins);
  const settings = useApp((st) => st.settings);
  const updateMember = useApp((st) => st.updateMember);
  const gymName = useApp((st) => st.brandOverride?.name ?? st.link?.gymName ?? '');
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
  const afterDays = awayAfterDays(settings);
  const away = useMemo(
    () => new Map(awayMembers({ members, plans, pauses, checkins }, now.date, afterDays).map((a) => [a.member.id, a])),
    [members, plans, pauses, checkins, now.date, afterDays],
  );
  const counts = Object.fromEntries(FILTERS.map((f) => [f.key, rows.filter((r) => matches(f.key, r.m, r.info, away)).length])) as Record<Filter, number>;
  const q = query.trim().toLowerCase();
  const digits = q.replace(/\D/g, '');
  const listed = rows.filter(
    (r) =>
      matches(filter, r.m, r.info, away) &&
      (!q || r.m.name.toLowerCase().includes(q) || r.m.code.toLowerCase().includes(q) || (digits.length >= 3 && r.m.phone.includes(digits))),
  );
  // Longest away first, so the people most likely to quit are at the top.
  const visible = filter === 'away' ? [...listed].sort((a, b) => (away.get(b.m.id)?.days ?? 0) - (away.get(a.m.id)?.days ?? 0)) : listed;
  const nudge = (a: Away) => {
    whatsapp(a.member.phone, awayMessageFor(awayTemplate(settings), a.member, a.days, gymName));
    updateMember(a.member.id, { nudgedOn: now.date });
  };

  return (
    <Screen
      title="Members"
      subtitle={`${counts.active} training, ${members.length} on the books`}
      scroll={false}
      right={<IconButton icon="person-add-outline" label="Add member" variant="soft" onPress={() => router.push('/manage/add-member')} />}
      left={<View />}>
      <View style={{ marginTop: 2 }}>
        <Input icon="search" placeholder="Search name, phone or member ID" value={query} onChangeText={setQuery} autoCorrect={false} returnKeyType="search" />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterScroll} contentContainerStyle={s.filters}>
        {FILTERS.map((f) => (
          <Chip key={f.key} label={f.label} count={counts[f.key]} selected={filter === f.key} onPress={() => setFilter(f.key)} />
        ))}
      </ScrollView>
      {filter === 'away' ? (
        <Text variant="small" tone="soft" style={{ marginTop: -8, marginBottom: 12 }}>
          Active members with no visit in {plural(afterDays, 'day')} or more. Tap the WhatsApp button to send your check-in message.
        </Text>
      ) : null}
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
        renderItem={({ item: { m, info } }) => (
          <MemberRow
            m={m}
            info={info}
            today={now.date}
            filter={filter}
            gymName={gymName}
            away={filter === 'away' ? away.get(m.id) : undefined}
            onNudge={nudge}
          />
        )}
      />
    </Screen>
  );
}

function MemberRow({
  m,
  info,
  today,
  filter,
  gymName,
  away,
  onNudge,
}: {
  m: Member;
  info: MembershipInfo;
  today: string;
  filter: Filter;
  gymName: string;
  away?: Away;
  onNudge: (a: Away) => void;
}) {
  const { c } = useTheme();
  const s = useStyles();
  let line: string;
  if (away) {
    const nudged = m.nudgedOn ? diffDays(m.nudgedOn, today) : null;
    line = `${away.lastVisit ? `Last came ${fmtDay(away.lastVisit)}, ${plural(away.days, 'day')} ago` : `No visit in ${plural(away.days, 'day')}`}${nudged === null ? '' : nudged === 0 ? '. Messaged today' : `. Messaged ${plural(nudged, 'day')} ago`}`;
  } else switch (info.status) {
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
      line = info.expiringSoon ? `Ends ${fmtRelativeInline(info.end, today)} (${fmtDate(info.end)})` : `${info.plan?.name ?? 'Plan'} until ${fmtDay(info.end)}`;
  }

  // Extra metadata badges (couple, tags, dues date)
  const meta: string[] = [];
  if (m.partnerName) meta.push(`Couple with ${m.partnerName}`);
  if (m.pricingTag && m.pricingTag !== 'Couple') meta.push(m.pricingTag);
  if (m.dues > 0) {
    meta.push(m.duePaymentDate ? `${money(m.dues)} due by ${fmtDate(m.duePaymentDate)}` : `${money(m.dues)} due`);
  }

  const showAction = away || filter === 'ending' || filter === 'dues';

  const onActionPress = () => {
    if (away) return onNudge(away);
    if (filter === 'ending') {
      whatsapp(
        m.phone,
        `Hi ${firstName(m.name)}, a friendly reminder from ${gymName || 'your gym'}: your membership ends on ${fmtDate(info.end)}. Reach out to renew your plan and keep your training streak going!`,
      );
    } else if (filter === 'dues') {
      whatsapp(
        m.phone,
        `Hi ${firstName(m.name)}, a friendly reminder from ${gymName || 'your gym'}: ${money(m.dues)} is pending on your membership${m.duePaymentDate ? ` (due date: ${fmtDate(m.duePaymentDate)})` : ''}. You can pay by UPI or at the front desk. Thank you!`,
      );
    }
  };

  const actionTooltip =
    filter === 'ending'
      ? `Remind ${firstName(m.name)} about membership renewal`
      : filter === 'dues'
        ? `Send dues reminder to ${firstName(m.name)}`
        : `Message ${m.name}`;

  const row = (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/manage/member/${m.id}`)}
      style={({ pressed }) => [s.row, showAction && { flex: 1, paddingRight: 8 }, pressed && { backgroundColor: c.surfaceAlt }]}>
      <Avatar name={m.name} size={42} />
      <View style={{ flex: 1, gap: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text variant="label" numberOfLines={1}>
            {m.name}
          </Text>
          {m.partnerName ? (
            <Text variant="caption" style={{ color: c.primary, fontWeight: '600' }}>
              👫 Couple
            </Text>
          ) : null}
        </View>
        <Text variant="small" tone={m.dues > 0 && filter === 'dues' ? 'danger' : 'soft'} numberOfLines={1}>
          {line}
          {meta.length > 0 && !line.includes('due') ? ` • ${meta.join(' • ')}` : ''}
        </Text>
      </View>
      {showAction ? null : <StatusPill status={info.expiringSoon ? 'expiring' : info.status} />}
    </Pressable>
  );

  if (!showAction) return row;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingRight: 16 }}>
      {row}
      <IconButton
        icon="logo-whatsapp"
        label={actionTooltip}
        variant="soft"
        size={38}
        onPress={onActionPress}
      />
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  // flexShrink 0: without it the chip row is squashed by the list below and the chips lose their bottom edge.
  filterScroll: { flexGrow: 0, flexShrink: 0, marginHorizontal: -gutter },
  filters: { paddingHorizontal: gutter, gap: 8, paddingTop: 14, paddingBottom: 18 },
  list: { backgroundColor: t.c.surface, borderRadius: t.radius.lg, overflow: 'hidden', marginBottom: 28 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13 },
  sep: { height: 1, backgroundColor: t.c.line, marginLeft: 74 },
}));
