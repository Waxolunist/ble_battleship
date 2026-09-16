import { StyleSheet, View } from 'react-native';
import { GameColors } from '@/constants/theme';

export function StatBar({ value, max, color }: { value: number; max: number; color: string }) {
  const fraction = max > 0 ? Math.min(value / max, 1) : 0;
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: `${fraction * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  barTrack: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    backgroundColor: GameColors.statBarTrack,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
});
