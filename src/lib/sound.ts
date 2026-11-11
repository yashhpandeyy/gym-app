import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

const FILES = {
  tap: require('../../assets/sounds/tap.wav'),
  pop: require('../../assets/sounds/pop.wav'),
  thud: require('../../assets/sounds/thud.wav'),
  warn: require('../../assets/sounds/warn.wav'),
  flip: require('../../assets/sounds/flip.wav'),
  success: require('../../assets/sounds/success.wav'),
  reward: require('../../assets/sounds/reward.wav'),
  bell: require('../../assets/sounds/bell.wav'),
  alarm: require('../../assets/sounds/alarm.wav'),
} as const;

export type SoundName = keyof typeof FILES;

const VOLUME: Record<SoundName, number> = { tap: 0.35, pop: 0.6, thud: 0.7, warn: 0.6, flip: 0.7, success: 0.8, reward: 0.9, bell: 1, alarm: 1 };

// Moments the owner chose to keep silent (picked "None" in the sound picker).
const SILENT: ReadonlySet<SoundName> = new Set<SoundName>(['tap']);

let enabled = true;
let ready = false;
const players = new Map<SoundName, AudioPlayer>();

export function setSoundEnabled(on: boolean) {
  enabled = on;
}

/**
 * Plays a short effect. Never throws, so a missing audio device can't break a tap.
 * `force` is for sounds the person asked for (a timer running out, an alarm): they ring even with effects off.
 */
export function playSound(name: SoundName, opts: { force?: boolean; loop?: boolean } = {}) {
  if ((!enabled && !opts.force) || SILENT.has(name)) return;
  try {
    if (!ready) {
      ready = true;
      setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(() => {});
    }
    let p = players.get(name);
    if (!p) {
      p = createAudioPlayer(FILES[name]);
      p.volume = VOLUME[name];
      players.set(name, p);
    }
    p.loop = !!opts.loop;
    p.seekTo(0).catch(() => {});
    p.play();
  } catch {
    // Audio is a nicety; ignore failures.
  }
}

/** Stops a sound that is still playing, such as a looping alarm. */
export function stopSound(name: SoundName) {
  try {
    const p = players.get(name);
    if (!p) return;
    p.loop = false;
    p.pause();
  } catch {
    // Nothing to stop.
  }
}
