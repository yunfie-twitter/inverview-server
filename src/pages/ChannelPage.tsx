import {
  Text,
  makeStyles,
  tokens,
  Button,
  Avatar,
  Card,
  Tab,
  TabList,
  Spinner,
  Combobox,
  Option,
} from "@fluentui/react-components";
import DOMPurify from "dompurify";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { ChannelCard } from "../components/ChannelCard";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { ChannelPageSkeleton } from "../components/ChannelPageSkeleton";
import { LoadingGrid } from "../components/LoadingGrid";
import { MobileChannelHeader } from "../components/mobile/MobileChannelHeader";
import { PlaylistCard } from "../components/PlaylistCard";
import { VideoCard } from "../components/VideoCard";
import { VideoGrid } from "../components/VideoGrid";
import { formatNumberJa } from "../lib/format";
import {
  addSubscription,
  getAuthSubscriptions,
  getChannel,
  getChannelPlaylists,
  getChannelShorts,
  getChannelStreams,
  getChannelVideos,
  removeSubscription,
} from "../lib/invidiousClient";
import { pickBestThumbnail, resolveMediaUrl } from "../lib/media";
import { queryKeys } from "../lib/queryKeys";
import { useSettingsStore } from "../store/settingsStore";
import { useTranslation } from "react-i18next";
import { notifyError } from "../lib/notifications";
import { getYouTubeChannelVideos } from "../lib/youtubeJsData";
import type { VideoObject } from "../types/invidious";

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  banner: {
    width: "100%",
    height: "110px",
    borderRadius: "12px",
    backgroundPosition: "center",
    backgroundSize: "cover",
    "@media (min-width: 600px)": {
      height: "140px",
    },
    "@media (min-width: 1024px)": {
      height: "180px",
    },
  },
  desktopHeader: {
    display: "none",
    "@media (min-width: 768px)": {
      display: "flex",
      gap: "16px",
      alignItems: "start",
    },
  },
  mobileHeader: {
    display: "none",
    "@media (max-width: 767px)": {
      display: "flex",
      gap: "16px",
      alignItems: "start",
      padding: "8px 4px",
    },
  },
  mobileAvatar: {
    flexShrink: 0,
  },
  mobileHeaderInfo: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    minWidth: 0,
    flex: 1,
    textAlign: "left",
  },
  mobileTitle: {
    lineHeight: "22px",
    wordBreak: "break-word",
  },
  mobileHandle: {
    color: tokens.colorNeutralForeground3,
  },
  mobileSubscribers: {
    color: tokens.colorNeutralForeground3,
  },
  mobileSubscribeBtnArea: {
    marginTop: "8px",
  },
  headerInfo: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  tabArea: {
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    marginBottom: "4px",
  },
  descriptionCard: {
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  descriptionContent: {
    fontSize: "14px",
    overflow: "hidden",
    transition: "max-height 0.3s ease",
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "16px",
    "@media (min-width: 600px)": {
      gridTemplateColumns: "repeat(2, 1fr)",
    },
    "@media (min-width: 900px)": {
      gridTemplateColumns: "repeat(3, 1fr)",
    },
    "@media (min-width: 1200px)": {
      gridTemplateColumns: "repeat(4, 1fr)",
    },
    "@media (min-width: 1600px)": {
      gridTemplateColumns: "repeat(5, 1fr)",
    },
  },
  playlistGrid: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "16px",
    "@media (min-width: 600px)": {
      gridTemplateColumns: "repeat(2, 1fr)",
    },
    "@media (min-width: 1024px)": {
      gridTemplateColumns: "repeat(3, 1fr)",
    },
  },
  filterRow: {
    maxWidth: "240px",
    marginBottom: "12px",
  },
  loadMoreBtn: {
    alignSelf: "center",
    marginTop: "12px",
  },
  tabContent: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
});

const INFINITE_QUERY_GC_TIME_MS = 60_000;

const normalizeChannelVideoItems = (
  items: unknown[],
  type: "video" | "shortVideo" = "video",
): VideoObject[] => {
  return items
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const videoId = typeof record.videoId === "string"
        ? record.videoId.trim()
        : typeof record.playlistId === "string" && record.playlistId.trim().length === 11
          ? record.playlistId.trim()
          : "";

      if (!videoId) return null;

      const videoThumbnails = Array.isArray(record.videoThumbnails)
        ? record.videoThumbnails
        : typeof record.playlistThumbnail === "string"
          ? [{ quality: "medium", url: record.playlistThumbnail, width: 320, height: 180 }]
          : [];

      return {
        ...record,
        type,
        videoId,
        videoThumbnails,
      } as VideoObject;
    })
    .filter((item): item is VideoObject => item !== null);
};

export const ChannelPage = (): JSX.Element => {
  const styles = useStyles();
  const { t } = useTranslation();
  const { authorId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get("tab") || "home";
  const baseUrl = useSettingsStore((state) => state.apiBaseUrl);
  const token = useSettingsStore((state) => state.token);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [sortBy, setSortBy] = useState<"newest" | "popular" | "oldest">("newest");

  // Scroll to top of container when entering a channel page
  useEffect(() => {
    const el = document.getElementById("app-scroll-container");
    if (el) {
      el.scrollTo({ top: 0, behavior: "instant" });
    } else {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [authorId]);

  const subscribedQuery = useQuery({
    queryKey: [...queryKeys.authSubscriptions, authorId, "status"],
    queryFn: async () => {
      if (!authorId) return false;
      const subscriptions = await getAuthSubscriptions();
      return subscriptions.some((channel) => channel.authorId === authorId);
    },
    enabled: !!authorId && !!token,
  });

  const channelQuery = useQuery({
    queryKey: queryKeys.channel(authorId),
    queryFn: ({ signal }) => getChannel(authorId, signal),
    enabled: !!authorId,
  });

  const playlistsQuery = useQuery({
    queryKey: queryKeys.channelPlaylists(authorId),
    queryFn: ({ signal }) => getChannelPlaylists(authorId, {}, signal),
    enabled: !!authorId && (currentTab === "home" || currentTab === "playlists"),
  });

  // Videos, Shorts, Streams logic
  const mode = currentTab === "videos" ? "videos" : currentTab === "shorts" ? "shorts" : "streams";
  const isVideoTab = currentTab === "videos" || currentTab === "shorts" || currentTab === "streams";

  const videoListQuery = useInfiniteQuery({
    queryKey: queryKeys.channelVideos(authorId, sortBy, mode),
    queryFn: async ({ pageParam, signal }) => {
      const continuation = typeof pageParam === "string" ? pageParam : undefined;
      if (mode === "videos") {
        try {
          return await getChannelVideos(authorId, { sort_by: sortBy, continuation }, signal);
        } catch (error) {
          // Invidious側の一部インスタンスで /channels/:id/videos が落ちることがあるため、
          // 先頭ページは youtube.js を優先フォールバックし、だめなら latestVideos を使う。
          if (!continuation) {
            try {
              const videos = await getYouTubeChannelVideos(authorId);
              return { videos, continuation: undefined };
            } catch {
              const channel = await getChannel(authorId, signal);
              return { videos: channel.latestVideos ?? [], continuation: undefined };
            }
          }
          throw error;
        }
      }
      if (mode === "shorts") {
        return getChannelShorts(authorId, { continuation }, signal);
      }
      return getChannelStreams(authorId, { continuation }, signal);
    },
    getNextPageParam: (lastPage) => lastPage.continuation,
    initialPageParam: undefined as string | undefined,
    enabled: !!authorId && isVideoTab,
    gcTime: INFINITE_QUERY_GC_TIME_MS,
  });

  const videoListItems = useMemo(
    () =>
      videoListQuery.data?.pages.flatMap((page) =>
        normalizeChannelVideoItems(page.videos ?? [], currentTab === "shorts" ? "shortVideo" : "video"),
      ) ?? [],
    [currentTab, videoListQuery.data],
  );

  if (!authorId) return <EmptyState title={t("channelPage.noChannelIdTitle")} description={t("channelPage.noChannelIdDescription")} />;
  if (channelQuery.isLoading) return <ChannelPageSkeleton />;
  if (channelQuery.isError || !channelQuery.data) {
    return <ErrorState title={t("channelPage.fetchErrorTitle")} message={t("channelPage.fetchErrorMessage")} onRetry={() => channelQuery.refetch()} />;
  }

  const channel = channelQuery.data;
  const isSubscribed = subscribedQuery.data ?? false;
  const banner = channel.authorBanners?.[0];
  const avatar = pickBestThumbnail(channel.authorThumbnails);

  const onTabSelect = (_: any, data: any) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", data.value);
      return next;
    });
  };

  const toggleSubscribe = async (): Promise<void> => {
    if (!token) {
      notifyError(t("feed.loginRequiredDescription"));
      return;
    }
    try {
      if (isSubscribed) {
        await removeSubscription(authorId);
      } else {
        await addSubscription(authorId);
      }
      void subscribedQuery.refetch();
    } catch (error) {
      console.error(error);
      notifyError(t("subscriptions.fetchErrorAuth"));
    }
  };

  const renderHome = () => (
    <>
      <Card appearance="outline" className={styles.descriptionCard}>
        <div
          className={styles.descriptionContent}
          style={{ maxHeight: showFullDescription ? "none" : "120px" }}
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(channel.descriptionHtml || channel.description || t("channelPage.noDescription")) }}
        />
        <Button
          appearance="subtle"
          size="small"
          style={{ alignSelf: "flex-start" }}
          onClick={() => setShowFullDescription((prev) => !prev)}
        >
          {showFullDescription ? t("channelPage.closeDescription") : t("watch.showMore")}
        </Button>
      </Card>

      <div className={styles.section}>
        <Text size={400} weight="bold">{t("channelPage.latestVideos")}</Text>
        {(channel.latestVideos ?? []).length === 0 ? (
          <EmptyState title={t("channel.emptyTitle")} description={t("channelPage.latestEmptyDescription")} />
        ) : (
          <div className={styles.grid}>
            {(channel.latestVideos ?? []).map((v) => (
              <VideoCard key={v.videoId} video={v} />
            ))}
          </div>
        )}
      </div>

      {(playlistsQuery.data?.playlists?.length ?? 0) > 0 && (
        <div className={styles.section}>
          <Text size={400} weight="bold">{t("channelPage.playlists")}</Text>
          <div className={styles.playlistGrid}>
            {(playlistsQuery.data?.playlists ?? []).slice(0, 6).map((p) => (
              <PlaylistCard key={p.playlistId} playlist={p} />
            ))}
          </div>
        </div>
      )}

      {(channel.relatedChannels ?? []).length > 0 && (
        <div className={styles.section}>
          <Text size={400} weight="bold">{t("channelPage.relatedChannels")}</Text>
          <div className={styles.playlistGrid}>
            {(channel.relatedChannels ?? []).slice(0, 6).map((related) => (
              <ChannelCard key={related.authorId} channel={related} />
            ))}
          </div>
        </div>
      )}
    </>
  );

  const renderVideoList = () => (
    <div className={styles.section}>
      {currentTab === "videos" && (
        <div className={styles.filterRow}>
          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>{t("channelPage.sortLabel")}</Text>
          <Combobox
            selectedOptions={[sortBy]}
            value={sortBy}
            onOptionSelect={(_, data) => setSortBy(data.optionValue as any)}
          >
            <Option value="newest">{t("common.sortNewest")}</Option>
            <Option value="popular">{t("common.sortPopular")}</Option>
            <Option value="oldest">{t("common.sortOldest")}</Option>
          </Combobox>
        </div>
      )}
      
      {videoListQuery.isLoading ? <LoadingGrid /> : null}
      {videoListQuery.isError ? <ErrorState title={t("channelPage.loadErrorTitle")} message={t("channelPage.loadVideosErrorMessage")} onRetry={() => videoListQuery.refetch()} /> : null}
      {!videoListQuery.isLoading && !videoListQuery.isError && videoListItems.length === 0 ? (
        <EmptyState title={t("channel.emptyTitle")} description={t("channel.emptyDescription")} />
      ) : null}
      {videoListItems.length > 0 && <VideoGrid items={videoListItems} isShorts={currentTab === "shorts"} authorId={authorId} />}

      {videoListQuery.hasNextPage && (
        <Button
          className={styles.loadMoreBtn}
          onClick={() => videoListQuery.fetchNextPage()}
          disabled={videoListQuery.isFetchingNextPage}
          appearance="outline"
          icon={videoListQuery.isFetchingNextPage ? <Spinner size="tiny" /> : undefined}
        >
          {t("common.loadMore")}
        </Button>
      )}
    </div>
  );

  const renderPlaylists = () => (
    <div className={styles.section}>
      {playlistsQuery.isLoading ? <LoadingGrid count={4} /> : null}
      {playlistsQuery.isError ? <ErrorState title={t("channelPage.loadErrorTitle")} message={t("channelPage.loadPlaylistsErrorMessage")} onRetry={() => playlistsQuery.refetch()} /> : null}
      {!playlistsQuery.isLoading && !playlistsQuery.isError && (playlistsQuery.data?.playlists?.length ?? 0) === 0 ? (
        <EmptyState title={t("channelPage.playlistsEmptyTitle")} description={t("channelPage.playlistsEmptyDescription")} />
      ) : null}
      {(playlistsQuery.data?.playlists?.length ?? 0) > 0 && (
        <div className={styles.playlistGrid}>
          {(playlistsQuery.data?.playlists ?? []).map((p) => (
            <PlaylistCard key={p.playlistId} playlist={p} />
          ))}
        </div>
      )}
    </div>
  );

  const handleName = (channel as any).handle
    ? (channel as any).handle
    : ((channel as any).username
        ? `@${(channel as any).username}`
        : `@${channel.author.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || "channel"}`);

  return (
    <div className={styles.container}>
      {banner?.url ? (
        <div
          className={styles.banner}
          style={{ backgroundImage: `url(${resolveMediaUrl(banner.url, baseUrl)})` }}
        />
      ) : null}

      <div className={styles.desktopHeader}>
        <Avatar
          image={{ src: resolveMediaUrl(avatar?.url, baseUrl) }}
          name={channel.author}
          size={96}
        />
        <div className={styles.headerInfo}>
          <Text size={600} weight="bold">{channel.author}</Text>
          <Text style={{ color: tokens.colorNeutralForeground3 }} size={200}>{handleName}</Text>
          <Text style={{ color: tokens.colorNeutralForeground3 }} size={200}>
            {t("channelPage.subscribers", { count: formatNumberJa(channel.subCount) })}
            {(channel as any).videoCount !== undefined && ` ・ ${(channel as any).videoCount} 本の動画`}
          </Text>
          <div style={{ marginTop: "8px" }}>
            <Button appearance={isSubscribed ? "outline" : "primary"} size="small" onClick={() => void toggleSubscribe()}>
              {isSubscribed ? t("channelPage.unsubscribe") : t("channelPage.subscribe")}
            </Button>
          </div>
        </div>
      </div>

      <div className={styles.mobileHeader}>
        <Avatar
          image={{ src: resolveMediaUrl(avatar?.url, baseUrl) }}
          name={channel.author}
          size={72}
          className={styles.mobileAvatar}
        />
        <div className={styles.mobileHeaderInfo}>
          <Text size={500} weight="bold" className={styles.mobileTitle}>
            {channel.author}
          </Text>
          <Text size={200} className={styles.mobileHandle}>
            {handleName}
          </Text>
          <Text size={100} className={styles.mobileSubscribers}>
            {t("channelPage.subscribers", { count: formatNumberJa(channel.subCount) })}
            {(channel as any).videoCount !== undefined && ` ・ ${(channel as any).videoCount} 本の動画`}
          </Text>
          <div className={styles.mobileSubscribeBtnArea}>
            <Button
              appearance={isSubscribed ? "outline" : "primary"}
              size="small"
              onClick={() => void toggleSubscribe()}
            >
              {isSubscribed ? t("channelPage.unsubscribe") : t("channelPage.subscribe")}
            </Button>
          </div>
        </div>
      </div>

      <div className={styles.tabArea}>
        <TabList selectedValue={currentTab} onTabSelect={onTabSelect}>
          <Tab value="home">{t("channelPage.tabHome")}</Tab>
          <Tab value="videos">{t("channelPage.tabVideos")}</Tab>
          <Tab value="shorts">{t("channelPage.tabShorts")}</Tab>
          <Tab value="streams">{t("channelPage.tabStreams")}</Tab>
          <Tab value="playlists">{t("channelPage.tabPlaylists")}</Tab>
        </TabList>
      </div>

      <div className={styles.tabContent}>
        {currentTab === "home" && renderHome()}
        {isVideoTab && renderVideoList()}
        {currentTab === "playlists" && renderPlaylists()}
      </div>
    </div>
  );
};
