import { createClient, SupabaseClientOptions } from '@supabase/supabase-js';
import WebSocket from 'ws';

// Node.js < 22 lacks native WebSocket; supabase-js's realtime client needs one
// even when we don't use realtime features. Inject `ws` as the transport.
const clientOptions: SupabaseClientOptions<'public'> = {
  realtime: { transport: WebSocket as unknown as typeof globalThis.WebSocket },
};

export function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    clientOptions
  );
}

export function createSupabasePublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    clientOptions
  );
}
