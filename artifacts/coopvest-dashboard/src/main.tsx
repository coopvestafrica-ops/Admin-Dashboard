import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl, setAuthTokenGetter, setServiceToken } from "@/lib/api-client";

// Debug logging
console.log("[DEBUG] main.tsx loaded");
console.log("[DEBUG] VITE_SUPABASE_URL:", import.meta.env.VITE_SUPABASE_URL);
console.log("[DEBUG] VITE_SUPABASE_ANON_KEY:", import.meta.env.VITE_SUPABASE_ANON_KEY ? "present" : "missing");
console.log("[DEBUG] VITE_API_BASE_URL:", import.meta.env.VITE_API_BASE_URL);

// Initialize API client with the correct backend URL
// Use VITE_API_BASE_URL if defined, otherwise use same origin (for combined API+frontend deployment)
const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
setBaseUrl(baseUrl);
console.log("[DEBUG] API Base URL set to:", baseUrl || '(same origin)');

// Set up service token for admin API endpoints
// This is the MOBILE_API_SERVICE_TOKEN from the backend
const apiServiceToken = import.meta.env.VITE_API_SERVICE_TOKEN;
if (apiServiceToken) {
  setServiceToken(apiServiceToken);
  console.log("[DEBUG] Service token configured for admin API");
}

// Set up auth token getter for API calls
// Use SERVICE_ROLE_KEY for admin API calls (service-to-service auth)
if (apiServiceToken) {
  setAuthTokenGetter(() => apiServiceToken);
} else {
  // Fallback to Supabase session token for non-admin endpoints
  setAuthTokenGetter(async () => {
    const { supabase } = await import("@/lib/supabase");
    if (!supabase) return null;
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  });
}

console.log("[DEBUG] Creating React root...");
createRoot(document.getElementById("root")!).render(<App />);
console.log("[DEBUG] React app rendered");
