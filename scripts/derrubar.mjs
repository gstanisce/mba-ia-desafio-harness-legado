#!/usr/bin/env node
// Derruba o que a subida desta cópia iniciou: front, worker e API.
// O Postgres é compartilhado: só é parado quando nenhuma outra cópia está no ar.
// Os dados do banco e a pasta de anexos são mantidos.
//
//   node scripts/derrubar.mjs
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { ROOT, composeArgs, docker, isAlive, log, readPid, stopProcess } from './lib/balcao.mjs'

for (const name of ['web', 'worker', 'api']) {
  const pid = readPid(name)
  const estado = await stopProcess(name)
  log(`${name}: ${estado}${pid ? ` (pid ${pid})` : ''}`)
}

const outrasNoAr = copiasNoAr().filter((dir) => dir !== ROOT)
if (outrasNoAr.length > 0) {
  log(`Postgres mantido: outras cópias ainda estão no ar (${outrasNoAr.join(', ')}).`)
} else {
  const parou = docker([...composeArgs(), 'stop', 'db'], { capture: true })
  log(parou.ok ? 'Postgres parado (nenhuma cópia mais no ar). Os dados continuam no volume.' : 'Postgres: não consegui parar (veja docker compose).')
}
log('Pronto: esta cópia está derrubada.')

// cópias registradas (outros worktrees) com algum processo vivo
function copiasNoAr() {
  const common = spawnSync('git', ['-C', ROOT, 'rev-parse', '--path-format=absolute', '--git-common-dir'], { encoding: 'utf8' })
  if (common.status !== 0) return []
  const dir = path.join(common.stdout.trim(), 'balcao-slots')
  if (!fs.existsSync(dir)) return []
  const vivas = []
  for (const f of fs.readdirSync(dir)) {
    let copia
    try {
      copia = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).path
    } catch {
      continue
    }
    const pidsDaCopia = ['api', 'worker', 'web'].map((n) => {
      try {
        return Number(fs.readFileSync(path.join(copia, '.balcao', 'run', `${n}.pid`), 'utf8').trim())
      } catch {
        return 0
      }
    })
    if (pidsDaCopia.some((pid) => pid && isAlive(pid))) vivas.push(copia)
  }
  return vivas
}
