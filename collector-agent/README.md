# EduControl - Coletor Local (Control iD)

Agente Node.js/TypeScript que roda num computador da própria rede local da
escola, lê periodicamente as batidas do relógio Control iD (iDClass) e grava
direto na tabela `acessos` do Supabase do EduControl — sem precisar importar
arquivo AFD manualmente pela tela **Relógio de Ponto**.

## Como funciona

1. Autentica no relógio (`/login.fcgi`) e guarda a sessão; reautentica
   sozinho se ela expirar.
2. A cada ciclo, busca no relógio o **AFD** (`/get_afd.fcgi`, testando os
   modos 671, sem parâmetro e 1510, igual ao importador manual do app) — o
   mesmo mecanismo já comprovado em produção para este hardware, já que o
   firmware não suporta a API moderna `load_objects.fcgi`.
3. O AFD identifica cada batida pelo **PIS/CPF**, não pela matrícula; o
   agente resolve o aluno correspondente no Supabase pela coluna
   `alunos.pis`.
4. Grava cada batida em `public.acessos`, alternando `entrada`/`saida` da
   mesma forma que o importador manual do app (por aluno, por dia), e
   ignora batidas que já existam no Supabase (o AFD sempre devolve o
   histórico completo do relógio, não só o que é novo).
5. Salva em `last_nsr.json` (ou o caminho de `NSR_STORE_PATH`) o horário da
   última batida processada, só como otimização para não reconferir o
   histórico inteiro contra o Supabase a cada ciclo — a deduplicação de
   verdade é sempre contra o que já está gravado no banco.
6. Repete a cada `POLL_INTERVAL_MS` (padrão 5s), com backoff automático em
   caso de falha de rede/relógio desligado.

## Configuração

```bash
cd collector-agent
npm install
cp .env.example .env
```

Edite o `.env`:

| Variável | Descrição |
|---|---|
| `CONTROLID_PROTOCOL` | `http` ou `https` (o relógio local costuma usar `http`) |
| `CONTROLID_IP` | IP do relógio na rede local, ex: `192.168.1.45` |
| `CONTROLID_LOGIN` / `CONTROLID_PASSWORD` | Credenciais do painel web do relógio |
| `CONTROLID_IGNORE_SELF_SIGNED` | `true` para aceitar certificado autoassinado (se usar HTTPS local) |
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | **Service Role Key** (nunca a anon/publishable) — mantenha esse `.env` fora do controle de versão |
| `POLL_INTERVAL_MS` | Intervalo entre verificações (padrão `5000`) |
| `BATCH_LIMIT` | Máximo de batidas buscadas por ciclo (padrão `200`) |
| `NSR_STORE_PATH` | Onde salvar o ponteiro do último id processado |
| `USERS_CACHE_TTL_MS` | Cache do mapa usuário→matrícula do relógio (padrão 5 min) |

**Nunca** commite o `.env` real nem o `last_nsr.json` — já estão no `.gitignore`.

## Executar em desenvolvimento

```bash
npm run dev
```

## Rodar como serviço em segundo plano no Windows (PM2)

```powershell
npm install -g pm2

cd collector-agent
npm run build          # compila TypeScript para dist/
pm2 start ecosystem.config.js
pm2 save                # grava a lista de processos para sobreviver a reinícios
```

Para o PM2 iniciar sozinho quando o Windows ligar, instale o `pm2-windows-startup`:

```powershell
npm install -g pm2-windows-startup
pm2-startup install
```

Comandos úteis do dia a dia:

```powershell
pm2 status                       # ver se o coletor está rodando
pm2 logs educontrol-collector    # acompanhar os logs em tempo real
pm2 restart educontrol-collector # reiniciar (ex: depois de trocar o .env)
pm2 stop educontrol-collector    # parar
```

## Observações importantes

- O relógio precisa estar acessível pela rede do computador onde este agente
  roda (mesma rede local ou VPN); ele **não** fala direto com a internet.
- O aluno **precisa ter o PIS cadastrado** (`alunos.pis`) para a batida ser
  reconhecida — é assim que o AFD identifica a pessoa. Sem PIS batendo com
  nenhum aluno, o acesso é gravado mesmo assim, mas como `status: invalido`.
- `registrado_por` é gravado como `null` nos acessos automáticos, já que não
  há um usuário do painel logado nesse fluxo (é uma leitura automática do
  equipamento).
- Se o seu relógio for de um modelo/firmware mais novo que aceite a API
  "Objects" (`load_objects.fcgi`), dá para trocar `fetchMarcacoes()` em
  `src/controlIdClient.ts` por uma chamada a esse endpoint com o objeto
  `access_logs` — mais eficiente que reler o AFD inteiro a cada ciclo.
