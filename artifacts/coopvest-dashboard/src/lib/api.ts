/**
 * Shared API utilities for the admin dashboard
 * All API calls should use these helpers to ensure consistent URLs
 * FIXED: API URL properly configured for production build
 * Build: 2026-07-01
 */

import { supabase } from './supabase';

// Get the base API URL - use environment variable or default to production
export function getApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl) {
    // Normalize: remove trailing slashes and /api suffix to avoid duplication
    let normalized = envUrl.replace(/\/+$/, '');
    // If URL already ends with /api, don't add it again
    if (normalized.endsWith('/api')) {
      return normalized;
    }
    return normalized;
  }
  // Default to Vercel admin API server
  return 'https://admin-dashboard-api-server.vercel.app';
}

// Get the admin API URL - use /api prefix for all endpoints
export function getAdminApiUrl(): string {
  const base = getApiBaseUrl();
  // Always append /api to base URL for admin endpoints
  return `${base}/api`;
}

// Get auth token from Supabase session
export async function getAuthToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

// Get auth headers for API requests
export async function getAuthHeaders(): Promise<HeadersInit> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  const token = await getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
}

// Generic API request helper
export async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const baseUrl = getAdminApiUrl();
  const url = endpoint.startsWith('/') ? `${baseUrl}${endpoint}` : `${baseUrl}/${endpoint}`;
  const headers = await getAuthHeaders();
  
  const response = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `API request failed: ${response.status}`);
  }

  return response.json();
}

// Convenience methods
export const api = {
  get: <T = unknown>(endpoint: string) => 
    apiRequest<T>(endpoint, { method: 'GET' }),
  
  post: <T = unknown>(endpoint: string, body: unknown) => 
    apiRequest<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  
  put: <T = unknown>(endpoint: string, body: unknown) => 
    apiRequest<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  
  patch: <T = unknown>(endpoint: string, body: unknown) => 
    apiRequest<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  
  delete: <T = unknown>(endpoint: string) => 
    apiRequest<T>(endpoint, { method: 'DELETE' }),
};
