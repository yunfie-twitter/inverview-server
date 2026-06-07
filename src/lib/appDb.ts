import Dexie, { type Table } from "dexie";
import type { WatchHistoryItem } from "../settings/types";

interface SearchHistoryRow {
  id?: number;
  value: string;
}

class InvidiousClientDb extends Dexie {
  watchHistory!: Table<WatchHistoryItem, string>;
  searchHistory!: Table<SearchHistoryRow, number>;

  constructor() {
    super("invidious-client-db");
    this.version(1).stores({
      watchHistory: "videoId, watchedAt",
      searchHistory: "++id, value",
    });
  }
}

export const appDb = new InvidiousClientDb();
