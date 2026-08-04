import { createClient } from "@supabase/supabase-js";

// Use hardcoded values for the Coopvest project to ensure correct configuration
const SUPABASE_URL = "https://nyoauzqezpxeonmrxxgi.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55b2F1enFlenB4ZW9ubXJ4eGdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyODI3MzUsImV4cCI6MjA4OTg1ODczNX0.5WfECoO2Xu5VfBzFbQd2CA8rIeBVnOkiKmnnbYRA8VU";

console.log("[DEBUG supabase] URL:", SUPABASE_URL);
console.log("[DEBUG supabase] ANON_KEY: present");

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log("[DEBUG supabase] Supabase client initialized: yes");

export async function getAccessToken(): Promise<string | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.warn("[supabase] getSession error:", error.message);
    return null;
  }
  return data.session?.access_token ?? null;
}
