import {
  makeStyles,
  tokens,
  Text,
  Input,
  Switch,
  Dropdown,
  Option,
  Button,
  Label,
  Card,
  CardHeader,
  Caption1,
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  TabList,
  Tab,
} from "@fluentui/react-components";
import { Dismiss24Regular } from "@fluentui/react-icons";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import i18n from "../i18n";
import { useSettings } from "../hooks/useSettings";
import type { AccentColor, AnimationStrength, CompanionMode, CornerRadius, LastFmTitleFormatMode, QualityMode, StartPage, ThemeMode } from "../hooks/useSettings";
import { clearRecentSearches } from "../lib/recentSearch";
import { clearWatchHistory } from "../lib/watchHistory";
import { createLocalUser, getCurrentLocalUser, getLocalUsers, setCurrentLocalUser } from "../lib/localUsers";
import { getLastFmSessionFromToken } from "../lib/lastfm";
import { isCapacitorRuntime, isElectronRuntime } from "../lib/runtimeEnv";
import { openExternalUrl } from "../lib/webPlatform";

const isValidHttpUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const instanceUrlSchema = z.object({
  instanceUrl: z.string().trim().refine((value) => isValidHttpUrl(value), i18n.t("settings.instanceUrlInvalid")),
});

const isElectron = isElectronRuntime();
const isCapacitor = isCapacitorRuntime();
const electronProxyBaseUrl = import.meta.env.VITE_ELECTRON_LOCAL_PROXY_BASE_URL || "http://127.0.0.1:8282";
const capacitorProxyBaseUrl = import.meta.env.VITE_CAPACITOR_LOCAL_PROXY_BASE_URL || "http://127.0.0.1:8282";
const primaryCompanionUrl = "https://companion.tsub4sa.xyz";
const fallbackCompanionUrl = "https://proxy.tsub4sa.xyz";
const firstNonEmpty = (...values: Array<string | undefined>): string => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
};

const audioTrackLanguageOptions = [
  { value: "auto", labelKey: "settings.audioTrackLanguageAuto" },
  { value: "ja", label: "Japanese (ja)" },
  { value: "en", label: "English (en)" },
  { value: "ko", label: "Korean (ko)" },
  { value: "zh", label: "Chinese (zh)" },
  { value: "zh-Hans", label: "Chinese Simplified (zh-Hans)" },
  { value: "zh-Hant", label: "Chinese Traditional (zh-Hant)" },
  { value: "es", label: "Spanish (es)" },
  { value: "fr", label: "French (fr)" },
  { value: "de", label: "German (de)" },
  { value: "pt", label: "Portuguese (pt)" },
  { value: "id", label: "Indonesian (id)" },
  { value: "hi", label: "Hindi (hi)" },
  { value: "ru", label: "Russian (ru)" },
];

const getAudioTrackLanguageLabel = (value: string, translate: (key: string) => string): string => {
  const option = audioTrackLanguageOptions.find((item) => item.value === value);
  if (option?.labelKey) return translate(option.labelKey);
  return option?.label ?? value;
};

const getDefaultCompanionConfig = (): { url: string; secret: string } => {
  if (isElectron) {
    return {
      url: import.meta.env.VITE_ELECTRON_COMPANION_URL || `${electronProxyBaseUrl.replace(/\/+$/, "")}/companion`,
      secret: import.meta.env.VITE_ELECTRON_COMPANION_SECRET || import.meta.env.VITE_COMPANION_SECRET || "",
    };
  }
  if (isCapacitor) {
    return {
      url: import.meta.env.VITE_CAPACITOR_COMPANION_URL || `${capacitorProxyBaseUrl.replace(/\/+$/, "")}/companion`,
      secret: import.meta.env.VITE_CAPACITOR_COMPANION_SECRET || import.meta.env.VITE_COMPANION_SECRET || "",
    };
  }

  return {
    url: firstNonEmpty(import.meta.env.VITE_COMPANION_URL, primaryCompanionUrl, fallbackCompanionUrl),
    secret: import.meta.env.VITE_COMPANION_SECRET || "",
  };
};

type InstanceUrlFormValues = z.infer<typeof instanceUrlSchema>;

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  overlaySurface: {
    width: "min(calc(100vw - 16px), 960px)",
    maxWidth: "960px",
    height: "80vh",
    maxHeight: "80vh",
    "@media (max-width: 768px)": {
      width: "100vw !important",
      height: "100vh !important",
      maxWidth: "100vw !important",
      maxHeight: "100vh !important",
      margin: "0 !important",
      borderRadius: "0 !important",
      border: "none !important",
    },
  },
  overlayBody: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    height: "100%",
    maxHeight: "100%",
    overflow: "hidden",
    padding: "20px 22px",
    boxSizing: "border-box",
    "@media (max-width: 768px)": {
      padding: "16px",
      height: "100% !important",
      maxHeight: "100% !important",
    },
  },
  settingsLayout: {
    display: "flex",
    flexDirection: "row",
    gap: "24px",
    flexGrow: 1,
    minHeight: 0,
    overflow: "hidden",
    marginTop: "16px",
    "@media (max-width: 768px)": {
      flexDirection: "column",
      gap: "12px",
    },
  },
  sidebar: {
    width: "220px",
    flexShrink: 0,
    overflowY: "auto",
    "@media (max-width: 768px)": {
      width: "100%",
      overflowX: "auto",
      overflowY: "hidden",
      borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
      paddingBottom: "8px",
    },
  },
  contentArea: {
    flexGrow: 1,
    minHeight: 0,
    overflowY: "auto",
    paddingRight: "8px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  mobileTabListContainer: {
    overflowX: "auto",
    scrollbarWidth: "none",
    "&::-webkit-scrollbar": {
      display: "none",
    },
  },
  titleRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "16px",
  },
  sectionCard: {
    flexShrink: 0,
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  rowField: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
  },
  inputRow: {
    display: "flex",
    gap: "8px",
    width: "100%",
    flexWrap: "wrap",
  },
  alert: {
    padding: "12px",
    borderRadius: "8px",
    backgroundColor: tokens.colorStatusWarningBackground1,
    border: `1px solid ${tokens.colorStatusWarningBorder1}`,
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  errorText: {
    color: tokens.colorPaletteRedForeground1,
  },
  helperText: {
    color: tokens.colorNeutralForeground3,
  },
});

const SectionCard = ({ title, children }: { title: string; children: React.ReactNode }): JSX.Element => {
  const styles = useStyles();
  return (
    <Card appearance="outline" className={styles.sectionCard}>
      <CardHeader
        header={<Text weight="bold" size={400}>{title}</Text>}
      />
      <div className={styles.section}>
        {children}
      </div>
    </Card>
  );
};

export const SettingsPage = (): JSX.Element => {
  const styles = useStyles();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { settings, setSetting: applySetting, resetSettings, exportSettings, importSettings } = useSettings();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const contentAreaRef = useRef<HTMLDivElement | null>(null);
  const contentScrollTopRef = useRef(0);
  const pageScrollTopRef = useRef(0);
  const pendingScrollRestoreRef = useRef(false);
  const instanceUrlForm = useForm<InstanceUrlFormValues>({
    resolver: zodResolver(instanceUrlSchema),
    defaultValues: { instanceUrl: settings.instanceUrl },
    mode: "onSubmit",
  });

  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isClearHistoryConfirmOpen, setIsClearHistoryConfirmOpen] = useState(false);
  const [isClearSearchConfirmOpen, setIsClearSearchConfirmOpen] = useState(false);
  const [noticeDialog, setNoticeDialog] = useState<{ open: boolean; title: string; message: string }>({
    open: false,
    title: "",
    message: "",
  });
  const noticeDialogId = useId();
  const shouldSkipHistoryBackRef = useRef(false);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [activeTab, setActiveTab] = useState("general");

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const openNoticeDialog = (title: string, message: string): void => {
    setNoticeDialog({ open: true, title, message });
  };

  const setSetting = <K extends keyof typeof settings>(key: K, value: (typeof settings)[K]): void => {
    contentScrollTopRef.current = contentAreaRef.current?.scrollTop ?? contentScrollTopRef.current;
    pageScrollTopRef.current = window.scrollY || document.documentElement.scrollTop || 0;
    pendingScrollRestoreRef.current = true;
    applySetting(key, value);
  };

  useLayoutEffect(() => {
    if (!pendingScrollRestoreRef.current) return;
    pendingScrollRestoreRef.current = false;
    if (contentAreaRef.current) {
      contentAreaRef.current.scrollTop = contentScrollTopRef.current;
    }
    const y = pageScrollTopRef.current;
    if (window.scrollY !== y) {
      window.scrollTo({ top: y, behavior: "auto" });
    }
    requestAnimationFrame(() => {
      if (contentAreaRef.current) {
        contentAreaRef.current.scrollTop = contentScrollTopRef.current;
      }
      if (window.scrollY !== y) {
        window.scrollTo({ top: y, behavior: "auto" });
      }
    });
  }, [settings]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isLastFmCallback = params.get("lastfm") === "1";
    const token = params.get("token");
    const hasAuthCallback = !!token && (isLastFmCallback || !isLastFmCallback);
    const referrerOrigin = (() => {
      try {
        return document.referrer ? new URL(document.referrer).origin : "";
      } catch {
        return "";
      }
    })();
    if (hasAuthCallback && referrerOrigin && referrerOrigin !== window.location.origin) {
      shouldSkipHistoryBackRef.current = true;
    }
    if (token && isLastFmCallback) {
      if (!settings.lastFmApiKey.trim() || !settings.lastFmApiSecret.trim()) {
        openNoticeDialog(t("settings.lastFmAuthErrorTitle"), t("settings.lastFmCredentialsRequired"));
        const cleanUrl = window.location.pathname + window.location.hash;
        window.history.replaceState({}, document.title, cleanUrl);
        return;
      }
      void getLastFmSessionFromToken(settings.lastFmApiKey, settings.lastFmApiSecret, token)
        .then(({ username, sessionKey }) => {
          setSetting("lastFmUsername", username);
          setSetting("lastFmSessionKey", sessionKey);
          setSetting("lastFmEnabled", true);
          openNoticeDialog(t("settings.lastFmAuthSuccessTitle"), t("settings.lastFmAuthSuccessMessage", { username }));
        })
        .catch((error) => {
          console.error(error);
          openNoticeDialog(t("settings.lastFmAuthErrorTitle"), t("settings.lastFmAuthFailed"));
        })
        .finally(() => {
          const cleanUrl = window.location.pathname + window.location.hash;
          window.history.replaceState({}, document.title, cleanUrl);
        });
      return;
    }
    if (token) {
      setSetting("token", token);
      // URLからトークンを削除してクリーンにする
      const newUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, newUrl);
      openNoticeDialog(t("settings.loginSuccessTitle"), t("settings.loginSuccessMessage"));
    }
  }, [setSetting, t]);

  const [localUsers, setLocalUsers] = useState(getLocalUsers());
  const [newLocalUserName, setNewLocalUserName] = useState("");
  const currentLocalUser = getCurrentLocalUser();

  useEffect(() => {
    instanceUrlForm.reset({ instanceUrl: settings.instanceUrl });
  }, [settings.instanceUrl, instanceUrlForm]);

  const applyInstanceUrl = instanceUrlForm.handleSubmit((values) => {
    setSetting("instanceUrl", values.instanceUrl.trim());
  });

  const handleInvidiousLogin = (): void => {
    const scopes = [
      ":preferences",
      ":subscriptions*",
      ":playlists*",
      "GET:feed*",
      "GET:notifications*",
    ].join(",");

    const callbackUrl = window.location.origin + window.location.pathname;
    const authUrl = `${settings.instanceUrl}/authorize_token?scopes=${encodeURIComponent(scopes)}&callback_url=${encodeURIComponent(callbackUrl)}`;

    window.location.href = authUrl;
  };

  const handleExport = (): void => {
    const blob = new Blob([exportSettings()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "invidious-settings.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const openLastFmAuth = (): void => {
    if (!settings.lastFmApiKey.trim()) {
      openNoticeDialog(t("settings.lastFmAuthErrorTitle"), t("settings.lastFmApiKeyRequired"));
      return;
    }
    const callback = `${window.location.origin}${window.location.pathname}?settings=1&lastfm=1`;
    const authUrl = `https://www.last.fm/api/auth/?api_key=${encodeURIComponent(settings.lastFmApiKey.trim())}&cb=${encodeURIComponent(callback)}`;
    void openExternalUrl(authUrl);
  };

  const refreshLocalUsers = (): void => {
    setLocalUsers(getLocalUsers());
  };

  const createUser = (): void => {
    createLocalUser(newLocalUserName);
    setNewLocalUserName("");
    refreshLocalUsers();
  };

  const switchUser = (userId: string): void => {
    setCurrentLocalUser(userId);
    refreshLocalUsers();
  };

  const closeSettingsOverlay = (): void => {
    if (shouldSkipHistoryBackRef.current) {
      navigate("/", { replace: true });
      return;
    }
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/");
  };
  const defaultLastFmApiKey = import.meta.env.VITE_LASTFM_API_KEY || "";
  const defaultLastFmApiSecret = import.meta.env.VITE_LASTFM_API_SECRET || "";

  return (
    <Dialog open onOpenChange={(_, data) => { if (!data.open) closeSettingsOverlay(); }}>
      <DialogSurface className={styles.overlaySurface} data-settings-surface="true">
        <div className={styles.overlayBody}>
          <div className={styles.titleRow}>
            <Text size={700} weight="bold">{t("settings.title")}</Text>
            <Button
              appearance="subtle"
              icon={<Dismiss24Regular />}
              aria-label={t("common.close")}
              title={t("common.close")}
              onClick={closeSettingsOverlay}
            />
          </div>

          <div className={styles.settingsLayout}>
            <div className={styles.sidebar}>
              <div className={isMobile ? styles.mobileTabListContainer : undefined}>
                <TabList
                  vertical={!isMobile}
                  selectedValue={activeTab}
                  onTabSelect={(_, data) => setActiveTab(data.value as string)}
                >
                  <Tab value="general">{t("settings.generalSection")}</Tab>
                  <Tab value="history">{t("settings.historySearchSection")}</Tab>
                  <Tab value="playback">{t("settings.playbackSection")}</Tab>
                  <Tab value="watch">{t("settings.watchSection")}</Tab>
                  <Tab value="appearance">{t("settings.appearanceSection")}</Tab>
                  <Tab value="account">{t("settings.accountSection")}</Tab>
                  <Tab value="companion">{t("settings.companionSection")}</Tab>
                  <Tab value="lastfm">{t("settings.lastFmSection")}</Tab>
                  <Tab value="advanced">{t("settings.advancedSection")}</Tab>
                </TabList>
              </div>
            </div>

            <div
              className={styles.contentArea}
              ref={contentAreaRef}
              onScroll={() => {
                contentScrollTopRef.current = contentAreaRef.current?.scrollTop ?? 0;
              }}
            >
              {activeTab === "general" && (
                <SectionCard title={t("settings.generalSection")}>
                  <div className={styles.field}>
                    <Label>{t("settings.instanceUrlLabel")}</Label>
                    <div className={styles.inputRow}>
                      <Input
                        style={{ flexGrow: 1 }}
                        value={instanceUrlForm.watch("instanceUrl")}
                        onChange={(_, data) => instanceUrlForm.setValue("instanceUrl", data.value, { shouldValidate: false })}
                      />
                      <Button onClick={applyInstanceUrl} appearance="primary">{t("settings.apply")}</Button>
                    </div>
                    {instanceUrlForm.formState.errors.instanceUrl?.message ? (
                      <Caption1 className={styles.errorText}>{instanceUrlForm.formState.errors.instanceUrl.message}</Caption1>
                    ) : (
                      <Caption1 className={styles.helperText}>{t("settings.defaultInstanceUrl", { url: "https://invidious.tsub4sa.xyz" })}</Caption1>
                    )}
                  </div>

                  <div className={styles.field}>
                    <Label>{t("settings.apiProxyUrlLabel")}</Label>
                    <Input
                      value={settings.apiProxyUrl}
                      onChange={(_, data) => setSetting("apiProxyUrl", data.value)}
                      placeholder="/api-proxy"
                    />
                    <Caption1 className={styles.helperText}>{t("settings.apiProxyUrlDescription")}</Caption1>
                  </div>

                  <div className={styles.field}>
                    <Label>{t("settings.region")}</Label>
                    <Dropdown
                      aria-label={t("settings.region")}
                      value={settings.region}
                      selectedOptions={[settings.region]}
                      onOptionSelect={(_, data) => {
                        if (data.optionValue) setSetting("region", data.optionValue);
                      }}
                    >
                      {["JP", "US", "KR", "GB", "DE", "FR", "TW", "CA", "AU"].map((region) => (
                        <Option key={region} value={region}>{region}</Option>
                      ))}
                    </Dropdown>
                  </div>

                  <div className={styles.field}>
                    <Label>{t("settings.displayLanguage")}</Label>
                    <Dropdown
                      aria-label={t("settings.displayLanguage")}
                      value={(() => {
                        const currentLang = settings.language || "ja";
                        return t("settings.languageName", { lng: currentLang }) || currentLang;
                      })()}
                      selectedOptions={[settings.language || "ja"]}
                      onOptionSelect={(_, data) => {
                        if (data.optionValue) {
                          setSetting("language", data.optionValue);
                          void i18n.changeLanguage(data.optionValue);
                        }
                      }}
                    >
                      {(Array.isArray(i18n.options.supportedLngs)
                        ? i18n.options.supportedLngs.filter((lang) => lang !== "cimode")
                        : ["ja", "en"]
                      ).map((lang) => (
                        <Option key={lang} value={lang}>
                          {t("settings.languageName", { lng: lang }) || lang}
                        </Option>
                      ))}
                    </Dropdown>
                  </div>

                  <div className={styles.field}>
                    <Label>{t("settings.startPage")}</Label>
                    <Dropdown
                      aria-label={t("settings.startPage")}
                      value={settings.startPage}
                      selectedOptions={[settings.startPage]}
                      onOptionSelect={(_, data) => {
                        if (data.optionValue) setSetting("startPage", data.optionValue as StartPage);
                      }}
                    >
                      <Option value="home">{t("nav.home")}</Option>
                      <Option value="trending">{t("nav.trending")}</Option>
                      <Option value="popular">{t("nav.popular")}</Option>
                      <Option value="subscriptions">{t("nav.subscriptions")}</Option>
                      <Option value="search">{t("nav.search")}</Option>
                    </Dropdown>
                  </div>

                  <div className={styles.rowField}>
                    <Label>{t("settings.hideShorts") || "Shortsを非表示にする"}</Label>
                    <Switch checked={settings.hideShorts} onChange={(e) => setSetting("hideShorts", e.target.checked)} />
                  </div>
                  <div className={styles.rowField}>
                    <Label>{t("settings.hideMobileNavLabels") || "モバイルナビのテキストを非表示"}</Label>
                    <Switch checked={settings.hideMobileNavLabels} onChange={(e) => setSetting("hideMobileNavLabels", e.target.checked)} />
                  </div>
                  <div className={styles.rowField}>
                    <Label>{t("settings.hapticFeedback")}</Label>
                    <Switch checked={settings.hapticFeedback} onChange={(e) => setSetting("hapticFeedback", e.target.checked)} />
                  </div>
                  <div className={styles.rowField}>
                    <Label>{t("settings.privacyScreenEnabled")}</Label>
                    <Switch checked={settings.privacyScreenEnabled} onChange={(e) => setSetting("privacyScreenEnabled", e.target.checked)} />
                  </div>
                </SectionCard>
              )}

              {activeTab === "history" && (
                <SectionCard title={t("settings.historySearchSection")}>
                  <div className={styles.rowField}>
                    <Label>{t("settings.saveWatchHistory")}</Label>
                    <Switch checked={settings.saveWatchHistory} onChange={(e) => setSetting("saveWatchHistory", e.target.checked)} />
                  </div>
                  <div className={styles.rowField}>
                    <Label>{t("settings.showSearchSuggestions")}</Label>
                    <Switch checked={settings.showSearchSuggestions} onChange={(e) => setSetting("showSearchSuggestions", e.target.checked)} />
                  </div>
                  <div className={styles.rowField}>
                    <Label>{t("settings.warnBeforeOpeningExternalLinks")}</Label>
                    <Switch checked={settings.warnBeforeOpeningExternalLinks} onChange={(e) => setSetting("warnBeforeOpeningExternalLinks", e.target.checked)} />
                  </div>
                  <div className={styles.rowField}>
                    <Label>{t("settings.openExternalLinksInNewTab")}</Label>
                    <Switch checked={settings.openExternalLinksInNewTab} onChange={(e) => setSetting("openExternalLinksInNewTab", e.target.checked)} />
                  </div>

                  {isClearHistoryConfirmOpen ? (
                    <div className={styles.alert}>
                      <Text weight="semibold">{t("settings.confirmClearWatchHistory")}</Text>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <Button size="small" appearance="primary" onClick={() => { clearWatchHistory(); setIsClearHistoryConfirmOpen(false); }}>{t("settings.delete")}</Button>
                        <Button size="small" appearance="outline" onClick={() => setIsClearHistoryConfirmOpen(false)}>{t("common.cancel")}</Button>
                      </div>
                    </div>
                  ) : (
                    <Button appearance="outline" onClick={() => setIsClearHistoryConfirmOpen(true)}>{t("settings.clearWatchHistory")}</Button>
                  )}

                  {isClearSearchConfirmOpen ? (
                    <div className={styles.alert}>
                      <Text weight="semibold">{t("settings.confirmClearSearchHistory")}</Text>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <Button size="small" appearance="primary" onClick={() => { clearRecentSearches(); setIsClearSearchConfirmOpen(false); }}>{t("settings.delete")}</Button>
                        <Button size="small" appearance="outline" onClick={() => setIsClearSearchConfirmOpen(false)}>{t("common.cancel")}</Button>
                      </div>
                    </div>
                  ) : (
                    <Button appearance="outline" onClick={() => setIsClearSearchConfirmOpen(true)}>{t("settings.clearSearchHistory")}</Button>
                  )}
                </SectionCard>
              )}

              {activeTab === "playback" && (
                <SectionCard title={t("settings.playbackSection")}>
                  <div className={styles.rowField}><Label>{t("settings.autoplay")}</Label><Switch checked={settings.autoplay} onChange={(e) => setSetting("autoplay", e.target.checked)} /></div>
                  <div className={styles.rowField}><Label>{t("settings.loopVideo")}</Label><Switch checked={settings.loopVideo} onChange={(e) => setSetting("loopVideo", e.target.checked)} /></div>
                  <div className={styles.rowField}><Label>{t("settings.useProxyVideo")}</Label><Switch checked={settings.useProxyVideo} onChange={(e) => setSetting("useProxyVideo", e.target.checked)} /></div>
                  <div className={styles.rowField}><Label>{t("settings.rememberPlaybackPosition")}</Label><Switch checked={settings.rememberPlaybackPosition} onChange={(e) => setSetting("rememberPlaybackPosition", e.target.checked)} /></div>
                  <div className={styles.rowField}><Label>{t("settings.miniPlayer")}</Label><Switch checked={settings.miniPlayer} onChange={(e) => setSetting("miniPlayer", e.target.checked)} /></div>
                  <div className={styles.rowField}><Label>プレーヤー閉じるボタン</Label><Switch checked={settings.playerCloseButton} onChange={(e) => setSetting("playerCloseButton", e.target.checked)} /></div>
                  <div className={styles.rowField}><Label>{t("settings.theaterMode")}</Label><Switch checked={settings.theaterMode} onChange={(e) => setSetting("theaterMode", e.target.checked)} /></div>
                  <div className={styles.rowField}><Label>{t("settings.autoplayNextVideo")}</Label><Switch checked={settings.autoplayNextVideo} onChange={(e) => setSetting("autoplayNextVideo", e.target.checked)} /></div>
                  <div className={styles.rowField}><Label>{t("settings.showCaptionsByDefault")}</Label><Switch checked={settings.showCaptionsByDefault} onChange={(e) => setSetting("showCaptionsByDefault", e.target.checked)} /></div>
                  <div className={styles.rowField}><Label>{t("settings.preferOriginalTranslation")}</Label><Switch checked={settings.preferOriginalTranslation} onChange={(e) => setSetting("preferOriginalTranslation", e.target.checked)} /></div>
                  <div className={styles.rowField}><Label>{t("settings.cinematicLighting")}</Label><Switch checked={settings.cinematicLighting} onChange={(e) => setSetting("cinematicLighting", e.target.checked)} /></div>
                  {isCapacitor ? (
                    <>
                      <div className={styles.rowField}><Label>{t("settings.pictureInPictureEnabled")}</Label><Switch checked={settings.pictureInPictureEnabled} onChange={(e) => setSetting("pictureInPictureEnabled", e.target.checked)} /></div>
                      <div className={styles.rowField}><Label>{t("settings.autoEnterPipOnBackground")}</Label><Switch checked={settings.autoEnterPipOnBackground} disabled={!settings.pictureInPictureEnabled} onChange={(e) => setSetting("autoEnterPipOnBackground", e.target.checked)} /></div>
                      <div className={styles.rowField}><Label>{t("settings.backgroundPlaybackEnabled")}</Label><Switch checked={settings.backgroundPlaybackEnabled} onChange={(e) => setSetting("backgroundPlaybackEnabled", e.target.checked)} /></div>
                      <div className={styles.rowField}><Label>{t("settings.androidMediaNotificationEnabled")}</Label><Switch checked={settings.androidMediaNotificationEnabled} onChange={(e) => setSetting("androidMediaNotificationEnabled", e.target.checked)} /></div>
                    </>
                  ) : null}

                  <div className={styles.field}>
                    <Label>{t("settings.quality")}</Label>
                    <Dropdown
                      aria-label={t("settings.quality")}
                      value={settings.quality}
                      selectedOptions={[settings.quality]}
                      onOptionSelect={(_, data) => {
                        if (data.optionValue) setSetting("quality", data.optionValue as QualityMode);
                      }}
                    >
                      <Option value="auto">Auto</Option>
                      <Option value="1080p">1080p</Option>
                      <Option value="720p">720p</Option>
                      <Option value="480p">480p</Option>
                      <Option value="360p">360p</Option>
                    </Dropdown>
                  </div>
                  <div className={styles.field}>
                    <Label>{t("settings.defaultAudioTrackLanguage")}</Label>
                    <Dropdown
                      aria-label={t("settings.defaultAudioTrackLanguage")}
                      value={getAudioTrackLanguageLabel(settings.audioTrackLanguage, t)}
                      selectedOptions={[settings.audioTrackLanguage]}
                      onOptionSelect={(_, data) => {
                        if (data.optionValue) setSetting("audioTrackLanguage", data.optionValue);
                      }}
                    >
                      {audioTrackLanguageOptions.map((option) => (
                        <Option key={option.value} value={option.value}>
                          {option.labelKey ? t(option.labelKey) : option.label}
                        </Option>
                      ))}
                    </Dropdown>
                    <Input
                      value={settings.audioTrackLanguage}
                      onChange={(_, data) => setSetting("audioTrackLanguage", data.value.trim() || "auto")}
                      placeholder="auto, ja, en, en-US"
                    />
                    <Caption1 className={styles.helperText}>
                      {t("settings.defaultAudioTrackLanguageDescription")}
                    </Caption1>
                  </div>
                </SectionCard>
              )}
              {activeTab === "account" && (
                <SectionCard title={t("settings.accountSection")}>
                  <Text size={200} className={styles.helperText}>
                    {t("settings.accountDescription")}
                  </Text>
                  <div className={styles.field}>
                    <Label>{t("settings.localUser")}</Label>
                    <Dropdown
                      aria-label={t("settings.localUser")}
                      value={currentLocalUser.name}
                      selectedOptions={[currentLocalUser.id]}
                      onOptionSelect={(_, data) => {
                        if (data.optionValue) switchUser(data.optionValue);
                      }}
                    >
                      {localUsers.map((user) => (
                        <Option key={user.id} value={user.id} text={user.name}>{user.name}</Option>
                      ))}
                    </Dropdown>
                    <div className={styles.inputRow}>
                      <Input
                        value={newLocalUserName}
                        onChange={(_, data) => setNewLocalUserName(data.value)}
                        placeholder={t("settings.newUserNamePlaceholder")}
                        style={{ flexGrow: 1 }}
                      />
                      <Button appearance="outline" onClick={createUser}>{t("settings.add")}</Button>
                    </div>
                    <Caption1 className={styles.helperText}>
                      {t("settings.currentUser", { name: currentLocalUser.name })}
                    </Caption1>
                  </div>
                  {settings.token ? (
                    <div className={styles.alert} style={{ backgroundColor: tokens.colorStatusSuccessBackground1, borderColor: tokens.colorStatusSuccessBorder1 }}>
                      <Text weight="semibold">{t("settings.loggedIn")}</Text>
                      <Caption1>{t("settings.tokenConfigured")}</Caption1>
                      <Button appearance="outline" onClick={() => setSetting("token", "")}>{t("settings.logout")}</Button>
                    </div>
                  ) : (
                    <Button appearance="primary" onClick={handleInvidiousLogin}>{t("settings.loginWithInvidious")}</Button>
                  )}
                </SectionCard>
              )}

              {activeTab === "companion" && (
                <SectionCard title={t("settings.companionSection")}>
                  <Text size={200} className={styles.helperText}>
                    {t("settings.companionDescription")}
                  </Text>
                  <div className={styles.field}>
                    <Label>{t("settings.companionMode")}</Label>
                    <Dropdown
                      aria-label={t("settings.companionMode")}
                      value={settings.companionMode === "default" ? t("settings.companionDefault") : t("settings.companionCustom")}
                      selectedOptions={[settings.companionMode]}
                      onOptionSelect={(_, data) => {
                        if (!data.optionValue) return;
                        const mode = data.optionValue as CompanionMode;
                        setSetting("companionMode", mode);
                        if (mode === "default") {
                          const defaults = getDefaultCompanionConfig();
                          setSetting("companionUrl", defaults.url);
                          setSetting("companionSecret", defaults.secret);
                        }
                      }}
                    >
                      <Option value="default">{t("settings.companionDefault")}</Option>
                      <Option value="custom">{t("settings.companionCustom")}</Option>
                    </Dropdown>
                  </div>

                  <div className={styles.field}>
                    <Label>{t("settings.companionUrl")}</Label>
                    <Input
                      value={settings.companionUrl}
                      onChange={(e, data) => setSetting("companionUrl", data.value)}
                      disabled={settings.companionMode !== "custom"}
                      placeholder="https://companion.example.com"
                    />
                  </div>
                  <div className={styles.field}>
                    <Label>{t("settings.companionSecret")}</Label>
                    <Input
                      type="password"
                      value={settings.companionSecret}
                      onChange={(e, data) => setSetting("companionSecret", data.value)}
                      disabled={settings.companionMode !== "custom"}
                      placeholder="YOURSECRETKEY"
                    />
                  </div>
                </SectionCard>
              )}

              {activeTab === "lastfm" && (
                <SectionCard title={t("settings.lastFmSection")}>
                  <Text size={200} className={styles.helperText}>
                    {t("settings.lastFmDescription")}
                  </Text>
                  <div className={styles.rowField}>
                    <Label>{t("settings.lastFmEnabled")}</Label>
                    <Switch checked={settings.lastFmEnabled} onChange={(e) => setSetting("lastFmEnabled", e.target.checked)} />
                  </div>
                  <div className={styles.field}>
                    <Label>{t("settings.lastFmApiKey")}</Label>
                    <div className={styles.inputRow}>
                      <Input
                        value={settings.lastFmApiKey}
                        onChange={(_, data) => setSetting("lastFmApiKey", data.value)}
                        placeholder="LASTFM_API_KEY"
                        style={{ flexGrow: 1 }}
                      />
                      <Button
                        appearance="outline"
                        disabled={!defaultLastFmApiKey}
                        onClick={() => setSetting("lastFmApiKey", defaultLastFmApiKey)}
                      >
                        {t("settings.lastFmUseDefaultApiKey")}
                      </Button>
                    </div>
                    <Caption1 className={styles.helperText}>
                      {defaultLastFmApiKey ? t("settings.lastFmDefaultApiKeyDetected") : t("settings.lastFmDefaultApiKeyMissing")}
                    </Caption1>
                  </div>
                  <div className={styles.field}>
                    <Label>{t("settings.lastFmApiSecret")}</Label>
                    <div className={styles.inputRow}>
                      <Input
                        type="password"
                        value={settings.lastFmApiSecret}
                        onChange={(_, data) => setSetting("lastFmApiSecret", data.value)}
                        placeholder="LASTFM_API_SECRET"
                        style={{ flexGrow: 1 }}
                      />
                      <Button
                        appearance="outline"
                        disabled={!defaultLastFmApiSecret}
                        onClick={() => setSetting("lastFmApiSecret", defaultLastFmApiSecret)}
                      >
                        {t("settings.lastFmUseDefaultApiSecret")}
                      </Button>
                    </div>
                    <Caption1 className={styles.helperText}>
                      {defaultLastFmApiSecret ? t("settings.lastFmDefaultApiSecretDetected") : t("settings.lastFmDefaultApiSecretMissing")}
                    </Caption1>
                  </div>
                  <div className={styles.field}>
                    <Label>{t("settings.lastFmSessionKey")}</Label>
                    <Input
                      type="password"
                      value={settings.lastFmSessionKey}
                      onChange={(_, data) => setSetting("lastFmSessionKey", data.value)}
                      placeholder="LASTFM_SESSION_KEY"
                    />
                  </div>
                  <div className={styles.field}>
                    <Label>{t("settings.lastFmUsername")}</Label>
                    <Input
                      value={settings.lastFmUsername}
                      onChange={(_, data) => setSetting("lastFmUsername", data.value)}
                      placeholder="your_lastfm_name"
                    />
                  </div>
                  <div className={styles.rowField}>
                    <Label>{t("settings.lastFmScrobbleEnabled")}</Label>
                    <Switch checked={settings.lastFmScrobbleEnabled} onChange={(e) => setSetting("lastFmScrobbleEnabled", e.target.checked)} />
                  </div>
                  <div className={styles.field}>
                    <Label>{t("settings.lastFmTitleFormatMode")}</Label>
                    <Dropdown
                      aria-label={t("settings.lastFmTitleFormatMode")}
                      value={settings.lastFmTitleFormatMode}
                      selectedOptions={[settings.lastFmTitleFormatMode]}
                      onOptionSelect={(_, data) => {
                        if (data.optionValue) setSetting("lastFmTitleFormatMode", data.optionValue as LastFmTitleFormatMode);
                      }}
                    >
                      <Option value="raw">{t("settings.lastFmTitleFormatRaw")}</Option>
                      <Option value="clean">{t("settings.lastFmTitleFormatClean")}</Option>
                    </Dropdown>
                  </div>
                  {settings.lastFmTitleFormatMode === "clean" ? (
                    <>
                      <div className={styles.rowField}>
                        <Label>{t("settings.lastFmTrimArtistPrefix")}</Label>
                        <Switch checked={settings.lastFmTrimArtistPrefix} onChange={(e) => setSetting("lastFmTrimArtistPrefix", e.target.checked)} />
                      </div>
                      <div className={styles.rowField}>
                        <Label>{t("settings.lastFmTrimFeaturingSuffix")}</Label>
                        <Switch checked={settings.lastFmTrimFeaturingSuffix} onChange={(e) => setSetting("lastFmTrimFeaturingSuffix", e.target.checked)} />
                      </div>
                      <div className={styles.rowField}>
                        <Label>{t("settings.lastFmTrimBracketTags")}</Label>
                        <Switch checked={settings.lastFmTrimBracketTags} onChange={(e) => setSetting("lastFmTrimBracketTags", e.target.checked)} />
                      </div>
                      <div className={styles.rowField}>
                        <Label>{t("settings.lastFmTrimDashTags")}</Label>
                        <Switch checked={settings.lastFmTrimDashTags} onChange={(e) => setSetting("lastFmTrimDashTags", e.target.checked)} />
                      </div>
                    </>
                  ) : null}
                  <Button appearance="outline" onClick={openLastFmAuth}>
                    {t("settings.lastFmOpenAuth")}
                  </Button>
                </SectionCard>
              )}

              {activeTab === "advanced" && (
                <SectionCard title={t("settings.advancedSection")}>
                  <div className={styles.field}>
                    <Label>{t("settings.bearerToken")}</Label>
                    <Input value={settings.token} onChange={(e, data) => setSetting("token", data.value)} placeholder={t("settings.optional")} />
                    <Caption1 className={styles.helperText}>{t("settings.oauthRecommended")}</Caption1>
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    <Button onClick={handleExport} appearance="outline">{t("settings.exportSettings")}</Button>
                    <Button onClick={() => fileInputRef.current?.click()} appearance="outline">{t("settings.importSettings")}</Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/json"
                      style={{ display: "none" }}
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        const text = await file.text();
                        const result = importSettings(text);
                        if (result.ok) {
                          openNoticeDialog(t("settings.importSuccessTitle"), t("settings.importSuccessMessage"));
                        } else {
                          openNoticeDialog(t("settings.importFailedTitle"), result.error || t("settings.importFailedMessage"));
                        }
                      }}
                    />
                  </div>

                  {isResetConfirmOpen ? (
                    <div className={styles.alert}>
                      <Text weight="semibold">{t("settings.confirmReset")}</Text>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <Button
                          size="small"
                          appearance="primary"
                          onClick={() => {
                            resetSettings();
                            instanceUrlForm.reset({ instanceUrl: "https://invidious.tsub4sa.xyz" });
                            setIsResetConfirmOpen(false);
                          }}
                        >
                          {t("settings.reset")}
                        </Button>
                        <Button size="small" appearance="outline" onClick={() => setIsResetConfirmOpen(false)}>{t("common.cancel")}</Button>
                      </div>
                    </div>
                  ) : (
                    <Button appearance="outline" onClick={() => setIsResetConfirmOpen(true)}>{t("settings.resetSettings")}</Button>
                  )}
                </SectionCard>
              )}
            </div>
          </div>

          <Dialog
            modalType="alert"
            open={noticeDialog.open}
            onOpenChange={(_, data) => setNoticeDialog((prev) => ({ ...prev, open: data.open }))}
          >
            <DialogSurface
              aria-labelledby={`${noticeDialogId}-title`}
              aria-describedby={`${noticeDialogId}-content`}
            >
              <DialogBody>
                <DialogTitle id={`${noticeDialogId}-title`}>{noticeDialog.title}</DialogTitle>
                <DialogContent id={`${noticeDialogId}-content`}>{noticeDialog.message}</DialogContent>
                <DialogActions>
                  <Button appearance="primary" onClick={() => setNoticeDialog((prev) => ({ ...prev, open: false }))}>
                    {t("common.close")}
                  </Button>
                </DialogActions>
              </DialogBody>
            </DialogSurface>
          </Dialog>
        </div>
      </DialogSurface>
    </Dialog>
  );
};
