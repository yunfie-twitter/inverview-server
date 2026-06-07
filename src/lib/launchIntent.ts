const tryParseUrl = (value: string): URL | null => {
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

const extractVideoId = (url: URL): string | null => {
  if (url.hostname.includes("youtu.be")) {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return id || null;
  }

  if (url.pathname.startsWith("/watch/")) {
    const id = url.pathname.split("/").filter(Boolean)[1];
    return id || null;
  }

  if (url.pathname === "/watch") {
    const id = url.searchParams.get("v");
    return id || null;
  }

  return null;
};

export const resolveLaunchPath = (input: { url?: string | null; text?: string | null; title?: string | null }): string => {
  const rawUrl = input.url?.trim();
  if (rawUrl) {
    const parsed = tryParseUrl(rawUrl);
    if (parsed) {
      const videoId = extractVideoId(parsed);
      if (videoId) return `/watch/${encodeURIComponent(videoId)}?autoplay=1`;
    }
  }

  const query = [input.title, input.text, input.url]
    .map((value) => value?.trim() ?? "")
    .filter(Boolean)
    .join(" ")
    .trim();
  if (query) return `/search?q=${encodeURIComponent(query)}`;
  return "/";
};
