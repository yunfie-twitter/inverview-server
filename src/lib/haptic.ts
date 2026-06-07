/**
 * モバイルデバイスで高級感のある触覚（ハプティクス）フィードバックを発生させます。
 * @param type フィードバックの強さ
 */
export const triggerHaptic = (type: "light" | "medium" | "heavy" | "success" | "click" = "click"): void => {
  if (typeof window !== "undefined" && navigator.vibrate) {
    try {
      switch (type) {
        case "click":
        case "light":
          navigator.vibrate(10); // キレの良い極小クリック（10ms）
          break;
        case "medium":
          navigator.vibrate(20); // 少し強めの確定（20ms）
          break;
        case "heavy":
          navigator.vibrate(40); // 強いエラーなど（40ms）
          break;
        case "success":
          navigator.vibrate([15, 30, 15]); // 成功時の心地よいダブルタップ（トン、トン）
          break;
      }
    } catch {
      // Ignore browser security restrictions
    }
  }
};
