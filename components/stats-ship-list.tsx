import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { StatBar } from '@/components/stat-bar';
import { Fonts, GameColors } from '@/constants/theme';
import { useResponsive } from '@/hooks/useResponsive';
import { SHIP_FLEET, SHIP_SIZES, translateShipType } from '@/models/types';
import type { ShipType } from '@/models/types';
import type { ShipCounts } from '@/store/useStatsStore';

function ShipRow({
  shipType,
  count,
  max,
  color,
}: {
  shipType: ShipType;
  count: number;
  max: number;
  color: string;
}) {
  const { t } = useTranslation('stats');
  const { s, fs } = useResponsive();
  const pips = Array.from({ length: SHIP_SIZES[shipType] });
  return (
    <View style={styles.shipRow}>
      <View style={[styles.shipRowLeft, { width: s(100) }]}>
        <Text style={[styles.shipName, { fontSize: fs(9) }]}>{translateShipType(shipType, t)}</Text>
        <View style={styles.shipPips}>
          {pips.map((_, i) => (
            <View key={i} style={[styles.pip, { backgroundColor: color, opacity: 0.7 }]} />
          ))}
        </View>
      </View>
      <View style={styles.shipBarContainer}>
        <StatBar value={count} max={max} color={color} />
      </View>
      <Text style={[styles.shipCount, { color, width: s(28), fontSize: fs(16) }]}>{count}</Text>
    </View>
  );
}

export function StatsShipList({ counts, color }: { counts: ShipCounts; color: string }) {
  const max = Math.max(...SHIP_FLEET.map(shipType => counts[shipType]), 1);
  return (
    <View style={styles.shipList}>
      {SHIP_FLEET.map(shipType => (
        <ShipRow
          key={shipType}
          shipType={shipType}
          count={counts[shipType]}
          max={max}
          color={color}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  shipList: {
    gap: 10,
  },
  shipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  shipRowLeft: {
    width: 100,
    gap: 3,
  },
  shipName: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    letterSpacing: 2,
    color: GameColors.labelDim,
  },
  shipPips: {
    flexDirection: 'row',
    gap: 2,
  },
  pip: {
    width: 6,
    height: 6,
    borderRadius: 1,
  },
  shipBarContainer: {
    flex: 1,
  },
  shipCount: {
    fontFamily: 'BlackOpsOne',
    fontSize: 16,
    letterSpacing: 1,
    textAlign: 'right',
  },
});
