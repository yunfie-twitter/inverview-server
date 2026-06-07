import { useState } from "react";
import {
  Text,
  makeStyles,
  tokens,
  Button,
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
  MenuItemRadio,
  MenuDivider,
  MenuGroup,
  MenuGroupHeader,
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@fluentui/react-components";
import {
  WeatherSunny24Regular,
  WeatherMoon24Regular,
  Settings24Regular,
  Globe24Regular,
  VideoClip24Regular,
  Open24Regular,
  Navigation24Regular,
  Info24Regular,
} from "@fluentui/react-icons";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { SearchBar } from "./SearchBar";
import { useSettings } from "../hooks/useSettings";
import { withViewTransition } from "../lib/webPlatform";
import type { ThemeMode, QualityMode } from "../hooks/useSettings";

const useStyles = makeStyles({
  header: {
    display: "flex",
    alignItems: "center",
    height: "46px",
    position: "relative",
    zIndex: 20,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: "var(--app-accent)",
    color: "#ffffff",
    padding: "0 24px 0 16px",
    boxSizing: "border-box",
    flexShrink: 0,
    WebkitAppRegion: "drag",
    appRegion: "drag",
    "@media (max-width: 767px)": {
      display: "none",
    },
  },
  container: {
    display: "flex",
    alignItems: "center",
    gap: "20px",
    width: "100%",
  },
  sidebarToggle: {
    WebkitAppRegion: "no-drag",
    appRegion: "no-drag",
    color: "#ffffff !important",
    "& i, & svg": {
      color: "#ffffff !important",
    },
  },
  logoLink: {
    textDecorationLine: "none",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    WebkitAppRegion: "no-drag",
    appRegion: "no-drag",
    ":hover": {
      opacity: 0.8,
      color: "#ffffff",
    },
  },
  searchBarWrap: {
    flexGrow: 1,
    maxWidth: "720px",
    margin: "0 auto",
    WebkitAppRegion: "no-drag",
    appRegion: "no-drag",
  },
  actions: {
    display: "flex",
    gap: "4px",
    WebkitAppRegion: "no-drag",
    appRegion: "no-drag",
    "& button, & i, & svg": {
      color: "#ffffff !important",
    },
  },
});

export const Header = (): JSX.Element => {
  const styles = useStyles();
  const { t } = useTranslation();
  const location = useLocation();
  const { search } = location;
  const navigate = useNavigate();
  const { settings, setSetting } = useSettings();
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const initialQ = new URLSearchParams(search).get("q") ?? "";

  const onThemeChange = (_e: any, data: any) => {
    setSetting("theme", data.checkedItems[0] as ThemeMode);
  };

  const onQualityChange = (_e: any, data: any) => {
    setSetting("quality", data.checkedItems[0] as QualityMode);
  };

  const onRegionChange = (_e: any, data: any) => {
    setSetting("region", data.checkedItems[0] as string);
  };

  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <Button
          className={styles.sidebarToggle}
          appearance="subtle"
          icon={<Navigation24Regular />}
          title={settings.sidebarCollapsed ? t("header.expandSidebar") : t("header.collapseSidebar")}
          aria-label={settings.sidebarCollapsed ? t("header.expandSidebar") : t("header.collapseSidebar")}
          onClick={() => setSetting("sidebarCollapsed", !settings.sidebarCollapsed)}
        />
        <Link to="/" className={styles.logoLink}>
          <Text size={500} weight="bold" style={{ letterSpacing: "0.5px" }}>
            InverView
          </Text>
        </Link>
        <div className={styles.searchBarWrap}>
          <SearchBar initialQuery={initialQ} />
        </div>
        <div className={styles.actions}>
          <Menu>
            <MenuTrigger disableButtonEnhancement>
              <Button
                appearance="subtle"
                icon={<Settings24Regular />}
                title={t("header.settingsMenu")}
                aria-label={t("header.settingsMenu")}
              />
            </MenuTrigger>
            <MenuPopover>
              <MenuList>
                <MenuGroup>
                  <MenuGroupHeader>{t("header.appearance")}</MenuGroupHeader>
                  <Menu>
                    <MenuTrigger disableButtonEnhancement>
                      <MenuItem icon={settings.theme === "dark" ? <WeatherMoon24Regular /> : <WeatherSunny24Regular />}>
                        {t("header.theme", { value: settings.theme })}
                      </MenuItem>
                    </MenuTrigger>
                    <MenuPopover>
                      <MenuList
                        checkedValues={{ theme: [settings.theme] }}
                        onCheckedValueChange={onThemeChange}
                      >
                        <MenuItemRadio name="theme" value="system">System</MenuItemRadio>
                        <MenuItemRadio name="theme" value="light">Light</MenuItemRadio>
                        <MenuItemRadio name="theme" value="dark">Dark</MenuItemRadio>
                        <MenuItemRadio name="theme" value="amoled">Amoled</MenuItemRadio>
                      </MenuList>
                    </MenuPopover>
                  </Menu>
                </MenuGroup>

                <MenuGroup>
                  <MenuGroupHeader>{t("header.playback")}</MenuGroupHeader>
                  <Menu>
                    <MenuTrigger disableButtonEnhancement>
                      <MenuItem icon={<VideoClip24Regular />}>
                        {t("header.quality", { value: settings.quality })}
                      </MenuItem>
                    </MenuTrigger>
                    <MenuPopover>
                      <MenuList
                        checkedValues={{ quality: [settings.quality] }}
                        onCheckedValueChange={onQualityChange}
                      >
                        <MenuItemRadio name="quality" value="auto">Auto</MenuItemRadio>
                        <MenuItemRadio name="quality" value="1080p">1080p</MenuItemRadio>
                        <MenuItemRadio name="quality" value="720p">720p</MenuItemRadio>
                        <MenuItemRadio name="quality" value="480p">480p</MenuItemRadio>
                        <MenuItemRadio name="quality" value="360p">360p</MenuItemRadio>
                      </MenuList>
                    </MenuPopover>
                  </Menu>
                  <Menu>
                    <MenuTrigger disableButtonEnhancement>
                      <MenuItem icon={<Globe24Regular />}>
                        {t("header.region", { value: settings.region })}
                      </MenuItem>
                    </MenuTrigger>
                    <MenuPopover>
                      <MenuList
                        checkedValues={{ region: [settings.region] }}
                        onCheckedValueChange={onRegionChange}
                      >
                        {["JP", "US", "KR", "GB", "DE", "FR", "TW"].map((r) => (
                          <MenuItemRadio key={r} name="region" value={r}>{r}</MenuItemRadio>
                        ))}
                      </MenuList>
                    </MenuPopover>
                  </Menu>
                </MenuGroup>

                <MenuDivider />
                <MenuItem
                  icon={<Open24Regular />}
                  onClick={() => withViewTransition(() => navigate("/settings", { state: { backgroundLocation: location } }))}
                >
                  {t("header.showAllSettings")}
                </MenuItem>
                <MenuItem
                  icon={<Info24Regular />}
                  onClick={() => setIsAboutOpen(true)}
                >
                  {t("header.aboutInverView")}
                </MenuItem>
              </MenuList>
            </MenuPopover>
          </Menu>
        </div>
      </div>

      <Dialog open={isAboutOpen} onOpenChange={(_, data) => setIsAboutOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{t("header.aboutInverView")}</DialogTitle>
            <DialogContent>
              {t("header.aboutDescriptionLine1")}<br />
              {t("header.aboutDescriptionLine2")}
            </DialogContent>
            <DialogActions>
              <Button appearance="primary" onClick={() => setIsAboutOpen(false)}>
                {t("common.close")}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </header>
  );
};
