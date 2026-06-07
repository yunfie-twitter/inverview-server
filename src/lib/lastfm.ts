import axios from "axios";
import type { AppSettings } from "../settings/types";
import type { VideoDetails } from "../types/invidious";
import { nowUnixSeconds } from "./time";

const LASTFM_API_URL = "https://ws.audioscrobbler.com/2.0/";

const postLastFm = async <T = unknown>(params: Record<string, string>): Promise<T> => {
  const response = await axios.post<T>(LASTFM_API_URL, new URLSearchParams(params), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    validateStatus: () => true,
  });
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Last.fm request failed: ${response.status}`);
  }
  return response.data;
};

const md5 = (input: string): string => {
  function rotateLeft(value: number, shift: number): number {
    return (value << shift) | (value >>> (32 - shift));
  }
  function addUnsigned(x: number, y: number): number {
    const x4 = x & 0x40000000;
    const y4 = y & 0x40000000;
    const x8 = x & 0x80000000;
    const y8 = y & 0x80000000;
    const result = (x & 0x3fffffff) + (y & 0x3fffffff);
    if (x4 & y4) return result ^ 0x80000000 ^ x8 ^ y8;
    if (x4 | y4) return (result & 0x40000000) ? (result ^ 0xc0000000 ^ x8 ^ y8) : (result ^ 0x40000000 ^ x8 ^ y8);
    return result ^ x8 ^ y8;
  }
  function f(x: number, y: number, z: number): number { return (x & y) | (~x & z); }
  function g(x: number, y: number, z: number): number { return (x & z) | (y & ~z); }
  function h(x: number, y: number, z: number): number { return x ^ y ^ z; }
  function i(x: number, y: number, z: number): number { return y ^ (x | ~z); }
  function ff(a: number, b: number, c: number, d: number, x: number, s: number, ac: number): number { return addUnsigned(rotateLeft(addUnsigned(addUnsigned(a, f(b, c, d)), addUnsigned(x, ac)), s), b); }
  function gg(a: number, b: number, c: number, d: number, x: number, s: number, ac: number): number { return addUnsigned(rotateLeft(addUnsigned(addUnsigned(a, g(b, c, d)), addUnsigned(x, ac)), s), b); }
  function hh(a: number, b: number, c: number, d: number, x: number, s: number, ac: number): number { return addUnsigned(rotateLeft(addUnsigned(addUnsigned(a, h(b, c, d)), addUnsigned(x, ac)), s), b); }
  function ii(a: number, b: number, c: number, d: number, x: number, s: number, ac: number): number { return addUnsigned(rotateLeft(addUnsigned(addUnsigned(a, i(b, c, d)), addUnsigned(x, ac)), s), b); }
  function toWordArray(str: string): number[] {
    const msgLength = str.length;
    const words = [];
    let i = 0;
    while (i < msgLength) {
      words[i >> 2] = words[i >> 2] || 0;
      words[i >> 2] |= str.charCodeAt(i) << ((i % 4) * 8);
      i += 1;
    }
    words[i >> 2] = words[i >> 2] || 0;
    words[i >> 2] |= 0x80 << ((i % 4) * 8);
    words[(((i + 8) >> 6) + 1) * 16 - 2] = msgLength * 8;
    return words;
  }
  function toHex(value: number): string {
    let result = "";
    for (let j = 0; j <= 3; j += 1) {
      const byte = (value >>> (j * 8)) & 255;
      result += (`0${byte.toString(16)}`).slice(-2);
    }
    return result;
  }

  const x = toWordArray(unescape(encodeURIComponent(input)));
  let a = 0x67452301;
  let b = 0xefcdab89;
  let c = 0x98badcfe;
  let d = 0x10325476;

  for (let k = 0; k < x.length; k += 16) {
    const aa = a; const bb = b; const cc = c; const dd = d;
    a = ff(a, b, c, d, x[k + 0], 7, 0xd76aa478); d = ff(d, a, b, c, x[k + 1], 12, 0xe8c7b756); c = ff(c, d, a, b, x[k + 2], 17, 0x242070db); b = ff(b, c, d, a, x[k + 3], 22, 0xc1bdceee);
    a = ff(a, b, c, d, x[k + 4], 7, 0xf57c0faf); d = ff(d, a, b, c, x[k + 5], 12, 0x4787c62a); c = ff(c, d, a, b, x[k + 6], 17, 0xa8304613); b = ff(b, c, d, a, x[k + 7], 22, 0xfd469501);
    a = ff(a, b, c, d, x[k + 8], 7, 0x698098d8); d = ff(d, a, b, c, x[k + 9], 12, 0x8b44f7af); c = ff(c, d, a, b, x[k + 10], 17, 0xffff5bb1); b = ff(b, c, d, a, x[k + 11], 22, 0x895cd7be);
    a = ff(a, b, c, d, x[k + 12], 7, 0x6b901122); d = ff(d, a, b, c, x[k + 13], 12, 0xfd987193); c = ff(c, d, a, b, x[k + 14], 17, 0xa679438e); b = ff(b, c, d, a, x[k + 15], 22, 0x49b40821);
    a = gg(a, b, c, d, x[k + 1], 5, 0xf61e2562); d = gg(d, a, b, c, x[k + 6], 9, 0xc040b340); c = gg(c, d, a, b, x[k + 11], 14, 0x265e5a51); b = gg(b, c, d, a, x[k + 0], 20, 0xe9b6c7aa);
    a = gg(a, b, c, d, x[k + 5], 5, 0xd62f105d); d = gg(d, a, b, c, x[k + 10], 9, 0x02441453); c = gg(c, d, a, b, x[k + 15], 14, 0xd8a1e681); b = gg(b, c, d, a, x[k + 4], 20, 0xe7d3fbc8);
    a = gg(a, b, c, d, x[k + 9], 5, 0x21e1cde6); d = gg(d, a, b, c, x[k + 14], 9, 0xc33707d6); c = gg(c, d, a, b, x[k + 3], 14, 0xf4d50d87); b = gg(b, c, d, a, x[k + 8], 20, 0x455a14ed);
    a = gg(a, b, c, d, x[k + 13], 5, 0xa9e3e905); d = gg(d, a, b, c, x[k + 2], 9, 0xfcefa3f8); c = gg(c, d, a, b, x[k + 7], 14, 0x676f02d9); b = gg(b, c, d, a, x[k + 12], 20, 0x8d2a4c8a);
    a = hh(a, b, c, d, x[k + 5], 4, 0xfffa3942); d = hh(d, a, b, c, x[k + 8], 11, 0x8771f681); c = hh(c, d, a, b, x[k + 11], 16, 0x6d9d6122); b = hh(b, c, d, a, x[k + 14], 23, 0xfde5380c);
    a = hh(a, b, c, d, x[k + 1], 4, 0xa4beea44); d = hh(d, a, b, c, x[k + 4], 11, 0x4bdecfa9); c = hh(c, d, a, b, x[k + 7], 16, 0xf6bb4b60); b = hh(b, c, d, a, x[k + 10], 23, 0xbebfbc70);
    a = hh(a, b, c, d, x[k + 13], 4, 0x289b7ec6); d = hh(d, a, b, c, x[k + 0], 11, 0xeaa127fa); c = hh(c, d, a, b, x[k + 3], 16, 0xd4ef3085); b = hh(b, c, d, a, x[k + 6], 23, 0x04881d05);
    a = hh(a, b, c, d, x[k + 9], 4, 0xd9d4d039); d = hh(d, a, b, c, x[k + 12], 11, 0xe6db99e5); c = hh(c, d, a, b, x[k + 15], 16, 0x1fa27cf8); b = hh(b, c, d, a, x[k + 2], 23, 0xc4ac5665);
    a = ii(a, b, c, d, x[k + 0], 6, 0xf4292244); d = ii(d, a, b, c, x[k + 7], 10, 0x432aff97); c = ii(c, d, a, b, x[k + 14], 15, 0xab9423a7); b = ii(b, c, d, a, x[k + 5], 21, 0xfc93a039);
    a = ii(a, b, c, d, x[k + 12], 6, 0x655b59c3); d = ii(d, a, b, c, x[k + 3], 10, 0x8f0ccc92); c = ii(c, d, a, b, x[k + 10], 15, 0xffeff47d); b = ii(b, c, d, a, x[k + 1], 21, 0x85845dd1);
    a = ii(a, b, c, d, x[k + 8], 6, 0x6fa87e4f); d = ii(d, a, b, c, x[k + 15], 10, 0xfe2ce6e0); c = ii(c, d, a, b, x[k + 6], 15, 0xa3014314); b = ii(b, c, d, a, x[k + 13], 21, 0x4e0811a1);
    a = ii(a, b, c, d, x[k + 4], 6, 0xf7537e82); d = ii(d, a, b, c, x[k + 11], 10, 0xbd3af235); c = ii(c, d, a, b, x[k + 2], 15, 0x2ad7d2bb); b = ii(b, c, d, a, x[k + 9], 21, 0xeb86d391);
    a = addUnsigned(a, aa); b = addUnsigned(b, bb); c = addUnsigned(c, cc); d = addUnsigned(d, dd);
  }

  return (toHex(a) + toHex(b) + toHex(c) + toHex(d)).toLowerCase();
};

const createApiSig = (params: Record<string, string>, apiSecret: string): string => {
  const sortedKeys = Object.keys(params).sort();
  const payload = sortedKeys.map((key) => `${key}${params[key]}`).join("") + apiSecret;
  return md5(payload);
};

const formatTrackTitle = (input: string, artist: string, settings: AppSettings): string => {
  const raw = input.trim();
  if (settings.lastFmTitleFormatMode === "raw") return raw;

  let result = raw;
  if (settings.lastFmTrimArtistPrefix) {
    const escapedArtist = artist.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const artistPrefixPattern = new RegExp(`^\\s*${escapedArtist}\\s*[-–—]\\s*`, "i");
    result = result.replace(artistPrefixPattern, "");
  }
  if (settings.lastFmTrimBracketTags) {
    result = result.replace(/\s*[\(\[][^)\]]*(official|mv|music\s*video|lyrics?|lyric|ver\.?|version)[^)\]]*[\)\]]/gi, "");
  }
  if (settings.lastFmTrimDashTags) {
    result = result.replace(/\s*-\s*(official|mv|music\s*video|lyrics?|lyric|ver\.?|version)\b.*$/gi, "");
  }
  if (settings.lastFmTrimFeaturingSuffix) {
    result = result.replace(/\s+(feat\.?|ft\.?)\s+.+$/gi, "");
  }

  return result.replace(/\s{2,}/g, " ").trim();
};

const getTrackAndArtist = (video: VideoDetails, settings: AppSettings): { artist: string; track: string } | null => {
  const firstTrack = video.musicTracks?.[0];
  const artist = firstTrack?.artist?.trim() || video.author?.trim();
  const rawTrack = firstTrack?.song?.trim() || video.title?.trim();
  if (!artist || !rawTrack) return null;
  const track = formatTrackTitle(rawTrack, artist, settings);
  if (!track) return null;
  return { artist, track };
};

export const scrobbleMusicVideo = async (video: VideoDetails, settings: AppSettings): Promise<void> => {
  if (!settings.lastFmEnabled || !settings.lastFmScrobbleEnabled) return;
  if (!settings.lastFmApiKey.trim() || !settings.lastFmApiSecret.trim() || !settings.lastFmSessionKey.trim()) return;

  const payload = getTrackAndArtist(video, settings);
  if (!payload) return;

  const params: Record<string, string> = {
    method: "track.scrobble",
    api_key: settings.lastFmApiKey.trim(),
    sk: settings.lastFmSessionKey.trim(),
    artist: payload.artist,
    track: payload.track,
    timestamp: String(nowUnixSeconds()),
  };
  params.api_sig = createApiSig(params, settings.lastFmApiSecret.trim());
  params.format = "json";

  await postLastFm(params);
};

export const updateNowPlayingMusicVideo = async (video: VideoDetails, settings: AppSettings): Promise<void> => {
  if (!settings.lastFmEnabled || !settings.lastFmScrobbleEnabled) return;
  if (!settings.lastFmApiKey.trim() || !settings.lastFmApiSecret.trim() || !settings.lastFmSessionKey.trim()) return;

  const payload = getTrackAndArtist(video, settings);
  if (!payload) return;

  const params: Record<string, string> = {
    method: "track.updateNowPlaying",
    api_key: settings.lastFmApiKey.trim(),
    sk: settings.lastFmSessionKey.trim(),
    artist: payload.artist,
    track: payload.track,
  };
  params.api_sig = createApiSig(params, settings.lastFmApiSecret.trim());
  params.format = "json";

  await postLastFm(params);
};

interface LastFmSessionResponse {
  session?: {
    name?: string;
    key?: string;
  };
  error?: number;
  message?: string;
}

export const getLastFmSessionFromToken = async (
  apiKey: string,
  apiSecret: string,
  token: string,
): Promise<{ username: string; sessionKey: string }> => {
  const params: Record<string, string> = {
    method: "auth.getSession",
    api_key: apiKey.trim(),
    token: token.trim(),
  };
  params.api_sig = createApiSig(params, apiSecret.trim());
  params.format = "json";

  const data = await postLastFm<LastFmSessionResponse>(params);
  if (data.error || !data.session?.key || !data.session?.name) {
    throw new Error(data.message || "Last.fm auth.getSession failed");
  }

  return {
    username: data.session.name,
    sessionKey: data.session.key,
  };
};
