import { createClient } from "@supabase/supabase-js";

// Prefer build-time Vite env, fall back to runtime-injected window.ENV_* values
const runtime = (typeof window !== "undefined" ? (window as any) : {}) as Record<string, any>;
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || runtime.ENV_VITE_SUPABASE_URL;
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || runtime.ENV_VITE_SUPABASE_ANON_KEY;

console.log("[DEBUG supabase] VITE_SUPABASE_URL:", supabaseUrl);
console.log("[DEBUG supabase] VITE_SUPABASE_ANON_KEY:", supabaseAnonKey ? "present" : "missing");

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("[Coopvest Dashboard] Missing Supabase environment variables. VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set (build-time or runtime via window.ENV_*).");
}

export const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

console.log("[DEBUG supabase] Supabase client initialized:", supabase ? "yes" : "no");

export async function getAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.warn("[supabase] getSession error:", error.message);
    return null;
  }
  return data.session?.access_token ?? null;
}
