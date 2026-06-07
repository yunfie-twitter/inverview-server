import { openDB } from "idb";
import { expiresAtFromNow, nowMs } from "./time";

const DB_NAME = "invidious-client-cache";
const DB_VERSION = 1;
const STORE_NAME = "api-cache";

type CacheRecord<T> = {
  value: T;
  expiresAt: number;
};

const memoryCache = new Map<string, CacheRecord<unknown>>();
const MAX_MEMORY_CACHE_ENTRIES = 64;
const MAX_MEMORY_ARRAY_LENGTH = 60;

const shouldKeepInMemory = (key: string, value: unknown): boolean => {
  if (key.includes("react-query-cache")) return false;
  if (Array.isArray(value)) return value.length <= MAX_MEMORY_ARRAY_LENGTH;
  return true;
};

const pruneMemoryCache = (): void => {
  const now = nowMs();
  for (const [key, record] of memoryCache) {
    if (record.expiresAt <= now) {
      memoryCache.delete(key);
    }
  }

  while (memoryCache.size > MAX_MEMORY_CACHE_ENTRIES) {
    const oldestKey = memoryCache.keys().next().value;
    if (oldestKey === undefined) return;
    memoryCache.delete(oldestKey);
  }
};

const setMemoryCache = (key: string, record: CacheRecord<unknown>): void => {
  memoryCache.delete(key);
  memoryCache.set(key, record);
  pruneMemoryCache();
};

const dbPromise = openDB(DB_NAME, DB_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.createObjectStore(STORE_NAME);
    }
  },
});

export const setApiCache = async <T>(key: string, value: T, ttlMs: number): Promise<void> => {
  const expiresAt = expiresAtFromNow(ttlMs);
  if (shouldKeepInMemory(key, value)) {
    setMemoryCache(key, { value, expiresAt });
  } else {
    memoryCache.delete(key);
  }
  const db = await dbPromise;
  const payload: CacheRecord<T> = {
    value,
    expiresAt,
  };
  await db.put(STORE_NAME, payload, key);
};

export const getApiCache = async <T>(key: string): Promise<T | undefined> => {
  const memoryRecord = memoryCache.get(key) as CacheRecord<T> | undefined;
  if (memoryRecord) {
    if (memoryRecord.expiresAt > nowMs()) {
      setMemoryCache(key, memoryRecord as CacheRecord<unknown>);
      return memoryRecord.value;
    }
    memoryCache.delete(key);
  }

  const db = await dbPromise;
  const record = (await db.get(STORE_NAME, key)) as CacheRecord<T> | undefined;
  if (!record) return undefined;
  if (record.expiresAt <= nowMs()) {
    await db.delete(STORE_NAME, key);
    memoryCache.delete(key);
    return undefined;
  }
  if (shouldKeepInMemory(key, record.value)) {
    setMemoryCache(key, record as CacheRecord<unknown>);
  }
  return record.value;
};

export const deleteApiCache = async (key: string): Promise<void> => {
  memoryCache.delete(key);
  const db = await dbPromise;
  await db.delete(STORE_NAME, key);
};
