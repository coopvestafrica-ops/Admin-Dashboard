import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl, setAuthTokenGetter } from "@/lib/api-client";

// Debug logging
console.log("[DEBUG] main.tsx loaded");
console.log("[DEBUG] VITE_SUPABASE_URL:", import.meta.env.VITE_SUPABASE_URL);
console.log("[DEBUG] VITE_SUPABASE_ANON_KEY:", import.meta.env.VITE_SUPABASE_ANON_KEY ? "present" : "missing");
console.log("[DEBUG] VITE_API_BASE_URL:", import.meta.env.VITE_API_BASE_URL);

// Initialize API client with the correct backend URL
// Use VITE_API_BASE_URL if defined, otherwise fallback to Vercel API server
const baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://admin-dashboard-api-server.vercel.app';
setBaseUrl(baseUrl);
console.log("[DEBUG] API Base URL set to:", baseUrl);

// Set up auth token getter for API calls
// Use SERVICE_ROLE_KEY for admin API calls (service-to-service auth)
const serviceToken = import.meta.env.VITE_API_SERVICE_TOKEN;
if (serviceToken) {
  setAuthTokenGetter(() => serviceToken);
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
