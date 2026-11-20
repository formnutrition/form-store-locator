import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { assertSupabaseServiceRoleConfigured } from "./supabase-env";

/**
 * Server-only Supabase client.
 * The browser never talks to Supabase. The public map calls /api/stores.
 */
if (typeof window !== "undefined") {
  throw new Error("src/lib/supabase.ts is server-only and was imported in the browser.");
}

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;
  const { url, serviceRoleKey } = assertSupabaseServiceRoleConfigured();
  client = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return client;
}
