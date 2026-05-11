import type { ShotPhase } from '@/models/types';
import { useEffect } from 'react';
import {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

export function useScreenShake(shotPhase: ShotPhase | undefined) {
  const shakeX = useSharedValue(0);
  const shakeY = useSharedValue(0);

  useEffect(() => {
    if (shotPhase?.beat !== 'impact') return;
    // 4 oscillations over ~200 ms, decaying amplitude
    shakeX.value = withSequence(
      withTiming(3, { duration: 25 }),
      withTiming(-3, { duration: 25 }),
      withTiming(2.5, { duration: 25 }),
      withTiming(-2.5, { duration: 25 }),
      withTiming(2, { duration: 25 }),
      withTiming(-2, { duration: 25 }),
      withTiming(1, { duration: 25 }),
      withTiming(-1, { duration: 25 }),
      withTiming(0, { duration: 25 }),
    );
    shakeY.value = withSequence(
      withTiming(-2, { duration: 25 }),
      withTiming(2, { duration: 25 }),
      withTiming(-2, { duration: 25 }),
      withTiming(2, { duration: 25 }),
      withTiming(-1, { duration: 25 }),
      withTiming(1, { duration: 50 }),
      withTiming(0, { duration: 50 }),
    );
  }, [shotPhase?.beat, shakeX, shakeY]);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }, { translateY: shakeY.value }],
  }));

  return { shakeX, shakeY, shakeStyle };
}
