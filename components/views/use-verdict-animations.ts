import { GameColors } from '@/constants/theme';
import type { ShipType, ShotPhase } from '@/models/types';
import { useEffect, useState } from 'react';
import {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

type SunkEvent = { shipType: ShipType; owner: 'player' | 'enemy' } | null;

export function useVerdictAnimations(
  shotPhase: ShotPhase | undefined,
  sunkEvent: SunkEvent | undefined,
) {
  // Divider verdict flash (HIT / MISS / SUNK)
  const [verdictFlash, setVerdictFlash] = useState<{ text: string; color: string } | null>(null);
  const verdictOpacity = useSharedValue(0);

  useEffect(() => {
    if (shotPhase?.beat !== 'verdict' || !shotPhase.result) return;

    const { result } = shotPhase;
    const text = result === 'sunk' ? 'SUNK!' : result === 'hit' ? 'HIT!' : 'MISS';
    const color = result === 'miss' ? GameColors.verdictMiss : GameColors.gold;

    setVerdictFlash({ text, color });
    verdictOpacity.value = 0;

    // Hold durations: MISS ~400 ms visible, HIT ~700 ms, SUNK ~1000 ms
    const hold = result === 'sunk' ? 1000 : result === 'hit' ? 700 : 400;
    verdictOpacity.value = withSequence(
      withTiming(1, { duration: 120, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: hold }),
      withTiming(0, { duration: 200, easing: Easing.in(Easing.cubic) }),
    );

    const t = setTimeout(() => setVerdictFlash(null), 120 + hold + 200);
    return () => clearTimeout(t);
  }, [shotPhase, verdictOpacity]);

  const regularTextStyle = useAnimatedStyle(() => ({
    opacity: 1 - verdictOpacity.value,
  }));
  const verdictTextStyle = useAnimatedStyle(() => ({
    opacity: verdictOpacity.value,
  }));

  // Floating sunk label
  const [sunkLabel, setSunkLabel] = useState<{ text: string; color: string } | null>(null);
  const labelOpacity = useSharedValue(0);
  const labelTranslateY = useSharedValue(0);

  useEffect(() => {
    if (!sunkEvent) return;
    const text =
      sunkEvent.owner === 'enemy'
        ? `${sunkEvent.shipType.toUpperCase()} SUNK`
        : `${sunkEvent.shipType.toUpperCase()} LOST`;
    const color = sunkEvent.owner === 'enemy' ? GameColors.gold : GameColors.red;
    setSunkLabel({ text, color });
    labelOpacity.value = 0;
    labelTranslateY.value = 10;
    labelOpacity.value = withSequence(
      withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: 300 }),
      withTiming(0, { duration: 900, easing: Easing.in(Easing.cubic) }),
    );
    labelTranslateY.value = withTiming(-50, { duration: 1500, easing: Easing.out(Easing.cubic) });
    const t = setTimeout(() => setSunkLabel(null), 1600);
    return () => clearTimeout(t);
  }, [labelOpacity, labelTranslateY, sunkEvent]);

  const sunkLabelStyle = useAnimatedStyle(() => ({
    opacity: labelOpacity.value,
    transform: [{ translateY: labelTranslateY.value }],
  }));

  return {
    verdictFlash,
    regularTextStyle,
    verdictTextStyle,
    sunkLabel,
    sunkLabelStyle,
  };
}
