import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl, setAuthTokenGetter, setServiceToken } from "@/lib/api-client";
import { supabase } from "@/lib/supabase";

// Debug logging
console.log("[DEBUG] main.tsx loaded");
console.log("[DEBUG] VITE_SUPABASE_URL:", import.meta.env.VITE_SUPABASE_URL);
console.log("[DEBUG] VITE_SUPABASE_ANON_KEY:", import.meta.env.VITE_SUPABASE_ANON_KEY ? "present" : "missing");
console.log("[DEBUG] VITE_API_BASE_URL:", import.meta.env.VITE_API_BASE_URL);
console.log("[DEBUG] supabase client:", supabase ? "initialized" : "null");

// Initialize API client with the correct backend URL
// Use VITE_API_BASE_URL if defined, otherwise use same origin (for combined API+frontend deployment)
const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
setBaseUrl(baseUrl);
console.log("[DEBUG] API Base URL set to:", baseUrl || '(same origin)');

// Set service token for admin API endpoints
const serviceToken = import.meta.env.VITE_API_SERVICE_TOKEN as string | undefined;
if (serviceToken) {
  setServiceToken(serviceToken);
  console.log("[DEBUG] Service token set");
}

// Use Supabase session token for admin API authentication
// The Latest-Coopvest backend validates Supabase JWT tokens
setAuthTokenGetter(async () => {
  console.log("[DEBUG] Auth getter called");
  if (!supabase) {
    console.log("[DEBUG] supabase is null, cannot get token");
    return null;
  }
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    console.log("[DEBUG] Error getting session:", error.message);
  }
  console.log("[DEBUG] Supabase session:", session ? "present" : "missing", session ? "token length: " + (session.access_token?.length || 0) : "");
  return session?.access_token || null;
});

console.log("[DEBUG] Creating React root...");
createRoot(document.getElementById("root")!).render(<App />);
console.log("[DEBUG] React app rendered");
