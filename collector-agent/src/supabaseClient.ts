import { createClient } from "@supabase/supabase-js";
import { env } from "./env";

/** Client com a Service Role Key: roda só neste agente local, nunca em código de navegador. */
export const supabase = createClient(env.supabase.url, env.supabase.serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
