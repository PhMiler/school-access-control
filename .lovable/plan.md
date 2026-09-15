# Corrigir erro 400 ao sincronizar aluno no relógio Control iD

## Causa provável

O payload atual em `src/lib/controlid.ts` (`syncAluno`) já segue a estrutura oficial (`object: "users"` + array `values` com `name` e `registration` como string, `Content-Type: application/json`, sessão na query), porém envia também `password: ""`. O campo extra com string vazia é rejeitado por alguns firmwares do iDClass com erro 400 — a documentação usa apenas `registration`, `name` e (opcionalmente) um password real, nunca vazio.

## Mudanças (somente `src/lib/controlid.ts`)

1. **`syncAluno`**: enviar apenas `name` e `registration` no objeto do array `values`, com `registration: String(aluno.matricula)` garantindo tipo string. Nenhum `id` manual — o relógio autogera. Sem `password`.
2. **Diagnóstico de erro no `post()`**: quando o relógio responder com erro HTTP, incluir o corpo da resposta (ex.: mensagem do firmware) na exceção, para que futuros erros apareçam completos nos avisos da tela em vez de só "erro 400".
3. **Fallback de reenvio**: se o `create_objects` falhar com 400, reenviar uma única vez com `password: ""` incluído — cobre firmwares que, ao contrário, exigem o campo presente.

## O que não muda

- Estrutura do body (`object`/`values`), header `Content-Type: application/json`, sessão via query string, cache de sessão com re-login automático, timeout de 8s e `mode: 'cors'` permanecem como estão.
- Páginas, rotas, fluxo de cadastro de alunos e importação de batidas não são alterados.

## Verificação

- Checar build sem erros.
- Revisar o payload final montado por `syncAluno` (code review +, se possível, teste com o relógio real na rede do cliente — o sandbox não alcança o equipamento).
