import {
  Text,
  makeStyles,
  Button,
  DrawerBody,
  DrawerFooter,
  DrawerHeader,
  DrawerHeaderTitle,
  Field,
  Input,
  OverlayDrawer,
  useRestoreFocusSource,
  useRestoreFocusTarget,
} from "@fluentui/react-components";
import { Dismiss24Regular } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { LoadingGrid } from "../components/LoadingGrid";
import { PlaylistCard } from "../components/PlaylistCard";
import { getAuthPlaylists } from "../lib/invidiousClient";
import { createLocalPlaylist, getLocalPlaylists } from "../lib/localPlaylists";
import { queryKeys } from "../lib/queryKeys";
import { useSettingsStore } from "../store/settingsStore";

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "16px",
    "@media (min-width: 768px)": {
      gridTemplateColumns: "repeat(2, 1fr)",
    },
    "@media (min-width: 1200px)": {
      gridTemplateColumns: "repeat(3, 1fr)",
    },
  },
});

export const AuthPlaylistsPage = (): JSX.Element => {
  const styles = useStyles();
  const { t } = useTranslation();
  const token = useSettingsStore((state) => state.token);
  const [, setLocalVersion] = useState(0);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [nameError, setNameError] = useState("");
  const restoreFocusTargetAttributes = useRestoreFocusTarget();
  const restoreFocusSourceAttributes = useRestoreFocusSource();

  const playlistsQuery = useQuery({
    queryKey: queryKeys.authPlaylists,
    queryFn: ({ signal }) => getAuthPlaylists(signal),
    enabled: !!token,
  });

  const localPlaylists = getLocalPlaylists();

  const playlists = playlistsQuery.data ?? [];
  const shownPlaylists = token ? playlists : localPlaylists;

  const closeCreateDrawer = (): void => {
    setIsCreateOpen(false);
    setNameError("");
  };

  const submitCreatePlaylist = (): void => {
    const trimmed = newPlaylistName.trim();
    if (!trimmed) {
      setNameError(t("playlists.inputRequired"));
      return;
    }
    createLocalPlaylist(trimmed);
    setLocalVersion((v) => v + 1);
    setNewPlaylistName("");
    closeCreateDrawer();
  };

  return (
    <div className={styles.container}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
        <Text size={700} weight="bold">{token ? t("playlists.myPlaylists") : t("playlists.localPlaylists")}</Text>
        <Button
          {...restoreFocusTargetAttributes}
          appearance="primary"
          onClick={() => setIsCreateOpen(true)}
        >
          {t("playlists.create")}
        </Button>
      </div>
      <OverlayDrawer
        {...restoreFocusSourceAttributes}
        position="end"
        size="small"
        open={isCreateOpen}
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
          <Button appearance="primary" onClick={submitCreatePlaylist}>{t("playlists.create")}</Button>
        </DrawerFooter>
      </OverlayDrawer>
      {token && playlistsQuery.isLoading ? <LoadingGrid /> : null}
      {token && playlistsQuery.isError ? (
        <ErrorState title={t("playlists.fetchErrorTitle")} message={t("playlists.fetchErrorMessage")} onRetry={() => playlistsQuery.refetch()} />
      ) : null}
      {(!token || (!playlistsQuery.isLoading && !playlistsQuery.isError)) && shownPlaylists.length === 0 ? (
        <EmptyState title={t("playlists.emptyTitle")} description={token ? t("playlists.emptyAuth") : t("playlists.emptyLocal")} />
      ) : null}
      {shownPlaylists.length > 0 ? (
        <div className={styles.grid}>
          {shownPlaylists.map((playlist) => (
            <PlaylistCard key={playlist.playlistId} playlist={playlist} />
          ))}
        </div>
      ) : null}
    </div>
  );
};
