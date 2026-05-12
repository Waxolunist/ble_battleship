import { HapticPressable } from '@/components/haptic-pressable';
import { GameColors } from '@/constants/theme';
import { StyleSheet, Text } from 'react-native';

interface TutorialHelpButtonProps {
  onPress: () => void;
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
}

export function TutorialHelpButton({ onPress, top, bottom, left, right }: TutorialHelpButtonProps) {
  return (
    <HapticPressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { top, bottom, left, right },
        pressed && styles.buttonPressed,
      ]}>
      <Text style={styles.label}>?</Text>
    </HapticPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderWidth: 1,
    borderColor: GameColors.labelFaded,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    backgroundColor: GameColors.blueButton,
    borderColor: GameColors.blueBorder,
  },
  label: {
    fontFamily: 'BlackOpsOne',
    fontSize: 16,
    letterSpacing: 1,
    color: GameColors.labelFaded,
  },
});
