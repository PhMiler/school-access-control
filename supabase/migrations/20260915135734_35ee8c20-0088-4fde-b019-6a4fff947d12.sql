ALTER TABLE public.alunos ADD COLUMN IF NOT EXISTS pis text;
CREATE UNIQUE INDEX IF NOT EXISTS alunos_pis_unique ON public.alunos (pis) WHERE pis IS NOT NULL;