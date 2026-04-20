/**
 * HTTP client for the Coopvest mobile backend (Supabase-backed).
 *
 * The admin dashboard's member-facing routes proxy to this backend so that the
 * mobile app and the admin web site see a single source of truth for member
 * data (profiles, KYC, savings, loans, wallets, transactions, notifications,
 * tickets, audit logs).
 *
 * Auth is a shared secret header (`X-Service-Token`) rather than a user JWT,
 * so these calls act on behalf of the admin backend as a service.
 */

import { logger } from "./logger";

const DEFAULT_TIMEOUT_MS = 15_000;

export class MobileApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "MobileApiError";
    this.status = status;
    this.body = body;
  }
}

export interface MobileApiClientConfig {
  baseUrl: string;
  serviceToken: string;
  timeoutMs?: number;
}

export type QueryValue = string | number | boolean | undefined | null;
export type QueryParams = Record<string, QueryValue>;

export class MobileApiClient {
  private readonly baseUrl: string;
  private readonly serviceToken: string;
  private readonly timeoutMs: number;

  constructor(config: MobileApiClientConfig) {
    if (!config.baseUrl) throw new Error("MobileApiClient: baseUrl is required");
    if (!config.serviceToken) {
      throw new Error("MobileApiClient: serviceToken is required");
    }
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.serviceToken = config.serviceToken;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  private buildUrl(path: string, query?: QueryParams): string {
    const url = new URL(`${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value === undefined || value === null || value === "") continue;
        url.searchParams.set(key, String(value));
      }
    }
    return url.toString();
  }

  private async request<T>(
    method: string,
    path: string,
    options: { query?: QueryParams; body?: unknown } = {},
  ): Promise<T> {
    const url = this.buildUrl(path, options.query);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(url, {
        method,
        headers: {
          "X-Service-Token": this.serviceToken,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
      });

      const text = await res.text();
      let parsed: unknown = null;
      if (text) {
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = text;
        }
      }

      if (!res.ok) {
        const message =
          (parsed && typeof parsed === "object" && "error" in parsed && typeof (parsed as { error: unknown }).error === "string"
            ? (parsed as { error: string }).error
            : `Mobile API ${method} ${path} failed with status ${res.status}`);
        throw new MobileApiError(message, res.status, parsed);
      }

      return parsed as T;
    } catch (err) {
      if (err instanceof MobileApiError) throw err;
      if ((err as Error).name === "AbortError") {
        logger.error({ path, method }, "Mobile API request timed out");
        throw new MobileApiError("Mobile API request timed out", 504, null);
      }
      logger.error({ err, path, method }, "Mobile API request failed");
      throw new MobileApiError((err as Error).message, 502, null);
    } finally {
      clearTimeout(timer);
    }
  }

  get<T>(path: string, query?: QueryParams): Promise<T> {
    return this.request<T>("GET", path, { query });
  }

  post<T>(path: string, body?: unknown, query?: QueryParams): Promise<T> {
    return this.request<T>("POST", path, { body, query });
  }

  patch<T>(path: string, body?: unknown, query?: QueryParams): Promise<T> {
    return this.request<T>("PATCH", path, { body, query });
  }

  put<T>(path: string, body?: unknown, query?: QueryParams): Promise<T> {
    return this.request<T>("PUT", path, { body, query });
  }

  delete<T>(path: string, query?: QueryParams): Promise<T> {
    return this.request<T>("DELETE", path, { query });
  }
}

let singleton: MobileApiClient | null = null;

/**
 * Lazy singleton. Throws at call time (not at import time) if env vars are
 * missing, so routes that don't proxy to the mobile backend can still boot.
 */
export function getMobileApiClient(): MobileApiClient {
  if (singleton) return singleton;
  const baseUrl = process.env.MOBILE_API_BASE_URL;
  const serviceToken = process.env.MOBILE_API_SERVICE_TOKEN;
  if (!baseUrl || !serviceToken) {
    throw new Error(
      "MobileApiClient: set MOBILE_API_BASE_URL and MOBILE_API_SERVICE_TOKEN in the admin api-server environment",
    );
  }
  singleton = new MobileApiClient({ baseUrl, serviceToken });
  return singleton;
}

/**
 * Shape of a paginated list returned by the mobile backend's `/api/v2/admin/*`
 * endpoints. Each list endpoint uses a different top-level key (members,
 * loans, transactions, ...) which the caller types explicitly.
 */
export interface MobilePaginatedResponse<TItem, TKey extends string> {
  success: boolean;
  pagination: { page: number; limit: number; total: number };
  [key: string]: unknown;
}
export type MobilePaginated<TItem> = {
  success: boolean;
  pagination: { page: number; limit: number; total: number };
} & Record<string, TItem[] | unknown>;
