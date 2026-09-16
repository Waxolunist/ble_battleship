import { StyleSheet, Text, View } from 'react-native';
import { Fonts, GameColors } from '@/constants/theme';
import { useResponsive } from '@/hooks/useResponsive';

export function StatsTotalRow({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  const { fs } = useResponsive();
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { fontSize: fs(8) }]}>{label}</Text>
      <Text style={[styles.value, { color, fontSize: fs(16) }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: GameColors.blueBorder,
    opacity: 0.7,
  },
  label: {
    fontFamily: Fonts.mono,
    fontSize: 8,
    letterSpacing: 2,
    color: GameColors.labelFaded,
  },
  value: {
    fontFamily: 'BlackOpsOne',
    fontSize: 16,
    letterSpacing: 1,
  },
});
