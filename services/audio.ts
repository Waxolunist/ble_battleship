import { SOUNDS, type SoundName } from '@/constants/assets';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

const players = new Map<SoundName, AudioPlayer>();
let audioModeReady = false;

function ensureAudioMode() {
  if (audioModeReady) return;
  audioModeReady = true;
  // Mix with whatever the player already has running, and stay quiet when the
  // ringer switch is off — a battle should never override a silenced phone.
  setAudioModeAsync({
    playsInSilentMode: false,
    shouldPlayInBackground: false,
    interruptionMode: 'mixWithOthers',
  }).catch(() => {});
}

function getPlayer(name: SoundName): AudioPlayer {
  let player = players.get(name);
  if (!player) {
    player = createAudioPlayer(SOUNDS[name]);
    players.set(name, player);
  }
  return player;
}

/**
 * Fire a one-shot sound effect. Safe to call from anywhere — it never throws
 * and never blocks; a device with audio unavailable simply stays silent.
 *
 * Re-triggering a sound that is still playing restarts it, so rapid-fire
 * events (shuffling, tapping) don't pile up overlapping copies.
 */
export function playSound(name: SoundName) {
  try {
    ensureAudioMode();
    const player = getPlayer(name);
    // A one-shot that has run to the end leaves its playhead parked there,
    // where play() is a no-op, so every cue is rewound before it fires.
    player.seekTo(0).catch(() => {});
    player.play();
  } catch {
    // audio unavailable on this device — the game plays on without it
  }
}

/**
 * Warm the players for a set of sounds so the first playback is not delayed by
 * decoding. Called when a screen that needs them mounts.
 */
export function preloadSounds(names: SoundName[]) {
  try {
    ensureAudioMode();
    names.forEach(getPlayer);
  } catch {
    // audio unavailable — playSound() will fall back to silence
  }
}
