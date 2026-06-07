import {
  Text,
  makeStyles,
  tokens,
  Button,
  Link,
  Card,
  Divider,
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
  Title1,
} from "@fluentui/react-components";
import { Add16Regular, Delete16Regular, Dismiss16Regular, MoreHorizontal20Regular, WifiWarning24Regular, Open16Regular } from "@fluentui/react-icons";
import DOMPurify from "dompurify";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { BadgeRow } from "../components/BadgeRow";
import { Comments } from "../components/Comments";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { WatchLoadingSkeleton } from "../components/WatchLoadingSkeleton";
import { MobileChannelHeader } from "../components/mobile/MobileChannelHeader";
import { MobileVideoActions } from "../components/mobile/MobileVideoActions";
import { VideoCard } from "../components/VideoCard";
import { VideoPlayer } from "../components/VideoPlayer";
import { useMiniPlayer, useSettings } from "../hooks/useSettings";
import { formatDateJa, formatDuration, formatNumberJa, formatViewCountJa } from "../lib/format";
import { addWatchHistoryItem, findWatchHistoryItem, updateWatchHistoryPosition } from "../lib/watchHistory";
import { addSubscription, getAuthSubscriptions, getCaptions, getVideo, removeSubscription } from "../lib/invidiousClient";
import { pickBestThumbnail, resolveMediaUrl } from "../lib/media";
import { queryKeys } from "../lib/queryKeys";
import { useSettingsStore } from "../store/settingsStore";
import { scrobbleMusicVideo, updateNowPlayingMusicVideo } from "../lib/lastfm";
import { notifyError } from "../lib/notifications";

interface ChapterItem {
  label: string;
  seconds: number;
}

interface QueueItem {
  videoId: string;
  title: string;
  author: string;
}

interface ResumePromptState {
  savedSeconds: number;
}

const QUEUE_STORAGE_KEY = "watch-play-queue-v1";
const RESUME_MIN_SECONDS = 30;
const RESUME_STALE_MS = 1000 * 60 * 60 * 24 * 30;
const RESUME_NEAR_END_RATIO = 0.95;
const SHORTS_MAX_SECONDS = 70;
const RESUME_PROMPT_TIMEOUT_MS = 3000;

const readQueue = (): QueueItem[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => (typeof item === "object" && item ? item as QueueItem : null))
      .filter((item): item is QueueItem => !!item && !!item.videoId && !!item.title);
  } catch {
    return [];
  }
};

const writeQueue = (queue: QueueItem[]): void => {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // Ignore storage quota/private mode errors and keep runtime state only.
  }
};

const parseChapters = (input: string | undefined): ChapterItem[] => {
  if (!input) return [];
  const lines = input.split("\n").map((line) => line.trim()).filter(Boolean);

  return lines
    .map((line) => {
      const match = line.match(/^(\d{1,2}:\d{2}(?::\d{2})?)\s+(.+)$/);
      if (!match) return null;
      const [hh, mm, ss] = match[1].split(":").map((value) => Number.parseInt(value, 10));
      const seconds = match[1].split(":").length === 3 ? (hh * 3600 + mm * 60 + ss) : (hh * 60 + mm);
      return { label: match[2], seconds };
    })
    .filter((item): item is ChapterItem => item !== null)
    .slice(0, 30);
};

const useStyles = makeStyles({
  container: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    gap: "16px",
    alignItems: "start",
    "@media (min-width: 1024px)": {
      gridTemplateColumns: "minmax(0, 1fr) 380px",
      gap: "20px",
    },
  },
  mainCol: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    minWidth: 0,
  },
  playerContainer: {
    width: "100%",
    backgroundColor: tokens.colorNeutralBackground1,
    "@media (max-width: 1023px)": {
      paddingBottom: "12px",
    },
    "@media (max-width: 767px)": {
      width: "calc(100% + 32px)",
      marginLeft: "-16px",
      marginRight: "-16px",
      position: "sticky",
      top: 0,
      zIndex: 100,
      border: "none",
      outline: "none",
      paddingBottom: "0px",
    },
  },
  infoSection: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    alignItems: "flex-start",
    textAlign: "left",
    "@media (max-width: 1023px)": {
      padding: "0 8px",
      marginTop: "2px",
      gap: "4px",
    },
  },
  videoTitle: {
    textAlign: "left",
    alignSelf: "flex-start",
    width: "100%",
    "@media (max-width: 767px)": {
      fontSize: "18px",
      lineHeight: "24px",
    },
  },
  metadataRow: {
    display: "flex",
    gap: "12px",
    color: tokens.colorNeutralForeground3,
    fontSize: "12px",
    flexWrap: "wrap",
  },
  descriptionCard: {
    padding: "12px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  descriptionContent: {
    fontSize: "15px",
    color: tokens.colorNeutralForeground1,
    lineHeight: "1.7",
    overflow: "hidden",
    transition: "max-height 0.3s ease",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    "& a": {
      color: tokens.colorBrandForeground1,
      textDecorationLine: "none",
      ":hover": {
        textDecorationLine: "underline",
      },
    },
    "& p": {
      marginBottom: "8px",
    },
  },
  chapterItem: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "14px",
    padding: "4px 0",
  },
  sideCol: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    minWidth: 0,
    "@media (max-width: 767px)": {
      gap: "16px",
    },
  },
  queueCard: {
    padding: "12px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  queueHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
  },
  queueList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  queueItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    minWidth: 0,
  },
  queueItemText: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  ellipsis: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  rowActions: {
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
    height: "94px",
  },
  relatedCardWrap: {
    flex: 1,
    minWidth: 0,
  },
  mobileActionsWrap: {
    width: "100%",
  },
  halfSheetBody: {
    paddingBottom: "calc(14px + env(safe-area-inset-bottom))",
  },
  mobileSheet: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: "env(safe-area-inset-bottom)",
    zIndex: 1000,
    backgroundColor: tokens.colorNeutralBackground1,
    borderTopLeftRadius: "16px",
    borderTopRightRadius: "16px",
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    boxShadow: tokens.shadow64,
    display: "flex",
    flexDirection: "column",
  },
  mobileSheetGrabberWrap: {
    display: "flex",
    justifyContent: "center",
    paddingTop: "10px",
    paddingBottom: "8px",
    touchAction: "none",
    userSelect: "none",
  },
  mobileSheetGrabber: {
    width: "40px",
    height: "4px",
    borderRadius: "999px",
    backgroundColor: tokens.colorNeutralStroke2,
    touchAction: "none",
  },
  mobileSheetHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    padding: "8px 12px",
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  sheetContent: {
    overflowY: "auto",
    padding: "12px",
    paddingBottom: "calc(14px + env(safe-area-inset-bottom))",
  },
  inlineCommentsDesktopOnly: {
    ...{
      "@media (max-width: 767px)": {
        display: "none",
      },
    },
  },
  resumePromptCard: {
    margin: "0 12px",
    padding: "10px 12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    flexWrap: "wrap",
    "@media (min-width: 1024px)": {
      margin: "0",
    },
  },
  resumePromptActions: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
});

export const WatchPage = (): JSX.Element => {
  const styles = useStyles();
  const { t, i18n } = useTranslation();
  const { videoId = "" } = useParams();
  const location = useLocation();
  const { search } = location;
  const isTvWatchRoute = location.pathname.startsWith("/tv/watch/");
  const navigate = useNavigate();
  const baseUrl = useSettingsStore((state) => state.apiBaseUrl);
  const region = useSettingsStore((state) => state.region);
  const { settings } = useSettings();
  const { miniPlayer, setMiniPlayer } = useMiniPlayer();
  const token = useSettingsStore((state) => state.token);

  const [showFullDesc, setShowFullDesc] = useState(settings.expandDescriptionByDefault);
  const [showChapters, setShowChapters] = useState(settings.expandChaptersByDefault);
  const [restoredPosition, setRestoredPosition] = useState(0);
  const [playerSessionId, setPlayerSessionId] = useState(0);
  const [resumePrompt, setResumePrompt] = useState<ResumePromptState | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>(() => readQueue());
  const [commentSeekSeconds, setCommentSeekSeconds] = useState<number | null>(null);
  const [isDescriptionSheetOpen, setIsDescriptionSheetOpen] = useState(false);
  const [isCommentsSheetOpen, setIsCommentsSheetOpen] = useState(false);
  const [descriptionSheetHeightVh, setDescriptionSheetHeightVh] = useState(58);
  const [commentsSheetHeightVh, setCommentsSheetHeightVh] = useState(70);
  const dragStateRef = useRef<{
    type: "description" | "comments";
    startY: number;
    startHeight: number;
    lastHeight: number;
  } | null>(null);
  const [isMobileViewport, setIsMobileViewport] = useState(
    typeof window !== "undefined" ? window.matchMedia("(max-width: 767px)").matches : false,
  );
  const isAutoplay = useMemo(() => new URLSearchParams(search).get("autoplay") === "1", [search]);
  const tvSessionId = useMemo(() => new URLSearchParams(search).get("tvSession") || "", [search]);
  const afterParam = useMemo(() => new URLSearchParams(search).get("after") || "", [search]);
  const [tvAfterId, setTvAfterId] = useState(afterParam);
  const lastPersistRef = useRef(0);
  const lastNowPlayingVideoIdRef = useRef<string>("");
  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  const latestPlaybackSecondsRef = useRef(0);
  const playerSwipeRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startAt: number;
    tracking: boolean;
  } | null>(null);

  useEffect(() => {
    setTvAfterId(afterParam);
  }, [afterParam]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const handleChange = (event: MediaQueryListEvent): void => {
      setIsMobileViewport(event.matches);
    };
    setIsMobileViewport(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    writeQueue(queue);
  }, [queue]);

  useEffect(() => {
    if (!videoId) return;
    lastNowPlayingVideoIdRef.current = "";
    const mainContent = document.querySelector("main");
    if (mainContent instanceof HTMLElement) {
      mainContent.scrollTo({ top: 0, left: 0, behavior: "auto" });
      return;
    }
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [videoId]);

  useEffect(() => {
    setShowFullDesc(settings.expandDescriptionByDefault);
    setShowChapters(settings.expandChaptersByDefault);
  }, [settings.expandDescriptionByDefault, settings.expandChaptersByDefault, videoId]);

  useEffect(() => {
    if (!isDescriptionSheetOpen) return undefined;
    const scrollContainer = document.getElementById("app-scroll-container");
    const previousOverflow = scrollContainer instanceof HTMLElement ? scrollContainer.style.overflow : "";
    const previousTouchAction = scrollContainer instanceof HTMLElement ? scrollContainer.style.touchAction : "";
    if (scrollContainer instanceof HTMLElement) {
      scrollContainer.style.overflow = "hidden";
      scrollContainer.style.touchAction = "none";
    }
    return () => {
      if (scrollContainer instanceof HTMLElement) {
        scrollContainer.style.overflow = previousOverflow;
        scrollContainer.style.touchAction = previousTouchAction;
      }
    };
  }, [isDescriptionSheetOpen]);

  const videoQuery = useQuery({
    queryKey: queryKeys.video(videoId, region),
    queryFn: ({ signal }) => getVideo(videoId, signal),
    enabled: !!videoId,
  });
  const video = videoQuery.data;

  const captionsQuery = useQuery({
    queryKey: queryKeys.captions(videoId),
    queryFn: ({ signal }) => getCaptions(videoId, undefined, signal),
    enabled: !!videoId,
  });
  const subscribeAuthorId = videoQuery.data?.authorId ?? "";
  const subscribedQuery = useQuery({
    queryKey: [...queryKeys.authSubscriptions, subscribeAuthorId, "status"],
    queryFn: async () => {
      if (!subscribeAuthorId) return false;
      const subscriptions = await getAuthSubscriptions();
      return subscriptions.some((channel) => channel.authorId === subscribeAuthorId);
    },
    enabled: !!subscribeAuthorId && !!token,
  });

  useEffect(() => {
    const video = videoQuery.data;
    if (!video) return;

    const thumb = pickBestThumbnail(video.videoThumbnails);
    if (settings.saveWatchHistory) {
      addWatchHistoryItem({
        videoId: video.videoId,
        title: video.title,
        thumbnailUrl: thumb?.url ?? "",
        channelName: video.author,
        watchedAt: Date.now(),
        positionSeconds: restoredPosition,
        durationSeconds: video.lengthSeconds,
      });
    }

    if (!settings.miniPlayer) return;
    setMiniPlayer({
      videoId: video.videoId,
      thumbnailUrl: thumb?.url ?? "",
      video,
      baseUrl,
      positionSeconds: restoredPosition,
      x: miniPlayer?.x ?? 12,
      y: miniPlayer?.y ?? 96,
      visible: true,
    });
  }, [videoQuery.data, settings.saveWatchHistory, restoredPosition, setMiniPlayer, baseUrl, miniPlayer?.x, miniPlayer?.y, settings.miniPlayer]);

  useEffect(() => {
    if (!videoId || !settings.rememberPlaybackPosition) {
      setRestoredPosition(0);
      setResumePrompt(null);
      return;
    }

    const history = findWatchHistoryItem(videoId);
    const savedSeconds = history?.positionSeconds ?? 0;
    const watchedAt = history?.watchedAt ?? 0;

    if (!video) {
      setRestoredPosition(0);
      setResumePrompt(null);
      return;
    }

    const videoDuration = Math.max(0, video.lengthSeconds ?? 0);
    const isNearEnd = videoDuration > 0 && savedSeconds >= Math.floor(videoDuration * RESUME_NEAR_END_RATIO);
    const isStale = watchedAt > 0 && Date.now() - watchedAt > RESUME_STALE_MS;
    const isShortLike = videoDuration > 0 && videoDuration <= SHORTS_MAX_SECONDS;
    const isLiveLike = !!video.liveNow || !!video.isUpcoming;
    const shouldResume =
      savedSeconds >= RESUME_MIN_SECONDS &&
      !isNearEnd &&
      !isStale &&
      !isShortLike &&
      !isLiveLike;

    if (!shouldResume) {
      setRestoredPosition(0);
      setResumePrompt(null);
      return;
    }

    setRestoredPosition(savedSeconds);
    setResumePrompt({ savedSeconds });
  }, [videoId, settings.rememberPlaybackPosition, video]);

  useEffect(() => {
    if (!resumePrompt) return;
    const timer = window.setTimeout(() => {
      setResumePrompt(null);
    }, RESUME_PROMPT_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [resumePrompt]);

  useEffect(() => {
    if (!isTvWatchRoute || !tvSessionId) return;
    let active = true;
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(`/tv-sync/session/${encodeURIComponent(tvSessionId)}/command?after=${encodeURIComponent(tvAfterId)}`);
        if (!response.ok) return;
        const data = (await response.json()) as {
          hasCommand: boolean;
          command?: { id: string; videoId: string };
        };
        if (!active || !data.hasCommand || !data.command) return;
        setTvAfterId(data.command.id);
        navigate(
          `/tv/watch/${data.command.videoId}?autoplay=1&tvSession=${encodeURIComponent(tvSessionId)}&after=${encodeURIComponent(data.command.id)}`,
        );
      } catch {
        // keep polling.
      }
    }, 2000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [isTvWatchRoute, navigate, tvAfterId, tvSessionId]);

  const isSubscribed = subscribedQuery.data ?? false;
  const sharedPositionSeconds = miniPlayer?.videoId === videoId ? miniPlayer.positionSeconds : undefined;
  const initialPlaybackPosition =
    typeof sharedPositionSeconds === "number"
      ? sharedPositionSeconds
      : (settings.rememberPlaybackPosition ? restoredPosition : 0);
  useEffect(() => {
    latestPlaybackSecondsRef.current = initialPlaybackPosition;
  }, [videoId, initialPlaybackPosition]);

  const authorThumb = useMemo(
    () => (video ? pickBestThumbnail(video.authorThumbnails ?? video.videoThumbnails) : undefined),
    [video?.authorThumbnails, video?.videoThumbnails],
  );

  const descriptionHtml = useMemo(
    () =>
      video
        ? DOMPurify.sanitize(video.descriptionHtml || video.description || t("watch.noDescription"))
        : "",
    [video?.descriptionHtml, video?.description, t],
  );
  const rawDescription = useMemo(() => (video?.description ?? "").replace(/\s+/g, " ").trim(), [video?.description]);
  const metaDescription = rawDescription.slice(0, 140) || t("watch.descriptionFallback");
  const pageTitle = video ? `${video.title} - ${t("appName")}` : t("appName");

  const chapters = useMemo(() => (video ? parseChapters(video.description || "") : []), [video?.description]);
  const isMusicVideo = useMemo(() => {
    if (!video) return false;
    if ((video.musicTracks?.length ?? 0) > 0) return true;
    return (video.genre ?? "").toLowerCase() === "music";
  }, [video]);
  const queueHead = queue[0];
  const isLiveLike = !!video?.liveNow || !!video?.isUpcoming;
  const queuedVideoIds = useMemo(() => new Set(queue.map((item) => item.videoId)), [queue]);
  const relatedVideos = video?.recommendedVideos ?? [];
  const relatedListRef = useRef<HTMLDivElement | null>(null);
  const shouldVirtualizeRelated = relatedVideos.length >= 20;
  const relatedVirtualizer = useVirtualizer({
    count: shouldVirtualizeRelated ? relatedVideos.length : 0,
    getScrollElement: () => relatedListRef.current,
    estimateSize: () => (isMobileViewport ? 320 : 110),
    overscan: 4,
  });
  const relatedVirtualRows = relatedVirtualizer.getVirtualItems();
  const enqueue = (item: QueueItem): void => {
    setQueue((prev) => {
      if (item.videoId === videoId || prev.some((q) => q.videoId === item.videoId)) return prev;
      return [...prev, item];
    });
  };

  const removeFromQueue = (videoIdToRemove: string): void => {
    setQueue((prev) => prev.filter((item) => item.videoId !== videoIdToRemove));
  };

  const handleSharedPositionChange = (seconds: number): void => {
    latestPlaybackSecondsRef.current = Math.max(0, seconds);
    if (video && miniPlayer?.videoId === video.videoId) {
      setMiniPlayer({ ...miniPlayer, positionSeconds: seconds });
    }
    if (!settings.rememberPlaybackPosition || !settings.saveWatchHistory) return;
    const now = Date.now();
    if (now - lastPersistRef.current < 3000) return;
    lastPersistRef.current = now;
    updateWatchHistoryPosition(videoId, seconds);
  };

  const minimizeToMobilePlayerAndGoBack = (): void => {
    if (video && settings.miniPlayer) {
      const thumb = pickBestThumbnail(video.videoThumbnails);
      const syncedSeconds = latestPlaybackSecondsRef.current > 0
        ? latestPlaybackSecondsRef.current
        : (miniPlayer?.videoId === video.videoId ? miniPlayer.positionSeconds : restoredPosition);
      setMiniPlayer({
        videoId: video.videoId,
        thumbnailUrl: thumb?.url ?? "",
        video,
        baseUrl,
        positionSeconds: syncedSeconds,
        x: miniPlayer?.x ?? 12,
        y: miniPlayer?.y ?? 96,
        visible: true,
      });
    }

    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/");
  };

  useEffect(() => {
    const playerContainer = playerContainerRef.current;
    if (!playerContainer || !isMobileViewport) return undefined;

    const onTouchStart = (event: TouchEvent): void => {
      const touch = event.changedTouches[0];
      if (!touch) return;
      playerSwipeRef.current = {
        pointerId: touch.identifier,
        startX: touch.clientX,
        startY: touch.clientY,
        startAt: Date.now(),
        tracking: true,
      };
    };

    const onTouchMove = (event: TouchEvent): void => {
      const state = playerSwipeRef.current;
      if (!state || !state.tracking) return;
      const touch = Array.from(event.changedTouches).find((item) => item.identifier === state.pointerId);
      if (!touch) return;
      const deltaX = touch.clientX - state.startX;
      const deltaY = touch.clientY - state.startY;
      if (Math.abs(deltaX) > 64 && Math.abs(deltaX) > Math.abs(deltaY)) {
        state.tracking = false;
      }
    };

    const onTouchEnd = (event: TouchEvent): void => {
      const state = playerSwipeRef.current;
      if (!state) return;
      const touch = Array.from(event.changedTouches).find((item) => item.identifier === state.pointerId);
      if (!touch) return;
      playerSwipeRef.current = null;
      if (!state.tracking) return;
      const deltaY = touch.clientY - state.startY;
      const deltaX = Math.abs(touch.clientX - state.startX);
      const durationMs = Date.now() - state.startAt;
      const isDownSwipe = deltaY > 72 && deltaY > deltaX * 1.05 && durationMs < 950;
      if (isDownSwipe) minimizeToMobilePlayerAndGoBack();
    };

    const onTouchCancel = (): void => {
      playerSwipeRef.current = null;
    };

    playerContainer.addEventListener("touchstart", onTouchStart, { capture: true, passive: true });
    playerContainer.addEventListener("touchmove", onTouchMove, { capture: true, passive: true });
    playerContainer.addEventListener("touchend", onTouchEnd, { capture: true, passive: true });
    playerContainer.addEventListener("touchcancel", onTouchCancel, { capture: true, passive: true });

    return () => {
      playerContainer.removeEventListener("touchstart", onTouchStart, true);
      playerContainer.removeEventListener("touchmove", onTouchMove, true);
      playerContainer.removeEventListener("touchend", onTouchEnd, true);
      playerContainer.removeEventListener("touchcancel", onTouchCancel, true);
    };
  }, [isMobileViewport, video?.videoId, miniPlayer?.videoId, restoredPosition, settings.miniPlayer]);

  const toggleSubscribe = async (): Promise<void> => {
    if (!token) {
      notifyError(t("feed.loginRequiredDescription"));
      return;
    }
    if (!video?.authorId) return;
    try {
      if (isSubscribed) {
        await removeSubscription(video.authorId);
      } else {
        await addSubscription(video.authorId);
      }
      void subscribedQuery.refetch();
    } catch (error) {
      console.error(error);
      notifyError(t("subscriptions.fetchErrorAuth"));
    }
  };
  const startSheetDrag = (type: "description" | "comments", event: ReactPointerEvent<HTMLDivElement>): void => {
    const startHeight = type === "description" ? descriptionSheetHeightVh : commentsSheetHeightVh;
    dragStateRef.current = { type, startY: event.clientY, startHeight, lastHeight: startHeight };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveSheetDrag = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const drag = dragStateRef.current;
    if (!drag) return;
    const deltaY = drag.startY - event.clientY;
    const deltaVh = (deltaY / window.innerHeight) * 100;
    const next = Math.min(92, Math.max(40, drag.startHeight + deltaVh));
    drag.lastHeight = next;
    if (drag.type === "description") {
      setDescriptionSheetHeightVh(next);
    } else {
      setCommentsSheetHeightVh(next);
    }
  };

  const endSheetDrag = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const drag = dragStateRef.current;
    if (drag) {
      const draggedDown = event.clientY - drag.startY;
      const shouldClose = draggedDown > 48 || drag.lastHeight <= 44;
      if (shouldClose) {
        if (drag.type === "description") {
          setIsDescriptionSheetOpen(false);
        } else {
          setIsCommentsSheetOpen(false);
        }
      }
    }
    dragStateRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const computeSheetHeightByPlayerBottom = (): number => {
    if (typeof window === "undefined") return 60;
    const rect = playerContainerRef.current?.getBoundingClientRect();
    if (!rect) return 60;
    const mobileBottomNavPx = 56;
    const availablePx = window.innerHeight - rect.bottom - mobileBottomNavPx;
    const vh = (availablePx / window.innerHeight) * 100;
    return Math.min(92, Math.max(24, vh));
  };

  const openDescriptionSheet = (): void => {
    const nextHeight = computeSheetHeightByPlayerBottom();
    setDescriptionSheetHeightVh(nextHeight);
    setIsDescriptionSheetOpen(true);
  };

  const openCommentsSheet = (): void => {
    const nextHeight = computeSheetHeightByPlayerBottom();
    setCommentsSheetHeightVh(nextHeight);
    setIsCommentsSheetOpen(true);
  };

  if (!videoId) {
    return <EmptyState title={t("watch.noVideoIdTitle")} description={t("watch.noVideoIdDescription")} />;
  }

  if (videoQuery.isLoading) {
    return <WatchLoadingSkeleton theaterMode={settings.theaterMode} videoId={videoId} baseUrl={baseUrl} />;
  }

  if (videoQuery.isError || !video || !video.videoId || (video as any).error) {
    const errMsg = (video as any)?.error || t("watch.fetchErrorMessage");
    return (
      <ErrorState
        title={t("watch.fetchErrorTitle")}
        message={typeof errMsg === "string" ? errMsg : JSON.stringify(errMsg)}
        onRetry={() => videoQuery.refetch()}
      />
    );
  }

  const enableLivePlayback = import.meta.env.VITE_ENABLE_LIVE_PLAYBACK !== "false";
  const isLive = !!video.liveNow;

  if (!enableLivePlayback && isLive) {
    return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
        textAlign: "center",
        backgroundColor: tokens.colorNeutralBackground1,
        minHeight: "400px",
        boxSizing: "border-box",
      }}>
        <div style={{ maxWidth: "600px", display: "flex", flexDirection: "column", alignItems: "center", gap: "20px" }}>
          <WifiWarning24Regular style={{ fontSize: "64px", width: "64px", height: "64px", color: tokens.colorPaletteRedBorderActive }} />
          
          <Title1 style={{ fontWeight: tokens.fontWeightSemibold, color: tokens.colorNeutralForeground1 }}>
            {t("watch.livePlaybackForbiddenTitle")}
          </Title1>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", textAlign: "left", lineHeight: "1.6", color: tokens.colorNeutralForeground2 }}>
            <Text weight="bold" style={{ fontSize: "16px", color: tokens.colorNeutralForeground1, display: "block" }}>
              {t("watch.livePlaybackForbiddenTitleBold")}
            </Text>
            <Text style={{ fontSize: "14px", display: "block" }}>
              {t("watch.livePlaybackForbiddenMessage")}
            </Text>
          </div>
          
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center", marginTop: "16px" }}>
            <Button appearance="primary" onClick={() => navigate(-1)}>
              {t("common.back")}
            </Button>
            <Button
              appearance="outline"
              icon={<Open16Regular />}
              iconPosition="after"
              onClick={() => window.open(`https://www.youtube.com/watch?v=${videoId}`, "_blank", "noopener,noreferrer")}
            >
              {t("watch.openInYoutube")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!settings.livePlaybackEnabled && isLiveLike) {
    return (
      <ErrorState
        title={t("watch.livePlaybackDisabledTitle")}
        message={t("watch.livePlaybackDisabledMessage")}
      />
    );
  }

  if (isTvWatchRoute) {
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: "100%", background: "black" }}>
          <VideoPlayer
            key={`${video.videoId}-${playerSessionId}-${restoredPosition}`}
            video={video}
            baseUrl={baseUrl}
            initialPositionSeconds={initialPlaybackPosition}
            externalSeekSeconds={commentSeekSeconds}
            onPositionChange={handleSharedPositionChange}
            onPlay={() => {
              if (!isMusicVideo) return;
              if (lastNowPlayingVideoIdRef.current === video.videoId) return;
              lastNowPlayingVideoIdRef.current = video.videoId;
              void updateNowPlayingMusicVideo(video, settings).catch((error) => {
                console.error(error);
                notifyError(t("watch.lastFmNowPlayingFailed"));
              });
            }}
            onEnded={() => {
              if (isMusicVideo) {
                void scrobbleMusicVideo(video, settings).catch((error) => {
                  console.error(error);
                  notifyError(t("watch.lastFmScrobbleFailed"));
                });
              }
              if (isLiveLike) return;
              if (!settings.autoplayNextVideo) return;
              if (queueHead?.videoId) {
                setQueue((prev) => prev.slice(1));
                navigate(`/tv/watch/${queueHead.videoId}?autoplay=1`);
                return;
              }
              const nextVideo = relatedVideos[0];
              if (nextVideo?.videoId) navigate(`/tv/watch/${nextVideo.videoId}?autoplay=1`);
            }}
            autoplay={isAutoplay}
          />
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <html lang={i18n.language} />
        <title>{pageTitle}</title>
        <meta name="description" content={metaDescription} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={metaDescription} />
        <meta property="og:type" content="video.other" />
        <meta property="og:url" content={typeof window !== "undefined" ? window.location.href : ""} />
      </Helmet>
      <div className={styles.container}>
      <div className={styles.mainCol}>
        <div
          ref={playerContainerRef}
          className={styles.playerContainer}
        >
          <VideoPlayer
            key={`${video.videoId}-${playerSessionId}-${restoredPosition}`}
            video={video}
            baseUrl={baseUrl}
            initialPositionSeconds={initialPlaybackPosition}
            externalSeekSeconds={commentSeekSeconds}
            onPositionChange={handleSharedPositionChange}
            onPlay={() => {
              if (!isMusicVideo) return;
              if (lastNowPlayingVideoIdRef.current === video.videoId) return;
              lastNowPlayingVideoIdRef.current = video.videoId;
              void updateNowPlayingMusicVideo(video, settings).catch((error) => {
                console.error(error);
                notifyError(t("watch.lastFmNowPlayingFailed"));
              });
            }}
            onEnded={() => {
              if (isMusicVideo) {
                void scrobbleMusicVideo(video, settings).catch((error) => {
                  console.error(error);
                  notifyError(t("watch.lastFmScrobbleFailed"));
                });
              }
              if (isLiveLike) return;
              if (!settings.autoplayNextVideo) return;
              if (queueHead?.videoId) {
                setQueue((prev) => prev.slice(1));
                navigate(`/watch/${queueHead.videoId}?autoplay=1`);
                return;
              }
              const nextVideo = relatedVideos[0];
              if (nextVideo?.videoId) navigate(`/watch/${nextVideo.videoId}?autoplay=1`);
            }}
            autoplay={isAutoplay}
          />
        </div>
        {resumePrompt ? (
          <Card appearance="filled-alternative" className={styles.resumePromptCard}>
            <Text size={200}>
              {t("watch.resumeFromPrevious", { time: formatDuration(resumePrompt.savedSeconds) })}
            </Text>
            <div className={styles.resumePromptActions}>
              <Button appearance="primary" size="small" onClick={() => setResumePrompt(null)}>
                {t("watch.playFromTime", { time: formatDuration(resumePrompt.savedSeconds) })}
              </Button>
              <Button
                appearance="subtle"
                size="small"
                onClick={() => {
                  setResumePrompt(null);
                  setRestoredPosition(0);
                  setPlayerSessionId((prev) => prev + 1);
                }}
              >
                {t("watch.playFromStart")}
              </Button>
            </div>
          </Card>
        ) : null}

        <div className={styles.infoSection}>
          <Text size={600} weight="bold" className={styles.videoTitle}>
            {video.title}
          </Text>
          <BadgeRow video={video} />
          <div className={styles.metadataRow}>
            <Text>{formatViewCountJa(video.viewCount, video.viewCountText)}</Text>
            <Text>{video.publishedText || formatDateJa(video.published)}</Text>
            {typeof video.likeCount === "number" ? (
              <Text>
                {t("watch.likesCount", { count: formatNumberJa(video.likeCount) })}
                {isMusicVideo ? " #music" : ""}
              </Text>
            ) : null}
          </div>
        </div>

        <MobileChannelHeader
          authorId={video.authorId}
          author={video.author}
          avatarSrc={resolveMediaUrl(authorThumb?.url, baseUrl)}
          subCount={video.subCount}
          secondaryActionLabel={isSubscribed ? t("subscriptions.unsubscribe") : t("watch.subscribeChannel")}
          secondaryActionAppearance={isSubscribed ? "outline" : "primary"}
          onSecondaryActionClick={() => void toggleSubscribe()}
        />

        <div className={styles.mobileActionsWrap}>
          <MobileVideoActions
            videoId={video.videoId}
            title={video.title}
            video={video}
            baseUrl={baseUrl}
            startTimeSeconds={settings.rememberPlaybackPosition ? restoredPosition : 0}
            showSummaryAction={settings.hideDescriptionSection}
            onSummaryClick={openDescriptionSheet}
            showCommentsAction={isMobileViewport}
            onCommentsClick={openCommentsSheet}
            commentsLabel={`${t("watch.comments")}${typeof video.commentCount === "number" ? ` ${formatNumberJa(video.commentCount)}` : ""}`}
          />
        </div>
        {!settings.hideDescriptionSection && (
        <Card appearance="outline" className={styles.descriptionCard}>
          <Text weight="semibold">{t("watch.summary")}</Text>
          <div
            className={styles.descriptionContent}
            data-allow-user-select="true"
            data-allow-tap-highlight="true"
            style={{ maxHeight: showFullDesc ? "none" : "96px" }}
            dangerouslySetInnerHTML={{ __html: descriptionHtml }}
          />
          {isMobileViewport ? (
            <Button
              appearance="subtle"
              size="small"
              style={{ alignSelf: "flex-start" }}
              onClick={openDescriptionSheet}
            >
              {t("watch.showMore")}
            </Button>
          ) : (
            <Button
              appearance="subtle"
              size="small"
              style={{ alignSelf: "flex-start" }}
              onClick={() => setShowFullDesc((prev) => !prev)}
            >
              {showFullDesc ? t("common.close") : t("watch.showMore")}
            </Button>
          )}
        </Card>
        )}

        {chapters.length > 0 && (
          <Card appearance="outline" className={styles.descriptionCard}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Text weight="semibold">{t("watch.chapters")}</Text>
              <Button appearance="subtle" size="small" onClick={() => setShowChapters((prev) => !prev)}>
                {showChapters ? t("watch.collapse") : t("watch.expand")}
              </Button>
            </div>
            {showChapters && (
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                {chapters.map((chapter) => (
                  <div key={`${chapter.seconds}-${chapter.label}`} className={styles.chapterItem}>
                    <Text size={200}>{chapter.label}</Text>
                    <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>{formatDuration(chapter.seconds)}</Text>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {Array.isArray(captionsQuery.data) && captionsQuery.data.length > 0 && (
          <div className={styles.infoSection}>
            <Text weight="semibold">{t("watch.captions")}</Text>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {captionsQuery.data.map((caption, index) => (
                <Link
                  key={`${caption.languageCode ?? "caption"}-${index}`}
                  href={caption.url || "#"}
                  target="_blank"
                >
                  {caption.label || caption.languageCode || t("watch.captions")}
                  {settings.showCaptionsByDefault ? t("watch.captionsDefaultOn") : ""}
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className={styles.inlineCommentsDesktopOnly}>
          <Comments
            videoId={videoId}
            initiallyExpanded={settings.expandCommentsByDefault}
            onTimestampClick={(seconds) => {
              setCommentSeekSeconds(seconds);
              setResumePrompt(null);
            }}
          />
        </div>
      </div>

      <div className={styles.sideCol}>
        {queue.length > 0 && (
          <Card appearance="outline" className={styles.queueCard}>
            <div className={styles.queueHeader}>
              <Text weight="bold">{t("watch.playQueue")}</Text>
              <Button
                size="small"
                appearance="subtle"
                icon={<Delete16Regular />}
                onClick={() => setQueue([])}
              >
                {t("watch.clearQueue")}
              </Button>
            </div>
            <div className={styles.queueList}>
              {queue.map((item, index) => (
                <div key={`${item.videoId}-${index}`} className={styles.queueItem}>
                  <div className={styles.queueItemText}>
                    <Text size={200} className={styles.ellipsis}>
                      {index === 0 ? t("watch.nextItem", { title: item.title }) : item.title}
                    </Text>
                    <Text size={100} className={styles.ellipsis} style={{ color: tokens.colorNeutralForeground3 }}>
                      {item.author}
                    </Text>
                  </div>
                  <Button
                    size="small"
                    appearance="subtle"
                    icon={<Dismiss16Regular />}
                    aria-label={t("watch.removeFromQueueAria", { title: item.title })}
                    onClick={() => removeFromQueue(item.videoId)}
                  />
                </div>
              ))}
            </div>
          </Card>
        )}

        {!isMobileViewport && (
          <>
            <Divider />
            <Text weight="bold" size={400} style={{ marginBottom: "4px" }}>
              {t("watch.relatedVideos")}
            </Text>
          </>
        )}
        {relatedVideos.length === 0 ? (
          <EmptyState title={t("watch.noRelatedTitle")} description={t("watch.noRelatedDescription")} />
        ) : shouldVirtualizeRelated ? (
          <div ref={relatedListRef} style={{ maxHeight: "70vh", overflowY: "auto", overscrollBehavior: "contain" }}>
            <div style={{ height: relatedVirtualizer.getTotalSize(), position: "relative" }}>
              {relatedVirtualRows.map((virtualRow) => {
                const item = relatedVideos[virtualRow.index];
                if (!item) return null;
                return (
                  <div
                    key={`${item.videoId}-${item.title}-${virtualRow.index}`}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <div
                      className={styles.rowActions}
                      style={{
                        height: isMobileViewport ? "auto" : undefined,
                        display: isMobileViewport ? "block" : undefined,
                        marginBottom: isMobileViewport ? "12px" : undefined,
                        boxSizing: "border-box",
                      }}
                    >
                      <div className={styles.relatedCardWrap}>
                        <VideoCard video={item} horizontal={!isMobileViewport} />
                      </div>
                      {!isMobileViewport && (
                        <Menu positioning="below-end">
                          <MenuTrigger disableButtonEnhancement>
                            <Button
                              appearance="subtle"
                              icon={<MoreHorizontal20Regular />}
                              aria-label={t("watch.itemActionsAria", { title: item.title })}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </MenuTrigger>
                          <MenuPopover>
                            <MenuList>
                              <MenuItem
                                icon={<Add16Regular />}
                                disabled={queuedVideoIds.has(item.videoId)}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  enqueue({
                                    videoId: item.videoId,
                                    title: item.title,
                                    author: item.author,
                                  });
                                }}
                              >
                                {queuedVideoIds.has(item.videoId) ? t("watch.addedToQueue") : t("watch.addToQueue")}
                              </MenuItem>
                            </MenuList>
                          </MenuPopover>
                        </Menu>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          relatedVideos.map((item) => (
            <div
              key={`${item.videoId}-${item.title}`}
              className={styles.rowActions}
              style={{
                height: isMobileViewport ? "auto" : undefined,
                display: isMobileViewport ? "block" : undefined,
                marginBottom: isMobileViewport ? "12px" : undefined,
                boxSizing: "border-box",
              }}
            >
              <div className={styles.relatedCardWrap}>
                <VideoCard video={item} horizontal={!isMobileViewport} />
              </div>
              {!isMobileViewport && (
                <Menu positioning="below-end">
                  <MenuTrigger disableButtonEnhancement>
                    <Button
                      appearance="subtle"
                      icon={<MoreHorizontal20Regular />}
                      aria-label={t("watch.itemActionsAria", { title: item.title })}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </MenuTrigger>
                  <MenuPopover>
                    <MenuList>
                      <MenuItem
                        icon={<Add16Regular />}
                        disabled={queuedVideoIds.has(item.videoId)}
                        onClick={(e) => {
                          e.stopPropagation();
                          enqueue({
                            videoId: item.videoId,
                            title: item.title,
                            author: item.author,
                          });
                        }}
                      >
                        {queuedVideoIds.has(item.videoId) ? t("watch.addedToQueue") : t("watch.addToQueue")}
                      </MenuItem>
                    </MenuList>
                  </MenuPopover>
                </Menu>
              )}
            </div>
          ))
        )}
      </div>
      </div>
      {isDescriptionSheetOpen && isMobileViewport && (
        <div className={styles.mobileSheet} style={{ height: `${descriptionSheetHeightVh}vh` }}>
          <div
            className={styles.mobileSheetGrabberWrap}
            onPointerDown={(event) => startSheetDrag("description", event)}
            onPointerMove={moveSheetDrag}
            onPointerUp={endSheetDrag}
            onPointerCancel={endSheetDrag}
          >
            <div className={styles.mobileSheetGrabber} />
          </div>
          <div className={styles.mobileSheetHeader}>
            <Text weight="semibold">{t("watch.summary")}</Text>
            <Button appearance="subtle" icon={<Dismiss16Regular />} aria-label={t("common.close")} onClick={() => setIsDescriptionSheetOpen(false)} />
          </div>
          <div className={styles.sheetContent}>
            <div
              className={styles.descriptionContent}
              data-allow-user-select="true"
              data-allow-tap-highlight="true"
              style={{ maxHeight: "none" }}
              dangerouslySetInnerHTML={{ __html: descriptionHtml }}
            />
          </div>
        </div>
      )}

      {isCommentsSheetOpen && isMobileViewport && (
        <div className={styles.mobileSheet} style={{ height: `${commentsSheetHeightVh}vh` }}>
          <div
            className={styles.mobileSheetGrabberWrap}
            onPointerDown={(event) => startSheetDrag("comments", event)}
            onPointerMove={moveSheetDrag}
            onPointerUp={endSheetDrag}
            onPointerCancel={endSheetDrag}
          >
            <div className={styles.mobileSheetGrabber} />
          </div>
          <div className={styles.mobileSheetHeader}>
            <Text weight="semibold">{t("watch.comments")}</Text>
            <Button appearance="subtle" icon={<Dismiss16Regular />} aria-label={t("common.close")} onClick={() => setIsCommentsSheetOpen(false)} />
          </div>
          <div className={styles.sheetContent}>
            <Comments
              videoId={videoId}
              initiallyExpanded={true}
              onTimestampClick={(seconds) => {
                setCommentSeekSeconds(seconds);
                setResumePrompt(null);
                setIsCommentsSheetOpen(false);
              }}
            />
          </div>
        </div>
      )}
    </>
  );
};
