import {
  Text,
  makeStyles,
  tokens,
  Avatar,
  Button,
  Card,
} from "@fluentui/react-components";
import { useNavigate } from "react-router-dom";
import { formatNumberJa } from "../../lib/format";
import { useTranslation } from "react-i18next";

interface MobileChannelHeaderProps {
  authorId: string;
  author: string;
  avatarSrc: string;
  subCount?: number;
  secondaryActionLabel?: string;
  secondaryActionAppearance?: "primary" | "outline";
  onSecondaryActionClick?: () => void;
}

const useStyles = makeStyles({
  card: {
    padding: "8px 0",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    background: "transparent",
    backgroundColor: "transparent",
    border: "none",
    boxShadow: "none",
    ":hover": {
      background: "transparent",
      backgroundColor: "transparent",
    },
  },
  header: {
    display: "flex",
    gap: "12px",
    alignItems: "center",
  },
  info: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    minWidth: 0,
    flex: 1,
  },
  nameRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: "8px",
    width: "fit-content",
    maxWidth: "100%",
  },
  authorLink: {
    cursor: "pointer",
    display: "inline-block",
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    ":hover": {
      textDecorationLine: "underline",
    },
  },
  subscribeBtn: {
    flexShrink: 0,
  },
});

export const MobileChannelHeader = ({
  authorId,
  author,
  avatarSrc,
  subCount,
  secondaryActionLabel,
  secondaryActionAppearance = "primary",
  onSecondaryActionClick,
}: MobileChannelHeaderProps): JSX.Element => {
  const styles = useStyles();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const resolvedSecondaryActionLabel = secondaryActionLabel ?? t("mobile.videosList");
  return (
    <Card appearance="subtle" className={styles.card} style={{ padding: "8px", minHeight: "auto" }}>
      <div className={styles.header} style={{ display: "flex", alignItems: "center", justifyContent: "flex-start", gap: "12px", width: "100%" }}>
        <Avatar
          image={{ src: avatarSrc }}
          name={author}
          size={32}
          style={{ cursor: "pointer" }}
          onClick={() => navigate(`/channel/${authorId}`)}
        />
        <Text
          weight="bold"
          size={300}
          className={styles.authorLink}
          onClick={() => navigate(`/channel/${authorId}`)}
          style={{ fontSize: "14px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "160px" }}
        >
          {author}
        </Text>
        <Button
          onClick={() => {
            if (onSecondaryActionClick) {
              onSecondaryActionClick();
              return;
            }
            navigate(`/channel/${authorId}/videos`);
          }}
          size="small"
          appearance={secondaryActionAppearance}
          className={styles.subscribeBtn}
          style={{ height: "28px", minWidth: "auto", fontSize: "12px", padding: "0 12px" }}
        >
          {resolvedSecondaryActionLabel}
        </Button>
      </div>
    </Card>
  );
};
