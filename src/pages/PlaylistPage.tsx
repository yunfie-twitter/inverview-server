import {
  Text,
  makeStyles,
  tokens,
  Button,
  Card,
  Link,
  Spinner,
} from "@fluentui/react-components";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { Link as RouterLink, useParams } from "react-router-dom";
import { useMemo } from "react";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { LoadingGrid } from "../components/LoadingGrid";
import { Thumbnail } from "../components/Thumbnail";
import { formatDuration } from "../lib/format";
import { getPlaylist } from "../lib/invidiousClient";
import { getLocalPlaylist } from "../lib/localPlaylists";
import { pickBestThumbnail } from "../lib/media";
import { queryKeys } from "../lib/queryKeys";
import { useSettingsStore } from "../store/settingsStore";
import { useState } from "react";
import { useTranslation } from "react-i18next";

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  header: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  controlCard: {
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  btnRow: {
    display: "flex",
    gap: "8px",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  videoItem: {
    display: "flex",
    gap: "12px",
    alignItems: "start",
  },
  thumbnailWrap: {
    width: "140px",
    flexShrink: 0,
    cursor: "pointer",
    "@media (max-width: 600px)": {
      width: "100px",
    },
  },
  videoInfo: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    flexGrow: 1,
  },
  loadMoreBtn: {
    alignSelf: "center",
    marginTop: "12px",
  },
});

export const PlaylistPage = (): JSX.Element => {
  const styles = useStyles();
  const { t } = useTranslation();
  const { playlistId = "" } = useParams();
  const baseUrl = useSettingsStore((state) => state.apiBaseUrl);
  const [currentIndex, setCurrentIndex] = useState(0);
  const isLocalPlaylist = playlistId.startsWith("local-");
  const localPlaylist = useMemo(() => (isLocalPlaylist ? getLocalPlaylist(playlistId) : null), [isLocalPlaylist, playlistId]);

  const playlistQuery = useInfiniteQuery({
    queryKey: queryKeys.playlist(playlistId),
    queryFn: ({ pageParam = 1, signal }) => getPlaylist(playlistId, pageParam, signal),
    getNextPageParam: (lastPage, allPages) => {
      const loadedVideosCount = allPages.flatMap((p) => p.videos ?? []).length;
      const totalVideosCount = lastPage.videoCount ?? 0;
      if (loadedVideosCount < totalVideosCount && (lastPage.videos?.length ?? 0) > 0) {
        return allPages.length + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
    enabled: !!playlistId && !isLocalPlaylist,
  });

  const playlist = useMemo(() => {
    if (isLocalPlaylist) return localPlaylist;
    if (!playlistQuery.data?.pages?.[0]) return null;

    const firstPage = playlistQuery.data.pages[0];
    const allVideos = playlistQuery.data.pages.flatMap((page) => page.videos ?? []);
    return {
      ...firstPage,
      videos: allVideos,
    };
  }, [isLocalPlaylist, localPlaylist, playlistQuery.data]);

  if (!playlistId) return <EmptyState title={t("playlistPage.noPlaylistIdTitle")} description={t("playlistPage.noPlaylistIdDescription")} />;
  if (!isLocalPlaylist && playlistQuery.isLoading) return <LoadingGrid />;
  if (isLocalPlaylist && !localPlaylist) {
    return <ErrorState title={t("playlistPage.fetchErrorTitle")} message={t("playlistPage.localNotFoundMessage")} onRetry={() => window.location.reload()} />;
  }
  if (!isLocalPlaylist && (playlistQuery.isError || !playlist)) {
    return <ErrorState title={t("playlistPage.fetchErrorTitle")} message={t("playlistPage.fetchErrorMessage")} onRetry={() => playlistQuery.refetch()} />;
  }

  const videos = playlist.videos ?? [];
  const current = videos[currentIndex];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Text size={600} weight="bold">{playlist.title}</Text>
        <Text style={{ color: tokens.colorNeutralForeground3 }}>
          {t("playlistPage.authorAndCount", { author: playlist.author, count: playlist.videoCount ?? videos.length })}
        </Text>
      </div>

      {videos.length > 0 ? (
        <Card appearance="outline" className={styles.controlCard}>
          <Text weight="bold">{t("playlistPage.autoplayTitle")}</Text>
          <Text size={200}>
            {currentIndex + 1} / {videos.length} : {current?.title}
          </Text>
          <div className={styles.btnRow}>
            <Button
              appearance="outline"
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
            >
              {t("playlistPage.previous")}
            </Button>
            <Button
              appearance="outline"
              onClick={() => setCurrentIndex((prev) => Math.min(videos.length - 1, prev + 1))}
              disabled={currentIndex >= videos.length - 1}
            >
              {t("playlistPage.next")}
            </Button>
            {current?.videoId ? (
              <RouterLink to={`/watch/${current.videoId}?autoplay=1`}>
                <Button appearance="primary">{t("playlistPage.openWatchPage")}</Button>
              </RouterLink>
            ) : null}
          </div>
        </Card>
      ) : null}

      {videos.length === 0 ? (
        <EmptyState title={t("playlistPage.emptyTitle")} description={t("playlistPage.emptyDescription")} />
      ) : (
        <>
          <div className={styles.list}>
            {videos.map((video, index) => {
              const thumbnail = pickBestThumbnail(video.videoThumbnails);
              return (
                <div key={`${video.videoId}-${index}`} className={styles.videoItem}>
                  <div className={styles.thumbnailWrap} onClick={() => setCurrentIndex(index)}>
                    <Thumbnail src={thumbnail?.url} alt={video.title} baseUrl={baseUrl} ratio={16 / 9} />
                  </div>
                  <div className={styles.videoInfo}>
                    <Text weight={index === currentIndex ? "bold" : "medium"}>
                      {index + 1}. {video.title}
                    </Text>
                    <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                      {video.author || t("playlistPage.unknownAuthor")} ・ {formatDuration(video.lengthSeconds)}
                    </Text>
                    <RouterLink to={`/watch/${video.videoId}?autoplay=1`} style={{ color: tokens.colorBrandForeground1 }}>
                      <Link>{t("playlistPage.watch")}</Link>
                    </RouterLink>
                  </div>
                </div>
              );
            })}
          </div>

          {playlistQuery.hasNextPage && (
            <Button
              className={styles.loadMoreBtn}
              onClick={() => playlistQuery.fetchNextPage()}
              disabled={playlistQuery.isFetchingNextPage}
              appearance="outline"
              icon={playlistQuery.isFetchingNextPage ? <Spinner size="tiny" /> : undefined}
            >
              {t("common.loadMore")}
            </Button>
          )}
        </>
      )}
    </div>
  );
};
