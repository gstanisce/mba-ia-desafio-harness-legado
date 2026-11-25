#!/usr/bin/env node
// Aplica o exemplo de violação de cada regra própria (gates/regras-proprias/<ID>-*/arquivos),
// roda os gates e confere se a linha "<ID> <arquivo>" aparece. Depois desfaz tudo.
// O repositório precisa estar com git status limpo.
//
//   node scripts/gates/testar-regras-proprias.mjs
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { ROOT } from './checks.mjs'

const BASE = path.join(ROOT, 'gates', 'regras-proprias')
const sujo = spawnSync('git', ['-C', ROOT, 'status', '--porcelain'], { encoding: 'utf8' }).stdout.trim()
if (sujo) {
  console.error('git status precisa estar limpo para testar as regras próprias.')
  process.exit(2)
}

function arquivosModelo(dir) {
  if (!fs.existsSync(dir)) return []
  const out = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...arquivosModelo(full))
    else if (e.name.endsWith('.modelo')) out.push(full)
  }
  return out
}

let falhou = false
const pastas = fs.readdirSync(BASE, { withFileTypes: true }).filter((e) => e.isDirectory())
for (const p of pastas) {
  const id = p.name.split('-')[0]
  const criados = []
  for (const modelo of arquivosModelo(path.join(BASE, p.name, 'arquivos'))) {
    const rel = path.relative(path.join(BASE, p.name, 'arquivos'), modelo).replace(/\.modelo$/, '')
    const destino = path.join(ROOT, rel)
    if (fs.existsSync(destino)) {
      console.log(`${id}: PULADA, ${rel} já existe no repositório`)
      continue
    }
    fs.mkdirSync(path.dirname(destino), { recursive: true })
    fs.copyFileSync(modelo, destino)
    criados.push({ destino, rel })
  }

  const res = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'gates', 'run.mjs'), id], { cwd: ROOT, encoding: 'utf8' })
  for (const c of criados) fs.rmSync(c.destino, { force: true })
  // limpa pastas que o exemplo criou e que ficaram vazias
  for (const c of criados) {
    let d = path.dirname(c.destino)
    while (d !== ROOT && fs.existsSync(d) && fs.readdirSync(d).length === 0) {
      fs.rmdirSync(d)
      d = path.dirname(d)
    }
  }

  const linhas = (res.stdout || '').split('\n')
  const barrada = criados.some((c) => linhas.some((l) => l.startsWith(`${id} ${c.rel}`)))
  const status = criados.length === 0 ? 'PULADA' : barrada ? 'barrada' : res.status === 0 ? 'NÃO BARRADA' : 'sem o arquivo'
  console.log(`${id}: ${status}`)
  if (status !== 'barrada') falhou = true
}

process.exit(falhou ? 1 : 0)
