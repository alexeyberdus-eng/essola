import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { readJSON, writeJSON } from './storage';

// Soft interface sounds (synthesized for essola, assets/sounds): quiet, short, and silent when the phone is on mute.
// Players are created once and rewound on each play, so a sound starts instantly.
const FILES = {
  tap: require('../../assets/sounds/tap.wav'),
  success: require('../../assets/sounds/success.wav'),
  like: require('../../assets/sounds/like.wav'),
  error: require('../../assets/sounds/soft-error.wav'),
};
export type SoundName = keyof typeof FILES;

const KEY = 'essola.sounds';
let enabled = true;
let ready = false;
const players: Partial<Record<SoundName, AudioPlayer>> = {};

async function init() {
  if (ready) return;
  ready = true;
  enabled = await readJSON<boolean>(KEY, true);
  // Respect the mute switch and never interrupt the person's music.
  await setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(() => {});
}
init();

export function play(name: SoundName) {
  if (!enabled) return;
  try {
    const p = (players[name] ??= createAudioPlayer(FILES[name]));
    p.volume = name === 'tap' ? 0.35 : 0.6;
    p.seekTo(0);
    p.play();
  } catch {}
}

export const soundsOn = () => enabled;
export function setSounds(on: boolean) {
  enabled = on;
  writeJSON(KEY, on);
}
