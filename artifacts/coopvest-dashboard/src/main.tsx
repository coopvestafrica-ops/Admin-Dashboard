import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl, setAuthTokenGetter } from "@/lib/api-client";
import { getApiBaseUrl } from "@/lib/api";

// Initialize API client with the correct backend URL
// Backend routes are at /api/v2/admin/*, but API client uses /api/*
const baseUrl = `${getApiBaseUrl()}/api/v2/admin`;
setBaseUrl(baseUrl);

// Set up auth token getter for API calls using the api-client format
setAuthTokenGetter(async () => {
  const { supabase } = await import("@/lib/supabase");
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
});

createRoot(document.getElementById("root")!).render(<App />);
