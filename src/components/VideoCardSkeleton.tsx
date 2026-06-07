import {
  makeStyles,
  tokens,
  Skeleton,
  SkeletonItem,
  Card,
} from "@fluentui/react-components";

interface VideoCardSkeletonProps {
  horizontal?: boolean;
}

const useStyles = makeStyles({
  card: {
    width: "100%",
    padding: "0",
    border: "none",
    boxShadow: "none",
    backgroundColor: "transparent",
  },
  verticalContent: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "12px",
  },
  horizontalContent: {
    display: "flex",
    flexDirection: "row",
    gap: "12px",
    padding: "4px",
    alignItems: "flex-start",
  },
  thumbnail: {
    aspectRatio: "16 / 9",
    width: "100%",
    borderRadius: "8px",
  },
  horizontalThumbnail: {
    width: "160px",
    minWidth: "160px",
    height: "90px",
    borderRadius: "8px",
  },
  textCol: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    flexGrow: 1,
  },
  titleLine: {
    height: "16px",
    width: "90%",
  },
  metaLine: {
    height: "12px",
    width: "60%",
  },
});

export const VideoCardSkeleton = ({ horizontal = false }: VideoCardSkeletonProps): JSX.Element => {
  const styles = useStyles();

  return (
    <Card className={styles.card} appearance="subtle">
      <Skeleton>
        {horizontal ? (
          <div className={styles.horizontalContent}>
            <SkeletonItem className={styles.horizontalThumbnail} />
            <div className={styles.textCol}>
              <SkeletonItem className={styles.titleLine} />
              <SkeletonItem className={styles.titleLine} />
              <SkeletonItem className={styles.metaLine} />
            </div>
          </div>
        ) : (
          <div className={styles.verticalContent}>
            <SkeletonItem className={styles.thumbnail} />
            <div className={styles.textCol}>
              <SkeletonItem className={styles.titleLine} />
              <SkeletonItem className={styles.metaLine} />
            </div>
          </div>
        )}
      </Skeleton>
    </Card>
  );
};
