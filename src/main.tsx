import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl, setAuthTokenGetter, setServiceToken } from "@/lib/api-client";
import { supabase } from "@/lib/supabase";

// Debug logging
console.log("[DEBUG] main.tsx loaded");
console.log("[DEBUG] supabase client:", supabase ? "initialized" : "null");

// Use environment variable with fallback to hardcoded URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://coopvest-api.onrender.com";
setBaseUrl(API_BASE_URL);
console.log("[DEBUG] API Base URL set to:", API_BASE_URL);

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
    return null;
  }
  console.log("[DEBUG] Supabase session:", session ? "present" : "missing", session ? "token length: " + (session.access_token?.length || 0) : "");
  return session?.access_token || null;
});

console.log("[DEBUG] Creating React root...");
createRoot(document.getElementById("root")!).render(<App />);
console.log("[DEBUG] React app rendered");
