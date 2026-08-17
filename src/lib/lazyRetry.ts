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
  return lazy(() =>
    importFn().catch((err: unknown) => {
      if (retries <= 0) throw err;
      return new Promise<{ default: T }>((resolve) => {
        setTimeout(() => resolve(lazyRetry(importFn, retries - 1)()), 500);
      });
    }),
  ) as ReturnType<typeof lazy<T>>;
}
