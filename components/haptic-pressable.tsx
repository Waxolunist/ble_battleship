import { playSound } from '@/services/audio';
import { Ref } from 'react';
import { Platform, Pressable, PressableProps, View } from 'react-native';

/**
 * Weight of the press, matching the intensity table in CLAUDE.md. Named rather
 * than passed as an ImpactFeedbackStyle because expo-haptics is imported
 * lazily — the enum does not exist until the module resolves.
 */
export type HapticIntensity = 'Light' | 'Medium' | 'Heavy';

export function HapticPressable({
  onPress,
  intensity = 'Medium',
  ref,
  ...props
}: PressableProps & { ref?: Ref<View>; intensity?: HapticIntensity }) {
  const handlePress: PressableProps['onPress'] = async event => {
    playSound('uiTap');
    if (Platform.OS !== 'web') {
      try {
        const { impactAsync, ImpactFeedbackStyle } = await import('expo-haptics');
        impactAsync(ImpactFeedbackStyle[intensity]).catch(() => {});
      } catch {
        // haptics unavailable
      }
    }
    onPress?.(event);
  };

  return <Pressable ref={ref} onPress={handlePress} {...props} />;
}
