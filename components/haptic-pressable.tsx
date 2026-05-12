import { Ref } from 'react';
import { Platform, Pressable, PressableProps, View } from 'react-native';

export function HapticPressable({ onPress, ref, ...props }: PressableProps & { ref?: Ref<View> }) {
  const handlePress: PressableProps['onPress'] = async event => {
    if (Platform.OS !== 'web') {
      const { impactAsync, ImpactFeedbackStyle } = await import('expo-haptics');
      impactAsync(ImpactFeedbackStyle.Medium);
    }
    onPress?.(event);
  };

  return <Pressable ref={ref} onPress={handlePress} {...props} />;
}
