import { GameColors } from '@/constants/theme';
import type { ShipType, ShotPhase } from '@/models/types';
import { translateShipType } from '@/models/types';
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
  t: (key: string, options?: Record<string, string>) => string,
) {
  // Divider verdict flash (HIT / MISS / SUNK)
  const [verdictFlash, setVerdictFlash] = useState<{ text: string; color: string } | null>(null);
  const verdictOpacity = useSharedValue(0);

  useEffect(() => {
    if (shotPhase?.beat !== 'verdict' || !shotPhase.result) return;

    const { result } = shotPhase;
    const text =
      result === 'sunk'
        ? t('verdict.sunk')
        : result === 'hit'
          ? t('verdict.hit')
          : t('verdict.miss');
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

    const timeoutId = setTimeout(() => setVerdictFlash(null), 120 + hold + 200);
    return () => clearTimeout(timeoutId);
  }, [shotPhase, verdictOpacity, t]);

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
    const shipName = translateShipType(sunkEvent.shipType, t);
    const text =
      sunkEvent.owner === 'enemy'
        ? t('sunkLabel.enemy', { ship: shipName })
        : t('sunkLabel.player', { ship: shipName });
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
    const timeoutId = setTimeout(() => setSunkLabel(null), 1600);
    return () => clearTimeout(timeoutId);
  }, [labelOpacity, labelTranslateY, sunkEvent, t]);

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
