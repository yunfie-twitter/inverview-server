import { getStorageString, removeStorageValue, setStorageString } from "./browserStorage";

const TV_SESSION_STORAGE_KEY = "inverview-tv-session-id";

export const setTvSessionId = (sessionId: string): void => {
  if (sessionId) {
    setStorageString("session", TV_SESSION_STORAGE_KEY, sessionId);
    return;
  }
  removeStorageValue("session", TV_SESSION_STORAGE_KEY);
};

export const getTvSessionId = (): string => {
  return getStorageString("session", TV_SESSION_STORAGE_KEY);
};
