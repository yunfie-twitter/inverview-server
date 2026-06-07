import { appDb } from "./appDb";
import { loadWatchHistory, saveWatchHistory } from "../settings/storage";
import type { WatchHistoryItem } from "../settings/types";
import { nowMs } from "./time";

const MAX_HISTORY = 300;
let watchHistoryCache = loadWatchHistory().slice(0, MAX_HISTORY);
let sortedWatchHistoryCache: WatchHistoryItem[] | null = null;
let persistTimerId = 0;

const setWatchHistoryCache = (history: WatchHistoryItem[]): void => {
  watchHistoryCache = history.slice(0, MAX_HISTORY);
  sortedWatchHistoryCache = null;
};

const getLatestWatchedAt = (history: WatchHistoryItem[]): number => {
  let latest = 0;
  for (let index = 0; index < history.length; index += 1) {
    latest = Math.max(latest, history[index]?.watchedAt ?? 0);
  }
  return latest;
};

const persistWatchHistory = (history: WatchHistoryItem[]): void => {
  const snapshot = history.slice(0, MAX_HISTORY);
  void appDb.transaction("rw", appDb.watchHistory, async () => {
    await appDb.watchHistory.clear();
    if (snapshot.length === 0) return;
    await appDb.watchHistory.bulkPut(snapshot);
  });
};

const queuePersistWatchHistory = (history: WatchHistoryItem[]): void => {
  if (typeof window === "undefined") {
    persistWatchHistory(history);
    return;
  }
  window.clearTimeout(persistTimerId);
  const snapshot = history.slice(0, MAX_HISTORY);
  persistTimerId = window.setTimeout(() => persistWatchHistory(snapshot), 1500);
};

export const initializeWatchHistory = (): void => {
  void appDb.watchHistory.toArray().then((rows) => {
    if (rows.length > 0) {
      if (getLatestWatchedAt(watchHistoryCache) > getLatestWatchedAt(rows)) {
        persistWatchHistory(watchHistoryCache);
        return;
      }
      setWatchHistoryCache(rows);
      saveWatchHistory(watchHistoryCache);
      return;
    }
    persistWatchHistory(watchHistoryCache);
  });
};

export const getWatchHistory = (): WatchHistoryItem[] => {
  if (!sortedWatchHistoryCache) {
    sortedWatchHistoryCache = [...watchHistoryCache].sort((a, b) => b.watchedAt - a.watchedAt);
  }
  return sortedWatchHistoryCache;
};

export const addWatchHistoryItem = (item: WatchHistoryItem): void => {
  const without = watchHistoryCache.filter((entry) => entry.videoId !== item.videoId);
  const next = [item, ...without].slice(0, MAX_HISTORY);
  setWatchHistoryCache(next);
  saveWatchHistory(next);
  persistWatchHistory(next);
};

export const updateWatchHistoryPosition = (videoId: string, positionSeconds: number): void => {
  const next = watchHistoryCache.map((entry) =>
    entry.videoId === videoId
      ? { ...entry, positionSeconds: Math.max(0, Math.floor(positionSeconds)), watchedAt: nowMs() }
      : entry,
  );
  setWatchHistoryCache(next);
  saveWatchHistory(next);
  queuePersistWatchHistory(next);
};

export const removeWatchHistoryItem = (videoId: string): void => {
  const next = watchHistoryCache.filter((item) => item.videoId !== videoId);
  setWatchHistoryCache(next);
  saveWatchHistory(next);
  persistWatchHistory(next);
};

export const clearWatchHistory = (): void => {
  setWatchHistoryCache([]);
  saveWatchHistory([]);
  persistWatchHistory([]);
};

export const findWatchHistoryItem = (videoId: string): WatchHistoryItem | undefined =>
  watchHistoryCache.find((item) => item.videoId === videoId);
