import {
  Button,
  DrawerBody,
  DrawerFooter,
  DrawerHeader,
  DrawerHeaderTitle,
  Field,
  Input,
  makeStyles,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  OverlayDrawer,
  useRestoreFocusSource,
  useRestoreFocusTarget,
} from "@fluentui/react-components";
import { Share24Regular, VideoClip24Regular, Add24Regular, Dismiss24Regular, Comment24Regular } from "@fluentui/react-icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { canUsePictureInPictureApi, shareContent, togglePictureInPicture, vibrate } from "../../lib/webPlatform";
import { useSettingsStore } from "../../store/settingsStore";
import { ChromecastButton } from "../ChromecastButton";
import type { VideoDetails } from "../../types/invidious";
import { addVideoToLocalPlaylist, createLocalPlaylist, getLocalPlaylists } from "../../lib/localPlaylists";

interface MobileVideoActionsProps {
  videoId: string;
  title: string;
  video: VideoDetails;
  baseUrl: string;
  startTimeSeconds?: number;
  showSummaryAction?: boolean;
  onSummaryClick?: () => void;
  showCommentsAction?: boolean;
  onCommentsClick?: () => void;
  commentsLabel?: string;
}

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexWrap: "nowrap",
    gap: "8px",
    overflowX: "auto",
    overflowY: "hidden",
    width: "100%",
    WebkitOverflowScrolling: "touch",
    overscrollBehaviorX: "contain",
    paddingBottom: "4px",
    scrollbarWidth: "none",
    msOverflowStyle: "none",
    "& > *": {
      flexShrink: 0,
      whiteSpace: "nowrap",
    },
    "&::-webkit-scrollbar": {
      display: "none",
    },
  },
});

export const MobileVideoActions = ({
  videoId,
  title,
  video,
  baseUrl,
  startTimeSeconds,
  showSummaryAction = false,
  onSummaryClick,
  showCommentsAction = false,
  onCommentsClick,
  commentsLabel,
}: MobileVideoActionsProps): JSX.Element => {
  const styles = useStyles();
  const { t } = useTranslation();
  const [, setLocalPlaylistVersion] = useState(0);
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [nameError, setNameError] = useState("");
  const restoreFocusTargetAttributes = useRestoreFocusTarget();
  const restoreFocusSourceAttributes = useRestoreFocusSource();
  const hapticFeedback = useSettingsStore((state) => state.hapticFeedback);
  const watchUrl = `${window.location.origin}/watch/${videoId}?autoplay=1`;
  const localPlaylists = getLocalPlaylists();

  const copyLink = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(watchUrl);
      if (hapticFeedback) vibrate(20);
      // TODO: Implement Fluent v9 Toast
    } catch {
      // ignore
    }
  };

  const share = async (): Promise<void> => {
    const shared = await shareContent({ title, url: watchUrl });
    if (shared) {
      if (hapticFeedback) vibrate([12, 24, 12]);
      return;
    }
    await copyLink();
  };

  const openPictureInPicture = async (): Promise<void> => {
    const success = await togglePictureInPicture();
    if (success && hapticFeedback) vibrate(24);
  };

  const closeCreateDrawer = (): void => {
    setIsCreateDrawerOpen(false);
    setNameError("");
  };

  const submitCreateAndAdd = (): void => {
    const trimmed = newPlaylistName.trim();
    if (!trimmed) {
      setNameError(t("playlists.inputRequired"));
      return;
    }
    const created = createLocalPlaylist(trimmed);
    addVideoToLocalPlaylist(created.playlistId, {
      videoId: video.videoId,
      title: video.title,
      author: video.author,
      authorId: video.authorId,
      authorUrl: video.authorUrl,
      lengthSeconds: video.lengthSeconds,
      thumbnails: video.videoThumbnails,
    });
    setLocalPlaylistVersion((v) => v + 1);
    setNewPlaylistName("");
    closeCreateDrawer();
  };

  return (
    <div className={styles.container}>
      {showSummaryAction && (
        <Button
          icon={<VideoClip24Regular />}
          appearance="secondary"
          onClick={() => onSummaryClick?.()}
        >
          {t("watch.summary")}
        </Button>
      )}
      {showCommentsAction && (
        <Button
          icon={<Comment24Regular />}
          appearance="secondary"
          onClick={() => onCommentsClick?.()}
          aria-label={commentsLabel ?? t("watch.comments")}
        >
          {commentsLabel ?? t("watch.comments")}
        </Button>
      )}
      <Button
        icon={<Share24Regular />}
        appearance="secondary"
        onClick={share}
        aria-label={t("mobileActions.share")}
      >
        {t("mobileActions.share")}
      </Button>
      <Menu positioning="below-start">
        <MenuTrigger disableButtonEnhancement>
          <Button {...restoreFocusTargetAttributes} icon={<Add24Regular />} appearance="outline">
            {t("mobileActions.addToPlaylist")}
          </Button>
        </MenuTrigger>
        <MenuPopover>
          <MenuList>
            {localPlaylists.map((playlist) => (
              <MenuItem
                key={playlist.playlistId}
                onClick={() => {
                  addVideoToLocalPlaylist(playlist.playlistId, {
                    videoId: video.videoId,
                    title: video.title,
                    author: video.author,
                    authorId: video.authorId,
                    authorUrl: video.authorUrl,
                    lengthSeconds: video.lengthSeconds,
                    thumbnails: video.videoThumbnails,
                  });
                  setLocalPlaylistVersion((v) => v + 1);
                }}
              >
                {playlist.title}
              </MenuItem>
            ))}
            <MenuItem
              onClick={() => {
                setIsCreateDrawerOpen(true);
              }}
            >
              {t("mobileActions.createNewPlaylist")}
            </MenuItem>
          </MenuList>
        </MenuPopover>
      </Menu>
      <OverlayDrawer
        {...restoreFocusSourceAttributes}
        position="end"
        size="small"
        open={isCreateDrawerOpen}
        onOpenChange={(_, data) => !data.open && closeCreateDrawer()}
      >
        <DrawerHeader>
          <DrawerHeaderTitle
            action={
              <Button
                appearance="subtle"
                aria-label={t("common.close")}
                icon={<Dismiss24Regular />}
                onClick={closeCreateDrawer}
              />
            }
          >
            {t("playlists.newPlaylist")}
          </DrawerHeaderTitle>
        </DrawerHeader>
        <DrawerBody>
          <Field label={t("playlists.nameLabel")} validationMessage={nameError || undefined} validationState={nameError ? "error" : "none"}>
            <Input
              value={newPlaylistName}
              onChange={(_, data) => {
                setNewPlaylistName(data.value);
                if (nameError) setNameError("");
              }}
              placeholder={t("playlists.namePlaceholder")}
            />
          </Field>
        </DrawerBody>
        <DrawerFooter>
          <Button appearance="secondary" onClick={closeCreateDrawer}>{t("common.cancel")}</Button>
          <Button appearance="primary" onClick={submitCreateAndAdd}>{t("mobileActions.createAndAdd")}</Button>
        </DrawerFooter>
      </OverlayDrawer>
      {canUsePictureInPictureApi() && (
        <Button
          icon={<VideoClip24Regular />}
          appearance="outline"
          onClick={openPictureInPicture}
          aria-label={t("mobileActions.pictureInPicture")}
        >
          PiP
        </Button>
      )}
      <ChromecastButton video={video} baseUrl={baseUrl} startTimeSeconds={startTimeSeconds} />
    </div>
  );
};
