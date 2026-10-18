import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';

import { EDITIONS, type EditionId } from '../data/catalog';
import { QUESTION_BY_ID } from '../data/questions';
import { DEFAULT_SETTINGS, normalizePlayers, type Settings } from './deck';

const FAV_KEY = 'buhui.favorites.v1';
const SETTINGS_KEY = 'buhui.settings.v1';
const ADULT_KEY = 'buhui.adult.v1';

/** 經典版沿用原本的 key，特別版各自記一份 */
const settingsKey = (edition: EditionId) => (edition === 'classic' ? SETTINGS_KEY : `buhui.settings.${edition}.v1`);

async function readJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown) {
  AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => {});
}

/* ---------- 收藏（跨畫面同步的小型 store） ---------- */

let favorites: string[] = [];
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

async function ensureLoaded() {
  if (loaded) return;
  loaded = true;
  // 題庫改版時刪掉的題目，收藏裡也一併拿掉
  favorites = (await readJSON<string[]>(FAV_KEY, [])).filter((id) => id in QUESTION_BY_ID);
  emit();
}

export function toggleFavorite(id: string) {
  favorites = favorites.includes(id) ? favorites.filter((x) => x !== id) : [id, ...favorites];
  writeJSON(FAV_KEY, favorites);
  emit();
}

export function useFavorites() {
  useEffect(() => {
    ensureLoaded();
  }, []);
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => favorites,
    () => favorites,
  );
}

/* ---------- 上次的設定 ---------- */

/** 舊版只存了一個「對方的名字」 */
type StoredSettings = Partial<Settings> & { partnerName?: string };

export async function loadSettings(edition: EditionId = 'classic'): Promise<Settings> {
  const ed = EDITIONS[edition];
  const { partnerName, ...s } = await readJSON<StoredSettings>(settingsKey(edition), {});
  const players = Array.isArray(s.players) ? s.players : ['', partnerName ?? ''];
  const scene = ed.scenes.some((x) => x.id === s.scene) ? s.scene! : ed.scenes[0].id;
  const topics = (s.topics ?? []).filter((t) => ed.kinds.includes(t));
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    edition,
    scene,
    topics,
    random: s.random ?? true,
    players: normalizePlayers(players, ed.players),
  };
}

export function saveSettings(s: Settings) {
  writeJSON(settingsKey(s.edition), s);
}

/* ---------- 成人內容：確認過一次年滿 18 歲就不再問 ---------- */

export async function adultConfirmed() {
  return (await readJSON<boolean>(ADULT_KEY, false)) === true;
}

export function confirmAdult() {
  writeJSON(ADULT_KEY, true);
}
