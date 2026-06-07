import Innertube, { ClientType, type OAuth2Tokens } from "youtubei.js";
import ky from "ky";
import { z } from "zod";
import { getSettingsSnapshot } from "../store/settingsStore";
import { parseJsonWithSchema } from "./safeJson";

const normalizeProxyBase = (value: string): string => {
  const trimmed = (value || "").trim();
  return trimmed || "/youtubejs-proxy";
};

const getRequestUrl = (input: RequestInfo | URL): string => {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
};

const getAuthCredentials = (): OAuth2Tokens | undefined => {
  const { youtubeTvOauthCredentials } = getSettingsSnapshot();
  const raw = (youtubeTvOauthCredentials || "").trim();
  if (!raw) return undefined;
  return parseJsonWithSchema(raw, z.custom<OAuth2Tokens>((value) => typeof value === "object" && value !== null), undefined);
};

const createProxyFetch = (proxyBase: string): typeof fetch => {
  return async (input, init) => {
    const settings = getSettingsSnapshot();
    const request = new Request(input, init);
    const target = getRequestUrl(input);
    const proxiedUrl = `${proxyBase}?url=${encodeURIComponent(target)}`;
    const headers = new Headers(request.headers);
    if (settings.youtubeAuthMode === "cookie" && settings.youtubeCookie.trim()) {
      headers.set("x-ytjs-cookie", settings.youtubeCookie.trim());
    }
    const proxiedInit: RequestInit = {
      method: request.method,
      headers,
      body: request.body,
      redirect: "manual",
      signal: request.signal,
    };
    return ky(proxiedUrl, {
      ...proxiedInit,
      throwHttpErrors: false,
    });
  };
};

export const createYouTubeClient = async (): Promise<Innertube> => {
  const settings = getSettingsSnapshot();
  const proxyBase = normalizeProxyBase(settings.youtubeJsProxyUrl);
  const fetchImpl = createProxyFetch(proxyBase);
  const cookie = (settings.youtubeAuthMode === "cookie" ? settings.youtubeCookie : "").trim() || undefined;
  const yt = await Innertube.create({
    fetch: fetchImpl,
    cookie,
    client_type: settings.youtubeAuthMode === "tv_oauth" ? ClientType.TV : undefined,
  });

  if (settings.youtubeAuthMode === "tv_oauth") {
    const credentials = getAuthCredentials();
    if (credentials) {
      await yt.session.signIn(credentials);
    }
  }
  return yt;
};

export const clearYouTubeTvOauthCredentials = async (): Promise<void> => {
  const yt = await createYouTubeClient();
  await yt.session.signOut();
};
