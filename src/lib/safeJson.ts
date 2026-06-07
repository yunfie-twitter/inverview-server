import { z, type ZodType } from "zod";

export const parseJson = (raw: string): unknown => JSON.parse(raw);

export const parseJsonWithSchema = <T>(raw: string | null | undefined, schema: ZodType<T>, fallback: T): T => {
  if (!raw) return fallback;
  try {
    return schema.parse(parseJson(raw));
  } catch {
    return fallback;
  }
};

export const parseJsonUnknown = (raw: string): unknown | undefined => {
  try {
    return parseJson(raw);
  } catch {
    return undefined;
  }
};

export const stringifyJson = (value: unknown, space?: number): string => JSON.stringify(value, null, space);

export const unknownRecordSchema = z.record(z.string(), z.unknown());
