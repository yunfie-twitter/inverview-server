import { filterAndSortVideoItems, mergeTrendingAndSubscriptionItems, type ProcessableVideoItem } from "./videoProcessing";

let worker: Worker | null = null;
let isWorkerBroken = false;
const pendingMessages = new Map<string, (result: unknown) => void>();
let workerIdleTimerId = 0;

const WORKER_IDLE_TIMEOUT_MS = 10_000;
const MIN_ITEMS_FOR_WORKER = 500;

const handleWorkerMessage = (e: MessageEvent): void => {
  const resolver = pendingMessages.get(e.data?.messageId);
  if (!resolver) return;
  pendingMessages.delete(e.data.messageId);
  resolver(e.data.result);
};

const disableWorker = (): void => {
  isWorkerBroken = true;
  pendingMessages.clear();
  window.clearTimeout(workerIdleTimerId);
  try {
    worker?.removeEventListener("message", handleWorkerMessage);
    worker?.terminate();
  } catch {
    // ignore
  }
  worker = null;
};

const initWorker = () => {
  if (worker || isWorkerBroken) return;
  try {
    if (typeof window !== "undefined" && window.Worker) {
      worker = new Worker(
        new URL("../workers/dataProcessor.worker.ts", import.meta.url),
        { type: "module" }
      );
      worker.addEventListener("message", handleWorkerMessage);
      worker.onerror = (err) => {
        console.error("Web Worker runtime error. Disabling worker and falling back to main thread.", err);
        disableWorker();
      };
    }
  } catch (e) {
    console.warn("Web Worker could not be initialized, falling back to main thread.", e);
    isWorkerBroken = true;
  }
};

const terminateIdleWorker = (): void => {
  if (pendingMessages.size > 0) return;
  try {
    worker?.removeEventListener("message", handleWorkerMessage);
    worker?.terminate();
  } catch {
    // ignore
  }
  worker = null;
};

const scheduleWorkerCleanup = (): void => {
  if (typeof window === "undefined") return;
  window.clearTimeout(workerIdleTimerId);
  workerIdleTimerId = window.setTimeout(terminateIdleWorker, WORKER_IDLE_TIMEOUT_MS);
};

// タイムアウト付きで Worker 処理を実行するヘルパー関数
const runInWorker = <T>(
  type: string,
  payload: unknown,
  fallbackFn: () => T,
  timeoutMs = 1500,
  shouldUseWorker = true
): Promise<T> => {
  if (shouldUseWorker && !worker && !isWorkerBroken) {
    initWorker();
  }

  if (!shouldUseWorker || !worker || isWorkerBroken) {
    return Promise.resolve(fallbackFn());
  }

  return new Promise<T>((resolve) => {
    const messageId = Math.random().toString(36).substring(2);
    let resolved = false;

    const finish = (value: T): void => {
      if (resolved) return;
      resolved = true;
      window.clearTimeout(timer);
      pendingMessages.delete(messageId);
      scheduleWorkerCleanup();
      resolve(value);
    };

    const timer = window.setTimeout(() => {
      console.warn(`Web Worker timeout (${timeoutMs}ms) for type: ${type}. Falling back to main thread.`);
      finish(fallbackFn());
    }, timeoutMs);

    try {
      pendingMessages.set(messageId, (result) => finish(result as T));
      worker?.postMessage({ messageId, type, payload });
    } catch (error) {
      console.warn(`Web Worker postMessage failed for type: ${type}. Falling back to main thread.`, error);
      finish(fallbackFn());
    }
  });
};

/**
 * 動画リストの重複排除、フィルタリング、ソート処理をバックグラウンドスレッド (Web Worker) で非同期に実行します。
 * Web Worker が非対応な古いブラウザやロードエラー時は、自動的にメインスレッドでフォールバック実行され、UIを破壊しません。
 */
export const filterAndSortVideos = <T extends ProcessableVideoItem>(
  videos: T[],
  query: string = "",
  sortBy: "date" | "views" | "duration" | "none" = "none",
  sortOrder: "asc" | "desc" = "desc"
): Promise<T[]> => {
  const shouldUseWorker = videos.length >= MIN_ITEMS_FOR_WORKER;
  return runInWorker(
    "filterAndSort",
    { videos, query, sortBy, sortOrder },
    () => filterAndSortVideoItems(videos, query, sortBy, sortOrder),
    1500,
    shouldUseWorker
  );
};

/**
 * 急上昇動画と登録チャンネル動画を、ライブ配信を除外しながら交互にマージし、重複排除する処理を
 * バックグラウンドスレッド (Web Worker) で実行します。
 * Worker が無効な環境では自動的にメインスレッドでフォールバックされます。
 */
export const mergeTrendingAndSubscriptions = <T extends ProcessableVideoItem>(
  trendingVideos: T[],
  subscribedVideos: T[]
): Promise<T[]> => {
  const shouldUseWorker = trendingVideos.length + subscribedVideos.length >= MIN_ITEMS_FOR_WORKER;
  return runInWorker(
    "mergeTrendingAndSubscriptions",
    { trendingVideos, subscribedVideos },
    () => mergeTrendingAndSubscriptionItems(trendingVideos, subscribedVideos),
    1500,
    shouldUseWorker
  );
};

