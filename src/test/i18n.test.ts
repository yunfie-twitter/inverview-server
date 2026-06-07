import { describe, it, expect, beforeAll } from "vitest";
import i18n from "../i18n/index";

describe("i18n multi-language support", () => {
  beforeAll(async () => {
    // i18nの初期化を待つ（すでに初期化されている想定ですが一応）
    await i18n.init();
  });

  it("should translate to Japanese correctly", async () => {
    await i18n.changeLanguage("ja");
    expect(i18n.t("common.loadMore")).toBe("さらに読み込む");
    expect(i18n.t("settings.languageName")).toBe("日本語");
  });

  it("should translate to English correctly", async () => {
    await i18n.changeLanguage("en");
    expect(i18n.t("common.loadMore")).toBe("Load more");
    expect(i18n.t("settings.languageName")).toBe("English");
  });

  it("should translate to Korean correctly", async () => {
    await i18n.changeLanguage("ko");
    expect(i18n.t("common.loadMore")).toBe("더 보기");
    expect(i18n.t("settings.languageName")).toBe("한국어");
  });
});
