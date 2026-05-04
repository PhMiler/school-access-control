
-- ============================================================
-- 1. Drop old role-based system policies that block changes
-- ============================================================
DROP POLICY IF EXISTS alunos_insert_gestao ON public.alunos;
DROP POLICY IF EXISTS alunos_update_gestao ON public.alunos;
DROP POLICY IF EXISTS alunos_delete_admin ON public.alunos;
DROP POLICY IF EXISTS acessos_insert_auth ON public.acessos;
DROP POLICY IF EXISTS acessos_delete_admin ON public.acessos;
DROP POLICY IF EXISTS profiles_admin_update ON public.profiles;
DROP POLICY IF EXISTS profiles_self_select ON public.profiles;
DROP POLICY IF EXISTS profiles_self_update ON public.profiles;
DROP POLICY IF EXISTS user_roles_admin_all ON public.user_roles;
DROP POLICY IF EXISTS user_roles_self_select ON public.user_roles;

-- ============================================================
-- 2. Permissions registry
-- ============================================================
CREATE TABLE public.permissions (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  categoria TEXT NOT NULL
);
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY permissions_read_auth ON public.permissions FOR SELECT TO authenticated USING (true);

INSERT INTO public.permissions(key,label,categoria) VALUES
  ('dashboard.view','Acessar dashboard','Geral'),
  ('usuarios.view','Visualizar usuários','Usuários'),
  ('usuarios.create','Cadastrar usuários','Usuários'),
  ('usuarios.update','Editar usuários','Usuários'),
  ('usuarios.delete','Excluir usuários','Usuários'),
  ('perfis.manage','Gerenciar perfis de acesso','Perfis'),
  ('alunos.view','Visualizar alunos','Alunos'),
  ('alunos.create','Cadastrar alunos','Alunos'),
  ('alunos.update','Editar alunos','Alunos'),
  ('alunos.delete','Excluir alunos','Alunos'),
  ('relatorios.view','Visualizar relatórios','Relatórios'),
  ('acesso.registrar','Registrar entrada/saída','Controle de acesso');

-- ============================================================
-- 3. Access profiles + profile_permissions
-- ============================================================
CREATE TABLE public.access_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  descricao TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.access_profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.profile_permissions (
  profile_id UUID NOT NULL REFERENCES public.access_profiles(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL REFERENCES public.permissions(key) ON DELETE CASCADE,
  PRIMARY KEY (profile_id, permission_key)
);
ALTER TABLE public.profile_permissions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. Extend profiles
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN numero_usuario TEXT UNIQUE,
  ADD COLUMN access_profile_id UUID REFERENCES public.access_profiles(id),
  ADD COLUMN ativo BOOLEAN NOT NULL DEFAULT true;

-- ============================================================
-- 5. Helper functions (security definer)
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.access_profiles ap ON ap.id = p.access_profile_id
    WHERE p.id = _uid AND ap.is_admin = true AND p.ativo = true
  )
$$;

CREATE OR REPLACE FUNCTION public.has_permission(_uid uuid, _key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.access_profiles ap ON ap.id = p.access_profile_id
    LEFT JOIN public.profile_permissions pp ON pp.profile_id = ap.id AND pp.permission_key = _key
    WHERE p.id = _uid AND p.ativo = true
      AND (ap.is_admin = true OR pp.permission_key IS NOT NULL)
  )
$$;

CREATE OR REPLACE FUNCTION public.current_user_permissions()
RETURNS text[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _is_admin boolean;
BEGIN
  IF _uid IS NULL THEN RETURN ARRAY[]::text[]; END IF;
  SELECT ap.is_admin INTO _is_admin
  FROM public.profiles p
  JOIN public.access_profiles ap ON ap.id = p.access_profile_id
  WHERE p.id = _uid AND p.ativo = true;
  IF _is_admin IS NULL THEN RETURN ARRAY[]::text[]; END IF;
  IF _is_admin THEN
    RETURN ARRAY(SELECT key FROM public.permissions);
  END IF;
  RETURN ARRAY(
    SELECT pp.permission_key
    FROM public.profiles p
    JOIN public.profile_permissions pp ON pp.profile_id = p.access_profile_id
    WHERE p.id = _uid
  );
END $$;

-- Resolve identifier (email | numero_usuario | nome) into email for login
CREATE OR REPLACE FUNCTION public.resolve_login_identifier(_identifier text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT email FROM public.profiles
  WHERE ativo = true AND (
    lower(email) = lower(_identifier)
    OR numero_usuario = _identifier
    OR lower(nome) = lower(_identifier)
  )
  LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.resolve_login_identifier(text) TO anon, authenticated;

-- ============================================================
-- 6. RLS policies
-- ============================================================
-- profiles
CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY profiles_self_update ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid() AND access_profile_id = (SELECT access_profile_id FROM public.profiles WHERE id = auth.uid()));
-- admin manages profiles via edge function (service role) — no client INSERT/DELETE policies

-- access_profiles
CREATE POLICY access_profiles_read ON public.access_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY access_profiles_admin_all ON public.access_profiles FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- profile_permissions
CREATE POLICY profile_permissions_read ON public.profile_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY profile_permissions_admin_all ON public.profile_permissions FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- alunos
CREATE POLICY alunos_insert ON public.alunos FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'alunos.create'));
CREATE POLICY alunos_update ON public.alunos FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'alunos.update'))
  WITH CHECK (public.has_permission(auth.uid(), 'alunos.update'));
CREATE POLICY alunos_delete ON public.alunos FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(), 'alunos.delete'));

-- acessos
CREATE POLICY acessos_insert ON public.acessos FOR INSERT TO authenticated
  WITH CHECK (registrado_por = auth.uid() AND public.has_permission(auth.uid(), 'acesso.registrar'));
CREATE POLICY acessos_delete_admin ON public.acessos FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- ============================================================
-- 7. updated_at triggers
-- ============================================================
CREATE TRIGGER access_profiles_updated_at
  BEFORE UPDATE ON public.access_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 8. Seed default profiles (system)
-- ============================================================
INSERT INTO public.access_profiles(nome, descricao, is_system, is_admin) VALUES
  ('Administrador','Acesso total ao sistema', true, true),
  ('Diretor','Gestão institucional ampla', true, false),
  ('Gestor','Gestão operacional de alunos e acessos', true, false),
  ('Professor','Visualização de alunos e registro de acessos', true, false),
  ('RH','Gestão de cadastros institucionais', true, false);

-- Seed permissions for each non-admin profile
INSERT INTO public.profile_permissions(profile_id, permission_key)
SELECT ap.id, pk FROM public.access_profiles ap, unnest(ARRAY[
  'dashboard.view','alunos.view','alunos.create','alunos.update','relatorios.view','acesso.registrar'
]) pk WHERE ap.nome = 'Diretor';

INSERT INTO public.profile_permissions(profile_id, permission_key)
SELECT ap.id, pk FROM public.access_profiles ap, unnest(ARRAY[
  'dashboard.view','alunos.view','alunos.create','alunos.update','relatorios.view','acesso.registrar'
]) pk WHERE ap.nome = 'Gestor';

INSERT INTO public.profile_permissions(profile_id, permission_key)
SELECT ap.id, pk FROM public.access_profiles ap, unnest(ARRAY[
  'dashboard.view','alunos.view','acesso.registrar'
]) pk WHERE ap.nome = 'Professor';

INSERT INTO public.profile_permissions(profile_id, permission_key)
SELECT ap.id, pk FROM public.access_profiles ap, unnest(ARRAY[
  'dashboard.view','alunos.view','alunos.create','alunos.update','relatorios.view'
]) pk WHERE ap.nome = 'RH';

-- ============================================================
-- 9. Drop legacy role system (no longer used)
-- ============================================================
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.has_role(uuid, app_role) CASCADE;
DROP FUNCTION IF EXISTS public.is_gestao(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.current_user_roles() CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TYPE IF EXISTS public.app_role CASCADE;
