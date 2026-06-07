import axios, { type Method } from "axios";
import { getSettingsSnapshot } from "../store/settingsStore";
import { getApiCache, setApiCache } from "./cacheDb";
import { elapsedMsSince, nowMs } from "./time";
import { parseJson } from "./safeJson";
import type {
  AuthFeedResponse,
  AuthPlaylistsResponse,
  AuthSubscriptionsResponse,
  Caption,
  ChannelDetails,
  ChannelPlaylistsResponse,
  ChannelVideosResponse,
  CommentsResponse,
  InvidiousStats,
  PlaylistObject,
  Preferences,
  SearchResultObject,
  VideoDetails,
  VideoObject,
} from "../types/invidious";

export class ApiError extends Error {
  status?: number;
  endpoint?: string;
  causeBody?: unknown;

  constructor(message: string, options?: { status?: number; endpoint?: string; causeBody?: unknown }) {
    super(message);
    this.name = "ApiError";
    this.status = options?.status;
    this.endpoint = options?.endpoint;
    this.causeBody = options?.causeBody;
  }
}

type SearchParamValue = string | number | boolean | null | undefined;

type RequestOptions = {
  searchParams?: Record<string, SearchParamValue>;
  method?: "GET" | "POST" | "DELETE" | "PUT";
  json?: unknown;
  signal?: AbortSignal;
  needAuth?: boolean;
  cacheTtlMs?: number;
};
type InFlightRecord = {
  startedAt: number;
  promise: Promise<unknown>;
};

export interface SearchVideosParams {
  q: string;
  page?: number;
  type?: "all" | "video" | "playlist" | "channel";
  sort_by?: "relevance" | "views";
  duration?: "short" | "medium" | "long";
  features?: Array<"hd" | "subtitles" | "4k" | "live" | "360" | "hdr" | "vr180">;
  region?: string;
}

export interface ListParams {
  continuation?: string;
  sort_by?: "newest" | "popular" | "oldest";
}

const normalizeBaseUrl = (baseUrl: string): string => baseUrl.replace(/\/+$/, "");

const buildApiUrl = (path: string, baseUrl: string): string => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const withPrefix = normalizedPath.startsWith("/api/v1") ? normalizedPath : `/api/v1${normalizedPath}`;
  if (!baseUrl) return withPrefix;
  return `${normalizeBaseUrl(baseUrl)}${withPrefix}`;
};

const toSearchParams = (input: Record<string, SearchParamValue>): URLSearchParams => {
  const params = new URLSearchParams();
  Object.entries(input).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    params.set(key, String(value));
  });
  return params;
};

const getErrorMessage = (endpoint: string, status?: number): string => {
  if (status === 401 || status === 403) return "認証が必要です。トークン設定を確認してください。";
  if (status === 404) return "指定されたデータが見つかりません。";
  if (endpoint.includes("/videos/")) return "動画情報を取得できません。";
  if (endpoint.includes("/stats")) return "インスタンスが応答していません。";
  return "API の呼び出しに失敗しました。";
};

const inFlightRequests = new Map<string, InFlightRecord>();
const IN_FLIGHT_DEDUPE_WINDOW_MS = 20_000;

async function requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { apiBaseUrl, apiProxyUrl, token, language, region } = getSettingsSnapshot();
  const effectiveBaseUrl = (apiProxyUrl || apiBaseUrl || "").trim();
  const endpoint = buildApiUrl(path, effectiveBaseUrl);

  const searchParams = toSearchParams({
    hl: language || "ja",
    region: region || "JP",
    ...options.searchParams,
  });

  const url = searchParams.toString() ? `${endpoint}?${searchParams.toString()}` : endpoint;
  const useCache = (options.method ?? "GET") === "GET" && !options.needAuth && (options.cacheTtlMs ?? 0) > 0;
  const cacheKey = `api:${url}`;
  const inFlightKey = `${options.method ?? "GET"}:${url}:${options.needAuth ? "auth" : "public"}`;

  if (useCache) {
    const cached = await getApiCache<T>(cacheKey);
    if (cached !== undefined) return cached;
  }

  const existingInFlight = inFlightRequests.get(inFlightKey);
  if (existingInFlight && elapsedMsSince(existingInFlight.startedAt) < IN_FLIGHT_DEDUPE_WINDOW_MS) {
    return existingInFlight.promise as Promise<T>;
  }

  const requestHeaders: Record<string, string> = {};
  if (options.json !== undefined) {
    requestHeaders["Content-Type"] = "application/json";
  }
  if (options.needAuth && token) {
    requestHeaders.Authorization = `Bearer ${token}`;
  }

  const requestPromise = (async (): Promise<T> => {
    let response: Awaited<ReturnType<typeof axios.request<string>>>;
    try {
      response = await axios.request<string>({
        url,
        method: (options.method ?? "GET") as Method,
        headers: requestHeaders,
        data: options.json,
        signal: options.signal,
        responseType: "text",
        transformResponse: [(data) => data],
        validateStatus: () => true,
      });
    } catch (error) {
      throw new ApiError("インスタンスが応答していません。API Base URL を確認してください。", {
        endpoint,
        causeBody: error,
      });
    }

    if (response.status >= 400) {
      const body = response.data ?? "";
      throw new ApiError(getErrorMessage(path, response.status), {
        status: response.status,
        endpoint,
        causeBody: body,
      });
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const contentType = String(response.headers["content-type"] ?? "");
    if (contentType.includes("application/json")) {
      const json = response.data ? parseJson(response.data) as T : undefined as T;
      if (useCache) {
        await setApiCache(cacheKey, json, options.cacheTtlMs ?? 0);
      }
      return json;
    }

    const text = response.data ?? "";
    if (!text) return undefined as T;

    try {
      const parsed = parseJson(text) as T;
      if (useCache) {
        await setApiCache(cacheKey, parsed, options.cacheTtlMs ?? 0);
      }
      return parsed;
    } catch {
      return text as T;
    }
  })();

  inFlightRequests.set(inFlightKey, { startedAt: nowMs(), promise: requestPromise });
  try {
    return await requestPromise;
  } finally {
    if (inFlightRequests.get(inFlightKey)?.promise === requestPromise) {
      inFlightRequests.delete(inFlightKey);
    }
  }
}

export const getStats = (signal?: AbortSignal) => requestJson<InvidiousStats>("/stats", { signal, cacheTtlMs: 1000 * 30 });
export const getPopular = (signal?: AbortSignal) => requestJson<VideoObject[]>("/popular", { signal, cacheTtlMs: 1000 * 60 * 2 });

export const getTrending = (type = "default", region?: string, signal?: AbortSignal) =>
  requestJson<VideoObject[]>("/trending", {
    searchParams: {
      type: type === "default" ? undefined : type,
      region: region || "JP",
    },
    signal,
    cacheTtlMs: 1000 * 60 * 2,
  });

export const searchVideos = (params: SearchVideosParams, signal?: AbortSignal) => {
  const { q, page, type = "all", sort_by, duration, features, region } = params;
  const searchParams: Record<string, SearchParamValue> = { q, page, sort_by, duration, region };
  if (type !== "all") searchParams.type = type;
  if (features?.length) searchParams.features = features.join(",");
  return requestJson<SearchResultObject[]>("/search", { searchParams, signal, cacheTtlMs: 1000 * 60 * 5 });
};

export const getSearchSuggestions = (q: string, signal?: AbortSignal) =>
  requestJson<string[] | { suggestions?: string[] }>("/search/suggestions", {
    searchParams: { q },
    signal,
    cacheTtlMs: 1000 * 45,
  });

export const getVideo = (videoId: string, signal?: AbortSignal) =>
  requestJson<VideoDetails>(`/videos/${videoId}`, { signal, searchParams: { region: "JP" }, cacheTtlMs: 1000 * 60 * 10 });

export const getComments = (videoId: string, sortBy: "top" | "new" = "top", continuation?: string, signal?: AbortSignal) =>
  requestJson<CommentsResponse>(`/comments/${videoId}`, {
    searchParams: { sort_by: sortBy, continuation },
    signal,
    cacheTtlMs: continuation ? 1000 * 20 : 1000 * 60,
  });

export const getCaptions = (videoId: string, params?: Record<string, SearchParamValue>, signal?: AbortSignal) =>
  requestJson<Caption[]>(`/captions/${videoId}`, { searchParams: params, signal, cacheTtlMs: 1000 * 60 * 5 });

export const getChannel = (authorId: string, signal?: AbortSignal) =>
  requestJson<ChannelDetails>(`/channels/${authorId}`, { signal, cacheTtlMs: 1000 * 60 * 10 });

export const getChannelVideos = (authorId: string, params: ListParams = {}, signal?: AbortSignal) =>
  requestJson<ChannelVideosResponse>(`/channels/${authorId}/videos`, {
    searchParams: { continuation: params.continuation, sort_by: params.sort_by ?? "newest" },
    signal,
  });

export const getChannelShorts = (authorId: string, params: ListParams = {}, signal?: AbortSignal) =>
  requestJson<ChannelVideosResponse>(`/channels/${authorId}/shorts`, {
    searchParams: { continuation: params.continuation },
    signal,
  });

export const getChannelStreams = (authorId: string, params: ListParams = {}, signal?: AbortSignal) =>
  requestJson<ChannelVideosResponse>(`/channels/${authorId}/streams`, {
    searchParams: { continuation: params.continuation },
    signal,
  });

export const getChannelPlaylists = (authorId: string, params: ListParams = {}, signal?: AbortSignal) =>
  requestJson<ChannelPlaylistsResponse>(`/channels/${authorId}/playlists`, {
    searchParams: { continuation: params.continuation },
    signal,
  });

export const getPlaylist = (playlistId: string, page = 1, signal?: AbortSignal) =>
  requestJson<PlaylistObject>(`/playlists/${playlistId}`, { searchParams: { page }, signal });

export const getAuthFeed = (params?: { page?: number }, signal?: AbortSignal) =>
  requestJson<AuthFeedResponse>("/auth/feed", {
    searchParams: { page: params?.page ?? 1 },
    needAuth: true,
    signal,
  });

export const getAuthPlaylists = (signal?: AbortSignal) => requestJson<AuthPlaylistsResponse>("/auth/playlists", { needAuth: true, signal });
export const getAuthSubscriptions = (signal?: AbortSignal) => requestJson<AuthSubscriptionsResponse>("/auth/subscriptions", { needAuth: true, signal });
export const addSubscription = (ucid: string, signal?: AbortSignal) => requestJson<void>(`/auth/subscriptions/${ucid}`, { method: "POST", needAuth: true, signal });
export const removeSubscription = (ucid: string, signal?: AbortSignal) => requestJson<void>(`/auth/subscriptions/${ucid}`, { method: "DELETE", needAuth: true, signal });
export const getPreferences = (signal?: AbortSignal) => requestJson<Preferences>("/auth/preferences", { needAuth: true, signal });
export const updatePreferences = (body: Partial<Preferences>, signal?: AbortSignal) =>
  requestJson<Preferences>("/auth/preferences", { method: "POST", needAuth: true, json: body, signal });
