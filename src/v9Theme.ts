import { type Theme, webLightTheme, webDarkTheme } from "@fluentui/react-components";

// color.csv から抽出された主要なトークンを定義
// 全てのトークンを網羅すると巨大になるため、UIの整合性に重要なものを優先

const customV9LightTheme: Theme = {
  ...webLightTheme,
  colorNeutralForeground1: "#242424",
  colorNeutralBackground1: "#ffffff",
  colorNeutralBackground2: "#fafafa",
  colorNeutralBackground3: "#f5f5f5",
  // 他のトークンも必要に応じて追加
};

const customV9DarkTheme: Theme = {
  ...webDarkTheme,
  colorNeutralForeground1: "#ffffff",
  colorNeutralBackground1: "#292929",
  colorNeutralBackground2: "#1f1f1f",
  colorNeutralBackground3: "#141414",
};

const customV9AmoledTheme: Theme = {
  ...webDarkTheme,
  colorNeutralForeground1: "#ffffff",
  colorNeutralForeground2: "#d4d4d4",
  colorNeutralForeground3: "#a0a0a0",
  colorNeutralBackground1: "#000000",
  colorNeutralBackground2: "#050505",
  colorNeutralBackground3: "#0a0a0a",
  colorNeutralBackground4: "#101010",
};

export const createCustomV9Theme = (isDark: boolean, accentColor: string, isAmoled = false): Theme => ({
  ...(isAmoled ? customV9AmoledTheme : (isDark ? customV9DarkTheme : customV9LightTheme)),
  colorBrandForeground1: accentColor,
  colorBrandForeground2: accentColor,
  colorBrandBackground: accentColor,
  colorBrandBackground2: accentColor,
  colorCompoundBrandForeground1: accentColor,
});
