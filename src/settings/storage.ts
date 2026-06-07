import { defaultSettings, SEARCH_HISTORY_STORAGE_KEY, SETTINGS_STORAGE_KEY, WATCH_HISTORY_STORAGE_KEY } from "./defaults";
import type { AppSettings, WatchHistoryItem } from "./types";
import { getStorageJson, setStorageJson } from "../lib/browserStorage";
import { scheduleTask, withWebLock } from "../lib/webPlatform";
import { z } from "zod";

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const watchHistorySchema = z.array(z.object({
  videoId: z.string(),
  title: z.string().optional().default(""),
  thumbnailUrl: z.string().optional().default(""),
  channelName: z.string().optional().default(""),
  watchedAt: z.number().optional().default(0),
  positionSeconds: z.number().optional().default(0),
  durationSeconds: z.number().optional(),
}).passthrough());

const searchHistorySchema = z.array(z.string());

const clampNumber = (value: unknown, fallback: number, min: number, max: number): number => {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.min(max, Math.max(min, value));
};

export const mergeSettings = (raw: unknown): AppSettings => {
  if (!isObject(raw)) return defaultSettings;

  const legacyInstance = typeof raw.apiBaseUrl === "string" ? raw.apiBaseUrl : undefined;
  const legacyTheme = raw.theme === "amoled" ? "amoled" : raw.theme;



  const merged: AppSettings = {
    ...defaultSettings,
    ...raw,
    instanceUrl:
      typeof raw.instanceUrl === "string" && raw.instanceUrl.trim()
        ? raw.instanceUrl
        : legacyInstance && legacyInstance.trim()
          ? legacyInstance
          : defaultSettings.instanceUrl,
    apiProxyUrl: typeof raw.apiProxyUrl === "string" ? raw.apiProxyUrl : defaultSettings.apiProxyUrl,
    region: typeof raw.region === "string" && raw.region.trim() ? raw.region : defaultSettings.region,
    language: typeof raw.language === "string" && raw.language.trim() ? raw.language : defaultSettings.language,
    audioTrackLanguage:
      typeof raw.audioTrackLanguage === "string" && raw.audioTrackLanguage.trim()
        ? raw.audioTrackLanguage
        : defaultSettings.audioTrackLanguage,
    token: typeof raw.token === "string" ? raw.token : "",
    youtubeJsProxyUrl:
      typeof raw.youtubeJsProxyUrl === "string" && raw.youtubeJsProxyUrl.trim()
        ? raw.youtubeJsProxyUrl
        : defaultSettings.youtubeJsProxyUrl,
    youtubeAuthMode:
      raw.youtubeAuthMode === "cookie" || raw.youtubeAuthMode === "tv_oauth" || raw.youtubeAuthMode === "none"
        ? raw.youtubeAuthMode
        : defaultSettings.youtubeAuthMode,
    youtubeCookie: typeof raw.youtubeCookie === "string" ? raw.youtubeCookie : defaultSettings.youtubeCookie,
    youtubeTvOauthCredentials:
      typeof raw.youtubeTvOauthCredentials === "string"
        ? raw.youtubeTvOauthCredentials
        : defaultSettings.youtubeTvOauthCredentials,
    livePlaybackEnabled:
      typeof raw.livePlaybackEnabled === "boolean"
        ? raw.livePlaybackEnabled
        : defaultSettings.livePlaybackEnabled,
    hapticFeedback:
      typeof raw.hapticFeedback === "boolean"
        ? raw.hapticFeedback
        : defaultSettings.hapticFeedback,
    warnBeforeOpeningExternalLinks:
      typeof raw.warnBeforeOpeningExternalLinks === "boolean"
        ? raw.warnBeforeOpeningExternalLinks
        : defaultSettings.warnBeforeOpeningExternalLinks,
    openExternalLinksInNewTab:
      typeof raw.openExternalLinksInNewTab === "boolean"
        ? raw.openExternalLinksInNewTab
        : defaultSettings.openExternalLinksInNewTab,
    trustedExternalLinkDomains: Array.isArray(raw.trustedExternalLinkDomains)
      ? raw.trustedExternalLinkDomains
          .filter((value): value is string => typeof value === "string" && !!value.trim())
          .map((value) => value.trim().toLowerCase())
      : defaultSettings.trustedExternalLinkDomains,
    theme: (legacyTheme as AppSettings["theme"]) || defaultSettings.theme,
    customAccentColor: typeof raw.customAccentColor === "string" ? raw.customAccentColor : defaultSettings.customAccentColor,
    cardOpacity: clampNumber(raw.cardOpacity, defaultSettings.cardOpacity, 0.2, 1),
    shadowStrength: clampNumber(raw.shadowStrength, defaultSettings.shadowStrength, 0, 1),
    thumbnailRadius: clampNumber(raw.thumbnailRadius, defaultSettings.thumbnailRadius, 0, 40),
    playerRadius: clampNumber(raw.playerRadius, defaultSettings.playerRadius, 0, 40),
    bottomNavOpacity: clampNumber(raw.bottomNavOpacity, defaultSettings.bottomNavOpacity, 0.25, 1),
    maxContentWidth: clampNumber(raw.maxContentWidth, defaultSettings.maxContentWidth, 960, 1920),
    hideShorts: typeof raw.hideShorts === "boolean" ? raw.hideShorts : defaultSettings.hideShorts,
    hideMobileNavLabels: typeof raw.hideMobileNavLabels === "boolean" ? raw.hideMobileNavLabels : defaultSettings.hideMobileNavLabels,
  };

  return merged;
};

export const loadSettingsFromStorage = (): AppSettings => {
  return mergeSettings(getStorageJson("local", SETTINGS_STORAGE_KEY, z.unknown(), defaultSettings));
};

export const saveSettingsToStorage = (settings: AppSettings): void => {
  scheduleTask(() => {
    withWebLock("inverview-settings-write", () => {
      setStorageJson("local", SETTINGS_STORAGE_KEY, settings);
    });
  }, "background");
};

let settingsCache: AppSettings | null = null;

export const getSettingsSnapshot = (): AppSettings => {
  if (settingsCache) return settingsCache;
  settingsCache = loadSettingsFromStorage();
  return settingsCache;
};

export const setSettingsSnapshot = (settings: AppSettings): void => {
  settingsCache = settings;
  saveSettingsToStorage(settings);
};

export const loadWatchHistory = (): WatchHistoryItem[] => {
  return getStorageJson("local", WATCH_HISTORY_STORAGE_KEY, watchHistorySchema, []);
};

export const saveWatchHistory = (history: WatchHistoryItem[]): void => {
  scheduleTask(() => {
    withWebLock("inverview-watch-history-write", () => {
      setStorageJson("local", WATCH_HISTORY_STORAGE_KEY, history.slice(0, 300));
    });
  }, "background");
};

export const loadSearchHistory = (): string[] => {
  return getStorageJson("local", SEARCH_HISTORY_STORAGE_KEY, searchHistorySchema, []);
};

export const saveSearchHistory = (history: string[]): void => {
  scheduleTask(() => {
    withWebLock("inverview-search-history-write", () => {
      setStorageJson("local", SEARCH_HISTORY_STORAGE_KEY, history.slice(0, 30));
    });
  }, "background");
};
