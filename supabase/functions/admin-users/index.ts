import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const baseSchema = z.object({
  action: z.enum(["create", "update", "delete"]),
  id: z.string().uuid().optional(),
  nome: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().email().max(255).optional(),
  numero_usuario: z.string().trim().min(1).max(40).optional(),
  password: z.string().min(6).max(72).optional(),
  access_profile_id: z.string().uuid().optional(),
  ativo: z.boolean().optional(),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Traduz erros conhecidos (acionáveis pelo usuário) para PT-BR; qualquer outro erro
// (interno/infra) é logado no servidor e só uma mensagem genérica volta ao cliente.
function safeMessage(err: unknown, context: string): string {
  const raw = (err as { message?: string })?.message ?? String(err);
  console.error(`[admin-users:${context}]`, raw);

  if (/already been registered|already registered|user_already_exists/i.test(raw)) {
    return "Já existe um usuário cadastrado com esse e-mail.";
  }
  if (/duplicate key.*numero_usuario|profiles_numero_usuario/i.test(raw)) {
    return "Número de usuário já em uso.";
  }
  if (/invalid format|unable to validate email/i.test(raw)) {
    return "E-mail inválido.";
  }
  if (/password.*(least|characters|weak)/i.test(raw)) {
    return "Senha muito fraca. Use pelo menos 6 caracteres.";
  }
  if (/foreign key constraint/i.test(raw)) {
    return "Não é possível concluir: este usuário ainda possui registros vinculados.";
  }
  return "Não foi possível concluir a operação. Tente novamente em instantes.";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Missing token" }, 401);

  // Verify caller and check admin
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) return json({ error: "Invalid session" }, 401);
  const callerId = userData.user.id;

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // Check caller is admin via is_admin function
  const { data: isAdmin } = await admin.rpc("is_admin", { _uid: callerId });
  if (!isAdmin) return json({ error: "Forbidden" }, 403);

  let body: unknown;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const parsed = baseSchema.safeParse(body);
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
  const p = parsed.data;

  try {
    if (p.action === "create") {
      if (!p.nome || !p.email || !p.numero_usuario || !p.password || !p.access_profile_id) {
        return json({ error: "Campos obrigatórios ausentes" }, 400);
      }
      // Check duplicate numero_usuario
      const { data: dup } = await admin.from("profiles").select("id").eq("numero_usuario", p.numero_usuario).maybeSingle();
      if (dup) return json({ error: "Número de usuário já em uso" }, 400);

      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email: p.email, password: p.password, email_confirm: true,
        user_metadata: { nome: p.nome },
      });
      if (cErr || !created.user) return json({ error: safeMessage(cErr ?? new Error("Falha ao criar"), "create.createUser") }, 400);

      // O trigger on_auth_user_created já insere uma linha base em profiles; completar com upsert
      const { error: pErr } = await admin.from("profiles").upsert({
        id: created.user.id,
        nome: p.nome, email: p.email,
        numero_usuario: p.numero_usuario,
        access_profile_id: p.access_profile_id,
        ativo: p.ativo ?? true,
      });
      if (pErr) {
        await admin.auth.admin.deleteUser(created.user.id);
        return json({ error: safeMessage(pErr, "create.profiles") }, 400);
      }
      return json({ ok: true, id: created.user.id });
    }

    if (p.action === "update") {
      if (!p.id) return json({ error: "ID obrigatório" }, 400);
      const updates: Record<string, unknown> = {};
      if (p.nome !== undefined) updates.nome = p.nome;
      if (p.email !== undefined) updates.email = p.email;
      if (p.numero_usuario !== undefined) updates.numero_usuario = p.numero_usuario;
      if (p.access_profile_id !== undefined) updates.access_profile_id = p.access_profile_id;
      if (p.ativo !== undefined) updates.ativo = p.ativo;

      const authUpdates: Record<string, unknown> = {};
      if (p.email !== undefined) authUpdates.email = p.email;
      if (p.password) authUpdates.password = p.password;
      if (Object.keys(authUpdates).length > 0) {
        const { error } = await admin.auth.admin.updateUserById(p.id, authUpdates as any);
        if (error) return json({ error: safeMessage(error, "update.auth") }, 400);
      }
      if (Object.keys(updates).length > 0) {
        const { error } = await admin.from("profiles").update(updates).eq("id", p.id);
        if (error) return json({ error: safeMessage(error, "update.profiles") }, 400);
      }
      return json({ ok: true });
    }

    if (p.action === "delete") {
      if (!p.id) return json({ error: "ID obrigatório" }, 400);
      if (p.id === callerId) return json({ error: "Não é possível excluir você mesmo" }, 400);
      // hard delete pode falhar com "Database error loading user" em contas com histórico; soft delete evita isso
      const { error: dErr } = await admin.auth.admin.deleteUser(p.id, true);
      if (dErr) return json({ error: safeMessage(dErr, "delete.auth") }, 400);
      await admin.from("profiles").delete().eq("id", p.id);
      return json({ ok: true });
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (e: any) {
    return json({ error: safeMessage(e, "unhandled") }, 500);
  }
});
