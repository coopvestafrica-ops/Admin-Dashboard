import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/**
 * Shows a slim banner when the browser goes offline, so admins don't silently
 * interact with stale data. Re-fetching is handled automatically by TanStack
 * Query's refetchOnWindowFocus / reconnect handling.
 */
export function ConnectionStatus() {
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 bg-amber-600 px-4 py-1.5 text-center text-xs font-medium text-white shadow-md"
    >
      <WifiOff className="h-3.5 w-3.5" />
      You're offline. Some data may be out of date.
    </div>
  );
}
