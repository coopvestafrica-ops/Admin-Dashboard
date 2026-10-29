import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl, setAuthTokenGetter, setServiceToken, setSessionReclaimer } from "@/lib/api-client";
import { syncSessionWithBackend } from "@/lib/api";
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

// The backend allows one active session per profile. When a request is
// rejected with 401 SESSION_REPLACED (the session was claimed elsewhere),
// re-claim it so the client retries instead of surfacing a load error.
setSessionReclaimer(() => syncSessionWithBackend());

createRoot(document.getElementById("root")!).render(<App />);
