import { createClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client for Diana's OS.
 *
 * All data access in the app is server-side (server components + route
 * handlers), so we use the SERVICE ROLE key when it's available. That key:
 *   - bypasses Row Level Security (so the app reads/writes normally), and
 *   - is NEVER exposed to the browser (it is not a NEXT_PUBLIC_ var).
 *
 * With RLS enabled on every table and no public policies, the database is then
 * locked to everything except this server. Falls back to the anon key if the
 * service role key isn't set (works only while RLS is off). Returns null when
 * nothing is configured → callers use sample data.
 */
export function getSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const key = serviceKey || anonKey;
  if (!url || !key) return null;

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  );
}
