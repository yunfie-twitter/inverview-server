import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// resources フォルダ内のすべての .json ファイルを動的にインポート
const modules = import.meta.glob<{ default: any }>("./resources/*.json", { eager: true });

// フラットなオブジェクト（例: { "common.loadMore": "..." }）を
// ネストされたオブジェクト（例: { common: { loadMore: "..." } }）に変換する関数
function unflatten(data: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const key in data) {
    const parts = key.split(".");
    let current = result;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i === parts.length - 1) {
        current[part] = data[key];
      } else {
        if (!current[part]) {
          current[part] = {};
        }
        if (typeof current[part] !== "object" || current[part] === null) {
          current[part] = {};
        }
        current = current[part];
      }
    }
  }
  return result;
}

const resources: Record<string, { translation: any }> = {};
const supportedLngs: string[] = [];

for (const path in modules) {
  const match = path.match(/\/([^/]+)\.json$/);
  if (match) {
    const lang = match[1];
    const module = modules[path];
    const translation = module.default;
    if (translation) {
      resources[lang] = { translation: unflatten(translation) };
      supportedLngs.push(lang);
    }
  }
}

void i18n.use(initReactI18next).init({
  resources,
  lng: "ja",
  supportedLngs,
  nonExplicitSupportedLngs: true,
  load: "languageOnly",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18n;
