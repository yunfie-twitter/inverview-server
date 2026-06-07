import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "xyz.tsub4sa.invidiousclient",
  appName: "Invidious React Client",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
};

export default config;

