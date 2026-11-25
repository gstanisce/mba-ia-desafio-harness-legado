#!/usr/bin/env node
// Derruba o que a subida desta cópia iniciou: front, worker e API.
// O Postgres é compartilhado entre todas as cópias da máquina: só é parado quando
// nenhuma outra cópia (em qualquer repositório) está no ar. Dados e anexos são mantidos.
//
//   node scripts/derrubar.mjs
import { ROOT, composeArgs, copiesRunningElsewhere, docker, log, readPid, stopProcess, unregisterCopy } from './lib/balcao.mjs'

for (const name of ['web', 'worker', 'api']) {
  const pid = readPid(name)
  const estado = await stopProcess(name)
  log(`${name}: ${estado}${pid ? ` (pid ${pid})` : ''}`)
}
unregisterCopy(ROOT)

const outras = copiesRunningElsewhere()
if (outras.length > 0) {
  log(`Postgres mantido: outras cópias ainda estão no ar (${outras.join(', ')}).`)
} else {
  const parou = docker([...composeArgs(), 'stop', 'db'], { capture: true })
  log(parou.ok ? 'Postgres parado (nenhuma cópia mais no ar). Os dados continuam no volume.' : 'Postgres: não consegui parar (veja docker compose).')
}
log('Pronto: esta cópia está derrubada.')
