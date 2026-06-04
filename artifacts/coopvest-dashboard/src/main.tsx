import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl, setAuthTokenGetter } from "@workspace/api-client-react";
import { getAccessToken } from "@/lib/supabase";

// Initialize API client with the correct backend URL
// Note: Don't include /api here - the generated API client already adds /api prefix
const apiUrl = import.meta.env.VITE_API_BASE_URL || "https://coopvest-api-v3.onrender.com";
if (apiUrl) {
  setBaseUrl(apiUrl);
}

// Set up auth token getter for API calls
setAuthTokenGetter(getAccessToken);

createRoot(document.getElementById("root")!).render(<App />);
