import {
  Text,
  makeStyles,
  tokens,
  Button,
  Spinner,
  Combobox,
  Option,
} from "@fluentui/react-components";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { PageTitle } from "../components/PageTitle";
import { QueryStateView } from "../components/QueryStateView";
import { VideoGrid } from "../components/VideoGrid";
import { getChannelShorts, getChannelStreams, getChannelVideos } from "../lib/invidiousClient";
import { queryKeys } from "../lib/queryKeys";

type Mode = "videos" | "shorts" | "streams";

interface ChannelVideosPageProps {
  mode: Mode;
}

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  filterRow: {
    maxWidth: "240px",
  },
  loadMoreBtn: {
    alignSelf: "center",
    marginTop: "12px",
  },
});

const INFINITE_QUERY_GC_TIME_MS = 60_000;

export const ChannelVideosPage = ({ mode }: ChannelVideosPageProps): JSX.Element => {
  const styles = useStyles();
  const { t } = useTranslation();
  const { authorId = "" } = useParams();
  const [sortBy, setSortBy] = useState<"newest" | "popular" | "oldest">("newest");

  const title = mode === "videos" ? t("channel.videosTitle") : mode === "shorts" ? t("channel.shortsTitle") : t("channel.streamsTitle");

  const query = useInfiniteQuery({
    queryKey: queryKeys.channelVideos(authorId, sortBy, mode),
    queryFn: ({ pageParam, signal }) => {
      const continuation = typeof pageParam === "string" ? pageParam : undefined;
      if (mode === "videos") {
        return getChannelVideos(authorId, { sort_by: sortBy, continuation }, signal);
      }
      if (mode === "shorts") {
        return getChannelShorts(authorId, { continuation }, signal);
      }
      return getChannelStreams(authorId, { continuation }, signal);
    },
    getNextPageParam: (lastPage) => lastPage.continuation,
    initialPageParam: undefined as string | undefined,
    enabled: !!authorId,
    gcTime: INFINITE_QUERY_GC_TIME_MS,
  });

  const videos = useMemo(() => query.data?.pages.flatMap((page) => page.videos ?? []) ?? [], [query.data]);

  return (
    <div className={styles.container}>
      <PageTitle title={title} />

      {mode === "videos" ? (
        <div className={styles.filterRow}>
          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>{t("common.sort")}</Text>
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
      ) : null}

      <QueryStateView
        isLoading={query.isLoading}
        isError={query.isError}
        isEmpty={videos.length === 0}
        errorTitle={t("channel.fetchErrorTitle")}
        errorMessage={t("channel.fetchErrorMessage")}
        emptyTitle={t("channel.emptyTitle")}
        emptyDescription={t("channel.emptyDescription")}
        onRetry={() => query.refetch()}
      >
        <VideoGrid items={videos} />
      </QueryStateView>

      {query.hasNextPage ? (
        <Button
          className={styles.loadMoreBtn}
          onClick={() => query.fetchNextPage()}
          disabled={query.isFetchingNextPage}
          appearance="outline"
          icon={query.isFetchingNextPage ? <Spinner size="tiny" /> : undefined}
        >
          {t("common.loadMore")}
        </Button>
      ) : null}
    </div>
  );
};
