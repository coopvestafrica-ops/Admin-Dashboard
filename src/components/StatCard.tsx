import type { ElementType, ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrencyWhole } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Standard KPI tile for admin dashboards.
 *
 * Pages used to hand-roll these, which drifted: some showed the icon above the
 * number, some beside it; some used `text-lg`, some `text-xl`; currency tiles
 * sometimes rendered `toLocaleString()` (no symbol) and sometimes
 * `formatCurrency` (with ₦). This centralises value formatting and layout so a
 * figure means the same thing on every screen.
 */

export type StatTrend = "up" | "down" | "flat";

export interface StatCardProps {
  label: string;
  value: number | string;
  /** How to render `value` when it is numeric. */
  format?: "number" | "currency" | "percent" | "raw";
  icon?: ElementType;
  /** Tailwind text colour for the icon, e.g. "text-emerald-600". */
  iconClassName?: string;
  /** Optional secondary line under the label. */
  hint?: string;
  trend?: StatTrend;
  trendLabel?: string;
  /** Renders a skeleton in place of the value while loading. */
  loading?: boolean;
  /** Applied to the value itself, for emphasis or a status colour. */
  valueClassName?: string;
  className?: string;
}

function renderValue(value: number | string, format: StatCardProps["format"]) {
  if (typeof value === "string") return value;
  switch (format) {
    case "currency":
      // KPI tiles show whole naira: decimals are noise at this size, and this
      // matches the app's dashboard headline formatting.
      return formatCurrencyWhole(value);
    case "percent":
      return `${value.toLocaleString()}%`;
    case "number":
      return value.toLocaleString();
    default:
      return value.toLocaleString();
  }
}

const TREND_STYLES: Record<StatTrend, { icon: ElementType; className: string }> = {
  up: { icon: ArrowUpRight, className: "text-emerald-600" },
  down: { icon: ArrowDownRight, className: "text-red-600" },
  flat: { icon: Minus, className: "text-muted-foreground" },
};

export function StatCard({
  label,
  value,
  format = "number",
  icon: Icon,
  iconClassName,
  hint,
  trend,
  trendLabel,
  loading = false,
  valueClassName,
  className,
}: StatCardProps) {
  const trendStyle = trend ? TREND_STYLES[trend] : null;
  const TrendIcon = trendStyle?.icon;

  return (
    <Card className={cn("transition-shadow hover:shadow-md", className)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </div>
            {loading ? (
              <Skeleton className="mt-2 h-7 w-24" />
            ) : (
              <div
                className={cn(
                  "mt-1 truncate text-xl font-bold tabular-nums text-foreground",
                  valueClassName,
                )}
                title={typeof value === "string" ? value : undefined}
              >
                {renderValue(value, format)}
              </div>
            )}
            {(hint || (trendStyle && trendLabel)) && !loading && (
              <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                {trendStyle && TrendIcon && (
                  <span className={cn("flex items-center gap-0.5", trendStyle.className)}>
                    <TrendIcon className="h-3 w-3" aria-hidden />
                    {trendLabel}
                  </span>
                )}
                {hint && <span>{hint}</span>}
              </div>
            )}
          </div>
          {Icon && (
            <div
              className={cn(
                "shrink-0 rounded-lg bg-muted p-2 text-muted-foreground",
                iconClassName,
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Responsive grid for a row of StatCards. Keeps column counts identical
 * across pages instead of each page inventing its own `grid-cols-*`.
 */
export function StatGrid({
  children,
  columns = 4,
  className,
}: {
  children: ReactNode;
  columns?: 2 | 3 | 4 | 5 | 6;
  className?: string;
}) {
  const cols: Record<number, string> = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-2 lg:grid-cols-4",
    5: "grid-cols-2 lg:grid-cols-5",
    6: "grid-cols-2 lg:grid-cols-6",
  };
  return <div className={cn("grid gap-3", cols[columns], className)}>{children}</div>;
}
