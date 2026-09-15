# Sanitização da matrícula (registration) no envio ao relógio

## Objetivo

Corrigir o erro 400 `"'registration' em formato incorreto"` do firmware do iDClass: enviar a matrícula limpa (só dígitos, sem zeros à esquerda) e, em caso de recusa, repetir a chamada com os campos numéricos convertidos para número.

## O que será feito

### 1. Sanitização da matrícula — `src/lib/controlid.ts`

Trocar a função `normalizarMatricula` pela regra pedida:

```text
hoje:     "005"  -> "005"  (mantém zeros à esquerda)
depois:   "005"  -> "5"    (remove zeros à esquerda e não-dígitos)
vazio:    "ABC"  -> "1"    (valor padrão seguro)
```

Implementação:

```ts
const registrationLimpa = String(aluno.matricula).replace(/^0+/, "").replace(/\D/g, "") || "1";
```

### 2. Payload e fallback de tipo em `syncAluno`

- **1ª tentativa (texto):** `{ users: [{ name, registration: "5", pis: "28290774039" }] }`
- **2ª tentativa (número), se o relógio responder 400:** `{ users: [{ name, registration: 5, pis: 28290774039 }] }`
- O erro exibido ao usuário continua mostrando a mensagem exata retornada pelo relógio.

### 3. Efeito no aluno Gabriel

Com a matrícula `005`, o envio passa a ser `registration: "5"` (ou `5` no fallback) — exatamente o caso de teste indicado.

### 4. Verificação

- Conferir o build (`/tmp/observability/build-errors.log`).
- O teste real depende do relógio na rede local do usuário (não acessível do preview).

## Detalhes técnicos

- Arquivo alterado: apenas `src/lib/controlid.ts` (funções `normalizarMatricula` e `syncAluno`).
- Nenhuma mudança no banco de dados: a matrícula gravada continua `005`; a limpeza acontece só no momento do envio ao relógio.
- O casamento das batidas na importação (AFD) usa o PIS, não a matrícula — remover os zeros no envio não afeta a leitura das presenças.
