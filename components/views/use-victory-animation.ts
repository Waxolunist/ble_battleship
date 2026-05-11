import { Platform } from 'react-native';
import {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { useEffect, useRef, useState } from 'react';

interface UseVictoryAnimationParams {
  enemyShipsRemaining: number;
  showOpponentField: boolean;
  shakeX: SharedValue<number>;
  shakeY: SharedValue<number>;
  onGameEnd?: (outcome: 'victory' | 'defeat') => void;
}

export function useVictoryAnimation({
  enemyShipsRemaining,
  showOpponentField,
  shakeX,
  shakeY,
  onGameEnd,
}: UseVictoryAnimationParams) {
  const [isVictory, setIsVictory] = useState(false);
  const [showVictoryButtons, setShowVictoryButtons] = useState(false);
  const hasTriggered = useRef(false);

  const victoryGridFlashOpacity = useSharedValue(0);
  const victoryOverlayOpacity = useSharedValue(0);
  const victoryWordScale = useSharedValue(0.5);
  const victoryWordOpacity = useSharedValue(0);
  const victorySubtitleOpacity = useSharedValue(0);
  const playerPulseOpacity = useSharedValue(0);
  const victoryButtonsOpacity = useSharedValue(0);

  useEffect(() => {
    if (!showOpponentField || hasTriggered.current || enemyShipsRemaining !== 0) return;
    hasTriggered.current = true;
    setIsVictory(true);
    onGameEnd?.('victory');

    (async () => {
      // Haptics: medium × 3 → heavy
      if (Platform.OS !== 'web') {
        const { impactAsync, ImpactFeedbackStyle } = await import('expo-haptics');
        impactAsync(ImpactFeedbackStyle.Medium).catch(() => {});
        setTimeout(() => impactAsync(ImpactFeedbackStyle.Medium).catch(() => {}), 200);
        setTimeout(() => impactAsync(ImpactFeedbackStyle.Medium).catch(() => {}), 400);
        setTimeout(() => impactAsync(ImpactFeedbackStyle.Heavy).catch(() => {}), 600);
      }

      // Three screen-shake bursts (0, 200, 400ms)
      const doShake = () => {
        shakeX.value = withSequence(
          withTiming(4, { duration: 25 }),
          withTiming(-4, { duration: 25 }),
          withTiming(3, { duration: 25 }),
          withTiming(-3, { duration: 25 }),
          withTiming(0, { duration: 25 }),
        );
        shakeY.value = withSequence(
          withTiming(-3, { duration: 25 }),
          withTiming(3, { duration: 25 }),
          withTiming(-2, { duration: 25 }),
          withTiming(2, { duration: 25 }),
          withTiming(0, { duration: 25 }),
        );
      };
      doShake();
      setTimeout(doShake, 200);
      setTimeout(doShake, 400);

      // Gold flash over enemy grid × 3 (0–0.6s)
      victoryGridFlashOpacity.value = withSequence(
        withTiming(0.7, { duration: 100 }),
        withTiming(0, { duration: 150 }),
        withTiming(0.7, { duration: 100 }),
        withTiming(0, { duration: 150 }),
        withTiming(0.7, { duration: 100 }),
        withTiming(0, { duration: 150 }),
      );

      // Dark overlay + VICTORY slams in (0.6s)
      setTimeout(() => {
        victoryOverlayOpacity.value = withTiming(0.82, { duration: 400 });
        victoryWordScale.value = 0.5;
        victoryWordOpacity.value = 0;
        victoryWordScale.value = withTiming(1, { duration: 350, easing: Easing.out(Easing.cubic) });
        victoryWordOpacity.value = withTiming(1, {
          duration: 200,
          easing: Easing.out(Easing.cubic),
        });
      }, 600);

      // Subtitle fades in (1.0s)
      setTimeout(() => {
        victorySubtitleOpacity.value = withTiming(1, {
          duration: 300,
          easing: Easing.out(Easing.cubic),
        });
      }, 1000);

      // Player fleet pulse (1.2s, loops indefinitely)
      setTimeout(() => {
        playerPulseOpacity.value = withRepeat(
          withSequence(
            withTiming(0.4, { duration: 600, easing: Easing.inOut(Easing.sin) }),
            withTiming(0.15, { duration: 600, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
          false,
        );
      }, 1200);

      // Post-game buttons fade in (3.0s)
      setTimeout(() => {
        setShowVictoryButtons(true);
        victoryButtonsOpacity.value = withTiming(1, {
          duration: 400,
          easing: Easing.out(Easing.cubic),
        });
      }, 3000);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enemyShipsRemaining, showOpponentField]);

  const victoryGridFlashStyle = useAnimatedStyle(() => ({
    opacity: victoryGridFlashOpacity.value,
  }));
  const victoryOverlayStyle = useAnimatedStyle(() => ({
    opacity: victoryOverlayOpacity.value,
  }));
  const victoryWordStyle = useAnimatedStyle(() => ({
    opacity: victoryWordOpacity.value,
    transform: [{ scale: victoryWordScale.value }],
  }));
  const victorySubtitleStyle = useAnimatedStyle(() => ({
    opacity: victorySubtitleOpacity.value,
  }));
  const playerPulseStyle = useAnimatedStyle(() => ({
    opacity: playerPulseOpacity.value,
  }));
  const victoryButtonsStyle = useAnimatedStyle(() => ({
    opacity: victoryButtonsOpacity.value,
  }));

  return {
    isVictory,
    showVictoryButtons,
    victoryGridFlashStyle,
    victoryOverlayStyle,
    victoryWordStyle,
    victorySubtitleStyle,
    playerPulseStyle,
    victoryButtonsStyle,
  };
}
