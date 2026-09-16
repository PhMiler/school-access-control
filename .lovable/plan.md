# Migrar o EduControl para o seu próprio Supabase

Objetivo: você roda o app fora daqui (no seu computador ou em qualquer hospedagem), com o banco na **sua** conta Supabase, sem depender desta plataforma.

## O que eu vou preparar para você

Um pacote de arquivos para baixar, com:

1. **`01-estrutura.sql`** — cria tudo do zero no seu banco: tabelas (alunos, cursos, aluno_cursos, acessos, profiles, access_profiles, permissions, profile_permissions), tipos, sequência da matrícula, permissões de acesso (RLS), funções e gatilhos.
2. **`02-dados.sql`** — todos os dados atuais: 22 turmas, 180 alunos (com matrícula e PIS), os 356 vínculos aluno-turma, as batidas já registradas e as fichas de usuário do sistema.
3. **`03-usuarios-login.sql`** — as contas de login (e-mail e senha atuais) recriadas no seu Supabase.
4. **`GUIA-MIGRACAO.md`** — passo a passo, em português, com:
   - onde colar cada arquivo no painel do Supabase (SQL Editor);
   - onde pegar as duas chaves do seu projeto e o que escrever no arquivo `.env`;
   - como publicar as duas funções de servidor (criação de administrador e gestão de usuários);
   - como rodar o app localmente (`npm install` e `npm run dev`);
   - o que conferir no final (login, alunos, turmas, relógio) e como resolver os erros mais comuns.
5. **`.env.exemplo`** — modelo do arquivo de configuração, com os campos vazios prontos para preencher.

## Sobre as senhas de login

As senhas ficam guardadas de forma criptografada numa área protegida do banco, que eu não consigo ler daqui por segurança. Então há dois caminhos, e o guia cobre os dois:

- **Caminho principal:** o guia inclui um comando que recria as contas de login (inclusive a `acesso`) já com senha definida por você no momento da execução — cada pessoa entra com a senha nova e pode trocar depois.
- **Alternativa:** apagar as contas e usar a tela `/setup` do próprio sistema para criar o administrador, e depois recadastrar os usuários na tela de Usuários.

Em qualquer um dos casos, os alunos, turmas, vínculos e batidas vão completos e ligados corretamente.

## Também incluído no guia

- Como conectar o relógio iDClass (IP, login e senha) na instalação nova.
- Aviso: o relógio é acessado pelo navegador na rede local, então o app precisa rodar em um computador na mesma rede do equipamento.
- Como hospedar o app depois (pasta gerada por `npm run build` em qualquer hospedagem estática), e o que muda no `.env` nesse caso.

## Detalhes técnicos

- O `01-estrutura.sql` será a consolidação das migrações em `supabase/migrations/`, já com os `GRANT` para `authenticated`/`service_role`, RLS e as funções `has_permission`, `is_admin`, `current_user_permissions`, `resolve_login_identifier`, `set_updated_at`.
- O `02-dados.sql` será gerado a partir das tabelas atuais como `INSERT`s, na ordem correta de dependência.
- As funções de servidor (`supabase/functions/admin-users` e `bootstrap-admin`) continuam no projeto; o guia mostra o deploy com a CLI do Supabase (`supabase link` + `supabase functions deploy`) e a configuração de `verify_jwt` conforme o `config.toml`.
- O `.env` usa `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` e `VITE_SUPABASE_PROJECT_ID` do seu projeto.
- Nenhum arquivo do app precisa ser alterado no código — a troca é só de configuração.
- Os arquivos ficam disponíveis para download na área de Arquivos.
