import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';

import { DEFAULT_SETTINGS, type Settings } from './deck';

const FAV_KEY = 'buhui.favorites.v1';
const SETTINGS_KEY = 'buhui.settings.v1';

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
  favorites = await readJSON<string[]>(FAV_KEY, []);
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

export function loadSettings() {
  return readJSON<Settings>(SETTINGS_KEY, DEFAULT_SETTINGS).then((s) => ({ ...DEFAULT_SETTINGS, ...s }));
}

export function saveSettings(s: Settings) {
  writeJSON(SETTINGS_KEY, s);
}
