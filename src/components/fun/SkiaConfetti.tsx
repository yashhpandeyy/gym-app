import { Canvas, createPicture, Picture, Skia } from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { Easing, useDerivedValue, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { rng } from '@/lib/format';
import { useTheme } from '@/theme';

type Origin = { x?: number; y?: number };

/**
 * GPU confetti: 180 paper pieces drawn into one Skia picture per frame on the UI thread,
 * so it stays smooth on mid-range Android phones. Pieces flutter (they flip as they fall),
 * drift sideways and fade out at the end.
 */
export function Confetti({ count = 180, seed = 'confetti', origin }: { count?: number; seed?: string; origin?: Origin }) {
  const { c } = useTheme();
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const t = useSharedValue(0);

  const pieces = useMemo(() => {
    const r = rng(seed);
    const colors = [c.primary, c.success.solid, c.warning.solid, c.danger.solid, c.ice.solid, '#FFFFFF', '#FFD34D'];
    return Array.from({ length: count }, () => ({
      vx: (r() - 0.5) * width * 1.2,
      vy: -height * (0.3 + r() * 0.45),
      spin: (r() - 0.5) * 1440,
      flip: 6 + r() * 10,
      w: 6 + r() * 7,
      h: 3 + r() * 5,
      round: r() < 0.25,
      color: colors[Math.floor(r() * colors.length)],
      delay: r() * 0.12,
      sway: 10 + r() * 30,
    }));
  }, [count, seed, width, height, c]);

  useEffect(() => {
    if (!reduced) t.value = withTiming(1, { duration: 2400, easing: Easing.out(Easing.quad) });
  }, [reduced, t]);

  const ox = origin?.x ?? width / 2;
  const oy = origin?.y ?? height * 0.42;
  const picture = useDerivedValue(() => {
    return createPicture((canvas) => {
      const paint = Skia.Paint();
      for (let i = 0; i < pieces.length; i++) {
        const p = pieces[i];
        const k = Math.max(0, Math.min(1, (t.value - p.delay) / (1 - p.delay)));
        if (k <= 0) continue;
        const x = ox + p.vx * k + Math.sin(k * p.flip) * p.sway;
        const y = oy + p.vy * k + height * 0.95 * k * k;
        const alpha = k < 0.8 ? 1 : (1 - k) / 0.2;
        paint.setColor(Skia.Color(p.color));
        paint.setAlphaf(alpha);
        canvas.save();
        canvas.translate(x, y);
        canvas.rotate(p.spin * k, 0, 0);
        // Flipping paper: squash one axis with a cosine so pieces catch the light.
        canvas.scale(Math.cos(k * p.flip), 1);
        if (p.round) canvas.drawCircle(0, 0, p.w / 2, paint);
        else canvas.drawRect(Skia.XYWHRect(-p.w / 2, -p.h / 2, p.w, p.h), paint);
        canvas.restore();
      }
    });
  });

  if (reduced) return null;
  return (
    <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Picture picture={picture} />
    </Canvas>
  );
}
