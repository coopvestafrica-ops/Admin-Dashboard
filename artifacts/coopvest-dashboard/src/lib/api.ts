/**
 * Shared API utilities for the admin dashboard
 * All API calls should use these helpers to ensure consistent URLs
 * FIXED: API URL properly configured for production build
 * Build: 2026-07-05
 */

import { supabase } from './supabase';

// Get the base API URL - use environment variable or default to Render API
export function getApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl) {
    // Normalize: remove trailing slashes
    let normalized = envUrl.replace(/\/+$/, '');
    return normalized;
  }
  // Default to Render API server (production) - this is the primary backend
  // IMPORTANT: The frontend now calls the Render API directly to avoid Vercel routing issues
  return 'https://coopvest-api-v3.onrender.com';
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
