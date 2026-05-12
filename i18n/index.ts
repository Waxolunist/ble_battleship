import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';

import enCommon from '@/locales/en/common.json';
import enBattle from '@/locales/en/battle.json';
import enTutorial from '@/locales/en/tutorial.json';
import enStats from '@/locales/en/stats.json';
import deCommon from '@/locales/de/common.json';
import deBattle from '@/locales/de/battle.json';
import deTutorial from '@/locales/de/tutorial.json';
import deStats from '@/locales/de/stats.json';
import { DEV_FORCE_LANGUAGE } from '@/constants/dev';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      common: typeof enCommon;
      battle: typeof enBattle;
      tutorial: typeof enTutorial;
      stats: typeof enStats;
    };
  }
}

export type SupportedLocale = 'en' | 'de';

export function resolveDeviceLocale(): SupportedLocale {
  if (DEV_FORCE_LANGUAGE) {
    return DEV_FORCE_LANGUAGE;
  }
  const code = getLocales()[0]?.languageCode ?? 'en';
  return code === 'de' ? 'de' : 'en';
}

// eslint-disable-next-line import/no-named-as-default-member
i18next.use(initReactI18next).init({
  lng: resolveDeviceLocale(),
  fallbackLng: 'en',
  ns: ['common', 'battle', 'tutorial', 'stats'],
  defaultNS: 'common',
  resources: {
    en: {
      common: enCommon,
      battle: enBattle,
      tutorial: enTutorial,
      stats: enStats,
    },
    de: {
      common: deCommon,
      battle: deBattle,
      tutorial: deTutorial,
      stats: deStats,
    },
  },
  interpolation: { escapeValue: false },
});

export default i18next;
