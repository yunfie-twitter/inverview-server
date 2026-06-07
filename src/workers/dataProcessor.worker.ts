import {
  filterAndSortVideoItems,
  mergeTrendingAndSubscriptionItems,
  type ProcessableVideoItem,
} from "../lib/videoProcessing";

// self が WorkerGlobalScope であることを TypeScript に認識させる
const ctx: Worker = self as unknown as Worker;

interface WorkerRequest {
  messageId: string;
  type: "filterAndSort" | "mergeTrendingAndSubscriptions";
  payload: {
    videos?: ProcessableVideoItem[];
    query?: string;
    sortBy?: "date" | "views" | "duration" | "none";
    sortOrder?: "asc" | "desc";
    trendingVideos?: ProcessableVideoItem[];
    subscribedVideos?: ProcessableVideoItem[];
  };
}

ctx.addEventListener("message", (e: MessageEvent) => {
  const { messageId, type, payload } = e.data as WorkerRequest;

  if (type === "filterAndSort") {
    const { videos, query, sortBy, sortOrder } = payload;
    ctx.postMessage({ messageId, result: filterAndSortVideoItems(videos ?? [], query, sortBy, sortOrder) });
  } else if (type === "mergeTrendingAndSubscriptions") {
    const { trendingVideos, subscribedVideos } = payload;
    ctx.postMessage({ messageId, result: mergeTrendingAndSubscriptionItems(trendingVideos ?? [], subscribedVideos ?? []) });
  }
});
