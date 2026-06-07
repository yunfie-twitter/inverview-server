import {
  Text,
  makeStyles,
  tokens,
  Avatar,
  Card,
  Button,
  mergeClasses,
} from "@fluentui/react-components";
import { useState, useRef, useEffect, type MouseEvent } from "react";
import DOMPurify from "dompurify";
import { useNavigate } from "react-router-dom";
import { formatNumberJa, formatRelativeDateJa } from "../lib/format";
import { pickBestThumbnail, resolveMediaUrl } from "../lib/media";
import { useSettingsStore } from "../store/settingsStore";
import type { CommentObject } from "../types/invidious";
import { useTranslation } from "react-i18next";

interface CommentCardProps {
  comment: CommentObject;
  onTimestampClick?: (seconds: number) => void;
}

const parseTimeTokenToSeconds = (value: string): number | null => {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;

  const colonParts = trimmed.split(":").map((item) => Number.parseInt(item, 10));
  if (colonParts.every(Number.isFinite)) {
    if (colonParts.length === 3) return colonParts[0] * 3600 + colonParts[1] * 60 + colonParts[2];
    if (colonParts.length === 2) return colonParts[0] * 60 + colonParts[1];
    if (colonParts.length === 1) return colonParts[0];
  }

  const hmsMatch = trimmed.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!hmsMatch) return null;
  const hours = Number.parseInt(hmsMatch[1] || "0", 10);
  const minutes = Number.parseInt(hmsMatch[2] || "0", 10);
  const seconds = Number.parseInt(hmsMatch[3] || "0", 10);
  const total = hours * 3600 + minutes * 60 + seconds;
  return total > 0 ? total : null;
};

const parseTimestampFromAnchor = (anchor: HTMLAnchorElement): number | null => {
  const href = anchor.getAttribute("href") || "";
  const query = href.startsWith("?") ? href.slice(1) : href.split("?")[1] || "";
  const params = new URLSearchParams(query);
  const t = params.get("t") || params.get("time_continue") || params.get("start");
  if (t) {
    const parsed = parseTimeTokenToSeconds(t);
    if (parsed !== null) return parsed;
  }

  const hashMatch = href.match(/#t=([^&]+)/i);
  if (hashMatch?.[1]) {
    const parsed = parseTimeTokenToSeconds(hashMatch[1]);
    if (parsed !== null) return parsed;
  }

  const textParsed = parseTimeTokenToSeconds(anchor.textContent || "");
  if (textParsed !== null) return textParsed;
  return null;
};

const useStyles = makeStyles({
  card: {
    padding: "12px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  content: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    flexGrow: 1,
    minWidth: 0,
  },
  header: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  authorRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    minWidth: 0,
  },
  avatar: {
    flexShrink: 0,
  },
  subRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    minWidth: 0,
  },
  author: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: "14px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    cursor: "pointer",
    ":hover": {
      textDecorationLine: "underline",
    },
  },
  metadata: {
    color: tokens.colorNeutralForeground3,
    fontSize: "12px",
  },
  pinned: {
    color: tokens.colorNeutralForegroundOnBrand,
    backgroundColor: tokens.colorBrandBackground2,
    borderRadius: "999px",
    padding: "1px 8px",
    fontSize: "12px",
    lineHeight: "18px",
  },
  commentText: {
    fontSize: "15px",
    lineHeight: "1.6",
    color: tokens.colorNeutralForeground1,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    "& a": {
      color: tokens.colorBrandForeground1,
      textDecorationLine: "none",
      ":hover": {
        textDecorationLine: "underline",
      },
    },
  },
  commentTextTruncated: {
    maxHeight: "120px",
    display: "-webkit-box",
    "-webkit-line-clamp": "5",
    "-webkit-box-orient": "vertical",
    overflow: "hidden",
  },
  expandButton: {
    alignSelf: "flex-start",
    padding: "0",
    minWidth: "auto",
    height: "auto",
    marginTop: "4px",
    fontSize: "13px",
  },
  footer: {
    marginTop: "4px",
    color: tokens.colorNeutralForeground3,
    fontSize: "12px",
  },
});

export const CommentCard = ({ comment, onTimestampClick }: CommentCardProps): JSX.Element => {
  const styles = useStyles();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const baseUrl = useSettingsStore((state) => state.apiBaseUrl);
  const image = pickBestThumbnail(comment.authorThumbnails?.map((item) => ({ ...item, quality: "author" })));
  const authorId = comment.authorId || comment.authorUrl?.split("/channel/")[1]?.split("/")[0] || null;
  const handleAuthorNavigate = (): void => {
    if (!authorId) return;
    navigate(`/channel/${authorId}`);
  };
  
  const [isExpanded, setIsExpanded] = useState(false);
  const [showExpand, setShowExpand] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (textRef.current) {
      const isLong = textRef.current.scrollHeight > 125; // roughly 5 lines
      setShowExpand(isLong);
    }
  }, [comment.content, comment.contentHtml]);

  const handleCommentClick = (event: MouseEvent<HTMLDivElement>): void => {
    if (!onTimestampClick) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest("a");
    if (!(anchor instanceof HTMLAnchorElement)) return;
    const seconds = parseTimestampFromAnchor(anchor);
    if (seconds === null) return;
    event.preventDefault();
    event.stopPropagation();
    onTimestampClick(seconds);
  };

  return (
    <Card appearance="outline" className={styles.card}>
      <div className={styles.content}>
        <div className={styles.header}>
          <div className={styles.authorRow}>
            <Avatar
              className={styles.avatar}
              image={{ src: resolveMediaUrl(image?.url, baseUrl) }}
              name={comment.author}
              size={28}
              onClick={handleAuthorNavigate}
            />
            <Text className={styles.author} onClick={handleAuthorNavigate}>{comment.author}</Text>
            {comment.isPinned && (
              <Text className={styles.pinned}>{t("comments.pinned")}</Text>
            )}
          </div>
          <div className={styles.subRow}>
            <Text className={styles.metadata}>
              {formatRelativeDateJa(comment.published, comment.publishedText)}
            </Text>
          </div>
        </div>
        <div
          ref={textRef}
          className={mergeClasses(styles.commentText, !isExpanded && showExpand ? styles.commentTextTruncated : undefined)}
          onClick={handleCommentClick}
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(comment.contentHtml || comment.content) }}
        />
        {showExpand && (
          <Button
            appearance="subtle"
            className={styles.expandButton}
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? t("comments.showLess") : t("comments.showMore")}
          </Button>
        )}
        <div className={styles.footer}>
          {t("comments.likes", { count: formatNumberJa(comment.likeCount) })}
        </div>
      </div>
    </Card>
  );
};
