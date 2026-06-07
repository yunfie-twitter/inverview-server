import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  Title1,
  Body1,
  Caption1,
  makeStyles,
  tokens,
  shorthands,
} from "@fluentui/react-components";
import { WifiWarning24Regular } from "@fluentui/react-icons";

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    width: "100%",
    padding: "24px",
    boxSizing: "border-box",
    backgroundColor: tokens.colorNeutralBackground1,
  },
  content: {
    width: "100%",
    maxWidth: "360px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
  },
  icon: {
    fontSize: "64px",
    width: "64px",
    height: "64px",
    color: tokens.colorPaletteRedBorderActive,
    marginBottom: "20px",
  },
  title: {
    marginBottom: "8px",
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },
  description: {
    marginBottom: "24px",
    color: tokens.colorNeutralForeground2,
    lineHeight: "1.4",
  },
  checklist: {
    textAlign: "left",
    alignSelf: "stretch",
    marginBottom: "28px",
    padding: "16px",
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.borderRadius("var(--app-radius, 8px)"),
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  checklistTitle: {
    fontWeight: tokens.fontWeightSemibold,
    marginBottom: "8px",
    display: "block",
    color: tokens.colorNeutralForeground2,
  },
  checklistItem: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "6px",
    fontSize: "12px",
    color: tokens.colorNeutralForeground3,
    ":last-child": {
      marginBottom: 0,
    },
  },
  bullet: {
    width: "4px",
    height: "4px",
    ...shorthands.borderRadius("50%"),
    backgroundColor: tokens.colorNeutralForeground4,
    flexShrink: 0,
  },
  button: {
    width: "100%",
    maxWidth: "200px",
  },
});

export const OfflineView: React.FC = () => {
  const { t } = useTranslation();
  const styles = useStyles();
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = () => {
    setIsRetrying(true);
    setTimeout(() => {
      if (typeof navigator !== "undefined" && navigator.onLine) {
        window.location.reload();
      } else {
        setIsRetrying(false);
      }
    }, 1000);
  };

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <WifiWarning24Regular className={styles.icon} />
        <Title1 className={styles.title}>{t("offline.title")}</Title1>
        <Body1 className={styles.description}>
          {t("offline.description")}
        </Body1>
        
        <div className={styles.checklist}>
          <Caption1 className={styles.checklistTitle}>{t("offline.checkConnection")}</Caption1>
          <div className={styles.checklistItem}>
            <div className={styles.bullet} />
            <span>{t("offline.wifiMobile")}</span>
          </div>
          <div className={styles.checklistItem}>
            <div className={styles.bullet} />
            <span>{t("offline.airplaneMode")}</span>
          </div>
          <div className={styles.checklistItem}>
            <div className={styles.bullet} />
            <span>{t("offline.routerCable")}</span>
          </div>
        </div>

        <Button
          appearance="primary"
          className={styles.button}
          onClick={handleRetry}
          disabled={isRetrying}
        >
          {isRetrying ? t("app.loading") : t("offline.retry")}
        </Button>
      </div>
    </div>
  );
};
