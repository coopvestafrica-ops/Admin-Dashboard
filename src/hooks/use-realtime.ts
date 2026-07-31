import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type TableName =
  | "profiles"
  | "loans"
  | "savings"
  | "transactions"
  | "organizations"
  | "kyc"
  | "tickets";

interface RealtimeOptions<T> {
  table: TableName;
  filter?: string;
  onInsert?: (record: T) => void;
  onUpdate?: (record: T) => void;
  onDelete?: (record: T) => void;
  enabled?: boolean;
}

/**
 * Hook for subscribing to Supabase Realtime changes on a table.
 * 
 * @example
 * ```tsx
 * const { data, isLoading } = useRealtime<Profile>('profiles', {
 *   onInsert: (profile) => {
 *     console.log('New profile:', profile);
 *     toast.success('New member joined!');
 *   },
 * });
 * ```
 */
export function useRealtime<T extends Record<string, unknown>>(
  table: TableName,
  options: RealtimeOptions<T> = { table, enabled: true }
) {
  const { filter, onInsert, onUpdate, onDelete, enabled = true } = options;
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected">("disconnected");

  useEffect(() => {
    if (!enabled) return;

    const channelName = `realtime-${table}-${Date.now()}`;
    const channelObj = supabase.channel(channelName);

    // Build filter string if provided
    let filterString = `table=${table}`;
    if (filter) {
      filterString += `&filter=${encodeURIComponent(filter)}`;
    }

    setConnectionStatus("connecting");

    // Subscribe to INSERT events
    if (onInsert) {
      channelObj.on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table, filter: filter || undefined },
        (payload) => {
          onInsert(payload.new as T);
        }
      );
    }

    // Subscribe to UPDATE events
    if (onUpdate) {
      channelObj.on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table, filter: filter || undefined },
        (payload) => {
          onUpdate(payload.new as T);
        }
      );
    }

    // Subscribe to DELETE events
    if (onDelete) {
      channelObj.on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table, filter: filter || undefined },
        (payload) => {
          onDelete(payload.old as T);
        }
      );
    }

    // Subscribe and track status
    channelObj.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        setConnectionStatus("connected");
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        setConnectionStatus("disconnected");
      }
    });

    setChannel(channelObj);

    // Cleanup
    return () => {
      supabase.removeChannel(channelObj);
      setChannel(null);
      setConnectionStatus("disconnected");
    };
  }, [table, filter, enabled, onInsert, onUpdate, onDelete]);

  return {
    channel,
    connectionStatus,
    disconnect: () => {
      if (channel) {
        supabase.removeChannel(channel);
        setChannel(null);
      }
    },
  };
}

/**
 * Hook for polling data with automatic refresh.
 * Use this as a fallback or for data that doesn't need true real-time.
 * 
 * @example
 * ```tsx
 * const { data, isLoading, refresh } = usePolling(
 *   () => supabase.from('profiles').select('*'),
 *   { interval: 30000 } // refresh every 30 seconds
 * );
 * ```
 */
export function usePolling<T>(
  fetcher: () => Promise<{ data: T | null; error: unknown }>,
  options: { interval?: number; enabled?: boolean } = {}
) {
  const { interval = 30000, enabled = true } = options;
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await fetcher();
      if (result.error) {
        setError(result.error);
      } else {
        setData(result.data);
        setError(null);
      }
    } catch (e) {
      setError(e);
    } finally {
      setIsLoading(false);
    }
  }, [fetcher]);

  useEffect(() => {
    if (!enabled) return;

    // Initial fetch
    refresh();

    // Set up polling interval
    const timer = setInterval(refresh, interval);

    return () => clearInterval(timer);
  }, [refresh, interval, enabled]);

  return { data, isLoading, error, refresh };
}