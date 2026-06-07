import * as dotenv from "dotenv";
import { createProxyServer } from "./createServer";

dotenv.config();

const PRIMARY_COMPANION_URL = "https://companion.tsub4sa.xyz";
const FALLBACK_COMPANION_URL = "https://proxy.tsub4sa.xyz";
const firstNonEmpty = (...values: Array<string | undefined>): string => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
};

const companionUrl = firstNonEmpty(process.env.COMPANION_URL, PRIMARY_COMPANION_URL, FALLBACK_COMPANION_URL);
const companionSecret = process.env.COMPANION_SECRET || "";
const apiProxyUpstream =
  process.env.API_PROXY_UPSTREAM ||
  process.env.VITE_API_BASE_URL ||
  process.env.VITE_INVIDIOUS_API_BASE_URL ||
  "https://invidious.tsub4sa.xyz";
const port = Number(process.env.PORT) || 8282;
const host = process.env.HOST || "0.0.0.0";

const fastify = createProxyServer({
  companionUrl,
  companionSecret,
  apiProxyUpstream,
});

const start = async () => {
  try {
    await fastify.listen({ port, host });
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
};

start();
