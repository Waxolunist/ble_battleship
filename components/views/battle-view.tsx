import { useTranslation } from 'react-i18next';
import { GameField } from '@/components/game-field';
import { HapticPressable } from '@/components/haptic-pressable';
import { TutorialHelpButton } from '@/components/tutorial-help-button';
import { DEV_SHOW_FORCE_VICTORY } from '@/constants/dev';
import { GameColors } from '@/constants/theme';
import type { Field, ShotPhase, ShipType } from '@/models/types';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown, LinearTransition } from 'react-native-reanimated';
import { ENEMY_COUNTER_COLOR, PLAYER_COUNTER_COLOR, styles } from './battle-view.styles';
import { useRetreatAnimation } from './use-retreat-animation';
import { useScreenShake } from './use-screen-shake';
import { useTurnAnimations } from './use-turn-animations';
import { useVerdictAnimations } from './use-verdict-animations';
import { useVictoryAnimation } from './use-victory-animation';

type SunkEvent = { shipType: ShipType; owner: 'player' | 'enemy' } | null;

function countShipsRemaining(fields: Field[][]): number {
  const shipSunkMap = new Map<string, boolean>();
  for (const row of fields) {
    for (const cell of row) {
      if (!cell.shipPart) continue;
      const id = cell.shipPart.ship.id;
      if (!shipSunkMap.has(id)) shipSunkMap.set(id, true);
      if (cell.status !== 'sunk') shipSunkMap.set(id, false);
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
  onVictory?: () => void;
  onPlayAgain?: () => void;
  onMakePort?: () => void;
  onGameEnd?: (outcome: 'victory' | 'defeat') => void;
  onSinkAllPlayerShips?: () => void;
  playerGridRef?: React.RefObject<View | null>;
  enemyGridRef?: React.RefObject<View | null>;
  dividerRef?: React.RefObject<View | null>;
  playerCounterRef?: React.RefObject<View | null>;
  enemyCounterRef?: React.RefObject<View | null>;
  retreatRef?: React.RefObject<View | null>;
  onReplayTutorial?: () => void;
};

export function BattleView({
  fields,
  opponentFields,
  showOpponentField,
  turn,
  sunkEvent,
  shotPhase,
  onEnemyCellPress,
  onVictory,
  onPlayAgain,
  onMakePort,
  onGameEnd,
  onSinkAllPlayerShips,
  playerGridRef,
  enemyGridRef,
  dividerRef,
  playerCounterRef,
  enemyCounterRef,
  retreatRef,
  onReplayTutorial,
}: BattleViewProps) {
  const { t } = useTranslation('battle');
  const playerShipsRemaining = countShipsRemaining(fields);
  const enemyShipsRemaining = countShipsRemaining(opponentFields);

  const { shakeX, shakeY, shakeStyle } = useScreenShake(shotPhase);

  const {
    turnSV,
    playerFieldStyle,
    enemyFieldStyle,
    enemyGlowStyle,
    playerGlowStyle,
    dividerLineStyle,
    playerCountScaleStyle,
    enemyCountScaleStyle,
    playerFlashOpacityStyle,
    enemyFlashOpacityStyle,
    playerFlashColor,
    enemyFlashColor,
  } = useTurnAnimations(turn, sunkEvent);

  const { verdictFlash, regularTextStyle, verdictTextStyle, sunkLabel, sunkLabelStyle } =
    useVerdictAnimations(shotPhase, sunkEvent, t);

  const {
    isVictory,
    showVictoryButtons,
    victoryGridFlashStyle,
    victoryOverlayStyle,
    victoryWordStyle,
    victorySubtitleStyle,
    playerPulseStyle,
    victoryButtonsStyle,
  } = useVictoryAnimation({ enemyShipsRemaining, showOpponentField, shakeX, shakeY, onGameEnd });

  const {
    confirmingRetreat,
    setConfirmingRetreat,
    isRetreating,
    showDefeatButtons,
    submergeX,
    flagAnimStyle,
    darkOverlayStyle,
    retreatWordStyle,
    defeatGridFlashStyle,
    defeatSubtitleStyle,
    defeatButtonsStyle,
    enemyPulseStyle,
    retreatButtonStyle,
    triggerRetreatVisualization,
    handleRetreatPress,
    handleRetreatLongPress,
    handleRetreatConfirm,
  } = useRetreatAnimation({
    shakeX,
    shakeY,
    turnSV,
    playerShipsRemaining,
    showOpponentField,
    onGameEnd,
  });

  const isPlayerTurn = turn === 'player';
  const dividerText = isPlayerTurn ? t('divider.selectTarget') : t('divider.incomingFire');
  const dividerColor = isPlayerTurn ? GameColors.gold : GameColors.red;

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
          <Pressable
            onPress={() => {
              onSinkAllPlayerShips?.();
              triggerRetreatVisualization();
            }}
            style={styles.devDefeatButton}>
            <Text style={styles.devDefeatText}>L</Text>
          </Pressable>
        </View>
      )}

      {/* Retreat button — bottom-left, dims during enemy turn, hidden once animation begins */}
      {!isRetreating && !isVictory && (
        <Animated.View ref={retreatRef} style={[styles.retreatButton, retreatButtonStyle]}>
          <Pressable
            onPress={handleRetreatPress}
            onLongPress={handleRetreatLongPress}
            delayLongPress={600}
            style={({ pressed }) => [
              styles.retreatButtonInner,
              pressed && styles.retreatButtonPressed,
            ]}>
            <Text style={styles.retreatIcon}>⚓</Text>
            <Text style={styles.retreatText}>{t('retreat.button')}</Text>
          </Pressable>
        </Animated.View>
      )}

      {/* Confirmation overlay */}
      {confirmingRetreat && (
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmDialog}>
            <Text style={styles.confirmMessage}>{t('retreat.confirmMessage')}</Text>
            <View style={styles.confirmButtons}>
              <Pressable
                onPress={() => setConfirmingRetreat(false)}
                style={({ pressed }) => [styles.holdButton, pressed && styles.holdButtonPressed]}>
                <Text style={styles.holdButtonText}>{t('retreat.holdTheLine')}</Text>
              </Pressable>
              <Pressable
                onPress={handleRetreatConfirm}
                style={({ pressed }) => [
                  styles.confirmRetreatButton,
                  pressed && styles.confirmRetreatButtonPressed,
                ]}>
                <Text style={styles.confirmRetreatText}>{t('retreat.confirm')}</Text>
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
        <Animated.View ref={playerGridRef} style={[styles.gridWrapper, playerFieldStyle]}>
          {isRetreating && (
            <Animated.View
              style={[StyleSheet.absoluteFill, styles.defeatGridFlash, defeatGridFlashStyle]}
              pointerEvents="none"
            />
          )}
          {isVictory && (
            <Animated.View
              style={[StyleSheet.absoluteFill, styles.playerPulseOverlay, playerPulseStyle]}
              pointerEvents="none"
            />
          )}
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
            {/* Divider — swaps text and color each turn; flashes verdict on shot resolve */}
            <View ref={dividerRef} style={styles.divider}>
              {/* Left counter — player ships remaining */}
              <Animated.View
                ref={playerCounterRef}
                style={[styles.counterWrapper, playerCountScaleStyle]}>
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
              <Animated.View
                ref={enemyCounterRef}
                style={[styles.counterWrapper, enemyCountScaleStyle]}>
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
            <Animated.View ref={enemyGridRef} style={[styles.gridWrapper, enemyFieldStyle]}>
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
              {isVictory && (
                <Animated.View
                  style={[StyleSheet.absoluteFill, styles.victoryGridFlash, victoryGridFlashStyle]}
                  pointerEvents="none"
                />
              )}
              {isRetreating && (
                <Animated.View
                  style={[StyleSheet.absoluteFill, styles.enemyPulseOverlay, enemyPulseStyle]}
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
          <Animated.View
            style={[StyleSheet.absoluteFill, styles.victoryOverlay, victoryOverlayStyle]}
            pointerEvents="none"
          />
          <Animated.View
            style={[StyleSheet.absoluteFill, styles.victoryCalloutWrapper]}
            pointerEvents={showVictoryButtons ? 'box-none' : 'none'}>
            <Animated.Text style={[styles.victoryText, victoryWordStyle]}>
              {t('victory.title')}
            </Animated.Text>
            <Animated.Text style={[styles.endgameSubtitle, victorySubtitleStyle]}>
              {t('victory.subtitle')}
            </Animated.Text>
            {showVictoryButtons && (
              <Animated.View style={[styles.endgameButtons, victoryButtonsStyle]}>
                <HapticPressable
                  onPress={onPlayAgain}
                  style={({ pressed }) => [
                    styles.playAgainButton,
                    pressed && styles.playAgainButtonPressed,
                  ]}>
                  <Text style={styles.playAgainText}>{t('victory.playAgain')}</Text>
                </HapticPressable>
                <HapticPressable
                  onPress={onMakePort}
                  style={({ pressed }) => [
                    styles.makePortButton,
                    pressed && styles.makePortButtonPressed,
                  ]}>
                  <Text style={styles.makePortText}>{t('victory.makePort')}</Text>
                </HapticPressable>
              </Animated.View>
            )}
          </Animated.View>
        </>
      )}

      {/* Tutorial replay button — bottom-right, hidden during endgame */}
      {!isRetreating && !isVictory && showOpponentField && onReplayTutorial && (
        <TutorialHelpButton onPress={onReplayTutorial} bottom={24} right={24} />
      )}

      {/* Defeat visualization overlays — rendered last so they sit above all game UI */}
      {isRetreating && (
        <>
          <Animated.View
            style={[StyleSheet.absoluteFill, styles.retreatDarkOverlay, darkOverlayStyle]}
            pointerEvents="none"
          />
          <Animated.View
            style={[StyleSheet.absoluteFill, styles.retreatWordOverlay]}
            pointerEvents={showDefeatButtons ? 'box-none' : 'none'}>
            <Animated.Text style={[styles.retreatWordText, retreatWordStyle]}>
              {t('defeat.title')}
            </Animated.Text>
            <Animated.Text style={[styles.endgameSubtitle, defeatSubtitleStyle]}>
              {t('defeat.subtitle')}
            </Animated.Text>
            {showDefeatButtons && (
              <Animated.View style={[styles.endgameButtons, defeatButtonsStyle]}>
                <HapticPressable
                  onPress={onPlayAgain}
                  style={({ pressed }) => [
                    styles.playAgainButton,
                    pressed && styles.playAgainButtonPressed,
                  ]}>
                  <Text style={styles.playAgainText}>{t('defeat.revenge')}</Text>
                </HapticPressable>
                <HapticPressable
                  onPress={onMakePort}
                  style={({ pressed }) => [
                    styles.makePortButton,
                    pressed && styles.makePortButtonPressed,
                  ]}>
                  <Text style={styles.makePortText}>{t('defeat.makePort')}</Text>
                </HapticPressable>
              </Animated.View>
            )}
          </Animated.View>
        </>
      )}
    </Animated.View>
  );
}
