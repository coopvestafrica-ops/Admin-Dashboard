import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl, setAuthTokenGetter } from "@workspace/api-client-react";
import { getAccessToken } from "@/lib/supabase";

// Initialize API client with the correct backend URL
const apiUrl = import.meta.env.VITE_API_BASE_URL;
if (apiUrl) {
  setBaseUrl(apiUrl);
}

// Set up auth token getter for API calls
setAuthTokenGetter(getAccessToken);

createRoot(document.getElementById("root")!).render(<App />);
