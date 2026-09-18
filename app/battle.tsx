import { DragPreview } from '@/components/drag-preview';
import { HapticPressable } from '@/components/haptic-pressable';
import { LABEL_SIZE } from '@/components/game-field';
import {
  MultiplayerConnectionGuard,
  useMultiplayerGuard,
} from '@/components/multiplayer/MultiplayerConnectionGuard';
import { BattleView } from '@/components/views/battle-view';
import { PlacementView } from '@/components/views/placement-view';
import { IMAGES, LOCALE_IMAGES } from '@/constants/assets';
import { Fonts, GameColors } from '@/constants/theme';
import { useTranslation } from 'react-i18next';
import { useAIOpponent } from '@/hooks/useAIOpponent';
import { useMultiplayerOpponent } from '@/hooks/useMultiplayerOpponent';
import { useBattleAnimations } from '@/hooks/useBattleAnimations';
import { useCombat } from '@/hooks/useCombat';
import { usePlacementGestures } from '@/hooks/usePlacementGestures';
import type { Opponent } from '@/models/opponent';
import { leaveMultiplayerSession } from '@/services/multiplayer';
import { getRankTitle, translateRankTitle, SHIP_FLEET } from '@/models/types';
import { useMultiplayerStore } from '@/store/useMultiplayerStore';
import { useGameStore } from '@/store/useGameStore';
import { useCaptainStore } from '@/store/useCaptainStore';
import { useStatsStore, computeFieldShotStats, computeSunkShipTypes } from '@/store/useStatsStore';
import { usePlacementTour } from '@/hooks/usePlacementTour';
import { useBattleTour } from '@/hooks/useBattleTour';
import { useRouter } from 'expo-router';
import { useResponsive } from '@/hooks/useResponsive';
import { Image, ImageBackground, StyleSheet, Text, View } from 'react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

// Each branch mounts a sibling component so the opponent hook is called unconditionally.
export default function BattleScreen() {
  // Latched on mount rather than subscribed: tearing a multiplayer session
  // down resets `mode` to 'ai', and re-rendering this route as an AI battle
  // would remount the entire battle UI on the way out — including the tutorial,
  // which then leaves a full-screen modal over the app swallowing every touch.
  const [mode] = useState(() => useMultiplayerStore.getState().mode);
  return mode === 'multiplayer' ? <MultiplayerBattleScreen /> : <AIBattleScreen />;
}

function AIBattleScreen() {
  const opponent = useAIOpponent();
  return <BattleScreenBody opponent={opponent} />;
}

function MultiplayerBattleScreen() {
  return (
    <MultiplayerConnectionGuard>
      <MultiplayerBattleContent />
    </MultiplayerConnectionGuard>
  );
}

function MultiplayerBattleContent() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const opponent = useMultiplayerOpponent();
  const { requestRematch, cancelRematch, rematchPending } = useMultiplayerGuard();
  const localFleetReady = useMultiplayerStore(s => s.localFleetReady);
  const remoteFleetReady = useMultiplayerStore(s => s.remoteFleetReady);
  const resetGame = useGameStore(s => s.resetGame);

  // Same exit as Make Port. There is no lesser exit from a placement wait: our
  // fleet is already committed and the peer is mid-placement, so there is no
  // screen left to go back to.
  const handleLeaveWhileWaiting = useCallback(() => {
    const mp = useMultiplayerStore.getState();
    resetGame();
    router.replace('/');
    leaveMultiplayerSession().catch(err =>
      console.error('[BattleScreen] leaving while waiting failed:', err),
    );
    mp.reset();
  }, [resetGame, router]);

  return (
    <View style={StyleSheet.absoluteFill}>
      <BattleScreenBody opponent={opponent} onPlayAgain={requestRematch} />
      {localFleetReady && !remoteFleetReady && (
        <MultiplayerWaitingOverlay
          message={t('multiplayer.waitingPlacement')}
          actionLabel={t('multiplayer.leaveMatch')}
          onAction={handleLeaveWhileWaiting}
          destructive
        />
      )}
      {/* A withdrawn rematch drops back to the endgame screen, which still
          offers Play Again and Make Port — so this one need not end the match. */}
      {rematchPending && (
        <MultiplayerWaitingOverlay
          message={t('multiplayer.rematchRequested')}
          actionLabel={t('multiplayer.cancel')}
          onAction={cancelRematch}
        />
      )}
    </View>
  );
}

// How long a wait may run before the overlay admits something may be wrong.
// The heartbeat already ends a match when the peer's link dies, so a wait that
// reaches this point is one where the peer is still answering pings and simply
// has not acted — which is exactly the case a timeout must not end on its own.
// The hint informs; leaving stays the player's call.
const WAITING_HINT_MS = 30_000;

function MultiplayerWaitingOverlay({
  message,
  actionLabel,
  onAction,
  destructive = false,
}: {
  message: string;
  actionLabel: string;
  onAction: () => void;
  destructive?: boolean;
}) {
  const { t } = useTranslation('common');
  const pulse = useSharedValue(1);
  const [hintShown, setHintShown] = useState(false);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(0.35, { duration: 700, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [pulse]);

  useEffect(() => {
    const timer = setTimeout(() => setHintShown(true), WAITING_HINT_MS);
    return () => clearTimeout(timer);
  }, []);

  const textStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <View style={[StyleSheet.absoluteFill, styles.waitingOverlay]}>
      <Animated.Text style={[styles.waitingText, textStyle]}>{message}</Animated.Text>
      {hintShown && <Text style={styles.waitingHint}>{t('multiplayer.waitingHint')}</Text>}
      <HapticPressable
        intensity={destructive ? 'Heavy' : 'Light'}
        onPress={onAction}
        style={({ pressed }) => [
          styles.waitingActionButton,
          destructive ? styles.waitingActionDestructive : styles.waitingActionNeutral,
          pressed &&
            (destructive
              ? styles.waitingActionDestructivePressed
              : styles.waitingActionNeutralPressed),
        ]}>
        <Text
          style={[
            styles.waitingActionText,
            destructive ? styles.waitingActionTextDestructive : styles.waitingActionTextNeutral,
          ]}>
          {actionLabel}
        </Text>
      </HapticPressable>
    </View>
  );
}

function BattleScreenBody({
  opponent,
  onPlayAgain: onPlayAgainProp,
}: {
  opponent: Opponent;
  onPlayAgain?: () => void;
}) {
  const { i18n, t } = useTranslation();
  const locale = (i18n.language === 'de' ? 'de' : 'en') as keyof typeof LOCALE_IMAGES;
  const { width, s } = useResponsive();
  const cellSize = Math.floor((width - s(32) * 2 - LABEL_SIZE) / 10);

  const router = useRouter();

  // Store state
  const fields = useGameStore(s => s.fields);
  const opponentFields = useGameStore(s => s.opponentFields);
  const placedShips = useGameStore(s => s.placedShips);
  const orientations = useGameStore(s => s.orientations);
  const turn = useGameStore(s => s.turn);
  const showOpponentField = useGameStore(s => s.showOpponentField);
  const sunkEvent = useGameStore(s => s.sunkEvent);
  const resetGame = useGameStore(s => s.resetGame);
  const sinkAllOpponentShips = useGameStore(s => s.sinkAllOpponentShips);
  const sinkAllPlayerShips = useGameStore(s => s.sinkAllPlayerShips);
  const captainName = useCaptainStore(s => s.captainName);
  const recordGame = useStatsStore(s => s.recordGame);
  const gamesPlayed = useStatsStore(s => s.gamesPlayed);
  const wins = useStatsStore(s => s.wins);
  const winRate = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0;
  const rankStr = getRankTitle(gamesPlayed, winRate);
  const address =
    rankStr === 'UNPROVEN' || rankStr === 'RECRUIT' ? 'SIR' : translateRankTitle(rankStr, t);

  // Hooks
  const titleRef = useRef<View>(null);
  const rotateRef = useRef<View>(null);
  const shuffleRef = useRef<View>(null);
  const playerGridRef = useRef<View>(null);
  const enemyGridRef = useRef<View>(null);
  const dividerRef = useRef<View>(null);
  const playerCounterRef = useRef<View>(null);
  const enemyCounterRef = useRef<View>(null);
  const retreatRef = useRef<View>(null);
  const gestures = usePlacementGestures(cellSize);
  const animations = useBattleAnimations(opponent);
  const { replayTour: replayPlacementTour } = usePlacementTour(
    titleRef,
    gestures.trayRef,
    rotateRef,
    shuffleRef,
  );
  const { replayTour: replayBattleTour } = useBattleTour(
    showOpponentField,
    playerGridRef,
    enemyGridRef,
    dividerRef,
    playerCounterRef,
    enemyCounterRef,
    retreatRef,
  );
  const { onPlayerFire, shotPhase } = useCombat(opponent);

  const handleVictory = () => {
    sinkAllOpponentShips();
  };

  const handleGameEnd = (outcome: 'victory' | 'defeat') => {
    const { fields: f, opponentFields: of_ } = useGameStore.getState();
    const { hits, misses } = computeFieldShotStats(of_);
    recordGame({
      outcome,
      hits,
      misses,
      enemyShipsSunk: computeSunkShipTypes(of_),
      playerShipsLost: computeSunkShipTypes(f),
    });
    opponent.notifyGameOver(outcome);
  };

  // Peer-initiated end of game (their retreat, or their fleet going down):
  // replay the matching local animation, which records stats via onGameEnd.
  useEffect(() => {
    return opponent.onGameOver(outcome => {
      if (outcome === 'victory') {
        sinkAllOpponentShips();
      } else {
        sinkAllPlayerShips();
      }
    });
  }, [opponent, sinkAllOpponentShips, sinkAllPlayerShips]);

  const handlePlayAgain =
    onPlayAgainProp ??
    (() => {
      resetGame();
      router.replace('/battle');
    });

  const handleMakePort = () => {
    // Leaving for good: drop the peer and clear the multiplayer state, or the
    // home screen keeps hiding its HOST/JOIN panel (shown only when IDLE).
    const mp = useMultiplayerStore.getState();
    resetGame();
    router.replace('/');
    if (mp.mode === 'multiplayer') {
      leaveMultiplayerSession().catch(err =>
        console.error('[BattleScreen] leaving session failed:', err),
      );
      mp.reset();
    }
  };

  return (
    <Animated.View style={[styles.background, animations.screenStyle]}>
      <ImageBackground source={IMAGES.bg} style={styles.background} resizeMode="cover">
        <View style={[StyleSheet.absoluteFill, styles.overlay]} />

        {/* Placement phase — fades out on Fire at Will */}
        <Animated.View
          style={[StyleSheet.absoluteFill, animations.placementPhaseStyle]}
          pointerEvents={showOpponentField ? 'none' : 'auto'}>
          <PlacementView
            fireTopStyle={animations.fireTopStyle}
            fireBottomStyle={animations.fireBottomStyle}
            playerFieldAnimStyle={animations.playerFieldAnimStyle}
            fields={fields}
            placedShips={placedShips}
            orientations={orientations}
            allShipsPlaced={placedShips.size === SHIP_FLEET.length}
            draggingShip={gestures.draggingShip}
            previewCells={gestures.previewCells}
            isPreviewValid={gestures.isPreviewValid}
            dragX={gestures.dragX}
            dragY={gestures.dragY}
            titleRef={titleRef}
            rotateRef={rotateRef}
            shuffleRef={shuffleRef}
            onReplayTutorial={replayPlacementTour}
            gridBodyRef={gestures.gridBodyRef}
            trayRef={gestures.trayRef}
            onGridShipDragStart={gestures.onGridShipDragStart}
            onDragging={gestures.onDragging}
            onDragEnd={gestures.onDragEnd}
            onOrientationToggle={gestures.onOrientationToggle}
            onDragStart={gestures.onDragStart}
            onFireAtWill={animations.onFireAtWill}
            onRetreat={animations.onRetreat}
            onRandomize={gestures.onRandomize}
            captainName={captainName}
            address={address}
          />
        </Animated.View>

        {/* Battle phase — fades in on Fire at Will */}
        <Animated.View
          style={[StyleSheet.absoluteFill, animations.battlePhaseStyle]}
          pointerEvents={showOpponentField ? 'auto' : 'none'}>
          <BattleView
            fields={fields}
            opponentFields={opponentFields}
            showOpponentField={showOpponentField}
            turn={turn}
            sunkEvent={sunkEvent}
            shotPhase={shotPhase}
            onEnemyCellPress={onPlayerFire}
            onVictory={handleVictory}
            onPlayAgain={handlePlayAgain}
            onMakePort={handleMakePort}
            onGameEnd={handleGameEnd}
            onSinkAllPlayerShips={sinkAllPlayerShips}
            playerGridRef={playerGridRef}
            enemyGridRef={enemyGridRef}
            dividerRef={dividerRef}
            playerCounterRef={playerCounterRef}
            enemyCounterRef={enemyCounterRef}
            retreatRef={retreatRef}
            onReplayTutorial={replayBattleTour}
          />
        </Animated.View>

        {/* Commence firing flash — centered overlay, z-axis punch animation */}
        <Animated.View style={[styles.flashOverlay, animations.flashStyle]} pointerEvents="none">
          <Image
            source={LOCALE_IMAGES[locale].commenceFiring}
            style={styles.flashImage}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Floating drag preview — rendered last so it draws on top */}
        {gestures.draggingShip && (
          <DragPreview
            ship={gestures.draggingShip}
            orientation={orientations[gestures.draggingShip]}
            dragX={gestures.dragX}
            dragY={gestures.dragY}
          />
        )}
      </ImageBackground>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  overlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  flashOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flashImage: {
    width: '80%',
    height: undefined,
    aspectRatio: 1,
  },
  waitingOverlay: {
    backgroundColor: GameColors.confirmOverlayBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waitingText: {
    color: GameColors.label,
    fontFamily: 'BlackOpsOne',
    fontSize: 18,
    letterSpacing: 3,
    textAlign: 'center',
    lineHeight: 30,
  },
  waitingHint: {
    color: GameColors.labelDim,
    fontFamily: Fonts.rounded,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 18,
    marginHorizontal: 40,
  },
  waitingActionButton: {
    marginTop: 28,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 4,
  },
  waitingActionDestructive: {
    borderColor: GameColors.red,
  },
  waitingActionDestructivePressed: {
    backgroundColor: GameColors.retreatPressedBg,
  },
  waitingActionNeutral: {
    borderColor: GameColors.blueBorder,
  },
  waitingActionNeutralPressed: {
    backgroundColor: GameColors.bluePressedBg,
  },
  waitingActionText: {
    fontFamily: 'BlackOpsOne',
    fontSize: 11,
    letterSpacing: 2,
  },
  waitingActionTextDestructive: {
    color: GameColors.red,
  },
  waitingActionTextNeutral: {
    color: GameColors.label,
  },
});
