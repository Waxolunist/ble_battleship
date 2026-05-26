/**
 * DEV_SHOW_FORCE_VICTORY — renders a debug button in battle view that instantly
 * triggers the victory sequence without playing through a full game.
 * Set EXPO_PUBLIC_DEV_SHOW_FORCE_VICTORY=false in CI to disable for production builds.
 */
export const DEV_SHOW_FORCE_VICTORY = process.env.EXPO_PUBLIC_DEV_SHOW_FORCE_VICTORY !== 'false';

/**
 * DEV_FORCE_LANGUAGE — forces a specific language for i18n testing.
 * Set EXPO_PUBLIC_DEV_FORCE_LANGUAGE='de' or 'en' to override device locale detection.
 * Leave unset in production builds (defaults to device locale).
 */
export const DEV_FORCE_LANGUAGE = process.env.EXPO_PUBLIC_DEV_FORCE_LANGUAGE as
  | 'en'
  | 'de'
  | undefined;

/**
 * DEV_SHOW_MULTIPLAYER_DEBUG — renders a collapsible overlay that streams
 * multiplayer connection events (mDNS, TCP, NFC, WebRTC) plus every TX/RX
 * message. Defaults on in __DEV__ so you don't need adb/Xcode log tail to
 * see what's happening on a tethered device.
 * Set EXPO_PUBLIC_DEV_SHOW_MULTIPLAYER_DEBUG=false to hide.
 */
export const DEV_SHOW_MULTIPLAYER_DEBUG =
  __DEV__ && process.env.EXPO_PUBLIC_DEV_SHOW_MULTIPLAYER_DEBUG !== 'false';
