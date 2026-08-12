import { createClient, SupabaseClient } from '@supabase/supabase-js';

let clientInstance: SupabaseClient | null = null;
let adminServerInstance: SupabaseClient | null = null;

function sanitizeSupabaseUrl(rawUrl?: string): string {
  if (!rawUrl) return "";
  let cleanUrl = rawUrl.trim();
  cleanUrl = cleanUrl.replace(/\/rest\/v1\/?$/i, "");
  cleanUrl = cleanUrl.replace(/\/+$/, "");
  return cleanUrl;
}

/**
 * Returns the public client-side Supabase instance.
 * Safe against missing environment variables.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (clientInstance) return clientInstance;

  const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as any).env : undefined;
  const rawUrl = metaEnv?.VITE_SUPABASE_URL || (typeof process !== 'undefined' ? process.env.VITE_SUPABASE_URL : undefined);
  const anonKey = metaEnv?.VITE_SUPABASE_ANON_KEY || (typeof process !== 'undefined' ? process.env.VITE_SUPABASE_ANON_KEY : undefined);
  const url = sanitizeSupabaseUrl(rawUrl);

  if (!url || !anonKey) {
    return null;
  }

  try {
    clientInstance = createClient(url, anonKey);
    return clientInstance;
  } catch (err) {
    console.warn("[SUPABASE_CLIENT] Failed to initialize client-side Supabase:", err);
    return null;
  }
}

/**
 * Returns the admin server-side Supabase instance using Service Role key.
 * MUST only be called in server environments (API routes, server.ts).
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (adminServerInstance) return adminServerInstance;

  const rawUrl = typeof process !== 'undefined' ? (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) : undefined;
  const serviceKey = typeof process !== 'undefined' ? process.env.SUPABASE_SERVICE_ROLE_KEY : undefined;
  const url = sanitizeSupabaseUrl(rawUrl);

  if (!url || !serviceKey) {
    return null;
  }

  try {
    adminServerInstance = createClient(url, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    return adminServerInstance;
  } catch (err) {
    console.warn("[SUPABASE_ADMIN] Failed to initialize server-side admin Supabase:", err);
    return null;
  }
}
