# Limpar as batidas do Gabriel de hoje

## Situação atual
O aluno Gabriel (matrícula 005) tem 3 batidas registradas hoje, 15/09:

- 11:47 — Entrada
- 12:28 — Entrada
- 12:31 — Entrada

Todas ficaram como "Entrada" porque foram importadas antes da nova regra de alternância Entrada/Saída.

## O que será feito
1. Apagar esses 3 registros de hoje do Gabriel.
2. Na próxima importação (manual ou automática, a cada 2 minutos), as mesmas 3 batidas serão lidas novamente do relógio e gravadas já com a alternância correta: 11:47 Entrada, 12:28 Saída, 12:31 Entrada.

Nenhum outro aluno e nenhuma outra data são afetados.

## Detalhes técnicos
- Exclusão dos 3 registros da tabela `acessos` filtrando por `aluno_id` do Gabriel e `created_at` no dia de hoje (fuso America/Sao_Paulo).
- Sem alteração de código; o cadastro do aluno e o PIS permanecem intactos.
