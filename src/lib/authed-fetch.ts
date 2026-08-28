import { getAccessToken } from "@/lib/supabase";
import { getApiBaseUrl } from "@/lib/api";

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
  return fetch(url, { ...options, headers });
}

