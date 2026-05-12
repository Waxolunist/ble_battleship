import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
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

function getBattleTourConfig(t: (key: string) => string): TourGuideConfig {
  return {
    tourId: 'battle',
    nextButtonText: t('tutorial:battle.next'),
    skipButtonText: t('tutorial:battle.skip'),
    doneButtonText: t('tutorial:battle.done'),
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
}

function buildSteps(
  playerGridRef: React.RefObject<View | null>,
  enemyGridRef: React.RefObject<View | null>,
  dividerRef: React.RefObject<View | null>,
  playerCounterRef: React.RefObject<View | null>,
  enemyCounterRef: React.RefObject<View | null>,
  retreatRef: React.RefObject<View | null>,
  t: (key: string) => string,
): TourStep[] {
  return [
    {
      id: 'battle-player-grid',
      targetRef: playerGridRef,
      title: t('tutorial:battle.playerGrid.title'),
      description: t('tutorial:battle.playerGrid.description'),
      backdropBehavior: 'next',
      hidePrevButton: true,
      spotlightPadding: 8,
      spotlightBorderRadius: 4,
    },
    {
      id: 'battle-enemy-grid',
      targetRef: enemyGridRef,
      title: t('tutorial:battle.enemyGrid.title'),
      description: t('tutorial:battle.enemyGrid.description'),
      backdropBehavior: 'next',
      hidePrevButton: true,
      spotlightPadding: 8,
      spotlightBorderRadius: 4,
    },
    {
      id: 'battle-divider',
      targetRef: dividerRef,
      title: t('tutorial:battle.divider.title'),
      description: t('tutorial:battle.divider.description'),
      backdropBehavior: 'next',
      hidePrevButton: true,
      spotlightPadding: 8,
      spotlightBorderRadius: 4,
    },
    {
      id: 'battle-player-counter',
      targetRef: playerCounterRef,
      title: t('tutorial:battle.playerCounter.title'),
      description: t('tutorial:battle.playerCounter.description'),
      backdropBehavior: 'next',
      hidePrevButton: true,
      spotlightPadding: 12,
      spotlightBorderRadius: 4,
    },
    {
      id: 'battle-enemy-counter',
      targetRef: enemyCounterRef,
      title: t('tutorial:battle.enemyCounter.title'),
      description: t('tutorial:battle.enemyCounter.description'),
      backdropBehavior: 'next',
      hidePrevButton: true,
      spotlightPadding: 12,
      spotlightBorderRadius: 4,
    },
    {
      id: 'battle-retreat',
      targetRef: retreatRef,
      title: t('tutorial:battle.retreat.title'),
      description: t('tutorial:battle.retreat.description'),
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
  const { t } = useTranslation('tutorial');
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
        t,
      ),
      getBattleTourConfig(t),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showOpponentField, t]);

  const replayTour = useCallback(() => {
    void startTour(
      buildSteps(
        playerGridRef,
        enemyGridRef,
        dividerRef,
        playerCounterRef,
        enemyCounterRef,
        retreatRef,
        t,
      ),
      getBattleTourConfig(t),
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
    t,
  ]);

  return { replayTour };
}
