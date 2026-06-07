import type { AccentColor } from "./settings/types";

export const DEFAULT_ACCENT_COLOR = "#2A8CFF";

const accentColorMap: Record<Exclude<AccentColor, "custom">, string> = {
  blue: "#2A8CFF",
  red: "#EF4444",
  purple: "#8B5CF6",
  green: "#16A34A",
  orange: "#EA580C",
  pink: "#EC4899",
};

export const resolveAccentColor = (
  accentColor: AccentColor,
  customAccentColor: string,
): string => {
  if (accentColor === "custom") {
    return customAccentColor || DEFAULT_ACCENT_COLOR;
  }
  return accentColorMap[accentColor] || DEFAULT_ACCENT_COLOR;
};
