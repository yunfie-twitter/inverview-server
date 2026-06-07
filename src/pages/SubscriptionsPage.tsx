import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Text,
  makeStyles,
  Button,
  Spinner,
  Tooltip,
  mergeClasses,
} from "@fluentui/react-components";
import { Star16Filled, Star16Regular } from "@fluentui/react-icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { ChannelCard } from "../components/ChannelCard";
import { ChannelCardSkeleton } from "../components/ChannelCardSkeleton";
import { EmptyState } from "../components/EmptyState";
import { PageTitle } from "../components/PageTitle";
import { QueryStateView } from "../components/QueryStateView";
import { VideoGrid } from "../components/VideoGrid";
import { getAuthSubscriptions, removeSubscription } from "../lib/invidiousClient";
import { getLocalSubscriptionIds, removeLocalSubscription } from "../lib/localSubscriptions";
import { getCurrentLocalUser } from "../lib/localUsers";
import { queryKeys } from "../lib/queryKeys";
import { getAuthFeed, getChannel } from "../lib/invidiousClient";
import { useSettingsStore } from "../store/settingsStore";
import { settledWithConcurrencyLimit } from "../lib/promiseLimit";
import { getStorageString, removeStorageValue } from "../lib/browserStorage";
import type { ChannelObject } from "../types/invidious";

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  suppressSecondaryMotion: {
    animation: "none !important",
    transition: "none !important",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "16px",
    "@media (min-width: 768px)": {
      gridTemplateColumns: "1fr 1fr",
    },
  },
  channelItem: {
    minWidth: 0,
  },
  viewSwitcher: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    alignItems: "center",
  },
});

export const SubscriptionsPage = (): JSX.Element => {
  const styles = useStyles();
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const token = useSettingsStore((state) => state.token);
  const localUser = getCurrentLocalUser();
  const view = searchParams.get("view");
  const isListView = view === "list";

  const parentRef = useRef<HTMLDivElement | null>(null);
  const appScrollRef = useRef<HTMLElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [suppressSecondaryMotion, setSuppressSecondaryMotion] = useState(false);

  const feedQuery = useQuery({
    queryKey: queryKeys.authFeed(1),
    queryFn: ({ signal }) => getAuthFeed({ page: 1 }, signal),
    enabled: !!token && !isListView,
  });

  const subscriptionsQuery = useQuery({
    queryKey: queryKeys.authSubscriptions,
    queryFn: ({ signal }) => getAuthSubscriptions(signal),
    enabled: !!token,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
  });

  const localSubscriptionIdsQuery = useQuery({
    queryKey: queryKeys.localSubscriptions(localUser.id),
    queryFn: async () => getLocalSubscriptionIds(),
    enabled: !token,
  });

  const localSubscriptionsQuery = useQuery({
    queryKey: [...queryKeys.localSubscriptions(localUser.id), "channels"],
    queryFn: async ({ signal }) => {
      const ids = getLocalSubscriptionIds();
      const settled = await settledWithConcurrencyLimit(ids, 3, (id) => getChannel(id, signal));
      return settled
        .filter((item): item is PromiseFulfilledResult<Awaited<ReturnType<typeof getChannel>>> => item.status === "fulfilled")
        .map((item) => item.value);
    },
    enabled: !token,
  });

  const removeMutation = useMutation({
    mutationFn: (ucid: string) => removeSubscription(ucid),
    onSuccess: () => subscriptionsQuery.refetch(),
  });

  const removeLocalMutation = useMutation({
    mutationFn: async (ucid: string) => {
      removeLocalSubscription(ucid);
    },
    onSuccess: () => {
      void localSubscriptionIdsQuery.refetch();
      void localSubscriptionsQuery.refetch();
    },
  });

  const subscriptions = useMemo(
    () => (token ? subscriptionsQuery.data ?? [] : localSubscriptionsQuery.data ?? []),
    [localSubscriptionsQuery.data, subscriptionsQuery.data, token],
  );
  const normalizedSubscriptions: ChannelObject[] = useMemo(
    () =>
      subscriptions.map((channel) => {
        const raw = "type" in channel ? (channel as ChannelObject) : ({ ...channel, type: "channel" } as ChannelObject);
        const authorId = raw.authorId || raw.authorUrl?.split("/channel/")[1]?.split("/")[0] || "";
        return raw.authorId === authorId ? raw : { ...raw, authorId };
      }),
    [subscriptions],
  );
  const feedVideos = feedQuery.data?.videos ?? [];
  const isLoading = token ? subscriptionsQuery.isLoading : localSubscriptionsQuery.isLoading;
  const isError = token ? subscriptionsQuery.isError : localSubscriptionsQuery.isError;
  const isLocalEmpty = !token && (localSubscriptionIdsQuery.data?.length ?? 0) === 0;
  const isFetching = token
    ? (isListView ? subscriptionsQuery.isFetching : feedQuery.isFetching)
    : (isListView ? localSubscriptionsQuery.isFetching : false);

  const shouldVirtualize = normalizedSubscriptions.length >= 30;

  useEffect(() => {
    const suppress = getStorageString("session", "inverview:suppress-next-page-secondary-animation") === "1";
    if (!suppress) return;
    removeStorageValue("session", "inverview:suppress-next-page-secondary-animation");
    setSuppressSecondaryMotion(true);
    const timerId = window.setTimeout(() => setSuppressSecondaryMotion(false), 450);
    return () => window.clearTimeout(timerId);
  }, []);

  useEffect(() => {
    appScrollRef.current = document.getElementById("app-scroll-container");
  }, []);

  useEffect(() => {
    if (!shouldVirtualize) return;
    const target = parentRef.current;
    if (!target) return;
    const updateWidth = () => {
      setContainerWidth(target.clientWidth);
    };
    updateWidth();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateWidth);
      return () => window.removeEventListener("resize", updateWidth);
    }
    const observer = new ResizeObserver(updateWidth);
    observer.observe(target);
    return () => observer.disconnect();
  }, [shouldVirtualize]);

  const columnCount = useMemo(() => {
    const width = containerWidth || (typeof window !== "undefined" ? window.innerWidth : 768);
    return width >= 768 ? 2 : 1;
  }, [containerWidth]);

  const rowCount = Math.ceil(normalizedSubscriptions.length / columnCount);

  const rowVirtualizer = useVirtualizer({
    count: shouldVirtualize ? rowCount : 0,
    getScrollElement: () => appScrollRef.current,
    estimateSize: () => 108,
    overscan: 3,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();

  const renderAction = useCallback((channel: ChannelObject) => (
    <Tooltip content={t("subscriptions.unsubscribe")} relationship="description">
      <Button
        size="small"
        appearance="subtle"
        aria-label={t("subscriptions.unsubscribe")}
        icon={
          token
            ? (removeMutation.isPending ? <Spinner size="tiny" /> : <Star16Filled />)
            : (removeLocalMutation.isPending ? <Spinner size="tiny" /> : <Star16Regular />)
        }
        disabled={token ? removeMutation.isPending : removeLocalMutation.isPending}
        onClick={(event) => {
          event.stopPropagation();
          if (token) {
            removeMutation.mutate(channel.authorId);
            return;
          }
          removeLocalMutation.mutate(channel.authorId);
        }}
      />
    </Tooltip>
  ), [removeLocalMutation, removeMutation, t, token]);

  return (
    <div className={mergeClasses(styles.container, suppressSecondaryMotion && styles.suppressSecondaryMotion)}>
      <PageTitle title={isListView ? t("subscriptions.title") : t("feed.title")} />
      <div className={styles.viewSwitcher}>
        <Button
          size="small"
          appearance={!isListView ? "primary" : "outline"}
          onClick={() => setSearchParams(new URLSearchParams())}
        >
          {t("feed.title")}
        </Button>
        <Button
          size="small"
          appearance={isListView ? "primary" : "outline"}
          onClick={() => setSearchParams({ view: "list" })}
        >
          {t("subscriptions.title")}
        </Button>
        {isFetching && <Spinner size="tiny" style={{ marginLeft: "8px" }} />}
      </div>

      {!isListView ? (
        <>
          {!token ? <EmptyState title={t("feed.loginRequiredTitle")} description={t("feed.loginRequiredDescription")} /> : null}
          {token ? (
            <QueryStateView
              isLoading={feedQuery.isLoading}
              isError={feedQuery.isError}
              isEmpty={feedVideos.length === 0}
              errorTitle={t("feed.fetchErrorTitle")}
              errorMessage={t("feed.fetchErrorMessage")}
              emptyTitle={t("feed.emptyTitle")}
              emptyDescription={t("feed.emptyDescription")}
              onRetry={() => feedQuery.refetch()}
            >
              <VideoGrid items={feedVideos} />
            </QueryStateView>
          ) : null}
        </>
      ) : (
        <>
          {!token ? <Text size={200}>{t("subscriptions.currentLocalUser", { name: localUser.name })}</Text> : null}
          {isLoading ? (
            <div className={styles.grid}>
              {Array.from({ length: 8 }).map((_, index) => (
                <ChannelCardSkeleton key={index} />
              ))}
            </div>
          ) : (
            <QueryStateView
              isLoading={false}
              isError={isError}
              isEmpty={isLocalEmpty || normalizedSubscriptions.length === 0}
              errorTitle={t("subscriptions.fetchErrorTitle")}
              errorMessage={token ? t("subscriptions.fetchErrorAuth") : t("subscriptions.fetchErrorLocal")}
              emptyTitle={t("subscriptions.emptyTitle")}
              emptyDescription={token ? t("subscriptions.emptyAuth") : t("subscriptions.emptyLocal")}
              onRetry={() => (token ? subscriptionsQuery.refetch() : localSubscriptionsQuery.refetch())}
            >
              {shouldVirtualize ? (
                <div ref={parentRef}>
                  <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative", width: "100%" }}>
                    {virtualRows.map((virtualRow) => {
                      const startIndex = virtualRow.index * columnCount;
                      const rowChannels = normalizedSubscriptions.slice(startIndex, startIndex + columnCount);
                      return (
                        <div
                          key={virtualRow.key}
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            transform: `translateY(${virtualRow.start}px)`,
                          }}
                        >
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
                              gap: "16px",
                              paddingBottom: "16px",
                              boxSizing: "border-box",
                            }}
                          >
                            {rowChannels.map((channel) => (
                              <div key={channel.authorId} className={styles.channelItem}>
                                <ChannelCard
                                  channel={channel}
                                  action={renderAction(channel)}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className={styles.grid}>
                  {normalizedSubscriptions.map((channel) => (
                    <div key={channel.authorId} className={styles.channelItem}>
                      <ChannelCard
                        channel={channel}
                        action={renderAction(channel)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </QueryStateView>
          )}
        </>
      )}
    </div>
  );
};
