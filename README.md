# Balcão

Central de chamados. Clientes abrem chamados, um worker faz a triagem (categoria e prioridade) com IA em segundo plano, atendentes assumem e respondem, e o admin acompanha as estatísticas.

- `api/`: API em Express + Prisma, e o worker de triagem (`api/src/jobs/triage-worker.ts`).
- `web/`: front em React + Vite.
- `blackbox/`: suíte caixa-preta da API.
- `scripts/`: subir, derrubar e gates.
- `gates/`: regras próprias do harness (R11 e R12).
- `docs/incidentes.md`: registro de erros de agentes e das mudanças no harness.

Para agentes, veja o [AGENTS.md](AGENTS.md).

## Como rodar

### Pré-requisitos

- Node.js 22 ou superior.
- Docker com `docker compose`.
- No Windows, o Docker pode estar só no WSL: a subida chama o `docker` de lá quando ele não existe no Windows.

### Subir

Num clone limpo, um comando só:

```bash
node scripts/subir.mjs
```

Ele faz, nesta ordem: sobe o Postgres (Docker), instala as dependências (`npm ci`, só quando o lockfile mudou), gera o client do Prisma (quando o schema mudou), aplica as migrations, carrega a seed, sobe a API, o worker e o front, e ativa o hook de commit. Ao final imprime:

- o endereço da API e o do front desta cópia;
- o nome do banco desta cópia (o Postgres é um só, compartilhado);
- a pasta de anexos desta cópia;
- o modo da IA (fake por padrão).

O mesmo está em `.balcao/instancia.json`. Os logs ficam em `.balcao/logs/`.

Rodar a subida de novo, sem derrubar antes, funciona: o que já está no ar é mantido, e a seed não duplica nada.

### Derrubar

```bash
node scripts/derrubar.mjs
```

Para a API, o worker e o front desta cópia. O Postgres só é parado quando nenhuma outra cópia está no ar. Os dados do banco e os anexos são mantidos.

### Duas cópias ao mesmo tempo

Use uma worktree ou outro clone:

```bash
git worktree add --detach ../copia-b
cd ../copia-b && node scripts/subir.mjs
```

Cada cópia recebe um slot: a primeira usa a API em 4000, o front em 5173 e o banco `balcao`; a segunda, 4001, 5174 e `balcao_1`. Cada uma tem a sua pasta de anexos (`.balcao/uploads`) e o seu worker.

### Gates

```bash
node scripts/gates/run.mjs
```

Roda todas as verificações, sem parar na primeira falha, e termina com uma linha por violação no formato `ID arquivo detalhe`. Sai com código diferente de zero se algo falhar.

### Testes

```bash
cd api && npm test                       # unitários, sem banco
cd blackbox && npm install && API_URL=http://localhost:4000 npm test   # caixa-preta, com a cópia no ar
```

## Contas da seed

| Papel | E-mail | Senha |
|---|---|---|
| admin | admin@balcao.dev | Admin@123 |
| atendente | agente@balcao.dev | Agente@123 |
| cliente | cliente@balcao.dev | Cliente@123 |

## IA

Por padrão a API usa o modo fake (`AI_MODE=fake` em `api/.env`): classifica por palavras-chave e não precisa de chave. Para a OpenAI, `AI_MODE=openai` e `OPENAI_API_KEY`.

## Gates

| ID | Regra | Ferramenta |
|---|---|---|
| G1 | Zero erro de tipo em `api/` e `web/`; sem `@ts-ignore` e similares | `tsc` (TypeScript) |
| G2 | Lint sem erro nem warning em `api/` e `web/`; `any` explícito, variável e import sem uso proibidos; sem `eslint-disable` | ESLint + typescript-eslint |
| G3 | Testes unitários da API (`api/src/**/*.test.ts`) passam | Vitest |
| G4 | `api/src/http/` não importa `@prisma/client` nem `repositories/` | dependency-cruiser |
| G5 | `process.env` só em `api/src/config/`; `import.meta.env` só em `web/src/config/` | AST do TypeScript (script próprio) |
| G6 | `api/src/services/` não importa `express`, `multer` nem `http/`, nem só para tipo | dependency-cruiser |
| G7 | `openai` só em `api/src/integrations/` | dependency-cruiser |
| G8 | `web/` não importa arquivos de `api/`, nem só para tipo | dependency-cruiser |
| G9 | Sem import circular em `api/src` e `web/src` | dependency-cruiser |
| G10 | Sem arquivo, export, tipo ou dependência sem uso em `api/` e `web/` | knip |
| R11 | Endereço fixo (`localhost:4000`, `localhost:5173`, `localhost:5432`, `/tmp/balcao`) só na config | script próprio |
| R12 | Todo service em `api/src/services/` tem `.test.ts` ao lado | script próprio |

Ferramentas de dependência (G4, G6 a G9) contam imports só de tipo (`tsPreCompilationDeps`), porque o TypeScript apaga esses imports na compilação mas eles continuam acoplando.

### Regras próprias: motivo e exemplo de violação

- **R11, endereço fixo fora da config.** Motivo e exemplo em [gates/regras-proprias/R11-endereco-fixo/](gates/regras-proprias/R11-endereco-fixo/motivo.md). Duas cópias do Balcão brigavam pelos mesmos endereços (o front da cópia B falava com a API da A, e `/tmp/balcao` é compartilhado).
- **R12, service com teste ao lado.** Motivo e exemplo em [gates/regras-proprias/R12-service-sem-teste/](gates/regras-proprias/R12-service-sem-teste/motivo.md). O `notification-service` nunca teve teste.

Para aplicar os exemplos e conferir que os gates falham:

```bash
node scripts/gates/testar-regras-proprias.mjs
```

O script copia cada `.modelo` para o lugar dele, roda os gates, confere a linha com o ID e o arquivo, e desfaz. Exige `git status` limpo.

Para testar o kit de gates do curso: `bash kit-gates/verificar.sh . "node scripts/gates/run.mjs"`.

## Decisões

### Como as cópias foram isoladas

- **Portas.** Cada cópia pega um slot registrado no `.git` comum do repositório (`balcao-slots/`). Slot N usa API `4000+N` e front `5173+N`. Só são usadas portas livres, e o slot de uma cópia que sumiu é reaproveitado.
- **Banco.** Um Postgres só, em um projeto Compose com nome fixo (`name: balcao`), para que as worktrees compartilhem o container. Cada cópia tem o seu banco: `balcao` (slot 0) ou `balcao_N`.
- **Anexos.** `.balcao/uploads` dentro de cada cópia (a configuração é `UPLOAD_DIR`). Antes era `/tmp/balcao/uploads`, fixo e compartilhado.
- **Front.** Recebe a API da própria cópia por `VITE_API_URL`. A API libera a origem do próprio front por `CORS_ORIGIN`. Antes, CORS apontava para `localhost:5173` fixo.
- **Processos.** A subida grava o PID de cada processo em `.balcao/run/`. O derrubar mata só os PIDs da cópia (grupo de processos no POSIX, árvore com `taskkill` no Windows).
- **Worker.** Um processo por cópia, com o banco da cópia.
- **Seed.** Idempotente: usuários pelo e-mail, chamados pelo título do cliente. Não duplica nada.

### Como as violações foram corrigidas (sem supressão)

- **G4 e G5.** As rotas deixaram de importar repositórios e `process.env`. Um `container.ts` na raiz de `api/src` monta os services com os repositórios, e a config (`api/src/config/env.ts`) é o único lugar que lê o ambiente.
- **G6.** `HttpError` foi para `domain/errors.ts`. Services recebem o arquivo de upload como tipo do domínio, sem `express`.
- **G7.** A chamada de sugestão de resposta com OpenAI foi para `integrations/`. O prompt foi unificado com o que a rota já usava.
- **G8.** Os tipos do front ficaram em `web/src/types/ticket.ts`, uma cópia dos tipos do domínio. Se o domínio mudar, os dois precisam ser atualizados.
- **G9.** Ciclo entre `notification-service` e `ticket-service`: `formatTicketRef` foi para o domínio.
- **G10.** Removidos: `utils/legacy-sla.ts` (sem uso), `lodash` e `axios` (sem uso), exports sem uso.
- **G2.** Os `any` foram trocados por tipos reais. Os `catch` com `any` usam `unknown` ou `errorMessage()`.
- **Comportamento.** Nenhuma rota, corpo, status ou código de erro mudou. A suíte caixa-preta passa 51 de 51 nas duas cópias.

### O que mudou na documentação para agentes

- `AGENTS.md` é o índice, com menos de 60 linhas. Cita só comandos e caminhos que existem.
- `CLAUDE.md` virou um ponteiro para o `AGENTS.md`.
- Regras antigas do `CLAUDE.md` que conflitavam com os gates foram removidas: "use `any` em handler" (proibido pela G2) e "use axios" (o front usa `fetch`, e o axios saiu por não ser usado).

## Validação

Desenvolvido e validado no Windows com Node nativo e Docker no WSL:

- clone novo: subida sobe tudo; rodar de novo não quebra;
- duas cópias ao mesmo tempo: portas, banco e anexos separados, triagem isolada por cópia, caixa-preta 51/51 nas duas;
- derrubar uma cópia não afeta a outra, e a subida dela volta sem erro;
- kit de gates do curso: 19 de 19 violações barradas;
- hook: bloqueia erro de tipo e variável sem uso.

Ainda não validado: execução em Linux e macOS (o Node do WSL não pôde ser instalado neste ambiente). Os scripts são Node puro e não dependem de shell, mas esse caminho precisa ser testado antes da entrega final.

## Registro de incidentes

Veja [docs/incidentes.md](docs/incidentes.md).

## Fork

Entrega no fork: https://github.com/gstanisce/mba-ia-desafio-harness-legado
