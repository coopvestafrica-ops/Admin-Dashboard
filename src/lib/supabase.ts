import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

console.log("[DEBUG supabase] VITE_SUPABASE_URL:", supabaseUrl);
console.log("[DEBUG supabase] VITE_SUPABASE_ANON_KEY:", supabaseAnonKey ? "present" : "missing");

// Validate required environment variables - show warning in console but don't crash
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("[Coopvest Dashboard] Missing Supabase environment variables. VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set.");
}

// Create client only if credentials exist, otherwise use null
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

console.log("[DEBUG supabase] Supabase client initialized:", supabase ? "yes" : "no");

export async function getAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
