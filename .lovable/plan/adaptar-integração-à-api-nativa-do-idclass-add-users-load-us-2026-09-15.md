# Adaptar integração à API nativa do iDClass (add_users, load_users, get_afd)

## Contexto

O firmware do iDClass rejeitou `create_objects.fcgi` (`Invalid command: create_objects`, 400). A documentação oficial da API do iDClass (controlid.com.br/suporte/api_idclass_latest.html) confirma que essa linha usa comandos próprios e **não possui** `create_objects.fcgi`, `load_objects.fcgi` nem consulta a `access_logs`:

- Cadastro de usuário: `POST /add_users.fcgi?session=` com `{ users: [{ name, registration, ... }] }` (`registration` aceito como string).
- Leitura de usuários: `POST /load_users.fcgi?session=` com `{ limit, offset }`.
- Batidas: `POST /get_afd.fcgi?session=&mode=671` — retorna o arquivo AFD (texto, Portaria 671), identificando cada batida pelo **PIS**, não pela matrícula.

Ou seja, além do cadastro, os dois módulos de leitura que usamos (`loadUsers` e `loadAccessLogs`) também falhariam com "Invalid command". O plano cobre os três.

## Mudanças

### 1. `src/lib/controlid.ts`

- **`syncAluno`**: trocar para `POST /add_users.fcgi?session=[SESSION]` com body estrito:
  ```json
  { "users": [{ "name": "NOME", "registration": "MATRICULA" }] }
  ```
  - `registration` sempre string; sem `id` manual e sem `password` (o iDClass aceita campos mínimos).
  - Remover o fallback `create_objects.fcgi` (com e sem `password`) — não existe no iDClass.
- **`loadUsers`**: trocar para `POST /load_users.fcgi?session=` com `{ limit: 1000, offset: 0 }`; retorno `{ users: [...] }`. O tipo passa a incluir `pis?: string | number` (necessário para casar batidas do AFD).
- **`loadAccessLogs`**: substituir por leitura via AFD:
  - `POST /get_afd.fcgi?session=[SESSION]&mode=671` com `{ headerTop: true }` (cabeçalho no início e sem nome de arquivo na resposta) e `initial_date` = 90 dias atrás, para limitar o tamanho.
  - Resposta vem como **texto AFD** (ou JSON contendo o texto): adicionar um `postText` (sem JSON.parse) que aceita ambos.
  - Parsear os registros de marcação (linhas tipo `3`): NSR (9 dígitos), data `ddmmaaaaa` (8), hora `HHMM` (4), PIS (12). Converter cada registro para o mesmo formato `AccessLog` consumido hoje, com `time` derivado da data/hora do relógio (hora local do dispositivo) e novo campo `pis`.
  - Manter a assinatura `loadAccessLogs()` retornando `AccessLog[]` para não quebrar quem consome.

### 2. `src/lib/controlidImport.ts`

- Hoje casa a batida com a matrícula por `user_id`/`card_value` — o AFD só traz PIS. Passar a resolver a matrícula por: `pis da batida → loadUsers (pis) → registration → aluno`.
  - Mapa novo: `matriculaPorPis` (além do mapa por id, mantido como fallback).
  - Batida com PIS não encontrado em `loadUsers`: registrada como `invalida` com `matricula_tentada` = PIS e observação "PIS não vinculado a matrícula no relógio" (visível no Controle de Acesso).
- Deduplicação por `matricula|timestamp` e demais regras (aluno ativo/inativo, `metodo: "biometria"`, `tipo: "entrada"`) permanecem iguais.

### 3. UI

- Nenhuma mudança estrutural: a página do Relógio (Testar Conexão, Salvar, Importar Batidas) e o sync no cadastro de alunos continuam chamando as mesmas funções; apenas as mensagens de erro passarão a refletir os comandos reais do iDClass.

## Fora de escopo

- `update_users` / `remove_users` (edição e exclusão no relógio) — podem vir depois.
- Leitura incremental por NSR — hoje a deduplicação no banco já evita registros repetidos.

## Verificação

- Build sem erros.
- Playwright: tela do Relógio carrega, "Importar Batidas" exibe erro amigável quando o relógio não responde (sem IP real na sandbox, valida apenas o caminho de erro) e o cadastro de aluno continua salvando no banco com aviso de falha de sync.
- Teste real depende do equipamento na rede do usuário (aceitar o certificado autoassinado uma vez no navegador ou usar http).
