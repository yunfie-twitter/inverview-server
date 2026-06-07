let initialized = false;
type SentryApi = {
  init: (options: {
    dsn: string;
    environment: string;
    tracesSampleRate: number;
  }) => void;
  captureException: (error: unknown, context?: Record<string, unknown>) => void;
};

let sentryApi: SentryApi | null = null;

export const initSentry = async (): Promise<void> => {
  if (initialized) return;
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  const sentryModule = await import("@sentry/react");
  sentryApi = sentryModule;

  sentryApi.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
  });
  initialized = true;
};

export const Sentry = {
  captureException: (error: unknown, context?: Record<string, unknown>): void => {
    sentryApi?.captureException(error, context);
  },
};
