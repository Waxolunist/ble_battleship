import { IMAGES } from '@/constants/assets';
import { Fonts, GameColors } from '@/constants/theme';
import { getRankTitle, RANK_TIERS, SHIP_FLEET, SHIP_SIZES } from '@/models/types';
import type { ShipType } from '@/models/types';
import { useCaptainStore } from '@/store/useCaptainStore';
import type { ShipCounts } from '@/store/useStatsStore';
import { useStatsStore } from '@/store/useStatsStore';
import { HapticPressable } from '@/components/haptic-pressable';
import { ImageBackground, ScrollView, StyleSheet, Text, View } from 'react-native';

// ── Helpers ──────────────────────────────────────────────────────────────────

function pct(value: number, total: number): number {
  return total > 0 ? value / total : 0;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionLine} />
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.sectionLine} />
    </View>
  );
}

function StatBar({ value, max, color }: { value: number; max: number; color: string }) {
  const fraction = max > 0 ? Math.min(value / max, 1) : 0;
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: `${fraction * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

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
  const size = SHIP_SIZES[shipType];
  const pips = Array.from({ length: size });
  return (
    <View style={styles.shipRow}>
      <View style={styles.shipRowLeft}>
        <Text style={styles.shipName}>{shipType.toUpperCase()}</Text>
        <View style={styles.shipPips}>
          {pips.map((_, i) => (
            <View key={i} style={[styles.pip, { backgroundColor: color, opacity: 0.7 }]} />
          ))}
        </View>
      </View>
      <View style={styles.shipBarContainer}>
        <StatBar value={count} max={max} color={color} />
      </View>
      <Text style={[styles.shipCount, { color }]}>{count}</Text>
    </View>
  );
}

function BigStat({
  value,
  label,
  color,
}: {
  value: string | number;
  label: string;
  color: string;
}) {
  return (
    <View style={styles.bigStatBox}>
      <Text style={[styles.bigStatValue, { color }]}>{value}</Text>
      <Text style={styles.bigStatLabel}>{label}</Text>
    </View>
  );
}

function SmallDataPoint({ value, label }: { value: string | number; label: string }) {
  return (
    <View style={styles.smallDataPoint}>
      <Text style={styles.smallDataValue}>{value}</Text>
      <Text style={styles.smallDataLabel}>{label}</Text>
    </View>
  );
}

function NoDataState() {
  return (
    <View style={styles.noDataContainer}>
      <Text style={styles.noDataIcon}>⚓</Text>
      <Text style={styles.noDataTitle}>NO COMBAT DATA</Text>
      <Text style={styles.noDataSub}>Complete a battle to see your record.</Text>
    </View>
  );
}

function RankProgressBar({ gamesPlayed, winRate }: { gamesPlayed: number; winRate: number }) {
  let rankIndex = -1;
  let fillFraction = 0;
  let hint = '';

  if (gamesPlayed >= 3) {
    for (let i = RANK_TIERS.length - 1; i >= 0; i--) {
      if (winRate >= RANK_TIERS[i].threshold) {
        rankIndex = i;
        break;
      }
    }
    if (rankIndex === RANK_TIERS.length - 1) {
      fillFraction = 1;
      hint = 'MAXIMUM RANK ACHIEVED';
    } else {
      const cur = RANK_TIERS[rankIndex];
      const next = RANK_TIERS[rankIndex + 1];
      const withinTier = (winRate - cur.threshold) / (next.threshold - cur.threshold);
      fillFraction = (rankIndex + withinTier) / (RANK_TIERS.length - 1);
      hint = `NEXT: ${next.title} AT ${next.threshold}% WIN RATE`;
    }
  } else {
    const games = Math.max(gamesPlayed, 0);
    fillFraction = 0;
    const remaining = 3 - games;
    hint =
      games === 0
        ? 'PLAY 3 BATTLES TO ESTABLISH RANK'
        : `${remaining} MORE BATTLE${remaining === 1 ? '' : 'S'} TO ESTABLISH RANK`;
  }

  const isMaxRank = rankIndex === RANK_TIERS.length - 1;

  return (
    <View style={styles.rankProgress}>
      {/* Rank labels */}
      <View style={styles.rankLabelsRow}>
        {RANK_TIERS.map((tier, i) => (
          <Text
            key={tier.title}
            style={[
              styles.rankLabel,
              i < rankIndex && styles.rankLabelAchieved,
              i === rankIndex && styles.rankLabelCurrent,
            ]}>
            {tier.title}
          </Text>
        ))}
      </View>

      {/* Bar with dot milestones */}
      <View style={styles.rankTrackContainer}>
        <View style={styles.rankBarTrack}>
          <View
            style={[
              styles.rankBarFill,
              { width: `${Math.min(fillFraction * 100, 100)}%` },
              isMaxRank && styles.rankBarFillMax,
            ]}
          />
        </View>
        <View style={styles.rankDotsRow}>
          {RANK_TIERS.map((tier, i) => (
            <View
              key={tier.title}
              style={[
                styles.rankDot,
                i <= rankIndex && styles.rankDotActive,
                i === rankIndex && styles.rankDotCurrent,
              ]}
            />
          ))}
        </View>
      </View>

      {/* Hint */}
      <Text style={[styles.rankHint, isMaxRank && styles.rankHintMax]}>{hint}</Text>
    </View>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function StatsScreen() {
  const captainName = useCaptainStore(s => s.captainName);
  const gamesPlayed = useStatsStore(s => s.gamesPlayed);
  const wins = useStatsStore(s => s.wins);
  const losses = useStatsStore(s => s.losses);
  const currentStreak = useStatsStore(s => s.currentStreak);
  const bestWinStreak = useStatsStore(s => s.bestWinStreak);
  const totalShots = useStatsStore(s => s.totalShots);
  const totalHits = useStatsStore(s => s.totalHits);
  const totalMisses = useStatsStore(s => s.totalMisses);
  const enemyShipsSunkByType = useStatsStore(s => s.enemyShipsSunkByType);
  const playerShipsLostByType = useStatsStore(s => s.playerShipsLostByType);
  const resetStats = useStatsStore(s => s.resetStats);

  const winRate = Math.round(pct(wins, gamesPlayed) * 100);
  const accuracy = Math.round(pct(totalHits, totalShots) * 100);
  const noData = gamesPlayed === 0;
  const rank = getRankTitle(gamesPlayed, winRate);

  const maxKills = Math.max(...SHIP_FLEET.map(t => (enemyShipsSunkByType as ShipCounts)[t]), 1);
  const maxLost = Math.max(...SHIP_FLEET.map(t => (playerShipsLostByType as ShipCounts)[t]), 1);

  return (
    <ImageBackground source={IMAGES.bg} style={styles.background} resizeMode="cover">
      <View style={[StyleSheet.absoluteFill, styles.overlay]} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        {/* ── Captain Banner ──────────────────────────────────────────── */}
        <View style={styles.captainBanner}>
          <Text style={styles.rankBadge}>{rank}</Text>
          <Text style={styles.captainName}>{captainName || 'UNKNOWN'}</Text>
          <Text style={styles.battlesLine}>
            {noData
              ? 'AWAITING FIRST ENGAGEMENT'
              : `${gamesPlayed} ENGAGEMENT${gamesPlayed === 1 ? '' : 'S'}`}
          </Text>
          <RankProgressBar gamesPlayed={gamesPlayed} winRate={winRate} />
        </View>

        {noData ? (
          <NoDataState />
        ) : (
          <>
            {/* ── Combat Record ─────────────────────────────────────────── */}
            <View style={styles.section}>
              <SectionHeader label="COMBAT RECORD" />
              <View style={styles.recordRow}>
                <BigStat value={wins} label="VICTORIES" color={GameColors.gold} />
                <View style={styles.recordDivider} />
                <BigStat value={losses} label="DEFEATS" color={GameColors.red} />
                <View style={styles.recordDivider} />
                <BigStat value={`${winRate}%`} label="WIN RATE" color={GameColors.label} />
              </View>

              {/* Win-rate bar */}
              <View style={styles.winBarWrapper}>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        width: `${winRate}%`,
                        backgroundColor: GameColors.statBarWin,
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.barFill,
                      {
                        width: `${100 - winRate}%`,
                        backgroundColor: GameColors.statBarLoss,
                        opacity: 0.6,
                      },
                    ]}
                  />
                </View>
              </View>

              {/* Streaks */}
              <View style={styles.streakRow}>
                <View style={styles.streakItem}>
                  <Text style={styles.streakValue}>
                    {currentStreak > 0 ? `▲ ${currentStreak}` : '—'}
                  </Text>
                  <Text style={styles.streakLabel}>CURRENT STREAK</Text>
                </View>
                <View style={styles.streakSep} />
                <View style={styles.streakItem}>
                  <Text style={[styles.streakValue, { color: GameColors.gold }]}>
                    ▲ {bestWinStreak}
                  </Text>
                  <Text style={styles.streakLabel}>BEST STREAK</Text>
                </View>
              </View>
            </View>

            {/* ── Combat Accuracy ───────────────────────────────────────── */}
            <View style={styles.section}>
              <SectionHeader label="COMBAT ACCURACY" />

              <View style={styles.accuracyMain}>
                <Text style={styles.accuracyPct}>{accuracy}%</Text>
                <Text style={styles.accuracySubLabel}>ACCURACY</Text>
              </View>

              <View style={styles.accuracyBarWrapper}>
                <StatBar value={totalHits} max={totalShots} color={GameColors.statBarWin} />
              </View>

              <View style={styles.shotDataRow}>
                <SmallDataPoint value={totalHits} label="HITS" />
                <View style={styles.dotSep}>
                  <Text style={styles.dot}>·</Text>
                </View>
                <SmallDataPoint value={totalMisses} label="MISSES" />
                <View style={styles.dotSep}>
                  <Text style={styles.dot}>·</Text>
                </View>
                <SmallDataPoint value={totalShots} label="SHOTS FIRED" />
              </View>
            </View>

            {/* ── Fleet Kills ───────────────────────────────────────────── */}
            <View style={styles.section}>
              <SectionHeader label="FLEET KILLS" />
              <View style={styles.shipList}>
                {SHIP_FLEET.map(shipType => (
                  <ShipRow
                    key={shipType}
                    shipType={shipType}
                    count={(enemyShipsSunkByType as ShipCounts)[shipType]}
                    max={maxKills}
                    color={GameColors.statBarKill}
                  />
                ))}
              </View>
              <View style={styles.totalKillsRow}>
                <Text style={styles.totalKillsLabel}>TOTAL ENEMY SHIPS SUNK</Text>
                <Text style={[styles.totalKillsValue, { color: GameColors.statBarKill }]}>
                  {SHIP_FLEET.reduce((acc, t) => acc + (enemyShipsSunkByType as ShipCounts)[t], 0)}
                </Text>
              </View>
            </View>

            {/* ── Ships Lost ────────────────────────────────────────────── */}
            <View style={[styles.section, styles.sectionLast]}>
              <SectionHeader label="SHIPS LOST" />
              <View style={styles.shipList}>
                {SHIP_FLEET.map(shipType => (
                  <ShipRow
                    key={shipType}
                    shipType={shipType}
                    count={(playerShipsLostByType as ShipCounts)[shipType]}
                    max={maxLost}
                    color={GameColors.statBarLoss}
                  />
                ))}
              </View>
              <View style={styles.totalKillsRow}>
                <Text style={styles.totalKillsLabel}>TOTAL SHIPS LOST</Text>
                <Text style={[styles.totalKillsValue, { color: GameColors.statBarLoss }]}>
                  {SHIP_FLEET.reduce((acc, t) => acc + (playerShipsLostByType as ShipCounts)[t], 0)}
                </Text>
              </View>
            </View>
            <HapticPressable
              onPress={resetStats}
              style={({ pressed }) => [styles.resetButton, pressed && styles.resetButtonPressed]}>
              <Text style={styles.resetButtonText}>reset stats</Text>
            </HapticPressable>
          </>
        )}
      </ScrollView>
    </ImageBackground>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  overlay: {
    backgroundColor: 'rgba(2, 8, 30, 0.78)',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingTop: 72,
    paddingBottom: 48,
    paddingHorizontal: 20,
    gap: 12,
  },

  // ── Captain Banner ──
  captainBanner: {
    alignItems: 'center',
    paddingVertical: 20,
    marginBottom: 8,
  },
  rankBadge: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 4,
    color: GameColors.gold,
    marginBottom: 6,
  },
  captainName: {
    fontFamily: 'BlackOpsOne',
    fontSize: 34,
    letterSpacing: 3,
    color: GameColors.label,
  },
  battlesLine: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 3,
    color: GameColors.labelFaded,
    marginTop: 4,
  },

  // ── Sections ──
  section: {
    backgroundColor: GameColors.statSectionBg,
    borderWidth: 1,
    borderColor: GameColors.blueBorder,
    borderRadius: 6,
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 12,
  },
  sectionLast: {
    marginBottom: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: GameColors.blueBorder,
    opacity: 0.5,
  },
  sectionLabel: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    letterSpacing: 3,
    color: GameColors.labelDim,
  },

  // ── Combat Record ──
  recordRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  recordDivider: {
    width: 1,
    height: 40,
    backgroundColor: GameColors.blueBorder,
    opacity: 0.4,
  },
  bigStatBox: {
    alignItems: 'center',
    gap: 4,
  },
  bigStatValue: {
    fontFamily: 'BlackOpsOne',
    fontSize: 32,
    letterSpacing: 2,
  },
  bigStatLabel: {
    fontFamily: Fonts.mono,
    fontSize: 8,
    letterSpacing: 2,
    color: GameColors.labelFaded,
  },
  winBarWrapper: {
    marginTop: 4,
  },
  streakRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 0,
    marginTop: 4,
  },
  streakItem: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  streakSep: {
    width: 1,
    height: 28,
    backgroundColor: GameColors.blueBorder,
    opacity: 0.3,
  },
  streakValue: {
    fontFamily: 'BlackOpsOne',
    fontSize: 20,
    letterSpacing: 2,
    color: GameColors.label,
  },
  streakLabel: {
    fontFamily: Fonts.mono,
    fontSize: 8,
    letterSpacing: 2,
    color: GameColors.labelFaded,
  },

  // ── Accuracy ──
  accuracyMain: {
    alignItems: 'center',
    gap: 2,
  },
  accuracyPct: {
    fontFamily: 'BlackOpsOne',
    fontSize: 52,
    letterSpacing: 2,
    color: GameColors.gold,
    textShadowColor: GameColors.goldShadow,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  accuracySubLabel: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    letterSpacing: 4,
    color: GameColors.labelFaded,
  },
  accuracyBarWrapper: {
    marginTop: 4,
  },
  shotDataRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 0,
    marginTop: 4,
  },
  smallDataPoint: {
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 12,
  },
  smallDataValue: {
    fontFamily: 'BlackOpsOne',
    fontSize: 16,
    letterSpacing: 1,
    color: GameColors.label,
  },
  smallDataLabel: {
    fontFamily: Fonts.mono,
    fontSize: 8,
    letterSpacing: 2,
    color: GameColors.labelFaded,
  },
  dotSep: {
    alignItems: 'center',
  },
  dot: {
    color: GameColors.labelFaded,
    fontSize: 14,
  },

  // ── Bar ──
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

  // ── Ship rows ──
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
    width: 28,
    textAlign: 'right',
  },
  totalKillsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: GameColors.blueBorder,
    opacity: 0.7,
  },
  totalKillsLabel: {
    fontFamily: Fonts.mono,
    fontSize: 8,
    letterSpacing: 2,
    color: GameColors.labelFaded,
  },
  totalKillsValue: {
    fontFamily: 'BlackOpsOne',
    fontSize: 16,
    letterSpacing: 1,
  },

  // ── Rank Progress Bar ──
  rankProgress: {
    width: '100%',
    gap: 8,
    marginTop: 14,
  },
  rankLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rankLabel: {
    fontFamily: Fonts.mono,
    fontSize: 8,
    letterSpacing: 1,
    color: GameColors.labelFaded,
    textAlign: 'center',
    flex: 1,
  },
  rankLabelAchieved: {
    color: GameColors.labelDim,
  },
  rankLabelCurrent: {
    color: GameColors.gold,
  },
  rankTrackContainer: {
    height: 12,
    justifyContent: 'center',
  },
  rankBarTrack: {
    position: 'absolute',
    left: 8,
    right: 8,
    height: 4,
    borderRadius: 2,
    backgroundColor: GameColors.statBarTrack,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  rankBarFill: {
    height: '100%',
    backgroundColor: GameColors.statBarWin,
    borderRadius: 2,
  },
  rankBarFillMax: {
    backgroundColor: GameColors.gold,
  },
  rankDotsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rankDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: GameColors.statBarTrack,
    borderWidth: 1,
    borderColor: GameColors.blueBorder,
  },
  rankDotActive: {
    backgroundColor: GameColors.statBarWin,
    borderColor: GameColors.statBarWin,
  },
  rankDotCurrent: {
    backgroundColor: GameColors.gold,
    borderColor: GameColors.gold,
  },
  rankHint: {
    fontFamily: Fonts.mono,
    fontSize: 8,
    letterSpacing: 2,
    color: GameColors.labelFaded,
    textAlign: 'center',
  },
  rankHintMax: {
    color: GameColors.gold,
  },

  // ── Reset button ──
  resetButton: {
    marginTop: 8,
    padding: 8,
    alignSelf: 'flex-start',
  },
  resetButtonPressed: {
    opacity: 0.5,
  },
  resetButtonText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 1,
  },

  // ── No data ──
  noDataContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  noDataIcon: {
    fontSize: 36,
    opacity: 0.3,
  },
  noDataTitle: {
    fontFamily: 'BlackOpsOne',
    fontSize: 18,
    letterSpacing: 4,
    color: GameColors.labelFaded,
  },
  noDataSub: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 2,
    color: GameColors.labelFaded,
    opacity: 0.6,
  },
});
