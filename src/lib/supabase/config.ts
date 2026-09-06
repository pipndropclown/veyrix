export type SupabaseConfig = { url: string; publishableKey: string };

export function getSupabaseConfig(env: Record<string, string | undefined> = process.env): SupabaseConfig | null {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !publishableKey || !/^https:\/\//i.test(url)) return null;
  return { url, publishableKey };
}

export const isSupabaseConfigured = () => getSupabaseConfig() !== null;
