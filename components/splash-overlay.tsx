import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { IMAGES } from '@/constants/assets';
import { playSound } from '@/services/audio';
import { GameColors } from '@/constants/theme';

const FADE_MS = 450;

type Props = {
  /** Fade the overlay out once the app is ready to be shown. */
  ready: boolean;
  onFinish: () => void;
};

/**
 * Full-screen splash rendered in JS. The native splash is a centred icon on
 * Android (platform limitation), so this covers the whole screen with the same
 * artwork and cross-fades into the app.
 */
export function SplashOverlay({ ready, onFinish }: Props) {
  const opacity = useSharedValue(1);
  const [imageReady, setImageReady] = useState(false);

  const handleLoadEnd = useCallback(() => {
    setImageReady(true);
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  useEffect(() => {
    if (!ready || !imageReady) return;
    playSound('appLaunch');
    opacity.value = withTiming(
      0,
      { duration: FADE_MS, easing: Easing.out(Easing.cubic) },
      finished => {
        if (finished) runOnJS(onFinish)();
      },
    );
  }, [imageReady, onFinish, opacity, ready]);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View pointerEvents="none" style={[styles.container, animStyle]}>
      <Image
        source={IMAGES.bg}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        onLoadEnd={handleLoadEnd}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: GameColors.splashBg,
    zIndex: 100,
  },
});
