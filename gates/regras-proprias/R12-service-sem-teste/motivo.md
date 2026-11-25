# R12: todo service tem teste ao lado

**Motivo.** O CLAUDE.md original do Balcão já pedia um `.test.ts` ao lado de cada arquivo novo em `api/src/services/`, mas nada verificava. O `notification-service.ts` nunca teve teste e foi justamente o módulo que criou um ciclo de import (G9) sem ninguém perceber. Regra mecânica evita o esquecimento.

**Escopo.** `api/src/services/*.ts` que não sejam `.test.ts`.

**Exemplo de violação.** `arquivos/api/src/services/contagem-extra.ts.modelo`, um service novo sem o `contagem-extra.test.ts` ao lado.
