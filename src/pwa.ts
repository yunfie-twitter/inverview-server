import { registerSW } from "virtual:pwa-register";
import { z } from "zod";
import { getStorageJson } from "./lib/browserStorage";
import { resolveLaunchPath } from "./lib/launchIntent";
import { isCapacitorRuntime } from "./lib/runtimeEnv";

interface WindowControlsOverlayLike extends EventTarget {
  visible: boolean;
  getTitlebarAreaRect?: () => DOMRect;
}
let advancedWebApisInitialized = false;
const idleSettingsSchema = z.object({
  backgroundPlaybackEnabled: z.boolean().optional(),
}).passthrough();

export const registerPwaServiceWorker = (): void => {
  if (import.meta.env.DEV) return;
  registerSW({
    immediate: true,
    onRegisteredSW(swUrl, registration) {
      if (!registration) return;
      console.info("[PWA] Service Worker registered:", swUrl);
    },
    onRegisterError(error) {
      console.error("[PWA] Service Worker registration failed:", error);
    },
  });
};

const setupWindowControlsOverlay = (): void => {
  const navigatorWithOverlay = navigator as Navigator & { windowControlsOverlay?: WindowControlsOverlayLike };
  const overlay = navigatorWithOverlay.windowControlsOverlay;
  const root = document.documentElement;
  const isSupported = !!overlay;

  root.dataset.windowControlsOverlaySupport = isSupported ? "supported" : "unsupported";
  if (!overlay) return;

  const applyGeometry = () => {
    const rect = overlay.getTitlebarAreaRect?.();
    const isOverlayDisplayMode = window.matchMedia("(display-mode: window-controls-overlay)").matches;
    const visible = !!overlay.visible && isOverlayDisplayMode;

    root.dataset.windowControlsOverlay = visible ? "visible" : "hidden";
    root.style.setProperty("--titlebar-area-x", `${rect?.x ?? 0}px`);
    root.style.setProperty("--titlebar-area-y", `${rect?.y ?? 0}px`);
    root.style.setProperty("--titlebar-area-width", `${rect?.width ?? 0}px`);
    root.style.setProperty("--titlebar-area-height", `${visible ? rect?.height ?? 0 : 0}px`);
  };

  applyGeometry();
  overlay.addEventListener("geometrychange", applyGeometry);
  window.addEventListener("resize", applyGeometry, { passive: true });
  document.addEventListener("visibilitychange", applyGeometry, { passive: true });
};

const setupLaunchQueue = (): void => {
  const launchQueue = (window as any).launchQueue;
  if (!launchQueue || typeof launchQueue.setConsumer !== "function") return;

  launchQueue.setConsumer((launchParams: any) => {
    const rawTargetUrl = typeof launchParams?.targetURL === "string" ? launchParams.targetURL : "";
    if (!rawTargetUrl) return;

    let parsed: URL | null = null;
    try {
      parsed = new URL(rawTargetUrl);
    } catch {
      return;
    }

    if (!parsed) return;

    if (parsed.origin === window.location.origin) {
      const next = `${parsed.pathname}${parsed.search}`;
      const current = `${window.location.pathname}${window.location.search}`;
      if (next !== current) window.location.assign(next);
      return;
    }

    const nextPath = resolveLaunchPath({ url: parsed.toString() });
    const currentPath = `${window.location.pathname}${window.location.search}`;
    if (nextPath !== currentPath) window.location.assign(nextPath);
  });
};

const setupIdleDetection = async (): Promise<void> => {
  const IdleDetectorClass = (window as any).IdleDetector;
  if (!IdleDetectorClass || !navigator.permissions?.query) {
    if (!isCapacitorRuntime()) return;

    const applyFallbackIdleState = (): void => {
      const isIdle = document.hidden;
      document.documentElement.dataset.idleState = isIdle ? "idle" : "active";

      const { backgroundPlaybackEnabled = true } = getStorageJson("local", "invidious-client-settings", idleSettingsSchema, {});

      if (isIdle && !backgroundPlaybackEnabled) {
        for (const videoElement of document.querySelectorAll("video")) {
          if (!videoElement.paused) videoElement.pause();
        }
      }
    };

    applyFallbackIdleState();
    document.addEventListener("visibilitychange", applyFallbackIdleState, { passive: true });
    return;
  }

  try {
    const permission = await navigator.permissions.query({ name: "idle-detection" as PermissionName });
    if (permission.state !== "granted") return;

    const detector = new IdleDetectorClass();
    detector.addEventListener("change", () => {
      const isIdle = detector.userState === "idle" || detector.screenState === "locked";
      document.documentElement.dataset.idleState = isIdle ? "idle" : "active";
      if (isIdle) {
        for (const videoElement of document.querySelectorAll("video")) {
          if (!videoElement.paused) videoElement.pause();
        }
      }
    });

    await detector.start({ threshold: 60_000 });
  } catch {
    // Ignore permission errors and unsupported environments.
  }
};

const setupPageVisibility = (): void => {
  const root = document.documentElement;

  const applyVisibility = () => {
    const hidden = document.hidden;
    root.dataset.pageVisibility = hidden ? "hidden" : "visible";

    if (hidden) {
      window.dispatchEvent(new Event("inverview:page-hidden"));
      return;
    }

    window.dispatchEvent(new Event("inverview:page-visible"));
  };

  applyVisibility();
  document.addEventListener("visibilitychange", applyVisibility, { passive: true });
};

const setupNetworkAwareness = (): void => {
  const root = document.documentElement;
  const nav = navigator as Navigator & {
    connection?: { effectiveType?: string; saveData?: boolean; addEventListener?: (type: string, listener: EventListener) => void };
  };

  const applyNetworkState = () => {
    root.dataset.networkStatus = navigator.onLine ? "online" : "offline";
    root.dataset.networkType = nav.connection?.effectiveType || "unknown";
    root.dataset.networkSaveData = nav.connection?.saveData ? "on" : "off";
  };

  applyNetworkState();
  window.addEventListener("online", applyNetworkState, { passive: true });
  window.addEventListener("offline", applyNetworkState, { passive: true });
  nav.connection?.addEventListener?.("change", applyNetworkState as EventListener);
};

const setupWakeLockForPlayback = (): void => {
  const root = document.documentElement;
  const nav = navigator as Navigator & {
    wakeLock?: {
      request: (type: "screen") => Promise<{ released: boolean; release: () => Promise<void> }>;
    };
  };

  if (!nav.wakeLock?.request) return;

  let sentinel: { released: boolean; release: () => Promise<void> } | null = null;
  const hasActiveVideo = (): boolean =>
    Array.from(document.querySelectorAll("video")).some((video) => !video.paused && !video.ended);

  const syncWakeLock = async (): Promise<void> => {
    const shouldHold = document.visibilityState === "visible" && hasActiveVideo();
    if (shouldHold) {
      if (sentinel && !sentinel.released) return;
      try {
        sentinel = await nav.wakeLock.request("screen");
        root.dataset.wakeLock = "active";
      } catch {
        root.dataset.wakeLock = "failed";
      }
      return;
    }

    if (sentinel && !sentinel.released) {
      try {
        await sentinel.release();
      } catch {
        // no-op
      }
    }
    sentinel = null;
    root.dataset.wakeLock = "idle";
  };

  document.addEventListener("visibilitychange", () => {
    void syncWakeLock();
  });
  document.addEventListener("play", () => void syncWakeLock(), true);
  document.addEventListener("pause", () => void syncWakeLock(), true);
  document.addEventListener("ended", () => void syncWakeLock(), true);
  void syncWakeLock();
};

export const setupAdvancedWebApis = (): void => {
  if (advancedWebApisInitialized) return;
  advancedWebApisInitialized = true;
  document.documentElement.dataset.runtimeShell = isCapacitorRuntime() ? "capacitor" : "web";
  setupPageVisibility();
  setupWindowControlsOverlay();
  setupLaunchQueue();
  setupNetworkAwareness();
  setupWakeLockForPlayback();
  void setupIdleDetection();
};
