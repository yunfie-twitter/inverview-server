import { Text, makeStyles, tokens, mergeClasses } from "@fluentui/react-components";
import {
  Home24Regular,
  Home24Filled,
  Search24Regular,
  Search24Filled,
  Flash24Regular,
  Flash24Filled,
  Star24Regular,
  Star24Filled,
  VideoClip24Regular,
  VideoClip24Filled,
  bundleIcon,
} from "@fluentui/react-icons";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMemo } from "react";
import { useSettings } from "../../hooks/useSettings";
import { withViewTransition } from "../../lib/webPlatform";
import { triggerHaptic } from "../../lib/haptic";

interface MobileBottomNavProps {
  onOpenSearch: () => void;
}

const HomeIcon = bundleIcon(Home24Filled, Home24Regular);
const SearchIcon = bundleIcon(Search24Filled, Search24Regular);
const TrendingIcon = bundleIcon(Flash24Filled, Flash24Regular);
const SubscriptionsIcon = bundleIcon(Star24Filled, Star24Regular);
const ShortsIcon = bundleIcon(VideoClip24Filled, VideoClip24Regular);

type NavItem = {
  key: string;
  labelKey: string;
  to?: string;
  action?: "search";
  icon: any;
};

const items: NavItem[] = [
  { key: "home", labelKey: "nav.home", to: "/", icon: HomeIcon },
  { key: "search", labelKey: "nav.search", action: "search", icon: SearchIcon },
  { key: "trending", labelKey: "nav.trending", to: "/?homeTab=trending", icon: TrendingIcon },
  { key: "shorts", labelKey: "nav.shorts", to: "/shorts", icon: ShortsIcon },
  { key: "subscriptions", labelKey: "nav.subscriptions", to: "/subscriptions", icon: SubscriptionsIcon },
];

const useStyles = makeStyles({
  nav: {
    display: "block",
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 40,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    backdropFilter: "blur(14px)",
    paddingBottom: "env(safe-area-inset-bottom)",
    "@media (min-width: 768px)": {
      display: "none",
    },
  },
  container: {
    display: "flex",
    justifyContent: "space-around",
    padding: "8px 0",
  },
  item: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "2px",
    minWidth: "64px",
    cursor: "pointer",
    textDecorationLine: "none",
    background: "none",
    border: "none",
    padding: 0,
    color: tokens.colorNeutralForeground3,
    transition: "color 150ms ease",
  },
  itemActive: {
    color: tokens.colorBrandForeground1,
  },
  icon: {
    fontSize: "24px",
  },
  label: {
    fontSize: "10px",
  },
});

export const MobileBottomNav = ({ onOpenSearch }: MobileBottomNavProps): JSX.Element => {
  const styles = useStyles();
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  const { settings } = useSettings();
  const prefersDark = useMemo(() => typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches, []);
  const isDark = useMemo(() => {
    return settings.theme === "dark" || settings.theme === "amoled" || (settings.theme === "system" && prefersDark);
  }, [settings.theme, prefersDark]);
  const isPWA = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true;
  }, []);

  const isAmoledBlackNav = isPWA && isDark;

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (item.key === "shorts" && settings.hideShorts) return false;
      return true;
    });
  }, [settings.hideShorts]);

  const isActive = (key: string): boolean => {
    if (key === "home") {
      return location.pathname === "/" && !location.search.includes("homeTab=trending");
    }
    if (key === "trending") {
      return location.pathname === "/" && location.search.includes("homeTab=trending");
    }
    if (key === "shorts") {
      return location.pathname.startsWith("/shorts");
    }
    if (key === "subscriptions") return location.pathname.startsWith("/subscriptions");
    if (key === "settings") return location.pathname.startsWith("/settings");
    if (key === "search") return location.pathname.startsWith("/search");
    return false;
  };

  return (
    <nav
      className={styles.nav}
      style={{
        backgroundColor: isAmoledBlackNav ? "#000000" : undefined,
        borderTopColor: isAmoledBlackNav ? "#111111" : undefined,
      }}
    >
      <div className={styles.container}>
        {filteredItems.map((item) => {
          const active = isActive(item.key);
          const Icon = item.icon;

          if (item.action === "search") {
            return (
              <button
                key={item.key}
                className={mergeClasses(styles.item, active ? styles.itemActive : undefined)}
                style={{
                  padding: settings.hideMobileNavLabels ? "6px 0" : undefined,
                  justifyContent: "center",
                }}
                onClick={() => {
                  triggerHaptic("click");
                  onOpenSearch();
                }}
              >
                <Icon className={styles.icon} />
                {!settings.hideMobileNavLabels && <Text className={styles.label}>{t(item.labelKey)}</Text>}
              </button>
            );
          }

          return (
            <button
              key={item.key}
              className={mergeClasses(styles.item, active ? styles.itemActive : undefined)}
              style={{
                padding: settings.hideMobileNavLabels ? "6px 0" : undefined,
                justifyContent: "center",
              }}
              onClick={() => {
                triggerHaptic("click");
                withViewTransition(() => navigate(item.to || "/"));
              }}
            >
              <Icon className={styles.icon} />
              {!settings.hideMobileNavLabels && <Text className={styles.label}>{t(item.labelKey)}</Text>}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
