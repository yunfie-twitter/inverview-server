import { type ZodType } from "zod";
import { parseJsonWithSchema, stringifyJson } from "./safeJson";

type StorageArea = "local" | "session";

const getStorage = (area: StorageArea): Storage | null => {
  if (typeof window === "undefined") return null;
  return area === "local" ? window.localStorage : window.sessionStorage;
};

export const getStorageString = (area: StorageArea, key: string, fallback = ""): string => {
  try {
    return getStorage(area)?.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
};

export const setStorageString = (area: StorageArea, key: string, value: string): void => {
  try {
    getStorage(area)?.setItem(key, value);
  } catch {
    // Storage can fail in private mode or when quota is exceeded.
  }
};

export const removeStorageValue = (area: StorageArea, key: string): void => {
  try {
    getStorage(area)?.removeItem(key);
  } catch {
    // Ignore unavailable storage.
  }
};

export const getStorageJson = <T>(area: StorageArea, key: string, schema: ZodType<T>, fallback: T): T => {
  try {
    return parseJsonWithSchema(getStorage(area)?.getItem(key), schema, fallback);
  } catch {
    return fallback;
  }
};

export const setStorageJson = (area: StorageArea, key: string, value: unknown): void => {
  setStorageString(area, key, stringifyJson(value));
};
