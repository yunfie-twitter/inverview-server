import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import proxy from "@fastify/http-proxy";
import { randomUUID } from "node:crypto";
import axios from "axios";
import { getTime } from "date-fns";

export type ProxyServerConfig = {
  companionUrl: string;
  companionSecret: string;
  apiProxyUpstream: string;
};
type YoutubeJsProxyQuery = { url?: string };

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

const SESSION_TTL_MS = 1000 * 60 * 60 * 6;
const nowMs = (): number => getTime(new Date());
const isVideoPlaybackUrl = (url: URL): boolean => {
  const host = url.hostname.toLowerCase();
  return host.endsWith("googlevideo.com") || url.pathname.includes("/videoplayback");
};
const buildCompanionVideoPlaybackUrl = (companionUrl: string, sourceUrl: URL): string => {
  const base = companionUrl.replace(/\/+$/, "").replace(/\/companion$/, "");
  return `${base}/companion/videoplayback${sourceUrl.search}`;
};

export const createProxyServer = (config: ProxyServerConfig): FastifyInstance => {
  const fastify = Fastify({ logger: true });
  const tvSessions = new Map<string, TvSession>();

  const cleanupExpiredSessions = () => {
    const now = nowMs();
    for (const [sessionId, session] of tvSessions.entries()) {
      if (now - session.updatedAt > SESSION_TTL_MS) {
        tvSessions.delete(sessionId);
      }
    }
  };

  const createTvSession = () => {
    cleanupExpiredSessions();
    const sessionId = randomUUID();
    const now = nowMs();
    const session: TvSession = {
      id: sessionId,
      createdAt: now,
      updatedAt: now,
      lastCommand: null,
    };
    tvSessions.set(sessionId, session);
    return { sessionId, expiresInMs: SESSION_TTL_MS };
  };

  fastify.register(cors, { origin: true });

  fastify.get("/companion/videoplayback", async (request, reply) => {
    const sourceUrl = new URL(request.url, "http://127.0.0.1");
    return reply.code(302).header("Location", buildCompanionVideoPlaybackUrl(config.companionUrl, sourceUrl)).send();
  });

  fastify.register(proxy, {
    upstream: config.companionUrl,
    prefix: "/companion",
    rewritePrefix: "/companion",
    replyOptions: {
      rewriteRequestHeaders: (_request, headers) => {
        if (config.companionSecret) {
          return {
            ...headers,
            authorization: `Bearer ${config.companionSecret}`,
          };
        }
        return headers;
      },
    },
  });

  fastify.register(proxy, {
    upstream: config.apiProxyUpstream,
    prefix: "/api-proxy",
    rewritePrefix: "",
  });

  fastify.all<{ Querystring: YoutubeJsProxyQuery }>("/youtubejs-proxy", async (request, reply) => {
    const target = String(request.query.url || "").trim();
    if (!target) return reply.code(400).send({ error: "url_required" });

    let parsed: URL;
    try {
      parsed = new URL(target);
    } catch {
      return reply.code(400).send({ error: "invalid_url" });
    }
    if (parsed.protocol !== "https:") return reply.code(400).send({ error: "https_only" });
    if (isVideoPlaybackUrl(parsed)) {
      return reply.code(302).header("Location", buildCompanionVideoPlaybackUrl(config.companionUrl, parsed)).send();
    }

    const buildForwardBody = (): unknown => {
      if (request.method === "GET" || request.method === "HEAD") return undefined;
      const body = request.body as unknown;
      if (body == null) return undefined;
      if (typeof body === "string" || body instanceof Uint8Array || body instanceof ArrayBuffer) return body;
      return JSON.stringify(body);
    };

    const reqHeaders: Record<string, string> = {};
    const proxyCookie = typeof request.headers["x-ytjs-cookie"] === "string"
      ? request.headers["x-ytjs-cookie"].trim()
      : "";
    for (const [key, value] of Object.entries(request.headers)) {
      if (!value) continue;
      const lower = key.toLowerCase();
      if (
        lower === "host" ||
        lower === "content-length" ||
        lower === "transfer-encoding" ||
        lower === "connection" ||
        lower === "keep-alive" ||
        lower === "proxy-connection" ||
        lower === "upgrade" ||
        lower === "te" ||
        lower === "trailer" ||
        lower === "x-ytjs-cookie"
      ) continue;
      if (Array.isArray(value)) {
        reqHeaders[key] = value.join(", ");
      } else {
        reqHeaders[key] = value;
      }
    }
    if (proxyCookie) reqHeaders.cookie = proxyCookie;

    let upstreamResponse: Awaited<ReturnType<typeof axios.request<ArrayBuffer>>>;
    try {
      upstreamResponse = await axios.request<ArrayBuffer>({
        url: parsed.toString(),
        method: request.method,
        headers: reqHeaders,
        data: buildForwardBody(),
        responseType: "arraybuffer",
        validateStatus: () => true,
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(502).send({ error: "upstream_fetch_failed" });
    }

    for (const [key, value] of Object.entries(upstreamResponse.headers)) {
      const lower = key.toLowerCase();
      if (
        lower === "connection" ||
        lower === "transfer-encoding" ||
        lower === "keep-alive" ||
        lower === "proxy-authenticate" ||
        lower === "proxy-authorization" ||
        lower === "te" ||
        lower === "trailer" ||
        lower === "upgrade" ||
        lower === "content-length"
      ) continue;
      if (value !== undefined) reply.header(key, Array.isArray(value) ? value.join(", ") : String(value));
    }
    reply.code(upstreamResponse.status);
    const bodyBuffer = Buffer.from(upstreamResponse.data);
    return reply.send(bodyBuffer);
  });

  fastify.get("/health", async () => ({ status: "ok" }));
  fastify.post("/tv-sync/session", async () => createTvSession());
  fastify.get("/tv-sync/session", async () => createTvSession());

  fastify.post<{ Params: { sessionId: string }; Body: { videoId?: string } }>(
    "/tv-sync/session/:sessionId/command",
    async (request, reply) => {
      cleanupExpiredSessions();
      const { sessionId } = request.params;
      const session = tvSessions.get(sessionId);
      if (!session) return reply.code(404).send({ error: "session_not_found" });

      const videoId = (request.body?.videoId || "").trim();
      if (!videoId) return reply.code(400).send({ error: "video_id_required" });

      const command: TvCommand = { id: randomUUID(), videoId, sentAt: nowMs() };
      session.lastCommand = command;
      session.updatedAt = nowMs();
      return { ok: true, commandId: command.id };
    },
  );

  fastify.get<{ Params: { sessionId: string }; Querystring: { after?: string } }>(
    "/tv-sync/session/:sessionId/command",
    async (request, reply) => {
      cleanupExpiredSessions();
      const { sessionId } = request.params;
      const session = tvSessions.get(sessionId);
      if (!session) return reply.code(404).send({ error: "session_not_found" });

      const after = request.query.after || "";
      const command = session.lastCommand;
      if (!command || command.id === after) return { hasCommand: false };
      return { hasCommand: true, command };
    },
  );

  return fastify;
};
