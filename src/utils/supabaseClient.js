import { createClient } from "@supabase/supabase-js";

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Vite environment variables VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set.");
}

// Standard client — uses anon key + RLS for all users including Super Admin.
// The SA authenticates via Supabase auth (signInWithPassword) on login,
// so RLS sees is_super_admin = true in their profile for platform-wide access.
export const supabase = createClient(supabaseUrl || "", supabaseAnonKey || "");
