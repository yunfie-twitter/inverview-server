import { Button, Text, makeStyles, tokens } from "@fluentui/react-components";
import { ArrowRight24Regular } from "@fluentui/react-icons";
import { useEffect } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { setTvSessionId } from "../lib/tvSync";

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    gap: "18px",
    maxWidth: "740px",
    margin: "0 auto",
    padding: "32px 18px",
  },
  title: {
    fontSize: "30px",
    lineHeight: "1.2",
    fontWeight: tokens.fontWeightBold,
  },
  body: {
    fontSize: "16px",
    color: tokens.colorNeutralForeground2,
  },
  card: {
    borderRadius: "14px",
    backgroundColor: tokens.colorNeutralBackground2,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    padding: "14px",
  },
});

export const TvSenderPage = (): JSX.Element => {
  const styles = useStyles();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session") || "";

  useEffect(() => {
    if (!sessionId) return;
    setTvSessionId(sessionId);
  }, [sessionId]);

  if (!sessionId) {
    return <Navigate to="/tv" replace />;
  }

  return (
    <div className={styles.root}>
      <Text className={styles.title}>TV送信モード</Text>
      <Text className={styles.body}>
        これ以降、動画カードを選ぶとTVへ再生指示を送ります。視聴端末では再生せず送信のみ行います。
      </Text>
      <div className={styles.card}>
        <Text className={styles.body}>セッションID: {sessionId}</Text>
      </div>
      <Button
        icon={<ArrowRight24Regular />}
        onClick={() => {
          navigate(`/?tvSession=${encodeURIComponent(sessionId)}`);
        }}
      >
        動画を選びに進む
      </Button>
    </div>
  );
};
