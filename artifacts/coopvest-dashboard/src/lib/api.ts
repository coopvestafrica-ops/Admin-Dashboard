/**
 * Shared API utilities for the admin dashboard
 * All API calls should use these helpers to ensure consistent URLs
 * Updated: Using Render backend for API calls
 * Build: 2026-07-22 - Updated to use Render backend directly
 */

import { supabase } from './supabase';

// Get the base API URL - uses Render backend for all deployments
export function getApiBaseUrl(): string {
  // Use Render backend for API calls - this is the production API server
  return 'https://coopvest-api.onrender.com';
}

// Get the admin API URL - used by the API client for all admin endpoints
// Note: The generated API client endpoints already include full paths like /api/members/stats
export function getAdminApiUrl(): string {
  const base = getApiBaseUrl();
  // Don't add /api since the generated API client URLs already include it
  return base;
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
