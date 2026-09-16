import type { ReactNode } from "react";
import { Link } from "wouter";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Standard page chrome for every admin screen.
 *
 * Pages previously each hand-rolled `<div className="space-y-6">` plus an
 * `<h1 className="text-2xl font-bold">`, with 83 usages of `text-2xl font-bold`,
 * 25 of `text-xl font-bold` and 14 of `text-3xl font-bold` across 54 pages —
 * so the same visual weight meant different things on different screens.
 * `PageHeader` centralises the title block, breadcrumb, description and actions
 * so every page reads at the same level.
 */

export interface Crumb {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Optional trail rendered above the title, e.g. Members / Jane Doe. */
  breadcrumbs?: Crumb[];
  /** Right-aligned controls (export, filters, primary action). */
  actions?: ReactNode;
  /** Small status pill beside the title (e.g. a live count). */
  badge?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  badge,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-4", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            {breadcrumbs.map((crumb, i) => (
              <li key={`${crumb.label}-${i}`} className="flex items-center gap-1">
                {i > 0 && (
                  <ChevronRight className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
                )}
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="rounded transition-colors hover:text-foreground"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-foreground">{crumb.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {/* One title size across the whole app. */}
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {title}
            </h1>
            {badge}
          </div>
          {description && (
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
    </header>
  );
}

/**
 * Standard vertical rhythm for page bodies.
 *
 * Matches the `space-y-6` every page already used, so adopting it is a no-op
 * visually but keeps spacing consistent if the scale ever changes.
 */
export function PageBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("space-y-6", className)}>{children}</div>;
}
