/**
 * DEV_SHOW_FORCE_VICTORY — renders a debug button in battle view that instantly
 * triggers the victory sequence without playing through a full game.
 * Set EXPO_PUBLIC_DEV_SHOW_FORCE_VICTORY=false in CI to disable for production builds.
 */
export const DEV_SHOW_FORCE_VICTORY = process.env.EXPO_PUBLIC_DEV_SHOW_FORCE_VICTORY !== 'false';
