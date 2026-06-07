import {
  Avatar,
  Card,
  CardHeader,
  Text,
  Caption1,
  Body1,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { formatNumberJa } from "../lib/format";
import { pickBestThumbnail, resolveMediaUrl } from "../lib/media";
import { useSettingsStore } from "../store/settingsStore";
import { getChannel } from "../lib/invidiousClient";
import type { ChannelObject } from "../types/invidious";

interface ChannelCardProps {
  channel: ChannelObject;
  action?: JSX.Element;
}

const useStyles = makeStyles({
  card: {
    width: "100%",
    cursor: "pointer",
    ":hover": {
      boxShadow: tokens.shadow8,
    },
  },
  author: {
    fontWeight: tokens.fontWeightSemibold,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  description: {
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
    color: tokens.colorNeutralForeground3,
  },
});

export const ChannelCard = ({ channel, action }: ChannelCardProps): JSX.Element => {
  const styles = useStyles();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const baseUrl = useSettingsStore((state) => state.apiBaseUrl);
  const resolvedAuthorId = channel.authorId || channel.authorUrl?.split("/channel/")[1]?.split("/")[0] || "";

  const hasThumbnails = channel.authorThumbnails && channel.authorThumbnails.length > 0;

  const avatarQuery = useQuery({
    queryKey: ["channelAvatar", resolvedAuthorId],
    queryFn: ({ signal }) => getChannel(resolvedAuthorId, signal),
    enabled: !hasThumbnails && !!resolvedAuthorId,
    staleTime: 1000 * 60 * 30,
  });

  const bestThumbnail = useMemo(() => {
    if (hasThumbnails) {
      return pickBestThumbnail(channel.authorThumbnails);
    }
    if (avatarQuery.data?.authorThumbnails) {
      return pickBestThumbnail(avatarQuery.data.authorThumbnails);
    }
    return undefined;
  }, [hasThumbnails, channel.authorThumbnails, avatarQuery.data?.authorThumbnails]);

  const avatarSrc = resolveMediaUrl(bestThumbnail?.url, baseUrl);

  return (
    <Card
      className={styles.card}
      orientation="horizontal"
      onClick={() => {
        if (resolvedAuthorId) {
          navigate(`/channel/${resolvedAuthorId}`);
        }
      }}
      appearance="outline"
    >
      <Avatar
        image={avatarSrc ? { src: avatarSrc } : undefined}
        name={channel.author}
        size={48}
        aria-label={channel.author}
      />
      <CardHeader
        header={
          <Text className={styles.author} block>
            {channel.author}
          </Text>
        }
        description={
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
              {t("channel.subscribersCount", { count: formatNumberJa(channel.subCount) })}
            </Caption1>
            <Body1 className={styles.description}>
              {channel.description || t("channel.noDescription")}
            </Body1>
          </div>
        }
        action={action}
      />
    </Card>
  );
};
