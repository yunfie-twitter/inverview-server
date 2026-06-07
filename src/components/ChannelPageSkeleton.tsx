import {
  makeStyles,
  tokens,
  Skeleton,
  SkeletonItem,
  shorthands,
} from "@fluentui/react-components";
import { VideoCardSkeleton } from "./VideoCardSkeleton";

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  banner: {
    width: "100%",
    height: "110px",
    ...shorthands.borderRadius("12px"),
    "@media (min-width: 600px)": {
      height: "140px",
    },
    "@media (min-width: 1024px)": {
      height: "180px",
    },
  },
  header: {
    display: "flex",
    gap: "16px",
    alignItems: "start",
    padding: "0 8px",
  },
  avatar: {
    width: "96px",
    height: "96px",
    ...shorthands.borderRadius("50%"),
    flexShrink: 0,
  },
  info: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    flexGrow: 1,
  },
  titleLine: {
    height: "24px",
    width: "200px",
  },
  metaLine: {
    height: "16px",
    width: "120px",
  },
  button: {
    height: "32px",
    width: "100px",
    ...shorthands.borderRadius("4px"),
    marginTop: "8px",
  },
  tabArea: {
    display: "flex",
    gap: "16px",
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    paddingBottom: "8px",
    paddingLeft: "8px",
  },
  tabItem: {
    height: "20px",
    width: "60px",
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
});

export const ChannelPageSkeleton = (): JSX.Element => {
  const styles = useStyles();

  return (
    <div className={styles.container}>
      <Skeleton>
        <SkeletonItem className={styles.banner} />
        
        <div className={styles.header}>
          <SkeletonItem className={styles.avatar} />
          <div className={styles.info}>
            <SkeletonItem className={styles.titleLine} />
            <SkeletonItem className={styles.metaLine} />
            <SkeletonItem className={styles.button} />
          </div>
        </div>

        <div className={styles.tabArea}>
          <SkeletonItem className={styles.tabItem} />
          <SkeletonItem className={styles.tabItem} />
          <SkeletonItem className={styles.tabItem} />
          <SkeletonItem className={styles.tabItem} />
        </div>
      </Skeleton>

      <div className={styles.grid}>
        {Array.from({ length: 8 }).map((_, index) => (
          <VideoCardSkeleton key={index} />
        ))}
      </div>
    </div>
  );
};
