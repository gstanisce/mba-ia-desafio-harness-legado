# Registro de incidentes

Erros reais de agentes e de ferramentas durante a montagem do harness. Cada entrada diz o que aconteceu, qual mudança no harness impede a repetição, e o commit dessa mudança.

## I-01: a subida rodava `prisma generate` a cada execução

- **O que aconteceu.** Rodar `node scripts/subir.mjs` de novo, com a API no ar, falhava com `EPERM` ao regerar `query_engine-windows.dll.node`. No Windows o engine fica travado enquanto o processo usa o arquivo. A subida idempotente quebrava justamente na segunda execução.
- **Mudança no harness.** A subida só regera o client quando o hash do `schema.prisma` muda (marcador em `api/node_modules/.balcao-prisma-sha256`). Com a API no ar e schema alterado, ela pede para derrubar antes, em vez de quebrar no meio.
- **Commit.** `28c251f`

## I-02: PID gravado era o do `cmd.exe`, e os processos morriam com a subida

- **O que aconteceu.** Os primeiros processos foram iniciados com `npm run start` e `shell: true`. No Windows o PID gravado era o do `cmd.exe` intermediário, que sai antes do servidor. O derrubar não achava a API, e o `subir` seguinte achava que ela estava parada. Depois, com o processo filho ainda no console da subida, API, worker e front morreram quando o script terminou.
- **Mudança no harness.** Os processos sobem direto com `node` (tsx e vite via seus CLIs), com `detached: true`, e o PID gravado é o do processo real. Assim o derrubar funciona e a cópia continua no ar depois da subida.
- **Commit.** `28c251f`

## I-03: dependency-cruiser não via pacotes npm, então G4, G6 e G7 não barravam

- **O que aconteceu.** Na primeira rodada dos gates, `import { Request } from 'express'` em um service e `import OpenAI from 'openai'` numa rota não eram barrados. O dependency-cruiser resolve pacotes como `api/node_modules/express/...`, e a regex das regras estava ancorada em `^node_modules/`. Os gates passariam com a violação no código.
- **Mudança no harness.** As regras de pacote casam `node_modules/` em qualquer ponto do caminho. Os exemplos do kit de G6 e G7 passam a ser barrados.
- **Commit.** `1bff8a6`

## I-04: a checagem de G1 ignorava a saída do tsc no Windows

- **O que aconteceu.** Cada linha de erro do tsc termina com `\r` no Windows, e a regex com `(.*)$` não casava. A violação só aparecia pela linha de fallback `tsc falhou`, no `api/tsconfig.json`, sem o arquivo certo. O kit passou no primeiro teste porque o nome do arquivo estava nessa linha de fallback, o que mascarou o defeito.
- **Mudança no harness.** A saída do tsc é separada por `\r?\n` e o caminho é resolvido a partir da raiz, onde o tsc o imprime. Teste manual com erro de tipo agora mostra `G1 api/src/services/teste-hook.ts`.
- **Commit.** `0d6569c`

## I-05: script de substituição deixou `any` nos testes sem aviso

- **O que aconteceu.** Um script `node -e` que deveria trocar os tipos dos testes de `ticket-service` não casou nenhum trecho (problema de escape no shell) e não avisou. O arquivo continuou com `any`, que a G2 barraria no commit.
- **Mudança no harness.** A regra "edite com a ferramenta de edição, não com scripts de substituição" foi escrita no `AGENTS.md`. Os gates continuam barrando `any` (G2) e, com o hook, nenhum commit com o defeito entra.
- **Commit.** `80a5203`
