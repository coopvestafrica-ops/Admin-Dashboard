import { getAccessToken } from "@/lib/supabase";

/**
 * Authenticated fetch wrapper for admin pages that use raw `fetch`.
 * Attaches the Supabase session bearer token and JSON content type,
 * then returns the native Response so callers can use res.ok/res.json() etc.
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

  return fetch(path, { ...options, headers });
}

