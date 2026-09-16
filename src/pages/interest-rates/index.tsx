import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { PageHeader, PageBody } from "@/components/PageHeader";
import { StatCard, StatGrid } from "@/components/StatCard";
import { DataState } from "@/components/DataState";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useGetInterestRates } from "@/lib/api-client";
import { api } from "@/lib/api";
import { Percent, Save, RotateCcw, Info } from "lucide-react";

/**
 * Interest rate configuration.
 *
 * The backend keeps exactly three rates as `system_settings` rows and returns
 * them as a flat map; the mobile app resolves loan pricing from the same keys.
 * This screen edits those three values rather than inventing a per-loan-type
 * schedule the backend has nowhere to store.
 */
export default function InterestRates() {
  const { data, isLoading, isError, error, refetch } = useGetInterestRates();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const rates = data ?? [];
  // Local draft keyed by setting key so each row can be saved independently.
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!rates.length) return;
    setDrafts((prev) => {
      const next = { ...prev };
      for (const r of rates) {
        if (next[r.key] === undefined) next[r.key] = String(r.rate);
      }
      return next;
    });
  }, [rates]);

  const save = useMutation({
    mutationFn: ({ key, rate }: { key: string; rate: number }) =>
      api.put(`/admin/system-settings/${key}`, { value: String(rate) }),
    onSuccess: (_res, vars) => {
      toast({
        title: "Rate updated",
        description: "The mobile app picks this up within a few minutes.",
      });
      queryClient.invalidateQueries({ queryKey: ["getInterestRates"] });
      setDrafts((prev) => ({ ...prev, [vars.key]: String(vars.rate) }));
    },
    onError: (err: Error) =>
      toast({ title: "Could not save rate", description: err.message, variant: "destructive" }),
  });

  const highest = rates.length ? Math.max(...rates.map((r) => r.rate)) : 0;
  const lowest = rates.length ? Math.min(...rates.map((r) => r.rate)) : 0;

  const dirty = (key: string) => {
    const original = rates.find((r) => r.key === key);
    if (!original) return false;
    const draft = drafts[key];
    return draft !== undefined && Number(draft) !== original.rate;
  };

  return (
    <Layout>
      <PageBody>
        <PageHeader
          title="Interest Rates"
          description="The savings, loan and investment rates the platform and the member app both read. Changes apply to new calculations."
          breadcrumbs={[{ label: "Financial Control" }, { label: "Interest Rates" }]}
        />

        <StatGrid columns={3}>
          <StatCard
            label="Rates Configured"
            value={rates.length}
            format="number"
            icon={Percent}
            loading={isLoading}
          />
          <StatCard
            label="Highest Rate"
            value={`${highest}%`}
            icon={Percent}
            loading={isLoading}
            valueClassName="text-amber-600"
          />
          <StatCard
            label="Lowest Rate"
            value={`${lowest}%`}
            icon={Percent}
            loading={isLoading}
            valueClassName="text-emerald-600"
          />
        </StatGrid>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rate Configuration</CardTitle>
            <CardDescription>
              These values are stored as platform settings and are the single source of truth
              shared with the mobile app.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataState
              loading={isLoading}
              error={isError ? error : undefined}
              isEmpty={!isLoading && !isError && rates.length === 0}
              emptyTitle="No rates configured"
              emptyDescription="The platform has no interest-rate settings yet."
              onRetry={() => refetch()}
              skeletonRows={3}
            >
              <div className="space-y-4">
                {rates.map((rate) => (
                  <div
                    key={rate.key}
                    className="flex flex-col gap-3 border-b pb-4 last:border-0 last:pb-0 sm:flex-row sm:items-end sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Label htmlFor={`rate-${rate.key}`} className="font-medium">
                          {rate.label}
                        </Label>
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {rate.key}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{rate.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Input
                          id={`rate-${rate.key}`}
                          type="number"
                          step="0.1"
                          min="0"
                          className="w-28 pr-7 tabular-nums"
                          value={drafts[rate.key] ?? String(rate.rate)}
                          onChange={(e) =>
                            setDrafts((prev) => ({ ...prev, [rate.key]: e.target.value }))
                          }
                        />
                        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                          %
                        </span>
                      </div>
                      <Button
                        size="sm"
                        disabled={!dirty(rate.key) || save.isPending}
                        onClick={() => save.mutate({ key: rate.key, rate: Number(drafts[rate.key]) })}
                      >
                        <Save className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={!dirty(rate.key)}
                        onClick={() =>
                          setDrafts((prev) => ({ ...prev, [rate.key]: String(rate.rate) }))
                        }
                        aria-label={`Reset ${rate.label}`}
                      >
                        <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </DataState>
          </CardContent>
        </Card>

        <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-4">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">
            Loan pricing in the member app is derived from a savings multiple and a per-product
            rate, so a change here applies to newly created loans and does not retroactively
            reprice existing ones.
          </p>
        </div>
      </PageBody>
    </Layout>
  );
}