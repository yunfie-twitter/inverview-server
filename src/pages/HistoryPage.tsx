import {
  Text,
  makeStyles,
  tokens,
  Button,
  Card,
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  Title1,
  Tooltip,
} from "@fluentui/react-components";
import { Delete20Regular, Play16Regular, EyeOff24Regular, Settings20Regular } from "@fluentui/react-icons";
import { useRef, useState, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { EmptyState } from "../components/EmptyState";
import { Thumbnail } from "../components/Thumbnail";
import { formatDateJa, formatDuration } from "../lib/format";
import { clearWatchHistory, getWatchHistory, removeWatchHistoryItem } from "../lib/watchHistory";
import { useSettings } from "../hooks/useSettings";
import { withViewTransition } from "../lib/webPlatform";
import type { WatchHistoryItem } from "../settings/types";

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
    maxWidth: "1000px",
    margin: "0 auto",
    width: "100%",
    padding: "12px",
    boxSizing: "border-box",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    paddingBottom: "16px",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  historyCard: {
    display: "flex",
    flexDirection: "row",
    gap: "16px",
    padding: "16px",
    alignItems: "stretch",
    borderRadius: "12px",
    transition: "box-shadow 0.2s ease, background-color 0.2s ease, border-color 0.2s ease",
    cursor: "pointer",
    ":hover": {
      boxShadow: tokens.shadow8,
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
    "@media (max-width: 600px)": {
      flexDirection: "column",
      alignItems: "start",
      padding: "12px",
      gap: "12px",
    },
  },
  thumbnailWrap: {
    width: "200px",
    minWidth: "200px",
    aspectRatio: "16 / 9",
    borderRadius: "8px",
    overflow: "hidden",
    position: "relative",
    flexShrink: 0,
    "@media (max-width: 600px)": {
      width: "100%",
      minWidth: "100%",
    },
  },
  info: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    flexGrow: 1,
    minWidth: 0,
    width: "100%",
  },
  textGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  title: {
    lineHeight: "1.4em",
    fontWeight: tokens.fontWeightSemibold,
    fontSize: "16px",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
    color: tokens.colorNeutralForeground1,
  },
  channelName: {
    color: tokens.colorNeutralForeground3,
    fontSize: "13px",
    fontWeight: tokens.fontWeightMedium,
  },
  metadata: {
    color: tokens.colorNeutralForeground4,
    fontSize: "12px",
    marginTop: "4px",
  },
  actions: {
    display: "flex",
    gap: "10px",
    alignItems: "center",
    marginTop: "12px",
    "@media (max-width: 600px)": {
      marginTop: "8px",
      width: "100%",
      justifyContent: "space-between",
    },
  },
});

export const HistoryPage = (): JSX.Element => {
  const styles = useStyles();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [, setVersion] = useState(0);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const parentRef = useRef<HTMLDivElement | null>(null);

  const history = getWatchHistory();

  const shouldVirtualize = history.length >= 40;
  const rowVirtualizer = useVirtualizer({
    count: shouldVirtualize ? history.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 180,
    overscan: 3,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();

  const handleCardClick = useCallback((videoId: string) => {
    withViewTransition(() => navigate(`/watch/${videoId}?autoplay=1`));
  }, [navigate]);

  const renderHistoryItem = useCallback((item: WatchHistoryItem) => {
    return (
      <Card
        appearance="subtle"
        className={styles.historyCard}
        onClick={() => handleCardClick(item.videoId)}
        style={{ boxSizing: "border-box" }}
      >
        <div className={styles.thumbnailWrap}>
          <Thumbnail
            src={item.thumbnailUrl}
            alt={item.title}
            baseUrl={settings.instanceUrl}
            ratio={16 / 9}
          />
        </div>
        <div className={styles.info}>
          <div className={styles.textGroup}>
            <Text className={styles.title}>
              {item.title}
            </Text>
            <Text className={styles.channelName}>{item.channelName}</Text>
            <Text className={styles.metadata}>
              {t("history.watchedAt")}: {formatDateJa(Math.floor(item.watchedAt / 1000))} ・ {t("history.position")}: {formatDuration(item.positionSeconds)}
            </Text>
          </div>
          <div className={styles.actions}>
            <Button
              size="small"
              appearance="primary"
              icon={<Play16Regular />}
              onClick={(e) => {
                e.stopPropagation();
                handleCardClick(item.videoId);
              }}
            >
              {t("history.resume")}
            </Button>
            <Tooltip content={t("history.removeItem") || "削除"} relationship="label">
              <Button
                size="small"
                appearance="subtle"
                icon={<Delete20Regular />}
                onClick={(e) => {
                  e.stopPropagation();
                  removeWatchHistoryItem(item.videoId);
                  setVersion((v) => v + 1);
                }}
              />
            </Tooltip>
          </div>
        </div>
      </Card>
    );
  }, [styles, settings.instanceUrl, t, handleCardClick]);

  if (!settings.saveWatchHistory) {
    return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "80px 24px",
        textAlign: "center",
        backgroundColor: tokens.colorNeutralBackground1,
        minHeight: "400px",
        boxSizing: "border-box",
      }}>
        <div style={{ maxWidth: "480px", display: "flex", flexDirection: "column", alignItems: "center", gap: "20px" }}>
          <EyeOff24Regular style={{ fontSize: "64px", width: "64px", height: "64px", color: tokens.colorNeutralForeground3 }} />
          <Title1 style={{ fontWeight: tokens.fontWeightSemibold }}>
            {t("history.disabledTitle")}
          </Title1>
          <Text style={{ color: tokens.colorNeutralForeground2, fontSize: "14px", lineHeight: "1.6" }}>
            {t("history.disabledDescription")}
          </Text>
          <Button
            appearance="primary"
            icon={<Settings20Regular />}
            style={{ marginTop: "12px" }}
            onClick={() => withViewTransition(() => navigate("/settings?tab=playback"))}
          >
            {t("header.showAllSettings") || "設定を開く"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Title1 style={{ fontWeight: tokens.fontWeightBold }}>
          {t("history.title")}
        </Title1>
        <Button appearance="outline" icon={<Delete20Regular />} onClick={() => setIsConfirmOpen(true)}>
          {t("history.clearAll")}
        </Button>
      </div>

      <Dialog open={isConfirmOpen} onOpenChange={(_, data) => setIsConfirmOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{t("history.clearDialogTitle")}</DialogTitle>
            <DialogContent>
              {t("history.clearDialogContent")}
            </DialogContent>
            <DialogActions>
              <Button
                appearance="primary"
                onClick={() => {
                  clearWatchHistory();
                  setVersion((v) => v + 1);
                  setIsConfirmOpen(false);
                }}
              >
                {t("history.clearConfirm")}
              </Button>
              <Button appearance="outline" onClick={() => setIsConfirmOpen(false)}>
                {t("history.cancel")}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      {history.length === 0 ? (
        <EmptyState title={t("history.emptyTitle")} description={t("history.emptyDescription")} />
      ) : (
        shouldVirtualize ? (
          <div ref={parentRef} style={{ maxHeight: "75vh", overflowY: "auto", overscrollBehavior: "contain" }}>
            <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}>
              {virtualRows.map((virtualRow) => {
                const item = history[virtualRow.index];
                if (!item) return null;
                return (
                  <div
                    key={virtualRow.key}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualRow.start}px)`,
                      paddingBottom: 16,
                      boxSizing: "border-box",
                    }}
                  >
                    {renderHistoryItem(item)}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className={styles.list}>
            {history.map((item) => (
              <div key={item.videoId}>
                {renderHistoryItem(item)}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
};

