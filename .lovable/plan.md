# Corrigir PIS em branco no cadastro e o erro de "PIS inválido" no relógio

## O que foi confirmado na base

Consultei a tabela de alunos: os 8 alunos existentes (Nicolas, Paulo, Sagan, Gabriel, Rafael e o registro de teste) estão **todos com o campo PIS vazio**. Nenhum deles foi salvo depois que o gerador de PIS entrou no sistema, então:

- ao sincronizar um aluno pelo botão da lista, o sistema gera um PIS "na hora" e **não grava** na ficha — o aluno continua sem PIS na base e o PIS enviado muda a cada tentativa;
- o número gerado pode estar sendo recusado pelo firmware por formato: hoje ele pode começar com qualquer dígito (inclusive 0) e é enviado como texto. Os equipamentos iDClass validam o PIS no padrão brasileiro (começa por 1 ou 2) e várias versões de firmware esperam o campo como número.

## Mudanças propostas

1. **Preencher o PIS de todos os alunos que estão sem PIS** (uma atualização única na base), gerando um número válido e definitivo para cada um. Assim cada aluno passa a ter sempre o mesmo PIS, o que é essencial para a importação das batidas reconhecer quem passou no relógio.

2. **Gerar o PIS no padrão aceito pelo equipamento**: 11 dígitos começando por 1 ou 2, com o dígito verificador oficial, nunca com zero à esquerda.

3. **Gravar o PIS sempre que ele faltar**, não só ao cadastrar: ao clicar em "sincronizar" na lista, se o aluno estiver sem PIS, o sistema gera, salva na ficha e só então envia ao relógio.

4. **Enviar o PIS de forma compatível**: primeira tentativa com o PIS como número; se o firmware recusar, repetir automaticamente uma vez com o PIS como texto de 11 dígitos.

5. **Mostrar a mensagem exata do relógio** no aviso de falha (o texto que o equipamento devolve), para que uma próxima recusa apareça com o motivo real em vez de só "erro 400".

## Detalhes técnicos

- Migração: `UPDATE public.alunos SET pis = <gerado> WHERE pis IS NULL` via função temporária em SQL que calcula o dígito verificador (pesos 3-2-9-8-7-6-5-4-3-2, `dv = 11 - (soma % 11)`, `dv >= 10 -> 0`) e respeita o índice único existente.
- `src/lib/controlid.ts`: `gerarPis()` passa a sortear o primeiro dígito entre 1 e 2; `syncAluno` envia `{ users: [{ name, registration, pis: Number(pis) }] }` e, em caso de erro do firmware, refaz com `pis` string. Mensagens de erro já incluem o corpo da resposta; será mantido e ampliado para o retry.
- `src/pages/Alunos.tsx`: `sincronizar` recebe o aluno, garante PIS (gera + `update` na tabela + atualiza a lista em tela) antes de chamar `syncAluno`.

## Verificação

- Conferir na base que nenhum aluno fica com PIS vazio.
- Build/typecheck sem erros e teste da tela no preview.
- O teste final contra o relógio depende da sua rede local; se ainda recusar, a mensagem exibida trará o texto do firmware para ajustarmos o formato.
