# Limpar o payload do relógio e tentar o PIS como número em caso de recusa

## Situação atual

O gerador de PIS já está exatamente na fórmula pedida (prefixo 1 ou 2, pesos 3-2-9-8-7-6-5-4-3-2, `dv = 11 - resto`, com 10 ou 11 virando 0) e o PIS já é enviado como texto de 11 dígitos, validado antes do envio. O que ainda falta é o que a nova especificação acrescenta: limpeza dos outros campos e a nova tentativa com o PIS numérico quando o equipamento recusar.

## Mudanças (`src/lib/controlid.ts`)

1. **Matrícula**: enviar `registration` apenas com números (remove letras, pontos, traços e espaços). Se a matrícula não tiver nenhum número, envia o valor original para não bloquear o cadastro.
2. **Nome**: enviar `name` sem espaços sobrando e sem caracteres de controle, limitado ao tamanho aceito pelo equipamento.
3. **PIS**: continua como texto de 11 dígitos, sem pontos ou traços.
4. **Nova tentativa automática**: primeira chamada com o PIS como texto; se o relógio responder com erro 400, refaz uma vez com o PIS convertido para número. A mensagem final mostrada é a do relógio, para o caso de as duas tentativas falharem.

## Base de dados

- Gerar um PIS novo e válido para **todos os alunos** (incluindo o Gabriel), garantindo que cada um continue com um número único.

## Verificação

- Conferir na base os novos PIS e o dígito verificador de cada um.
- Build sem erros; o teste com o equipamento é no seu notebook.
