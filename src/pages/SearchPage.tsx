import {
  makeStyles,
  tokens,
  Text,
  Button,
  Input,
  Checkbox,
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogContent,
  DialogBody,
  DialogActions,
  mergeClasses,
} from "@fluentui/react-components";
import { Filter24Regular } from "@fluentui/react-icons";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { EmptyState } from "../components/EmptyState";
import type { MobileFilterSheet, SearchFilterValues } from "../components/mobile/MobileFilterSheet";
import { QueryStateView } from "../components/QueryStateView";
import { VideoGrid } from "../components/VideoGrid";
import { searchVideos, type SearchVideosParams } from "../lib/invidiousClient";
import { queryKeys } from "../lib/queryKeys";
import { addRecentSearch } from "../lib/recentSearch";
import { useSettingsStore } from "../store/settingsStore";
import { useEffect, useMemo, useState } from "react";
import { LabeledCombobox, type SelectOption } from "../components/LabeledCombobox";
import { getStorageString, removeStorageValue } from "../lib/browserStorage";

const featureOptions = ["hd", "subtitles", "4k", "live", "360", "hdr", "vr180"] as const;
const typeOptions: SelectOption[] = [
  { value: "all", label: "all" },
  { value: "video", label: "video" },
  { value: "playlist", label: "playlist" },
  { value: "channel", label: "channel" },
];
const sortOptions: SelectOption[] = [
  { value: "relevance", label: "relevance" },
  { value: "views", label: "views" },
];
const durationOptions: SelectOption[] = [
  { value: "", label: "all" },
  { value: "short", label: "short" },
  { value: "medium", label: "medium" },
  { value: "long", label: "long" },
];
const regionOptions: SelectOption[] = ["JP", "US", "KR", "TW", "DE"].map((r) => ({ value: r, label: r }));

const buildFiltersFromQuery = (query: URLSearchParams, fallbackRegion: string): SearchFilterValues => ({
  type: (query.get("type") as SearchFilterValues["type"]) || "all",
  sortBy: (query.get("sort") as SearchFilterValues["sortBy"]) || "relevance",
  duration: (query.get("duration") as SearchFilterValues["duration"]) || "",
  features: (query.get("features") || "").split(",").filter(Boolean),
  region: query.get("region") || fallbackRegion,
});

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  suppressSecondaryMotion: {
    animation: "none !important",
    transition: "none !important",
  },
  searchForm: {
    display: "flex",
    gap: "8px",
    alignItems: "stretch",
  },
  dialogContent: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    paddingTop: "16px",
    paddingBottom: "16px",
  },
  filterGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
  },
  filterField: {
    minWidth: 0,
  },
  filterSection: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginTop: "8px",
  },
  featuresRow: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
  },
});

export const SearchPage = (): JSX.Element => {
  const styles = useStyles();
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const defaultRegion = useSettingsStore((state) => state.region);
  const [inputValue, setInputValue] = useState(q);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [suppressSecondaryMotion, setSuppressSecondaryMotion] = useState(false);

  const filters = useMemo(() => buildFiltersFromQuery(searchParams, defaultRegion), [searchParams, defaultRegion]);

  useEffect(() => {
    const suppress = getStorageString("session", "inverview:suppress-next-page-secondary-animation") === "1";
    if (!suppress) return;
    removeStorageValue("session", "inverview:suppress-next-page-secondary-animation");
    setSuppressSecondaryMotion(true);
    const timerId = window.setTimeout(() => setSuppressSecondaryMotion(false), 450);
    return () => window.clearTimeout(timerId);
  }, []);

  useEffect(() => {
    setInputValue(q);
  }, [q]);

  const applyFilters = (next: SearchFilterValues): void => {
    setSearchParams((prev) => {
      const updated = new URLSearchParams(prev);
      updated.set("type", next.type);
      updated.set("sort", next.sortBy);
      if (next.duration) updated.set("duration", next.duration);
      else updated.delete("duration");
      if (next.features.length) updated.set("features", next.features.join(","));
      else updated.delete("features");
      if (next.region) updated.set("region", next.region);
      else updated.delete("region");
      return updated;
    });
  };

  const resetFilters = (): void => {
    applyFilters({
      type: "all",
      sortBy: "relevance",
      duration: "",
      features: [],
      region: defaultRegion || "JP",
    });
  };

  const params: SearchVideosParams | null = useMemo(() => {
    if (!q.trim()) return null;
    return {
      q,
      type: filters.type,
      sort_by: filters.sortBy,
      duration: filters.duration || undefined,
      features: filters.features as SearchVideosParams["features"],
      region: filters.region,
    };
  }, [q, filters]);

  const searchQuery = useQuery({
    queryKey: queryKeys.search(
      [
        params?.q ?? "",
        params?.type ?? "all",
        params?.sort_by ?? "relevance",
        params?.duration ?? "",
        params?.features?.join(",") ?? "",
        params?.region ?? "",
      ].join("|"),
    ),
    queryFn: ({ signal }) => searchVideos(params!, signal),
    enabled: !!params,
    placeholderData: keepPreviousData,
  });

  const orderedSearchResults = useMemo(() => {
    const items = searchQuery.data;
    if (!Array.isArray(items)) return [];
    
    const firstChannelIndex = items.findIndex((item) => item && item.type === "channel");
    if (firstChannelIndex <= 0) return items;

    const firstChannel = items[firstChannelIndex];
    return [firstChannel, ...items.slice(0, firstChannelIndex), ...items.slice(firstChannelIndex + 1)];
  }, [searchQuery.data]);

  const onFeatureChange = (feature: string, checked: boolean) => {
    const nextFeatures = checked
      ? [...filters.features, feature]
      : filters.features.filter((f) => f !== feature);
    applyFilters({ ...filters, features: nextFeatures });
  };

  return (
    <div className={mergeClasses(styles.container, suppressSecondaryMotion && styles.suppressSecondaryMotion)}>

      <form
        className={styles.searchForm}
        onSubmit={(event) => {
          event.preventDefault();
          addRecentSearch(inputValue);
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set("q", inputValue);
            return next;
          });
        }}
      >
        <Input
          style={{ flexGrow: 1 }}
          value={inputValue}
          onChange={(e, data) => setInputValue(data.value)}
          placeholder={t("search.keywordPlaceholder")}
          appearance="outline"
        />
        <Button type="submit" appearance="primary">
          {t("search.title")}
        </Button>
        <Button
          icon={<Filter24Regular />}
          onClick={() => setIsFilterOpen(true)}
          aria-label={t("search.filterLabel")}
        />
      </form>

      <Dialog open={isFilterOpen} onOpenChange={(e, data) => setIsFilterOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{t("search.filterLabel")}</DialogTitle>
            <DialogContent className={styles.dialogContent}>
              <div className={styles.filterGrid}>
                <div className={styles.filterField}>
                  <LabeledCombobox
                    label={t("search.type")}
                    value={filters.type}
                    options={typeOptions}
                    onChange={(value) => applyFilters({ ...filters, type: value as SearchFilterValues["type"] })}
                  />
                </div>

                <div className={styles.filterField}>
                  <LabeledCombobox
                    label={t("search.sortBy")}
                    value={filters.sortBy}
                    options={sortOptions}
                    onChange={(value) => applyFilters({ ...filters, sortBy: value as SearchFilterValues["sortBy"] })}
                  />
                </div>

                <div className={styles.filterField}>
                  <LabeledCombobox
                    label={t("search.duration")}
                    value={filters.duration}
                    options={durationOptions}
                    onChange={(value) => applyFilters({ ...filters, duration: value as SearchFilterValues["duration"] })}
                  />
                </div>

                <div className={styles.filterField}>
                  <LabeledCombobox
                    label={t("search.region")}
                    value={filters.region}
                    options={regionOptions}
                    onChange={(value) => applyFilters({ ...filters, region: value })}
                  />
                </div>
              </div>

              <div className={styles.filterSection}>
                <Text size={200} style={{ color: tokens.colorNeutralForeground3, fontWeight: tokens.fontWeightSemibold }}>
                  {t("search.features")}
                </Text>
                <div className={styles.featuresRow}>
                  {featureOptions.map((feature) => (
                    <Checkbox
                      key={feature}
                      label={feature}
                      checked={filters.features.includes(feature)}
                      onChange={(e, data) => onFeatureChange(feature, !!data.checked)}
                    />
                  ))}
                </div>
              </div>
            </DialogContent>

            <DialogActions>
              <Button appearance="outline" onClick={resetFilters}>
                {t("search.reset")}
              </Button>
              <Button appearance="primary" onClick={() => setIsFilterOpen(false)}>
                {t("app.close") || "Close"}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      {!q ? <EmptyState title={t("search.enterKeywordTitle")} description={t("search.enterKeywordDescription")} /> : null}
      {q ? (
        <QueryStateView
          isLoading={searchQuery.isLoading}
          isError={searchQuery.isError || (!!searchQuery.data && (!Array.isArray(searchQuery.data) || "error" in (searchQuery.data as any)))}
          isEmpty={!Array.isArray(searchQuery.data) || searchQuery.data.length === 0}
          errorTitle={t("search.fetchErrorTitle")}
          errorMessage={(searchQuery.data as any)?.error || t("search.fetchErrorMessage")}
          emptyTitle={t("search.emptyTitle")}
          emptyDescription={t("search.emptyDescription")}
          onRetry={() => void searchQuery.refetch()}
        >
          <VideoGrid items={orderedSearchResults} />
        </QueryStateView>
      ) : null}
    </div>
  );
};
