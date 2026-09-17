import { serializeFleet } from '@/engine/fleet-conversion';
import type { Opponent } from '@/models/opponent';
import { playSound } from '@/services/audio';
import { leaveMultiplayerSession } from '@/services/multiplayer';
import { useGameStore } from '@/store/useGameStore';
import { useMultiplayerStore } from '@/store/useMultiplayerStore';
import { useNavigation } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type { AnimatedStyle } from 'react-native-reanimated';
import type { ViewStyle } from 'react-native';

export interface BattleAnimations {
  screenStyle: AnimatedStyle<ViewStyle>;
  placementPhaseStyle: AnimatedStyle<ViewStyle>;
  fireTopStyle: AnimatedStyle<ViewStyle>;
  fireBottomStyle: AnimatedStyle<ViewStyle>;
  playerFieldAnimStyle: AnimatedStyle<ViewStyle>;
  battlePhaseStyle: AnimatedStyle<ViewStyle>;
  flashStyle: AnimatedStyle<ViewStyle>;
  onFireAtWill: () => void;
  onRetreat: () => void;
}

export function useBattleAnimations(opponent: Opponent): BattleAnimations {
  const router = useRouter();
  const navigation = useNavigation();
  const startBattle = useGameStore(s => s.startBattle);

  const screenTranslateY = useSharedValue(0);
  const fireOpacity = useSharedValue(1);
  const fireTopTranslateY = useSharedValue(0);
  const fireBottomTranslateY = useSharedValue(0);
  const playerFieldTranslateY = useSharedValue(0);
  const battlePhaseOpacity = useSharedValue(0);
  const flashOpacity = useSharedValue(0);
  const flashScale = useSharedValue(0.2);

  const screenStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: screenTranslateY.value }],
  }));

  const placementPhaseStyle = useAnimatedStyle(() => ({
    opacity: fireOpacity.value,
  }));

  const fireTopStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: fireTopTranslateY.value }],
  }));

  const fireBottomStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: fireBottomTranslateY.value }],
  }));

  const playerFieldAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: playerFieldTranslateY.value }],
  }));

  const battlePhaseStyle = useAnimatedStyle(() => ({
    opacity: battlePhaseOpacity.value,
  }));

  const flashStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
    transform: [{ scale: flashScale.value }],
  }));

  const onFireAtWill = () => {
    const fadeConfig = { duration: 350, easing: Easing.in(Easing.cubic) };
    fireOpacity.value = withTiming(0, fadeConfig);
    fireTopTranslateY.value = withTiming(-60, fadeConfig);
    fireBottomTranslateY.value = withTiming(60, fadeConfig);
    playerFieldTranslateY.value = withTiming(-10, fadeConfig);
    battlePhaseOpacity.value = withTiming(1, { duration: 350, easing: Easing.out(Easing.cubic) });

    setTimeout(async () => {
      const localFleet = serializeFleet(useGameStore.getState().fields);
      let prepared;
      try {
        prepared = await opponent.prepareBattle(localFleet);
      } catch (err) {
        // Peer disconnect / send failure mid-handshake. Bail back to the
        // previous screen rather than leaving the user on a half-faded battle.
        console.error('[useBattleAnimations] prepareBattle failed:', err);
        router.back();
        return;
      }
      startBattle(prepared);
      playSound('battleStart');
      flashScale.value = 0.2;
      flashOpacity.value = withSequence(
        withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 1500 }),
        withTiming(0, { duration: 450, easing: Easing.in(Easing.cubic) }),
      );
      flashScale.value = withSequence(
        withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 1500 }),
        withTiming(1.7, { duration: 450, easing: Easing.in(Easing.cubic) }),
      );
    }, 350);
  };

  // Placement-phase retreat: there is no battle to lose yet, so a multiplayer
  // retreat leaves the match outright — BYE tells the peer it was deliberate
  // rather than a dropped connection.
  const onRetreat = () => {
    playSound('retreatAlarm');
    navigation.setOptions({ animation: 'none' });
    const isMultiplayer = useMultiplayerStore.getState().mode === 'multiplayer';
    if (isMultiplayer) {
      leaveMultiplayerSession().catch(err =>
        console.error('[useBattleAnimations] leaving session failed:', err),
      );
    }
    screenTranslateY.value = withTiming(-1000, {
      duration: 350,
      easing: Easing.in(Easing.cubic),
    });
    setTimeout(() => {
      if (!isMultiplayer) {
        router.back();
        return;
      }
      // Navigate before resetting: clearing `mode` back to 'ai' would
      // otherwise swap this screen to the AI battle for a frame.
      router.replace('/');
      useMultiplayerStore.getState().reset();
    }, 350);
  };

  return {
    screenStyle,
    placementPhaseStyle,
    fireTopStyle,
    fireBottomStyle,
    playerFieldAnimStyle,
    battlePhaseStyle,
    flashStyle,
    onFireAtWill,
    onRetreat,
  };
}
