type WorkerEnv = {
  COMPANION_URL?: string;
  COMPANION_SECRET?: string;
  API_PROXY_UPSTREAM?: string;
  VITE_API_BASE_URL?: string;
  VITE_INVIDIOUS_API_BASE_URL?: string;
};

type TvCommand = {
  id: string;
  videoId: string;
  sentAt: number;
};

type TvSession = {
  id: string;
  createdAt: number;
  updatedAt: number;
  lastCommand: TvCommand | null;
};

const PRIMARY_COMPANION_URL = "https://companion.tsub4sa.xyz";
const FALLBACK_COMPANION_URL = "https://proxy.tsub4sa.xyz";
const DEFAULT_API_PROXY_UPSTREAM = "https://invidious.tsub4sa.xyz";
const SESSION_TTL_MS = 1000 * 60 * 60 * 6;
const tvSessions = new Map<string, TvSession>();

const firstNonEmpty = (...values: Array<string | undefined>): string => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
};

const json = (body: unknown, init: ResponseInit = {}): Response => {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), { ...init, headers });
};

const withCors = (response: Response): Response => {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,HEAD,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "*");
  headers.set("X-InverView-Runtime", "cloudflare-worker");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

const cleanupExpiredSessions = (): void => {
  const now = Date.now();
  for (const [sessionId, session] of tvSessions.entries()) {
    if (now - session.updatedAt > SESSION_TTL_MS) {
      tvSessions.delete(sessionId);
    }
  }
};

const createTvSession = (): { sessionId: string; expiresInMs: number } => {
  cleanupExpiredSessions();
  const sessionId = crypto.randomUUID();
  const now = Date.now();
  tvSessions.set(sessionId, {
    id: sessionId,
    createdAt: now,
    updatedAt: now,
    lastCommand: null,
  });
  return { sessionId, expiresInMs: SESSION_TTL_MS };
};

const stripProxyHeaders = (headers: Headers, extraBlocked: string[] = []): Headers => {
  const blocked = new Set([
    "host",
    "content-length",
    "transfer-encoding",
    "connection",
    "keep-alive",
    "proxy-connection",
    "upgrade",
    "te",
    "trailer",
    ...extraBlocked,
  ]);
  const output = new Headers();
  headers.forEach((value, key) => {
    if (!blocked.has(key.toLowerCase())) output.set(key, value);
  });
  return output;
};

const stripResponseHeaders = (headers: Headers): Headers => {
  const blocked = new Set([
    "connection",
    "transfer-encoding",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "upgrade",
    "content-length",
  ]);
  const output = new Headers();
  headers.forEach((value, key) => {
    if (!blocked.has(key.toLowerCase())) output.set(key, value);
  });
  return output;
};

const buildConfig = (env: WorkerEnv) => ({
  companionUrl: firstNonEmpty(env.COMPANION_URL, PRIMARY_COMPANION_URL, FALLBACK_COMPANION_URL),
  companionSecret: env.COMPANION_SECRET || "",
  apiProxyUpstream: firstNonEmpty(env.API_PROXY_UPSTREAM, env.VITE_API_BASE_URL, env.VITE_INVIDIOUS_API_BASE_URL, DEFAULT_API_PROXY_UPSTREAM),
});

const proxyToUpstream = async (request: Request, upstreamBase: string, prefix: string, rewritePrefix: string, extraHeaders?: HeadersInit): Promise<Response> => {
  const sourceUrl = new URL(request.url);
  const upstreamUrl = new URL(upstreamBase);
  const suffix = sourceUrl.pathname.slice(prefix.length);
  upstreamUrl.pathname = `${upstreamUrl.pathname.replace(/\/+$/, "")}${rewritePrefix}${suffix}`;
  upstreamUrl.search = sourceUrl.search;

  const headers = stripProxyHeaders(request.headers);
  if (extraHeaders) {
    new Headers(extraHeaders).forEach((value, key) => headers.set(key, value));
  }

  const response = await fetch(upstreamUrl.toString(), {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    redirect: "manual",
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: stripResponseHeaders(response.headers),
  });
};

const isVideoPlaybackUrl = (url: URL): boolean => {
  const host = url.hostname.toLowerCase();
  return host.endsWith("googlevideo.com") || url.pathname.includes("/videoplayback");
};

const buildCompanionVideoPlaybackUrl = (companionUrl: string, sourceUrl: URL): string => {
  const base = companionUrl.replace(/\/+$/, "").replace(/\/companion$/, "");
  return `${base}/companion/videoplayback${sourceUrl.search}`;
};

const handleYoutubeJsProxy = async (request: Request, companionUrl: string): Promise<Response> => {
  const requestUrl = new URL(request.url);
  const target = (requestUrl.searchParams.get("url") || "").trim();
  if (!target) return json({ error: "url_required" }, { status: 400 });

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return json({ error: "invalid_url" }, { status: 400 });
  }
  if (parsed.protocol !== "https:") return json({ error: "https_only" }, { status: 400 });
  if (isVideoPlaybackUrl(parsed)) {
    return Response.redirect(buildCompanionVideoPlaybackUrl(companionUrl, parsed), 302);
  }

  const proxyCookie = (request.headers.get("x-ytjs-cookie") || "").trim();
  const headers = stripProxyHeaders(request.headers, ["x-ytjs-cookie"]);
  if (proxyCookie) headers.set("cookie", proxyCookie);

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(parsed.toString(), {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
      redirect: "manual",
    });
  } catch {
    return json({ error: "upstream_fetch_failed" }, { status: 502 });
  }

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: stripResponseHeaders(upstreamResponse.headers),
  });
};

const handleTvSync = async (request: Request, pathname: string): Promise<Response | null> => {
  if (pathname === "/tv-sync/session" && (request.method === "GET" || request.method === "POST")) {
    return json(createTvSession());
  }

  const commandMatch = pathname.match(/^\/tv-sync\/session\/([^/]+)\/command$/);
  if (!commandMatch) return null;

  cleanupExpiredSessions();
  const sessionId = decodeURIComponent(commandMatch[1]);
  const session = tvSessions.get(sessionId);
  if (!session) return json({ error: "session_not_found" }, { status: 404 });

  if (request.method === "POST") {
    let body: { videoId?: string };
    try {
      body = (await request.json()) as { videoId?: string };
    } catch {
      body = {};
    }
    const videoId = (body.videoId || "").trim();
    if (!videoId) return json({ error: "video_id_required" }, { status: 400 });

    const command: TvCommand = { id: crypto.randomUUID(), videoId, sentAt: Date.now() };
    session.lastCommand = command;
    session.updatedAt = Date.now();
    return json({ ok: true, commandId: command.id });
  }

  if (request.method === "GET") {
    const after = new URL(request.url).searchParams.get("after") || "";
    const command = session.lastCommand;
    if (!command || command.id === after) return json({ hasCommand: false });
    return json({ hasCommand: true, command });
  }

  return json({ error: "method_not_allowed" }, { status: 405 });
};

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);
    const config = buildConfig(env);

    if (request.method === "OPTIONS") {
      return withCors(new Response(null, { status: 204 }));
    }

    let response: Response;
    try {
      if (url.pathname === "/health") {
        response = json({ status: "ok", runtime: "cloudflare-worker" });
      } else if (url.pathname === "/companion/videoplayback") {
        response = Response.redirect(buildCompanionVideoPlaybackUrl(config.companionUrl, url), 302);
      } else if (url.pathname.startsWith("/companion")) {
        const headers = config.companionSecret ? { authorization: `Bearer ${config.companionSecret}` } : undefined;
        response = await proxyToUpstream(request, config.companionUrl, "/companion", "/companion", headers);
      } else if (url.pathname.startsWith("/api-proxy")) {
        response = await proxyToUpstream(request, config.apiProxyUpstream, "/api-proxy", "");
      } else if (url.pathname === "/youtubejs-proxy") {
        response = await handleYoutubeJsProxy(request, config.companionUrl);
      } else {
        response = (await handleTvSync(request, url.pathname)) ?? json({ error: "not_found" }, { status: 404 });
      }
    } catch {
      response = json({ error: "worker_handler_failed" }, { status: 500 });
    }

    return withCors(response);
  },
};
