import { useEffect, useMemo, useRef, useState } from "react";
import {
  Input,
  makeStyles,
  tokens,
  type InputProps,
  Text,
  Spinner,
  shorthands,
} from "@fluentui/react-components";
import { Search20Regular, History20Regular, ArrowTrending20Regular } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getSearchSuggestions } from "../lib/invidiousClient";
import { queryKeys } from "../lib/queryKeys";
import { addRecentSearch, getRecentSearches } from "../lib/recentSearch";
import { withViewTransition } from "../lib/webPlatform";
import { useSettingsStore } from "../store/settingsStore";

const SUGGESTION_QUERY_GC_TIME_MS = 60_000;

interface SearchBarProps {
  initialQuery?: string;
}

const useStyles = makeStyles({
  container: {
    width: "100%",
    position: "relative",
  },
  input: {
    width: "100%",
    height: "40px",
  },
  dropdown: {
    position: "absolute",
    top: "46px",
    left: 0,
    right: 0,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow16,
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke1),
    borderRadius: "8px",
    zIndex: 100,
    maxHeight: "400px",
    overflowY: "auto",
    padding: "8px",
  },
  suggestionItem: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "8px 12px",
    borderRadius: "6px",
    cursor: "pointer",
    ":hover": {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
    ":active": {
      backgroundColor: tokens.colorNeutralBackground1Pressed,
    },
  },
  loadingRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px",
    color: tokens.colorNeutralForeground3,
    fontSize: "12px",
  },
});

export const SearchBar = ({ initialQuery = "" }: SearchBarProps): JSX.Element => {
  const styles = useStyles();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [q, setQ] = useState(initialQuery);
  const [isOpen, setIsOpen] = useState(false);
  const [debouncedQ, setDebouncedQ] = useState(initialQuery);
  const [recent, setRecent] = useState<string[]>([]);
  const showSearchSuggestions = useSettingsStore((state) => state.showSearchSuggestions);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setQ(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    if (isOpen) {
      setRecent(getRecentSearches());
    }
  }, [isOpen]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQ(q.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const suggestionQuery = useQuery({
    queryKey: queryKeys.suggestions(debouncedQ),
    queryFn: ({ signal }) => getSearchSuggestions(debouncedQ, signal),
    enabled: showSearchSuggestions && debouncedQ.length > 1,
    staleTime: 1000 * 45,
    gcTime: SUGGESTION_QUERY_GC_TIME_MS,
  });

  const suggestions = useMemo(() => {
    const data = suggestionQuery.data;
    if (!data) return [];
    if (Array.isArray(data)) return data;
    return data.suggestions ?? [];
  }, [suggestionQuery.data]);

  const submit = (value = q): void => {
    const query = value.trim();
    if (!query) return;
    addRecentSearch(query);
    setIsOpen(false);
    withViewTransition(() => navigate(`/search?q=${encodeURIComponent(query)}`));
  };

  const listItems = showSearchSuggestions && suggestions.length > 0 ? suggestions : recent;
  const isSuggestion = showSearchSuggestions && suggestions.length > 0;

  const onInputChange: InputProps["onChange"] = (_, data) => {
    setQ(data.value);
    setIsOpen(true);
  };

  const onKeyDown = (ev: React.KeyboardEvent<HTMLInputElement>) => {
    if (ev.key === "Enter") {
      submit();
    }
    if (ev.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={styles.container}>
      <Input
        className={styles.input}
        placeholder={t("searchBar.placeholder")}
        value={q}
        onChange={onInputChange}
        onFocus={() => setIsOpen(true)}
        onKeyDown={onKeyDown}
        contentBefore={<Search20Regular />}
        appearance="outline"
        type="search"
      />
      {isOpen && listItems.length > 0 && (
        <div className={styles.dropdown}>
          {listItems.map((item) => (
            <div
              key={item}
              className={styles.suggestionItem}
              onClick={() => {
                setQ(item);
                submit(item);
              }}
            >
              {isSuggestion ? <ArrowTrending20Regular style={{ color: tokens.colorNeutralForeground3 }} /> : <History20Regular style={{ color: tokens.colorNeutralForeground3 }} />}
              <Text size={200}>{item}</Text>
            </div>
          ))}
          {suggestionQuery.isFetching && (
            <div className={styles.loadingRow}>
              <Spinner size="tiny" />
              <Text>{t("searchBar.loadingSuggestions")}</Text>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
