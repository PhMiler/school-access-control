# Ler as batidas pelo arquivo AFD, com tempo maior de espera

## O que o log mostrou

- O relógio recusou a consulta por tabela: `Invalid command: load_objects` — essa rota não existe no iDClass.
- As duas tentativas pelo arquivo AFD foram canceladas por tempo esgotado ("The user aborted a request"), porque o limite atual é de 8 segundos e o equipamento leva mais tempo para montar o arquivo.

Ou seja: o caminho certo é o AFD; ele só precisa de mais tempo.

## O que será feito

1. **Tirar a consulta por tabela** (`load_objects`) da importação — o relógio já respondeu que não conhece esse comando, então ela só gasta tempo.
2. **Aumentar o tempo de espera para 30 segundos** apenas nas chamadas do arquivo AFD (as demais continuam em 8 segundos, para o teste de conexão seguir rápido).
3. **Ordem de tentativas do AFD**, parando na primeira que trouxer batidas:
   - `mode: "671"`
   - sem nenhum parâmetro
   - `mode: "1510"`
4. **Leitura mais tolerante do texto do arquivo**: aceitar os dois formatos de linha de batida (o legado e o da Portaria 671), pegando as marcações mais recentes.
5. **Diagnóstico no console (F12)**: continuar registrando, para cada tentativa, qual foi usada, quantas batidas saíram e um trecho do texto recebido — assim, se ainda vier vazio, dá para ver exatamente o que o equipamento devolveu.
6. **Mensagem clara na tela** quando o relógio responder mas não houver nenhuma marcação reconhecida, em vez do "0 batidas" sem explicação.

## Detalhes técnicos

- `src/lib/controlid.ts`:
  - `postRaw`/`post`/`postText` recebem um parâmetro opcional de timeout; `AFD_TIMEOUT_MS = 30000`, `TIMEOUT_MS = 8000` para o resto. A mensagem de timeout passa a citar o tempo real usado.
  - Remoção de `loadLogsViaObjects` e `extrairRegistros`/`normalizarRegistro` (só serviam ao `load_objects`).
  - `loadAccessLogs(limit)` percorre `[{mode:"671"}, undefined, {mode:"1510"}]` chamando `POST /get_afd.fcgi?session=`, cada uma com 30s, sem filtro de data e sem NSR inicial; acumula diagnóstico e retorna na primeira lista não vazia.
  - `parseAfdMarcacoes` ganha um segundo formato: além de `3 + NSR(9) + ddmmaaaa + HHMM + PIS(12)`, reconhece o layout 671 (`NSR(9) + "3" + aaaa-mm-dd + THH:MM:SS±hhmm + PIS/CPF`), extraindo data/hora e identificador por expressão regular. Ordena do mais recente para o mais antigo e aplica `slice(0, limit)`.
- `src/lib/controlidImport.ts`: mantém o `console.log` de diagnóstico e passa a devolver também a contagem de linhas lidas, para a tela distinguir "relógio não devolveu nada" de "nenhuma batida nova".
- `src/pages/Relogio.tsx` e `src/pages/ControleAcesso.tsx`: aviso quando o arquivo veio sem marcações reconhecidas, pedindo para conferir o console.
- Sem alterações no banco de dados.
