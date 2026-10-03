import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

/* ---------- 震動 ---------- */

const hapticsOn = Platform.OS === 'ios' || Platform.OS === 'android';

export const haptic = {
  tick: () => hapticsOn && Haptics.selectionAsync().catch(() => {}),
  light: () => hapticsOn && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),
  medium: () => hapticsOn && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}),
  soft: () => hapticsOn && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {}),
};

/* ---------- 音效 ---------- */

const SOURCES = {
  shuffle: require('../../assets/sounds/shuffle.mp3'),
  flip: require('../../assets/sounds/flip.mp3'),
  swish: require('../../assets/sounds/swish.mp3'),
};
type SoundName = keyof typeof SOURCES;

const MUTE_KEY = 'buhui.muted.v1';
let muted = false;
const listeners = new Set<() => void>();
AsyncStorage.getItem(MUTE_KEY)
  .then((v) => {
    muted = v === '1';
    listeners.forEach((l) => l());
  })
  .catch(() => {});

let players: Partial<Record<SoundName, AudioPlayer>> = {};
let modeSet = false;

function player(name: SoundName) {
  if (!modeSet) {
    modeSet = true;
    // 尊重 iPhone 靜音鍵
    setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(() => {});
  }
  return (players[name] ??= createAudioPlayer(SOURCES[name]));
}

/** 網頁在使用者第一次互動前不允許播放聲音（例如直接打開牌桌網址） */
function webAudioBlocked() {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return false;
  const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
  return activation ? !activation.hasBeenActive : false;
}

export function playSound(name: SoundName, volume = 0.8) {
  if (muted || webAudioBlocked()) return;
  try {
    const p = player(name);
    p.volume = volume;
    p.seekTo(0).catch(() => {});
    p.play();
  } catch {
    // 音效失敗不影響遊戲
  }
}

export function stopSound(name: SoundName) {
  try {
    players[name]?.pause();
  } catch {}
}

export function setMuted(v: boolean) {
  muted = v;
  AsyncStorage.setItem(MUTE_KEY, v ? '1' : '0').catch(() => {});
  if (v) Object.values(players).forEach((p) => p?.pause());
  listeners.forEach((l) => l());
}

export function useMuted() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => muted,
    () => muted,
  );
}

/** 預先建立播放器，避免第一次播放延遲 */
export function warmUpSounds() {
  (Object.keys(SOURCES) as SoundName[]).forEach(player);
}

export function releaseSounds() {
  Object.values(players).forEach((p) => p?.remove());
  players = {};
}
