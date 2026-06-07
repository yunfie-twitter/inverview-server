import {
  makeStyles,
} from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { EmptyState } from "../components/EmptyState";
import { PageTitle } from "../components/PageTitle";
import { QueryStateView } from "../components/QueryStateView";
import { VideoGrid } from "../components/VideoGrid";
import { getAuthFeed } from "../lib/invidiousClient";
import { queryKeys } from "../lib/queryKeys";
import { useSettingsStore } from "../store/settingsStore";
import type { AuthFeedResponse } from "../types/invidious";

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
});

export const FeedPage = (): JSX.Element => {
  const styles = useStyles();
  const { t } = useTranslation();
  const token = useSettingsStore((state) => state.token);

  const feedQuery = useQuery<AuthFeedResponse>({
    queryKey: queryKeys.authFeed(1),
    queryFn: ({ signal }) => getAuthFeed({ page: 1 }, signal),
    enabled: !!token,
  });

  if (!token) {
    return <EmptyState title={t("feed.loginRequiredTitle")} description={t("feed.loginRequiredDescription")} />;
  }

  const videos = feedQuery.data?.videos ?? [];

  return (
    <div className={styles.container}>
      <PageTitle title={t("feed.title")} />
      <QueryStateView
        isLoading={feedQuery.isLoading}
        isError={feedQuery.isError}
        isEmpty={videos.length === 0}
        errorTitle={t("feed.fetchErrorTitle")}
        errorMessage={t("feed.fetchErrorMessage")}
        emptyTitle={t("feed.emptyTitle")}
        emptyDescription={t("feed.emptyDescription")}
        onRetry={() => feedQuery.refetch()}
      >
        <VideoGrid items={videos} />
      </QueryStateView>
    </div>
  );
};
