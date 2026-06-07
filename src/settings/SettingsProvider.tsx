import { useMemo, useState, type ReactNode } from "react";
import { defaultSettings } from "./defaults";
import { getSettingsSnapshot, mergeSettings, setSettingsSnapshot } from "./storage";
import type { AppSettings, MiniPlayerContextValue, MiniPlayerState, SettingsContextValue } from "./types";
import { notifyError, notifySuccess } from "../lib/notifications";
import { MiniPlayerContext, SettingsContext } from "./contexts";
import { parseJsonUnknown, stringifyJson } from "../lib/safeJson";

interface SettingsProviderProps {
  children: ReactNode;
}

export const SettingsProvider = ({ children }: SettingsProviderProps): JSX.Element => {
  const [settings, setSettings] = useState<AppSettings>(() => getSettingsSnapshot());
  const [miniPlayer, setMiniPlayer] = useState<MiniPlayerState | null>(null);

  const setSetting: SettingsContextValue["setSetting"] = (key, value) => {
    setSettings((prev) => {
      const next = mergeSettings({ ...prev, [key]: value });
      setSettingsSnapshot(next);
      return next;
    });
  };

  const updateSettings: SettingsContextValue["updateSettings"] = (patch) => {
    setSettings((prev) => {
      const next = mergeSettings({ ...prev, ...patch });
      setSettingsSnapshot(next);
      return next;
    });
  };

  const resetSettings = (): void => {
    setSettings(defaultSettings);
    setSettingsSnapshot(defaultSettings);
    notifySuccess("設定をリセットしました。");
  };

  const exportSettings = (): string => stringifyJson(settings, 2);

  const importSettings: SettingsContextValue["importSettings"] = (json) => {
    const parsed = parseJsonUnknown(json);
    if (parsed === undefined) {
      notifyError("設定のインポートに失敗しました。");
      return { ok: false, error: "JSON の読み込みに失敗しました。" };
    }
    const next = mergeSettings(parsed);
    setSettings(next);
    setSettingsSnapshot(next);
    notifySuccess("設定をインポートしました。");
    return { ok: true };
  };

  const value = useMemo<SettingsContextValue>(() => ({
    settings,
    setSetting,
    updateSettings,
    resetSettings,
    exportSettings,
    importSettings,
  }), [settings]);

  const miniPlayerValue = useMemo<MiniPlayerContextValue>(() => ({
    miniPlayer,
    setMiniPlayer,
  }), [miniPlayer]);

  return (
    <SettingsContext.Provider value={value}>
      <MiniPlayerContext.Provider value={miniPlayerValue}>{children}</MiniPlayerContext.Provider>
    </SettingsContext.Provider>
  );
};
