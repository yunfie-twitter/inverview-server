import {
  makeStyles,
  tokens,
  NavDrawer,
  NavDrawerBody,
  NavDrawerHeader,
  NavItem,
  NavDivider,
  mergeClasses,
  AppItem,
  Tooltip,
} from "@fluentui/react-components";
import {
  Home24Regular,
  Home24Filled,
  Flash24Regular,
  Flash24Filled,
  Star24Regular,
  Star24Filled,
  History24Regular,
  History24Filled,
  Tv24Regular,
  Tv24Filled,
  Library24Regular,
  Library24Filled,
  Settings24Regular,
  Settings24Filled,
  VideoClip24Regular,
  VideoClip24Filled,
  Dismiss24Regular,
  bundleIcon,
} from "@fluentui/react-icons";
import type { CSSProperties, MouseEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSettings } from "../hooks/useSettings";
import { withViewTransition } from "../lib/webPlatform";

interface SidebarProps {
  mobile?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
}

const HomeIcon = bundleIcon(Home24Filled, Home24Regular);
const TrendingIcon = bundleIcon(Flash24Filled, Flash24Regular);
const ShortsIcon = bundleIcon(VideoClip24Filled, VideoClip24Regular);
const PopularIcon = bundleIcon(Star24Filled, Star24Regular);
const HistoryIcon = bundleIcon(History24Filled, History24Regular);
const SubscriptionsIcon = bundleIcon(Tv24Filled, Tv24Regular);
const PlaylistsIcon = bundleIcon(Library24Filled, Library24Regular);
const SettingsIcon = bundleIcon(Settings24Filled, Settings24Regular);

const useStyles = makeStyles({
  root: {
    overflow: "hidden",
    display: "flex",
    height: "100%",
    backgroundColor: "var(--sidebar-surface)",
  },
  nav: {
    height: "100%",
    width: "100%",
    minWidth: "unset",
    borderRight: "none",
    backgroundColor: "var(--sidebar-surface)",
    color: "var(--sidebar-foreground)",
  },
  collapsed: {},
  navBody: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    padding: "0 !important",
    overflow: "hidden",
    backgroundColor: "var(--sidebar-surface)",
  },
  topSection: {
    flex: 1,
    overflowY: "auto",
    overflowX: "hidden",
    padding: "8px 12px",
    scrollbarWidth: "none",
    "&::-webkit-scrollbar": {
      display: "none",
      width: 0,
      height: 0,
    },
  },
  topSectionCollapsed: {
    padding: "8px 12px",
    scrollbarWidth: "none",
    "&::-webkit-scrollbar": {
      display: "none",
      width: 0,
      height: 0,
    },
  },
  bottomSection: {
    padding: "0 12px 12px 12px",
    flexShrink: 0,
  },
  bottomSectionCollapsed: {
    padding: "0 12px 12px 12px",
  },
  navItem: {
    height: "44px",
    marginBottom: "2px",
    borderRadius: "8px",
    position: "relative",
    color: "var(--sidebar-item-fg)",
    padding: "0 8px !important",
    transition: "background-color 120ms linear, color 120ms linear, opacity 120ms linear",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start !important",
    "& .fui-NavItem__content": {
      marginLeft: "16px !important",
      fontSize: "14px",
      fontWeight: tokens.fontWeightSemibold,
      whiteSpace: "nowrap !important",
      color: "var(--sidebar-item-fg)",
    },
    "& .fui-NavItem__icon": {
      fontSize: "24px",
      width: "24px",
      height: "24px",
      color: "var(--sidebar-item-fg)",
      flexShrink: 0,
      margin: "0 !important",
    },
    "&:hover": {
      backgroundColor: "var(--sidebar-item-hover)",
    },
    "&:active, &:focus-visible": {
      backgroundColor: "var(--sidebar-item-selected)",
    },
    "&, &:hover, &:active, &:focus-visible": {
      color: "var(--sidebar-item-fg) !important",
      backgroundColor: "var(--sidebar-item-bg, transparent) !important",
    },
    "& .fui-NavItem__content, & .fui-NavItem__icon, & svg": {
      color: "var(--sidebar-item-fg) !important",
      fill: "currentColor",
      opacity: "1 !important",
    },
    "&::before": {
      content: '""',
      position: "absolute",
      left: "-12px",
      top: "10px",
      bottom: "10px",
      width: "4px",
      backgroundColor: tokens.colorCompoundBrandForeground1,
      borderRadius: "0 4px 4px 0",
      opacity: 0,
      transition: "opacity 0.2s ease",
    },
    "&.fui-NavItem--selected": {
      backgroundColor: "var(--sidebar-item-selected)",
      "& .fui-NavItem__content": {
        color: "var(--sidebar-item-fg-selected)",
        fontWeight: tokens.fontWeightBold,
      },
      "& .fui-NavItem__icon": {
        color: "var(--sidebar-item-fg-selected)",
        fontSize: "24px",
      },
    },
    "&.fui-NavItem--selected::before": {
      opacity: 1,
    },
  },
  navItemCollapsed: {
    padding: "0 8px !important",
    justifyContent: "flex-start !important",
    "& .fui-NavItem__content": {
      display: "none !important",
    },
    "& .fui-NavItem__icon": {
      margin: "0 !important",
    },
    "&::before, &.fui-NavItem--selected::before": {
      opacity: 0,
    },
    "&::after, &.fui-NavItem--selected::after": {
      content: "none",
      display: "none",
    },
  },
  divider: {
    margin: "8px 0",
    "&::before": {
      backgroundColor: `${tokens.colorNeutralStroke2} !important`,
    },
  },
  mobileHeader: {
    display: "flex",
    justifyContent: "flex-end",
    padding: "8px 12px 0 12px",
    backgroundColor: "var(--sidebar-surface)",
  },
});

export const Sidebar = ({
  mobile = false,
  isOpen = false,
  onClose,
}: SidebarProps): JSX.Element => {
  const styles = useStyles();
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const prefersDark =
    typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDarkSidebar =
    settings.theme === "dark" ||
    settings.theme === "amoled" ||
    (settings.theme === "system" && prefersDark);
  const isAmoled = settings.theme === "amoled" || (settings.amoledEnabled && isDarkSidebar);
  const isCollapsed = !mobile && settings.sidebarCollapsed;

  const selectedKey = location.pathname + location.search;

  const handleNavigate = (event: MouseEvent<HTMLElement>, value: string) => {
    event.preventDefault();
    const navState = value === "/settings" ? { state: { backgroundLocation: location } } : undefined;
    withViewTransition(() => navigate(value, navState));
    if (mobile) onClose?.();
  };

  const navItems = [
    { icon: <HomeIcon />, label: t("nav.home"), value: "/" },
    { icon: <TrendingIcon />, label: t("nav.trending"), value: "/?homeTab=trending" },
    ...(!settings.hideShorts
      ? [
          { icon: <ShortsIcon />, label: t("nav.shorts"), value: "/shorts" },
        ]
      : []),
    { icon: <PopularIcon />, label: t("nav.popular"), value: "/?homeTab=popular" },
    { icon: <HistoryIcon />, label: t("nav.history"), value: "/history" },
    { icon: <SubscriptionsIcon />, label: t("nav.subscriptions"), value: "/subscriptions" },
    { icon: <PlaylistsIcon />, label: t("nav.playlists"), value: "/playlists" },
  ];

  return (
    <NavDrawer
      open={mobile ? isOpen : true}
      type={mobile ? "overlay" : "inline"}
      selectedValue={selectedKey}
      className={mergeClasses(styles.nav, isCollapsed && styles.collapsed)}
      style={
        {
          "--sidebar-surface": isAmoled ? "#000000" : (isDarkSidebar ? "#0a0a0a" : "#f3f4f6"),
          "--sidebar-foreground": isDarkSidebar ? "#ffffff" : "#1f2937",
          "--sidebar-item-bg": isAmoled ? "transparent" : "transparent",
          "--sidebar-item-fg": isAmoled ? "#ffffff" : (isDarkSidebar ? "#f3f4f6" : "#1f2937"),
          "--sidebar-item-fg-selected": isAmoled ? "#ffffff" : (isDarkSidebar ? "#ffffff" : "#111827"),
          "--sidebar-item-hover": isAmoled ? "transparent" : (isDarkSidebar ? "rgba(255, 255, 255, 0.08)" : "rgba(17, 24, 39, 0.08)"),
          "--sidebar-item-selected": isAmoled ? "transparent" : (isDarkSidebar ? "rgba(255, 255, 255, 0.12)" : "rgba(17, 24, 39, 0.14)"),
        } as CSSProperties
      }
      onOpenChange={(_, data) => {
        if (!data.open && mobile) onClose?.();
      }}
    >
      {mobile ? (
        <NavDrawerHeader className={styles.mobileHeader}>
          <Tooltip content={t("mobile.close")} relationship="label">
            <AppItem
              as="button"
              aria-label={t("mobile.close")}
              title={t("mobile.close")}
              onClick={() => onClose?.()}
              icon={<Dismiss24Regular />}
            />
          </Tooltip>
        </NavDrawerHeader>
      ) : null}
      <NavDrawerBody className={styles.navBody}>
        <div className={mergeClasses(styles.topSection, isCollapsed && styles.topSectionCollapsed)}>
          {navItems.map((item) => (
            <NavItem
              key={item.value}
              icon={item.icon}
              value={item.value}
              onClick={(event) => handleNavigate(event, item.value)}
              aria-label={item.label}
              title={item.label}
              className={mergeClasses(styles.navItem, isCollapsed && styles.navItemCollapsed)}
            >
              {!isCollapsed ? item.label : null}
            </NavItem>
          ))}
        </div>

        <div className={mergeClasses(styles.bottomSection, isCollapsed && styles.bottomSectionCollapsed)}>
          <NavDivider className={styles.divider} />
          <NavItem
            icon={<SettingsIcon />}
            value="/settings"
            onClick={(event) => handleNavigate(event, "/settings")}
            aria-label={t("nav.settings")}
            title={t("nav.settings")}
            className={mergeClasses(styles.navItem, isCollapsed && styles.navItemCollapsed)}
          >
            {!isCollapsed ? t("nav.settings") : null}
          </NavItem>
        </div>
      </NavDrawerBody>
    </NavDrawer>
  );
};
