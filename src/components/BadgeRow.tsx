import { makeStyles, tokens, Badge } from "@fluentui/react-components";
import type { VideoObject } from "../types/invidious";

interface BadgeRowProps {
  video: Partial<VideoObject>;
}

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexWrap: "wrap",
    gap: "4px",
  },
});

export const BadgeRow = ({ video }: BadgeRowProps): JSX.Element => {
  const styles = useStyles();
  return (
    <div className={styles.container}>
      {video.liveNow && (
        <Badge appearance="filled" color="danger">
          LIVE
        </Badge>
      )}
      {video.hasCaptions && (
        <Badge appearance="outline">
          字幕
        </Badge>
      )}
      {video.is4k && (
        <Badge appearance="outline">
          4K
        </Badge>
      )}
      {video.premium && (
        <Badge appearance="filled" color="warning">
          Premium
        </Badge>
      )}
      {video.paid && (
        <Badge appearance="filled" color="warning">
          Paid
        </Badge>
      )}
      {video.isUpcoming && (
        <Badge appearance="outline">
          Upcoming
        </Badge>
      )}
    </div>
  );
};
