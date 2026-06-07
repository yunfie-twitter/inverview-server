import { isCapacitorRuntime } from "./runtimeEnv";
import { dateFromNow } from "./time";

const BG_NOTIFICATION_ID = 91001;

export const initCapacitorSpecial = async (): Promise<void> => {
  if (!isCapacitorRuntime()) return;

  try {
    const [{ Device }, { LocalNotifications }, { StatusBar, Style }] = await Promise.all([
      import("@capacitor/device"),
      import("@capacitor/local-notifications"),
      import("@capacitor/status-bar"),
    ]);

    const info = await Device.getInfo();
    const root = document.documentElement;
    root.dataset.nativePlatform = info.platform || "unknown";
    root.dataset.nativeModel = info.model || "unknown";
    root.dataset.nativeOsVersion = info.osVersion || "unknown";

    await StatusBar.setOverlaysWebView({ overlay: false });
    await StatusBar.setStyle({ style: Style.Light });

    await LocalNotifications.requestPermissions();
  } catch {
    // Best-effort initialization for optional native capabilities.
  }
};

export const setPrivacyScreenEnabled = async (enabled: boolean): Promise<void> => {
  if (!isCapacitorRuntime()) return;
  try {
    const { PrivacyScreen } = await import("@capacitor/privacy-screen");
    if (enabled) {
      await PrivacyScreen.enable();
      return;
    }
    await PrivacyScreen.disable();
  } catch {
    // no-op
  }
};

export const openExternalInCapacitor = async (url: string): Promise<boolean> => {
  if (!isCapacitorRuntime()) return false;
  try {
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url });
    return true;
  } catch {
    return false;
  }
};

export const hapticImpactInCapacitor = async (pattern: number | number[]): Promise<boolean> => {
  if (!isCapacitorRuntime()) return false;
  try {
    const { Haptics, ImpactStyle, NotificationType } = await import("@capacitor/haptics");
    const intensity = Array.isArray(pattern)
      ? pattern.reduce((sum, item) => sum + item, 0)
      : pattern;

    if (intensity < 16) {
      await Haptics.impact({ style: ImpactStyle.Light });
      return true;
    }
    if (intensity < 32) {
      await Haptics.impact({ style: ImpactStyle.Medium });
      return true;
    }
    await Haptics.notification({ type: NotificationType.Success });
    return true;
  } catch {
    return false;
  }
};

export const showBackgroundPlaybackNotification = async (title: string, body: string): Promise<void> => {
  if (!isCapacitorRuntime()) return;
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    await LocalNotifications.schedule({
      notifications: [
        {
          id: BG_NOTIFICATION_ID,
          title,
          body,
          schedule: { at: dateFromNow(100) },
          ongoing: true,
          autoCancel: false,
        },
      ],
    });
  } catch {
    // no-op
  }
};

export const clearBackgroundPlaybackNotification = async (): Promise<void> => {
  if (!isCapacitorRuntime()) return;
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    await LocalNotifications.cancel({ notifications: [{ id: BG_NOTIFICATION_ID }] });
  } catch {
    // no-op
  }
};
