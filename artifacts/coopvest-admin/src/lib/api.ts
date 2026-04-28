const API_BASE = import.meta.env.VITE_API_URL || "";

export async function apiRequest<T = any>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}/api${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Request failed: ${res.status}`);
  return data as T;
}
