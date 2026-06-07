type ServerRuntimeInfo = {
  status?: string;
  runtime?: string;
};

let runtimePromise: Promise<ServerRuntimeInfo | null> | null = null;

export const getServerRuntimeInfo = async (): Promise<ServerRuntimeInfo | null> => {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      try {
        const response = await fetch("/health", { credentials: "same-origin" });
        if (!response.ok) return null;
        return (await response.json()) as ServerRuntimeInfo;
      } catch {
        return null;
      }
    })();
  }
  return runtimePromise;
};

export const isSameOriginOrRelativeUrl = (value: string): boolean => {
  const trimmed = value.trim();
  if (!trimmed) return false;
  try {
    const url = new URL(trimmed, window.location.origin);
    return url.origin === window.location.origin;
  } catch {
    return trimmed.startsWith("/");
  }
};
