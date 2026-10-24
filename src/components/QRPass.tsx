import { useEffect, useState } from 'react';
import { View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { memberQRValue } from '@/lib/domain';
import type { Member } from '@/store/types';
import { useTheme } from '@/theme';

import { Ring, Text } from './ui';

const WINDOW = 30;

/**
 * A pass that re-draws every 30 seconds. The desk scanner rejects codes older than about
 * a minute, so a screenshot shared with a friend stops working almost immediately.
 */
export function QRPass({ member, size = 220, disabled }: { member: Member; size?: number; disabled?: boolean }) {
  const { c } = useTheme();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const secondsLeft = WINDOW - (Math.floor(now / 1000) % WINDOW);
  const value = memberQRValue(member, WINDOW, now);

  return (
    <View style={{ alignItems: 'center', gap: 16 }}>
      <View
        style={{
          padding: 14,
          backgroundColor: '#FFFFFF',
          borderRadius: 20,
          opacity: disabled ? 0.18 : 1,
        }}
        accessible
        accessibilityLabel="Your check-in code">
        <QRCode value={value} size={size} color="#10141C" backgroundColor="#FFFFFF" ecl="M" />
      </View>
      {!disabled ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Ring size={26} stroke={3.5} value={secondsLeft / WINDOW} track={c.line}>
            <Text variant="micro" tone="soft" style={{ fontSize: 9 }}>
              {secondsLeft}
            </Text>
          </Ring>
          <Text variant="small" tone="soft">
            New code in {secondsLeft}s
          </Text>
        </View>
      ) : null}
    </View>
  );
}
