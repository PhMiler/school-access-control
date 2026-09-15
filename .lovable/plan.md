# Ler corretamente as batidas do arquivo do relógio

O arquivo foi baixado (43.795 linhas), mas nenhuma batida foi reconhecida: o programa procurava o "3" no primeiro caractere da linha, e no seu equipamento ele está na 10ª posição.

## O que será feito

1. **Nova regra de leitura das linhas de batida**: considerar batida toda linha com pelo menos 34 caracteres cujo 10º caractere seja "3", lendo:
   - data nos caracteres 11 a 18 (DDMMAAAA)
   - hora nos caracteres 19 a 22 (HHMM)
   - PIS nos caracteres 23 a 34 (apenas dígitos, últimos 11)
   Continua aceitando também o formato com data/hora em ISO, para não quebrar caso o equipamento mude de layout.
2. **Pegar só as últimas 500 batidas** do arquivo (as mais recentes), já que ele guarda o histórico inteiro.
3. **Identificar o aluno direto pelo cadastro do sistema**: a busca deixa de depender da lista de usuários do relógio (rota que o iDClass não aceita) e passa a procurar o PIS da batida na ficha dos alunos, comparando com e sem zeros à esquerda.
4. **Batida cujo PIS não está em nenhuma ficha** continua entrando como acesso inválido, com a observação de PIS não cadastrado — nada é descartado silenciosamente.
5. **Diagnóstico no console (F12)** mantido: quantidade de linhas do arquivo, batidas reconhecidas e um trecho do texto, para conferência.

## Detalhes técnicos

- `src/lib/controlid.ts`:
  - `parseAfdMarcacoes`: primeiro teste passa a ser `linha.length >= 34 && linha.charAt(9) === "3"`, com `substring(10,12)/(12,14)/(14,18)` para a data, `(18,20)/(20,22)` para a hora e `substring(22,34).replace(/\D/g,"").slice(-11)` para o PIS; `new Date(ano, mes-1, dia, h, m)` (hora local) e descarte de datas inválidas. O ramo ISO (671 com data em texto) fica como fallback secundário.
  - Ordenação decrescente por horário e `slice(0, limit)`; `loadAccessLogs` passa a usar `limit = 500` como padrão.
  - `loadUsers` deixa de ser chamada na importação (fica no arquivo, sem uso obrigatório).
- `src/lib/controlidImport.ts`:
  - remove a dependência de `loadUsers`; monta a lista de PIS das batidas e faz um único `select id, matricula, status, pis from alunos where pis in (...) and deleted_at is null`, montando o mapa `pis (bruto e sem zeros à esquerda) -> aluno`.
  - `matricula_tentada` = matrícula do aluno quando encontrado, senão `PIS <valor>`; status `invalido` quando não há aluno ou o aluno está inativo; observação "PIS não cadastrado no sistema" nesse caso.
  - de-duplicação por `matricula_tentada + horário` mantida, com `limit` de 500.
- Sem alterações no banco de dados.
