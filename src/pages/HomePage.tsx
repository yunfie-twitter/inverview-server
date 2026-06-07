import {
  TabList,
  Tab,
  Button,
  makeStyles,
  type TabListProps,
  mergeClasses,
} from "@fluentui/react-components";
import { ArrowClockwise24Regular } from "@fluentui/react-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getAuthFeed, getChannel, getPopular, getTrending } from "../lib/invidiousClient";
import { queryKeys } from "../lib/queryKeys";
import { VideoGrid } from "../components/VideoGrid";
import { useSettingsStore } from "../store/settingsStore";
import { useSettings } from "../hooks/useSettings";
import { QueryStateView } from "../components/QueryStateView";
import { triggerHaptic } from "../lib/haptic";
import { getCurrentLocalUser } from "../lib/localUsers";
import { getLocalSubscriptionIds } from "../lib/localSubscriptions";
import type { VideoObject } from "../types/invidious";
import { mergeTrendingAndSubscriptionItems } from "../lib/videoProcessing";
import { settledWithConcurrencyLimit } from "../lib/promiseLimit";
import { getStorageString, removeStorageValue, setStorageString } from "../lib/browserStorage";


const trendCategories = ["default", "music", "gaming", "movies"] as const;
const isTrendCategory = (value: string): value is (typeof trendCategories)[number] =>
  trendCategories.includes(value as (typeof trendCategories)[number]);

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  tabHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
  },
  tabContent: {
    paddingTop: "20px",
  },
  trendCategoryList: {
    display: "flex",
    gap: "8px",
    overflowX: "auto",
    paddingBottom: "8px",
    maxWidth: "100%",
    marginLeft: "-16px",
    marginRight: "-16px",
    paddingLeft: "16px",
    paddingRight: "32px",
    scrollbarWidth: "none",
    maskImage: "linear-gradient(to right, rgba(0, 0, 0, calc(1 - var(--left-mask-opacity, 0))) 0%, rgba(0, 0, 0, 1) 10%, rgba(0, 0, 0, 1) 90%, rgba(0, 0, 0, 0) 100%)",
    WebkitMaskImage: "linear-gradient(to right, rgba(0, 0, 0, calc(1 - var(--left-mask-opacity, 0))) 0%, rgba(0, 0, 0, 1) 10%, rgba(0, 0, 0, 1) 90%, rgba(0, 0, 0, 0) 100%)",
    transition: "--left-mask-opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
    "::-webkit-scrollbar": {
      display: "none",
    },
  },
  categoryButton: {
    borderRadius: "var(--app-radius)",
    height: "36px",
    flexShrink: 0,
  },
  sidebarResponsiveMotion: {
    animationName: {
      from: {
        opacity: 0.985,
        transform: "translate3d(0, 4px, 0) scale(0.998)",
      },
      to: {
        opacity: 1,
        transform: "translate3d(0, 0, 0) scale(1)",
      },
    },
    animationDuration: "150ms",
    animationTimingFunction: "cubic-bezier(0.2, 0, 0, 1)",
    animationFillMode: "both",
    willChange: "transform, opacity",
    "@media (prefers-reduced-motion: reduce)": {
      animation: "none",
    },
  },
});

export const HomePage = (): JSX.Element => {
  const styles = useStyles();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const region = useSettingsStore((state) => state.region);
  const token = useSettingsStore((state) => state.token);
  const sidebarCollapsed = useSettingsStore((state) => state.sidebarCollapsed);
  const { settings } = useSettings();
  const localUser = getCurrentLocalUser();
  const [sidebarAnimating, setSidebarAnimating] = useState(false);
  const prevSidebarCollapsedRef = useRef(sidebarCollapsed);
  const { t } = useTranslation();
  const [isScrolledLeft, setIsScrolledLeft] = useState(false);
  const [suppressSecondaryMotion, setSuppressSecondaryMotion] = useState(false);
  
  const initialTab = searchParams.get("homeTab") === "trending" ? "trending" : "popular";
  const rawCategory = searchParams.get("category");
  const category = rawCategory && isTrendCategory(rawCategory) ? rawCategory : "default";

  const popularQuery = useQuery({
    queryKey: queryKeys.popular,
    queryFn: ({ signal }) => getPopular(signal),
    enabled: initialTab === "popular",
    placeholderData: (previousData) => previousData,
  });

  const trendingQuery = useQuery({
    queryKey: queryKeys.trending(category, region),
    queryFn: ({ signal }) => getTrending(category, region, signal),
    enabled: initialTab !== "popular",
    placeholderData: (previousData) => previousData,
  });

  const authFeedQuery = useQuery({
    queryKey: queryKeys.authFeed(1),
    queryFn: ({ signal }) => getAuthFeed({ page: 1 }, signal),
    enabled: initialTab !== "popular" && !!token,
    placeholderData: (previousData) => previousData,
  });

  const localSubscribedVideosQuery = useQuery({
    queryKey: [...queryKeys.localSubscriptions(localUser.id), "home-mixed-videos"],
    queryFn: async ({ signal }) => {
      const ids = getLocalSubscriptionIds().slice(0, 12);
      const settled = await settledWithConcurrencyLimit(
        ids,
        3,
        (id) => getChannel(id, signal),
      );
      return settled
        .filter((item): item is PromiseFulfilledResult<Awaited<ReturnType<typeof getChannel>>> => item.status === "fulfilled")
        .flatMap((item) => (Array.isArray(item.value.latestVideos) ? item.value.latestVideos : []).slice(0, 2));
    },
    enabled: initialTab !== "popular" && !token,
    placeholderData: (previousData) => previousData,
  });

  const popularVideos = useMemo(() => {
    const data = popularQuery.data;
    if (!Array.isArray(data)) return [];
    const items: VideoObject[] = [];
    for (let index = 0; index < data.length; index += 1) {
      const item = data[index];
      if (item && !item.liveNow && !item.isUpcoming) {
        items.push(item);
      }
    }
    return items;
  }, [popularQuery.data]);

  const mergedVideos = useMemo(() => {
    const trendingData = Array.isArray(trendingQuery.data) ? trendingQuery.data : [];
    const subscribedData = token
      ? (Array.isArray(authFeedQuery.data?.videos) ? authFeedQuery.data.videos : [])
      : (Array.isArray(localSubscribedVideosQuery.data) ? localSubscribedVideosQuery.data : []);

    if (trendingData.length === 0 && subscribedData.length === 0) {
      return [];
    }

    return mergeTrendingAndSubscriptionItems(trendingData, subscribedData);
  }, [trendingQuery.data, authFeedQuery.data, localSubscribedVideosQuery.data, token]);

  useEffect(() => {
    const suppress = getStorageString("session", "inverview:suppress-next-page-secondary-animation") === "1";
    if (!suppress) return;
    removeStorageValue("session", "inverview:suppress-next-page-secondary-animation");
    const startTimerId = window.setTimeout(() => setSuppressSecondaryMotion(true), 0);
    const timerId = window.setTimeout(() => setSuppressSecondaryMotion(false), 450);
    return () => {
      window.clearTimeout(startTimerId);
      window.clearTimeout(timerId);
    };
  }, []);

  useEffect(() => {
    if (prevSidebarCollapsedRef.current === sidebarCollapsed) return;
    if (suppressSecondaryMotion) {
      prevSidebarCollapsedRef.current = sidebarCollapsed;
      return;
    }
    prevSidebarCollapsedRef.current = sidebarCollapsed;
    const startTimerId = window.setTimeout(() => setSidebarAnimating(true), 0);
    const timerId = window.setTimeout(() => setSidebarAnimating(false), 170);
    return () => {
      window.clearTimeout(startTimerId);
      window.clearTimeout(timerId);
    };
  }, [sidebarCollapsed, suppressSecondaryMotion]);

  useEffect(() => {
    let timeoutId = 0;
    const prefetch = () => {
      if (initialTab === "popular") {
        if (!queryClient.getQueryState(queryKeys.trending(category, region))) {
          void queryClient.prefetchQuery({
            queryKey: queryKeys.trending(category, region),
            queryFn: ({ signal }) => getTrending(category, region, signal),
          });
        }
        return;
      }

      if (!queryClient.getQueryState(queryKeys.popular)) {
        void queryClient.prefetchQuery({
          queryKey: queryKeys.popular,
          queryFn: ({ signal }) => getPopular(signal),
        });
      }
    };

    if (typeof window === "undefined") return;
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(prefetch, { timeout: 1500 });
      return () => window.cancelIdleCallback(id);
    }

    timeoutId = setTimeout(prefetch, 250);
    return () => {
      clearTimeout(timeoutId);
    };
  }, [category, initialTab, queryClient, region]);

  useEffect(() => {
    if (getStorageString("session", "invidious-start-page-applied") === "1") return;
    setStorageString("session", "invidious-start-page-applied", "1");
    if (settings.startPage === "home") return;
    if (settings.startPage === "trending") navigate("/?homeTab=trending", { replace: true });
    if (settings.startPage === "popular") navigate("/?homeTab=popular", { replace: true });
    if (settings.startPage === "subscriptions") navigate("/subscriptions", { replace: true });
    if (settings.startPage === "search") navigate("/search", { replace: true });
  }, [settings.startPage, navigate]);

  const refreshCurrentTab = async (): Promise<void> => {
    if (initialTab === "popular") {
      await popularQuery.refetch();
    } else {
      await Promise.all([
        trendingQuery.refetch(),
        token ? authFeedQuery.refetch() : localSubscribedVideosQuery.refetch(),
      ]);
    }
  };

  const renderPopular = (): JSX.Element => {
    return (
      <QueryStateView
        isLoading={popularQuery.isLoading}
        isError={popularQuery.isError}
        isEmpty={!popularVideos.length}
        errorTitle={t("home.popularFetchErrorTitle")}
        errorMessage={t("home.popularFetchErrorMessage")}
        emptyTitle={t("home.popularEmptyTitle")}
        emptyDescription={t("home.popularEmptyDescription")}
        onRetry={() => void popularQuery.refetch()}
      >
        <VideoGrid items={popularVideos} />
      </QueryStateView>
    );
  };

  const renderTrending = (): JSX.Element => {
    const isLoading =
      trendingQuery.isLoading ||
      authFeedQuery.isLoading ||
      localSubscribedVideosQuery.isLoading;
    const isError =
      trendingQuery.isError &&
      (token ? authFeedQuery.isError : localSubscribedVideosQuery.isError);

    return (
      <QueryStateView
        isLoading={isLoading}
        isError={isError}
        isEmpty={!mergedVideos.length}
        errorTitle={t("home.trendingFetchErrorTitle")}
        errorMessage={t("home.trendingFetchErrorMessage")}
        emptyTitle={t("home.trendingEmptyTitle")}
        emptyDescription={t("home.trendingEmptyDescription")}
        onRetry={() => {
          void trendingQuery.refetch();
          if (token) {
            void authFeedQuery.refetch();
          } else {
            void localSubscribedVideosQuery.refetch();
          }
        }}
      >
        <VideoGrid items={mergedVideos} />
      </QueryStateView>
    );
  };

  const onTabSelect: TabListProps["onTabSelect"] = (_, data) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("homeTab", data.value as string);
      return next;
    });
  };

  return (
    <div className={mergeClasses(styles.container, sidebarAnimating ? styles.sidebarResponsiveMotion : undefined)}>
      <div className={styles.tabHeader}>
        <TabList selectedValue={initialTab} onTabSelect={onTabSelect}>
          <Tab value="popular">{t("home.popularTab")}</Tab>
          <Tab value="trending">{t("home.trendingTab")}</Tab>
        </TabList>
        <Button
          icon={<ArrowClockwise24Regular />}
          title={t("home.refresh")}
          aria-label={t("home.refresh")}
          appearance="subtle"
          onClick={() => void refreshCurrentTab()}
        />
      </div>

      <div className={styles.tabContent}>
        {initialTab === "popular" ? (
          renderPopular()
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div
              className={styles.trendCategoryList}
              onScroll={(e) => {
                setIsScrolledLeft(e.currentTarget.scrollLeft > 2);
              }}
              style={{
                "--left-mask-opacity": isScrolledLeft ? 1 : 0,
              } as React.CSSProperties}
            >
              {trendCategories.map((cat) => (
                <Button
                  key={cat}
                  appearance={category === cat ? "primary" : "outline"}
                  className={styles.categoryButton}
                  onClick={() => {
                    triggerHaptic("click");
                    setSearchParams((prev) => {
                      const next = new URLSearchParams(prev);
                      next.set("category", cat);
                      next.set("homeTab", "trending");
                      return next;
                    });
                  }}
                >
                  {cat}
                </Button>
              ))}
            </div>
            {renderTrending()}
          </div>
        )}
      </div>
    </div>
  );
};
