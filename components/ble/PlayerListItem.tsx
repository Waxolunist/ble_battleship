import { StyleSheet, Text, View } from 'react-native';
import { GameColors, Fonts } from '@/constants/theme';
import { HapticPressable } from '@/components/haptic-pressable';

interface PlayerListItemProps {
  name: string;
  onPress?: () => void;
}

export function PlayerListItem({ name, onPress }: PlayerListItemProps) {
  return (
    <View style={styles.row}>
      <View style={styles.content}>
        <Text style={styles.indicator}>▸</Text>
        <Text style={styles.name}>{name}</Text>
      </View>
      <HapticPressable
        onPress={onPress}
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
        <Text style={styles.buttonText}>JOIN</Text>
      </HapticPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: GameColors.blueBorder,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  indicator: {
    color: GameColors.gold,
    fontSize: 12,
    fontWeight: '700',
  },
  name: {
    color: GameColors.gold,
    fontSize: 14,
    fontWeight: '700',
    fontFamily: Fonts.rounded,
    letterSpacing: 1,
  },
  button: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#fff',
    borderRadius: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  buttonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  buttonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 3,
  },
});
