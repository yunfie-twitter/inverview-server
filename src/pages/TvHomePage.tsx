import { Button, Text, makeStyles, tokens } from "@fluentui/react-components";
import { ArrowClockwise24Regular, Phone24Regular } from "@fluentui/react-icons";
import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { openExternalUrl } from "../lib/webPlatform";

const useStyles = makeStyles({
  root: {
    height: "100%",
    width: "100%",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 360px",
    gap: "56px",
    alignItems: "start",
    padding: "56px 56px 64px",
  },
  qrPanel: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "14px",
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: "22px",
    padding: "20px",
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  qrImage: {
    width: "300px",
    height: "300px",
    borderRadius: "12px",
    backgroundColor: "#ffffff",
  },
  qrPlaceholder: {
    width: "300px",
    height: "300px",
    borderRadius: "12px",
    backgroundColor: tokens.colorNeutralBackground3,
    border: `1px dashed ${tokens.colorNeutralStroke2}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: tokens.colorNeutralForeground3,
    fontSize: "14px",
    textAlign: "center",
    padding: "12px",
  },
  qrLabel: {
    color: tokens.colorNeutralForeground2,
    fontSize: "15px",
    textAlign: "center",
    wordBreak: "break-all",
  },
  content: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
    minWidth: 0,
    paddingTop: "8px",
  },
  title: {
    fontSize: "52px",
    lineHeight: "1.05",
    fontWeight: tokens.fontWeightBold,
  },
  lead: {
    fontSize: "20px",
    color: tokens.colorNeutralForeground2,
  },
  stepCard: {
    borderRadius: "18px",
    padding: "16px 18px",
    backgroundColor: tokens.colorNeutralBackground2,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  stepTitle: {
    fontSize: "22px",
    fontWeight: tokens.fontWeightSemibold,
  },
  stepBody: {
    marginTop: "6px",
    fontSize: "17px",
    color: tokens.colorNeutralForeground2,
  },
  actionRow: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    marginTop: "12px",
  },
  actionButton: {
    minHeight: "44px",
    fontSize: "16px",
    fontWeight: tokens.fontWeightSemibold,
  },
});

export const TvHomePage = (): JSX.Element => {
  const styles = useStyles();
  const navigate = useNavigate();
  const [sessionId, setSessionId] = useState("");
  const [lastCommandId, setLastCommandId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;
    const createSession = async () => {
      try {
        const response = await axios.post<{ sessionId: string }>("/tv-sync/session", undefined, {
          validateStatus: () => true,
        });
        if (response.status < 200 || response.status >= 300) throw new Error(`Failed: ${response.status}`);
        const data = response.data;
        if (!active) return;
        setSessionId(data.sessionId);
        setErrorMessage("");
      } catch (error) {
        if (!active) return;
        setErrorMessage("TVセッションの作成に失敗しました。server を起動してください。");
      }
    };
    void createSession();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    let active = true;
    const timer = window.setInterval(async () => {
      try {
        const response = await axios.get<{
          hasCommand: boolean;
          command?: { id: string; videoId: string };
        }>(`/tv-sync/session/${sessionId}/command`, {
          params: { after: lastCommandId },
          validateStatus: () => true,
        });
        if (response.status < 200 || response.status >= 300) return;
        const data = response.data;
        if (!active || !data.hasCommand || !data.command) return;
        setLastCommandId(data.command.id);
        navigate(
          `/tv/watch/${data.command.videoId}?autoplay=1&tvSession=${encodeURIComponent(sessionId)}&after=${encodeURIComponent(data.command.id)}`,
        );
      } catch {
        // ignore polling errors and keep waiting.
      }
    }, 2000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [sessionId, lastCommandId, navigate]);

  const senderUrl = useMemo(() => {
    if (typeof window === "undefined" || !sessionId) return "";
    return `${window.location.origin}/tv/sender?session=${encodeURIComponent(sessionId)}`;
  }, [sessionId]);
  const qrUrl = useMemo(() => {
    if (!senderUrl) return "";
    const encoded = encodeURIComponent(senderUrl);
    return `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encoded}`;
  }, [senderUrl]);

  return (
    <div className={styles.root}>
      <section className={styles.content}>
        <Text className={styles.title}>InverView</Text>
        <Text className={styles.lead}>
          QRコードを読み取ったデバイスで動画を選ぶと、このTVクライアントで直接再生します。
        </Text>

        <div className={styles.stepCard}>
          <Text className={styles.stepTitle}>1. スマホで動画を選ぶ</Text>
          <Text className={styles.stepBody}>
            QRコード先の画面で動画カードを選ぶと、その動画IDがTVセッションへ送信されます。
          </Text>
        </div>

        <div className={styles.stepCard}>
          <Text className={styles.stepTitle}>2. このTVを選択して再生</Text>
          <Text className={styles.stepBody}>
            この画面は2秒ごとに新しい指示を確認し、受信すると自動で再生ページへ遷移します。
          </Text>
        </div>

        <div className={styles.actionRow}>
          <Button
            className={styles.actionButton}
            icon={<Phone24Regular />}
            onClick={() => {
              if (!senderUrl) return;
              void openExternalUrl(senderUrl);
            }}
          >
            送信画面を開く
          </Button>
          <Button
            className={styles.actionButton}
            icon={<ArrowClockwise24Regular />}
            onClick={() => window.location.reload()}
          >
            画面を更新
          </Button>
        </div>
      </section>

      <section className={styles.qrPanel}>
        {qrUrl ? (
          <img className={styles.qrImage} src={qrUrl} alt="TV Cast Sender QR Code" />
        ) : (
          <div className={styles.qrPlaceholder}>セッション初期化中...</div>
        )}
        <Text className={styles.qrLabel}>
          {errorMessage
            ? errorMessage
            : senderUrl
              ? `スマホでQRを読み取り: ${senderUrl}`
              : "セッションを作成しています。"}
        </Text>
      </section>
    </div>
  );
};
