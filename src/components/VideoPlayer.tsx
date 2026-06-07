import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Text,
  Link,
  Button,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import screenfull from "screenfull";
import { useTranslation } from "react-i18next";
import type { VideoDetails } from "../types/invidious";
import { pickPlayableStream, pickPosterThumbnail, resolveCompanionVideoPlaybackUrl, resolveMediaUrl } from "../lib/media";
import { togglePictureInPicture, vibrate } from "../lib/webPlatform";
import { useSettingsStore } from "../store/settingsStore";
import { notifyError } from "../lib/notifications";
import { setNativeNowPlaying, setNativePlaybackState } from "../lib/nativePlayback";
import { isCapacitorRuntime } from "../lib/runtimeEnv";
import {
  clearBackgroundPlaybackNotification,
  showBackgroundPlaybackNotification,
} from "../lib/capacitorSpecial";
import { parseJsonUnknown } from "../lib/safeJson";
import { getServerRuntimeInfo, isSameOriginOrRelativeUrl } from "../lib/serverRuntime";

type ShakaRuntime = typeof import("shaka-player/dist/shaka-player.ui.js").default;
type HlsRuntime = typeof import("hls.js").default;

let playerRuntimePromise: Promise<{ shaka: ShakaRuntime; Hls: HlsRuntime }> | null = null;

const loadPlayerRuntime = async (): Promise<{ shaka: ShakaRuntime; Hls: HlsRuntime }> => {
  if (playerRuntimePromise) return playerRuntimePromise;
  playerRuntimePromise = (async () => {
    const [shakaModule, hlsModule] = await Promise.all([
      import("shaka-player/dist/shaka-player.ui.js"),
      import("hls.js"),
      import("shaka-player/dist/controls.css"),
    ]);
    return { shaka: shakaModule.default, Hls: hlsModule.default };
  })();
  return playerRuntimePromise;
};

const TAB_INACTIVE_DISABLE_DELAY_MS = 30_000;

const normalizeAudioLanguage = (language: string | undefined): string => {
  const normalized = language?.trim();
  return normalized && normalized !== "auto" ? normalized : "";
};

const applyPreferredAudioLanguage = (player: any, language: string | undefined): void => {
  const preferredLanguage = normalizeAudioLanguage(language);
  if (!player || !preferredLanguage) return;

  try {
    player.configure?.({ preferredAudioLanguage: preferredLanguage });
    player.selectAudioLanguage?.(preferredLanguage);
  } catch (error) {
    console.warn("Failed to apply preferred audio language:", error);
  }
};

interface PlayerCacheEntry {
  videoId: string;
  activeInstanceId: string;
  wrapperElement: HTMLDivElement;
  videoElement: HTMLVideoElement;
  shakaPlayer: any;
  hlsPlayer: any;
  shakaUi: any;
  cleanupTimer: number | null;
  volume: number;
  muted: boolean;
  isPlaying: boolean;
  isTeleporting?: boolean;
  teleportRenderTimer1?: number | null;
  teleportRenderTimer2?: number | null;
  onPositionChange?: (seconds: number) => void;
  onEnded?: () => void;
  onPlay?: () => void;
  onVolumeChange?: () => void;
  globalCleanup?: () => void;
}

let globalPlayerCache: PlayerCacheEntry | null = null;

let globalVideoHost: HTMLDivElement | null = null;
let syncFrameId: number | null = null;

const injectGlobalStyles = () => {
  if (document.getElementById("inverview-global-video-styles")) return;
  const style = document.createElement("style");
  style.id = "inverview-global-video-styles";
  style.innerHTML = `
    .inverview-mini-mode .shaka-controls-container,
    .inverview-mini-mode .shaka-spinner-container,
    .inverview-mini-mode .shaka-ad-controls {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
      pointer-events: none !important;
    }
    .inverview-mini-mode .shaka-video-container {
      cursor: default !important;
    }
  `;
  document.head.appendChild(style);
};

const applyPosition = (rect: DOMRect, isMini: boolean) => {
  if (!globalVideoHost) return;
  globalVideoHost.style.top = `${rect.top}px`;
  globalVideoHost.style.left = `${rect.left}px`;
  globalVideoHost.style.width = `${rect.width}px`;
  globalVideoHost.style.height = `${rect.height}px`;
  // globalVideoHost itself is pointer-events:none so touch events pass through for swipe detection.
  // Only the inner wrapperElement receives pointer events (for Shaka UI controls in normal mode).
  globalVideoHost.style.pointerEvents = "none";
  globalVideoHost.style.zIndex = isMini ? "46" : "10";
  const wrapper = globalVideoHost.firstElementChild as HTMLElement | null;
  if (wrapper) {
    wrapper.style.pointerEvents = isMini ? "none" : "auto";
  }
  (globalVideoHost as any)._prevRect = rect;
};

// Track normal and mini containers separately. Normal always wins over mini.
let normalPlayerContainer: HTMLDivElement | null = null;
let miniPlayerContainer: HTMLDivElement | null = null;

const getEffectiveContainer = (): { container: HTMLDivElement; isMini: boolean } | null => {
  if (normalPlayerContainer) return { container: normalPlayerContainer, isMini: false };
  if (miniPlayerContainer) return { container: miniPlayerContainer, isMini: true };
  return null;
};

const syncPosition = () => {
  if (!globalVideoHost) return;
  const effective = getEffectiveContainer();
  if (!effective) return;
  const { container, isMini } = effective;
  const rect = container.getBoundingClientRect();
  const prev = (globalVideoHost as any)._prevRect;
  if (
    prev &&
    prev.top === rect.top &&
    prev.left === rect.left &&
    prev.width === rect.width &&
    prev.height === rect.height &&
    prev.isMini === isMini
  ) {
    return;
  }
  applyPosition(rect, isMini);
  (globalVideoHost as any)._prevRect = { ...rect, isMini };
};

const ensureSyncLoop = () => {
  if (syncFrameId) return;
  const loop = () => {
    syncPosition();
    syncFrameId = requestAnimationFrame(loop);
  };
  syncFrameId = requestAnimationFrame(loop);
};

const startSync = (container: HTMLDivElement, isMini: boolean) => {
  if (isMini) {
    miniPlayerContainer = container;
  } else {
    normalPlayerContainer = container;
  }
  // Apply immediately without waiting for next RAF frame
  if (globalVideoHost) {
    const effective = getEffectiveContainer();
    if (effective) {
      const rect = effective.container.getBoundingClientRect();
      applyPosition(rect, effective.isMini);
    }
  }
  ensureSyncLoop();
};

const stopSync = (container: HTMLDivElement, isMini: boolean) => {
  if (isMini) {
    if (miniPlayerContainer === container) miniPlayerContainer = null;
  } else {
    if (normalPlayerContainer === container) normalPlayerContainer = null;
  }
  // If both are gone, stop RAF and hide overlay
  if (!normalPlayerContainer && !miniPlayerContainer) {
    if (syncFrameId) {
      cancelAnimationFrame(syncFrameId);
      syncFrameId = null;
    }
    if (globalVideoHost) {
      globalVideoHost.style.top = "-9999px";
      globalVideoHost.style.left = "-9999px";
    }
  } else {
    // If normal stopped, immediately re-apply for mini (or vice versa)
    if (globalVideoHost) {
      const effective = getEffectiveContainer();
      if (effective) {
        const rect = effective.container.getBoundingClientRect();
        applyPosition(rect, effective.isMini);
      }
    }
  }
};



const destroyCachedPlayer = (cache: PlayerCacheEntry) => {
  if (!cache) return;
  if (cache.cleanupTimer) {
    clearTimeout(cache.cleanupTimer);
  }
  if (cache.teleportRenderTimer1) {
    clearTimeout(cache.teleportRenderTimer1);
  }
  if (cache.teleportRenderTimer2) {
    clearTimeout(cache.teleportRenderTimer2);
  }

  if (cache.globalCleanup) {
    try { cache.globalCleanup(); } catch (e) { console.error("Error executing globalCleanup:", e); }
  }

  const { wrapperElement, videoElement, shakaPlayer, hlsPlayer, shakaUi } = cache;

  if (videoElement) {
    videoElement.pause();
    videoElement.removeAttribute("src");
    videoElement.load();
    if (cache.onVolumeChange) {
      videoElement.removeEventListener("volumechange", cache.onVolumeChange);
    }
  }

  if (shakaUi) {
    try { shakaUi.destroy(); } catch (e) { console.error("Error destroying shakaUi:", e); }
  }
  if (shakaPlayer) {
    try { shakaPlayer.destroy(); } catch (e) { console.error("Error destroying shakaPlayer:", e); }
  }
  if (hlsPlayer) {
    try { hlsPlayer.destroy(); } catch (e) { console.error("Error destroying hlsPlayer:", e); }
  }

  if (wrapperElement) {
    try { wrapperElement.remove(); } catch (e) { console.error("Error removing wrapperElement:", e); }
  }
  if (globalVideoHost && globalVideoHost.firstChild === wrapperElement) {
    globalVideoHost.innerHTML = "";
  }

  if (globalPlayerCache === cache) {
    globalPlayerCache = null;
  }
};

interface VideoPlayerProps {
  video: VideoDetails;
  baseUrl: string;
  initialPositionSeconds?: number;
  externalSeekSeconds?: number | null;
  onPositionChange?: (seconds: number) => void;
  onPlay?: () => void;
  onEnded?: () => void;
  autoplay?: boolean;
  isShorts?: boolean;
  miniMode?: boolean;
}

const useStyles = makeStyles({
  container: {
    padding: "0",
    display: "flex",
    flexDirection: "column",
    gap: "0",
    overflow: "visible",
    borderRadius: "var(--player-radius)",
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    "@media (max-width: 767px)": {
      borderTopLeftRadius: "0",
      borderTopRightRadius: "0",
    },
  },
  surfaceWrap: {
    position: "relative",
    width: "100%",
    backgroundColor: "black",
    zIndex: 0,
  },
  videoContainer: {
    width: "100%",
    height: "100%",
    overflow: "hidden",
  },
  miniVideoContainer: {
    width: "100%",
    height: "100%",
    overflow: "hidden",
    "& .shaka-controls-container, & .shaka-spinner-container, & .shaka-ad-controls": {
      display: "none !important",
      visibility: "hidden !important" as any,
      opacity: "0 !important" as any,
      pointerEvents: "none !important" as any,
    },
    "& .shaka-video-container": {
      cursor: "default !important",
    },
  },
  contentArea: {
    padding: "12px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  audioOnlyWrap: {
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: "8px",
    padding: "16px",
    margin: "12px",
  },
  errorText: {
    color: tokens.colorPalettePumpkinForeground2,
    fontWeight: tokens.fontWeightBold,
  },
  embedWrap: {
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: "8px",
    overflow: "hidden",
    aspectRatio: "16 / 9",
  },
  linkRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "12px",
  },
});

export const VideoPlayer = ({
  video,
  baseUrl,
  initialPositionSeconds,
  externalSeekSeconds,
  onPositionChange,
  onPlay,
  onEnded,
  autoplay: autoplayProp,
  isShorts,
  miniMode = false,
}: VideoPlayerProps): JSX.Element => {
  const styles = useStyles();
  const { t } = useTranslation();
  const instanceId = useRef(Math.random().toString(36).substring(2)).current;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const onPositionChangeRef = useRef(onPositionChange);
  const onEndedRef = useRef(onEnded);
  const onPlayRef = useRef(onPlay);
  const hiddenTimerRef = useRef<number | null>(null);
  const [playbackError, setPlaybackError] = useState<string>("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cinematicGlowColor, setCinematicGlowColor] = useState("rgba(0, 0, 0, 0)");
  const [isWorkerRuntime, setIsWorkerRuntime] = useState(false);
  const [isTabActiveForGlow, setIsTabActiveForGlow] = useState(true);
  const shouldKeepPlayingInBackgroundRef = useRef(false);

  useEffect(() => {
    onPositionChangeRef.current = onPositionChange;
    if (globalPlayerCache && globalPlayerCache.videoId === video.videoId) {
      globalPlayerCache.onPositionChange = onPositionChange;
    }
  }, [onPositionChange, video.videoId]);

  useEffect(() => {
    onEndedRef.current = onEnded;
    if (globalPlayerCache && globalPlayerCache.videoId === video.videoId) {
      globalPlayerCache.onEnded = onEnded;
    }
  }, [onEnded, video.videoId]);

  useEffect(() => {
    onPlayRef.current = onPlay;
    if (globalPlayerCache && globalPlayerCache.videoId === video.videoId) {
      globalPlayerCache.onPlay = onPlay;
    }
  }, [onPlay, video.videoId]);

  const settingsAutoplay = useSettingsStore((state) => state.autoplay);
  const autoplay = autoplayProp ?? settingsAutoplay;
  const isLiveLike = !!video.liveNow || !!video.isUpcoming;
  const loopVideo = useSettingsStore((state) => state.loopVideo);
  const quality = useSettingsStore((state) => state.quality);
  const audioTrackLanguage = useSettingsStore((state) => state.audioTrackLanguage);
  const audioOnly = useSettingsStore((state) => state.audioOnly);
  const dataSaver = useSettingsStore((state) => state.dataSaver);
  const companionUrl = useSettingsStore((state) => state.companionUrl);
  const useProxyVideo = useSettingsStore((state) => state.useProxyVideo);
  const hapticFeedback = useSettingsStore((state) => state.hapticFeedback);
  const cinematicLighting = useSettingsStore((state) => state.cinematicLighting);
  const pictureInPictureEnabled = useSettingsStore((state) => state.pictureInPictureEnabled);
  const autoEnterPipOnBackground = useSettingsStore((state) => state.autoEnterPipOnBackground);
  const backgroundPlaybackEnabled = useSettingsStore((state) => state.backgroundPlaybackEnabled);
  const androidMediaNotificationEnabled = useSettingsStore((state) => state.androidMediaNotificationEnabled);
  const theme = useSettingsStore((state) => state.theme);
  const volume = useSettingsStore((state) => state.volume);
  const muted = useSettingsStore((state) => state.muted);
  const setVolume = useSettingsStore((state) => state.setVolume);
  const setMuted = useSettingsStore((state) => state.setMuted);

  useEffect(() => {
    let cancelled = false;
    void getServerRuntimeInfo().then((info) => {
      if (!cancelled) setIsWorkerRuntime(info?.runtime === "cloudflare-worker");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const shouldUseCompanionProxy = useProxyVideo && !(isWorkerRuntime && isSameOriginOrRelativeUrl(companionUrl));
  const effectiveCompanionUrl = shouldUseCompanionProxy ? companionUrl : "";

  const stream = useMemo(
    () =>
      pickPlayableStream(
        video.formatStreams?.map((item) => ({
          ...item,
          url: resolveMediaUrl(resolveCompanionVideoPlaybackUrl(item.url, useProxyVideo ? companionUrl : ""), baseUrl),
        })),
        { quality, dataSaver, audioOnly },
      ),
    [video.formatStreams, baseUrl, quality, dataSaver, audioOnly, useProxyVideo, companionUrl],
  );

  const dashUrl = useMemo(() => {
    if (effectiveCompanionUrl) {
      let cleanBase = effectiveCompanionUrl.replace(/\/+$/, "");
      if (cleanBase.endsWith("/companion")) {
        cleanBase = cleanBase.substring(0, cleanBase.length - 10);
      }
      return `${cleanBase}/companion/api/manifest/dash/id/${video.videoId}?local=true`;
    }
    return resolveMediaUrl(video.dashUrl, baseUrl);
  }, [effectiveCompanionUrl, video.dashUrl, video.videoId, baseUrl]);

  const hlsUrl = resolveMediaUrl(video.hlsUrl, baseUrl);

  const isIOS = useMemo(() => {
    const ua = navigator.userAgent;
    return /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && navigator.maxTouchPoints > 1);
  }, []);

  const manifestUrl = useMemo(() => {
    if (isLiveLike && hlsUrl) return hlsUrl;
    // iOS Safari prefers HLS and often fails with DASH via MSE
    if (isIOS && hlsUrl) return hlsUrl;
    return dashUrl || hlsUrl || stream?.url;
  }, [isLiveLike, isIOS, dashUrl, hlsUrl, stream?.url]);

  const poster = resolveMediaUrl(pickPosterThumbnail(video.videoThumbnails)?.url, baseUrl);
  const embedUrl = baseUrl
    ? `${baseUrl.replace(/\/+$/, "")}/embed/${video.videoId}`
    : `https://www.youtube-nocookie.com/embed/${video.videoId}`;
  const prefersDark = typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDarkTheme = theme === "dark" || (theme === "system" && prefersDark);
  const cinematicLightingEnabled = cinematicLighting && isDarkTheme && isTabActiveForGlow && !audioOnly;

  useEffect(() => {
    if (!globalPlayerCache || globalPlayerCache.videoId !== video.videoId) return;
    applyPreferredAudioLanguage(globalPlayerCache.shakaPlayer, audioTrackLanguage);
  }, [audioTrackLanguage, video.videoId]);

  // When miniMode changes, immediately re-sync the overlay position and mode
  // Use useLayoutEffect so it runs synchronously after DOM update, before paint
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || !globalPlayerCache || globalPlayerCache.videoId !== video.videoId) return;
    container.dataset.minimode = miniMode ? "true" : "false";
    if (miniMode) {
      globalPlayerCache.wrapperElement.classList.add("inverview-mini-mode");
    } else {
      globalPlayerCache.wrapperElement.classList.remove("inverview-mini-mode");
    }
    startSync(container, miniMode);
  }, [miniMode, video.videoId]);

  useEffect(() => {
    if (miniMode) return;
    if (!playbackError) return;
    notifyError(playbackError);
  }, [playbackError, miniMode]);

  useEffect(() => {
    const onVisibilityChange = (): void => {
      if (document.visibilityState === "visible") {
        if (hiddenTimerRef.current) {
          window.clearTimeout(hiddenTimerRef.current);
          hiddenTimerRef.current = null;
        }
        setIsTabActiveForGlow(true);
        return;
      }

      if (hiddenTimerRef.current) return;
      hiddenTimerRef.current = window.setTimeout(() => {
        setIsTabActiveForGlow(false);
        hiddenTimerRef.current = null;
      }, TAB_INACTIVE_DISABLE_DELAY_MS);
    };

    onVisibilityChange();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      if (hiddenTimerRef.current) {
        window.clearTimeout(hiddenTimerRef.current);
        hiddenTimerRef.current = null;
      }
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement || !cinematicLightingEnabled) {
      setCinematicGlowColor("rgba(0, 0, 0, 0)");
      return;
    }

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    let cancelled = false;
    let hasSampledColor = false;
    const fallbackGlow =
      getComputedStyle(document.documentElement).getPropertyValue("--app-accent").trim() || "rgba(42, 140, 255, 0.45)";
    const sampleFrame = (): void => {
      if (cancelled || videoElement.paused || videoElement.ended || videoElement.readyState < 2) return;
      try {
        const sampleSize = 24;
        canvas.width = sampleSize;
        canvas.height = sampleSize;
        ctx.drawImage(videoElement, 0, 0, sampleSize, sampleSize);
        const { data } = ctx.getImageData(0, 0, sampleSize, sampleSize);
        let r = 0;
        let g = 0;
        let b = 0;
        let count = 0;
        for (let i = 0; i < data.length; i += 4) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          count += 1;
        }
        if (count > 0) {
          const avgR = Math.round(r / count);
          const avgG = Math.round(g / count);
          const avgB = Math.round(b / count);
          setCinematicGlowColor(`rgba(${avgR}, ${avgG}, ${avgB}, 0.45)`);
          hasSampledColor = true;
        }
      } catch {
        if (!hasSampledColor) {
          setCinematicGlowColor(fallbackGlow);
        }
      }
    };

    setCinematicGlowColor(fallbackGlow);
    sampleFrame();
    const intervalId = window.setInterval(sampleFrame, 500);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [video.videoId, cinematicLightingEnabled]);

  useEffect(() => {
    if (!isCapacitorRuntime()) return;

    const onVisibilityChange = () => {
      const videoElement = videoRef.current;
      if (!videoElement) return;

      if (document.visibilityState === "hidden") {
        shouldKeepPlayingInBackgroundRef.current = backgroundPlaybackEnabled && !videoElement.paused && !videoElement.ended;
        if (!shouldKeepPlayingInBackgroundRef.current) return;
        void showBackgroundPlaybackNotification(video.title, video.author || "InverView");

        window.setTimeout(() => {
          const latestVideo = videoRef.current;
          if (!latestVideo || document.visibilityState !== "hidden") return;
          if (!backgroundPlaybackEnabled) return;
          if (!latestVideo.paused || latestVideo.ended) return;
          void latestVideo.play().catch(() => {
            // Some devices/webviews still block background resume.
          });
        }, 180);
        return;
      }

      shouldKeepPlayingInBackgroundRef.current = false;
      void clearBackgroundPlaybackNotification();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      void clearBackgroundPlaybackNotification();
    };
  }, [backgroundPlaybackEnabled, video.title, video.author]);

  useEffect(() => {
    if (!containerRef.current) return;

    let isCancelled = false;
    let player: any = null;
    let hlsPlayer: any = null;
    let ui: any = null;
    let videoElement: HTMLVideoElement | null = null;
    let onTimeUpdate: (() => void) | null = null;
    let onVideoEnded: (() => void) | null = null;
    let onPlay: (() => void) | null = null;
    let onPause: (() => void) | null = null;
    let onVolumeChange: (() => void) | null = null;
    const canUseMediaSession = typeof navigator !== "undefined" && "mediaSession" in navigator;

    setPlaybackError("");

    let isUsingCache = false;
    let wasPlaying = false;

    // Helper to register global handlers on the video element/media session
    // This is coupled to the player lifecycle, NOT the react component instance.
    const setupGlobalResources = (vidEl: HTMLVideoElement) => {
      const onTogglePip = () => {
        if (!pictureInPictureEnabled) return;
        void togglePictureInPicture(vidEl);
      };
      const onToggleFullscreen = () => {
        if (!containerRef.current || !screenfull.isEnabled) return;
        void screenfull.toggle(containerRef.current);
      };
      const onNativeMediaControl = (event: Event) => {
        const customEvent = event as CustomEvent<{ command?: string } | string>;
        const detail = customEvent.detail;
        let command: string | undefined;
        if (typeof detail === "string") {
          const parsed = parseJsonUnknown(detail);
          if (typeof parsed === "object" && parsed !== null && "command" in parsed) {
            const parsedCommand = parsed.command;
            command = typeof parsedCommand === "string" ? parsedCommand : undefined;
          }
        } else {
          command = detail?.command;
        }
        if (command === "play") {
          void vidEl.play().catch(() => {});
          return;
        }
        if (command === "pause") {
          vidEl.pause();
        }
      };
      window.addEventListener("inverview:toggle-pip", onTogglePip as EventListener);
      window.addEventListener("inverview:toggle-fullscreen", onToggleFullscreen as EventListener);
      window.addEventListener("inverview:native-media-control", onNativeMediaControl as EventListener);

      const onFullscreenChange = () => {
        setIsFullscreen(screenfull.isEnabled ? screenfull.isFullscreen : false);
      };
      if (screenfull.isEnabled) {
        screenfull.on("change", onFullscreenChange);
      }

      if (canUseMediaSession) {
        const artwork = poster
          ? [
              { src: poster, sizes: "96x96", type: "image/jpeg" },
              { src: poster, sizes: "128x128", type: "image/jpeg" },
              { src: poster, sizes: "192x192", type: "image/jpeg" },
              { src: poster, sizes: "256x256", type: "image/jpeg" },
              { src: poster, sizes: "384x384", type: "image/jpeg" },
              { src: poster, sizes: "512x512", type: "image/jpeg" },
            ]
          : undefined;

        navigator.mediaSession.metadata = new MediaMetadata({
          title: video.title,
          artist: video.author,
          album: "InverView",
          artwork,
        });
        navigator.mediaSession.playbackState = vidEl.paused ? "paused" : "playing";
        navigator.mediaSession.setActionHandler("play", async () => {
          await vidEl.play();
        });
        navigator.mediaSession.setActionHandler("pause", () => {
          vidEl.pause();
        });
        if (!isLiveLike) {
          navigator.mediaSession.setActionHandler("seekbackward", (details) => {
            const seekOffset = details.seekOffset ?? 10;
            vidEl.currentTime = Math.max(vidEl.currentTime - seekOffset, 0);
          });
          navigator.mediaSession.setActionHandler("seekforward", (details) => {
            const seekOffset = details.seekOffset ?? 10;
            vidEl.currentTime = Math.min(
              vidEl.currentTime + seekOffset,
              Number.isFinite(vidEl.duration) ? vidEl.duration : vidEl.currentTime + seekOffset,
            );
          });
          navigator.mediaSession.setActionHandler("seekto", (details) => {
            if (typeof details.seekTime === "number") {
              vidEl.currentTime = details.seekTime;
            }
          });
        } else {
          navigator.mediaSession.setActionHandler("seekbackward", null);
          navigator.mediaSession.setActionHandler("seekforward", null);
          navigator.mediaSession.setActionHandler("seekto", null);
        }
        try {
          navigator.mediaSession.setActionHandler("enterpictureinpicture" as MediaSessionAction, async () => {
            await togglePictureInPicture(vidEl);
          });
        } catch {
          // unsupported action name
        }
      }

      return () => {
        window.removeEventListener("inverview:toggle-pip", onTogglePip as EventListener);
        window.removeEventListener("inverview:toggle-fullscreen", onToggleFullscreen as EventListener);
        window.removeEventListener("inverview:native-media-control", onNativeMediaControl as EventListener);
        if (screenfull.isEnabled) {
          screenfull.off("change", onFullscreenChange);
        }
        if (canUseMediaSession) {
          navigator.mediaSession.setActionHandler("play", null);
          navigator.mediaSession.setActionHandler("pause", null);
          navigator.mediaSession.setActionHandler("seekbackward", null);
          navigator.mediaSession.setActionHandler("seekforward", null);
          navigator.mediaSession.setActionHandler("seekto", null);
          try {
            navigator.mediaSession.setActionHandler("enterpictureinpicture" as MediaSessionAction, null);
          } catch {
            // unsupported action name
          }
        }
        void setNativePlaybackState(false, false, backgroundPlaybackEnabled);
        void setNativeNowPlaying({ enabled: false });
      };
    };

    // Check if we can reuse the cached player
    if (globalPlayerCache && globalPlayerCache.videoId === video.videoId) {
      if (globalPlayerCache.cleanupTimer) {
        clearTimeout(globalPlayerCache.cleanupTimer);
        globalPlayerCache.cleanupTimer = null;
      }

      // Claim ownership of the cache
      globalPlayerCache.activeInstanceId = instanceId;

      // Sync callbacks with the newest props
      globalPlayerCache.onPositionChange = onPositionChangeRef.current;
      globalPlayerCache.onEnded = onEndedRef.current;
      globalPlayerCache.onPlay = onPlayRef.current;

      videoElement = globalPlayerCache.videoElement;
      wasPlaying = globalPlayerCache.isPlaying;

      // Teleport the wrapperElement to the global host instead of current container
      if (!globalVideoHost) {
        injectGlobalStyles();
        globalVideoHost = document.createElement("div");
        globalVideoHost.id = "inverview-global-video-host";
        globalVideoHost.style.position = "fixed";
        globalVideoHost.style.pointerEvents = "none"; // start as none, applyPosition will set correctly
        globalVideoHost.style.overflow = "hidden";
        globalVideoHost.style.transition = "none";
        document.body.appendChild(globalVideoHost);
      }
      if (miniMode) {
        globalPlayerCache.wrapperElement.classList.add("inverview-mini-mode");
      } else {
        globalPlayerCache.wrapperElement.classList.remove("inverview-mini-mode");
      }
      if (globalVideoHost.firstChild !== globalPlayerCache.wrapperElement) {
        globalVideoHost.innerHTML = "";
        globalVideoHost.appendChild(globalPlayerCache.wrapperElement);
      }
      containerRef.current.dataset.minimode = miniMode ? "true" : "false";
      startSync(containerRef.current, miniMode);

      videoRef.current = videoElement;
      player = globalPlayerCache.shakaPlayer;
      hlsPlayer = globalPlayerCache.hlsPlayer;
      ui = globalPlayerCache.shakaUi;

      // Re-attach global resources with the newest props (skip for miniMode to avoid double event listeners)
      if (!miniMode) {
        if (globalPlayerCache.globalCleanup) {
          try { globalPlayerCache.globalCleanup(); } catch (e) {}
        }
        const cleanup = setupGlobalResources(videoElement);
        globalPlayerCache.globalCleanup = cleanup;
      }

      // Restore playback only in normal mode (miniMode just follows the existing play state)
      if (!miniMode && (wasPlaying || autoplay)) {
        globalPlayerCache.isPlaying = true;
        globalPlayerCache.isTeleporting = true;
        let attempts = 0;
        const playVideo = () => {
          if (!videoElement) return;
          if (videoElement.paused) {
            videoElement.play()
              .then(() => {
                console.log("Cached play restore succeeded on attempt:", attempts);

                try {
                  if (ui) ui.configure({});
                } catch (uiErr) {}
                window.dispatchEvent(new Event("resize"));
              })
              .catch((err) => {
                console.warn(`Cached play restore attempt ${attempts} failed:`, err);
                if (attempts < 6 && videoElement.paused) {
                  attempts++;
                  const delay = attempts === 1 ? 50 : attempts === 2 ? 150 : attempts === 3 ? 300 : 500;
                  setTimeout(playVideo, delay);
                } else {
                  if (globalPlayerCache && globalPlayerCache.activeInstanceId === instanceId) {
                    globalPlayerCache.isTeleporting = false;
                  }
                }
              });
          } else {
            globalPlayerCache.isTeleporting = false;
          }
        };
        playVideo();
      } else {
        globalPlayerCache.isTeleporting = false;
      }

      // Trigger window resize to fix Shaka UI layout issues after switching modes
      if (!miniMode) {
        setTimeout(() => {
          window.dispatchEvent(new Event("resize"));
        }, 50);
      }

      isUsingCache = true;
    } else {
      // Destroy stale cache if any
      if (globalPlayerCache) {
        destroyCachedPlayer(globalPlayerCache);
      }

      containerRef.current.innerHTML = "";

      const wrapper = document.createElement("div");
      wrapper.style.width = "100%";
      wrapper.style.height = "100%";
      wrapper.style.position = "relative";
      wrapper.style.overflow = "hidden";

      videoElement = document.createElement("video");
      videoElement.style.width = "100%";
      videoElement.style.height = "100%";
      videoElement.poster = poster;
      videoElement.autoplay = autoplay;
      videoElement.loop = loopVideo && !isLiveLike;
      videoElement.playsInline = true;
      videoElement.volume = volume;
      videoElement.muted = muted;

      wrapper.appendChild(videoElement);
      if (!globalVideoHost) {
        injectGlobalStyles();
        globalVideoHost = document.createElement("div");
        globalVideoHost.id = "inverview-global-video-host";
        globalVideoHost.style.position = "fixed";
        globalVideoHost.style.pointerEvents = "none"; // start as none, applyPosition will set correctly
        globalVideoHost.style.overflow = "hidden";
        globalVideoHost.style.transition = "none";
        document.body.appendChild(globalVideoHost);
      }
      if (miniMode) {
        wrapper.classList.add("inverview-mini-mode");
      }
      globalVideoHost.innerHTML = "";
      globalVideoHost.appendChild(wrapper);
      containerRef.current.dataset.minimode = miniMode ? "true" : "false";
      startSync(containerRef.current, miniMode);

      videoRef.current = videoElement;
    }

    const initPlayer = async () => {
      if (isUsingCache) return;

      const { shaka, Hls } = await loadPlayerRuntime();
      if (isCancelled || !videoElement || !containerRef.current) return;

      const wrapperElement = videoElement.parentElement as HTMLDivElement;
      if (!wrapperElement) return;

      const enableHlsFallback = (): boolean => {
        if (!hlsUrl || !videoElement) return false;

        if (videoElement.canPlayType("application/vnd.apple.mpegurl")) {
          videoElement.src = hlsUrl;
          if (autoplay) {
            void videoElement.play().catch(() => {});
          }
          return true;
        }

        if (!Hls.isSupported()) return false;
        hlsPlayer = new Hls({ enableWorker: true, lowLatencyMode: true });
        hlsPlayer.loadSource(hlsUrl);
        hlsPlayer.attachMedia(videoElement);
        if (autoplay) {
          void videoElement.play().catch(() => {});
        }
        return true;
      };

      try {
        shaka.polyfill.installAll();
        if (!shaka.Player.isBrowserSupported()) {
          if (!isCancelled) setPlaybackError("このブラウザは Shaka Player をサポートしていません。");
          return;
        }

        player = new shaka.Player();
        if (normalizeAudioLanguage(audioTrackLanguage)) {
          player.configure({ preferredAudioLanguage: normalizeAudioLanguage(audioTrackLanguage) });
        }
        await player.attach(videoElement);
        if (isCancelled) return;

        ui = new (shaka as any).ui.Overlay(player, wrapperElement, videoElement);
        const accentColor = getComputedStyle(document.documentElement)
          .getPropertyValue("--app-accent")
          .trim() || "#2a8cff";

        const uiConfig = {
          seekBarColors: {
            base: 'rgba(255, 255, 255, 0.3)',
            buffered: 'rgba(255, 255, 255, 0.5)',
            played: accentColor,
          },
          volumeBarColors: {
            base: 'rgba(255, 255, 255, 0.3)',
            level: accentColor,
          }
        };
        ui.configure(uiConfig);

        if (videoElement) {
          videoElement.controls = false;
        }

        player.addEventListener("error", (event: any) => {
          const isCacheActive = globalPlayerCache && globalPlayerCache.videoId === video.videoId && !globalPlayerCache.cleanupTimer;
          const isTeleporting = globalPlayerCache && globalPlayerCache.isTeleporting;

          if (isCancelled && !isCacheActive) return;
          if (isTeleporting) {
            console.warn("Shaka Error ignored during teleport:", event.detail);
            return;
          }
          const error = event.detail;
          if (error.code === shaka.util.Error.Code.LOAD_INTERRUPTED) return;
          console.error("Shaka Error:", error);
          setPlaybackError(`再生エラー: ${error.code} (${error.message || '不明なエラー'})`);
        });

        onTimeUpdate = () => {
          if (videoElement) {
            (window as any).lastPlaybackPosition = videoElement.currentTime;
            (window as any).lastPlaybackVideoId = video.videoId;
          }
          const isCacheActive = globalPlayerCache && globalPlayerCache.videoId === video.videoId && !globalPlayerCache.cleanupTimer;
          const currentOnPositionChange = isCacheActive ? globalPlayerCache?.onPositionChange : onPositionChangeRef.current;

          if ((!isCancelled || isCacheActive) && videoElement && currentOnPositionChange) {
            currentOnPositionChange(videoElement.currentTime);
          }
          if (!isLiveLike && canUseMediaSession && videoElement && Number.isFinite(videoElement.duration) && videoElement.duration > 0) {
            navigator.mediaSession.setPositionState({
              duration: videoElement.duration,
              playbackRate: videoElement.playbackRate,
              position: videoElement.currentTime,
            });
          }
        };

        onVideoEnded = () => {
          const isCacheActive = globalPlayerCache && globalPlayerCache.videoId === video.videoId && !globalPlayerCache.cleanupTimer;
          const currentOnEnded = isCacheActive ? globalPlayerCache?.onEnded : onEndedRef.current;

          if ((!isCancelled || isCacheActive) && currentOnEnded) currentOnEnded();
          if ((!isCancelled || isCacheActive) && hapticFeedback) vibrate(40);
        };

        onPlay = () => {
          const isCacheActive = globalPlayerCache && globalPlayerCache.videoId === video.videoId && !globalPlayerCache.cleanupTimer;
          const currentOnPlay = isCacheActive ? globalPlayerCache?.onPlay : onPlayRef.current;

          if (globalPlayerCache && globalPlayerCache.videoId === video.videoId) {
            globalPlayerCache.isPlaying = true;
            globalPlayerCache.isTeleporting = false;
          }

          if ((!isCancelled || isCacheActive) && currentOnPlay) currentOnPlay();
          if (canUseMediaSession) navigator.mediaSession.playbackState = "playing";
          if (videoElement) {
            void setNativePlaybackState(true, pictureInPictureEnabled && autoEnterPipOnBackground, backgroundPlaybackEnabled);
          }
          if (!miniMode) {
            window.dispatchEvent(new CustomEvent("inverview:main-player-playing"));
          }
        };

        onPause = () => {
          if (globalPlayerCache && globalPlayerCache.videoId === video.videoId) {
            const isTeleporting = globalPlayerCache.isTeleporting || (videoElement && (videoElement.parentNode === document.body || !videoElement.parentNode || globalPlayerCache.cleanupTimer));
            if (!isTeleporting) {
              globalPlayerCache.isPlaying = false;
            }
          }

          if (canUseMediaSession) navigator.mediaSession.playbackState = "paused";
          if (videoElement) {
            void setNativePlaybackState(false, pictureInPictureEnabled && autoEnterPipOnBackground, backgroundPlaybackEnabled);
          }
        };

        onVolumeChange = () => {
          const isCacheActive = globalPlayerCache && globalPlayerCache.videoId === video.videoId && !globalPlayerCache.cleanupTimer;
          if ((!isCancelled || isCacheActive) && videoElement) {
            setVolume(videoElement.volume);
            setMuted(videoElement.muted);
          }
        };
        videoElement.addEventListener("timeupdate", onTimeUpdate);
        videoElement.addEventListener("ended", onVideoEnded);
        videoElement.addEventListener("play", onPlay);
        videoElement.addEventListener("pause", onPause);
        videoElement.addEventListener("volumechange", onVolumeChange);

        if (androidMediaNotificationEnabled && videoElement) {
          void setNativeNowPlaying({
            enabled: true,
            title: video.title,
            artist: video.author,
            artworkUrl: poster,
            playbackUrl: manifestUrl || stream?.url,
            durationSeconds: Number.isFinite(videoElement.duration) ? videoElement.duration : undefined,
            positionSeconds: videoElement.currentTime,
            playing: !videoElement.paused,
          });
        } else {
          void setNativeNowPlaying({ enabled: false });
        }

        if (manifestUrl) {
          let startPosition = initialPositionSeconds;
          if ((window as any).lastPlaybackVideoId === video.videoId && typeof (window as any).lastPlaybackPosition === "number") {
            startPosition = (window as any).lastPlaybackPosition;
          }
          await player.load(manifestUrl, startPosition);
          if (isCancelled) return;

          applyPreferredAudioLanguage(player, audioTrackLanguage);

          if (autoplay && videoElement) {
            videoElement.play().catch((err) => {
              console.log("Autoplay blocked or failed:", err);
            });
          }
        } else {
          if (!isCancelled) setPlaybackError("再生可能なストリームが見つかりません。");
        }

        const cleanup = setupGlobalResources(videoElement);

        globalPlayerCache = {
          videoId: video.videoId,
          activeInstanceId: instanceId,
          wrapperElement: wrapperElement,
          videoElement,
          shakaPlayer: player,
          hlsPlayer: hlsPlayer,
          shakaUi: ui,
          cleanupTimer: null,
          volume: videoElement.volume,
          muted: videoElement.muted,
          isPlaying: !videoElement.paused,
          isTeleporting: false,
          onPositionChange: onPositionChangeRef.current,
          onEnded: onEndedRef.current,
          onPlay: onPlayRef.current,
          onVolumeChange: onVolumeChange,
          globalCleanup: cleanup,
        };

      } catch (e: any) {
        if (isCancelled || e.code === shaka.util.Error.Code.LOAD_INTERRUPTED) return;
        console.error("Shaka Init/Load Error:", e);
        if (enableHlsFallback()) {
          setPlaybackError("DASH 再生に失敗したため HLS に切り替えました。");
          return;
        }
        setPlaybackError(`読み込み失敗: ${e.code || "unknown"}`);
        if (stream?.url && videoElement) {
          videoElement.src = stream.url;
        }
      }
    };

    initPlayer();

    return () => {
      isCancelled = true;
      const isOwnerOfCache = globalPlayerCache &&
                             globalPlayerCache.videoId === video.videoId &&
                             globalPlayerCache.activeInstanceId === instanceId;

      if (isOwnerOfCache) {
        // Mark as teleporting to prevent automatic pause event from resetting playback state
        globalPlayerCache.isTeleporting = true;

        // DO NOT remove wrapperElement from DOM. Keep it in globalVideoHost to prevent MediaSource crash.

        if (globalPlayerCache.globalCleanup) {
          try {
            globalPlayerCache.globalCleanup();
            globalPlayerCache.globalCleanup = undefined;
          } catch (e) {
            console.error("Error executing globalCleanup during unmount:", e);
          }
        }

        const cacheToCleanup = globalPlayerCache!;
        cacheToCleanup.cleanupTimer = window.setTimeout(() => {
          destroyCachedPlayer(cacheToCleanup);
        }, 2000) as any;
      } else if (!globalPlayerCache || globalPlayerCache.videoId !== video.videoId) {
        if (videoElement) {
          videoElement.pause();
          videoElement.removeAttribute("src");
          videoElement.load();
          if (onTimeUpdate) videoElement.removeEventListener("timeupdate", onTimeUpdate);
          if (onVideoEnded) videoElement.removeEventListener("ended", onVideoEnded);
          if (onPlay) videoElement.removeEventListener("play", onPlay);
          if (onPause) videoElement.removeEventListener("pause", onPause);
          if (onVolumeChange) videoElement.removeEventListener("volumechange", onVolumeChange);
        }
        if (ui) {
          try { ui.destroy(); } catch (e) { console.error("Error destroying ui:", e); }
        }
        if (player) {
          try { player.destroy(); } catch (e) { console.error("Error destroying player:", e); }
        }
        if (hlsPlayer) {
          try { hlsPlayer.destroy(); } catch (e) { console.error("Error destroying hlsPlayer:", e); }
        }

        const wrapper = videoElement?.parentElement;
        if (wrapper) {
          try { wrapper.remove(); } catch (e) { console.error("Error removing wrapper:", e); }
        }
      }

      if (containerRef.current) stopSync(containerRef.current, miniMode);
      if ((!globalPlayerCache || globalPlayerCache.videoId !== video.videoId) && containerRef.current) {
        containerRef.current.innerHTML = "";
      }
      videoRef.current = null;
    };
  }, [
    video.videoId,
    video.title,
    video.author,
    manifestUrl,
    autoplay,
    loopVideo,
    poster,
    isLiveLike,
    hapticFeedback,
    audioTrackLanguage,
    pictureInPictureEnabled,
    autoEnterPipOnBackground,
    backgroundPlaybackEnabled,
    androidMediaNotificationEnabled,
  ]);

  useEffect(() => {
    if (typeof externalSeekSeconds !== "number") return;
    const videoElement = videoRef.current;
    if (!videoElement) return;
    const maxDuration = Number.isFinite(videoElement.duration) ? videoElement.duration : Number.MAX_SAFE_INTEGER;
    videoElement.currentTime = Math.max(0, Math.min(externalSeekSeconds, maxDuration));
  }, [externalSeekSeconds]);

  // Removed dynamic control overlay API toggles to prevent destroying Shaka UI state.
  // Instead, the player controls are safely concealed via CSS miniVideoContainer.

  if (miniMode) {
    return (
      <div
        style={{
          width: "100%",
          aspectRatio: "16 / 9",
          backgroundColor: "black",
          overflow: "hidden",
          borderRadius: "8px",
        }}
      >
        <div ref={containerRef} className={styles.miniVideoContainer} />
      </div>
    );
  }

  return (
    <div
      className={miniMode ? undefined : (isShorts ? "" : styles.container)}
      style={miniMode ? { display: "block", width: "100%" } : isShorts ? { width: "100%", height: "100%", display: "flex", flexDirection: "column", backgroundColor: "transparent" } : {}}
    >
      {audioOnly && !miniMode ? (
        <div className={styles.audioOnlyWrap}>
          <Text size={200} style={{ color: tokens.colorNeutralForeground3, marginBottom: "8px" }}>
            音声のみモード
          </Text>
          <div className={styles.surfaceWrap} style={{ aspectRatio: isShorts ? "9 / 16" : "16 / 9" }}>
            <div ref={containerRef} className={styles.videoContainer} />
          </div>
        </div>
      ) : miniMode ? (
        // In mini mode, render a plain anchor div that the overlay sync will follow.
        // No extra styling that could interfere with sizing from parent.
        <div
          ref={containerRef}
          style={{
            width: "100%",
            aspectRatio: "16 / 9",
            display: "block",
            overflow: "hidden",
            borderRadius: "8px",
            backgroundColor: "#000",
          }}
        />
      ) : (
        <div
          className={styles.surfaceWrap}
          style={{
            aspectRatio: isShorts ? "9 / 16" : "16 / 9",
            margin: isShorts ? "0 auto" : "0",
            width: isShorts ? "auto" : "100%",
            height: isShorts ? "100%" : "auto",
            maxWidth: "100%",
            maxHeight: "100%",
            objectFit: "contain",
            boxShadow: cinematicLightingEnabled
              ? `0 0 40px 12px ${cinematicGlowColor}, 0 0 90px 24px ${cinematicGlowColor}`
              : "none",
            transition: "box-shadow 220ms ease",
          }}
        >
          <div ref={containerRef} className={styles.videoContainer} />
        </div>
      )}

      {!miniMode && playbackError && (
        <div className={styles.contentArea}>
          <Text className={styles.errorText}>
            {playbackError}
          </Text>

          <div className={styles.embedWrap}>
            <iframe
              title={video.title}
              src={embedUrl}
              allow="autoplay; encrypted-media; picture-in-picture"
              style={{ width: "100%", height: "100%", border: 0 }}
            />
          </div>

          <div className={styles.linkRow}>
            {screenfull.isEnabled && (
              <Button
                appearance="outline"
                size="small"
                onClick={() => {
                  if (!containerRef.current || !screenfull.isEnabled) return;
                  void screenfull.toggle(containerRef.current);
                }}
              >
                {isFullscreen ? t("player.exitFullscreen") : t("player.enterFullscreen")}
              </Button>
            )}
            {hlsUrl && (
              <Link href={hlsUrl} target="_blank">
                HLS 直リンク
              </Link>
            )}
            {stream?.url && (
              <Link href={stream.url} target="_blank">
                代替ストリーム
              </Link>
            )}
            {dashUrl && (
              <Link href={dashUrl} target="_blank">
                DASH 直リンク
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
