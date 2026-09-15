ALTER TABLE public.alunos ADD COLUMN IF NOT EXISTS data_nascimento date;

CREATE SEQUENCE IF NOT EXISTS public.alunos_matricula_seq AS bigint;

SELECT setval(
  'public.alunos_matricula_seq',
  GREATEST(
    COALESCE((SELECT MAX((matricula)::bigint) FROM public.alunos WHERE matricula ~ '^[0-9]+$'), 0),
    1
  )
);

ALTER TABLE public.alunos ALTER COLUMN matricula SET DEFAULT nextval('public.alunos_matricula_seq')::text;

GRANT USAGE, SELECT ON SEQUENCE public.alunos_matricula_seq TO authenticated;
GRANT ALL ON SEQUENCE public.alunos_matricula_seq TO service_role;