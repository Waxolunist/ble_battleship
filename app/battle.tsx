import { DragPreview } from '@/components/drag-preview';
import { LABEL_SIZE } from '@/components/game-field';
import { BLEConnectionGuard, useBLEGuard } from '@/components/ble/BLEConnectionGuard';
import { BattleView } from '@/components/views/battle-view';
import { PlacementView } from '@/components/views/placement-view';
import { IMAGES, LOCALE_IMAGES } from '@/constants/assets';
import { GameColors } from '@/constants/theme';
import { useTranslation } from 'react-i18next';
import { useAIOpponent } from '@/hooks/useAIOpponent';
import { useBLEOpponent } from '@/hooks/useBLEOpponent';
import { useBattleAnimations } from '@/hooks/useBattleAnimations';
import { useCombat } from '@/hooks/useCombat';
import { usePlacementGestures } from '@/hooks/usePlacementGestures';
import type { Opponent } from '@/models/opponent';
import { getRankTitle, translateRankTitle, SHIP_FLEET } from '@/models/types';
import { useBLEStore } from '@/store/useBLEStore';
import { useGameStore } from '@/store/useGameStore';
import { useCaptainStore } from '@/store/useCaptainStore';
import { useStatsStore, computeFieldShotStats, computeSunkShipTypes } from '@/store/useStatsStore';
import { usePlacementTour } from '@/hooks/usePlacementTour';
import { useBattleTour } from '@/hooks/useBattleTour';
import { useRouter } from 'expo-router';
import { Image, ImageBackground, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useEffect, useRef } from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const GRID_PADDING = 32;

// The single mode === 'ble' decision in the runtime path. Each branch mounts a
// sibling component so the opponent hook (BLE or AI) is called unconditionally.
export default function BattleScreen() {
  const mode = useBLEStore(s => s.mode);
  return mode === 'ble' ? <BLEBattleScreen /> : <AIBattleScreen />;
}

function AIBattleScreen() {
  const opponent = useAIOpponent();
  return <BattleScreenBody opponent={opponent} />;
}

function BLEBattleScreen() {
  return (
    <BLEConnectionGuard>
      <BLEBattleContent />
    </BLEConnectionGuard>
  );
}

function BLEBattleContent() {
  const { t } = useTranslation('common');
  const opponent = useBLEOpponent();
  const { requestRematch, rematchPending } = useBLEGuard();
  const localFleetReady = useBLEStore(s => s.localFleetReady);
  const remoteFleetReady = useBLEStore(s => s.remoteFleetReady);

  return (
    <View style={StyleSheet.absoluteFill}>
      <BattleScreenBody opponent={opponent} onPlayAgain={requestRematch} />
      {localFleetReady && !remoteFleetReady && (
        <BLEWaitingOverlay message={t('ble.waitingPlacement')} />
      )}
      {rematchPending && <BLEWaitingOverlay message={t('ble.rematchRequested')} />}
    </View>
  );
}

function BLEWaitingOverlay({ message }: { message: string }) {
  const pulse = useSharedValue(1);

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

  const textStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <View style={[StyleSheet.absoluteFill, styles.waitingOverlay]}>
      <Animated.Text style={[styles.waitingText, textStyle]}>{message}</Animated.Text>
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
  const { width } = useWindowDimensions();
  const cellSize = Math.floor((width - GRID_PADDING * 2 - LABEL_SIZE) / 10);

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

  const handlePlayAgain =
    onPlayAgainProp ??
    (() => {
      resetGame();
      router.replace('/battle');
    });

  const handleMakePort = () => {
    resetGame();
    router.replace('/');
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
});
