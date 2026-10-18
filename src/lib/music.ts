import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { ensureAudioMode, useMuted, webAudioBlocked } from './feedback';

/* ---------- 曲目：每首 60～100 秒，設計成可以無縫循環 ---------- */

const TRACKS = {
  cafe: require('../../assets/music/cafe.mp3'),
  latenight: require('../../assets/music/latenight.mp3'),
  walk: require('../../assets/music/walk.mp3'),
  dinner: require('../../assets/music/dinner.mp3'),
  travel: require('../../assets/music/travel.mp3'),
  party: require('../../assets/music/party.mp3'),
  // 深夜限定：調情／前夕／激情／收尾
  'ad-flirt': require('../../assets/music/ad-flirt.mp3'),
  'ad-prelude': require('../../assets/music/ad-prelude.mp3'),
  'ad-passion': require('../../assets/music/ad-passion.mp3'),
  'ad-after': require('../../assets/music/ad-after.mp3'),
  // 爸媽聊聊
  home: require('../../assets/music/home.mp3'),
  holiday: require('../../assets/music/holiday.mp3'),
};
export type MusicId = keyof typeof TRACKS;

/** 背景音樂的基礎音量，要壓在音效底下 */
const BASE_VOLUME = 0.35;
/** 每首曲子的音量微調（乘上基礎音量）；母帶比較大聲或小聲的曲子在這裡調 */
const GAIN: Record<MusicId, number> = {
  cafe: 1,
  latenight: 1,
  walk: 1,
  dinner: 1,
  travel: 1,
  party: 1,
  'ad-flirt': 1,
  'ad-prelude': 1,
  'ad-passion': 1,
  'ad-after': 1,
  home: 1,
  holiday: 1,
};

const FADE_IN_MS = 1500; // 開始、從靜音或背景回來
const CROSSFADE_MS = 2500; // 換曲：舊的淡出、新的淡入
const FADE_OUT_MS = 1000; // 沒有曲目了或離開牌局
const FADE_STEP_MS = 60;

/* ---------- 偏好：背景音樂開關（預設開啟） ---------- */

const MUSIC_KEY = 'buhui.music.v1';
let musicOn = true;
const listeners = new Set<() => void>();
AsyncStorage.getItem(MUSIC_KEY)
  .then((v) => {
    musicOn = v !== '0';
    listeners.forEach((l) => l());
  })
  .catch(() => {});

export function setMusicOn(v: boolean) {
  musicOn = v;
  AsyncStorage.setItem(MUSIC_KEY, v ? '1' : '0').catch(() => {});
  listeners.forEach((l) => l());
}

export function useMusicOn() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => musicOn,
    () => musicOn,
  );
}

/* ---------- 播放：一個畫面一個 engine，管淡入淡出、換曲與暫停 ---------- */

type Voice = {
  id: MusicId;
  player: AudioPlayer;
  /** 淡入淡出的進度 0～1（音量用平方，聽起來比較線性） */
  level: number;
  /** 有沒有在播（暫停時保留位置，恢復後接著播） */
  playing: boolean;
  /** 取消進行中的淡入淡出 */
  cancel: (() => void) | null;
};

function createVoice(id: MusicId): Voice | null {
  let player: AudioPlayer | undefined;
  try {
    ensureAudioMode();
    player = createAudioPlayer(TRACKS[id]);
    player.loop = true;
    player.volume = 0;
    return { id, player, level: 0, playing: false, cancel: null };
  } catch {
    // 音樂失敗不影響遊戲
    try {
      player?.remove();
    } catch {}
    return null;
  }
}

function setLevel(v: Voice, level: number) {
  v.level = level;
  try {
    v.player.volume = Math.max(0, Math.min(1, BASE_VOLUME * GAIN[v.id] * level * level));
  } catch {}
}

/** 在 ms 內把音量推到 target；interval 在完成或被取消時一定清掉 */
function fadeTo(v: Voice, target: number, ms: number, done?: () => void) {
  v.cancel?.();
  const from = v.level;
  if (ms <= 0 || from === target) {
    setLevel(v, target);
    done?.();
    return;
  }
  const t0 = Date.now();
  const timer = setInterval(() => {
    const k = Math.min(1, (Date.now() - t0) / ms);
    setLevel(v, from + (target - from) * k);
    if (k >= 1) {
      v.cancel?.();
      done?.();
    }
  }, FADE_STEP_MS);
  v.cancel = () => {
    clearInterval(timer);
    v.cancel = null;
  };
}

function pauseVoice(v: Voice) {
  v.cancel?.();
  if (!v.playing) return;
  v.playing = false;
  try {
    v.player.pause();
  } catch {}
}

function resumeVoice(v: Voice, ms: number) {
  if (v.playing) return;
  v.playing = true;
  setLevel(v, 0);
  try {
    v.player.play();
  } catch {}
  fadeTo(v, 1, ms);
}

function releaseVoice(v: Voice) {
  v.cancel?.();
  v.playing = false;
  try {
    v.player.pause();
  } catch {}
  try {
    v.player.remove();
  } catch {}
}

function createEngine() {
  let want: { id: MusicId | null; active: boolean } = { id: null, active: false };
  let current: Voice | null = null;
  const leaving = new Set<Voice>();
  let disposed = false;
  let disarm: (() => void) | null = null;

  /** 舊的淡出後暫停並移除；本來就暫停著的直接移除 */
  const retire = (v: Voice, ms: number) => {
    if (!v.playing) return releaseVoice(v);
    leaving.add(v);
    fadeTo(v, 0, ms, () => {
      leaving.delete(v);
      releaseVoice(v);
    });
  };

  /** 網頁第一次互動前瀏覽器不讓播；等到第一次互動再開始 */
  const armGesture = () => {
    if (disarm || typeof window === 'undefined') return;
    const events = ['pointerdown', 'pointerup', 'keydown'] as const;
    const onGesture = () => {
      // 觸控的 pointerdown 還不算啟用，等 pointerup
      if (webAudioBlocked()) return;
      disarm?.();
      apply();
    };
    events.forEach((e) => window.addEventListener(e, onGesture, true));
    disarm = () => {
      events.forEach((e) => window.removeEventListener(e, onGesture, true));
      disarm = null;
    };
  };

  const apply = () => {
    if (disposed) return;
    // 靜音、關閉背景音樂、App 在背景：馬上停，淡出到一半的舊曲也不留
    if (!want.active) {
      leaving.forEach(releaseVoice);
      leaving.clear();
    }
    // 換曲或沒有曲目了：舊的淡出（換曲時和新的交叉）
    if (current && current.id !== want.id) {
      retire(current, !want.active ? 0 : want.id ? CROSSFADE_MS : FADE_OUT_MS);
      current = null;
    }
    if (!want.id) return;
    // 暫停時保留位置，恢復後接著播
    if (!want.active) {
      if (current) pauseVoice(current);
      return;
    }
    if (webAudioBlocked()) return armGesture();
    current ??= createVoice(want.id);
    if (current) resumeVoice(current, leaving.size > 0 ? CROSSFADE_MS : FADE_IN_MS);
  };

  return {
    update(id: MusicId | null, active: boolean) {
      want = { id, active };
      apply();
    },
    /** 離開時：目前這首淡出（interval 在淡出完成後自己清掉），其他監聽全部拆掉 */
    dispose() {
      disposed = true;
      disarm?.();
      if (current) retire(current, FADE_OUT_MS);
      current = null;
    },
  };
}

/**
 * 牌桌的背景音樂：循環播放，id 換了就交叉淡入淡出，null 或離開畫面就淡出。
 * 全域靜音、背景音樂關閉、App 進背景時暫停，回來再淡入。
 */
export function useBackgroundMusic(id: MusicId | null) {
  const on = useMusicOn();
  const muted = useMuted();
  const [foreground, setForeground] = useState(AppState.currentState !== 'background');
  const engine = useRef<ReturnType<typeof createEngine> | null>(null);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setForeground(s !== 'background'));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    engine.current ??= createEngine();
    engine.current.update(id, on && !muted && foreground);
  }, [id, on, muted, foreground]);

  useEffect(
    () => () => {
      engine.current?.dispose();
      engine.current = null;
    },
    [],
  );
}
