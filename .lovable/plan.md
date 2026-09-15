# Reestruturar cadastro de alunos e importar a lista da planilha

## O que muda

- O cadastro do aluno passa a ter dados pessoais completos: nome, CPF, RG, gênero, idade, telefone, email, matrícula e PIS.
- Os cursos/turmas viram uma lista própria (22 turmas, ex. "Arte I - Manhã"), e cada aluno pode estar em várias delas, com a data de inscrição.
- Importação da planilha: 180 alunos únicos, 22 turmas e 356 vínculos aluno-turma.
- Os alunos de teste atuais são apagados antes da importação (junto com as batidas ligadas a eles).
- Matrícula gerada em sequência (1, 2, 3...) por ordem alfabética do nome.
- CPF e RG ficam em branco (os da planilha são fictícios); gênero, idade, telefone e email vêm da planilha quando existem.
- Cada aluno recebe um PIS válido gerado automaticamente (mesmo cálculo já usado no relógio).

## Interface

- Tela de Alunos: o formulário passa a ter os campos novos e uma lista de turmas com caixas de seleção para marcar em quais o aluno está.
- Na tabela de alunos, aparecem etiquetas com as turmas de cada aluno; a busca também encontra por turma.
- Os campos antigos "curso" e "turma" saem do formulário e da tabela, substituídos pelas turmas vinculadas.

## Detalhes técnicos

Migração (uma só):
- `cursos`: `id uuid pk`, `nome text unique not null`, `created_at`. GRANT select para `authenticated`/`anon`? — apenas `authenticated` + `service_role`; RLS: leitura para autenticados, escrita para `has_permission(auth.uid(),'alunos.update')`.
- `alunos`: adicionar `cpf text`, `rg text`, `genero text`, `idade text`, `telefone text`, `email text`; tornar `curso` e `turma` nulos (mantidos por compatibilidade, sem uso na UI).
- `aluno_cursos`: `aluno_id uuid fk alunos on delete cascade`, `curso_id uuid fk cursos on delete cascade`, `data_inscricao timestamptz`, PK composta. GRANT + RLS iguais aos de `cursos`.

Carga de dados (run_sql, após a migração):
- Apagar `acessos` e `alunos` existentes.
- Inserir os 22 cursos, os 180 alunos (matrícula sequencial, PIS calculado com DV MTE) e os 356 vínculos com a data de inscrição da planilha.

Frontend:
- `src/pages/Alunos.tsx`: schema zod ampliado, novos campos no formulário, seleção múltipla de cursos (checkboxes em área rolável), gravação dos vínculos em `aluno_cursos` (apagar e reinserir ao salvar), badges na tabela.
- `syncAluno` para o relógio continua usando nome, matrícula e PIS — sem alteração.
