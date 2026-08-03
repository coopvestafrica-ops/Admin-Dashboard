/**
 * Shared API utilities for the admin dashboard
 * All API calls should use these helpers to ensure consistent URLs
 * Uses Latest-Coopvest backend at coopvest-api.onrender.com/api/v2/admin
 */

import { supabase } from './supabase';

// Get the base API URL - uses Latest-Coopvest backend
// The admin API routes are mounted at /api on the backend
export function getApiBaseUrl(): string {
  // Use VITE_API_URL first, then VITE_API_BASE_URL, then fallback
  const envUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) as string | undefined;
  if (envUrl) return envUrl + '/api';
  
  const envBaseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) as string | undefined;
  if (envBaseUrl) return envBaseUrl + '/api';
  
  // Default to same origin (Vercel proxy forwards /api/* to the Render backend)
  return '/api';
}

// Get the admin API URL prefix - used by the API client for admin endpoints
export function getAdminApiUrl(): string {
  return getApiBaseUrl();
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
  
  // Add Supabase auth token for Latest-Coopvest backend
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
  const baseUrl = getApiBaseUrl();
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
  
  delete: <T = unknown>(endpoint: string, body?: unknown) => 
    apiRequest<T>(endpoint, {
      method: 'DELETE',
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }),
};
