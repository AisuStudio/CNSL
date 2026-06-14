// SERVER-ONLY Supabase admin client (service-role key = full auth/DB admin).
//
// ⚠️ NEVER import this from a client component or anything that ships to the
// browser. The service-role key bypasses RLS and can delete any user. It is
// read from a non-public env var (SUPABASE_SERVICE_ROLE_KEY) so it is never in
// the client bundle. Used only by trusted server routes (e.g. account deletion).
import { createClient } from "@supabase/supabase-js";

export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Supabase admin client needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
