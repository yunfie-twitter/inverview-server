import { z } from "zod";
import { getCurrentLocalUser } from "./localUsers";
import { getStorageJson, setStorageJson } from "./browserStorage";

const LOCAL_SUBSCRIPTIONS_KEY = "invidious-local-subscriptions-v1";

type LocalSubscriptionsMap = Record<string, string[]>;
const localSubscriptionsSchema = z.record(z.string(), z.array(z.string()));
let cachedMap: LocalSubscriptionsMap | null = null;
let cachedUserId = "";
let cachedUserIds: string[] | null = null;
let cachedUserIdSet: Set<string> | null = null;

const readMap = (): LocalSubscriptionsMap => {
  if (cachedMap) return cachedMap;
  cachedMap = getStorageJson("local", LOCAL_SUBSCRIPTIONS_KEY, localSubscriptionsSchema, {});
  return cachedMap;
};

const writeMap = (value: LocalSubscriptionsMap): void => {
  cachedMap = value;
  cachedUserIds = null;
  cachedUserIdSet = null;
  setStorageJson("local", LOCAL_SUBSCRIPTIONS_KEY, value);
};

const getCurrentUserSubscriptionState = (): { userId: string; ids: string[]; idSet: Set<string> } => {
  const user = getCurrentLocalUser();
  if (cachedUserId !== user.id) {
    cachedUserId = user.id;
    cachedUserIds = null;
    cachedUserIdSet = null;
  }

  if (!cachedUserIds) {
    const map = readMap();
    cachedUserIds = Array.isArray(map[user.id]) ? map[user.id] : [];
    cachedUserIdSet = null;
  }

  if (!cachedUserIdSet) {
    cachedUserIdSet = new Set(cachedUserIds);
  }

  return { userId: user.id, ids: cachedUserIds, idSet: cachedUserIdSet };
};

export const getLocalSubscriptionIds = (): string[] => {
  return getCurrentUserSubscriptionState().ids;
};

export const isLocallySubscribed = (channelId: string): boolean =>
  getCurrentUserSubscriptionState().idSet.has(channelId);

export const addLocalSubscription = (channelId: string): void => {
  const trimmed = channelId.trim();
  if (!trimmed) return;
  const map = readMap();
  const { userId, ids, idSet } = getCurrentUserSubscriptionState();
  if (idSet.has(trimmed)) return;
  map[userId] = [trimmed, ...ids];
  writeMap(map);
};

export const removeLocalSubscription = (channelId: string): void => {
  const map = readMap();
  const { userId, ids, idSet } = getCurrentUserSubscriptionState();
  if (!idSet.has(channelId)) return;
  map[userId] = ids.filter((id) => id !== channelId);
  writeMap(map);
};

export const toggleLocalSubscription = (channelId: string): boolean => {
  if (isLocallySubscribed(channelId)) {
    removeLocalSubscription(channelId);
    return false;
  }
  addLocalSubscription(channelId);
  return true;
};

