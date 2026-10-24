import type { ReactNode } from 'react';
import { View } from 'react-native';

import { clockParts, fmtTime, plural } from '@/lib/date';
import type { SlotState } from '@/lib/domain';
import { makeStyles, useTheme } from '@/theme';

import { SpotMeter } from './Meters';
import { Button, Pill, Text } from './ui';

export function SessionRow({
  start,
  end,
  title,
  meta,
  state,
  blocked,
  bookLabel = 'Book',
  waitlistEnabled = true,
  onBook,
  onCancel,
  onWaitlist,
}: {
  start: string;
  end: string;
  title?: string;
  meta?: string;
  state: SlotState;
  blocked?: boolean;
  bookLabel?: string;
  waitlistEnabled?: boolean;
  onBook?: () => void;
  onCancel?: () => void;
  onWaitlist?: () => void;
}) {
  const { c } = useTheme();
  const s = useStyles();
  const a = clockParts(start);
  const b = clockParts(end);
  const inactive = !!state.closure || state.over || blocked;

  let status: string;
  let statusTone: 'soft' | 'warning' | 'danger' | 'primary' | 'faint' = 'soft';
  if (state.closure) status = `Closed for ${state.closure.reason.toLowerCase()}`;
  else if (state.over) status = state.mine ? 'You trained in this slot' : 'Finished';
  else if (state.started) status = state.mine ? `You're in. Started at ${fmtTime(start)}` : 'In progress';
  else if (state.mine) status = `You're in, ${state.count} of ${state.capacity} going`;
  else if (state.myWait) {
    status = `You're number ${state.waitPosition} on the waitlist`;
    statusTone = 'primary';
  } else if (state.left === 0) {
    status = state.waitlist.length ? `Full, ${state.waitlist.length} waiting` : 'Full';
    statusTone = 'danger';
  } else if (state.left <= 5) {
    status = `Only ${plural(state.left, 'spot')} left`;
    statusTone = 'warning';
  } else status = `${state.left} of ${state.capacity} spots free`;
  if (state.closure || state.over) statusTone = 'faint';

  let action: ReactNode = null;
  if (!state.closure && !state.over && !state.started && !blocked) {
    if (state.mine) action = <Button title="Cancel" variant="outline" size="sm" onPress={onCancel} />;
    else if (state.myWait) action = <Button title="Leave list" variant="outline" size="sm" onPress={onCancel} />;
    else if (state.left === 0)
      action = waitlistEnabled ? <Button title="Join waitlist" variant="soft" size="sm" onPress={onWaitlist} /> : null;
    else action = <Button title={bookLabel} variant="primary" size="sm" onPress={onBook} />;
  }

  return (
    <View
      style={[
        s.row,
        state.mine && !state.over ? { borderColor: c.primary, backgroundColor: c.primarySoft } : null,
        inactive ? { opacity: 0.6 } : null,
      ]}>
      <View style={s.top}>
        <View style={{ flex: 1, gap: 2 }}>
          {title ? (
            <View style={s.titleRow}>
              <Text variant="h3" numberOfLines={1} style={{ flexShrink: 1 }}>
                {title}
              </Text>
              {state.mine && !state.over ? <Pill label="Booked" tone="primary" solid /> : null}
            </View>
          ) : null}
          <View style={s.timeRow}>
            <Text variant={title ? 'label' : 'h2'}>{a.suffix === b.suffix ? `${a.clock} – ${b.clock}` : `${a.clock} ${a.suffix} – ${b.clock}`}</Text>
            <Text variant={title ? 'label' : 'smallStrong'} tone="soft">
              {b.suffix}
            </Text>
            {!title && state.mine && !state.over ? <Pill label="Booked" tone="primary" solid style={{ marginLeft: 6 }} /> : null}
          </View>
          {meta ? (
            <Text variant="small" tone="soft" numberOfLines={1}>
              {meta}
            </Text>
          ) : null}
        </View>
        {action}
      </View>
      {!state.closure ? (
        <View style={{ marginTop: 12 }}>
          <SpotMeter count={state.count} capacity={state.capacity} level={state.level} mine={!!state.mine} dim={state.over} />
        </View>
      ) : null}
      <Text variant="caption" tone={statusTone} style={{ marginTop: 8 }}>
        {status}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  row: {
    backgroundColor: t.c.surface,
    borderRadius: t.radius.lg,
    padding: 14,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
}));
