import { type ReactNode, Suspense, lazy, useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { Spinner } from "@fluentui/react-components";
import { useSettings } from "./hooks/useSettings";
import { resolveLaunchPath } from "./lib/launchIntent";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet-async";

const AuthPlaylistsPage = lazy(() => import("./pages/AuthPlaylistsPage").then((module) => ({ default: module.AuthPlaylistsPage })));
const ChannelPage = lazy(() => import("./pages/ChannelPage").then((module) => ({ default: module.ChannelPage })));
const ChannelVideosPage = lazy(() => import("./pages/ChannelVideosPage").then((module) => ({ default: module.ChannelVideosPage })));
const FeedPage = lazy(() => import("./pages/FeedPage").then((module) => ({ default: module.FeedPage })));
const HistoryPage = lazy(() => import("./pages/HistoryPage").then((module) => ({ default: module.HistoryPage })));
const HomePage = lazy(() => import("./pages/HomePage").then((module) => ({ default: module.HomePage })));
const PlaylistPage = lazy(() => import("./pages/PlaylistPage").then((module) => ({ default: module.PlaylistPage })));
const SearchPage = lazy(() => import("./pages/SearchPage").then((module) => ({ default: module.SearchPage })));
const SettingsPage = lazy(() => import("./pages/SettingsPage").then((module) => ({ default: module.SettingsPage })));
const ShortsPage = lazy(() => import("./pages/ShortsPage").then((module) => ({ default: module.ShortsPage })));
const SubscriptionsPage = lazy(() => import("./pages/SubscriptionsPage").then((module) => ({ default: module.SubscriptionsPage })));
const TvHomePage = lazy(() => import("./pages/TvHomePage").then((module) => ({ default: module.TvHomePage })));
const TvSenderPage = lazy(() => import("./pages/TvSenderPage").then((module) => ({ default: module.TvSenderPage })));
const WatchPage = lazy(() => import("./pages/WatchPage").then((module) => ({ default: module.WatchPage })));

const ScrollToTop = (): null => {
  const { pathname, search } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [pathname, search]);

  return null;
};

const LandingRedirect = (): JSX.Element => {
  const { settings } = useSettings();

  if (settings.startPage === "trending") return <Navigate to="/?homeTab=trending" replace />;
  if (settings.startPage === "popular") return <Navigate to="/?homeTab=popular" replace />;
  if (settings.startPage === "subscriptions") return <Navigate to="/subscriptions" replace />;
  if (settings.startPage === "search") return <Navigate to="/search" replace />;
  return <Navigate to="/?homeTab=popular" replace />;
};

const LaunchIntentRedirect = (): JSX.Element => {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const to = resolveLaunchPath({
    url: params.get("url"),
    text: params.get("text"),
    title: params.get("title"),
  });
  return <Navigate to={to} replace />;
};

const RouteFallback = (): JSX.Element => {
  const { t } = useTranslation();
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <Spinner
        tabIndex={0}
        size="large"
        delay={120}
        label={reducedMotion ? t("app.loadingPage") : t("app.loading")}
        labelPosition="below"
      />
    </div>
  );
};

interface PageTitleProps {
  title: string;
  children: ReactNode;
}

const PageTitle = ({ title, children }: PageTitleProps): JSX.Element => {
  const { t } = useTranslation();
  const appName = t("appName");
  const pageTitle = title ? `${title} - ${appName}` : appName;

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
      </Helmet>
      {children}
    </>
  );
};

export const AppRoutes = (): JSX.Element => {
  const { t } = useTranslation();
  const location = useLocation();
  const state = location.state as { backgroundLocation?: typeof location } | null;
  const backgroundLocation = state?.backgroundLocation;

  return (
    <>
      <ScrollToTop />
      <ErrorBoundary
        title={t("app.routeErrorTitle")}
        message={t("app.routeErrorMessage")}
      >
        <Suspense fallback={<RouteFallback />}>
          <Routes location={backgroundLocation || location}>
            <Route element={<AppShell />}>
              <Route path="/" element={<PageTitle title={t("home.title")}><HomePage /></PageTitle>} />
              <Route path="/landing" element={<LandingRedirect />} />
              <Route path="/search" element={<PageTitle title={t("search.title")}><SearchPage /></PageTitle>} />
              <Route path="/share-target" element={<LaunchIntentRedirect />} />
              <Route path="/open" element={<LaunchIntentRedirect />} />
              <Route path="/watch/:videoId" element={<WatchPage />} />
              <Route path="/tv/watch/:videoId" element={<WatchPage />} />
              <Route path="/shorts/:videoId?" element={<PageTitle title={t("shorts.title")}><ShortsPage /></PageTitle>} />
              <Route path="/channel/:authorId" element={<PageTitle title={t("channel.title")}><ChannelPage /></PageTitle>} />
              <Route path="/channel/:authorId/videos" element={<PageTitle title={t("channelVideos.videos")}><ChannelVideosPage mode="videos" /></PageTitle>} />
              <Route path="/channel/:authorId/shorts" element={<PageTitle title={t("channelVideos.shorts")}><ChannelVideosPage mode="shorts" /></PageTitle>} />
              <Route path="/channel/:authorId/streams" element={<PageTitle title={t("channelVideos.streams")}><ChannelVideosPage mode="streams" /></PageTitle>} />
              <Route path="/playlist/:playlistId" element={<PageTitle title={t("playlist.title")}><PlaylistPage /></PageTitle>} />
              <Route path="/settings" element={<PageTitle title={t("settings.title")}><SettingsPage /></PageTitle>} />
              <Route path="/history" element={<PageTitle title={t("history.title")}><HistoryPage /></PageTitle>} />
              <Route path="/feed" element={<PageTitle title={t("feed.title")}><FeedPage /></PageTitle>} />
              <Route path="/subscriptions" element={<PageTitle title={t("subscriptions.title")}><SubscriptionsPage /></PageTitle>} />
              <Route path="/playlists" element={<PageTitle title={t("playlists.title")}><AuthPlaylistsPage /></PageTitle>} />
              <Route path="/tv" element={<PageTitle title="TV Client"><TvHomePage /></PageTitle>} />
              <Route path="/tv/sender" element={<PageTitle title="TV Sender"><TvSenderPage /></PageTitle>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>

          {backgroundLocation ? (
            <Routes>
              <Route path="/settings" element={<PageTitle title={t("settings.title")}><SettingsPage /></PageTitle>} />
            </Routes>
          ) : null}
        </Suspense>
      </ErrorBoundary>
    </>
  );
};
