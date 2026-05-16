import { useCallback, useEffect } from 'react';
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

function getPlacementTourConfig(t: (key: string) => string): TourGuideConfig {
  return {
    tourId: 'placement',
    nextButtonText: t('tutorial:placement.next'),
    skipButtonText: t('tutorial:placement.skip'),
    doneButtonText: t('tutorial:placement.done'),
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
  titleRef: React.RefObject<View | null>,
  trayRef: React.RefObject<View | null>,
  rotateRef: React.RefObject<View | null>,
  shuffleRef: React.RefObject<View | null>,
  t: (key: string) => string,
): TourStep[] {
  return [
    {
      id: 'placement-welcome',
      targetRef: titleRef,
      title: t('tutorial:placement.welcome.title'),
      description: t('tutorial:placement.welcome.description'),
      backdropBehavior: 'next',
      hidePrevButton: true,
      spotlightPadding: 12,
      spotlightBorderRadius: 4,
    },
    {
      id: 'placement-tray',
      targetRef: trayRef,
      title: t('tutorial:placement.tray.title'),
      description: t('tutorial:placement.tray.description'),
      backdropBehavior: 'next',
      hidePrevButton: true,
      spotlightPadding: 8,
      spotlightBorderRadius: 4,
    },
    {
      id: 'placement-rotate',
      targetRef: rotateRef,
      title: t('tutorial:placement.rotate.title'),
      description: t('tutorial:placement.rotate.description'),
      backdropBehavior: 'next',
      hidePrevButton: true,
      spotlightPadding: 12,
      spotlightBorderRadius: 4,
    },
    {
      id: 'placement-shuffle',
      targetRef: shuffleRef,
      title: t('tutorial:placement.shuffle.title'),
      description: t('tutorial:placement.shuffle.description'),
      backdropBehavior: 'next',
      hidePrevButton: true,
      spotlightPadding: 12,
      spotlightBorderRadius: 4,
    },
  ];
}

export function usePlacementTour(
  titleRef: React.RefObject<View | null>,
  trayRef: React.RefObject<View | null>,
  rotateRef: React.RefObject<View | null>,
  shuffleRef: React.RefObject<View | null>,
) {
  const { t } = useTranslation('tutorial');
  const translate = t as unknown as (key: string) => string;
  const { startTour } = useTourPersistence(tourStorage);

  useEffect(() => {
    void startTour(
      buildSteps(titleRef, trayRef, rotateRef, shuffleRef, translate),
      getPlacementTourConfig(translate),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  const replayTour = useCallback(() => {
    void startTour(
      buildSteps(titleRef, trayRef, rotateRef, shuffleRef, translate),
      getPlacementTourConfig(translate),
      true,
    );
  }, [startTour, titleRef, trayRef, rotateRef, shuffleRef, translate]);

  return { replayTour };
}
