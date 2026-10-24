import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

const FILES = {
  tap: require('../../assets/sounds/tap.wav'),
  pop: require('../../assets/sounds/pop.wav'),
  thud: require('../../assets/sounds/thud.wav'),
  warn: require('../../assets/sounds/warn.wav'),
  flip: require('../../assets/sounds/flip.wav'),
  success: require('../../assets/sounds/success.wav'),
  reward: require('../../assets/sounds/reward.wav'),
} as const;

export type SoundName = keyof typeof FILES;

const VOLUME: Record<SoundName, number> = { tap: 0.35, pop: 0.6, thud: 0.7, warn: 0.6, flip: 0.7, success: 0.8, reward: 0.9 };

let enabled = true;
let ready = false;
const players = new Map<SoundName, AudioPlayer>();

export function setSoundEnabled(on: boolean) {
  enabled = on;
}

/** Plays a short effect. Never throws, so a missing audio device can't break a tap. */
export function playSound(name: SoundName) {
  if (!enabled) return;
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
    p.seekTo(0).catch(() => {});
    p.play();
  } catch {
    // Audio is a nicety; ignore failures.
  }
}
