/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

/**
 * Shared color palette for the game UI.
 * All game-specific hard-coded colors should reference this object.
 */
export const GameColors = {
  // ── Core accent palette ─────────────────────────────────────────────
  /** Gold — player's turn indicator, player targeting reticle, hit/sunk callouts */
  gold: '#FFC832',
  /** Red — enemy's turn indicator, enemy targeting reticle, danger callouts */
  red: '#FF5050',
  /** Blue — player identity (counter) */
  playerBlue: 'rgba(100, 160, 255, 0.9)',

  // ── Grid / tray backgrounds ─────────────────────────────────────────
  /** Dark navy: empty cell background and grid base */
  navyBg: 'rgba(8, 25, 70, 0.85)',
  /** Dark navy: ship tray panel background (slightly lighter) */
  trayBg: 'rgba(8, 25, 70, 0.75)',

  // ── Blue chrome (borders, buttons) ──────────────────────────────────
  /** Grid tint and tray border */
  blueTint: 'rgba(80, 160, 255, 0.35)',
  /** Active cell borders and rotate-button border */
  blueBorder: 'rgba(80, 160, 255, 0.5)',
  /** Rotate-button border when ship is placed */
  blueBorderDim: 'rgba(80, 160, 255, 0.2)',
  /** Rotate-button background */
  blueButton: 'rgba(30, 60, 140, 0.6)',

  // ── Label / UI text (blue-white at varying opacities) ───────────────
  /** Grid labels, tray title */
  label: 'rgba(180, 210, 255, 0.8)',
  /** Rotate-button icon */
  labelBright: 'rgba(180, 210, 255, 0.9)',
  /** Ship name labels */
  labelDim: 'rgba(180, 210, 255, 0.65)',
  /** Placed / inactive labels */
  labelFaded: 'rgba(180, 210, 255, 0.35)',

  // ── Cell status colors ───────────────────────────────────────────────
  cellEmpty: 'rgba(8, 25, 70, 0.85)',
  cellShip: 'rgba(60, 110, 210, 0.75)',
  cellTargeted: 'rgba(220, 30, 30, 0.9)',
  cellHit: 'rgba(255, 120, 0, 0.9)',
  cellMiss: 'rgba(10, 10, 15, 0.95)',
  cellSunk: 'rgba(90, 30, 30, 0.95)',
  /** Cell highlight on press */
  cellPressed: 'rgba(100, 180, 255, 0.6)',

  // ── Ship cells (tray + drag preview) ────────────────────────────────
  /** Solid ship cell in tray */
  shipCellBg: 'rgba(80, 140, 240, 0.75)',
  /** Placed ship cell in tray */
  shipCellPlaced: 'rgba(60, 110, 180, 0.4)',
  /** Tile overlay on tray ship cells */
  shipCellOverlay: 'rgba(30, 60, 130, 0.25)',
  /** Drag-preview cell background */
  dragCellBg: 'rgba(60, 130, 220, 0.85)',
  /** Drag-preview cell border */
  dragCellBorder: 'rgba(120, 200, 255, 0.9)',
  /** Tile overlay on drag-preview cells */
  dragCellOverlay: 'rgba(30, 60, 130, 0.2)',

  // ── Placement preview ────────────────────────────────────────────────
  previewValid: 'rgba(80, 210, 120, 0.8)',
  previewInvalid: 'rgba(210, 60, 60, 0.8)',
  placedBadge: 'rgba(80, 210, 120, 0.9)',

  // ── Shot / battle effects ────────────────────────────────────────────
  /** Orange bloom radiating from a hit or sunk cell */
  fireGlow: 'rgba(255, 100, 20, 0.55)',
  /** Expanding ring on a miss */
  missRipple: 'rgba(100, 180, 255, 0.5)',
  /** "MISS" verdict text color */
  verdictMiss: 'rgba(180, 180, 180, 0.7)',
  /** Red tint overlay on the enemy grid */
  enemyGridTint: 'rgba(255, 80, 80, 0.35)',

  // ── "Fire at Will" button ────────────────────────────────────────────
  /** Slightly warmer gold used on the Fire at Will button */
  fireGold: '#e8c84a',
  fireGoldBg: 'rgba(232, 200, 74, 0.15)',
  fireGoldBgPressed: 'rgba(232, 200, 74, 0.35)',
} as const;

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
