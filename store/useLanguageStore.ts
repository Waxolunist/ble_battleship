import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import i18next, { resolveDeviceLocale } from '@/i18n';
import type { SupportedLocale } from '@/i18n';
import { fileSystemStorage } from './persistence';
import { DEV_FORCE_LANGUAGE } from '@/constants/dev';

type LanguageState = {
  language: SupportedLocale | null;
  setLanguage: (lang: SupportedLocale | null) => void;
};

export const useLanguageStore = create<LanguageState>()(
  persist(
    set => ({
      language: null,
      setLanguage: language => {
        set({ language });
        i18next.changeLanguage(language ?? resolveDeviceLocale());
      },
    }),
    {
      name: 'language_preference',
      storage: createJSONStorage(() => fileSystemStorage),
      onRehydrateStorage: () => state => {
        const locale = DEV_FORCE_LANGUAGE ?? state?.language ?? resolveDeviceLocale();
        i18next.changeLanguage(locale);
      },
    },
  ),
);
