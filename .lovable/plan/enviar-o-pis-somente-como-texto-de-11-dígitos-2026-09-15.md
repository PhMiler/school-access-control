# Enviar o PIS somente como texto de 11 dígitos

## O que a mensagem do relógio indica

O equipamento respondeu `'pis' em formato incorreto`. O cálculo do dígito verificador já está implementado exatamente como na fórmula oficial (primeiro dígito 1 ou 2, pesos 3-2-9-8-7-6-5-4-3-2, `11 - resto`, com 10 ou 11 virando 0) — os números gravados na base seguem esse padrão. A diferença real está no **envio**: na última versão o sistema tenta primeiro mandar o PIS como número e só depois como texto. É essa primeira tentativa (número) que o firmware rejeita com essa mensagem de formato.

## Mudanças (`src/lib/controlid.ts`)

1. Remover a tentativa com o PIS como número: passar a enviar sempre **texto com exatamente 11 dígitos**.
2. Validar o valor antes de enviar: manter apenas dígitos e, se não resultar em 11 dígitos válidos (dígito verificador correto), gerar um novo PIS válido no lugar.
3. Manter o gerador com a fórmula oficial, escrito de forma explícita (`resto`, `dv = 11 - resto`, `dv === 10 || dv === 11 -> 0`), e uma função de conferência do dígito verificador usada na validação.
4. Payload final permanece `{"users":[{"name":..., "registration":..., "pis":"12345678901"}]}`.

## Base de dados

- Gerar um novo PIS válido para o **Gabriel** (matrícula 005) e gravar na ficha, para o reteste com o equipamento.

## Verificação

- Conferir o novo PIS do Gabriel na base e o cálculo do dígito verificador.
- Build sem erros; o teste final é no seu notebook, com o relógio na rede.
