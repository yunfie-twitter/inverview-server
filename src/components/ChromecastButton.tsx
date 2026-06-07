import { Button } from "@fluentui/react-components";
import { CastRegular } from "@fluentui/react-icons";
import axios from "axios";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { VideoDetails } from "../types/invidious";
import { pickPlayableStream, pickPosterThumbnail, resolveCompanionVideoPlaybackUrl, resolveMediaUrl } from "../lib/media";
import { getTvSessionId, setTvSessionId } from "../lib/tvSync";
import { useSettingsStore } from "../store/settingsStore";

const DEFAULT_RECEIVER_APP_ID = "924FBC0E";
const DASH_MIME = "application/dash+xml";
const HLS_MIME = "application/x-mpegURL";

type MediaSourceKind = "hls" | "dash" | "stream";

const inferContentType = (url: string, audioOnly: boolean, kind: MediaSourceKind): string => {
  if (kind === "dash") return DASH_MIME;
  if (kind === "hls") return HLS_MIME;
  const normalized = url.toLowerCase();
  if (normalized.includes(".mpd")) return DASH_MIME;
  if (normalized.includes(".m3u8")) return HLS_MIME;
  return audioOnly ? "audio/mp4" : "video/mp4";
};

const resolveReceiverAppId = (): string => {
  const configured = (import.meta.env.VITE_CHROMECAST_APP_ID || "").trim();
  return configured || DEFAULT_RECEIVER_APP_ID;
};

interface ChromecastButtonProps {
  video: VideoDetails;
  baseUrl: string;
  startTimeSeconds?: number;
}

export const ChromecastButton = ({
  video,
  baseUrl,
  startTimeSeconds = 0,
}: ChromecastButtonProps): JSX.Element | null => {
  const [isReady, setIsReady] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [lastError, setLastError] = useState("");

  const quality = useSettingsStore((state) => state.quality);
  const audioOnly = useSettingsStore((state) => state.audioOnly);
  const dataSaver = useSettingsStore((state) => state.dataSaver);
  const useProxyVideo = useSettingsStore((state) => state.useProxyVideo);
  const companionUrl = useSettingsStore((state) => state.companionUrl);

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

  const castCandidates = useMemo<Array<{ url: string; kind: MediaSourceKind }>>(() => {
    const candidates: Array<{ url: string; kind: MediaSourceKind }> = [];
    const pushUnique = (url: string, kind: MediaSourceKind) => {
      if (!url) return;
      if (candidates.some((item) => item.url === url)) return;
      candidates.push({ url, kind });
    };

    const dash = resolveMediaUrl(video.dashUrl, baseUrl);
    const hls = resolveMediaUrl(video.hlsUrl, baseUrl);
    pushUnique(dash, "dash");
    pushUnique(hls, "hls");

    const resolvedStreams = (video.formatStreams ?? []).map((item) => ({
      ...item,
      resolvedUrl: resolveMediaUrl(resolveCompanionVideoPlaybackUrl(item.url, useProxyVideo ? companionUrl : ""), baseUrl),
      containerLower: (item.container ?? "").toLowerCase(),
      typeLower: (item.type ?? "").toLowerCase(),
    }));
    const mp4 = resolvedStreams.find((item) =>
      item.resolvedUrl &&
      (item.containerLower.includes("mp4") || item.typeLower.includes("video/mp4") || item.typeLower.includes("audio/mp4")),
    );
    if (mp4?.resolvedUrl) pushUnique(mp4.resolvedUrl, "stream");
    if (stream?.url) pushUnique(stream.url, "stream");

    return candidates;
  }, [video.dashUrl, video.hlsUrl, video.formatStreams, baseUrl, stream, useProxyVideo, companionUrl]);
  const mediaUrl = castCandidates[0]?.url ?? "";
  const initialTvSessionId = useMemo(() => {
    if (typeof window === "undefined") return "";
    const fromQuery = new URLSearchParams(window.location.search).get("tvSession") || "";
    return fromQuery || getTvSessionId();
  }, []);
  const [tvSessionId, setTvSessionIdState] = useState(initialTvSessionId);
  const syncOrigin = useMemo(() => (typeof window !== "undefined" ? window.location.origin : ""), []);

  const ensureTvSessionId = useCallback(async (): Promise<string> => {
    if (tvSessionId) return tvSessionId;
    try {
      const response = await axios.post<{ sessionId?: string }>("/tv-sync/session", undefined, {
        validateStatus: () => true,
      });
      if (response.status < 200 || response.status >= 300) return "";
      const data = response.data;
      const created = (data.sessionId || "").trim();
      if (!created) return "";
      setTvSessionId(created);
      setTvSessionIdState(created);
      return created;
    } catch {
      return "";
    }
  }, [tvSessionId]);

  useEffect(() => {
    let castContext: InstanceType<typeof window.cast.framework.CastContext> | null = null;
    const onCastStateChanged = (event: { castState?: string }) => {
      console.info("[CAST] state:", event?.castState);
    };
    const onSessionStateChanged = (event: { sessionState?: string; errorCode?: string }) => {
      console.info("[CAST] session:", event?.sessionState, "errorCode:", event?.errorCode);
    };

    const setup = () => {
      if (!window.cast?.framework) return;
      const context = window.cast.framework.CastContext.getInstance();
      castContext = context;
      const appId = resolveReceiverAppId();
      context.setOptions({
        receiverApplicationId: appId,
        autoJoinPolicy: window.chrome?.cast?.AutoJoinPolicy?.ORIGIN_SCOPED,
      });

      context.addEventListener(
        window.cast.framework.CastContextEventType.CAST_STATE_CHANGED,
        onCastStateChanged,
      );
      context.addEventListener(
        window.cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
        onSessionStateChanged,
      );
      console.info("[CAST] initialized with appId:", appId);
      setIsReady(true);
    };

    if (window.cast?.framework) {
      setup();
      return;
    }

    const prev = window.__onGCastApiAvailable;
    window.__onGCastApiAvailable = (isAvailable: boolean) => {
      if (isAvailable) setup();
      if (typeof prev === "function") prev(isAvailable);
    };

    return () => {
      if (castContext && window.cast?.framework) {
        castContext.removeEventListener(
          window.cast.framework.CastContextEventType.CAST_STATE_CHANGED,
          onCastStateChanged,
        );
        castContext.removeEventListener(
          window.cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
          onSessionStateChanged,
        );
      }
      if (window.__onGCastApiAvailable === prev) return;
      window.__onGCastApiAvailable = prev;
    };
  }, []);

  const onCast = useCallback(async () => {
    if (!isReady || !mediaUrl || !window.cast?.framework) return;
    setIsConnecting(true);
    setLastError("");

    try {
      const castContext = window.cast.framework.CastContext.getInstance();
      const castSession = castContext.getCurrentSession();

      if (!castSession) {
        await castContext.requestSession();
      }

      const resolvedTvSessionId = await ensureTvSessionId();
      const session = castContext.getCurrentSession();
      if (!session) return;

      const poster = resolveMediaUrl(pickPosterThumbnail(video.videoThumbnails)?.url, baseUrl);
      const metadata = new window.chrome.cast.media.GenericMediaMetadata();
      metadata.title = video.title;
      metadata.subtitle = video.author;
      if (poster) {
        metadata.images = [new window.chrome.cast.Image(poster)];
      }

      let loaded = false;
      let lastLoadError: unknown = null;
      for (const candidate of castCandidates) {
        try {
          const mediaInfo = new window.chrome.cast.media.MediaInfo(
            candidate.url,
            inferContentType(candidate.url, audioOnly, candidate.kind),
          );
          mediaInfo.metadata = metadata;
          mediaInfo.streamType = window.chrome.cast.media.StreamType.BUFFERED;
          mediaInfo.customData = {
            videoId: video.videoId,
            baseUrl,
            sourceKind: candidate.kind,
            tvSessionId: resolvedTvSessionId,
            syncOrigin,
            apiBaseUrl: baseUrl,
          };

          const request = new window.chrome.cast.media.LoadRequest(mediaInfo);
          request.autoplay = true;
          request.currentTime = Math.max(0, startTimeSeconds);
          await session.loadMedia(request);
          loaded = true;
          break;
        } catch (loadError) {
          lastLoadError = loadError;
          console.warn("[CAST] load failed, trying next source", {
            url: candidate.url,
            kind: candidate.kind,
            loadError,
          });
        }
      }
      if (!loaded) {
        throw lastLoadError ?? new Error("All cast media sources failed to load.");
      }
    } catch (error: unknown) {
      // "cancel" is common when user closes device picker or doesn't choose a device.
      if (error === "cancel") {
        console.info("Cast session canceled by user.");
        return;
      }
      const castError = error as { code?: string; description?: string; details?: unknown };
      const message = [castError?.code, castError?.description].filter(Boolean).join(": ")
        || "Cast session error";
      setLastError(message);
      console.error("Failed to cast media", error, {
        appId: resolveReceiverAppId(),
        mediaUrl,
        castCandidates,
      });
    } finally {
      setIsConnecting(false);
    }
  }, [isReady, mediaUrl, castCandidates, video, baseUrl, startTimeSeconds, audioOnly, ensureTvSessionId, syncOrigin]);

  if (!isReady) return null;

  return (
    <Button
      appearance="outline"
      size="small"
      icon={<CastRegular />}
      disabled={!mediaUrl || isConnecting}
      onClick={() => {
        void onCast();
      }}
    >
      {isConnecting ? "接続中..." : lastError ? `Cast失敗: ${lastError}` : "Chromecast"}
    </Button>
  );
};
