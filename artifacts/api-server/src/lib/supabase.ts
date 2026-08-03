import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"] || "https://nyoauzqezpxeonmrxxgi.supabase.co";
const supabaseKey = process.env["SUPABASE_SERVICE_ROLE_KEY"] || process.env["VITE_SUPABASE_SERVICE_ROLE_KEY"] || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55b2F1enFlenB4ZW9ubXJ4eGdpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDI4MjczNSwiZXhwIjoyMDg5ODU4NzM1fQ.zCX5ZMW42kwjszRmT6HREZOCjTs5z7ZlXidK4BM-coM";

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase configuration:", { 
    hasUrl: !!supabaseUrl, 
    hasKey: !!supabaseKey,
    urlEnv: process.env["SUPABASE_URL"] ? "set" : "not set",
    viteUrlEnv: process.env["VITE_SUPABASE_URL"] ? "set" : "not set",
    keyEnv: process.env["SUPABASE_SERVICE_ROLE_KEY"] ? "set" : "not set",
    viteKeyEnv: process.env["VITE_SUPABASE_SERVICE_ROLE_KEY"] ? "set" : "not set"
  });
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_* equivalents) must be set.");
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);
export { createClient };

export function splitName(name: string | null): { firstName: string; lastName: string } {
  if (!name) return { firstName: "", lastName: "" };
  const parts = name.trim().split(/\s+/);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") || "" };
}

export function deriveStatus(row: { is_active?: boolean; is_flagged?: boolean; kyc_verified?: boolean }): string {
  if (row.is_flagged) return "suspended";
  if (!row.is_active) return "inactive";
  if (row.kyc_verified) return "active";
  return "pending";
}
