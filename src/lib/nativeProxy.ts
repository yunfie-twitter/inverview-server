import { registerPlugin } from "@capacitor/core";
import { isCapacitorRuntime } from "./runtimeEnv";

type NativeProxyStatus = {
  running: boolean;
};

type NativeProxyStartOptions = {
  port?: number;
  apiProxyUpstream?: string;
  companionUpstream?: string;
  companionSecret?: string;
};

type NativeProxyStartResult = {
  ok: boolean;
  running: boolean;
  port: number;
  error?: string;
};

type NativeProxyPlugin = {
  start(options?: NativeProxyStartOptions): Promise<NativeProxyStartResult>;
  stop(): Promise<{ ok: boolean; running: boolean }>;
  status(): Promise<NativeProxyStatus>;
};

const NativeProxy = registerPlugin<NativeProxyPlugin>("NativeProxy");
const primaryCompanionUpstream = "https://companion.tsub4sa.xyz";
const fallbackCompanionUpstream = "https://proxy.tsub4sa.xyz";

const trimOrFallback = (value: unknown, fallback: string): string => {
  if (typeof value !== "string") return fallback;
  const v = value.trim();
  return v || fallback;
};

const firstNonEmpty = (...values: Array<string | undefined>): string => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
};

export const ensureNativeProxyStarted = async (): Promise<void> => {
  if (!isCapacitorRuntime()) return;

  const apiProxyUpstream = trimOrFallback(
    import.meta.env.VITE_CAPACITOR_INVIDIOUS_API_BASE_URL || import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_INVIDIOUS_API_BASE_URL,
    "https://invidious.tsub4sa.xyz",
  );
  const companionUpstream = trimOrFallback(
    firstNonEmpty(
      import.meta.env.VITE_CAPACITOR_COMPANION_UPSTREAM_URL,
      import.meta.env.VITE_COMPANION_URL,
      primaryCompanionUpstream,
      fallbackCompanionUpstream,
    ),
    primaryCompanionUpstream,
  );
  const companionSecret = trimOrFallback(
    import.meta.env.VITE_CAPACITOR_COMPANION_SECRET || import.meta.env.VITE_COMPANION_SECRET,
    "",
  );
  const port = Number(import.meta.env.VITE_CAPACITOR_LOCAL_PROXY_PORT || 8282);

  try {
    const status = await NativeProxy.status();
    if (status.running) return;
  } catch {
    // status取得不可でも start を試行する
  }

  await NativeProxy.start({
    port,
    apiProxyUpstream,
    companionUpstream,
    companionSecret,
  });
};
