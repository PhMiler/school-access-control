import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const schema = z.object({
  nome: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  numero_usuario: z.string().trim().min(1).max(40),
  password: z.string().min(6).max(72),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // Find admin profile
  const { data: adminProfile } = await admin
    .from("access_profiles").select("id").eq("is_admin", true).maybeSingle();
  if (!adminProfile) return json({ error: "Perfil Administrador inexistente" }, 500);

  // Check if any user with admin profile already exists
  const { data: existing } = await admin
    .from("profiles").select("id").eq("access_profile_id", adminProfile.id).limit(1).maybeSingle();
  if (existing) return json({ error: "Setup já realizado" }, 403);

  let body: unknown;
  try { body = await req.json(); } catch { return json({ error: "JSON inválido" }, 400); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
  const p = parsed.data;

  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email: p.email, password: p.password, email_confirm: true,
    user_metadata: { nome: p.nome },
  });
  if (cErr || !created.user) return json({ error: cErr?.message ?? "Falha" }, 400);

  const { error: pErr } = await admin.from("profiles").insert({
    id: created.user.id, nome: p.nome, email: p.email,
    numero_usuario: p.numero_usuario,
    access_profile_id: adminProfile.id,
    ativo: true,
  });
  if (pErr) {
    await admin.auth.admin.deleteUser(created.user.id);
    return json({ error: pErr.message }, 400);
  }
  return json({ ok: true });
});
