import type { VideoDetails } from "../types/invidious";

export type StartPage = "home" | "trending" | "popular" | "subscriptions" | "search";
export type ThemeMode = "system" | "light" | "dark" | "amoled";
export type CornerRadius = "none" | "small" | "medium" | "large" | "xlarge";
export type AccentColor = "blue" | "red" | "purple" | "green" | "orange" | "pink" | "custom";
export type UiDensity = "compact" | "normal" | "comfortable";
export type AnimationStrength = "off" | "reduced" | "normal";
export type QualityMode = "auto" | "1080p" | "720p" | "480p" | "360p";

export type CompanionMode = "default" | "custom";
export type LastFmTitleFormatMode = "raw" | "clean";
export type YouTubeAuthMode = "none" | "cookie" | "tv_oauth";

export interface AppSettings {
  instanceUrl: string;
  apiProxyUrl: string;
  region: string;
  language: string;
  token: string;
  startPage: StartPage;
  theme: ThemeMode;
  amoledEnabled: boolean;
  cornerRadius: CornerRadius;

  saveWatchHistory: boolean;
  showSearchSuggestions: boolean;
  warnBeforeOpeningExternalLinks: boolean;
  openExternalLinksInNewTab: boolean;
  trustedExternalLinkDomains: string[];

  autoplay: boolean;
  livePlaybackEnabled: boolean;
  quality: QualityMode;
  audioTrackLanguage: string;
  audioOnly: boolean;
  dataSaver: boolean;
  pictureInPictureEnabled: boolean;
  autoEnterPipOnBackground: boolean;
  backgroundPlaybackEnabled: boolean;
  androidMediaNotificationEnabled: boolean;
  loopVideo: boolean;
  useProxyVideo: boolean;
  rememberPlaybackPosition: boolean;
  miniPlayer: boolean;
  playerCloseButton: boolean;
  theaterMode: boolean;
  autoplayNextVideo: boolean;
  showCaptionsByDefault: boolean;
  preferOriginalTranslation: boolean;
  hapticFeedback: boolean;
  privacyScreenEnabled: boolean;
  cinematicLighting: boolean;

  expandDescriptionByDefault: boolean;
  hideDescriptionSection: boolean;
  expandChaptersByDefault: boolean;
  expandCommentsByDefault: boolean;

  accentColor: AccentColor;
  customAccentColor: string;
  cardOpacity: number;
  shadowStrength: number;
  uiDensity: UiDensity;
  thumbnailRadius: number;
  playerRadius: number;
  bottomNavOpacity: number;
  // Sidebar
  sidebarCollapsed: boolean;
  showDesktopSidebar: boolean;
  maxContentWidth: number;
  animationStrength: AnimationStrength;
  useLenis: boolean;

  // Invidious Companion
  companionMode: CompanionMode;
  companionUrl: string;
  companionSecret: string;
  youtubeJsProxyUrl: string;
  youtubeAuthMode: YouTubeAuthMode;
  youtubeCookie: string;
  youtubeTvOauthCredentials: string;

  // Last.fm
  lastFmEnabled: boolean;
  lastFmApiKey: string;
  lastFmApiSecret: string;
  lastFmUsername: string;
  lastFmSessionKey: string;
  lastFmScrobbleEnabled: boolean;
  lastFmTitleFormatMode: LastFmTitleFormatMode;
  lastFmTrimArtistPrefix: boolean;
  lastFmTrimFeaturingSuffix: boolean;
  lastFmTrimBracketTags: boolean;
  lastFmTrimDashTags: boolean;

  // Volume
  volume: number;
  muted: boolean;

  // Shorts
  hideShorts: boolean;
  hideMobileNavLabels: boolean;
}


export interface WatchHistoryItem {
  videoId: string;
  title: string;
  thumbnailUrl: string;
  channelName: string;
  watchedAt: number;
  positionSeconds: number;
  durationSeconds?: number;
}

export interface MiniPlayerState {
  videoId: string;
  thumbnailUrl: string;
  video: VideoDetails;
  baseUrl: string;
  positionSeconds: number;
  x: number;
  y: number;
  visible: boolean;
}

export interface SettingsContextValue {
  settings: AppSettings;
  setSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
  resetSettings: () => void;
  exportSettings: () => string;
  importSettings: (json: string) => { ok: boolean; error?: string };
}

export interface MiniPlayerContextValue {
  miniPlayer: MiniPlayerState | null;
  setMiniPlayer: (state: MiniPlayerState | null) => void;
}
