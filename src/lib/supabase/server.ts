import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getSupabaseConfig } from "./config";

export async function getServerSupabase(): Promise<SupabaseClient | null> {
  const config = getSupabaseConfig();
  if (!config) return null;
  const cookieStore = await cookies();
  return createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(values) { try { values.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch { /* readonly render */ } },
    },
  });
}
