import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl, setAuthTokenGetter, setServiceToken } from "@/lib/api-client";
import { supabase } from "@/lib/supabase";

// Resolve the API base URL from environment, falling back to the Render backend.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://coopvest-api.onrender.com";
setBaseUrl(API_BASE_URL);

// Supply Supabase session tokens so the generated admin API client can
// authenticate requests against the backend (which validates Supabase JWTs).
setAuthTokenGetter(async () => {
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
});

createRoot(document.getElementById("root")!).render(<App />);
