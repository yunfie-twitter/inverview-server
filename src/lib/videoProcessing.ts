type SortBy = "date" | "views" | "duration" | "none";
type SortOrder = "asc" | "desc";

export interface ProcessableVideoItem {
  videoId?: string;
  playlistId?: string;
  title?: string;
  author?: string;
  published?: number;
  watchedAt?: number;
  viewCount?: number;
  lengthSeconds?: number;
  liveNow?: boolean;
  isUpcoming?: boolean;
}

const getItemId = (item: ProcessableVideoItem): string | undefined => item.videoId || item.playlistId;

const compareNumbers = (a: number, b: number, order: SortOrder): number =>
  order === "desc" ? b - a : a - b;

export const filterAndSortVideoItems = <T extends ProcessableVideoItem>(
  videos: T[],
  query = "",
  sortBy: SortBy = "none",
  sortOrder: SortOrder = "desc",
): T[] => {
  if (!Array.isArray(videos) || videos.length === 0) return [];

  const normalizedQuery = query.trim().toLowerCase();
  const seen = new Set<string>();
  const result: T[] = [];

  for (let index = 0; index < videos.length; index += 1) {
    const item = videos[index];
    if (!item) continue;

    const id = getItemId(item);
    if (id) {
      if (seen.has(id)) continue;
      seen.add(id);
    }

    if (
      normalizedQuery &&
      !item.title?.toLowerCase().includes(normalizedQuery) &&
      !item.author?.toLowerCase().includes(normalizedQuery)
    ) {
      continue;
    }

    result.push(item);
  }

  if (sortBy === "date") {
    result.sort((a, b) => compareNumbers(a.published ?? a.watchedAt ?? 0, b.published ?? b.watchedAt ?? 0, sortOrder));
  } else if (sortBy === "views") {
    result.sort((a, b) => compareNumbers(a.viewCount ?? 0, b.viewCount ?? 0, sortOrder));
  } else if (sortBy === "duration") {
    result.sort((a, b) => compareNumbers(a.lengthSeconds ?? 0, b.lengthSeconds ?? 0, sortOrder));
  }

  return result;
};

export const mergeTrendingAndSubscriptionItems = <T extends ProcessableVideoItem>(
  trendingVideos: T[],
  subscribedVideos: T[],
): T[] => {
  const trendingItems = Array.isArray(trendingVideos) ? trendingVideos : [];
  const subscribedItems = Array.isArray(subscribedVideos) ? subscribedVideos : [];
  const seen = new Set<string>();
  const merged: T[] = [];
  const maxLength = Math.max(trendingItems.length, subscribedItems.length);

  for (let i = 0; i < maxLength; i += 1) {
    const fromSubscribed = subscribedItems[i];
    if (fromSubscribed && !fromSubscribed.liveNow && !fromSubscribed.isUpcoming) {
      const id = getItemId(fromSubscribed);
      if (!id || !seen.has(id)) {
        if (id) seen.add(id);
        merged.push(fromSubscribed);
      }
    }

    const fromTrending = trendingItems[i];
    if (fromTrending && !fromTrending.liveNow && !fromTrending.isUpcoming) {
      const id = getItemId(fromTrending);
      if (!id || !seen.has(id)) {
        if (id) seen.add(id);
        merged.push(fromTrending);
      }
    }
  }

  return merged;
};
