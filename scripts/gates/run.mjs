#!/usr/bin/env node
// Comando de gates do Balcão. Roda TODAS as verificações (não para na primeira falha)
// e termina com uma linha por violação: "<ID> <arquivo> <detalhe>".
// Sai com código 0 só se nada falhou.
//
//   node scripts/gates/run.mjs            # todos os gates
//   node scripts/gates/run.mjs G4 G6      # só os gates pedidos
import { CHECKS, ROOT } from './checks.mjs'

const pedidos = process.argv.slice(2).map((s) => s.toUpperCase())
const escolhidos = CHECKS.filter((c) => pedidos.length === 0 || c.ids.some((id) => pedidos.includes(id)))

const violacoes = []
for (const check of escolhidos) {
  const ids = check.ids.join('/')
  console.log(`== ${ids}: ${check.nome}`)
  let achados = []
  try {
    achados = await check.run()
  } catch (err) {
    achados = [{ id: check.ids[0], file: 'scripts/gates', detail: `gate quebrou: ${String(err?.message || err).split('\n')[0]}` }]
  }
  if (achados.length === 0) console.log(`   ok`)
  violacoes.push(...achados)
}

console.log('')
if (violacoes.length === 0) {
  console.log('Todos os gates passaram.')
  process.exit(0)
}

// uma linha por violação: tira duplicatas exatas (ex.: dois "any" na mesma linha)
const unicas = [...new Map(violacoes.map((v) => [`${v.id}|${v.file}|${v.detail}`, v])).values()]
unicas.sort((a, b) => (a.id + a.file < b.id + b.file ? -1 : a.id + a.file > b.id + b.file ? 1 : 0))
console.log('Violações:')
for (const v of unicas) {
  console.log(`${v.id} ${v.file}  ${v.detail}`)
}
violacoes.length = 0
violacoes.push(...unicas)
const regras = new Set(violacoes.map((v) => v.id))
console.log(`\n${violacoes.length} violação(ões) em ${regras.size} regra(s). Raiz: ${ROOT}`)
process.exit(1)
