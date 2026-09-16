-- Permite excluir usuários mesmo que tenham registrado acessos: preserva o histórico, apenas zera o autor
ALTER TABLE public.acessos DROP CONSTRAINT IF EXISTS acessos_registrado_por_fkey;
ALTER TABLE public.acessos
  ADD CONSTRAINT acessos_registrado_por_fkey
  FOREIGN KEY (registrado_por) REFERENCES auth.users(id) ON DELETE SET NULL;
