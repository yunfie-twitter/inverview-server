export const isElectronRuntime = (): boolean => {
  if (typeof navigator !== "undefined" && /Electron/i.test(navigator.userAgent || "")) {
    return true;
  }

  const candidate = globalThis as {
    process?: {
      versions?: {
        electron?: string;
      };
    };
  };

  return Boolean(candidate.process?.versions?.electron);
};

export const isCapacitorRuntime = (): boolean => {
  const candidate = globalThis as {
    Capacitor?: {
      isNativePlatform?: () => boolean;
      platform?: string;
    };
  };

  if (typeof candidate.Capacitor?.isNativePlatform === "function") {
    return candidate.Capacitor.isNativePlatform();
  }

  return candidate.Capacitor?.platform === "ios" || candidate.Capacitor?.platform === "android";
};

export const isNativeAppRuntime = (): boolean => isElectronRuntime() || isCapacitorRuntime();
