/**
 * API response shape guards.
 *
 * Several pages crashed or hung because they assumed the backend returned a
 * specific shape (e.g. `{ thresholds: [...] }`) while the actual payload was
 * `{ success: true, data: [...] }` — so `(undefined || []).map` or an object
 * spread exploded at render time. These helpers normalize at the boundary so
 * a shape mismatch renders an empty/error state instead of a raw JS error.
 */

/** Extract an array from a response body, accepting common envelope shapes. */
export function asArray<T = unknown>(body: unknown, ...keys: string[]): T[] {
  const candidates: unknown[] = [body, ...keys.map((k) => (body as Record<string, unknown> | null)?.[k]), (body as Record<string, unknown> | null)?.data, (body as Record<string, unknown> | null)?.items, (body as Record<string, unknown> | null)?.results];
  for (const c of candidates) {
    if (Array.isArray(c)) return c as T[];
  }
  return [];
}

/** Extract an object from a response body, never returning null/array. */
export function asObject<T extends object = Record<string, unknown>>(
  body: unknown,
  ...keys: string[]
): T {
  const candidates: unknown[] = [body, ...keys.map((k) => (body as Record<string, unknown> | null)?.[k]), (body as Record<string, unknown> | null)?.data];
  for (const c of candidates) {
    if (c && typeof c === "object" && !Array.isArray(c)) return c as T;
  }
  return {} as T;
}
