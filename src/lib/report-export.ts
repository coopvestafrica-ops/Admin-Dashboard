import { getAccessToken } from "@/lib/supabase";
import { getApiBaseUrl } from "@/lib/api";

/**
 * Download a report export as a file.
 *
 * `authedFetch` cannot be used alone here: the response is a binary attachment,
 * so the browser needs a Blob and an object URL rather than JSON parsing. The
 * bearer token still has to be attached by hand, and the backend's
 * `Content-Disposition` filename is preferred over one we invent, so a
 * downloaded file is always named by the server that generated it.
 */
export async function downloadReport(
  reportId: string,
  format: "csv" | "xlsx",
  filters: Record<string, string> = {},
): Promise<{ filename: string; rowCount: number | null }> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const qs = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v !== "" && v != null),
  ).toString();

  const url = `${getApiBaseUrl()}/admin/reports/export/${encodeURIComponent(reportId)}.${format}${
    qs ? `?${qs}` : ""
  }`;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    // The error body is JSON even though the success body is binary.
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.error || `Export failed (${res.status})`);
  }

  // Prefer the server's filename; fall back only if it is absent.
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = /filename="?([^"]+)"?/.exec(disposition);
  const filename = match?.[1] || `coopvest-${reportId}.${format}`;
  const rowHeader = res.headers.get("X-Report-Row-Count");
  const rowCount = rowHeader !== null && rowHeader !== "" ? Number(rowHeader) : null;

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Release the blob once the download has been handed to the browser.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);

  return { filename, rowCount };
}

/**
 * Download a comparative-analytics export.
 *
 * Same mechanics as downloadReport — a binary attachment needs a Blob rather
 * than JSON parsing — but the comparison is addressed by query string rather
 * than a report id, and the server names the file after the two periods being
 * compared.
 */
export async function downloadComparative(
  queryString: string,
  format: "csv" | "xlsx",
): Promise<string> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const url = `${getApiBaseUrl()}/admin/comparative/export.${format}?${queryString}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.error || `Export failed (${res.status})`);
  }

  const disposition = res.headers.get("Content-Disposition") || "";
  const filename = /filename="?([^"]+)"?/.exec(disposition)?.[1]
    || `coopvest-comparison.${format}`;

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);

  return filename;
}