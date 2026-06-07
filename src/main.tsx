import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider, type PersistedClient, type Persister } from "@tanstack/react-query-persist-client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App";
import { SettingsProvider } from "./settings/SettingsProvider";
import { registerPwaServiceWorker, setupAdvancedWebApis } from "./pwa";
import { initializeRecentSearches } from "./lib/recentSearch";
import { initializeWatchHistory } from "./lib/watchHistory";
import { initSentry } from "./lib/sentry";
import { deleteApiCache, getApiCache, setApiCache } from "./lib/cacheDb";
import { ensureNativeProxyStarted } from "./lib/nativeProxy";
import { initCapacitorSpecial } from "./lib/capacitorSpecial";
import { getStorageString, removeStorageValue, setStorageString } from "./lib/browserStorage";
import "./i18n";
import "./index.css";

const DYNAMIC_IMPORT_RELOAD_GUARD_KEY = "inverview-dynamic-import-reload-once";

const isDynamicImportFetchError = (reason: unknown): boolean => {
  if (reason instanceof Error) {
    return /Failed to fetch dynamically imported module/i.test(reason.message);
  }
  if (typeof reason === "string") {
    return /Failed to fetch dynamically imported module/i.test(reason);
  }
  return false;
};

const reloadOnceForDynamicImportError = (): void => {
  const alreadyReloaded = getStorageString("session", DYNAMIC_IMPORT_RELOAD_GUARD_KEY) === "1";
  if (alreadyReloaded) return;
  setStorageString("session", DYNAMIC_IMPORT_RELOAD_GUARD_KEY, "1");
  window.location.reload();
};

window.addEventListener("pageshow", () => {
  removeStorageValue("session", DYNAMIC_IMPORT_RELOAD_GUARD_KEY);
});

window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  reloadOnceForDynamicImportError();
});

window.addEventListener("unhandledrejection", (event) => {
  if (!isDynamicImportFetchError(event.reason)) return;
  event.preventDefault();
  reloadOnceForDynamicImportError();
});

const QUERY_CACHE_KEY = "invidious-react-query-cache-v2";
const CACHE_MAX_AGE_MS = 1000 * 60 * 15;
const QUERY_GC_TIME_MS = 1000 * 60 * 2;
const PERSISTABLE_QUERY_ROOTS = new Set([
  "stats",
  "popular",
  "trending",
  "local-subscriptions",
  "preferences",
]);

const isInfiniteQueryData = (data: unknown): data is { pages: unknown[] } =>
  typeof data === "object" && data !== null && "pages" in data && Array.isArray((data as { pages?: unknown[] }).pages);

const shouldPersistQueryByKey = (queryKey: readonly unknown[]): boolean => {
  const root = queryKey[0];
  return typeof root === "string" && PERSISTABLE_QUERY_ROOTS.has(root);
};

const isLargeArrayPayload = (data: unknown): boolean => {
  return Array.isArray(data) && data.length > 60;
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: QUERY_GC_TIME_MS,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const queryPersister: Persister = {
  persistClient: async (client) => {
    await setApiCache(QUERY_CACHE_KEY, client, CACHE_MAX_AGE_MS);
  },
  restoreClient: async () => {
    const persisted = await getApiCache<PersistedClient>(QUERY_CACHE_KEY);
    if (!persisted) return undefined;
    return persisted;
  },
  removeClient: async () => {
    await deleteApiCache(QUERY_CACHE_KEY);
  },
};

const runWhenIdle = (task: () => void): void => {
  if (typeof window === "undefined") {
    task();
    return;
  }

  const callback = () => task();
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(callback, { timeout: 1200 });
    return;
  }

  setTimeout(callback, 0);
};

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SettingsProvider>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister: queryPersister,
          maxAge: CACHE_MAX_AGE_MS,
          dehydrateOptions: {
            shouldDehydrateQuery: (query) => {
              if (query.state.status !== "success") return false;
              // Large paginated payloads are kept in-memory while active, but skipped in persisted cache to reduce restore-time memory spikes.
              if (isInfiniteQueryData(query.state.data)) return false;
              // Avoid persisting oversized flat arrays; this keeps restore memory and parse cost low.
              if (isLargeArrayPayload(query.state.data)) return false;
              // Keep persisted cache lean by storing only small/stable query groups.
              if (!shouldPersistQueryByKey(query.queryKey)) return false;
              return true;
            },
          },
        }}
      >
        <HelmetProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </HelmetProvider>
      </PersistQueryClientProvider>
    </SettingsProvider>
  </React.StrictMode>,
);

runWhenIdle(() => {
  initializeRecentSearches();
  initializeWatchHistory();
  void ensureNativeProxyStarted().catch((error) => console.warn("NativeProxy start failed", error));
  void initCapacitorSpecial();
  void initSentry();
});

registerPwaServiceWorker();
setupAdvancedWebApis();
