# AGENTS.md

Índice para agentes que trabalham no Balcão. Detalhe em [README.md](README.md).

## Subir, derrubar, testar

- Subir a cópia (banco, migrations, seed, API, worker, front): `node scripts/subir.mjs`. Pode repetir sem derrubar antes. Mostra os endereços, o banco e a pasta de anexos desta cópia (também em `.balcao/instancia.json`).
- Derrubar esta cópia: `node scripts/derrubar.mjs`. Não afeta outras cópias.
- Gates: `node scripts/gates/run.mjs`. Sai com código 1 se algo falhar e lista uma linha por violação: `ID arquivo detalhe`.
- Testes das regras próprias (aplica os exemplos e desfaz): `node scripts/gates/testar-regras-proprias.mjs`.
- Testes unitários da API: `cd api && npm test`.
- Caixa-preta (precisa da cópia no ar): `cd blackbox && npm install && API_URL=<apiUrl da cópia> npm test`.
- Requisitos: Node 22+ e Docker. No Windows, o Docker roda no WSL e a subida o chama de lá.

## Hook e commits

- `.githooks/pre-commit` roda os gates antes de cada commit (tipos G1 e lint G2 incluídos). Ele é ativado pela subida.
- Nunca use `--no-verify`. Se o gate falhar, corrija a violação.
- Um commit por tarefa, mensagem curta.

## Contas da seed

| Papel | E-mail | Senha |
|---|---|---|
| admin | admin@balcao.dev | Admin@123 |
| atendente | agente@balcao.dev | Agente@123 |
| cliente | cliente@balcao.dev | Cliente@123 |

A IA roda em modo fake (`AI_MODE=fake`), sem chave.

## Regras de camada (os gates barram)

- `api/src/http/` não importa `repositories/` nem `@prisma/client`. Rotas usam os services via `api/src/container.ts` (G4).
- `api/src/services/` não importa `express`, `multer` nem `http/`, nem só para tipo. Erros de regra vêm de `domain/errors.ts` (G6).
- `openai` só em `api/src/integrations/` (G7).
- `process.env` só em `api/src/config/`. `import.meta.env` só em `web/src/config/` (G5).
- `web/` não importa arquivos de `api/` (G8). Tipos do front ficam em `web/src/types/`.
- Sem import circular em `api/src` e `web/src` (G9).
- Sem código morto, export, tipo ou dependência sem uso (G10).
- Sem `any` explícito e sem comentários de supressão (`eslint-disable`, `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`).
- Endereço fixo de porta ou pasta (`localhost:4000`, `localhost:5173`, `/tmp/balcao`) só na config (R11).
- Todo service em `api/src/services/` tem `.test.ts` ao lado (R12).

## Edição de código

- Edite arquivos com a ferramenta de edição. Scripts de substituição de texto (`node -e`, `sed`) podem não casar e não avisam (ver [I-05](docs/incidentes.md)).

## Antes de terminar uma tarefa

1. `node scripts/gates/run.mjs` passa.
2. Caixa-preta passa contra a cópia que você mexeu.
3. A API HTTP não mudou (rotas, corpos, status e códigos de erro). Não há feature nova.

## Onde está o detalhe

- [README.md](README.md): como rodar, gates, decisões de isolamento e correções.
- [docs/incidentes.md](docs/incidentes.md): erros reais de agentes e a mudança no harness que os impede.
- [gates/regras-proprias/](gates/regras-proprias/): motivo e exemplo de violação de R11 e R12.
- [ENUNCIADO.md](ENUNCIADO.md): o enunciado do desafio.
