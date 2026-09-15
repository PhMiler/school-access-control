# Entrada/Saída alternadas e importação automática a cada 2 minutos

## 1. Regra de alternância no dia

Ao importar as batidas do relógio:

- As batidas de cada aluno são ordenadas por data e hora crescente, dentro de cada dia.
- A 1ª batida do dia vira **Entrada**, a 2ª **Saída**, a 3ª **Entrada**, a 4ª **Saída**, e assim por diante.
- A contagem considera também as batidas do aluno já gravadas naquele dia, para que uma importação posterior continue a sequência em vez de recomeçar em "Entrada".
- Batidas cujo PIS não está em nenhuma ficha continuam entrando como acesso inválido, agrupadas pelo próprio PIS para manter a alternância.

## 2. Importação automática em segundo plano

- Na tela de Controle de Acesso, a importação passa a rodar sozinha a cada 2 minutos, além do botão manual que continua igual.
- A rodada automática é silenciosa: nenhum aviso de erro ou mensagem na tela; se vier alguma batida nova, apenas a lista de registros recentes é atualizada.
- Uma rodada nunca começa enquanto outra ainda está em andamento (o relógio pode levar até 30 segundos para preparar o arquivo).
- O temporizador é encerrado ao sair da tela.

## Detalhes técnicos

- `src/lib/controlidImport.ts`:
  - após montar `candidatos`, agrupar por `chaveDia = identificador do aluno (id ou PIS) + data local (YYYY-MM-DD)` e ordenar por `ts` ASC;
  - consultar em `acessos` a contagem já existente por aluno/dia no intervalo importado (`select matricula_tentada, tipo, created_at` já usado na de-duplicação, ampliado para cobrir o dia inteiro da batida mais antiga) e usar essa contagem como offset da paridade;
  - `tipo = (offset + índice) % 2 === 0 ? "entrada" : "saida"` no insert, substituindo o `"entrada"` fixo;
  - inserir em ordem crescente de horário.
- `src/pages/ControleAcesso.tsx`:
  - extrair a lógica atual de `importar` para aceitar um parâmetro `silencioso`;
  - `useEffect` com `setInterval(120_000)` chamando a versão silenciosa, guardado por um `useRef` de "em execução", com `clearInterval` no cleanup; erros apenas em `console.warn`;
  - `load()` chamado após a rodada apenas quando `importadas > 0`.
- Sem alterações no banco de dados.
