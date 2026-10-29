import { getAccessToken } from "@/lib/supabase";
import { getApiBaseUrl, syncSessionWithBackend } from "@/lib/api";

/**
 * Authenticated fetch wrapper for admin pages that use raw `fetch`.
 * Attaches the Supabase session bearer token and JSON content type,
 * then returns the native Response so callers can use res.ok/res.json() etc.
 *
 * Relative `/api/...` paths are resolved against the absolute backend base URL
 * (`getApiBaseUrl()`) instead of the Vercel-origin proxy. Visiting those paths
 * through the origin proxy can fall through to the SPA catch-all rewrite and
 * return the index.html document instead of JSON (e.g. `/api/admin/ledger/dashboard`).
 */
export async function authedFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string> | undefined) ?? {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  // getApiBaseUrl() already includes the `/api` suffix; the relative
  // authedFetch paths (`/api/admin/...`) include it too, so drop the duplicate.
  const url =
    path.startsWith("/api/")
      ? `${getApiBaseUrl()}${path.slice("/api".length)}`
      : path;
  const res = await fetch(url, { ...options, headers });

  // The backend enforces a single active session per profile. A restored
  // Supabase session can carry a session id that no longer matches
  // `profiles.active_session_id` (e.g. it was replaced), which makes every
  // admin call fail with 401 SESSION_REPLACED. Re-claim the session once and
  // retry so the page loads instead of showing "Failed to load …".
  if (res.status === 401) {
    let code: string | undefined;
    try {
      code = ((await res.clone().json()) as { code?: string }).code;
    } catch {
      code = undefined;
    }
    if (code === "SESSION_REPLACED") {
      const claimed = await syncSessionWithBackend();
      if (claimed) {
        const fresh = await getAccessToken();
        if (fresh) headers["Authorization"] = `Bearer ${fresh}`;
        return fetch(url, { ...options, headers });
      }
    }
  }

  return res;
}

