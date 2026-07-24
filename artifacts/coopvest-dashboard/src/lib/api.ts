/**
 * Shared API utilities for the admin dashboard
 * All API calls should use these helpers to ensure consistent URLs
 * Updated: Using Latest-Coopvest backend at coopvest-api.onrender.com/api/v2/admin
 * Build: 2026-07-24 - Fixed to use correct backend endpoints (/api/v2/admin/*)
 */

import { supabase } from './supabase';

// Get the base API URL - uses Latest-Coopvest backend for all deployments
// The admin API routes are mounted at /api/v2/admin on the backend
export function getApiBaseUrl(): string {
  // Use Latest-Coopvest backend admin API - this is the production API server
  return 'https://coopvest-api.onrender.com/api/v2/admin';
}

// Get the admin API URL prefix - used by the API client for admin endpoints
// The Latest-Coopvest backend mounts admin routes at /api/v2/admin
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
  
  delete: <T = unknown>(endpoint: string) => 
    apiRequest<T>(endpoint, { method: 'DELETE' }),
};
