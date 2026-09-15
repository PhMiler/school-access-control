# Integração com o relógio Control iD (iDClass) na rede local

## O que será feito

### 1. Página "Relógio de Ponto" (configurações)
Nova página no menu lateral, visível para administradores.
- Campos: IP do relógio (padrão `192.168.1.45`), Login (padrão `admin`), Senha (padrão `admin`).
- Botão **Testar conexão**: faz login no relógio e mostra se a chave de sessão foi retornada, com mensagem clara de sucesso ou erro.
- As credenciais ficam salvas no navegador deste computador (é o computador que fala com o relógio, não a nuvem).
- Cartão de diagnóstico explicando o que fazer se o navegador bloquear o certificado do relógio.

### 2. Sincronização no cadastro de alunos
No formulário de alunos que já existe: após salvar no banco, o aluno é enviado automaticamente para o relógio (nome + matrícula como cartão).
- Se o relógio não estiver configurado ou não responder, o aluno continua salvo e aparece um aviso de "não sincronizado" — o cadastro nunca é perdido.
- Botão "Sincronizar com o relógio" na lista, para reenviar alunos que falharam.

### 3. Leitura das batidas
Serviço que consulta os registros de acesso do relógio e grava as batidas novas na tabela de acessos do sistema.
- Botão **Importar batidas** na página do relógio (e na tela de Controle de Acesso), mostrando quantas foram importadas e quantas ignoradas por duplicidade.
- Batidas de matrículas desconhecidas entram como acesso inválido, igual ao fluxo manual atual.

## Ponto importante sobre o certificado do relógio

As chamadas saem do navegador do computador local (a nuvem não alcança a rede interna). O navegador **não** permite desligar a verificação de certificado por código — `rejectUnauthorized: false` só funciona em servidor Node. Na prática:

1. Abrir `https://192.168.1.45` uma vez no navegador e aceitar o certificado do relógio. Depois disso as chamadas do sistema funcionam.
2. Se o relógio também aceitar `http`, dá para configurar `http://` e não há certificado nenhum a aceitar (a página terá a opção de escolher http ou https).

Se preferir uma solução sem esse passo manual, será necessário um pequeno programa rodando no computador local como ponte — posso planejar isso separadamente.

## Detalhes técnicos

- `src/lib/controlid.ts`: cliente com `login()` (`POST /login.fcgi`), cache da `session`, `createUser()` (`POST /create_objects.fcgi?session=`, objeto `users`), `loadAccessLogs()` (`POST /load_objects.fcgi?session=`, tabela `access_logs`), re-login automático quando a sessão expira, `mode: 'cors'` e timeout via `AbortSignal`.
- `src/lib/controlidConfig.ts`: leitura/escrita da configuração em `localStorage` (`protocolo`, `ip`, `login`, `senha`).
- `src/pages/Relogio.tsx` + rota `/relogio` em `App.tsx` + item no `AppSidebar` (permissão `usuarios.view` / admin).
- `src/pages/Alunos.tsx`: após insert/update bem-sucedido, chamada `syncAluno()` com tratamento de erro isolado e coluna/indicador de sincronização.
- Importação de batidas: de-duplicação por `matricula + timestamp` antes do insert em `acessos`, respeitando a política existente (`registrado_por = auth.uid()`).
- Sem alterações de banco de dados nesta etapa; se quiser guardar a data da última importação e o status de sincronização por aluno de forma persistente, adiciono duas colunas — diga se quer.
