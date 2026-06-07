import { useEffect, useMemo } from "react";
import axios from "axios";
import { FluentProvider } from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import { AppRoutes } from "../routes";
import { ErrorBoundary } from "./ErrorBoundary";
import { AppToaster } from "./AppToaster";
import { ExternalLinkGuard } from "./ExternalLinkGuard";
import { useSettings } from "../hooks/useSettings";
import { createCustomV9Theme } from "../v9Theme";
import { resolveAccentColor } from "../accentColor";
import { isCapacitorRuntime } from "../lib/runtimeEnv";
import { setPrivacyScreenEnabled } from "../lib/capacitorSpecial";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { OfflineView } from "./OfflineView";

const toHexColor = (value: string): string | null => {
  const color = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(color) || /^#[0-9a-fA-F]{8}$/.test(color)) {
    return color;
  }

  const rgbMatch = color.match(
    /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i,
  );
  if (!rgbMatch) return null;

  const [r, g, b] = rgbMatch.slice(1, 4).map((part) => Number.parseInt(part, 10));
  if ([r, g, b].some((num) => Number.isNaN(num) || num < 0 || num > 255)) return null;

  return `#${[r, g, b].map((num) => num.toString(16).padStart(2, "0")).join("")}`;
};

export const ThemeSync = (): JSX.Element => {
  const { settings, updateSettings } = useSettings();
  const { i18n } = useTranslation();
  const isOnline = useOnlineStatus();

  useEffect(() => {
    if (settings.companionMode !== "default") return;

    let active = true;
    const testAndSetCompanion = async () => {
      const primaryUrl = "https://companion.tsub4sa.xyz";
      const fallbackUrl = "https://proxy.tsub4sa.xyz";

      try {
        const res = await axios.get(`${primaryUrl}/health`, {
          timeout: 3000,
          validateStatus: () => true,
        });

        if (!active) return;

        if (res.status >= 200 && res.status < 300) {
          if (settings.companionUrl !== primaryUrl) {
            updateSettings({ companionUrl: primaryUrl });
          }
        } else {
          if (settings.companionUrl !== fallbackUrl) {
            updateSettings({ companionUrl: fallbackUrl });
          }
        }
      } catch (err) {
        if (!active) return;
        if (settings.companionUrl !== fallbackUrl) {
          updateSettings({ companionUrl: fallbackUrl });
        }
      }
    };

    void testAndSetCompanion();

    return () => {
      active = false;
    };
  }, [settings.companionMode, settings.companionUrl, updateSettings]);

  const isSystemDark = useMemo(() => {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }, []);

  const isActuallyDark = useMemo(() => {
    return (
      settings.theme === "dark" ||
      settings.theme === "amoled" ||
      (settings.theme === "system" && isSystemDark)
    );
  }, [settings.theme, isSystemDark]);
  const isAmoled = useMemo(() => {
    if (settings.theme === "amoled") return true;
    return settings.amoledEnabled && isActuallyDark;
  }, [settings.theme, settings.amoledEnabled, isActuallyDark]);

  const accentColor = useMemo(() => {
    return resolveAccentColor(settings.accentColor, settings.customAccentColor);
  }, [settings.accentColor, settings.customAccentColor]);

  const v9Theme = useMemo(() => {
    return createCustomV9Theme(isActuallyDark, accentColor, isAmoled);
  }, [isActuallyDark, accentColor, isAmoled]);

  useEffect(() => {
    if (settings.language) {
      void i18n.changeLanguage(settings.language);
    }
  }, [settings.language, i18n]);

  useEffect(() => {
    const root = document.documentElement;
    const radiusMap: Record<string, string> = {
      none: "0px",
      small: "8px",
      medium: "12px",
      large: "18px",
      xlarge: "24px",
    };

    const densityMap: Record<string, string> = {
      compact: "0.9",
      normal: "1",
      comfortable: "1.1",
    };

    root.style.setProperty("--app-radius", radiusMap[settings.cornerRadius] || "18px");
    root.style.setProperty("--thumbnail-radius", `${settings.thumbnailRadius}px`);
    root.style.setProperty("--player-radius", `${settings.playerRadius}px`);
    root.style.setProperty("--app-card-opacity", String(settings.cardOpacity));
    root.style.setProperty("--app-shadow-strength", String(settings.shadowStrength));
    root.style.setProperty("--bottom-nav-opacity", String(settings.bottomNavOpacity));
    root.style.setProperty("--ui-density", densityMap[settings.uiDensity] || "1");
    root.style.setProperty("--content-max-width", `${settings.maxContentWidth}px`);

    root.style.setProperty("--app-accent", accentColor);
    root.style.setProperty("--is-amoled", isAmoled ? "1" : "0");
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta instanceof HTMLMetaElement) {
      themeColorMeta.content = isAmoled ? "#000000" : accentColor;
    }
    const appleStatusBarMeta = document.querySelector(
      'meta[name="apple-mobile-web-app-status-bar-style"]',
    );
    if (appleStatusBarMeta instanceof HTMLMetaElement) {
      appleStatusBarMeta.content = isActuallyDark ? "black-translucent" : "default";
    }

    if (isActuallyDark) {
      root.style.backgroundColor = isAmoled ? "#000000" : "#0f0f10";
      root.style.color = "#ffffff";
    } else {
      root.style.backgroundColor = "#F7F7F8";
      root.style.color = "#1B1E26";
    }
  }, [settings, isSystemDark, isActuallyDark, isAmoled, accentColor]);

  useEffect(() => {
    if (!isCapacitorRuntime()) return;

    let cancelled = false;

    const syncNativeStatusBar = async (): Promise<void> => {
      const themeColorMeta = document.querySelector('meta[name="theme-color"]');
      if (!(themeColorMeta instanceof HTMLMetaElement)) return;

      const color = toHexColor(themeColorMeta.content) ?? toHexColor(accentColor) ?? "#2A8CFF";

      try {
        const { StatusBar, Style } = await import("@capacitor/status-bar");
        if (cancelled) return;

        await StatusBar.setOverlaysWebView({ overlay: false });
        await StatusBar.setBackgroundColor({ color });
        await StatusBar.setStyle({ style: isActuallyDark ? Style.Light : Style.Dark });
      } catch {
        // Ignore when StatusBar plugin is unavailable on current shell.
      }
    };

    void syncNativeStatusBar();

    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (!(themeColorMeta instanceof HTMLMetaElement)) return;

    const observer = new MutationObserver(() => {
      void syncNativeStatusBar();
    });
    observer.observe(themeColorMeta, { attributes: true, attributeFilter: ["content"] });

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [isActuallyDark, accentColor]);

  useEffect(() => {
    if (!isCapacitorRuntime()) return;
    void setPrivacyScreenEnabled(settings.privacyScreenEnabled);
  }, [settings.privacyScreenEnabled]);

  useEffect(() => {
    if (!settings.useLenis) return;

    let destroyed = false;
    let rafId = 0;
    let lenisInstance: { raf: (time: number) => void; destroy: () => void } | null = null;

    const boot = async (): Promise<void> => {
      const wrapper = document.getElementById("app-scroll-container");
      const content = document.getElementById("app-scroll-content");
      if (!(wrapper instanceof HTMLElement) || !(content instanceof HTMLElement)) return;

      const { default: Lenis } = await import("lenis");
      if (destroyed) return;

      const lenis = new Lenis({
        wrapper,
        content,
        duration: settings.animationStrength === "reduced" ? 0.75 : 1.1,
        smoothWheel: true,
        wheelMultiplier: settings.animationStrength === "reduced" ? 0.8 : 1,
        touchMultiplier: 1,
      });

      lenisInstance = lenis;

      const onFrame = (time: number): void => {
        lenis.raf(time);
        rafId = window.requestAnimationFrame(onFrame);
      };

      rafId = window.requestAnimationFrame(onFrame);
    };

    void boot();

    return () => {
      destroyed = true;
      if (rafId) window.cancelAnimationFrame(rafId);
      lenisInstance?.destroy();
    };
  }, [settings.useLenis, settings.animationStrength]);

  return (
    <FluentProvider theme={v9Theme}>
      {isOnline ? <AppRoutes /> : <OfflineView />}
      <ExternalLinkGuard />
      <AppToaster />
    </FluentProvider>
  );
};
