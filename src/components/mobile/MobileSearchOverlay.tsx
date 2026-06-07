import {
  Dialog,
  DialogSurface,
  DialogBody,
  DialogContent,
  Input,
  Button,
  Text,
  Spinner,
  makeStyles,
  tokens,
  shorthands,
  mergeClasses,
} from "@fluentui/react-components";
import { Dismiss24Regular, Search24Regular } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getSearchSuggestions } from "../../lib/invidiousClient";
import { queryKeys } from "../../lib/queryKeys";
import { addRecentSearch, getRecentSearches } from "../../lib/recentSearch";
import { useSettingsStore } from "../../store/settingsStore";
import { useTranslation } from "react-i18next";

const SUGGESTION_QUERY_GC_TIME_MS = 60_000;

interface MobileSearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

const useStyles = makeStyles({
  surface: {
    height: "100%",
    width: "100%",
    maxWidth: "100%",
    maxHeight: "100%",
    ...shorthands.margin(0),
    ...shorthands.padding(0),
    borderRadius: 0,
    display: "flex",
    flexDirection: "column",
    willChange: "transform, opacity",
    animationName: {
      from: {
        transform: "translate3d(0, 100%, 0)",
      },
      to: {
        transform: "translate3d(0, 0, 0)",
      },
    },
    animationDuration: "220ms",
    animationTimingFunction: "cubic-bezier(0.32, 0.94, 0.6, 1)",
    animationFillMode: "both",
  },
  surfaceExiting: {
    animationName: {
      from: {
        transform: "translate3d(0, 0, 0)",
      },
      to: {
        transform: "translate3d(0, 100%, 0)",
      },
    },
    animationDuration: "220ms",
    animationTimingFunction: "cubic-bezier(0.3, 0.06, 0.15, 1)",
    animationFillMode: "both",
  },
  header: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    padding: "8px",
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  form: {
    flexGrow: 1,
    display: "flex",
    gap: "8px",
    alignItems: "center",
  },
  input: {
    flexGrow: 1,
  },
  body: {
    flexGrow: 1,
    padding: "16px",
    paddingBottom: "calc(88px + env(safe-area-inset-bottom))",
    overflowY: "auto",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  listItem: {
    padding: "12px",
    borderRadius: "8px",
    cursor: "pointer",
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke1),
    ":active": {
      backgroundColor: tokens.colorNeutralBackground1Pressed,
    },
  },
  loading: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    color: tokens.colorNeutralForeground3,
    fontSize: "14px",
    marginBottom: "12px",
  },
});

export const MobileSearchOverlay = ({ isOpen, onClose }: MobileSearchOverlayProps): JSX.Element => {
  const styles = useStyles();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { search } = useLocation();
  const currentQ = useMemo(() => new URLSearchParams(search).get("q") ?? "", [search]);
  const [q, setQ] = useState(currentQ);
  const [debouncedQ, setDebouncedQ] = useState(currentQ);
  const [recent, setRecent] = useState<string[]>([]);
  const showSearchSuggestions = useSettingsStore((state) => state.showSearchSuggestions);
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsExiting(false);
    } else {
      setIsExiting(true);
      const timer = setTimeout(() => {
        setShouldRender(false);
        setIsExiting(false);
      }, 220);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleClose = (): void => {
    if (isExiting) return;

    // 1. まず退場アニメーションを開始！
    setIsExiting(true);

    // 2. アニメーション完了後に安全にクローズ処理を実行！
    setTimeout(() => {
      if (window.history.state?.mobileSearch) {
        window.history.back();
      } else {
        onClose();
      }
    }, 220);
  };

  useEffect(() => {
    if (isOpen) {
      setQ(currentQ);
      setDebouncedQ(currentQ);
      setRecent(getRecentSearches());
    }
  }, [isOpen, currentQ]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const state = { mobileSearch: true };
    window.history.pushState(state, "");
    
    const handlePopState = (): void => {
      // 物理戻るボタン時も確実に退場アニメーションを再生！
      setIsExiting(true);
      setTimeout(() => {
        onClose();
      }, 220);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [isOpen, onClose]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQ(q.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [q]);

  const suggestionsQuery = useQuery({
    queryKey: queryKeys.suggestions(debouncedQ),
    queryFn: ({ signal }) => getSearchSuggestions(debouncedQ, signal),
    enabled: isOpen && showSearchSuggestions && debouncedQ.length > 1,
    staleTime: 1000 * 45,
    gcTime: SUGGESTION_QUERY_GC_TIME_MS,
  });

  const suggestions = useMemo(() => {
    const data = suggestionsQuery.data;
    if (!data) return [];
    if (Array.isArray(data)) return data;
    return data.suggestions ?? [];
  }, [suggestionsQuery.data]);

  const submit = (value?: string): void => {
    const text = (value ?? q).trim();
    if (!text) return;

    if (typeof window !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate(12);
      } catch {
        // Ignore browser security restrictions
      }
    }

    addRecentSearch(text);
    onClose();
    navigate(`/search?q=${encodeURIComponent(text)}`);
  };

  const listItems = showSearchSuggestions && suggestions.length > 0 ? suggestions : recent;

  return (
    <Dialog open={shouldRender} onOpenChange={(_, data) => !data.open && handleClose()}>
      <DialogSurface
        className={mergeClasses(styles.surface, isExiting && styles.surfaceExiting)}
        data-mobile-search-surface="true"
      >
        <div className={styles.header}>
          <Button
            appearance="subtle"
            icon={<Dismiss24Regular />}
            onClick={handleClose}
            aria-label={t("mobile.close")}
          />
          <form
            className={styles.form}
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <Input
              autoFocus
              className={styles.input}
              value={q}
              placeholder={t("search.keywordPlaceholder")}
              onChange={(e) => setQ(e.target.value)}
              appearance="outline"
            />
            <Button
              type="submit"
              appearance="primary"
              icon={<Search24Regular />}
              aria-label={t("mobile.search")}
            />
          </form>
        </div>
        <DialogBody className={styles.body}>
          <DialogContent>
            {suggestionsQuery.isFetching && (
              <div className={styles.loading}>
                <Spinner size="tiny" />
                <Text>{t("mobile.loadingSuggestions")}</Text>
              </div>
            )}
            <div className={styles.list}>
              {listItems.map((item) => (
                <div
                  key={item}
                  className={styles.listItem}
                  onClick={() => submit(item)}
                >
                  <Text>{item}</Text>
                </div>
              ))}
            </div>
            {!suggestionsQuery.isFetching && listItems.length === 0 && q.trim().length > 0 && (
              <div style={{ marginTop: "12px", color: tokens.colorNeutralForeground3, fontSize: "14px" }}>
                {t("mobile.enterToSearch", { query: q.trim() })}
              </div>
            )}
          </DialogContent>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};
