import { useMemo } from "react";
import { useSettings } from "../hooks/useSettings";
import { getSettingsSnapshot as getSnapshot } from "../settings/storage";
import type { AppSettings } from "../settings/types";

export type { QualityMode, ThemeMode } from "../settings/types";

export interface LegacySettingsState {
  apiBaseUrl: string;
  apiProxyUrl: string;
  region: string;
  language: string;
  theme: "system" | "light" | "dark";
  token: string;
  autoplay: boolean;
  loopVideo: boolean;
  useProxyVideo: boolean;
  rememberPlaybackPosition: boolean;
  miniPlayer: boolean;
  theaterMode: boolean;
  autoplayNextVideo: boolean;
  showCaptionsByDefault: boolean;
  preferOriginalTranslation: boolean;
  hapticFeedback: boolean;
  cinematicLighting: boolean;
  expandDescriptionByDefault: boolean;
  expandChaptersByDefault: boolean;
  expandCommentsByDefault: boolean;
  saveWatchHistory: boolean;
  showSearchSuggestions: boolean;
  warnBeforeOpeningExternalLinks: boolean;
  openExternalLinksInNewTab: boolean;
  trustedExternalLinkDomains: string[];
  useLenis: boolean;
  sidebarCollapsed: boolean;
  quality: AppSettings["quality"];
  audioTrackLanguage: string;
  audioOnly: boolean;
  dataSaver: boolean;
  pictureInPictureEnabled: boolean;
  autoEnterPipOnBackground: boolean;
  backgroundPlaybackEnabled: boolean;
  androidMediaNotificationEnabled: boolean;
  companionUrl: string;
  companionSecret: string;
  youtubeJsProxyUrl: string;
  youtubeAuthMode: AppSettings["youtubeAuthMode"];
  youtubeCookie: string;
  youtubeTvOauthCredentials: string;
  volume: number;
  muted: boolean;
  hideShorts: boolean;
  hideMobileNavLabels: boolean;
  setVolume: (value: number) => void;
  setMuted: (value: boolean) => void;
  setApiBaseUrl: (value: string) => void;
  setApiProxyUrl: (value: string) => void;
  setRegion: (value: string) => void;
  setLanguage: (value: string) => void;
  setTheme: (value: "system" | "light" | "dark") => void;
  setToken: (value: string) => void;
  clearToken: () => void;
  setAutoplay: (value: boolean) => void;
  setLoopVideo: (value: boolean) => void;
  setUseProxyVideo: (value: boolean) => void;
  setRememberPlaybackPosition: (value: boolean) => void;
  setQuality: (value: AppSettings["quality"]) => void;
  setAudioOnly: (value: boolean) => void;
  setDataSaver: (value: boolean) => void;
  setCompanionUrl: (value: string) => void;
  setCompanionSecret: (value: string) => void;
  setHideShorts: (value: boolean) => void;
  setHideMobileNavLabels: (value: boolean) => void;
  setUseLenis: (value: boolean) => void;
  setSidebarCollapsed: (value: boolean) => void;
}

const toLegacyState = (settings: AppSettings, updateSettings: (patch: Partial<AppSettings>) => void): LegacySettingsState => ({
  apiBaseUrl: settings.instanceUrl,
  apiProxyUrl: settings.apiProxyUrl,
  region: settings.region,
  language: settings.language,
  theme: settings.theme === "amoled" ? "dark" : settings.theme,
  token: settings.token,
  autoplay: settings.autoplay,
  loopVideo: settings.loopVideo,
  useProxyVideo: settings.useProxyVideo,
  rememberPlaybackPosition: settings.rememberPlaybackPosition,
  miniPlayer: settings.miniPlayer,
  theaterMode: settings.theaterMode,
  autoplayNextVideo: settings.autoplayNextVideo,
  showCaptionsByDefault: settings.showCaptionsByDefault,
  preferOriginalTranslation: settings.preferOriginalTranslation,
  hapticFeedback: settings.hapticFeedback,
  cinematicLighting: settings.cinematicLighting,
  expandDescriptionByDefault: settings.expandDescriptionByDefault,
  expandChaptersByDefault: settings.expandChaptersByDefault,
  expandCommentsByDefault: settings.expandCommentsByDefault,
  saveWatchHistory: settings.saveWatchHistory,
  showSearchSuggestions: settings.showSearchSuggestions,
  warnBeforeOpeningExternalLinks: settings.warnBeforeOpeningExternalLinks,
  openExternalLinksInNewTab: settings.openExternalLinksInNewTab,
  trustedExternalLinkDomains: settings.trustedExternalLinkDomains,
  useLenis: settings.useLenis,
  sidebarCollapsed: settings.sidebarCollapsed,
  quality: settings.quality,
  audioTrackLanguage: settings.audioTrackLanguage,
  audioOnly: settings.audioOnly,
  dataSaver: settings.dataSaver,
  pictureInPictureEnabled: settings.pictureInPictureEnabled,
  autoEnterPipOnBackground: settings.autoEnterPipOnBackground,
  backgroundPlaybackEnabled: settings.backgroundPlaybackEnabled,
  androidMediaNotificationEnabled: settings.androidMediaNotificationEnabled,
  companionUrl: settings.companionUrl,
  companionSecret: settings.companionSecret,
  youtubeJsProxyUrl: settings.youtubeJsProxyUrl,
  youtubeAuthMode: settings.youtubeAuthMode,
  youtubeCookie: settings.youtubeCookie,
  youtubeTvOauthCredentials: settings.youtubeTvOauthCredentials,
  volume: settings.volume,
  muted: settings.muted,
  hideShorts: settings.hideShorts,
  hideMobileNavLabels: settings.hideMobileNavLabels,
  setVolume: (value) => updateSettings({ volume: value }),
  setMuted: (value) => updateSettings({ muted: value }),
  setApiBaseUrl: (value) => updateSettings({ instanceUrl: value }),
  setApiProxyUrl: (value) => updateSettings({ apiProxyUrl: value }),
  setRegion: (value) => updateSettings({ region: value || "JP" }),
  setLanguage: (value) => updateSettings({ language: value || "ja" }),
  setTheme: (value) => updateSettings({ theme: value }),
  setToken: (value) => updateSettings({ token: value }),
  clearToken: () => updateSettings({ token: "" }),
  setAutoplay: (value) => updateSettings({ autoplay: value }),
  setLoopVideo: (value) => updateSettings({ loopVideo: value }),
  setUseProxyVideo: (value) => updateSettings({ useProxyVideo: value }),
  setRememberPlaybackPosition: (value) => updateSettings({ rememberPlaybackPosition: value }),
  setQuality: (value) => updateSettings({ quality: value }),
  setAudioOnly: (value) => updateSettings({ audioOnly: value }),
  setDataSaver: (value) => updateSettings({ dataSaver: value }),
  setCompanionUrl: (value) => updateSettings({ companionUrl: value }),
  setCompanionSecret: (value) => updateSettings({ companionSecret: value }),
  setHideShorts: (value) => updateSettings({ hideShorts: value }),
  setHideMobileNavLabels: (value) => updateSettings({ hideMobileNavLabels: value }),
  setUseLenis: (value) => updateSettings({ useLenis: value }),
  setSidebarCollapsed: (value) => updateSettings({ sidebarCollapsed: value }),
});


export function useSettingsStore(): LegacySettingsState;
export function useSettingsStore<T>(selector: (state: LegacySettingsState) => T): T;
export function useSettingsStore<T>(selector?: (state: LegacySettingsState) => T): LegacySettingsState | T {
  const { settings, updateSettings } = useSettings();
  const state = useMemo(() => toLegacyState(settings, updateSettings), [settings, updateSettings]);
  if (selector) return selector(state);
  return state;
}

export const getSettingsSnapshot = (): LegacySettingsState => {
  const raw = getSnapshot();
  return toLegacyState(raw, () => undefined);
};
