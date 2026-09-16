import { lazy, type ComponentType } from "react";

/**
 * Wraps `React.lazy` so a failed dynamic import (transient network blip or a
 * chunk briefly unavailable during a deploy) is retried a few times before
 * surfacing the error. Pairs with the ErrorBoundary, which handles the
 * stale-cache-after-redeploy case by reloading the page once.
 */
export function lazyRetry<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  retries = 3,
): ReturnType<typeof lazy<T>> {
  return lazy(async () => {
    for (let attempt = retries; attempt >= 0; attempt -= 1) {
      try {
        return await importFn();
      } catch (err) {
        if (attempt === 0) throw err;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
    // Unreachable: the loop either returns or throws on the final attempt.
    throw new Error("Dynamic import failed");
  }) as ReturnType<typeof lazy<T>>;
}
