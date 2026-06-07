import {
  Text,
  makeStyles,
  tokens,
  Button,
  Spinner,
  Avatar,
} from "@fluentui/react-components";
import { ChevronUp24Regular, ChevronDown24Regular, ArrowLeft24Regular, Heart24Regular, Comment24Regular, Share24Regular } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { VideoPlayer } from "../components/VideoPlayer";
import { getChannelShorts, getVideo, searchVideos } from "../lib/invidiousClient";
import { queryKeys } from "../lib/queryKeys";
import { useSettingsStore } from "../store/settingsStore";
import { pickBestThumbnail } from "../lib/media";
import type { VideoObject } from "../types/invidious";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { getStorageJson, setStorageJson } from "../lib/browserStorage";

const useStyles = makeStyles({
  container: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#000000",
    display: "flex",
    flexDirection: "column",
    zIndex: 10,
    overflow: "hidden",
    "@media (min-width: 1024px)": {
      position: "fixed",
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
      height: "100dvh",
      width: "100vw",
      backgroundColor: tokens.colorNeutralBackground2,
    },
  },
  playerWrapper: {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
    "@media (min-width: 1024px)": {
      padding: "0", // Remove padding to maximize space
    },
  },
  overlay: {
    position: "absolute",
    bottom: "10px",
    left: "12px",
    right: "70px",
    color: "#ffffff",
    zIndex: 15,
    textShadow: "0 1px 4px rgba(0,0,0,0.8)",
    pointerEvents: "none",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    paddingBottom: "env(safe-area-inset-bottom, 20px)",
  },
  authorRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    pointerEvents: "auto",
    cursor: "pointer",
  },
  actions: {
    position: "absolute",
    right: "8px",
    bottom: "80px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "16px",
    zIndex: 20,
    paddingBottom: "env(safe-area-inset-bottom, 0px)",
  },
  actionButton: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "4px",
    color: "#ffffff",
    "& span": {
      fontSize: "12px",
      fontWeight: "bold",
    },
  },
  backButton: {
    position: "absolute",
    top: "12px",
    left: "12px",
    zIndex: 30,
    color: "#ffffff",
    "@media (min-width: 1024px)": {
      display: "none",
    },
  },
  navControls: {
    position: "absolute",
    right: "20px",
    top: "50%",
    transform: "translateY(-50%)",
    display: "none",
    flexDirection: "column",
    gap: "10px",
    zIndex: 30,
    "@media (min-width: 1024px)": {
      display: "flex",
    },
  }
});

const MAX_HISTORY = 15;
const shortsHistorySchema = z.array(z.string());

export const ShortsPage = (): JSX.Element => {
  const styles = useStyles();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { videoId } = useParams();
  const [searchParams] = useSearchParams();
  const authorIdParam = searchParams.get("authorId");
  const authorIds = authorIdParam ? authorIdParam.split(",") : [];
  const shouldShuffle = searchParams.get("shuffle") === "1";
  const baseUrl = useSettingsStore((state) => state.apiBaseUrl);
  const [shortsList, setShortsList] = useState<VideoObject[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);

  // Viewed history management
  const [viewedHistory, setViewedHistory] = useState<string[]>(() => {
    return getStorageJson("local", "shorts_history", shortsHistorySchema, []);
  });

  useEffect(() => {
    setStorageJson("local", "shorts_history", viewedHistory);
  }, [viewedHistory]);

  const listQuery = useQuery({
    queryKey: authorIds.length > 0 ? ["channel-shorts", ...authorIds] : ["shorts-feed"],
    queryFn: async ({ signal }) => {
      if (authorIds.length > 0) {
        const results = await Promise.all(
          authorIds.map(id => getChannelShorts(id, {}, signal).catch(() => ({ videos: [] })))
        );
        return results.flatMap(res => res.videos || []);
      }
      return searchVideos({ q: "#shorts", type: "video", sort_by: "relevance" }, signal);
    },
    enabled: true,
    staleTime: 1000 * 60 * 5,
  });

  const shuffle = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  useEffect(() => {
    if (listQuery.data) {
      let items = listQuery.data as VideoObject[];
      
      // Shuffle for global feed OR if shuffle param is set OR if multiple authors
      if (authorIds.length === 0 || shouldShuffle || authorIds.length > 1) {
        // Only filter history for global feed
        if (authorIds.length === 0) {
          items = items.filter(v => !viewedHistory.includes(v.videoId));
        }
        items = shuffle(items);
      }
      
      setShortsList(items);
      
      if (!videoId && items.length > 0) {
        const query = authorIdParam ? `?authorId=${authorIdParam}` : "";
        const sQuery = shouldShuffle ? (query ? "&shuffle=1" : "?shuffle=1") : "";
        navigate(`/shorts/${items[0].videoId}${query}${sQuery}`, { replace: true });
      }
    }
  }, [listQuery.data, videoId, navigate, authorIdParam, viewedHistory, shouldShuffle, authorIds.length]);

  // Update history when video changes
  useEffect(() => {
    if (videoId && authorIds.length === 0) {
      setViewedHistory(prev => {
        if (prev.includes(videoId)) return prev;
        const next = [...prev, videoId];
        if (next.length > MAX_HISTORY) {
          next.shift();
        }
        return next;
      });
    }
  }, [videoId, authorIds.length]);

  useEffect(() => {
    if (videoId && shortsList.length > 0) {
      const index = shortsList.findIndex((v) => v.videoId === videoId);
      if (index !== -1) {
        setCurrentIndex(index);
      }
    }
  }, [videoId, shortsList]);

  const videoQuery = useQuery({
    queryKey: queryKeys.video(videoId || "", "JP"),
    queryFn: ({ signal }) => getVideo(videoId!, signal),
    enabled: !!videoId,
  });

  const getTargetUrl = useCallback((nextVideoId: string) => {
    const query = authorIdParam ? `?authorId=${authorIdParam}` : "";
    const sQuery = shouldShuffle ? (query ? "&shuffle=1" : "?shuffle=1") : "";
    return `/shorts/${nextVideoId}${query}${sQuery}`;
  }, [authorIdParam, shouldShuffle]);

  const goNext = useCallback(() => {
    if (currentIndex < shortsList.length - 1) {
      navigate(getTargetUrl(shortsList[currentIndex + 1].videoId));
    }
  }, [currentIndex, shortsList, getTargetUrl, navigate]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      navigate(getTargetUrl(shortsList[currentIndex - 1].videoId));
    }
  }, [currentIndex, shortsList, getTargetUrl, navigate]);

  if (!videoId && listQuery.isLoading) {
    return (
      <div className={styles.container} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Spinner label={t("shorts.loading")} />
      </div>
    );
  }

  const video = videoQuery.data;
  const authorThumbnail = video?.authorThumbnails ? pickBestThumbnail(video.authorThumbnails) : null;

  return (
    <div className={styles.container}>
      <Button
        icon={<ArrowLeft24Regular />}
        className={styles.backButton}
        appearance="subtle"
        onClick={() => navigate(-1)}
      />

      <div className={styles.playerWrapper}>
        {video ? (
          <VideoPlayer
            video={video}
            baseUrl={baseUrl}
            isShorts
            autoplay
            onEnded={goNext}
          />
        ) : (
          <Spinner />
        )}

        {video && (
          <>
            <div className={styles.overlay}>
              <div className={styles.authorRow} onClick={() => navigate(`/channel/${video.authorId}`)}>
                <Avatar 
                  size={32} 
                  name={video.author} 
                  image={{ src: authorThumbnail?.url ? (authorThumbnail.url.startsWith("http") ? authorThumbnail.url : `${baseUrl}${authorThumbnail.url}`) : undefined }} 
                />
                <Text size={400} weight="bold">@{video.author}</Text>
              </div>
              <Text size={400} weight="semibold" block style={{ WebkitLineClamp: 2, display: "-webkit-box", WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {video.title}
              </Text>
            </div>

            <div className={styles.actions}>
              <div className={styles.actionButton}>
                <Button icon={<Heart24Regular />} shape="circular" size="large" appearance="subtle" />
                <span>{video.likeCount || t("shorts.likes")}</span>
              </div>
              <div className={styles.actionButton}>
                <Button icon={<Comment24Regular />} shape="circular" size="large" appearance="subtle" />
                <span>{t("shorts.comments")}</span>
              </div>
              <div className={styles.actionButton}>
                <Button icon={<Share24Regular />} shape="circular" size="large" appearance="subtle" />
                <span>{t("shorts.share")}</span>
              </div>
            </div>
          </>
        )}

        {/* PCのみのナビゲーションボタン */}
        <div className={styles.navControls}>
          <Button
            icon={<ChevronUp24Regular />}
            shape="circular"
            size="large"
            disabled={currentIndex <= 0}
            onClick={goPrev}
            aria-label={t("shorts.previousVideo")}
          />
          <Button
            icon={<ChevronDown24Regular />}
            shape="circular"
            size="large"
            disabled={currentIndex >= shortsList.length - 1}
            onClick={goNext}
            aria-label={t("shorts.nextVideo")}
          />
        </div>
      </div>
    </div>
  );
};
