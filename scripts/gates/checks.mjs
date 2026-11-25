// Checagens dos gates do Balcão. Cada função devolve uma lista de violações:
//   { id: 'G4', file: 'api/src/http/routes/stats.ts', detail: '...' }
// O ID é a invariante (G1..G10) ou a regra própria (R11, R12). Nenhuma função
// para na primeira falha: o orquestrador (run.mjs) junta tudo.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const require = createRequire(path.join(ROOT, 'package.json'))

const CODE_DIRS = ['api/src', 'api/test', 'api/prisma', 'web/src']
const SRC_DIRS = ['api/src', 'web/src']
const CODE_EXT = /\.(ts|tsx|mts|cts)$/

const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/')

function walk(dir, filter = () => true) {
  const out = []
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full, filter))
    else if (filter(full)) out.push(full)
  }
  return out
}

const codeFiles = (dirs = SRC_DIRS) =>
  dirs.flatMap((d) => walk(path.join(ROOT, d), (f) => CODE_EXT.test(f) && !f.endsWith('.d.ts')))

// ---------- G1: tipos (tsc) + supressões de tipo ----------
export function checkG1() {
  const out = []
  const tsc = path.join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc')
  for (const pkg of ['api', 'web']) {
    const res = spawnSync(process.execPath, [tsc, '--noEmit', '--pretty', 'false', '-p', path.join(ROOT, pkg, 'tsconfig.json')], {
      cwd: ROOT,
      encoding: 'utf8',
    })
    // tsc imprime caminhos relativos ao cwd (a raiz) e pode terminar linhas com \r no Windows
    const lines = (res.stdout || '').split(/\r?\n/)
    let achou = false
    for (const line of lines) {
      const m = line.match(/^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/)
      if (!m) continue
      achou = true
      const file = rel(path.resolve(ROOT, m[1]))
      out.push({ id: 'G1', file, detail: `linha ${m[2]}: ${m[4]} ${m[5]}` })
    }
    if (res.status !== 0 && !achou) {
      out.push({ id: 'G1', file: `${pkg}/tsconfig.json`, detail: `tsc falhou: ${(res.stderr || res.stdout).trim().slice(0, 300)}` })
    }
  }
  out.push(...checkSuppressions(['@ts-ignore', '@ts-expect-error', '@ts-nocheck'], 'G1'))
  return out
}

// ---------- G2: lint (ESLint, sem erro e sem warning) ----------
export async function checkG2() {
  const out = []
  const { ESLint } = await import('eslint')
  try {
    const eslint = new ESLint({ cwd: ROOT })
    const results = await eslint.lintFiles(CODE_DIRS)
    for (const r of results) {
      for (const msg of r.messages) {
        const regra = msg.ruleId ? msg.ruleId : 'erro-de-parse'
        out.push({ id: 'G2', file: rel(r.filePath), detail: `linha ${msg.line ?? '?'}: ${regra} - ${msg.message}` })
      }
    }
  } catch (err) {
    out.push({ id: 'G2', file: 'eslint.config.mjs', detail: `eslint falhou: ${String(err.message).split('\n')[0]}` })
  }
  out.push(...checkSuppressions(['eslint-disable'], 'G2'))
  return out
}

// ---------- G3: testes unitários da API (api/src/**/*.test.ts) ----------
export function checkG3() {
  const out = []
  const vitest = path.join(ROOT, 'api', 'node_modules', 'vitest', 'vitest.mjs')
  const outFile = path.join(ROOT, '.gates-vitest.json')
  const res = spawnSync(process.execPath, [vitest, 'run', '--reporter=json', `--outputFile=${outFile}`], {
    cwd: path.join(ROOT, 'api'),
    encoding: 'utf8',
  })
  let data = null
  try {
    data = JSON.parse(fs.readFileSync(outFile, 'utf8'))
  } catch {
    out.push({ id: 'G3', file: 'api/src', detail: `vitest não produziu relatório: ${(res.stderr || res.stdout).trim().slice(0, 300)}` })
  } finally {
    fs.rmSync(outFile, { force: true })
  }
  if (data) {
    for (const t of data.testResults) {
      if (t.status === 'passed') continue
      const falha = (t.assertionResults || []).filter((a) => a.status === 'failed').map((a) => a.title)
      const msg = t.message ? t.message.split('\n')[0] : falha.join(' | ') || t.status
      out.push({ id: 'G3', file: rel(t.name), detail: msg })
    }
    if (data.numTotalTests === 0) out.push({ id: 'G3', file: 'api/src', detail: 'nenhum teste unitário encontrado' })
  }
  return out
}

// ---------- G4, G6, G7, G8, G9: dependências (dependency-cruiser) ----------
export function checkDependencias() {
  const out = []
  const depcruise = path.join(ROOT, 'node_modules', 'dependency-cruiser', 'bin', 'dependency-cruiser.mjs')
  const res = spawnSync(
    process.execPath,
    [depcruise, '--config', '.dependency-cruiser.cjs', '--output-type', 'json', ...CODE_DIRS],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  )
  let data = null
  try {
    data = JSON.parse(res.stdout)
  } catch {
    out.push({ id: 'G4', file: '.dependency-cruiser.cjs', detail: `dependency-cruiser falhou: ${(res.stderr || '').trim().slice(0, 300)}` })
    return out
  }
  for (const v of data.summary.violations) {
    if (v.rule.severity === 'ignore') continue
    if (v.rule.name === 'G9') {
      out.push({ id: 'G9', file: v.from, detail: `import circular até ${v.to}` })
      continue
    }
    out.push({ id: v.rule.name, file: v.from, detail: `importa ${v.to}` })
  }
  return out
}

// ---------- G5: process.env só em api/src/config/; import.meta.env só em web/src/config/ ----------
export function checkG5() {
  const out = []
  const ts = require('typescript')
  const apiFiles = codeFiles(['api/src']).filter((f) => !rel(f).startsWith('api/src/config/'))
  const webFiles = codeFiles(['web/src']).filter((f) => !rel(f).startsWith('web/src/config/'))

  // process, globalThis.process, window.process...: qualquer jeito de chegar ao objeto process
  const isProcess = (e) =>
    (ts.isIdentifier(e) && e.text === 'process') ||
    (ts.isPropertyAccessExpression(e) && e.name.text === 'process' && ts.isIdentifier(e.expression))

  for (const file of apiFiles) {
    const src = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
    const visit = (node) => {
      if (ts.isPropertyAccessExpression(node) && node.name.text === 'env' && isProcess(node.expression)) {
        out.push(achado(src, node, 'G5', rel(file), 'process.env fora de api/src/config/'))
      } else if (ts.isElementAccessExpression(node) && isProcess(node.expression)) {
        out.push(achado(src, node, 'G5', rel(file), 'process[...] fora de api/src/config/'))
      } else if (ts.isIdentifier(node) && node.text === 'process' && !nomeDeMembro(ts, node) && !ehEnvDoProcess(ts, node)) {
        out.push(achado(src, node, 'G5', rel(file), 'referência a process fora de api/src/config/'))
      }
      ts.forEachChild(node, visit)
    }
    visit(src)
  }

  for (const file of webFiles) {
    const src = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
    const visit = (node) => {
      if (ts.isPropertyAccessExpression(node) && node.name.text === 'env' && ts.isMetaProperty(node.expression)) {
        out.push(achado(src, node, 'G5', rel(file), 'import.meta.env fora de web/src/config/'))
      } else if (ts.isElementAccessExpression(node) && ts.isMetaProperty(node.expression)) {
        out.push(achado(src, node, 'G5', rel(file), 'import.meta[...] fora de web/src/config/'))
      }
      ts.forEachChild(node, visit)
    }
    visit(src)
  }
  return out
}

// true quando o identificador é só um nome de propriedade (obj.process, { process: 1 }), não uma referência
function nomeDeMembro(ts, node) {
  const p = node.parent
  return Boolean(p && (ts.isPropertyAccessExpression(p) || ts.isPropertyAssignment(p)) && p.name === node)
}

// o "process" de process.env já é reportado pela checagem de .env, sem duplicar a linha
function ehEnvDoProcess(ts, node) {
  const p = node.parent
  return Boolean(p && ts.isPropertyAccessExpression(p) && p.expression === node && p.name.text === 'env')
}

function achado(src, node, id, file, detail) {
  const { line } = src.getLineAndCharacterOfPosition(node.getStart(src))
  return { id, file, detail: `linha ${line + 1}: ${detail}` }
}

// ---------- G10: arquivo, export, tipo ou dependência sem uso (knip) ----------
export function checkG10() {
  const out = []
  const knip = path.join(ROOT, 'node_modules', 'knip', 'bin', 'knip.js')
  for (const pkg of ['api', 'web']) {
    const res = spawnSync(process.execPath, [knip, '--directory', pkg, '--reporter', 'json'], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    })
    let data
    try {
      data = JSON.parse(res.stdout)
    } catch {
      out.push({ id: 'G10', file: `${pkg}/knip.json`, detail: `knip falhou: ${(res.stderr || res.stdout).trim().slice(0, 300)}` })
      continue
    }
    for (const issue of data.issues || []) {
      const file = `${pkg}/${issue.file}`
      for (const f of issue.files || []) out.push({ id: 'G10', file: `${pkg}/${f.name}`, detail: 'arquivo sem uso' })
      for (const d of [...(issue.dependencies || []), ...(issue.devDependencies || [])]) {
        out.push({ id: 'G10', file, detail: `dependência sem uso: ${d.name}` })
      }
      for (const e of [...(issue.exports || []), ...(issue.types || [])]) {
        out.push({ id: 'G10', file, detail: `export sem uso: ${e.name}` })
      }
    }
  }
  return out
}

// ---------- R11 (regra própria): endereço fixo de porta ou pasta fora da config ----------
// Motivo: o Balcão tinha localhost:4000, localhost:5173 e /tmp/balcao espalhados; duas
// cópias brigavam por eles. Só a config pode saber esses valores.
export function checkR11() {
  const out = []
  const proibidos = [/localhost:4000\b/, /localhost:5173\b/, /localhost:5432\b/, /\/tmp\/balcao/]
  const files = codeFiles(SRC_DIRS).filter((f) => {
    const r = rel(f)
    return !r.startsWith('api/src/config/') && !r.startsWith('web/src/config/')
  })
  for (const f of files) {
    fs.readFileSync(f, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        const hit = proibidos.map((re) => line.match(re)).find(Boolean)
        if (hit) out.push({ id: 'R11', file: rel(f), detail: `linha ${i + 1}: endereço fixo "${hit[0]}" fora da config` })
      })
  }
  return out
}

// ---------- R12 (regra própria): todo service tem teste ao lado ----------
// Motivo: CLAUDE.md do Balcão já exigia; o notification-service nunca teve teste.
export function checkR12() {
  const out = []
  const dir = path.join(ROOT, 'api', 'src', 'services')
  for (const f of walk(dir, (x) => x.endsWith('.ts') && !x.endsWith('.test.ts'))) {
    const teste = f.replace(/\.ts$/, '.test.ts')
    if (!fs.existsSync(teste)) out.push({ id: 'R12', file: rel(f), detail: `sem teste ao lado (${path.basename(teste)})` })
  }
  return out
}

// ---------- utilitário: supressões de lint/tipo em api/src e web/src ----------
function checkSuppressions(termos, id) {
  const out = []
  const re = new RegExp(termos.map((t) => t.replace(/[-@]/g, (c) => `\\${c}`)).join('|'))
  for (const f of codeFiles(SRC_DIRS)) {
    fs.readFileSync(f, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        const m = line.match(re)
        if (m) out.push({ id, file: rel(f), detail: `linha ${i + 1}: comentário de supressão (${m[0]})` })
      })
  }
  return out
}

export const CHECKS = [
  { ids: ['G1'], nome: 'tipos (tsc) e supressões de tipo', run: checkG1 },
  { ids: ['G2'], nome: 'lint (eslint) e supressões de lint', run: checkG2 },
  { ids: ['G3'], nome: 'testes unitários da API', run: checkG3 },
  { ids: ['G4', 'G6', 'G7', 'G8', 'G9'], nome: 'dependências (dependency-cruiser)', run: checkDependencias },
  { ids: ['G5'], nome: 'process.env e import.meta.env só na config', run: checkG5 },
  { ids: ['G10'], nome: 'código morto e dependências sem uso (knip)', run: checkG10 },
  { ids: ['R11'], nome: 'regra própria: endereço fixo fora da config', run: checkR11 },
  { ids: ['R12'], nome: 'regra própria: service com teste ao lado', run: checkR12 },
]
