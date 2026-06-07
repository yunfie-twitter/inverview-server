import type { AppSettings } from "./types";
import { isCapacitorRuntime, isElectronRuntime } from "../lib/runtimeEnv";

export const SETTINGS_STORAGE_KEY = "invidious-client-settings";
export const WATCH_HISTORY_STORAGE_KEY = "invidious-client-watch-history";
export const SEARCH_HISTORY_STORAGE_KEY = "invidious-client-search-history";

const isElectron = isElectronRuntime();
const isCapacitor = isCapacitorRuntime();
const isNativeApp = isElectron || isCapacitor;
const isDev = import.meta.env.DEV;
const electronProxyBaseUrl = import.meta.env.VITE_ELECTRON_LOCAL_PROXY_BASE_URL || "http://127.0.0.1:8282";
const capacitorProxyBaseUrl = import.meta.env.VITE_CAPACITOR_LOCAL_PROXY_BASE_URL || "http://127.0.0.1:8282";
const webLocalProxyBaseUrl = import.meta.env.VITE_WEB_LOCAL_PROXY_BASE_URL || "http://127.0.0.1:8282";
const primaryCompanionUrl = "https://companion.tsub4sa.xyz";
const fallbackCompanionUrl = "https://proxy.tsub4sa.xyz";
const firstNonEmpty = (...values: Array<string | undefined>): string => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
};

const defaultInstanceUrl = isElectron
  ? import.meta.env.VITE_ELECTRON_INVIDIOUS_API_BASE_URL || import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_INVIDIOUS_API_BASE_URL || "https://invidious.tsub4sa.xyz"
  : isCapacitor
    ? import.meta.env.VITE_CAPACITOR_INVIDIOUS_API_BASE_URL || import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_INVIDIOUS_API_BASE_URL || "https://invidious.tsub4sa.xyz"
    : import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_INVIDIOUS_API_BASE_URL || "https://invidious.tsub4sa.xyz";

const defaultCompanionUrl = isElectron
  ? import.meta.env.VITE_ELECTRON_COMPANION_URL || `${electronProxyBaseUrl.replace(/\/+$/, "")}/companion`
  : isCapacitor
    ? import.meta.env.VITE_CAPACITOR_COMPANION_URL || `${capacitorProxyBaseUrl.replace(/\/+$/, "")}/companion`
    : firstNonEmpty(import.meta.env.VITE_COMPANION_URL, primaryCompanionUrl, fallbackCompanionUrl);

const defaultCompanionSecret = isElectron
  ? import.meta.env.VITE_ELECTRON_COMPANION_SECRET || import.meta.env.VITE_COMPANION_SECRET || ""
  : isCapacitor
    ? import.meta.env.VITE_CAPACITOR_COMPANION_SECRET || import.meta.env.VITE_COMPANION_SECRET || ""
    : import.meta.env.VITE_COMPANION_SECRET || "";

const parseEnvBoolean = (value: unknown, fallback: boolean): boolean => {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
};

export const defaultSettings: AppSettings = {
  instanceUrl: defaultInstanceUrl,
  apiProxyUrl: isElectron
    ? import.meta.env.VITE_ELECTRON_API_PROXY_URL || `${electronProxyBaseUrl.replace(/\/+$/, "")}/api-proxy`
    : isCapacitor
      ? import.meta.env.VITE_CAPACITOR_API_PROXY_URL || `${capacitorProxyBaseUrl.replace(/\/+$/, "")}/api-proxy`
      : import.meta.env.VITE_API_PROXY_URL || "/api-proxy",
  region: import.meta.env.VITE_DEFAULT_REGION || "JP",
  language: import.meta.env.VITE_DEFAULT_LANGUAGE || "ja",
  token: "",
  startPage: "home",
  theme: "system",
  amoledEnabled: false,
  cornerRadius: "large",

  saveWatchHistory: true,
  showSearchSuggestions: true,
  warnBeforeOpeningExternalLinks: true,
  openExternalLinksInNewTab: true,
  trustedExternalLinkDomains: [],

  autoplay: false,
  livePlaybackEnabled: parseEnvBoolean(import.meta.env.VITE_ENABLE_LIVE_PLAYBACK, true),
  quality: "auto",
  audioTrackLanguage: "auto",
  audioOnly: false,
  dataSaver: false,
  pictureInPictureEnabled: false,
  autoEnterPipOnBackground: false,
  backgroundPlaybackEnabled: true,
  androidMediaNotificationEnabled: true,
  loopVideo: false,
  useProxyVideo: true,
  rememberPlaybackPosition: true,
  miniPlayer: false,
  playerCloseButton: false,
  theaterMode: false,
  autoplayNextVideo: false,
  showCaptionsByDefault: false,
  preferOriginalTranslation: true,
  hapticFeedback: true,
  privacyScreenEnabled: false,
  cinematicLighting: false,

  expandDescriptionByDefault: false,
  hideDescriptionSection: false,
  expandChaptersByDefault: false,
  expandCommentsByDefault: true,

  accentColor: "blue",
  customAccentColor: "#2A8CFF",
  cardOpacity: 0.92,
  shadowStrength: 0.5,
  uiDensity: "normal",
  thumbnailRadius: 14,
  playerRadius: 14,
  bottomNavOpacity: 0.72,
  sidebarCollapsed: false,
  showDesktopSidebar: true,
  maxContentWidth: 1280,
  animationStrength: "normal",
  useLenis: false,

  companionMode: "default",
  companionUrl: defaultCompanionUrl,
  companionSecret: defaultCompanionSecret,
  youtubeJsProxyUrl: isNativeApp
    ? `${(isElectron ? electronProxyBaseUrl : capacitorProxyBaseUrl).replace(/\/+$/, "")}/youtubejs-proxy`
    : import.meta.env.VITE_YOUTUBEJS_PROXY_URL || "/youtubejs-proxy",
  youtubeAuthMode: "none",
  youtubeCookie: "",
  youtubeTvOauthCredentials: "",
  lastFmEnabled: false,
  lastFmApiKey: import.meta.env.VITE_LASTFM_API_KEY || "",
  lastFmApiSecret: import.meta.env.VITE_LASTFM_API_SECRET || "",
  lastFmUsername: "",
  lastFmSessionKey: "",
  lastFmScrobbleEnabled: true,
  lastFmTitleFormatMode: "clean",
  lastFmTrimArtistPrefix: true,
  lastFmTrimFeaturingSuffix: true,
  lastFmTrimBracketTags: true,
  lastFmTrimDashTags: true,
  volume: 1,
  muted: false,
  hideShorts: false,
  hideMobileNavLabels: false,
};


