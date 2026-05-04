
-- Enum de papéis
CREATE TYPE public.app_role AS ENUM ('diretor','gestor','professor','admin','rh');

-- Enums controle de acesso
CREATE TYPE public.acesso_tipo AS ENUM ('entrada','saida');
CREATE TYPE public.acesso_metodo AS ENUM ('biometria','manual');
CREATE TYPE public.acesso_status AS ENUM ('valido','invalido');
CREATE TYPE public.aluno_status AS ENUM ('ativo','inativo');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Função has_role (security definer)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Função para retornar papéis do usuário atual
CREATE OR REPLACE FUNCTION public.current_user_roles()
RETURNS SETOF public.app_role LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid()
$$;

-- Função para checar se atual é admin/diretor (alta gestão)
CREATE OR REPLACE FUNCTION public.is_gestao(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin','diretor','gestor','rh')
  )
$$;

-- Trigger para criar profile no signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE PLPGSQL SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email), NEW.email);
  -- papel padrão professor (mais restritivo); admin promove depois
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'professor');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE PLPGSQL AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Alunos
CREATE TABLE public.alunos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  matricula TEXT NOT NULL UNIQUE,
  curso TEXT NOT NULL,
  turma TEXT NOT NULL,
  status public.aluno_status NOT NULL DEFAULT 'ativo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
ALTER TABLE public.alunos ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER alunos_updated_at BEFORE UPDATE ON public.alunos
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_alunos_matricula ON public.alunos(matricula);

-- Acessos
CREATE TABLE public.acessos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id UUID REFERENCES public.alunos(id) ON DELETE SET NULL,
  matricula_tentada TEXT,
  tipo public.acesso_tipo NOT NULL,
  metodo public.acesso_metodo NOT NULL,
  status public.acesso_status NOT NULL,
  observacao TEXT,
  registrado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.acessos ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_acessos_created_at ON public.acessos(created_at DESC);
CREATE INDEX idx_acessos_aluno ON public.acessos(aluno_id);

-- ===== RLS POLICIES =====

-- profiles: usuário vê o próprio; gestão vê todos
CREATE POLICY "profiles_self_select" ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid() OR public.is_gestao(auth.uid()));
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_admin_update" ON public.profiles FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- user_roles: usuário vê os próprios; admin gerencia
CREATE POLICY "user_roles_self_select" ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "user_roles_admin_all" ON public.user_roles FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- alunos: qualquer autenticado lê (escola); gestão/admin/rh modifica
CREATE POLICY "alunos_select_auth" ON public.alunos FOR SELECT TO authenticated USING (true);
CREATE POLICY "alunos_insert_gestao" ON public.alunos FOR INSERT TO authenticated
WITH CHECK (public.is_gestao(auth.uid()));
CREATE POLICY "alunos_update_gestao" ON public.alunos FOR UPDATE TO authenticated
USING (public.is_gestao(auth.uid())) WITH CHECK (public.is_gestao(auth.uid()));
CREATE POLICY "alunos_delete_admin" ON public.alunos FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin'));

-- acessos: autenticado lê e insere; só admin deleta
CREATE POLICY "acessos_select_auth" ON public.acessos FOR SELECT TO authenticated USING (true);
CREATE POLICY "acessos_insert_auth" ON public.acessos FOR INSERT TO authenticated
WITH CHECK (registrado_por = auth.uid());
CREATE POLICY "acessos_delete_admin" ON public.acessos FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin'));
