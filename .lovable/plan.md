# Enviar PIS válido no cadastro do aluno no relógio iDClass

## Objetivo
O firmware do iDClass exige um PIS válido (11 dígitos com dígito verificador) em `/add_users.fcgi`. Vamos gerar um PIS válido por aluno, guardá-lo no cadastro e enviá-lo na sincronização.

## Mudanças

1. **Banco: nova coluna `pis` na tabela de alunos**
   - Campo de texto, opcional, único.
   - Guarda o PIS gerado uma única vez, para que o mesmo aluno sempre use o mesmo PIS no relógio (as batidas do AFD são identificadas pelo PIS — se o PIS mudasse a cada sincronização, a importação deixaria de reconhecer o aluno).

2. **`src/lib/controlid.ts`**
   - Nova função auxiliar `gerarPis()`: gera 10 dígitos aleatórios e calcula o 11º (dígito verificador) com os pesos oficiais 3-2-9-8-7-6-5-4-3-2 e a regra `11 - (soma % 11)` (resultado 10 ou 11 vira 0).
   - `AlunoParaSincronizar` ganha o campo opcional `pis`.
   - `syncAluno` passa a enviar `{ users: [{ name, registration, pis }] }`, com `pis` como string de 11 dígitos: usa `aluno.pis` se existir, senão gera um na hora.

3. **`src/pages/Alunos.tsx`**
   - Ao salvar um aluno sem PIS: gera o PIS, grava na ficha do aluno e usa esse mesmo valor na sincronização com o relógio.
   - O PIS passa a aparecer na ficha/lista do aluno (somente leitura), junto à matrícula.

## Detalhes técnicos
- Dígito verificador do PIS: soma ponderada dos 10 primeiros dígitos pelos pesos `[3,2,9,8,7,6,5,4,3,2]`; `d = 11 - (soma % 11)`; se `d >= 10`, `d = 0`.
- Payload final: `POST /add_users.fcgi?session=[SESSION]` com `{"users":[{"name":"NOME","registration":"MATRICULA","pis":"12345678901"}]}`.
- Migração simples: `ALTER TABLE public.alunos ADD COLUMN pis text;` com índice único parcial (apenas valores não nulos).
- O mapa PIS → matrícula de `src/lib/controlidImport.ts` continua funcionando: como o PIS fica gravado no aluno e no relógio, a importação das batidas casa corretamente.

## Validação
- Verificação de tipos/build.
- Teste no navegador: salvar aluno novo (PIS gerado e gravado), conferir indicador de sincronização e a mensagem amigável quando o relógio não responde.
- O teste real contra o equipamento depende da rede do usuário.
