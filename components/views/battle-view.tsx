import { GameField } from '@/components/game-field';
import type { Field, ShotPhase, ShipType } from '@/models/types';
import { GameColors } from '@/constants/theme';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  LinearTransition,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

type SunkEvent = { shipType: ShipType; owner: 'player' | 'enemy' } | null;

const PLAYER_COUNTER_COLOR = GameColors.playerBlue;
const ENEMY_COUNTER_COLOR = GameColors.red;

function countShipsRemaining(fields: Field[][]): number {
  const shipSunkMap = new Map<string, boolean>();
  for (const row of fields) {
    for (const cell of row) {
      if (!cell.shipPart) continue;
      const id = cell.shipPart.ship.id;
      if (!shipSunkMap.has(id)) {
        shipSunkMap.set(id, true);
      }
      if (cell.status !== 'sunk') {
        shipSunkMap.set(id, false);
      }
    }
  }
  let remaining = 0;
  for (const isSunk of shipSunkMap.values()) {
    if (!isSunk) remaining++;
  }
  return remaining;
}

export type BattleViewProps = {
  fields: Field[][];
  opponentFields: Field[][];
  showOpponentField: boolean;
  turn: 'player' | 'enemy';
  sunkEvent?: SunkEvent;
  shotPhase?: ShotPhase;
  onEnemyCellPress?: (x: number, y: number) => void;
};

export function BattleView({
  fields,
  opponentFields,
  showOpponentField,
  turn,
  sunkEvent,
  shotPhase,
  onEnemyCellPress,
}: BattleViewProps) {
  // 0 = player's turn, 1 = enemy's turn — transitions smoothly on change
  const turnSV = useSharedValue(0);
  // Shared pulse oscillator for the glow borders and divider lines
  const glowPulse = useSharedValue(0.4);
  const dividerPulse = useSharedValue(0.25);

  useEffect(() => {
    glowPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.35, { duration: 800, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    dividerPulse.value = withRepeat(
      withSequence(
        withTiming(0.9, { duration: 700, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.2, { duration: 700, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [dividerPulse, glowPulse]);

  useEffect(() => {
    turnSV.value = withTiming(turn === 'player' ? 0 : 1, { duration: 400 });
  }, [turn, turnSV]);

  // Active grid is full opacity; inactive grid dims
  const playerFieldStyle = useAnimatedStyle(() => ({
    opacity: interpolate(turnSV.value, [0, 1], [0.55, 1]),
  }));
  const enemyFieldStyle = useAnimatedStyle(() => ({
    opacity: interpolate(turnSV.value, [0, 1], [1, 0.55]),
  }));

  // Gold glow on enemy grid (player's turn), red glow on player grid (enemy's turn)
  const enemyGlowStyle = useAnimatedStyle(() => ({
    opacity: (1 - turnSV.value) * glowPulse.value,
  }));
  const playerGlowStyle = useAnimatedStyle(() => ({
    opacity: turnSV.value * glowPulse.value,
  }));

  const dividerLineStyle = useAnimatedStyle(() => ({
    opacity: dividerPulse.value,
  }));

  // --- Counter animations ---
  const playerCountScale = useSharedValue(1);
  const enemyCountScale = useSharedValue(1);
  const playerFlashOpacity = useSharedValue(0);
  const enemyFlashOpacity = useSharedValue(0);
  const [playerFlashColor, setPlayerFlashColor] = useState<string | null>(null);
  const [enemyFlashColor, setEnemyFlashColor] = useState<string | null>(null);

  useEffect(() => {
    if (!sunkEvent) return;

    const scaleSV = sunkEvent.owner === 'player' ? playerCountScale : enemyCountScale;
    const flashOpacitySV = sunkEvent.owner === 'player' ? playerFlashOpacity : enemyFlashOpacity;
    const flashColor = sunkEvent.owner === 'player' ? GameColors.red : GameColors.gold;
    const setFlash = sunkEvent.owner === 'player' ? setPlayerFlashColor : setEnemyFlashColor;

    setFlash(flashColor);
    scaleSV.value = withSequence(
      withTiming(1.4, { duration: 200 }),
      withTiming(1, { duration: 200 }),
    );
    flashOpacitySV.value = withSequence(
      withTiming(1, { duration: 80 }),
      withTiming(1, { duration: 240 }),
      withTiming(0, { duration: 200 }),
    );
    const t = setTimeout(() => setFlash(null), 520);
    return () => clearTimeout(t);
  }, [sunkEvent, playerCountScale, enemyCountScale, playerFlashOpacity, enemyFlashOpacity]);

  const playerCountScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: playerCountScale.value }],
  }));
  const enemyCountScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: enemyCountScale.value }],
  }));
  const playerFlashOpacityStyle = useAnimatedStyle(() => ({
    opacity: playerFlashOpacity.value,
  }));
  const enemyFlashOpacityStyle = useAnimatedStyle(() => ({
    opacity: enemyFlashOpacity.value,
  }));

  const playerShipsRemaining = countShipsRemaining(fields);
  const enemyShipsRemaining = countShipsRemaining(opponentFields);

  // --- Screen shake on impact beat ---
  const shakeX = useSharedValue(0);
  const shakeY = useSharedValue(0);

  useEffect(() => {
    if (shotPhase?.beat !== 'impact') return;
    // 4 oscillations over ~200 ms, decaying amplitude
    shakeX.value = withSequence(
      withTiming(3, { duration: 25 }),
      withTiming(-3, { duration: 25 }),
      withTiming(2.5, { duration: 25 }),
      withTiming(-2.5, { duration: 25 }),
      withTiming(2, { duration: 25 }),
      withTiming(-2, { duration: 25 }),
      withTiming(1, { duration: 25 }),
      withTiming(-1, { duration: 25 }),
      withTiming(0, { duration: 25 }),
    );
    shakeY.value = withSequence(
      withTiming(-2, { duration: 25 }),
      withTiming(2, { duration: 25 }),
      withTiming(-2, { duration: 25 }),
      withTiming(2, { duration: 25 }),
      withTiming(-1, { duration: 25 }),
      withTiming(1, { duration: 50 }),
      withTiming(0, { duration: 50 }),
    );
  }, [shotPhase?.beat, shakeX, shakeY]);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }, { translateY: shakeY.value }],
  }));

  // --- Divider verdict flash (HIT / MISS / SUNK) ---
  const [verdictFlash, setVerdictFlash] = useState<{ text: string; color: string } | null>(null);
  const verdictOpacity = useSharedValue(0);

  useEffect(() => {
    if (shotPhase?.beat !== 'verdict' || !shotPhase.result) return;

    const { result } = shotPhase;
    const text = result === 'sunk' ? 'SUNK!' : result === 'hit' ? 'HIT!' : 'MISS';
    const color = result === 'miss' ? GameColors.verdictMiss : GameColors.gold;

    setVerdictFlash({ text, color });
    verdictOpacity.value = 0;

    // Hold durations: MISS ~400 ms visible, HIT ~700 ms, SUNK ~1000 ms
    const hold = result === 'sunk' ? 1000 : result === 'hit' ? 700 : 400;
    verdictOpacity.value = withSequence(
      withTiming(1, { duration: 120, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: hold }),
      withTiming(0, { duration: 200, easing: Easing.in(Easing.cubic) }),
    );

    const t = setTimeout(() => setVerdictFlash(null), 120 + hold + 200);
    return () => clearTimeout(t);
  }, [shotPhase, verdictOpacity]);

  const regularTextStyle = useAnimatedStyle(() => ({
    opacity: 1 - verdictOpacity.value,
  }));
  const verdictTextStyle = useAnimatedStyle(() => ({
    opacity: verdictOpacity.value,
  }));

  // Floating sunk label
  const [sunkLabel, setSunkLabel] = useState<{ text: string; color: string } | null>(null);
  const labelOpacity = useSharedValue(0);
  const labelTranslateY = useSharedValue(0);

  useEffect(() => {
    if (!sunkEvent) return;
    const text =
      sunkEvent.owner === 'enemy'
        ? `${sunkEvent.shipType.toUpperCase()} SUNK`
        : `${sunkEvent.shipType.toUpperCase()} LOST`;
    const color = sunkEvent.owner === 'enemy' ? GameColors.gold : GameColors.red;
    setSunkLabel({ text, color });
    labelOpacity.value = 0;
    labelTranslateY.value = 10;
    labelOpacity.value = withSequence(
      withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: 300 }),
      withTiming(0, { duration: 900, easing: Easing.in(Easing.cubic) }),
    );
    labelTranslateY.value = withTiming(-50, { duration: 1500, easing: Easing.out(Easing.cubic) });
    const t = setTimeout(() => setSunkLabel(null), 1600);
    return () => clearTimeout(t);
  }, [labelOpacity, labelTranslateY, sunkEvent]);

  const sunkLabelStyle = useAnimatedStyle(() => ({
    opacity: labelOpacity.value,
    transform: [{ translateY: labelTranslateY.value }],
  }));

  const isPlayerTurn = turn === 'player';
  const dividerText = isPlayerTurn ? 'SELECT TARGET' : 'INCOMING FIRE';
  const dividerColor = isPlayerTurn ? GameColors.gold : GameColors.red;

  // Route shot animation to the correct grid
  const playerGridShot = shotPhase?.grid === 'player' ? shotPhase : undefined;
  const enemyGridShot = shotPhase?.grid === 'opponent' ? shotPhase : undefined;

  return (
    <Animated.View style={[styles.battleContent, shakeStyle]}>
      <Animated.View
        style={styles.fieldSection}
        layout={LinearTransition.duration(500).easing(Easing.out(Easing.cubic))}>
        {sunkLabel && (
          <Animated.View style={[styles.sunkLabel, sunkLabelStyle]} pointerEvents="none">
            <Text style={[styles.sunkLabelText, { color: sunkLabel.color }]}>{sunkLabel.text}</Text>
          </Animated.View>
        )}
        {/* Player grid — dims on player's turn, glows red on enemy's turn */}
        <Animated.View style={[styles.gridWrapper, playerFieldStyle]}>
          <GameField fields={fields} shotAnim={playerGridShot} />
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              styles.glowBorder,
              { borderColor: GameColors.red },
              playerGlowStyle,
            ]}
            pointerEvents="none"
          />
        </Animated.View>

        {showOpponentField && (
          <Animated.View entering={FadeInDown.duration(500).easing(Easing.out(Easing.cubic))}>
            {/* Divider — swaps text and color with each turn; flashes verdict on shot resolve */}
            <View style={styles.divider}>
              {/* Left counter — player ships remaining */}
              <Animated.View style={[styles.counterWrapper, playerCountScaleStyle]}>
                <View style={styles.shipIconPlayer} />
                <View style={styles.counterTextContainer}>
                  <Text style={[styles.counterText, { color: PLAYER_COUNTER_COLOR }]}>
                    {playerShipsRemaining}
                  </Text>
                  {playerFlashColor && (
                    <Animated.Text
                      style={[
                        styles.counterText,
                        styles.counterFlashText,
                        { color: playerFlashColor },
                        playerFlashOpacityStyle,
                      ]}>
                      {playerShipsRemaining}
                    </Animated.Text>
                  )}
                </View>
              </Animated.View>

              <Animated.View
                style={[styles.dividerLine, dividerLineStyle, { backgroundColor: dividerColor }]}
              />
              <View style={styles.dividerTextContainer}>
                <Animated.Text
                  style={[styles.dividerText, { color: dividerColor }, regularTextStyle]}>
                  {dividerText}
                </Animated.Text>
                {verdictFlash && (
                  <Animated.Text
                    style={[
                      styles.dividerText,
                      styles.verdictText,
                      { color: verdictFlash.color },
                      verdictTextStyle,
                    ]}>
                    {verdictFlash.text}
                  </Animated.Text>
                )}
              </View>
              <Animated.View
                style={[styles.dividerLine, dividerLineStyle, { backgroundColor: dividerColor }]}
              />

              {/* Right counter — enemy ships remaining */}
              <Animated.View style={[styles.counterWrapper, enemyCountScaleStyle]}>
                <View style={styles.counterTextContainer}>
                  <Text style={[styles.counterText, { color: ENEMY_COUNTER_COLOR }]}>
                    {enemyShipsRemaining}
                  </Text>
                  {enemyFlashColor && (
                    <Animated.Text
                      style={[
                        styles.counterText,
                        styles.counterFlashText,
                        { color: enemyFlashColor },
                        enemyFlashOpacityStyle,
                      ]}>
                      {enemyShipsRemaining}
                    </Animated.Text>
                  )}
                </View>
                <View style={styles.shipIconEnemy} />
              </Animated.View>
            </View>

            {/* Enemy grid — glows gold on player's turn, dims on enemy's turn */}
            <Animated.View style={[styles.gridWrapper, enemyFieldStyle]}>
              <GameField
                fields={opponentFields}
                tint={GameColors.enemyGridTint}
                hideShips
                onCellPress={turn === 'player' ? onEnemyCellPress : undefined}
                shotAnim={enemyGridShot}
              />
              <Animated.View
                style={[
                  StyleSheet.absoluteFill,
                  styles.glowBorder,
                  { borderColor: GameColors.gold },
                  enemyGlowStyle,
                ]}
                pointerEvents="none"
              />
            </Animated.View>
          </Animated.View>
        )}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  battleContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  fieldSection: {
    gap: 16,
    alignItems: 'center',
  },
  gridWrapper: {
    alignSelf: 'center',
  },
  glowBorder: {
    borderWidth: 2,
    borderRadius: 4,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerTextContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dividerText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 3,
  },
  verdictText: {
    position: 'absolute',
    fontFamily: 'BlackOpsOne',
    fontSize: 13,
  },
  counterWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  shipIconPlayer: {
    width: 0,
    height: 0,
    borderTopWidth: 3,
    borderBottomWidth: 3,
    borderLeftWidth: 6,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: PLAYER_COUNTER_COLOR,
  },
  shipIconEnemy: {
    width: 0,
    height: 0,
    borderTopWidth: 3,
    borderBottomWidth: 3,
    borderRightWidth: 6,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: ENEMY_COUNTER_COLOR,
  },
  counterTextContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterText: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 3,
  },
  counterFlashText: {
    position: 'absolute',
  },
  sunkLabel: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 10,
    top: '40%',
  },
  sunkLabelText: {
    fontFamily: 'BlackOpsOne',
    fontSize: 22,
    letterSpacing: 3,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
});
