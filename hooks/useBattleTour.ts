import { useCallback, useEffect, useRef } from 'react';
import type { View } from 'react-native';
import { useTourPersistence } from '@wrack/react-native-tour-guide';
import type { TourGuideConfig, TourStep, TourStorage } from '@wrack/react-native-tour-guide';
import { fileSystemStorage } from '@/store/persistence';
import { GameColors, Fonts } from '@/constants/theme';

const tourStorage: TourStorage = {
  getItem: key => fileSystemStorage.getItem(key),
  setItem: (key, value) => {
    fileSystemStorage.setItem(key, value);
  },
  removeItem: key => {
    fileSystemStorage.removeItem(key);
  },
};

const BATTLE_TOUR_CONFIG: TourGuideConfig = {
  tourId: 'battle',
  nextButtonText: 'UNDERSTOOD',
  skipButtonText: 'SKIP',
  doneButtonText: 'OPEN FIRE',
  enableBackButton: false,
  showStepCounter: true,
  showProgressDots: false,
  defaultBackdropBehavior: 'next',
  animationDuration: 250,
  tooltipWidth: 300,
  tooltipStyles: {
    backgroundColor: 'rgba(8, 25, 70, 0.97)',
    borderRadius: 8,
    titleColor: GameColors.gold,
    descriptionColor: GameColors.label,
    buttonTextColor: 'rgb(8, 25, 70)',
    primaryButtonColor: GameColors.gold,
    skipButtonColor: GameColors.labelFaded,
    titleStyle: {
      fontFamily: 'BlackOpsOne',
      fontSize: 15,
      letterSpacing: 2,
    },
    descriptionStyle: {
      fontFamily: Fonts?.rounded,
      fontSize: 13,
      lineHeight: 19,
    },
    containerStyle: {
      borderWidth: 1,
      borderColor: GameColors.blueBorder,
    },
  },
  spotlightStyles: {
    overlayColor: 'rgb(4, 8, 20)',
    overlayOpacity: 0.88,
  },
};

function buildSteps(
  playerGridRef: React.RefObject<View | null>,
  enemyGridRef: React.RefObject<View | null>,
  dividerRef: React.RefObject<View | null>,
  playerCounterRef: React.RefObject<View | null>,
  enemyCounterRef: React.RefObject<View | null>,
  retreatRef: React.RefObject<View | null>,
): TourStep[] {
  return [
    {
      id: 'battle-player-grid',
      targetRef: playerGridRef,
      title: 'YOUR FLEET',
      description: 'Your ships are here. Watch for incoming fire — red cells mean a hit.',
      backdropBehavior: 'next',
      hidePrevButton: true,
      spotlightPadding: 8,
      spotlightBorderRadius: 4,
    },
    {
      id: 'battle-enemy-grid',
      targetRef: enemyGridRef,
      title: 'OPEN FIRE',
      description: 'Tap any square on the enemy grid to launch a shell. Blue = miss. Red = hit.',
      backdropBehavior: 'next',
      hidePrevButton: true,
      spotlightPadding: 8,
      spotlightBorderRadius: 4,
    },
    {
      id: 'battle-divider',
      targetRef: dividerRef,
      title: 'AWAIT ORDERS',
      description: "The center line shows whose turn it is. Hold fire until it's yours.",
      backdropBehavior: 'next',
      hidePrevButton: true,
      spotlightPadding: 8,
      spotlightBorderRadius: 4,
    },
    {
      id: 'battle-player-counter',
      targetRef: playerCounterRef,
      title: 'YOUR SHIPS',
      description: 'Your vessels still afloat. Protect them.',
      backdropBehavior: 'next',
      hidePrevButton: true,
      spotlightPadding: 12,
      spotlightBorderRadius: 4,
    },
    {
      id: 'battle-enemy-counter',
      targetRef: enemyCounterRef,
      title: 'ENEMY VESSELS',
      description: 'Enemy ships remaining. Sink them all to win.',
      backdropBehavior: 'next',
      hidePrevButton: true,
      spotlightPadding: 12,
      spotlightBorderRadius: 4,
    },
    {
      id: 'battle-retreat',
      targetRef: retreatRef,
      title: 'LAST RESORT',
      description: 'Hold to retreat. The battle will be lost.',
      backdropBehavior: 'next',
      hidePrevButton: true,
      spotlightPadding: 12,
      spotlightBorderRadius: 4,
    },
  ];
}

export function useBattleTour(
  showOpponentField: boolean,
  playerGridRef: React.RefObject<View | null>,
  enemyGridRef: React.RefObject<View | null>,
  dividerRef: React.RefObject<View | null>,
  playerCounterRef: React.RefObject<View | null>,
  enemyCounterRef: React.RefObject<View | null>,
  retreatRef: React.RefObject<View | null>,
) {
  const { startTour } = useTourPersistence(tourStorage);
  const hasStarted = useRef(false);

  useEffect(() => {
    if (!showOpponentField || hasStarted.current) return;
    hasStarted.current = true;
    void startTour(
      buildSteps(
        playerGridRef,
        enemyGridRef,
        dividerRef,
        playerCounterRef,
        enemyCounterRef,
        retreatRef,
      ),
      BATTLE_TOUR_CONFIG,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showOpponentField]);

  const replayTour = useCallback(() => {
    void startTour(
      buildSteps(
        playerGridRef,
        enemyGridRef,
        dividerRef,
        playerCounterRef,
        enemyCounterRef,
        retreatRef,
      ),
      BATTLE_TOUR_CONFIG,
      true,
    );
  }, [
    startTour,
    playerGridRef,
    enemyGridRef,
    dividerRef,
    playerCounterRef,
    enemyCounterRef,
    retreatRef,
  ]);

  return { replayTour };
}
