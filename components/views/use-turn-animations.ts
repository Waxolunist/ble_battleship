import { GameColors } from '@/constants/theme';
import type { ShipType } from '@/models/types';
import { useEffect, useState } from 'react';
import {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

type SunkEvent = { shipType: ShipType; owner: 'player' | 'enemy' } | null;

export function useTurnAnimations(turn: 'player' | 'enemy', sunkEvent: SunkEvent | undefined) {
  // 0 = player's turn, 1 = enemy's turn
  const turnSV = useSharedValue(0);
  const glowPulse = useSharedValue(0.4);
  const dividerPulse = useSharedValue(0.25);

  useEffect(() => {
    glowPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.35, { duration: 800, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    dividerPulse.value = withRepeat(
      withSequence(
        withTiming(0.9, { duration: 700, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.2, { duration: 700, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [dividerPulse, glowPulse]);

  useEffect(() => {
    turnSV.value = withTiming(turn === 'player' ? 0 : 1, { duration: 400 });
  }, [turn, turnSV]);

  const playerFieldStyle = useAnimatedStyle(() => ({
    opacity: interpolate(turnSV.value, [0, 1], [0.55, 1]),
  }));
  const enemyFieldStyle = useAnimatedStyle(() => ({
    opacity: interpolate(turnSV.value, [0, 1], [1, 0.55]),
  }));
  const enemyGlowStyle = useAnimatedStyle(() => ({
    opacity: (1 - turnSV.value) * glowPulse.value,
  }));
  const playerGlowStyle = useAnimatedStyle(() => ({
    opacity: turnSV.value * glowPulse.value,
  }));
  const dividerLineStyle = useAnimatedStyle(() => ({
    opacity: dividerPulse.value,
  }));

  // Counter pop + flash on sunk event
  const playerCountScale = useSharedValue(1);
  const enemyCountScale = useSharedValue(1);
  const playerFlashOpacity = useSharedValue(0);
  const enemyFlashOpacity = useSharedValue(0);
  const [playerFlashColor, setPlayerFlashColor] = useState<string | null>(null);
  const [enemyFlashColor, setEnemyFlashColor] = useState<string | null>(null);

  useEffect(() => {
    if (!sunkEvent) return;

    const scaleSV = sunkEvent.owner === 'player' ? playerCountScale : enemyCountScale;
    const flashOpacitySV = sunkEvent.owner === 'player' ? playerFlashOpacity : enemyFlashOpacity;
    const flashColor = sunkEvent.owner === 'player' ? GameColors.red : GameColors.gold;
    const setFlash = sunkEvent.owner === 'player' ? setPlayerFlashColor : setEnemyFlashColor;

    setFlash(flashColor);
    scaleSV.value = withSequence(
      withTiming(1.4, { duration: 200 }),
      withTiming(1, { duration: 200 }),
    );
    flashOpacitySV.value = withSequence(
      withTiming(1, { duration: 80 }),
      withTiming(1, { duration: 240 }),
      withTiming(0, { duration: 200 }),
    );
    const t = setTimeout(() => setFlash(null), 520);
    return () => clearTimeout(t);
  }, [sunkEvent, playerCountScale, enemyCountScale, playerFlashOpacity, enemyFlashOpacity]);

  const playerCountScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: playerCountScale.value }],
  }));
  const enemyCountScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: enemyCountScale.value }],
  }));
  const playerFlashOpacityStyle = useAnimatedStyle(() => ({
    opacity: playerFlashOpacity.value,
  }));
  const enemyFlashOpacityStyle = useAnimatedStyle(() => ({
    opacity: enemyFlashOpacity.value,
  }));

  return {
    turnSV,
    playerFieldStyle,
    enemyFieldStyle,
    enemyGlowStyle,
    playerGlowStyle,
    dividerLineStyle,
    playerCountScaleStyle,
    enemyCountScaleStyle,
    playerFlashOpacityStyle,
    enemyFlashOpacityStyle,
    playerFlashColor,
    enemyFlashColor,
  };
}
