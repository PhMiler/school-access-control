# Remover as últimas referências à plataforma do código

## Situação atual (verificada)

Depois da renomeação para EduControl, restam apenas 3 lugares com referências à plataforma, todos fora das telas:

1. `src/integrations/supabase/previewAuthStorage.ts` — arquivo automático que compartilha a sessão de login entre o editor e a prévia (só tem efeito dentro da plataforma; no computador/servidor comum ele já se comporta como localStorage puro).
2. `src/integrations/supabase/client.ts` — importa e usa a função acima (1 linha de import + 1 linha de configuração).
3. `package-lock.json` — os endereços de download dos pacotes apontam para o cache interno da plataforma (não aparece em tela, mas fica no arquivo).
4. `tsconfig.app.tsbuildinfo` — artefato de build local que menciona o caminho da plataforma (arquivo temporário, gerado a cada build).

Não existe nenhuma outra referência em `src/`, `index.html`, `vite.config.ts` ou `package.json`.

## O que será feito

1. **`src/integrations/supabase/client.ts`** — remover a importação e o uso do armazenamento intermediado; o login passa a usar o armazenamento padrão do navegador (localStorage), que é como qualquer app Supabase comum funciona.
2. **Apagar `src/integrations/supabase/previewAuthStorage.ts`** — deixa de existir no projeto.
3. **`package-lock.json`** — regenerar apontando para o registro público do npm (registry.npmjs.org), eliminando os endereços internos.
4. **Apagar `tsconfig.app.tsbuildinfo`** — é regenerado automaticamente a cada build.

## Verificação

- `rg -i "lovable|gpt"` em todo o projeto fora de `node_modules` e da pasta `.lovable` → zero ocorrências (a pasta `.lovable` o próprio usuário remove ao enviar, conforme combinado).
- Build do projeto sem erros e conferência no navegador: login e navegação continuam funcionando normalmente em `localhost:8080`.

## Efeito colateral (importante saber)

- Dentro da **prévia do Lovable**, o login deixará de ser compartilhado automaticamente com o editor: será preciso entrar normalmente na tela de login da prévia (uma vez; a sessão fica salva no navegador). Fora da plataforma — rodando o projeto localmente ou publicado — o comportamento é idêntico ao de hoje.
- Se em uma sessão futura a plataforma recriar esses dois arquivos automáticos, basta repetir estes dois passos (ou pedir para eu refazer) antes de exportar o projeto.

## Escopo

- A pasta `.lovable` (planos) **não** será mexida — o usuário a remove ao enviar.
- Nenhuma outra funcionalidade será alterada: banco, permissões, relógio e telas ficam intactos.
