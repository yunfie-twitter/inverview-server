import { describe, expect, it } from "vitest";
import { mergeSettings } from "./storage";

describe("mergeSettings", () => {
  it("fills defaults for invalid values", () => {
    const result = mergeSettings({
      region: "",
      language: "",
      cardOpacity: 99,
      shadowStrength: -1,
    });

    expect(result.region).toBe("JP");
    expect(result.language).toBe("ja");
    expect(result.cardOpacity).toBe(1);
    expect(result.shadowStrength).toBe(0);
  });
});
