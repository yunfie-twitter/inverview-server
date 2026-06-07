import type { ThumbnailObject } from "../types/invidious";
import type { QualityMode } from "../store/settingsStore";

const ABSOLUTE_URL_RE = /^https?:\/\//i;
const normalizeBase = (baseUrl: string): string => baseUrl.replace(/\/+$/, "");

export const isVideoPlaybackUrl = (url: string | undefined): boolean => {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return host.endsWith("googlevideo.com") || parsed.pathname.includes("/videoplayback");
  } catch {
    return url.includes("/videoplayback");
  }
};

export const resolveCompanionVideoPlaybackUrl = (url: string | undefined, companionUrl: string): string => {
  if (!url) return "";
  const trimmedCompanionUrl = companionUrl.trim();
  if (!trimmedCompanionUrl || !isVideoPlaybackUrl(url)) return url;

  try {
    const parsed = new URL(url);
    const companionBase = trimmedCompanionUrl.replace(/\/+$/, "").replace(/\/companion$/, "");
    const prefix = companionBase || "";
    return `${prefix}/companion/videoplayback${parsed.search}`;
  } catch {
    return url;
  }
};

export const resolveMediaUrl = (url: string | undefined, baseUrl: string): string => {
  if (!url) return "";

  if (baseUrl) {
    const base = normalizeBase(baseUrl);
    
    // Google User Content / Ggpht (YouTube avatar) -> Invidious ggpht proxy
    if (url.includes("yt3.ggpht.com/") || url.includes("yt3.googleusercontent.com/")) {
      const path = url.replace(/^https?:\/\/[^/]+\//, "");
      return `${base}/ggpht/${path}`;
    }
    
    // Ytimg (YouTube video thumbnail) -> Invidious vi proxy
    if (url.includes("i.ytimg.com/")) {
      const path = url.replace(/^https?:\/\/i\.ytimg\.com\//, "");
      return `${base}/${path}`;
    }
  }

  if (ABSOLUTE_URL_RE.test(url)) return url;
  if (url.startsWith("//")) return `https:${url}`;
  if (!baseUrl) return url;

  try {
    return new URL(url, `${normalizeBase(baseUrl)}/`).toString();
  } catch {
    return `${normalizeBase(baseUrl)}${url.startsWith("/") ? "" : "/"}${url}`;
  }
};

export const pickBestThumbnail = (thumbnails?: ThumbnailObject[]): ThumbnailObject | undefined => {
  if (!thumbnails || thumbnails.length === 0) return undefined;

  const valid = thumbnails.filter((item) => typeof item?.url === "string" && item.url.trim().length > 0);
  if (valid.length === 0) return undefined;

  let best = valid[0];
  let bestArea = (best.width || 0) * (best.height || 0);

  for (let i = 1; i < valid.length; i += 1) {
    const candidate = valid[i];
    const area = (candidate.width || 0) * (candidate.height || 0);
    if (area > bestArea) {
      best = candidate;
      bestArea = area;
    }
  }

  return best;
};

export const pickPosterThumbnail = (thumbnails?: ThumbnailObject[]): ThumbnailObject | undefined => {
  if (!thumbnails || thumbnails.length === 0) return undefined;
  let best = thumbnails[0];
  let bestScore = Math.abs((best.width || 0) - 1280);

  for (let i = 1; i < thumbnails.length; i += 1) {
    const candidate = thumbnails[i];
    const score = Math.abs((candidate.width || 0) - 1280);
    if (score < bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return best;
};

interface StreamLike {
  url: string;
  container?: string;
  qualityLabel?: string;
  resolution?: string;
  type?: string;
}

interface StreamSelectOptions {
  quality?: QualityMode;
  dataSaver?: boolean;
  audioOnly?: boolean;
}

const parseHeight = (stream: StreamLike): number => {
  const quality = stream.qualityLabel ?? stream.resolution ?? "";
  return Number.parseInt(quality.replace(/[^0-9]/g, ""), 10) || 0;
};

export const pickPlayableStream = (
  streams: StreamLike[] | undefined,
  options: StreamSelectOptions = {},
): StreamLike | undefined => {
  if (!streams?.length) return undefined;

  const preferredLimit = options.quality && options.quality !== "auto"
    ? Number.parseInt(options.quality.replace("p", ""), 10)
    : options.dataSaver
      ? 480
      : 1080;

  const scoreStream = (stream: StreamLike): number => {
    const height = parseHeight(stream);
    const container = stream.container ?? "";
    const containerScore = container.includes("mp4") ? 1000 : container.includes("webm") ? 900 : 800;
    const penalty = height > preferredLimit ? (height - preferredLimit) * 4 : preferredLimit - height;
    return containerScore * 10_000 - penalty;
  };

  let bestTyped: StreamLike | undefined;
  let bestTypedScore = Number.NEGATIVE_INFINITY;
  let bestFallback: StreamLike | undefined;
  let bestFallbackScore = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < streams.length; index += 1) {
    const stream = streams[index];
    const score = scoreStream(stream);

    if (score > bestFallbackScore) {
      bestFallback = stream;
      bestFallbackScore = score;
    }

    if (!options.audioOnly || !(stream.type ?? stream.container ?? "").includes("audio")) continue;
    if (score > bestTypedScore) {
      bestTyped = stream;
      bestTypedScore = score;
    }
  }

  return bestTyped ?? bestFallback;
};
