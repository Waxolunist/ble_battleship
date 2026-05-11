import { Platform, Pressable, PressableProps } from 'react-native';

export function HapticPressable({ onPress, ...props }: PressableProps) {
  const handlePress: PressableProps['onPress'] = async event => {
    if (Platform.OS !== 'web') {
      const { impactAsync, ImpactFeedbackStyle } = await import('expo-haptics');
      impactAsync(ImpactFeedbackStyle.Medium);
    }
    onPress?.(event);
  };

  return <Pressable onPress={handlePress} {...props} />;
}
