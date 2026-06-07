import React from "react";
import {
  makeStyles,
  Button,
  MessageBar,
  MessageBarTitle,
  MessageBarBody,
} from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import { StateCard } from "./StateCard";

interface ErrorStateProps {
  title?: string;
  message: React.ReactNode;
  onRetry?: () => void;
}

const useStyles = makeStyles({
  retryBtn: {
    width: "fit-content",
  },
});

export const ErrorState = ({ title, message, onRetry }: ErrorStateProps): JSX.Element => {
  const styles = useStyles();
  const { t } = useTranslation();
  return (
    <StateCard>
      <MessageBar intent="error">
        <MessageBarBody>
          <MessageBarTitle>{title ?? t("app.renderErrorTitle")}</MessageBarTitle>
          {message}
        </MessageBarBody>
      </MessageBar>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {onRetry && (
          <Button
            appearance="primary"
            onClick={onRetry}
            className={styles.retryBtn}
          >
            {t("common.retry")}
          </Button>
        )}
      </div>
    </StateCard>
  );
};
