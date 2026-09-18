export const IMAGES = {
  bg: require('@/assets/images/bg.jpeg'),
  title: require('@/assets/images/title.webp'),
  reactLogo: require('@/assets/images/react-logo.png'),
  carrier: require('@/assets/images/carrier.png'),
  battleship: require('@/assets/images/battleship.png'),
  cruiser: require('@/assets/images/cruiser.png'),
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

/**
 * Every sound effect in the game. Files live in `assets/sounds/` and are
 * played through `playSound()` in [services/audio.ts](../services/audio.ts) —
 * never `require()`d inline.
 *
 * The current files are synthesised placeholders, loudness-matched to each
 * other; swap in real recordings under the same names and nothing else changes.
 */
export const SOUNDS = {
  /** The splash artwork fades and the app opens. */
  appLaunch: require('@/assets/sounds/app_launch.wav'),
  /** Generic button press — every `HapticPressable`. */
  uiTap: require('@/assets/sounds/ui_tap.wav'),
  /** A ship is lifted off the tray or the grid. */
  shipPickup: require('@/assets/sounds/ship_pickup.wav'),
  /** A ship settles into a valid spot on the grid. */
  shipDrop: require('@/assets/sounds/ship_drop.wav'),
  /** A drop was rejected — overlap or off-grid. */
  shipBlocked: require('@/assets/sounds/ship_blocked.wav'),
  /** A ship is turned between horizontal and vertical. */
  shipRotate: require('@/assets/sounds/ship_rotate.wav'),
  /** The whole fleet is re-scattered by the shuffle button. */
  fleetShuffle: require('@/assets/sounds/fleet_shuffle.wav'),
  /** Placement ends and the COMMENCE FIRING card slams in. */
  battleStart: require('@/assets/sounds/battle_start.wav'),
  /** Targeting reticle locks onto a cell. */
  targetLock: require('@/assets/sounds/target_lock.wav'),
  /** The player's shell leaves the barrel. */
  cannonFire: require('@/assets/sounds/cannon_fire.wav'),
  /** Incoming enemy shell whistling down on the player's grid. */
  incomingShell: require('@/assets/sounds/incoming_shell.wav'),
  /** Verdict: the shell struck a hull. */
  shotHit: require('@/assets/sounds/shot_hit.wav'),
  /** Verdict: the shell hit open water. */
  shotMiss: require('@/assets/sounds/shot_miss.wav'),
  /** Verdict: the hit finished a ship off. */
  shipSunk: require('@/assets/sounds/ship_sunk.wav'),
  /** Turn handed back to the player. */
  sonarPing: require('@/assets/sounds/sonar_ping.wav'),
  /** The enemy fleet is gone. */
  victoryFanfare: require('@/assets/sounds/victory_fanfare.wav'),
  /** The player's fleet is gone, or they struck the colours. */
  defeatHorn: require('@/assets/sounds/defeat_horn.wav'),
  /** The retreat confirmation is raised. */
  retreatAlarm: require('@/assets/sounds/retreat_alarm.wav'),
};

export type SoundName = keyof typeof SOUNDS;
