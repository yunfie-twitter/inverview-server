import { makeStyles, tokens, mergeClasses, Spinner } from "@fluentui/react-components";
import { ArrowDown20Regular } from "@fluentui/react-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, useCallback, useMemo, type CSSProperties } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { MiniPlayer } from "./MiniPlayer";
import { MobileBottomNav } from "./mobile/MobileBottomNav";
import { MobileHeader } from "./mobile/MobileHeader";
import { MobileSearchOverlay } from "./mobile/MobileSearchOverlay";
import { useMiniPlayer, useSettings } from "../hooks/useSettings";
import { resolveAccentColor } from "../accentColor";
import { getStorageString, removeStorageValue, setStorageString } from "../lib/browserStorage";

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100dvh",
    paddingTop: "var(--window-top-inset)",
    backgroundColor: tokens.colorNeutralBackground1,
    overflow: "hidden",
  },
  headerArea: {
    flexShrink: 0,
    zIndex: 110,
  },
  body: {
    display: "flex",
    flexGrow: 1,
    minHeight: 0,
    overflow: "hidden",
  },
  sidebarWrap: {
    flexShrink: 0,
    width: "var(--sidebar-width-expanded)",
    transition: "var(--sidebar-transition)",
    willChange: "width",
    contain: "layout paint",
    height: "100%",
    zIndex: 100,
    overflow: "hidden",
    backgroundColor: "var(--sidebar-surface)",
    borderRight: "none",
    "@media (max-width: 767px)": {
      display: "none",
    },
  },
  sidebarWrapCollapsed: {
    width: "var(--sidebar-width-collapsed)",
  },
  mainContent: {
    flexGrow: 1,
    minWidth: 0,
    overflowY: "auto",
    padding: "24px",
    transition: "none",
    paddingBottom: "24px",
    "@media (max-width: 767px)": {
      padding: "16px",
      paddingBottom: "calc(80px + env(safe-area-inset-bottom))",
    },
  },
  mainContentInner: {
    minHeight: "100%",
  },
  tvWatchMainContent: {
    overflow: "hidden",
    padding: "0",
    paddingBottom: "0",
    backgroundColor: "#000000",
  },
  tvWatchMainContentInner: {
    minHeight: "100%",
    height: "100%",
  },
  mobileWatchMainContent: {
    "@media (max-width: 767px)": {
      paddingTop: "0",
    },
  },
  pageTransitionWrapper: {
    width: "100%",
    minHeight: "100%",
    animationName: {
      from: {
        opacity: 0,
        transform: "translate3d(0, 16px, 0)",
      },
      to: {
        opacity: 1,
        transform: "translate3d(0, 0, 0)",
      },
    },
    animationDuration: "350ms",
    animationTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
    animationFillMode: "both",
    willChange: "transform, opacity",
    "@media (prefers-reduced-motion: reduce)": {
      animation: "none",
    },
  },
  pageTransitionWrapperBase: {
    width: "100%",
    minHeight: "100%",
    animationDuration: "350ms",
    animationTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
    animationFillMode: "both",
    willChange: "transform, opacity",
    "@media (prefers-reduced-motion: reduce)": {
      animation: "none",
    },
  },
  pageTransitionWrapperFromBottom: {
    animationName: {
      from: {
        opacity: 0,
        transform: "translate3d(0, 16px, 0)",
      },
      to: {
        opacity: 1,
        transform: "translate3d(0, 0, 0)",
      },
    },
  },
  pageTransitionWrapperFromTop: {
    animationName: {
      from: {
        opacity: 0,
        transform: "translate3d(0, -16px, 0)",
      },
      to: {
        opacity: 1,
        transform: "translate3d(0, 0, 0)",
      },
    },
  },
  pageTransitionWrapperNoAnimation: {
    animation: "none",
    transform: "none",
    opacity: 1,
  },
});

export const AppShell = (): JSX.Element => {
  const styles = useStyles();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { settings, setSetting } = useSettings();
  const prefersDark =
    typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDarkSidebar =
    settings.theme === "dark" ||
    settings.theme === "amoled" ||
    (settings.theme === "system" && prefersDark);
  const isAmoled = settings.theme === "amoled" || (settings.amoledEnabled && isDarkSidebar);
  const { miniPlayer, setMiniPlayer } = useMiniPlayer();
  const wasWatchRouteRef = useRef(location.pathname.startsWith("/watch/"));
  const isTvRoute = location.pathname === "/tv" || location.pathname.startsWith("/tv/watch/");
  const isTvWatchRoute = location.pathname.startsWith("/tv/watch/");
  const isWatchRoute = location.pathname.startsWith("/watch/");
  const isSettingsRoute = location.pathname === "/settings";
  const mainContentRef = useRef<HTMLElement | null>(null);
  const activeWatchAnimationRef = useRef<Animation | null>(null);
  const previousPathnameRef = useRef(location.pathname);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [useTopEntryTransition, setUseTopEntryTransition] = useState(false);
  const pullDistanceRef = useRef(0);
  const isRefreshingRef = useRef(false);

  useEffect(() => {
    pullDistanceRef.current = pullDistance;
  }, [pullDistance]);

  useEffect(() => {
    isRefreshingRef.current = isRefreshing;
  }, [isRefreshing]);

  const queryClient = useQueryClient();
  useEffect(() => {
    const isWatch = location.pathname.startsWith("/watch/") || location.pathname.startsWith("/tv/watch/");
    if (!isWatch) {
      setStorageString("session", "lastNonWatchPath", location.pathname + location.search);
    }
  }, [location.pathname, location.search]);

  useEffect(() => {
    const shouldUseTopEntry = getStorageString("session", "inverview:return-from-watch-minimize") === "1";
    if (!shouldUseTopEntry) {
      setUseTopEntryTransition(false);
      return;
    }
    removeStorageValue("session", "inverview:return-from-watch-minimize");
    setStorageString("session", "inverview:suppress-next-page-secondary-animation", "1");
    // Returning from watch -> mini can stack multiple "from top" effects.
    // Keep shell transition off for this navigation to avoid double animation.
    setUseTopEntryTransition(false);
    return;
  }, [location.pathname, location.search]);

  const isMobile = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 767px)").matches;
  }, []);

  const isPullToRefreshEnabled = isMobile && !isWatchRoute && !isTvRoute && !isTvWatchRoute;

  useEffect(() => {
    const el = mainContentRef.current;
    if (!el || !isPullToRefreshEnabled) return;

    let startY = 0;
    let isPulling = false;

    const handleTouchStart = (e: TouchEvent) => {
      if (isRefreshingRef.current) return;
      if (el.scrollTop <= 0) {
        startY = e.touches[0].clientY;
        isPulling = true;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isRefreshingRef.current) return;
      if (!isPulling) return;
      const currentY = e.touches[0].clientY;
      const diffY = currentY - startY;

      if (diffY > 0) {
        if (e.cancelable) {
          e.preventDefault();
        }
        const distance = Math.min(90, diffY * 0.5);
        setPullDistance(distance);
      } else {
        isPulling = false;
        setPullDistance(0);
      }
    };

    const handleTouchEnd = () => {
      if (isRefreshingRef.current) return;
      if (!isPulling) return;
      isPulling = false;

      const currentDist = pullDistanceRef.current;

      if (currentDist >= 50) {
        if (typeof window !== "undefined" && navigator.vibrate) {
          try {
            navigator.vibrate(15);
          } catch {
            // Ignore browser security restrictions
          }
        }
        void (async () => {
          setIsRefreshing(true);
          setPullDistance(50);
          try {
            await queryClient.refetchQueries({ type: "active" });
          } catch (err) {
            console.error("Failed to refetch active queries", err);
          } finally {
            setIsRefreshing(false);
            const duration = 200;
            const start = performance.now();
            const from = 50;
            const animate = (time: number) => {
              const elapsed = time - start;
              const progress = Math.min(elapsed / duration, 1);
              const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
              setPullDistance(from * (1 - eased));
              if (progress < 1) {
                requestAnimationFrame(animate);
              }
            };
            requestAnimationFrame(animate);
          }
        })();
      } else {
        setPullDistance(0);
      }
    };

    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    el.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isPullToRefreshEnabled, queryClient]);

  useEffect(() => {
    const isWatchRoute = location.pathname.startsWith("/watch/");
    const enteredWatchRoute = isWatchRoute && !wasWatchRouteRef.current;

    if (enteredWatchRoute && !settings.sidebarCollapsed) {
      setSetting("sidebarCollapsed", true);
    }

    const isMobileViewport = typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
    const reduceMotion =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (enteredWatchRoute && isMobileViewport && !reduceMotion && mainContentRef.current) {
      activeWatchAnimationRef.current?.cancel();

      activeWatchAnimationRef.current = mainContentRef.current.animate(
        [
          { opacity: 0.96, transform: "translate3d(0, 10px, 0) scale(0.995)" },
          { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)" },
        ],
        {
          duration: 280,
          easing: "cubic-bezier(0.16, 1, 0.3, 1)",
          fill: "both",
        },
      );
    } else {
      activeWatchAnimationRef.current?.cancel();
      activeWatchAnimationRef.current = null;
    }

    wasWatchRouteRef.current = isWatchRoute;

    return () => {
      activeWatchAnimationRef.current?.cancel();
      activeWatchAnimationRef.current = null;
    };
  }, [location.pathname, settings.sidebarCollapsed, setSetting]);

  useEffect(() => {
    if (!settings.miniPlayer) {
      if (miniPlayer) setMiniPlayer(null);
      previousPathnameRef.current = location.pathname;
      return;
    }
    const previousPath = previousPathnameRef.current;
    const leftWatchRoute = previousPath.startsWith("/watch/") && !location.pathname.startsWith("/watch/");

    if (leftWatchRoute && miniPlayer) {
      setMiniPlayer({ ...miniPlayer, visible: true });
    }

    previousPathnameRef.current = location.pathname;
  }, [location.pathname, miniPlayer, setMiniPlayer, settings.miniPlayer]);

  useEffect(() => {
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (!(themeColorMeta instanceof HTMLMetaElement)) return;

    // HTMLのcolor-schemeを動的に変更して、Android等のシステムナビゲーションバーをテーマに同期させる！
    document.documentElement.style.colorScheme = isDarkSidebar ? "dark" : "light";

    const isMobileViewport =
      typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;

    if (isMenuOpen && isMobileViewport && !isTvRoute) {
      themeColorMeta.content = isAmoled ? "#000000" : (isDarkSidebar ? "#0a0a0a" : "#f3f4f6");
      return;
    }

    if (isSearchOpen && isMobileViewport && !isTvRoute) {
      const applySearchSurfaceColor = (): void => {
        const searchSurface = document.querySelector('[data-mobile-search-surface="true"]');
        if (!(searchSurface instanceof HTMLElement)) return;
        const surfaceColor = window.getComputedStyle(searchSurface).backgroundColor;
        if (surfaceColor) {
          themeColorMeta.content = surfaceColor;
        }
      };

      applySearchSurfaceColor();
      const rafId = window.requestAnimationFrame(applySearchSurfaceColor);
      return () => window.cancelAnimationFrame(rafId);
    }

    if (isSettingsRoute && isMobileViewport && !isTvRoute) {
      const applySettingsSurfaceColor = (): void => {
        const settingsSurface = document.querySelector('[data-settings-surface="true"]');
        if (!(settingsSurface instanceof HTMLElement)) return;
        const surfaceColor = window.getComputedStyle(settingsSurface).backgroundColor;
        if (surfaceColor) {
          themeColorMeta.content = surfaceColor;
        }
      };

      applySettingsSurfaceColor();
      const rafId = window.requestAnimationFrame(applySettingsSurfaceColor);
      return () => window.cancelAnimationFrame(rafId);
    }

    if (isWatchRoute || isTvWatchRoute) {
      themeColorMeta.content = "#000000";
    } else {
      themeColorMeta.content = resolveAccentColor(settings.accentColor, settings.customAccentColor);
    }
  }, [
    isMenuOpen,
    isSearchOpen,
    isSettingsRoute,
    isDarkSidebar,
    isTvRoute,
    isWatchRoute,
    isTvWatchRoute,
    settings.accentColor,
    settings.customAccentColor,
  ]);

  return (
    <div className={styles.root}>
      {/* Pull to Refresh Indicator */}
      {pullDistance > 0 && (
        <div
          style={{
            position: "absolute",
            top: "calc(var(--window-top-inset, 0px) + 8px)",
            left: "50%",
            transform: `translate3d(-50%, ${pullDistance}px, 0) scale(${Math.min(1, pullDistance / 50)})`,
            zIndex: 1000,
            pointerEvents: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            backgroundColor: tokens.colorNeutralBackground1,
            boxShadow: tokens.shadow16,
            border: `1px solid ${tokens.colorNeutralStroke2}`,
            transition: isRefreshing ? "none" : "transform 0.1s ease, opacity 0.1s ease",
            opacity: Math.min(1, pullDistance / 40),
          }}
        >
          {isRefreshing ? (
            <Spinner size="tiny" />
          ) : (
            <ArrowDown20Regular
              style={{
                color: tokens.colorBrandForeground1,
                transform: `rotate(${Math.min(180, (pullDistance / 50) * 180)}deg)`,
                transition: "transform 0.1s ease",
              }}
            />
          )}
        </div>
      )}

      {!isTvRoute && (
        <div className={styles.headerArea}>
          <Header />
          <MobileHeader
            onOpenMenu={() => setIsMenuOpen(true)}
            onOpenSearch={() => setIsSearchOpen(true)}
            showHomeTitle={location.pathname === "/"}
            backButton={isWatchRoute}
            onBack={() => {
              if (window.history.length > 1) {
                navigate(-1);
                return;
              }
              navigate("/");
            }}
          />
        </div>
      )}

      {!isTvRoute && <MobileSearchOverlay isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />}

      {/* ボディエリア (サイドバー + メイン) */}
      <div className={styles.body}>
        {!isTvRoute && settings.showDesktopSidebar && (
          <div
            className={mergeClasses(styles.sidebarWrap, settings.sidebarCollapsed && styles.sidebarWrapCollapsed)}
            style={{ "--sidebar-surface": isAmoled ? "#000000" : (isDarkSidebar ? "#0a0a0a" : "#f3f4f6") } as CSSProperties}
          >
            <Sidebar />
          </div>
        )}

        {!isTvRoute && <Sidebar mobile isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />}

        <main
          id="app-scroll-container"
          ref={mainContentRef}
          data-watch-route={isWatchRoute ? "true" : "false"}
          className={mergeClasses(
            styles.mainContent,
            isWatchRoute && styles.mobileWatchMainContent,
            isTvWatchRoute && styles.tvWatchMainContent,
          )}
        >
          <div
            id="app-scroll-content"
            className={mergeClasses(styles.mainContentInner, isTvWatchRoute && styles.tvWatchMainContentInner)}
          >
            <div
              key={location.pathname}
              className={mergeClasses(
                styles.pageTransitionWrapperBase,
                !(isWatchRoute || isTvWatchRoute) && (
                  useTopEntryTransition ? styles.pageTransitionWrapperFromTop : styles.pageTransitionWrapperFromBottom
                ),
                (isWatchRoute || isTvWatchRoute) && styles.pageTransitionWrapperNoAnimation,
              )}
            >
              <Outlet />
            </div>
          </div>
        </main>
      </div>

      {settings.miniPlayer && miniPlayer?.visible && !location.pathname.startsWith("/watch/") && !isTvRoute && (
        <MiniPlayer
          state={miniPlayer}
          onPositionChange={(seconds) => {
            setMiniPlayer({ ...miniPlayer, positionSeconds: seconds });
          }}
          onMove={(x, y) => {
            setMiniPlayer({ ...miniPlayer, x, y });
          }}
          onExpand={() => navigate(`/watch/${miniPlayer.videoId}?autoplay=1`)}
          onClose={() => setMiniPlayer(null)}
        />
      )}

      {!isTvRoute && !isWatchRoute && <MobileBottomNav onOpenSearch={() => setIsSearchOpen(true)} />}
    </div>
  );
};
