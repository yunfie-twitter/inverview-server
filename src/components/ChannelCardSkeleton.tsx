import {
  makeStyles,
  tokens,
  Skeleton,
  SkeletonItem,
  Card,
  shorthands,
} from "@fluentui/react-components";

const useStyles = makeStyles({
  card: {
    width: "100%",
    padding: "16px",
    backgroundColor: tokens.colorNeutralBackgroundAlpha,
    ...shorthands.borderRadius("var(--app-radius, 12px)"),
    boxSizing: "border-box",
  },
  content: {
    display: "flex",
    flexDirection: "row",
    gap: "16px",
    alignItems: "center",
  },
  avatar: {
    width: "48px",
    height: "48px",
    ...shorthands.borderRadius("50%"),
    flexShrink: 0,
  },
  info: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    flexGrow: 1,
    minWidth: 0,
  },
  titleLine: {
    height: "16px",
    width: "50%",
  },
  metaLine: {
    height: "12px",
    width: "30%",
  },
  descLine: {
    height: "12px",
    width: "90%",
  },
  action: {
    width: "24px",
    height: "24px",
    ...shorthands.borderRadius("4px"),
    flexShrink: 0,
  },
});

export const ChannelCardSkeleton = (): JSX.Element => {
  const styles = useStyles();

  return (
    <Card className={styles.card} appearance="outline">
      <Skeleton>
        <div className={styles.content}>
          <SkeletonItem className={styles.avatar} />
          <div className={styles.info}>
            <SkeletonItem className={styles.titleLine} />
            <SkeletonItem className={styles.metaLine} />
            <SkeletonItem className={styles.descLine} />
          </div>
          <SkeletonItem className={styles.action} />
        </div>
      </Skeleton>
    </Card>
  );
};
