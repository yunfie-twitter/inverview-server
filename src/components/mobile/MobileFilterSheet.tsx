import {
  Button,
  Checkbox,
  Drawer,
  DrawerBody,
  DrawerFooter,
  DrawerHeader,
  DrawerHeaderTitle,
  makeStyles,
} from "@fluentui/react-components";
import { Dismiss24Regular } from "@fluentui/react-icons";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LabeledSelect } from "../LabeledSelect";
import type { SelectOption } from "../LabeledCombobox";

export interface SearchFilterValues {
  type: "all" | "video" | "playlist" | "channel";
  sortBy: "relevance" | "views";
  duration: "" | "short" | "medium" | "long";
  features: string[];
  region: string;
}

interface MobileFilterSheetProps {
  isOpen: boolean;
  onClose: () => void;
  value: SearchFilterValues;
  onApply: (value: SearchFilterValues) => void;
  onReset: () => void;
}

const featureOptions = ["hd", "subtitles", "4k", "live", "360", "hdr", "vr180"];
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
  { value: "", label: "duration: all" },
  { value: "short", label: "short" },
  { value: "medium", label: "medium" },
  { value: "long", label: "long" },
];
const regionOptions: SelectOption[] = ["JP", "US", "KR", "TW", "DE"].map((r) => ({ value: r, label: r }));

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "12px",
  },
  featureLabel: {
    fontSize: "14px",
    marginBottom: "4px",
  },
  featureRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  footer: {
    display: "flex",
    gap: "12px",
    width: "100%",
    paddingBottom: "calc(16px + env(safe-area-inset-bottom))",
  },
  footerBtn: {
    flexGrow: 1,
  },
});

export const MobileFilterSheet = ({ isOpen, onClose, value, onApply, onReset }: MobileFilterSheetProps): JSX.Element => {
  const styles = useStyles();
  const { t } = useTranslation();
  const [draft, setDraft] = useState<SearchFilterValues>(value);

  useEffect(() => {
    if (isOpen) {
      setDraft(value);
    }
  }, [isOpen, value]);

  const handleFeatureChange = (feature: string, checked: boolean): void => {
    setDraft((prev) => {
      const next = checked
        ? [...prev.features, feature]
        : prev.features.filter((f) => f !== feature);
      return { ...prev, features: next };
    });
  };

  return (
    <Drawer position="bottom" open={isOpen} onOpenChange={(_, data) => !data.open && onClose()}>
      <DrawerHeader>
        <DrawerHeaderTitle
          action={
            <Button
              appearance="subtle"
              aria-label={t("mobile.close")}
              icon={<Dismiss24Regular />}
              onClick={onClose}
            />
          }
        >
          {t("mobile.searchFilters")}
        </DrawerHeaderTitle>
      </DrawerHeader>
      <DrawerBody>
        <div className={styles.container}>
          <div className={styles.grid}>
            <LabeledSelect
              label={t("search.type")}
              value={draft.type}
              options={typeOptions}
              onChange={(value) => setDraft((prev) => ({ ...prev, type: value as SearchFilterValues["type"] }))}
            />
            <LabeledSelect
              label={t("search.sortBy")}
              value={draft.sortBy}
              options={sortOptions}
              onChange={(value) => setDraft((prev) => ({ ...prev, sortBy: value as SearchFilterValues["sortBy"] }))}
            />
            <LabeledSelect
              label={t("search.duration")}
              value={draft.duration}
              options={durationOptions}
              onChange={(value) => setDraft((prev) => ({ ...prev, duration: value as SearchFilterValues["duration"] }))}
            />
            <LabeledSelect
              label={t("search.region")}
              value={draft.region}
              options={regionOptions}
              onChange={(value) => setDraft((prev) => ({ ...prev, region: value }))}
            />
          </div>
          <div>
            <div className={styles.featureLabel}>{t("search.features")}</div>
            <div className={styles.featureRow}>
              {featureOptions.map((feature) => (
                <Checkbox
                  key={feature}
                  label={feature}
                  checked={draft.features.includes(feature)}
                  onChange={(_, data) => handleFeatureChange(feature, !!data.checked)}
                />
              ))}
            </div>
          </div>
        </div>
      </DrawerBody>
      <DrawerFooter>
        <div className={styles.footer}>
          <Button
            appearance="outline"
            className={styles.footerBtn}
            onClick={() => {
              onReset();
              onClose();
            }}
          >
            {t("search.reset")}
          </Button>
          <Button
            appearance="primary"
            className={styles.footerBtn}
            onClick={() => {
              onApply(draft);
              onClose();
            }}
          >
            {t("mobile.apply")}
          </Button>
        </div>
      </DrawerFooter>
    </Drawer>
  );
};
