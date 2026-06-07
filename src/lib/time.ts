import { addMilliseconds, fromUnixTime, getTime, getUnixTime } from "date-fns";

export const now = (): Date => new Date();

export const nowMs = (): number => getTime(now());

export const nowUnixSeconds = (): number => getUnixTime(now());

export const unixSecondsToDate = (unixSeconds: number): Date => fromUnixTime(unixSeconds);

export const expiresAtFromNow = (ttlMs: number): number => getTime(addMilliseconds(now(), ttlMs));

export const dateFromNow = (offsetMs: number): Date => addMilliseconds(now(), offsetMs);

export const elapsedMsSince = (startedAt: number): number => nowMs() - startedAt;
