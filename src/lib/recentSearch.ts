import { appDb } from "./appDb";
import { loadSearchHistory, saveSearchHistory } from "../settings/storage";

const MAX_HISTORY = 12;
let searchHistoryCache = loadSearchHistory().slice(0, MAX_HISTORY);

const persistSearchHistory = (history: string[]): void => {
  void appDb.transaction("rw", appDb.searchHistory, async () => {
    await appDb.searchHistory.clear();
    if (history.length === 0) return;
    await appDb.searchHistory.bulkAdd(history.map((value) => ({ value })));
  });
};

export const initializeRecentSearches = (): void => {
  void appDb.searchHistory.toArray().then((rows) => {
    if (rows.length > 0) {
      searchHistoryCache = rows.map((row) => row.value).slice(0, MAX_HISTORY);
      saveSearchHistory(searchHistoryCache);
      return;
    }
    persistSearchHistory(searchHistoryCache);
  });
};

export const getRecentSearches = (): string[] => searchHistoryCache;

export const addRecentSearch = (query: string): void => {
  const normalized = query.trim();
  if (!normalized) return;
  const next = [normalized, ...searchHistoryCache.filter((item) => item !== normalized)].slice(0, MAX_HISTORY);
  searchHistoryCache = next;
  saveSearchHistory(next);
  persistSearchHistory(next);
};

export const removeRecentSearch = (query: string): void => {
  const next = searchHistoryCache.filter((item) => item !== query);
  searchHistoryCache = next;
  saveSearchHistory(next);
  persistSearchHistory(next);
};

export const clearRecentSearches = (): void => {
  searchHistoryCache = [];
  saveSearchHistory([]);
  persistSearchHistory([]);
};
