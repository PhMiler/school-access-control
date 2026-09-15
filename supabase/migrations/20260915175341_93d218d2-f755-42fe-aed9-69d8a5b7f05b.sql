CREATE TABLE public.cursos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cursos TO authenticated;
GRANT ALL ON public.cursos TO service_role;
ALTER TABLE public.cursos ENABLE ROW LEVEL SECURITY;
CREATE POLICY cursos_select_auth ON public.cursos FOR SELECT TO authenticated USING (true);
CREATE POLICY cursos_write ON public.cursos FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'alunos.update'))
  WITH CHECK (public.has_permission(auth.uid(), 'alunos.update'));
CREATE TRIGGER cursos_updated_at BEFORE UPDATE ON public.cursos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.alunos
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS rg text,
  ADD COLUMN IF NOT EXISTS genero text,
  ADD COLUMN IF NOT EXISTS idade text,
  ADD COLUMN IF NOT EXISTS telefone text,
  ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.alunos ALTER COLUMN curso DROP NOT NULL;
ALTER TABLE public.alunos ALTER COLUMN turma DROP NOT NULL;

CREATE TABLE public.aluno_cursos (
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  curso_id uuid NOT NULL REFERENCES public.cursos(id) ON DELETE CASCADE,
  data_inscricao timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (aluno_id, curso_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.aluno_cursos TO authenticated;
GRANT ALL ON public.aluno_cursos TO service_role;
ALTER TABLE public.aluno_cursos ENABLE ROW LEVEL SECURITY;
CREATE POLICY aluno_cursos_select_auth ON public.aluno_cursos FOR SELECT TO authenticated USING (true);
CREATE POLICY aluno_cursos_write ON public.aluno_cursos FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'alunos.update'))
  WITH CHECK (public.has_permission(auth.uid(), 'alunos.update'));