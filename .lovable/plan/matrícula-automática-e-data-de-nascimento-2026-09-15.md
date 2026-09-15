# Matrícula automática e data de nascimento

## O que muda no cadastro

- O campo de matrícula sai do formulário. Ao salvar um novo aluno, o sistema gera o próximo número da sequência automaticamente (continua de 181, seguindo os 180 já importados). Na lista a matrícula continua aparecendo.
- Novo campo **Data de nascimento** (seletor de calendário).
- A **idade** passa a ser calculada a partir da data de nascimento e se atualiza sozinha com o passar do tempo. Quem tem data de nascimento não terá mais campo de idade digitável; para os alunos importados da planilha (que só têm idade em número), a idade já cadastrada continua sendo exibida até que uma data de nascimento seja informada.
- Obrigatórios ao cadastrar: **nome, gênero, idade (via data de nascimento), telefone e pelo menos um curso**. CPF, RG e e-mail seguem opcionais.

## Como fica na tela

- Formulário: Nome, Data de nascimento (idade mostrada ao lado, calculada), Gênero (lista: Feminino, Masculino, Outro), Telefone, Status, CPF, RG, E-mail, e as caixas de seleção de cursos.
- Se o usuário tentar salvar sem nome, data de nascimento, gênero, telefone ou curso, aparece um aviso indicando o campo faltante.

## Detalhes técnicos

Banco de dados (uma migração):
- `alunos.data_nascimento date` (nulo permitido, para os registros antigos).
- Sequência `alunos_matricula_seq` iniciada em 181 e `alunos.matricula` com default `nextval(...)::text`, mantendo a coluna `text` e o índice único atual.
- Gênero fica como texto livre no banco; a restrição de valores é só na interface.

Frontend (`src/pages/Alunos.tsx`):
- Remove o input de matrícula e não envia `matricula` no insert (usa o default do banco); no update a matrícula permanece intocada.
- Adiciona `data_nascimento` ao `Aluno`, ao schema zod e ao payload; usa o Datepicker shadcn (Popover + Calendar com `pointer-events-auto`).
- Helper `calcularIdade(dataNascimento)` (ano/mês/dia) usado na tabela e no formulário; `idade` é gravada como texto derivado no salvamento para manter compatibilidade com os dados importados.
- Validação: `genero`, `telefone`, `data_nascimento` obrigatórios e `selecionados.length > 0` antes de salvar.
- A sincronização com o relógio continua igual; após o insert o id e a matrícula gerada são lidos de volta (`.select("id,matricula")`) para enviar ao relógio.
