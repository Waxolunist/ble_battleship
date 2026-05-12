import { useCallback, useEffect } from 'react';
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

const PLACEMENT_TOUR_CONFIG: TourGuideConfig = {
  tourId: 'placement',
  nextButtonText: 'UNDERSTOOD',
  skipButtonText: 'SKIP',
  doneButtonText: 'BATTLE STATIONS',
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
  titleRef: React.RefObject<View | null>,
  trayRef: React.RefObject<View | null>,
  rotateRef: React.RefObject<View | null>,
  shuffleRef: React.RefObject<View | null>,
): TourStep[] {
  return [
    {
      id: 'placement-welcome',
      targetRef: titleRef,
      title: 'DEPLOY YOUR FLEET',
      description: 'Arrange your ships before the battle begins. Tap anywhere to continue.',
      backdropBehavior: 'next',
      hidePrevButton: true,
      spotlightPadding: 12,
      spotlightBorderRadius: 4,
    },
    {
      id: 'placement-tray',
      targetRef: trayRef,
      title: 'SELECT A VESSEL',
      description:
        'Tap a ship to pick it up, then tap a grid square to place it. Longer ships are harder to hide.',
      backdropBehavior: 'next',
      hidePrevButton: true,
      spotlightPadding: 8,
      spotlightBorderRadius: 4,
    },
    {
      id: 'placement-rotate',
      targetRef: rotateRef,
      title: 'ROTATE',
      description:
        'Tap to change orientation — horizontal or vertical. Rotate before placing a vessel.',
      backdropBehavior: 'next',
      hidePrevButton: true,
      spotlightPadding: 12,
      spotlightBorderRadius: 4,
    },
    {
      id: 'placement-shuffle',
      targetRef: shuffleRef,
      title: 'RANDOMIZE',
      description: 'Tap to place your entire fleet at random.',
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
  const { startTour } = useTourPersistence(tourStorage);

  useEffect(() => {
    void startTour(buildSteps(titleRef, trayRef, rotateRef, shuffleRef), PLACEMENT_TOUR_CONFIG);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const replayTour = useCallback(() => {
    void startTour(
      buildSteps(titleRef, trayRef, rotateRef, shuffleRef),
      PLACEMENT_TOUR_CONFIG,
      true,
    );
  }, [startTour, titleRef, trayRef, rotateRef, shuffleRef]);

  return { replayTour };
}
