# R11: endereço fixo de porta ou pasta fora da config

**Motivo.** O Balcão tinha `localhost:4000`, `localhost:5173` e `/tmp/balcao` espalhados pelo código (CORS, cliente da API no front, pasta de anexos). Com duas cópias do projeto, todas brigam pelos mesmos endereços: o front da cópia B falava com a API da cópia A, e os anexos caíam numa pasta compartilhada. Na linha de base, o download de anexo ainda falhava no Windows porque `/tmp` vira `C:\tmp`. Só a config pode saber esses valores.

**Escopo.** `api/src` e `web/src`, fora de `api/src/config/` e `web/src/config/`.

**Exemplo de violação.** `arquivos/web/src/pages/AtalhoApi.tsx.modelo` (hardcoded `http://localhost:4000` numa página).
