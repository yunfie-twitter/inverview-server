import {
  Card,
  CardHeader,
  CardPreview,
  Text,
  Caption1,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useNavigate } from "react-router-dom";
import { useSettingsStore } from "../store/settingsStore";
import type { PlaylistObject } from "../types/invidious";
import { Thumbnail } from "./Thumbnail";

interface PlaylistCardProps {
  playlist: PlaylistObject;
}

const useStyles = makeStyles({
  card: {
    width: "100%",
    cursor: "pointer",
    ":hover": {
      boxShadow: tokens.shadow16,
    },
  },
  title: {
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
    fontWeight: tokens.fontWeightBold,
    lineHeight: "1.4em",
  },
  metadata: {
    color: tokens.colorNeutralForeground3,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
});

export const PlaylistCard = ({ playlist }: PlaylistCardProps): JSX.Element => {
  const styles = useStyles();
  const navigate = useNavigate();
  const baseUrl = useSettingsStore((state) => state.apiBaseUrl);

  return (
    <Card
      className={styles.card}
      onClick={() => navigate(`/playlist/${playlist.playlistId}`)}
      appearance="outline"
    >
      <CardPreview>
        <Thumbnail src={playlist.playlistThumbnail} alt={playlist.title} baseUrl={baseUrl} />
      </CardPreview>

      <CardHeader
        header={
          <Text className={styles.title} block>
            {playlist.title}
          </Text>
        }
        description={
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <Caption1 className={styles.metadata}>{playlist.author}</Caption1>
            <Caption1 className={styles.metadata}>{playlist.videoCount ?? 0} 本の動画</Caption1>
          </div>
        }
      />
    </Card>
  );
};
