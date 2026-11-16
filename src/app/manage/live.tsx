import { useState } from 'react';
import { TouchableOpacity, View } from 'react-native';

import { Avatar, Empty, Group, Icon, Row, Screen, Segmented, Text } from '@/components/ui';
import { today, stampToDate, diffDays, fmtRelativeDay } from '@/lib/date';
import { membership } from '@/lib/domain';
import { call, whatsapp } from '@/lib/native';
import { useApp } from '@/store';
import { makeStyles, useTheme } from '@/theme';

export default function LiveAttendance() {
  const { c } = useTheme();
  const s = useStyles();
  const t = today();

  const members = useApp((st) => st.members);
  const plans = useApp((st) => st.plans);
  const pauses = useApp((st) => st.pauses);
  const checkins = useApp((st) => st.checkins);

  const [tab, setTab] = useState<'present' | 'absent'>('present');

  // Members who are on an active plan today
  const activeMembers = members.filter((m) => {
    const info = membership(m, plans, pauses, t);
    return info.status === 'active';
  });

  // Set of memberIds who checked in today
  const checkedInToday = new Map<string, string>(); // memberId → checkin timestamp
  for (const ci of checkins) {
    if (stampToDate(ci.at) === t) {
      // keep the latest check-in if somehow multiple
      if (!checkedInToday.has(ci.memberId) || ci.at > checkedInToday.get(ci.memberId)!) {
        checkedInToday.set(ci.memberId, ci.at);
      }
    }
  }

  const present = activeMembers.filter((m) => checkedInToday.has(m.id));
  const absent = activeMembers.filter((m) => !checkedInToday.has(m.id));

  // Last visit for absent members
  const lastVisit = new Map<string, string>();
  for (const ci of checkins) {
    const d = stampToDate(ci.at);
    const prev = lastVisit.get(ci.memberId);
    if (!prev || d > prev) lastVisit.set(ci.memberId, d);
  }

  function fmtCheckinTime(stamp: string) {
    const d = new Date(stamp);
    const h = d.getHours();
    const m = d.getMinutes();
    const ampm = h >= 12 ? 'pm' : 'am';
    return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${ampm}`;
  }

  function waMsg(name: string) {
    return `Hi ${name}! We missed you at the gym today. Hope to see you soon! 💪`;
  }

  return (
    <Screen header="stack" title="Who's here today" subtitle={`${present.length} in · ${absent.length} away`}>
      <Segmented<'present' | 'absent'>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'present', label: `Here now (${present.length})` },
          { value: 'absent', label: `Away today (${absent.length})` },
        ]}
      />

      {tab === 'present' && (
        <>
          {present.length === 0 ? (
            <Empty icon="body-outline" title="No one checked in yet" body="Members will appear here as they scan in." />
          ) : (
            <Group style={{ marginTop: 16 }}>
              {present.map((m) => {
                const checkinStamp = checkedInToday.get(m.id)!;
                return (
                  <View key={m.id} style={s.memberRow}>
                    <View style={s.rowLeft}>
                      <Avatar name={m.name} size={36} />
                      <View style={{ flex: 1 }}>
                        <Text variant="bodyStrong">{m.name}</Text>
                        <Text variant="small" tone="soft">In at {fmtCheckinTime(checkinStamp)}</Text>
                      </View>
                    </View>
                    <View style={s.actions}>
                      <TouchableOpacity style={[s.actionBtn, { backgroundColor: c.success.bg }]} onPress={() => call(m.phone)}>
                        <Icon name="call-outline" size={18} color={c.success.solid} />
                      </TouchableOpacity>
                      <TouchableOpacity style={[s.actionBtn, { backgroundColor: c.primary + '20' }]} onPress={() => whatsapp(m.phone, waMsg(m.name))}>
                        <Icon name="logo-whatsapp" size={18} color={c.primary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </Group>
          )}
        </>
      )}

      {tab === 'absent' && (
        <>
          {absent.length === 0 ? (
            <Empty icon="checkmark-circle-outline" title="Everyone's here!" body="All active members have checked in today." />
          ) : (
            <Group style={{ marginTop: 16 }}>
              {absent.map((m) => {
                const lv = lastVisit.get(m.id);
                const daysAgo = lv ? diffDays(lv, t) : null;
                const subtitle = lv
                  ? daysAgo === 0 ? 'Was here earlier today' : daysAgo === 1 ? 'Last seen yesterday' : `Last seen ${fmtRelativeDay(lv, t)}`
                  : 'Never checked in';
                return (
                  <View key={m.id} style={s.memberRow}>
                    <View style={s.rowLeft}>
                      <Avatar name={m.name} size={36} />
                      <View style={{ flex: 1 }}>
                        <Text variant="bodyStrong">{m.name}</Text>
                        <Text variant="small" tone={daysAgo !== null && daysAgo > 7 ? 'danger' : 'soft'}>{subtitle}</Text>
                      </View>
                    </View>
                    <View style={s.actions}>
                      <TouchableOpacity style={[s.actionBtn, { backgroundColor: c.success.bg }]} onPress={() => call(m.phone)}>
                        <Icon name="call-outline" size={18} color={c.success.solid} />
                      </TouchableOpacity>
                      <TouchableOpacity style={[s.actionBtn, { backgroundColor: c.primary + '20' }]} onPress={() => whatsapp(m.phone, waMsg(m.name))}>
                        <Icon name="logo-whatsapp" size={18} color={c.primary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </Group>
          )}
        </>
      )}
    </Screen>
  );
}

const useStyles = makeStyles((t) => ({
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: t.c.line,
  },
  rowLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
