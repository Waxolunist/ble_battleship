import { playSound } from '@/services/audio';
import { Ref } from 'react';
import { Platform, Pressable, PressableProps, View } from 'react-native';

export function HapticPressable({ onPress, ref, ...props }: PressableProps & { ref?: Ref<View> }) {
  const handlePress: PressableProps['onPress'] = async event => {
    playSound('uiTap');
    if (Platform.OS !== 'web') {
      try {
        const { impactAsync, ImpactFeedbackStyle } = await import('expo-haptics');
        impactAsync(ImpactFeedbackStyle.Medium).catch(() => {});
      } catch {
        // haptics unavailable
      }
    }
    onPress?.(event);
  };

  return <Pressable ref={ref} onPress={handlePress} {...props} />;
}
