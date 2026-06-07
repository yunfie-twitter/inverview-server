import {
  Text,
  makeStyles,
  tokens,
  Button,
  Dropdown,
  Option,
} from "@fluentui/react-components";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getComments } from "../lib/invidiousClient";
import { queryKeys } from "../lib/queryKeys";
import { CommentCard } from "./CommentCard";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { LoadingGrid } from "./LoadingGrid";
import { useTranslation } from "react-i18next";

interface CommentsProps {
  videoId: string;
  initiallyExpanded?: boolean;
  onTimestampClick?: (seconds: number) => void;
}

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "8px",
  },
  controls: {
    display: "flex",
    gap: "8px",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    marginTop: "8px",
  },
  loadMoreBtn: {
    alignSelf: "center",
    marginTop: "8px",
  },
});

export const Comments = ({ videoId, initiallyExpanded = true, onTimestampClick }: CommentsProps): JSX.Element => {
  const styles = useStyles();
  const { t } = useTranslation();
  const [sortBy, setSortBy] = useState<"top" | "new">("top");
  const [continuation, setContinuation] = useState<string | undefined>(undefined);
  const [visibleCount, setVisibleCount] = useState(4);
  const [expanded, setExpanded] = useState(initiallyExpanded);

  const commentsQuery = useQuery({
    queryKey: queryKeys.comments(videoId, sortBy, continuation),
    queryFn: ({ signal }) => getComments(videoId, sortBy, continuation, signal),
    enabled: !!videoId,
  });

  useEffect(() => {
    setVisibleCount(4);
  }, [sortBy, videoId, continuation]);

  const comments = commentsQuery.data?.comments ?? [];
  const visibleComments = useMemo(() => comments.slice(0, visibleCount), [comments, visibleCount]);

  if (commentsQuery.isLoading) return <LoadingGrid count={3} />;
  if (commentsQuery.isError) {
    return <ErrorState title={t("comments.fetchErrorTitle")} message={t("comments.fetchErrorMessage")} onRetry={() => commentsQuery.refetch()} />;
  }


  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Text weight="semibold">{t("comments.title")}</Text>
        <div className={styles.controls}>
          <Dropdown
            aria-label={t("common.sort")}
            value={sortBy === "new" ? t("comments.sortNew") : t("comments.sortTop")}
            selectedOptions={[sortBy]}
            size="small"
            onOptionSelect={(_, data) => {
              const value = data.optionValue === "new" ? "new" : "top";
              setSortBy(value);
              setContinuation(undefined);
            }}
          >
            <Option value="top">{t("comments.sortTop")}</Option>
            <Option value="new">{t("comments.sortNew")}</Option>
          </Dropdown>
          <Button size="small" appearance="outline" onClick={() => setExpanded((prev) => !prev)}>
            {expanded ? t("comments.collapse") : t("comments.expand")}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className={styles.list}>
          {comments.length === 0 ? (
            <EmptyState title={t("comments.emptyTitle")} description={t("comments.emptyDescription")} />
          ) : (
            visibleComments.map((comment) => (
              <CommentCard key={comment.commentId} comment={comment} onTimestampClick={onTimestampClick} />
            ))
          )}

          {comments.length > visibleCount && (
            <Button appearance="outline" className={styles.loadMoreBtn} onClick={() => setVisibleCount((prev) => prev + 4)}>
              {t("comments.loadMore")}
            </Button>
          )}

          {commentsQuery.data?.continuation && (
            <Button
              appearance="outline"
              className={styles.loadMoreBtn}
              onClick={() => setContinuation(commentsQuery.data?.continuation)}
            >
              {t("comments.loadNext")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

