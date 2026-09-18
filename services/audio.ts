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

let currentMusic: SoundName | null = null;

/**
 * Start a looping bed and leave it running. Unlike `playSound`, a second call
 * for the track already playing is ignored rather than restarting it — a
 * re-render or a return to the same screen should not bump the needle.
 *
 * Only one bed plays at a time; starting another stops the first.
 */
export function playMusic(name: SoundName) {
  if (currentMusic === name) return;
  stopMusic();
  try {
    ensureAudioMode();
    const player = getPlayer(name);
    player.loop = true;
    player.seekTo(0).catch(() => {});
    player.play();
    currentMusic = name;
  } catch {
    // audio unavailable on this device — the harbour is simply quiet
  }
}

/** Stop whatever bed is playing. Safe to call when nothing is. */
export function stopMusic() {
  const name = currentMusic;
  // Cleared first: a throw below would otherwise strand the name here and
  // make the next playMusic() of the same track a no-op against silence.
  currentMusic = null;
  if (!name) return;
  try {
    const player = getPlayer(name);
    player.pause();
    player.seekTo(0).catch(() => {});
  } catch {
    // nothing to stop
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
