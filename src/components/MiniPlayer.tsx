import {
  makeStyles,
  tokens,
  Button,
  Card,
  Text,
} from "@fluentui/react-components";
import { Dismiss16Regular, Pause16Regular, Play16Regular } from "@fluentui/react-icons";
import { useEffect, useRef, useState } from "react";
import { VideoPlayer } from "./VideoPlayer";
import type { MiniPlayerState } from "../settings/types";

interface MiniPlayerProps {
  state: MiniPlayerState;
  onPositionChange: (seconds: number) => void;
  onMove: (x: number, y: number) => void;
  onExpand: () => void;
  onClose: () => void;
}

const useStyles = makeStyles({
  container: {
    position: "fixed",
    zIndex: 45,
    width: "220px",
    padding: "8px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    boxShadow: tokens.shadow16,
    backgroundColor: `${tokens.colorNeutralBackground3} !important`,
    touchAction: "none",
    "@media (min-width: 600px)": {
      width: "260px",
    },
    "@media (min-width: 1024px)": {
      right: "24px",
      bottom: "24px",
    },
    "@media (max-width: 767px)": {
      width: "100vw",
      maxWidth: "none",
      left: "0",
      right: "0",
      top: "auto",
      bottom: "calc(64px + env(safe-area-inset-bottom))",
      padding: "6px",
      borderRadius: "0",
      backgroundColor: "#111111 !important",
      color: "#ffffff !important",
    },
  },
  mobileRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    paddingTop: "4px",
    paddingBottom: "4px",
  },
  hiddenPlayerHost: {
    position: "absolute",
    width: "1px",
    height: "1px",
    overflow: "hidden",
    opacity: 0,
    pointerEvents: "none",
  },
  mobileMeta: {
    minWidth: 0,
    flexGrow: 1,
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    paddingLeft: "6px",
  },
  controlButton: {
    color: "#fff",
  },
  mobileTitle: {
    color: "#ffffff",
    fontWeight: 700,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  mobileSubtitle: {
    color: "rgba(255,255,255,0.78)",
    fontWeight: 600,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    cursor: "grab",
  },
});

export const MiniPlayer = ({ state, onPositionChange, onMove, onExpand, onClose }: MiniPlayerProps): JSX.Element => {
  const styles = useStyles();
  const cardRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null);
  const [isMobileViewport, setIsMobileViewport] = useState(
    typeof window !== "undefined" ? window.matchMedia("(max-width: 767px)").matches : false,
  );

  const [isDragging, setIsDragging] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const mobileSwipeRef = useRef<{
    startY: number;
    startX: number;
    pointerId: number;
    hasSwiped: boolean;
  } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const onChange = (event: MediaQueryListEvent): void => setIsMobileViewport(event.matches);
    setIsMobileViewport(mediaQuery.matches);
    mediaQuery.addEventListener("change", onChange);
    return () => mediaQuery.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const getVideoEl = (): HTMLVideoElement | null =>
      document.querySelector("#inverview-global-video-host video");
    const syncState = (): void => {
      const videoEl = getVideoEl();
      setIsPlaying(!!videoEl && !videoEl.paused && !videoEl.ended);
    };
    syncState();
    const videoEl = getVideoEl();
    if (!videoEl) return undefined;
    const onPlayPause = (): void => syncState();
    videoEl.addEventListener("play", onPlayPause);
    videoEl.addEventListener("pause", onPlayPause);
    videoEl.addEventListener("ended", onPlayPause);
    return () => {
      videoEl.removeEventListener("play", onPlayPause);
      videoEl.removeEventListener("pause", onPlayPause);
      videoEl.removeEventListener("ended", onPlayPause);
    };
  }, [state.videoId]);

  const togglePlayback = (): void => {
    window.dispatchEvent(
      new CustomEvent("inverview:native-media-control", {
        detail: { command: isPlaying ? "pause" : "play" },
      }),
    );
  };

  const clampPosition = (x: number, y: number): { x: number; y: number } => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const cardWidth = cardRef.current?.offsetWidth ?? 260;
    const cardHeight = cardRef.current?.offsetHeight ?? 220;
    const nextX = Math.max(8, Math.min(x, viewportWidth - cardWidth - 8));
    const nextY = Math.max(8, Math.min(y, viewportHeight - cardHeight - 8));
    return { x: nextX, y: nextY };
  };

  const resetMobileSwipeStyles = (): void => {
    if (cardRef.current) {
      cardRef.current.style.transition = "transform 0.32s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.32s ease";
      cardRef.current.style.transform = "translate3d(0, 0, 0) scale3d(1, 1, 1)";
      cardRef.current.style.opacity = "1";
      cardRef.current.style.willChange = "auto";
    }
  };

  const animateMobileCommit = (keyframes: Keyframe[], duration: number, onDone: () => void): void => {
    const card = cardRef.current;
    if (!card) {
      onDone();
      return;
    }
    const animation = card.animate(keyframes, {
      duration,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      fill: "forwards",
    });
    animation.onfinish = () => {
      card.style.willChange = "auto";
      onDone();
    };
  };

  const handleMobilePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isMobileViewport) return;
    mobileSwipeRef.current = {
      startY: event.clientY,
      startX: event.clientX,
      pointerId: event.pointerId,
      hasSwiped: false,
    };
    setIsDragging(true);
    if (cardRef.current) {
      cardRef.current.style.transition = "none";
      cardRef.current.style.willChange = "transform, opacity";
    }
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleMobilePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const swipeState = mobileSwipeRef.current;
    if (!swipeState || swipeState.pointerId !== event.pointerId || swipeState.hasSwiped) return;

    const diffY = event.clientY - swipeState.startY;

    if (cardRef.current) {
      // 指のドラッグ量に応じて直接動かし、不透明度を減少させる
      cardRef.current.style.transform = `translate3d(0, ${diffY}px, 0)`;
      cardRef.current.style.opacity = `${1 - Math.min(0.6, Math.abs(diffY) / 160)}`;
    }

    const SWIPE_THRESHOLD = 80;

    if (diffY < -SWIPE_THRESHOLD) {
      swipeState.hasSwiped = true;
      setIsDragging(false);
      
      // 拡大（WatchPageへ吸い込まれる）コミットアニメーション
      animateMobileCommit([
        { transform: `translate3d(0, ${diffY}px, 0) scale3d(1, 1, 1)`, opacity: 1 },
        { transform: "translate3d(0, -48px, 0) scale3d(1.04, 1.04, 1)", opacity: 0.75, offset: 0.45 },
        { transform: "translate3d(0, -120px, 0) scale3d(1.15, 1.15, 1)", opacity: 0 },
      ], 300, () => {
        onExpand();
        setTimeout(() => {
          if (cardRef.current) {
            cardRef.current.style.transform = "translate3d(0, 0, 0) scale3d(1, 1, 1)";
            cardRef.current.style.opacity = "1";
          }
        }, 100);
      });
      
      try { event.currentTarget.releasePointerCapture(event.pointerId); } catch {}
    } else if (diffY > SWIPE_THRESHOLD) {
      swipeState.hasSwiped = true;
      setIsDragging(false);
      
      // 閉じる（下に落ちて消える）コミットアニメーション
      animateMobileCommit([
        { transform: `translate3d(0, ${diffY}px, 0) scale3d(1, 1, 1)`, opacity: 1 },
        { transform: "translate3d(0, 60px, 0) scale3d(0.96, 0.96, 1)", opacity: 0.66, offset: 0.5 },
        { transform: "translate3d(0, 120px, 0) scale3d(0.85, 0.85, 1)", opacity: 0 },
      ], 280, () => {
        onClose();
        setTimeout(() => {
          if (cardRef.current) {
            cardRef.current.style.transform = "translate3d(0, 0, 0) scale3d(1, 1, 1)";
            cardRef.current.style.opacity = "1";
          }
        }, 100);
      });
      
      try { event.currentTarget.releasePointerCapture(event.pointerId); } catch {}
    }
  };

  const handleMobilePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const swipeState = mobileSwipeRef.current;
    if (!swipeState || swipeState.pointerId !== event.pointerId) return;

    const diffX = Math.abs(event.clientX - swipeState.startX);
    const diffY = Math.abs(event.clientY - swipeState.startY);

    if (!swipeState.hasSwiped && diffX < 15 && diffY < 15) {
      const target = event.target as HTMLElement;
      if (!target.closest("button")) {
        // タップによる拡大時もプレミアムコミットアニメーションを実行！
        if (cardRef.current) {
          cardRef.current.style.willChange = "transform, opacity";
        }
        animateMobileCommit([
          { transform: "translate3d(0, 0, 0) scale3d(1, 1, 1)", opacity: 1 },
          { transform: "translate3d(0, -36px, 0) scale3d(1.03, 1.03, 1)", opacity: 0.78, offset: 0.42 },
          { transform: "translate3d(0, -80px, 0) scale3d(1.12, 1.12, 1)", opacity: 0 },
        ], 270, () => {
          onExpand();
          setTimeout(() => {
            if (cardRef.current) {
              cardRef.current.style.transform = "translate3d(0, 0, 0) scale3d(1, 1, 1)";
              cardRef.current.style.opacity = "1";
            }
          }, 100);
        });
      }
    } else if (!swipeState.hasSwiped) {
      // 閾値未満で指を離した場合はスムーズにスプリングバック
      resetMobileSwipeStyles();
    }

    mobileSwipeRef.current = null;
    setIsDragging(false);
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch {}
  };

  if (isMobileViewport) {
    return (
      <Card
        ref={cardRef}
        appearance="outline"
        className={styles.container}
        style={{ 
          left: "0", 
          top: "auto",
          willChange: "transform, opacity",
        }}
        onPointerDown={handleMobilePointerDown}
        onPointerMove={handleMobilePointerMove}
        onPointerUp={handleMobilePointerUp}
        onPointerCancel={(event) => {
          mobileSwipeRef.current = null;
          setIsDragging(false);
          resetMobileSwipeStyles();
          try { event.currentTarget.releasePointerCapture(event.pointerId); } catch {}
        }}
      >
        <div className={styles.hiddenPlayerHost} aria-hidden>
          <VideoPlayer
            video={state.video}
            baseUrl={state.baseUrl}
            initialPositionSeconds={state.positionSeconds}
            onPositionChange={onPositionChange}
            autoplay={true}
            miniMode={true}
          />
        </div>
        <div className={styles.mobileRow}>
          <div className={styles.mobileMeta} style={{ cursor: "pointer" }}>
            <Text size={200} weight="semibold" className={styles.mobileTitle}>{state.video.title}</Text>
            <Text size={100} className={styles.mobileSubtitle}>{state.video.author}</Text>
          </div>
          <Button
            size="small"
            appearance="subtle"
            className={styles.controlButton}
            icon={isPlaying ? <Pause16Regular /> : <Play16Regular />}
            onPointerDown={(event) => event.stopPropagation()}
            onPointerUp={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              togglePlayback();
            }}
            aria-label={isPlaying ? "pause" : "play"}
          />
          <Button
            size="small"
            appearance="subtle"
            icon={<Dismiss16Regular />}
            onPointerDown={(event) => event.stopPropagation()}
            onPointerUp={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onClose();
            }}
            aria-label="close mini player"
          />
        </div>
      </Card>
    );
  }

  return (
    <Card
      ref={cardRef}
      appearance="outline"
      className={styles.container}
      style={{ left: `${state.x}px`, top: `${state.y}px` }}
    >
      <div className={styles.hiddenPlayerHost} aria-hidden>
        <VideoPlayer
          video={state.video}
          baseUrl={state.baseUrl}
          initialPositionSeconds={state.positionSeconds}
          onPositionChange={onPositionChange}
          autoplay={true}
          miniMode={true}
        />
      </div>
      <div
        className={styles.header}
        onPointerDown={(event) => {
          const rect = cardRef.current?.getBoundingClientRect();
          if (!rect) return;
          dragRef.current = {
            pointerId: event.pointerId,
            offsetX: event.clientX - rect.left,
            offsetY: event.clientY - rect.top,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const dragState = dragRef.current;
          if (!dragState || dragState.pointerId !== event.pointerId) return;
          const { x, y } = clampPosition(event.clientX - dragState.offsetX, event.clientY - dragState.offsetY);
          onMove(x, y);
        }}
        onPointerUp={(event) => {
          if (dragRef.current?.pointerId !== event.pointerId) return;
          dragRef.current = null;
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={(event) => {
          if (dragRef.current?.pointerId !== event.pointerId) return;
          dragRef.current = null;
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
      >
        <div />
        <Button
          size="small"
          appearance="subtle"
          icon={<Dismiss16Regular />}
          onPointerDown={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
          aria-label="close mini player"
        />
      </div>
      <div onPointerUp={onExpand} style={{ cursor: "pointer", padding: "8px" }}>
        <Text size={200} weight="semibold" style={{ display: "block", marginBottom: "4px" }}>{state.video.title}</Text>
        <Text size={100} style={{ color: tokens.colorNeutralForeground3 }}>{state.video.author}</Text>
      </div>
    </Card>
  );
};

