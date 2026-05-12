export const IMAGES = {
  bg: require('@/assets/images/bg.jpeg'),
  title: require('@/assets/images/title.webp'),
  reactLogo: require('@/assets/images/react-logo.png'),
  carrier: require('@/assets/images/carrier.png'),
  submarine: require('@/assets/images/submarine.png'),
  destroyer: require('@/assets/images/destroyer.png'),
};

export const LOCALE_IMAGES = {
  en: {
    commenceFiring: require('@/assets/images/locales/en/commence_firing.png'),
  },
  de: {
    commenceFiring: require('@/assets/images/locales/de/commence_firing.png'),
  },
} satisfies Record<'en' | 'de', { commenceFiring: unknown }>;
