import { format as formatDateFns, formatDistanceToNowStrict } from "date-fns";
import { enUS, ja } from "date-fns/locale";
import { getSettingsSnapshot } from "../settings/storage";
import i18n from "../i18n";
import { unixSecondsToDate } from "./time";

const isJapanese = (): boolean => getSettingsSnapshot().language?.startsWith("ja") ?? true;

const getNumberLocale = (): string => (isJapanese() ? "ja-JP" : "en-US");
const getDateFnsLocale = () => (isJapanese() ? ja : enUS);

export const formatDuration = (seconds?: number): string => {
  if (!seconds || Number.isNaN(seconds)) return "--:--";

  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }

  return `${m}:${s.toString().padStart(2, "0")}`;
};

export const formatViewCountJa = (viewCount?: number, fallbackText?: string): string => {
  if (fallbackText) return fallbackText;
  if (typeof viewCount !== "number") return i18n.t("format.unknownViews");
  return i18n.t("format.viewsCount", { count: new Intl.NumberFormat(getNumberLocale()).format(viewCount) });
};

export const formatNumberJa = (value?: number): string => {
  if (typeof value !== "number") return "-";
  return new Intl.NumberFormat(getNumberLocale()).format(value);
};

export const formatRelativeDateJa = (unixSeconds?: number, fallbackText?: string): string => {
  if (fallbackText) return fallbackText;
  if (!unixSeconds) return i18n.t("common.unknownDate");
  return formatDistanceToNowStrict(unixSecondsToDate(unixSeconds), {
    addSuffix: true,
    locale: getDateFnsLocale(),
  });
};

export const formatDateJa = (unixSeconds?: number): string => {
  if (!unixSeconds) return i18n.t("common.unknownDate");
  return formatDateFns(unixSecondsToDate(unixSeconds), isJapanese() ? "PPP" : "PP", {
    locale: getDateFnsLocale(),
  });
};
