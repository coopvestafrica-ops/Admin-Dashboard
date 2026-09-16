import type { ReactNode } from "react";
import { AlertTriangle, Inbox, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Consistent loading / empty / error rendering for data-backed screens.
 *
 * Before this, pages rendered a bare `<tr><td>No loans found.</td></tr>`, or
 * nothing at all while loading, and error states were frequently absent — an
 * API failure looked identical to "there is no data". These helpers make the
 * three states visually distinct and give the operator a way out (retry).
 */

interface DataStateProps {
  loading?: boolean;
  error?: unknown;
  isEmpty?: boolean;
  /** Copy shown when there is genuinely no data. */
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  onRetry?: () => void;
  /** Rows to shimmer while loading. */
  skeletonRows?: number;
  children?: ReactNode;
  className?: string;
}

function errorMessage(error: unknown): string {
  if (!error) return "";
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Something went wrong while loading this data.";
}

/**
 * Wraps a data region and renders the right state for it.
 * Use inside a card/table container so the shell stays stable across states.
 */
export function DataState({
  loading = false,
  error,
  isEmpty = false,
  emptyTitle = "Nothing to show yet",
  emptyDescription,
  emptyAction,
  onRetry,
  skeletonRows = 5,
  children,
  className,
}: DataStateProps) {
  if (loading) {
    return (
      <div className={cn("space-y-3 p-4", className)} aria-busy="true" aria-live="polite">
        {Array.from({ length: skeletonRows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 flex-1" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("flex flex-col items-center gap-3 px-6 py-12 text-center", className)}>
        <div className="rounded-full bg-destructive/10 p-3">
          <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden />
        </div>
        <div>
          <p className="font-medium text-foreground">Could not load this data</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            {errorMessage(error)}
          </p>
        </div>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
            Try again
          </Button>
        )}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className={cn("flex flex-col items-center gap-3 px-6 py-12 text-center", className)}>
        <div className="rounded-full bg-muted p-3">
          <Inbox className="h-6 w-6 text-muted-foreground" aria-hidden />
        </div>
        <div>
          <p className="font-medium text-foreground">{emptyTitle}</p>
          {emptyDescription && (
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              {emptyDescription}
            </p>
          )}
        </div>
        {emptyAction}
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * A table row that spans every column and shows the region's state.
 * Keeps the `<table>` shape valid instead of swapping the table for a div.
 */
export function DataStateRow({
  colSpan,
  loading = false,
  error,
  isEmpty = false,
  emptyTitle = "Nothing to show yet",
  emptyDescription,
  onRetry,
}: {
  colSpan: number;
  loading?: boolean;
  error?: unknown;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  onRetry?: () => void;
}) {
  if (!loading && !error && !isEmpty) return null;
  return (
    <tr>
      <td colSpan={colSpan} className="p-0">
        <DataState
          loading={loading}
          error={error}
          isEmpty={isEmpty}
          emptyTitle={emptyTitle}
          emptyDescription={emptyDescription}
          onRetry={onRetry}
        />
      </td>
    </tr>
  );
}
