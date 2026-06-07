import { memo, useCallback, useMemo } from "react";
import {
  Card,
  CardHeader,
  CardPreview,
  Text,
  Caption1,
  makeStyles,
  tokens,
  Avatar,
  Button,
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
  mergeClasses,
} from "@fluentui/react-components";
import { MoreHorizontal20Regular } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { formatDuration, formatRelativeDateJa, formatViewCountJa } from "../lib/format";
import { getChannel } from "../lib/invidiousClient";
import { pickBestThumbnail, resolveMediaUrl } from "../lib/media";
import { queryKeys } from "../lib/queryKeys";
import { notifyError, notifySuccess } from "../lib/notifications";
import { getTvSessionId } from "../lib/tvSync";
import { withViewTransition } from "../lib/webPlatform";
import { triggerHaptic } from "../lib/haptic";
import { useSettingsStore } from "../store/settingsStore";
import type { VideoObject } from "../types/invidious";
import { BadgeRow } from "./BadgeRow";
import { Thumbnail } from "./Thumbnail";

interface VideoCardProps {
  video: VideoObject;
  horizontal?: boolean;
  isShorts?: boolean;
  authorId?: string;
  prioritizeThumbnail?: boolean;
  action?: React.ReactNode;
}
const useStyles = makeStyles({
  card: {
    width: "100%",
    maxWidth: "100%",
    cursor: "pointer",
    height: "fit-content",
    transition: "box-shadow 0.2s ease, background-color 0.2s ease, border-color 0.2s ease",
    ":hover": {
      boxShadow: tokens.shadow8,
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  verticalCard: {
    padding: "12px",
    overflow: "hidden",
    rowGap: "0",
  },
  horizontalCard: {
    display: "flex",
    flexDirection: "row",
    height: "94px",
    paddingTop: "0px",
    paddingRight: "0px",
    paddingBottom: "0px",
    paddingLeft: "0px",
    gap: "8px",
    alignItems: "flex-start",
    minWidth: 0,
  },
  body: {
    padding: "10px 0 0",
    display: "flex",
    flexDirection: "column",
    gap: "0",
    minWidth: 0,
  },
  preview: {
    width: "auto",
    margin: "-12px -12px 0 -12px",
    overflow: "hidden",
    position: "relative",
  },
  horizontalPreview: {
    width: "160px",
    minWidth: "160px",
    aspectRatio: "16 / 9",
    flexShrink: 0,
  },
  title: {
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
    lineHeight: "1.2em",
    fontWeight: tokens.fontWeightBold,
    fontSize: "14px",
  },
  horizontalTitle: {
    fontSize: "12px",
    lineHeight: "1.3em",
    WebkitLineClamp: 2,
  },
  metadata: {
    color: tokens.colorNeutralForeground3,
    fontSize: "12px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "100%",
  },
  authorLink: {
    cursor: "pointer",
    ":hover": {
      color: tokens.colorNeutralForeground2BrandHover,
    },
  },
  horizontalMetadata: {
    fontSize: "11px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "100%",
  },
  duration: {
    position: "absolute",
    bottom: "4px",
    right: "4px",
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    color: "white",
    padding: "1px 4px",
    borderRadius: "2px",
    fontSize: "10px",
    fontWeight: "bold",
  },
});

const VideoCardBase = ({
  video,
  horizontal = false,
  isShorts,
  authorId,
  prioritizeThumbnail = false,
  action,
}: VideoCardProps): JSX.Element => {
  const styles = useStyles();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tvSession = searchParams.get("tvSession") || getTvSessionId();
  const baseUrl = useSettingsStore((state) => state.apiBaseUrl);
  const resolvedVideoId = useMemo(() => {
    if (video.videoId) return video.videoId;
    if (video.type === "playlist" && video.playlistId && video.playlistId.length === 11) {
      return video.playlistId;
    }
    return "";
  }, [video.videoId, video.type, video.playlistId]);

  const thumbnail = useMemo(() => {
    const picked = pickBestThumbnail(video.videoThumbnails);
    if (picked) return picked;

    if (video.playlistThumbnail) {
      return {
        quality: "medium",
        url: video.playlistThumbnail,
        width: 320,
        height: 180,
      };
    }

    if (resolvedVideoId) {
      return {
        quality: "medium",
        url: `https://i.ytimg.com/vi/${resolvedVideoId}/mqdefault.jpg`,
        width: 320,
        height: 180,
      };
    }
    return undefined;
  }, [video.videoThumbnails, video.playlistThumbnail, resolvedVideoId]);
  const authorThumbnail = useMemo(
    () => (video.authorThumbnails ? pickBestThumbnail(video.authorThumbnails) : null),
    [video.authorThumbnails],
  );
  const fallbackAvatarQuery = useQuery({
    queryKey: [...queryKeys.channel(video.authorId), "avatar"],
    queryFn: ({ signal }) => getChannel(video.authorId, signal),
    enabled: !horizontal && !authorThumbnail && !!video.authorId,
    staleTime: 1000 * 60 * 30,
  });
  const fallbackAuthorThumbnail = useMemo(
    () => pickBestThumbnail(fallbackAvatarQuery.data?.authorThumbnails),
    [fallbackAvatarQuery.data?.authorThumbnails],
  );
  const avatarSrc = resolveMediaUrl(authorThumbnail?.url || fallbackAuthorThumbnail?.url, baseUrl) || undefined;
  const actionSlot = action === false || action === true || action == null ? undefined : action;

  const handleNavigate = useCallback(() => {
    if (!resolvedVideoId) return; // IDがない場合は遷移しない

    triggerHaptic("click");
    if (tvSession) {
      void (async () => {
        try {
          const response = await fetch(`/tv-sync/session/${encodeURIComponent(tvSession)}/command`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ videoId: resolvedVideoId }),
          });
          if (!response.ok) {
            notifyError("TVへの送信に失敗しました。");
            return;
          }
          notifySuccess("TVへ送信しました");
        } catch {
          notifyError("TVへの送信に失敗しました。");
        }
      })();
      return;
    }
    if (isShorts) {
      const query = authorId ? `?authorId=${authorId}` : "";
      withViewTransition(() => navigate(`/shorts/${resolvedVideoId}${query}`));
    } else {
      withViewTransition(() => navigate(`/watch/${resolvedVideoId}?autoplay=1`));
    }
  }, [authorId, isShorts, navigate, resolvedVideoId, tvSession]);

  const handleChannelNavigate = useCallback(() => {
    triggerHaptic("click");
    withViewTransition(() => navigate(`/channel/${video.authorId}`));
  }, [navigate, video.authorId]);

  return (
    <Card
      className={mergeClasses(styles.card, horizontal ? styles.horizontalCard : styles.verticalCard)}
      data-tv-focusable="true"
      tabIndex={0}
      onClick={handleNavigate}
      onKeyDown={(ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          handleNavigate();
        }
      }}
      appearance="subtle"
      orientation={horizontal ? "horizontal" : "vertical"}
      focusMode="off"
    >
      <CardPreview className={horizontal ? styles.horizontalPreview : styles.preview}>
        <div style={{ position: "relative", width: "100%", height: "100%" }}>
          <Thumbnail
            src={thumbnail?.url}
            sources={video.videoThumbnails?.length ? video.videoThumbnails : (thumbnail ? [thumbnail] : undefined)}
            alt={video.title}
            baseUrl={baseUrl}
            squareBottomCorners={!horizontal}
            loading={prioritizeThumbnail ? "eager" : "lazy"}
            fetchPriority={prioritizeThumbnail ? "high" : "auto"}
            sizes={horizontal ? "(max-width: 1024px) 45vw, 160px" : "(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"}
          />
          {!video.liveNow && video.lengthSeconds ? (
            <div className={styles.duration}>{formatDuration(video.lengthSeconds)}</div>
          ) : null}
        </div>
      </CardPreview>

      {horizontal ? (
        <CardHeader
          style={{ padding: "4px 0", minWidth: 0, flex: 1 }}
          header={
            <Text className={mergeClasses(styles.title, styles.horizontalTitle)} block>
              {video.title}
            </Text>
          }
          description={
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <Caption1
                className={mergeClasses(styles.metadata, styles.horizontalMetadata, styles.authorLink)}
                onClick={(e) => {
                  e.stopPropagation();
                  handleChannelNavigate();
                }}
              >
                {video.author}
              </Caption1>
              <Caption1 className={mergeClasses(styles.metadata, styles.horizontalMetadata)}>
                {formatViewCountJa(video.viewCount, video.viewCountText)} ・{" "}
                {formatRelativeDateJa(video.published, video.publishedText)}
              </Caption1>
            </div>
          }
          action={actionSlot}
        />
      ) : (
        <div className={styles.body}>
          <CardHeader
            style={{ minWidth: 0 }}
            image={
              <Avatar
                size={36}
                name={video.author}
                image={{
                  src: avatarSrc,
                }}
                style={{ cursor: "pointer" }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleChannelNavigate();
                }}
              />
            }
            header={
              <Text className={styles.title} block>
                {video.title}
              </Text>
            }
            description={
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <Caption1
                  className={mergeClasses(styles.metadata, styles.authorLink)}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleChannelNavigate();
                  }}
                >
                  {video.author}
                </Caption1>
                <Caption1 className={styles.metadata}>
                  {formatViewCountJa(video.viewCount, video.viewCountText)} ・{" "}
                  {formatRelativeDateJa(video.published, video.publishedText)}
                </Caption1>
                <BadgeRow video={video} />
              </div>
            }
            action={
              actionSlot ?? (
                <Menu positioning="below-end">
                  <MenuTrigger disableButtonEnhancement>
                    <Button
                      appearance="transparent"
                      icon={<MoreHorizontal20Regular />}
                      aria-label="その他の操作"
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                    />
                  </MenuTrigger>
                  <MenuPopover>
                    <MenuList>
                      <MenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          handleChannelNavigate();
                        }}
                      >
                        チャンネルを開く
                      </MenuItem>
                      <MenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          handleNavigate();
                        }}
                      >
                        動画を開く
                      </MenuItem>
                    </MenuList>
                  </MenuPopover>
                </Menu>
              )
            }
          />
        </div>
      )}
    </Card>
  );
};

export const VideoCard = memo(VideoCardBase, (prev, next) => {
  return (
    prev.horizontal === next.horizontal &&
    prev.isShorts === next.isShorts &&
    prev.authorId === next.authorId &&
    prev.prioritizeThumbnail === next.prioritizeThumbnail &&
    prev.video.videoId === next.video.videoId &&
    prev.video.playlistId === next.video.playlistId &&
    prev.video.playlistThumbnail === next.video.playlistThumbnail &&
    prev.video.title === next.video.title &&
    prev.video.published === next.video.published &&
    prev.video.viewCount === next.video.viewCount &&
    prev.video.liveNow === next.video.liveNow &&
    prev.video.lengthSeconds === next.video.lengthSeconds
  );
});
