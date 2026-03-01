import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function publicKey(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
    ''
  );
}

const GLOBAL_KEY = '__credit_supabase_browser__';

let serverSingleton: SupabaseClient | null = null;

export function supabaseBrowser(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = publicKey();
  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
  if (!key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY');

  // During Next.js prerendering, client components can still render on the server.
  // We return a non-persistent client in that case.
  if (typeof window === 'undefined') {
    if (serverSingleton) return serverSingleton;
    serverSingleton = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });
    return serverSingleton;
  }

  const g = globalThis as any;
  const existing = g[GLOBAL_KEY] as SupabaseClient | undefined;
  if (existing) return existing;

  const client = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });

  // In dev, Next.js HMR can re-evaluate modules; stash a singleton on globalThis.
  g[GLOBAL_KEY] = client;
  return client;
}
