/// <reference lib="webworker" />

import { clientsClaim } from "workbox-core";
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { NetworkFirst, StaleWhileRevalidate } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheableResponsePlugin } from "workbox-cacheable-response";

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<import("workbox-build").ManifestEntry>;
};

self.skipWaiting();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

const navigationHandler = createHandlerBoundToURL("/index.html");
registerRoute(({ request }) => request.mode === "navigate", navigationHandler);

registerRoute(
  ({ url, request }) => url.pathname === "/share-target" && request.method === "POST",
  async ({ event }) => {
    const fetchEvent = event as FetchEvent;
    const formData = await fetchEvent.request.formData();
    const title = String(formData.get("title") || "");
    const text = String(formData.get("text") || "");
    const url = String(formData.get("url") || "");

    const redirectUrl = new URL("/share-target", self.location.origin);
    if (title) redirectUrl.searchParams.set("title", title);
    if (text) redirectUrl.searchParams.set("text", text);
    if (url) redirectUrl.searchParams.set("url", url);

    return Response.redirect(redirectUrl.toString(), 303);
  },
  "POST",
);

registerRoute(
  ({ request }) => request.destination === "image",
  new StaleWhileRevalidate({
    cacheName: "image-assets-v1",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 14 }),
    ],
  }),
);

registerRoute(
  ({ url, request }) =>
    (request.destination === "script" ||
      request.destination === "style" ||
      request.destination === "font" ||
      url.pathname.endsWith(".json")) &&
    !url.pathname.startsWith("/api-proxy") &&
    !url.pathname.startsWith("/youtubejs-proxy") &&
    !url.pathname.startsWith("/tv-sync") &&
    !url.pathname.startsWith("/companion"),
  new StaleWhileRevalidate({
    cacheName: "app-static-v1",
    plugins: [new CacheableResponsePlugin({ statuses: [0, 200] })],
  }),
);

registerRoute(
  ({ url }) =>
    url.origin === self.location.origin &&
    url.pathname.startsWith("/") &&
    !url.pathname.startsWith("/api-proxy") &&
    !url.pathname.startsWith("/youtubejs-proxy") &&
    !url.pathname.startsWith("/tv-sync") &&
    !url.pathname.startsWith("/companion"),
  new NetworkFirst({
    cacheName: "document-pages-v1",
    networkTimeoutSeconds: 3,
    plugins: [new CacheableResponsePlugin({ statuses: [0, 200] })],
  }),
);
