import type { PlaylistObject, VideoObject } from "../types/invidious";
import { createYouTubeClient } from "./youtubeJsClient";
import { getSettingsSnapshot } from "../store/settingsStore";

const textOf = (value: unknown): string => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const maybeText = value as { text?: string; toString?: () => string };
    if (typeof maybeText.text === "string") return maybeText.text;
    if (typeof maybeText.toString === "function") return maybeText.toString();
  }
  return "";
};

const toSeconds = (value: string): number => {
  const parts = value.split(":").map((part) => Number.parseInt(part, 10));
  if (!parts.length || parts.some((part) => Number.isNaN(part))) return 0;
  return parts.reduce((acc, part) => acc * 60 + part, 0);
};

const toThumbnails = (items: Array<{ url?: string; width?: number; height?: number }> | undefined) => {
  return (items || [])
    .filter((item) => typeof item?.url === "string" && !!item.url)
    .map((item, index) => ({
      quality: `q${index}`,
      url: item.url || "",
      width: item.width || 0,
      height: item.height || 0,
    }));
};

const mapVideoNode = (item: any): VideoObject | null => {
  const videoId = String(item?.video_id || item?.id || "").trim();
  if (!videoId) return null;
  const authorId = String(item?.author?.id || "").trim();
  const author = textOf(item?.author?.name) || textOf(item?.author) || "";
  const durationText = textOf(item?.duration?.text) || textOf(item?.length_text);
  const viewCountText = textOf(item?.view_count) || textOf(item?.short_view_count);
  const publishedText = textOf(item?.published);

  return {
    type: "video",
    title: textOf(item?.title) || "",
    videoId,
    author,
    authorId,
    authorUrl: authorId ? `/channel/${authorId}` : "",
    videoThumbnails: toThumbnails(item?.thumbnails),
    viewCountText,
    publishedText,
    lengthSeconds: durationText ? toSeconds(durationText) : 0,
    liveNow: Boolean(item?.is_live),
    isUpcoming: Boolean(item?.is_upcoming),
    is4k: Boolean(item?.is_4k),
    hasCaptions: Boolean(item?.has_captions),
  };
};

const mapPlaylistNode = (item: any): PlaylistObject | null => {
  const playlistId = String(item?.id || item?.playlist_id || item?.content_id || "").trim();
  if (!playlistId) return null;
  const authorId = String(item?.author?.id || "").trim();
  const thumbnails = toThumbnails(item?.thumbnails);
  const videoCount = Number.parseInt(textOf(item?.video_count).replace(/[^\d]/g, ""), 10);
  return {
    type: "playlist",
    title: textOf(item?.title) || "",
    playlistId,
    playlistThumbnail: thumbnails[0]?.url,
    author: textOf(item?.author?.name) || textOf(item?.author) || "",
    authorId: authorId || null,
    authorUrl: authorId ? `/channel/${authorId}` : null,
    videoCount: Number.isNaN(videoCount) ? undefined : videoCount,
  };
};

export const getYouTubeHomeFeedVideos = async (): Promise<VideoObject[]> => {
  const settings = getSettingsSnapshot();
  if (settings.youtubeAuthMode === "tv_oauth" && !settings.youtubeTvOauthCredentials.trim()) {
    throw new Error("YouTube TV OAuth2 credentials are not configured.");
  }
  const yt = await createYouTubeClient();
  const feed = await yt.getHomeFeed();
  return (feed.videos || []).map(mapVideoNode).filter((item): item is VideoObject => item !== null);
};

export const getYouTubeHistoryVideos = async (): Promise<VideoObject[]> => {
  const settings = getSettingsSnapshot();
  if (settings.youtubeAuthMode === "tv_oauth" && !settings.youtubeTvOauthCredentials.trim()) {
    throw new Error("YouTube TV OAuth2 credentials are not configured.");
  }
  const yt = await createYouTubeClient();
  const history = await yt.getHistory();
  return (history.videos || []).map(mapVideoNode).filter((item): item is VideoObject => item !== null);
};

export const getYouTubeLibraryPlaylists = async (): Promise<PlaylistObject[]> => {
  const settings = getSettingsSnapshot();
  if (settings.youtubeAuthMode === "tv_oauth" && !settings.youtubeTvOauthCredentials.trim()) {
    throw new Error("YouTube TV OAuth2 credentials are not configured.");
  }
  const yt = await createYouTubeClient();
  const library = await yt.getLibrary();
  const playlistsSection = library.playlists_section;
  if (!playlistsSection) return [];
  const sectionFeed = await playlistsSection.getAll();
  const playlists = (sectionFeed as { playlists?: unknown[] }).playlists || [];
  return playlists.map(mapPlaylistNode).filter((item): item is PlaylistObject => item !== null);
};

export const getYouTubeChannelVideos = async (authorId: string): Promise<VideoObject[]> => {
  if (!authorId.trim()) return [];
  const yt = await createYouTubeClient();
  const channel = await yt.getChannel(authorId.trim());
  const videosTab = await channel.getVideos();
  const rawItems = (videosTab as { videos?: unknown[] }).videos ?? [];
  return rawItems.map(mapVideoNode).filter((item): item is VideoObject => item !== null);
};
