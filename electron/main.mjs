import { app, BrowserWindow } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import cors from "@fastify/cors";
import proxy from "@fastify/http-proxy";
import { randomUUID } from "node:crypto";
import axios from "axios";
import { getTime } from "date-fns";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.ELECTRON_LOCAL_PROXY_PORT || 8282);
const HOST = "127.0.0.1";
const PRIMARY_COMPANION_URL = "https://companion.tsub4sa.xyz";
const FALLBACK_COMPANION_URL = "https://proxy.tsub4sa.xyz";
const firstNonEmpty = (...values) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
};
const API_PROXY_UPSTREAM =
  process.env.API_PROXY_UPSTREAM ||
  process.env.VITE_ELECTRON_INVIDIOUS_API_BASE_URL ||
  process.env.VITE_API_BASE_URL ||
  process.env.VITE_INVIDIOUS_API_BASE_URL ||
  "https://invidious.tsub4sa.xyz";
const COMPANION_URL =
  firstNonEmpty(
    process.env.ELECTRON_COMPANION_UPSTREAM_URL,
    process.env.VITE_ELECTRON_COMPANION_UPSTREAM_URL,
    process.env.VITE_ELECTRON_COMPANION_URL,
    process.env.VITE_COMPANION_URL,
    PRIMARY_COMPANION_URL,
    FALLBACK_COMPANION_URL,
  );
const COMPANION_SECRET =
  process.env.ELECTRON_COMPANION_SECRET ||
  process.env.VITE_ELECTRON_COMPANION_SECRET ||
  process.env.VITE_COMPANION_SECRET ||
  "";

/** @type {import("fastify").FastifyInstance | null} */
let proxyServer = null;

/** @type {Map<string, { id:string, createdAt:number, updatedAt:number, lastCommand: null | { id:string, videoId:string, sentAt:number } }>} */
const tvSessions = new Map();
const SESSION_TTL_MS = 1000 * 60 * 60 * 6;
const nowMs = () => getTime(new Date());

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
  tvSessions.set(sessionId, {
    id: sessionId,
    createdAt: now,
    updatedAt: now,
    lastCommand: null,
  });
  return { sessionId, expiresInMs: SESSION_TTL_MS };
};

const startEmbeddedProxy = async () => {
  if (proxyServer) return;

  const fastify = Fastify({ logger: false });
  fastify.register(cors, { origin: true });

  fastify.register(proxy, {
    upstream: COMPANION_URL,
    prefix: "/companion",
    rewritePrefix: "/companion",
    replyOptions: {
      rewriteRequestHeaders: (_request, headers) => {
        if (!COMPANION_SECRET) return headers;
        return {
          ...headers,
          authorization: `Bearer ${COMPANION_SECRET}`,
        };
      },
    },
  });

  fastify.register(proxy, {
    upstream: API_PROXY_UPSTREAM,
    prefix: "/api-proxy",
    rewritePrefix: "",
  });

  fastify.all("/youtubejs-proxy", async (request, reply) => {
    const target = String(request.query?.url || "").trim();
    if (!target) return reply.code(400).send({ error: "url_required" });

    let parsed;
    try {
      parsed = new URL(target);
    } catch {
      return reply.code(400).send({ error: "invalid_url" });
    }
    if (parsed.protocol !== "https:") return reply.code(400).send({ error: "https_only" });

    const buildForwardBody = () => {
      if (request.method === "GET" || request.method === "HEAD") return undefined;
      const body = request.body;
      if (body == null) return undefined;
      if (typeof body === "string" || body instanceof Uint8Array || body instanceof ArrayBuffer) return body;
      return JSON.stringify(body);
    };

    const reqHeaders = {};
    const proxyCookie = typeof request.headers?.["x-ytjs-cookie"] === "string"
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

    let upstreamResponse;
    try {
      upstreamResponse = await axios.request({
        url: parsed.toString(),
        method: request.method,
        headers: reqHeaders,
        data: buildForwardBody(),
        responseType: "arraybuffer",
        validateStatus: () => true,
      });
    } catch (error) {
      fastify.log.error(error);
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

  fastify.post("/tv-sync/session/:sessionId/command", async (request, reply) => {
    cleanupExpiredSessions();
    const { sessionId } = request.params;
    const session = tvSessions.get(sessionId);
    if (!session) return reply.code(404).send({ error: "session_not_found" });
    const videoId = String(request.body?.videoId || "").trim();
    if (!videoId) return reply.code(400).send({ error: "video_id_required" });

    const command = { id: randomUUID(), videoId, sentAt: nowMs() };
    session.lastCommand = command;
    session.updatedAt = nowMs();
    return { ok: true, commandId: command.id };
  });

  fastify.get("/tv-sync/session/:sessionId/command", async (request, reply) => {
    cleanupExpiredSessions();
    const { sessionId } = request.params;
    const session = tvSessions.get(sessionId);
    if (!session) return reply.code(404).send({ error: "session_not_found" });

    const after = String(request.query?.after || "");
    const command = session.lastCommand;
    if (!command || command.id === after) return { hasCommand: false };
    return { hasCommand: true, command };
  });

  await fastify.listen({ port: PORT, host: HOST });
  proxyServer = fastify;
};

const stopEmbeddedProxy = async () => {
  if (!proxyServer) return;
  await proxyServer.close();
  proxyServer = null;
};

const createWindow = async () => {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const indexPath = path.resolve(__dirname, "../dist/index.html");
  await win.loadFile(indexPath);
};

app.whenReady().then(async () => {
  await startEmbeddedProxy();
  await createWindow();
});

app.on("window-all-closed", async () => {
  await stopEmbeddedProxy();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", async () => {
  await stopEmbeddedProxy();
});
