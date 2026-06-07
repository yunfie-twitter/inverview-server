import { useContext } from "react";
import { MiniPlayerContext, SettingsContext } from "../settings/contexts";
import type { MiniPlayerContextValue, SettingsContextValue } from "../settings/types";

export const useSettings = (): SettingsContextValue => {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
};

export const useMiniPlayer = (): MiniPlayerContextValue => {
  const ctx = useContext(MiniPlayerContext);
  if (!ctx) throw new Error("useMiniPlayer must be used within SettingsProvider");
  return ctx;
};
export type {
  AppSettings,
  AccentColor,
  AnimationStrength,
  CornerRadius,
  QualityMode,
  StartPage,
  ThemeMode,
  UiDensity,
  CompanionMode,
  YouTubeAuthMode,
  LastFmTitleFormatMode,
  WatchHistoryItem,
} from "../settings/types";
