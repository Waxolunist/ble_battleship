import { Platform } from 'react-native';
import {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { useState } from 'react';

interface UseRetreatAnimationParams {
  shakeX: SharedValue<number>;
  shakeY: SharedValue<number>;
  turnSV: SharedValue<number>;
  onGameEnd?: (outcome: 'victory' | 'defeat') => void;
}

export function useRetreatAnimation({
  shakeX,
  shakeY,
  turnSV,
  onGameEnd,
}: UseRetreatAnimationParams) {
  const [confirmingRetreat, setConfirmingRetreat] = useState(false);
  const [isRetreating, setIsRetreating] = useState(false);
  const [submergeX, setSubmergeX] = useState(-1);
  const [showDefeatButtons, setShowDefeatButtons] = useState(false);

  const flagOpacity = useSharedValue(0);
  const flagTranslateY = useSharedValue(10);
  const darkOverlayOpacity = useSharedValue(0);
  const retreatWordOpacity = useSharedValue(0);
  const defeatGridFlashOpacity = useSharedValue(0);
  const defeatSubtitleOpacity = useSharedValue(0);
  const defeatButtonsOpacity = useSharedValue(0);

  const flagAnimStyle = useAnimatedStyle(() => ({
    opacity: flagOpacity.value,
    transform: [{ translateY: flagTranslateY.value }],
  }));
  const darkOverlayStyle = useAnimatedStyle(() => ({
    opacity: darkOverlayOpacity.value,
  }));
  const retreatWordStyle = useAnimatedStyle(() => ({
    opacity: retreatWordOpacity.value,
  }));
  const defeatGridFlashStyle = useAnimatedStyle(() => ({
    opacity: defeatGridFlashOpacity.value,
  }));
  const defeatSubtitleStyle = useAnimatedStyle(() => ({
    opacity: defeatSubtitleOpacity.value,
  }));
  const defeatButtonsStyle = useAnimatedStyle(() => ({
    opacity: defeatButtonsOpacity.value,
  }));
  // Dims to 50% during enemy turn
  const retreatButtonStyle = useAnimatedStyle(() => ({
    opacity: interpolate(turnSV.value, [0, 1], [1, 0.5]),
  }));

  const triggerRetreatVisualization = async () => {
    setConfirmingRetreat(false);
    setIsRetreating(true);
    onGameEnd?.('defeat');

    // Haptics: light → light → heavy (defeat sequence)
    if (Platform.OS !== 'web') {
      const { impactAsync, ImpactFeedbackStyle } = await import('expo-haptics');
      impactAsync(ImpactFeedbackStyle.Light).catch(() => {});
      setTimeout(() => impactAsync(ImpactFeedbackStyle.Light).catch(() => {}), 200);
      setTimeout(() => impactAsync(ImpactFeedbackStyle.Heavy).catch(() => {}), 400);
    }

    // Three screen-shake bursts (0, 200, 400ms) — mirrors victory
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

    // Red flash over player grid × 3 (0–0.6s) — mirrors victory's gold flash
    defeatGridFlashOpacity.value = withSequence(
      withTiming(0.7, { duration: 100 }),
      withTiming(0, { duration: 150 }),
      withTiming(0.7, { duration: 100 }),
      withTiming(0, { duration: 150 }),
      withTiming(0.7, { duration: 100 }),
      withTiming(0, { duration: 150 }),
    );

    // 1. Flag raised (0–0.4s)
    flagOpacity.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) });
    flagTranslateY.value = withTiming(-5, { duration: 400, easing: Easing.out(Easing.cubic) });

    // 2. Fleet submersion wave (0.4–1.4s), one column per 100ms
    for (let col = 0; col < 10; col++) {
      setTimeout(() => setSubmergeX(col), 400 + col * 100);
    }

    // 3. Screen darkens + title (1.0s)
    setTimeout(() => {
      darkOverlayOpacity.value = withTiming(0.85, { duration: 800 });
      retreatWordOpacity.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) });
    }, 1000);

    // 4. Subtitle fades in (1.4s)
    setTimeout(() => {
      defeatSubtitleOpacity.value = withTiming(1, {
        duration: 300,
        easing: Easing.out(Easing.cubic),
      });
    }, 1400);

    // 5. Buttons appear (3.0s)
    setTimeout(() => {
      setShowDefeatButtons(true);
      defeatButtonsOpacity.value = withTiming(1, {
        duration: 400,
        easing: Easing.out(Easing.cubic),
      });
    }, 3000);
  };

  const handleRetreatPress = async () => {
    if (Platform.OS !== 'web') {
      const { impactAsync, ImpactFeedbackStyle } = await import('expo-haptics');
      impactAsync(ImpactFeedbackStyle.Medium).catch(() => {});
    }
    setConfirmingRetreat(true);
  };

  const handleRetreatLongPress = () => {
    triggerRetreatVisualization();
  };

  const handleRetreatConfirm = () => {
    triggerRetreatVisualization();
  };

  return {
    confirmingRetreat,
    setConfirmingRetreat,
    isRetreating,
    showDefeatButtons,
    submergeX,
    flagAnimStyle,
    darkOverlayStyle,
    retreatWordStyle,
    defeatGridFlashStyle,
    defeatSubtitleStyle,
    defeatButtonsStyle,
    retreatButtonStyle,
    triggerRetreatVisualization,
    handleRetreatPress,
    handleRetreatLongPress,
    handleRetreatConfirm,
  };
}
