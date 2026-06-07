import {
  makeStyles,
} from "@fluentui/react-components";
import { VideoCardSkeleton } from "./VideoCardSkeleton";

interface LoadingGridProps {
  count?: number;
}

const useStyles = makeStyles({
  container: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: "16px",
  },
});

export const LoadingGrid = ({ count = 8 }: LoadingGridProps): JSX.Element => {
  const styles = useStyles();

  return (
    <div className={styles.container}>
      {Array.from({ length: count }).map((_, index) => (
        <VideoCardSkeleton key={index} />
      ))}
    </div>
  );
};
