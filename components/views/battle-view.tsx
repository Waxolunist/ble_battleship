import { GameField } from '@/components/game-field';
import type { Field, ShotPhase, ShipType } from '@/models/types';
import { GameColors } from '@/constants/theme';
import { DEV_SHOW_FORCE_VICTORY } from '@/constants/dev';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
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
  onRetreat?: () => void;
  onVictory?: () => void;
  onPlayAgain?: () => void;
  onMakePort?: () => void;
};

export function BattleView({
  fields,
  opponentFields,
  showOpponentField,
  turn,
  sunkEvent,
  shotPhase,
  onEnemyCellPress,
  onRetreat,
  onVictory,
  onPlayAgain,
  onMakePort,
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

  // --- Victory visualization ---
  const [isVictory, setIsVictory] = useState(false);
  const [showVictoryButtons, setShowVictoryButtons] = useState(false);
  const hasTriggeredVictory = useRef(false);

  const victoryGridFlashOpacity = useSharedValue(0);
  const victoryOverlayOpacity = useSharedValue(0);
  const victoryWordScale = useSharedValue(0.5);
  const victoryWordOpacity = useSharedValue(0);
  const victorySubtitleOpacity = useSharedValue(0);
  const playerPulseOpacity = useSharedValue(0);
  const victoryButtonsOpacity = useSharedValue(0);

  const victoryGridFlashStyle = useAnimatedStyle(() => ({
    opacity: victoryGridFlashOpacity.value,
  }));
  const victoryOverlayStyle = useAnimatedStyle(() => ({
    opacity: victoryOverlayOpacity.value,
  }));
  const victoryWordStyle = useAnimatedStyle(() => ({
    opacity: victoryWordOpacity.value,
    transform: [{ scale: victoryWordScale.value }],
  }));
  const victorySubtitleStyle = useAnimatedStyle(() => ({
    opacity: victorySubtitleOpacity.value,
  }));
  const playerPulseStyle = useAnimatedStyle(() => ({
    opacity: playerPulseOpacity.value,
  }));
  const victoryButtonsStyle = useAnimatedStyle(() => ({
    opacity: victoryButtonsOpacity.value,
  }));

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

  useEffect(() => {
    if (!showOpponentField || hasTriggeredVictory.current || enemyShipsRemaining !== 0) return;
    hasTriggeredVictory.current = true;
    setIsVictory(true);

    (async () => {
      // Haptics: medium × 3 → heavy
      if (Platform.OS !== 'web') {
        const { impactAsync, ImpactFeedbackStyle } = await import('expo-haptics');
        impactAsync(ImpactFeedbackStyle.Medium).catch(() => {});
        setTimeout(() => impactAsync(ImpactFeedbackStyle.Medium).catch(() => {}), 200);
        setTimeout(() => impactAsync(ImpactFeedbackStyle.Medium).catch(() => {}), 400);
        setTimeout(() => impactAsync(ImpactFeedbackStyle.Heavy).catch(() => {}), 600);
      }

      // Three screen-shake bursts (0, 200, 400ms)
      const doShake = () => {
        shakeX.value = withSequence(
          withTiming(4, { duration: 25 }),
          withTiming(-4, { duration: 25 }),
          withTiming(3, { duration: 25 }),
          withTiming(-3, { duration: 25 }),
          withTiming(0, { duration: 25 }),
        );
        shakeY.value = withSequence(
          withTiming(-3, { duration: 25 }),
          withTiming(3, { duration: 25 }),
          withTiming(-2, { duration: 25 }),
          withTiming(2, { duration: 25 }),
          withTiming(0, { duration: 25 }),
        );
      };
      doShake();
      setTimeout(doShake, 200);
      setTimeout(doShake, 400);

      // Gold flash over enemy grid × 3 (0–0.6s)
      victoryGridFlashOpacity.value = withSequence(
        withTiming(0.7, { duration: 100 }),
        withTiming(0, { duration: 150 }),
        withTiming(0.7, { duration: 100 }),
        withTiming(0, { duration: 150 }),
        withTiming(0.7, { duration: 100 }),
        withTiming(0, { duration: 150 }),
      );

      // Dark overlay + VICTORY slams in (0.6s)
      setTimeout(() => {
        victoryOverlayOpacity.value = withTiming(0.82, { duration: 400 });
        victoryWordScale.value = 0.5;
        victoryWordOpacity.value = 0;
        victoryWordScale.value = withTiming(1, { duration: 350, easing: Easing.out(Easing.cubic) });
        victoryWordOpacity.value = withTiming(1, {
          duration: 200,
          easing: Easing.out(Easing.cubic),
        });
      }, 600);

      // Subtitle fades in (1.0s)
      setTimeout(() => {
        victorySubtitleOpacity.value = withTiming(1, {
          duration: 300,
          easing: Easing.out(Easing.cubic),
        });
      }, 1000);

      // Player fleet pulse (1.2s, loops indefinitely)
      setTimeout(() => {
        playerPulseOpacity.value = withRepeat(
          withSequence(
            withTiming(0.4, { duration: 600, easing: Easing.inOut(Easing.sin) }),
            withTiming(0.15, { duration: 600, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
          false,
        );
      }, 1200);

      // Post-game buttons fade in (3.0s)
      setTimeout(() => {
        setShowVictoryButtons(true);
        victoryButtonsOpacity.value = withTiming(1, {
          duration: 400,
          easing: Easing.out(Easing.cubic),
        });
      }, 3000);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enemyShipsRemaining, showOpponentField]);

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

  // --- Retreat button + visualization ---
  const [confirmingRetreat, setConfirmingRetreat] = useState(false);
  const [isRetreating, setIsRetreating] = useState(false);
  const [submergeX, setSubmergeX] = useState(-1);
  const [showDefeatButtons, setShowDefeatButtons] = useState(false);

  const flagOpacity = useSharedValue(0);
  const flagTranslateY = useSharedValue(10);
  const darkOverlayOpacity = useSharedValue(0);
  const retreatWordOpacity = useSharedValue(0);
  const defeatGridFlashOpacity = useSharedValue(0);
  const defeatSubtitleOpacity = useSharedValue(0);
  const defeatButtonsOpacity = useSharedValue(0);

  const flagAnimStyle = useAnimatedStyle(() => ({
    opacity: flagOpacity.value,
    transform: [{ translateY: flagTranslateY.value }],
  }));
  const darkOverlayStyle = useAnimatedStyle(() => ({
    opacity: darkOverlayOpacity.value,
  }));
  const retreatWordStyle = useAnimatedStyle(() => ({
    opacity: retreatWordOpacity.value,
  }));
  const defeatGridFlashStyle = useAnimatedStyle(() => ({
    opacity: defeatGridFlashOpacity.value,
  }));
  const defeatSubtitleStyle = useAnimatedStyle(() => ({
    opacity: defeatSubtitleOpacity.value,
  }));
  const defeatButtonsStyle = useAnimatedStyle(() => ({
    opacity: defeatButtonsOpacity.value,
  }));

  // Dims to 50% during enemy turn
  const retreatButtonStyle = useAnimatedStyle(() => ({
    opacity: interpolate(turnSV.value, [0, 1], [1, 0.5]),
  }));

  const triggerRetreatVisualization = async () => {
    setConfirmingRetreat(false);
    setIsRetreating(true);

    // Haptics: light → light → heavy (defeat sequence)
    if (Platform.OS !== 'web') {
      const { impactAsync, ImpactFeedbackStyle } = await import('expo-haptics');
      impactAsync(ImpactFeedbackStyle.Light).catch(() => {});
      setTimeout(() => impactAsync(ImpactFeedbackStyle.Light).catch(() => {}), 200);
      setTimeout(() => impactAsync(ImpactFeedbackStyle.Heavy).catch(() => {}), 400);
    }

    // Three screen-shake bursts (0, 200, 400ms) — mirrors victory
    const doShake = () => {
      shakeX.value = withSequence(
        withTiming(4, { duration: 25 }),
        withTiming(-4, { duration: 25 }),
        withTiming(3, { duration: 25 }),
        withTiming(-3, { duration: 25 }),
        withTiming(0, { duration: 25 }),
      );
      shakeY.value = withSequence(
        withTiming(-3, { duration: 25 }),
        withTiming(3, { duration: 25 }),
        withTiming(-2, { duration: 25 }),
        withTiming(2, { duration: 25 }),
        withTiming(0, { duration: 25 }),
      );
    };
    doShake();
    setTimeout(doShake, 200);
    setTimeout(doShake, 400);

    // Red flash over player grid × 3 (0–0.6s) — mirrors victory's gold flash
    defeatGridFlashOpacity.value = withSequence(
      withTiming(0.7, { duration: 100 }),
      withTiming(0, { duration: 150 }),
      withTiming(0.7, { duration: 100 }),
      withTiming(0, { duration: 150 }),
      withTiming(0.7, { duration: 100 }),
      withTiming(0, { duration: 150 }),
    );

    // 1. Flag raised (0–0.4s)
    flagOpacity.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) });
    flagTranslateY.value = withTiming(-5, { duration: 400, easing: Easing.out(Easing.cubic) });

    // 2. Fleet submersion wave (0.4–1.4s), one column per 100ms
    for (let col = 0; col < 10; col++) {
      setTimeout(() => setSubmergeX(col), 400 + col * 100);
    }

    // 3. Screen darkens + title (1.0s)
    setTimeout(() => {
      darkOverlayOpacity.value = withTiming(0.85, { duration: 800 });
      retreatWordOpacity.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) });
    }, 1000);

    // 4. Subtitle fades in (1.4s)
    setTimeout(() => {
      defeatSubtitleOpacity.value = withTiming(1, {
        duration: 300,
        easing: Easing.out(Easing.cubic),
      });
    }, 1400);

    // 5. Buttons appear (3.0s)
    setTimeout(() => {
      setShowDefeatButtons(true);
      defeatButtonsOpacity.value = withTiming(1, {
        duration: 400,
        easing: Easing.out(Easing.cubic),
      });
    }, 3000);
  };

  const handleRetreatPress = async () => {
    if (Platform.OS !== 'web') {
      const { impactAsync, ImpactFeedbackStyle } = await import('expo-haptics');
      impactAsync(ImpactFeedbackStyle.Medium).catch(() => {});
    }
    setConfirmingRetreat(true);
  };

  const handleRetreatLongPress = () => {
    triggerRetreatVisualization();
  };

  const handleRetreatConfirm = () => {
    triggerRetreatVisualization();
  };

  // Route shot animation to the correct grid
  const playerGridShot = shotPhase?.grid === 'player' ? shotPhase : undefined;
  const enemyGridShot = shotPhase?.grid === 'opponent' ? shotPhase : undefined;

  return (
    <Animated.View style={[styles.battleContent, shakeStyle]}>
      {/* Dev: force-outcome buttons — bottom-right, battle phase only */}
      {DEV_SHOW_FORCE_VICTORY && showOpponentField && !isRetreating && !isVictory && (
        <View style={styles.devButtonsContainer}>
          <Pressable onPress={onVictory} style={styles.devVictoryButton}>
            <Text style={styles.devVictoryText}>V</Text>
          </Pressable>
          <Pressable onPress={triggerRetreatVisualization} style={styles.devDefeatButton}>
            <Text style={styles.devDefeatText}>L</Text>
          </Pressable>
        </View>
      )}

      {/* Retreat button — bottom-left, dims during enemy turn, hidden once animation begins */}
      {!isRetreating && (
        <Animated.View style={[styles.retreatButton, retreatButtonStyle]}>
          <Pressable
            onPress={handleRetreatPress}
            onLongPress={handleRetreatLongPress}
            delayLongPress={600}
            style={({ pressed }) => [
              styles.retreatButtonInner,
              pressed && styles.retreatButtonPressed,
            ]}>
            <Text style={styles.retreatIcon}>⚓</Text>
            <Text style={styles.retreatText}>RETREAT</Text>
          </Pressable>
        </Animated.View>
      )}

      {/* Confirmation overlay */}
      {confirmingRetreat && (
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmDialog}>
            <Text style={styles.confirmMessage}>
              {'Abandon battle?\nYour fleet will be lost to the sea.'}
            </Text>
            <View style={styles.confirmButtons}>
              <Pressable
                onPress={() => setConfirmingRetreat(false)}
                style={({ pressed }) => [styles.holdButton, pressed && styles.holdButtonPressed]}>
                <Text style={styles.holdButtonText}>HOLD THE LINE</Text>
              </Pressable>
              <Pressable
                onPress={handleRetreatConfirm}
                style={({ pressed }) => [
                  styles.confirmRetreatButton,
                  pressed && styles.confirmRetreatButtonPressed,
                ]}>
                <Text style={styles.confirmRetreatText}>RETREAT</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
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
          {/* Defeat: red flash over player grid */}
          {isRetreating && (
            <Animated.View
              style={[StyleSheet.absoluteFill, styles.defeatGridFlash, defeatGridFlashStyle]}
              pointerEvents="none"
            />
          )}
          {/* Victory: bright pulse over surviving player ship cells */}
          {isVictory && (
            <Animated.View
              style={[StyleSheet.absoluteFill, styles.playerPulseOverlay, playerPulseStyle]}
              pointerEvents="none"
            />
          )}
          {/* White flag — fades in and floats up at retreat start */}
          {isRetreating && (
            <Animated.View style={[styles.retreatFlagWrapper, flagAnimStyle]} pointerEvents="none">
              <Text style={styles.retreatFlagText}>🏳️</Text>
            </Animated.View>
          )}
          <GameField fields={fields} shotAnim={playerGridShot} retreatSubmergeX={submergeX} />
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
              {/* Victory: cannon-fire gold flash */}
              {isVictory && (
                <Animated.View
                  style={[StyleSheet.absoluteFill, styles.victoryGridFlash, victoryGridFlashStyle]}
                  pointerEvents="none"
                />
              )}
            </Animated.View>
          </Animated.View>
        )}
      </Animated.View>

      {/* Victory visualization overlays */}
      {isVictory && (
        <>
          {/* Dark navy overlay fades in behind the callout */}
          <Animated.View
            style={[StyleSheet.absoluteFill, styles.victoryOverlay, victoryOverlayStyle]}
            pointerEvents="none"
          />
          {/* VICTORY callout + subtitle + post-game buttons */}
          <Animated.View
            style={[StyleSheet.absoluteFill, styles.victoryCalloutWrapper]}
            pointerEvents={showVictoryButtons ? 'box-none' : 'none'}>
            <Animated.Text style={[styles.victoryText, victoryWordStyle]}>VICTORY</Animated.Text>
            <Animated.Text style={[styles.victorySubtitle, victorySubtitleStyle]}>
              Enemy fleet destroyed.
            </Animated.Text>
            {showVictoryButtons && (
              <Animated.View style={[styles.victoryButtons, victoryButtonsStyle]}>
                <Pressable
                  onPress={onPlayAgain}
                  style={({ pressed }) => [
                    styles.playAgainButton,
                    pressed && styles.playAgainButtonPressed,
                  ]}>
                  <Text style={styles.playAgainText}>PLAY AGAIN</Text>
                </Pressable>
                <Pressable
                  onPress={onMakePort}
                  style={({ pressed }) => [
                    styles.makePortButton,
                    pressed && styles.makePortButtonPressed,
                  ]}>
                  <Text style={styles.makePortText}>MAKE PORT</Text>
                </Pressable>
              </Animated.View>
            )}
          </Animated.View>
        </>
      )}

      {/* Defeat visualization overlays — rendered last so they sit above all game UI */}
      {isRetreating && (
        <>
          {/* Deep navy screen darkens over 800ms */}
          <Animated.View
            style={[StyleSheet.absoluteFill, styles.retreatDarkOverlay, darkOverlayStyle]}
            pointerEvents="none"
          />
          {/* Loss title + subtitle + post-game buttons */}
          <Animated.View
            style={[StyleSheet.absoluteFill, styles.retreatWordOverlay]}
            pointerEvents={showDefeatButtons ? 'box-none' : 'none'}>
            <Animated.Text style={[styles.retreatWordText, retreatWordStyle]}>
              LOST AT SEA
            </Animated.Text>
            <Animated.Text style={[styles.victorySubtitle, defeatSubtitleStyle]}>
              Your fleet was lost.
            </Animated.Text>
            {showDefeatButtons && (
              <Animated.View style={[styles.victoryButtons, defeatButtonsStyle]}>
                <Pressable
                  onPress={onPlayAgain}
                  style={({ pressed }) => [
                    styles.playAgainButton,
                    pressed && styles.playAgainButtonPressed,
                  ]}>
                  <Text style={styles.playAgainText}>REVENGE</Text>
                </Pressable>
                <Pressable
                  onPress={onMakePort}
                  style={({ pressed }) => [
                    styles.makePortButton,
                    pressed && styles.makePortButtonPressed,
                  ]}>
                  <Text style={styles.makePortText}>MAKE PORT</Text>
                </Pressable>
              </Animated.View>
            )}
          </Animated.View>
        </>
      )}
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
  retreatButton: {
    position: 'absolute',
    bottom: 24,
    left: 24,
  },
  retreatButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: GameColors.blueBorder,
    borderRadius: 4,
  },
  retreatButtonPressed: {
    backgroundColor: 'rgba(80, 160, 255, 0.1)',
  },
  retreatIcon: {
    fontSize: 10,
    color: GameColors.labelFaded,
  },
  retreatText: {
    fontFamily: 'BlackOpsOne',
    fontSize: 11,
    letterSpacing: 3,
    color: GameColors.label,
  },
  confirmOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    backgroundColor: 'rgba(4, 8, 20, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmDialog: {
    backgroundColor: 'rgba(0, 0, 0, 0.97)',
    borderWidth: 1,
    borderColor: GameColors.blueBorder,
    borderRadius: 6,
    paddingVertical: 28,
    paddingHorizontal: 32,
    alignItems: 'center',
    gap: 24,
    marginHorizontal: 32,
  },
  confirmMessage: {
    fontFamily: 'BlackOpsOne',
    fontSize: 14,
    letterSpacing: 1,
    color: GameColors.label,
    textAlign: 'center',
    lineHeight: 22,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  holdButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: GameColors.blueBorder,
    borderRadius: 4,
  },
  holdButtonPressed: {
    backgroundColor: 'rgba(80, 160, 255, 0.1)',
  },
  holdButtonText: {
    fontFamily: 'BlackOpsOne',
    fontSize: 11,
    letterSpacing: 2,
    color: GameColors.label,
  },
  confirmRetreatButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: GameColors.red,
    borderRadius: 4,
  },
  confirmRetreatButtonPressed: {
    backgroundColor: 'rgba(255, 80, 80, 0.15)',
  },
  confirmRetreatText: {
    fontFamily: 'BlackOpsOne',
    fontSize: 11,
    letterSpacing: 2,
    color: GameColors.red,
  },
  retreatFlagWrapper: {
    position: 'absolute',
    top: -44,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 15,
  },
  retreatFlagText: {
    fontSize: 28,
  },
  retreatDarkOverlay: {
    zIndex: 20,
    backgroundColor: GameColors.retreatOverlay,
  },
  retreatWordOverlay: {
    zIndex: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retreatWordText: {
    fontFamily: 'BlackOpsOne',
    fontSize: 48,
    letterSpacing: 4,
    color: GameColors.red,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 12,
  },
  playerPulseOverlay: {
    backgroundColor: 'rgba(120, 200, 255, 0.9)',
    borderRadius: 2,
  },
  defeatGridFlash: {
    backgroundColor: GameColors.red,
    borderRadius: 2,
  },
  victoryGridFlash: {
    backgroundColor: GameColors.fireGlow,
    borderRadius: 2,
  },
  victoryOverlay: {
    zIndex: 20,
    backgroundColor: GameColors.retreatOverlay,
  },
  victoryCalloutWrapper: {
    zIndex: 21,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  victoryText: {
    fontFamily: 'BlackOpsOne',
    fontSize: 52,
    letterSpacing: 4,
    color: GameColors.gold,
    textShadowColor: 'rgba(255, 200, 0, 0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  victorySubtitle: {
    fontFamily: 'BlackOpsOne',
    fontSize: 14,
    letterSpacing: 2,
    color: GameColors.label,
  },
  victoryButtons: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 32,
  },
  playAgainButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderWidth: 2,
    borderColor: GameColors.fireGold,
    borderRadius: 4,
  },
  playAgainButtonPressed: {
    backgroundColor: GameColors.fireGoldBgPressed,
  },
  playAgainText: {
    fontFamily: 'BlackOpsOne',
    fontSize: 13,
    letterSpacing: 2,
    color: GameColors.fireGold,
  },
  makePortButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: GameColors.blueBorder,
    borderRadius: 4,
  },
  makePortButtonPressed: {
    backgroundColor: 'rgba(80, 160, 255, 0.1)',
  },
  makePortText: {
    fontFamily: 'BlackOpsOne',
    fontSize: 13,
    letterSpacing: 2,
    color: GameColors.label,
  },
  devButtonsContainer: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    flexDirection: 'row',
    gap: 8,
  },
  devVictoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: GameColors.fireGold,
    borderRadius: 4,
  },
  devVictoryText: {
    fontFamily: 'BlackOpsOne',
    fontSize: 11,
    letterSpacing: 3,
    color: GameColors.fireGold,
  },
  devDefeatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: GameColors.red,
    borderRadius: 4,
  },
  devDefeatText: {
    fontFamily: 'BlackOpsOne',
    fontSize: 11,
    letterSpacing: 3,
    color: GameColors.red,
  },
});
