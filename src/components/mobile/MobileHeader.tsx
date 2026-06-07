import { Hamburger, Button, Tooltip, makeStyles, tokens } from "@fluentui/react-components";
import {
  ArrowLeft24Regular,
  Search24Regular,
  Search24Filled,
  bundleIcon,
} from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";

interface MobileHeaderProps {
  onOpenMenu: () => void;
  onOpenSearch: () => void;
  showHomeTitle?: boolean;
  backButton?: boolean;
  onBack?: () => void;
}

const SearchIcon = bundleIcon(Search24Filled, Search24Regular);

const useStyles = makeStyles({
  header: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    position: "sticky",
    top: 0,
    zIndex: 35,
    height: "46px",
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: "var(--app-accent)",
    color: "#ffffff",
    backdropFilter: "blur(12px)",
    padding: "0 16px",
    flexShrink: 0,
    WebkitAppRegion: "drag",
    appRegion: "drag",
    "@media (min-width: 768px)": {
      display: "none",
    },
  },
  container: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  leftActions: {
    display: "flex",
    alignItems: "center",
    WebkitAppRegion: "no-drag",
    appRegion: "no-drag",
    "& button, & i, & svg": {
      color: "#ffffff !important",
    },
  },
  rightActions: {
    display: "flex",
    gap: "4px",
    justifySelf: "end",
    WebkitAppRegion: "no-drag",
    appRegion: "no-drag",
    "& button, & i, & svg": {
      color: "#ffffff !important",
    },
  },
});

export const MobileHeader = ({
  onOpenMenu,
  onOpenSearch,
  backButton = false,
  onBack,
}: MobileHeaderProps): JSX.Element => {
  const styles = useStyles();
  const { t } = useTranslation();

  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <div className={styles.leftActions}>
          {backButton ? (
            <Tooltip content={t("common.back")} relationship="label">
              <Button icon={<ArrowLeft24Regular />} appearance="subtle" onClick={onBack} />
            </Tooltip>
          ) : (
            <Tooltip content={t("mobile.menu")} relationship="label">
              <Hamburger onClick={onOpenMenu} />
            </Tooltip>
          )}
        </div>
        <div className={styles.rightActions}>
          <Tooltip content={t("mobile.search")} relationship="label">
            <Button icon={<SearchIcon />} appearance="subtle" onClick={onOpenSearch} />
          </Tooltip>
        </div>
      </div>
    </header>
  );
};
