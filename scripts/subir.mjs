#!/usr/bin/env node
// Sobe o Balcão inteiro nesta cópia: banco (Docker), migrations, seed, API, worker e front.
// Pode rodar quantas vezes quiser: o que já está no ar é mantido, a seed é idempotente.
//
//   node scripts/subir.mjs
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import {
  ROOT,
  STATE_DIR,
  WIN,
  claimSlot,
  composeArgs,
  databaseUrl,
  dockerRunnerCmd,
  docker,
  ensureDatabase,
  ensureDirs,
  fail,
  isAlive,
  log,
  npmRun,
  portFree,
  readPid,
  sleep,
  slotNames,
  slotPorts,
  startNode,
  waitHttp,
  waitPostgres,
  writeInstance,
  registerCopy,
} from './lib/balcao.mjs'

const major = Number(process.versions.node.split('.')[0])
if (major < 22) fail(`Node ${process.versions.node} é antigo. Use Node 22 ou superior.`)

dockerRunnerCmd() // falha com mensagem clara se não houver Docker

ensureDirs()

const API = path.join(ROOT, 'api')
const WEB = path.join(ROOT, 'web')
const TSX = path.join(API, 'node_modules', 'tsx', 'dist', 'cli.mjs')
const VITE = path.join(WEB, 'node_modules', 'vite', 'bin', 'vite.js')

// 1. Slot desta cópia: portas, nome do banco e pasta de anexos
const slot = await claimSlot()
const { api: apiPort, web: webPort } = slotPorts(slot)
const names = slotNames(slot)
const uploadDir = path.join(STATE_DIR, 'uploads')
const apiUrl = `http://localhost:${apiPort}`
const webUrl = `http://localhost:${webPort}`

const instance = {
  slot,
  root: ROOT,
  apiUrl,
  webUrl,
  apiPort,
  webPort,
  dbName: names.db,
  testDbName: names.testDb,
  databaseUrl: databaseUrl(names.db),
  uploadDir,
}
writeInstance(instance)
log(`Cópia: ${ROOT}`)
log(`Slot ${slot}: API ${apiPort}, front ${webPort}, banco ${names.db}`)

// 2. Banco (um Postgres só para todas as cópias; cada cópia tem o seu banco)
log('\n[1/7] Banco de dados (Docker)')
const up = docker([...composeArgs(), 'up', '-d'])
if (!up.ok) fail('docker compose up falhou. Veja a mensagem acima.')
if (!(await waitPostgres())) fail('o Postgres não ficou pronto em 90s.')
ensureDatabase(names.db)
ensureDatabase(names.testDb)

// 3. Dependências: npm ci só quando o lockfile mudou (npm install reescreveria o lock)
log('\n[2/7] Dependências')
for (const dir of [ROOT, API, WEB]) installIfNeeded(dir)

// 4. Arquivo .env da API (valores padrão; a subida sobrepõe porta, banco e anexos)
const envFile = path.join(API, '.env')
if (!fs.existsSync(envFile)) fs.copyFileSync(path.join(API, '.env.example'), envFile)

// 5. Migrations e seed
log('\n[3/7] Prisma client, migrations e seed')
const apiEnv = {
  ...process.env,
  PORT: String(apiPort),
  DATABASE_URL: instance.databaseUrl,
  DATABASE_URL_TEST: databaseUrl(names.testDb),
  UPLOAD_DIR: uploadDir,
  CORS_ORIGIN: webUrl,
}
ensurePrismaClient()
if (!npmRun(API, ['exec', '--', 'prisma', 'migrate', 'deploy'], apiEnv)) fail('prisma migrate deploy falhou.')
if (!npmRun(API, ['run', 'seed'], apiEnv)) fail('a seed falhou.')

// 6. Processos: API, worker e front (cada um só se não estiver no ar)
log('\n[4/7] API')
await startIfNeeded('api', async () => {
  if (!(await portFree(apiPort))) fail(`a porta ${apiPort} está ocupada por outro processo.`)
  startNode('api', TSX, ['--env-file=.env', 'src/main.ts'], { cwd: API, env: apiEnv })
  if (!(await waitHttp(`${apiUrl}/api/health`))) fail(`a API não respondeu em ${apiUrl} (veja .balcao/logs/api.log).`)
})

log('\n[5/7] Worker de triagem')
await startIfNeeded('worker', async () => {
  startNode('worker', TSX, ['--env-file=.env', 'src/jobs/triage-worker.ts'], { cwd: API, env: apiEnv })
  await sleep(2000)
  if (!isAlive(readPid('worker'))) fail('o worker caiu logo depois de subir (veja .balcao/logs/worker.log).')
})

log('\n[6/7] Front')
const webEnv = { ...process.env, VITE_API_URL: apiUrl }
await startIfNeeded('web', async () => {
  if (!(await portFree(webPort))) fail(`a porta ${webPort} está ocupada por outro processo.`)
  startNode('web', VITE, ['--port', String(webPort), '--strictPort'], { cwd: WEB, env: webEnv })
  if (!(await waitHttp(webUrl))) fail(`o front não respondeu em ${webUrl} (veja .balcao/logs/web.log).`)
})

// 7. Hook do Git: roda os gates antes de cada commit nesta cópia
log('\n[7/7] Hook de commit')
hookPath()
registerCopy()

const aiMode = readEnvValue(envFile, 'AI_MODE') || 'fake'
log(`
Balcão no ar nesta cópia (slot ${slot}).

  API ............ ${apiUrl}   (health: ${apiUrl}/api/health)
  Front .......... ${webUrl}   (abra este endereço no navegador)
  Banco .......... ${names.db}  (Postgres em localhost:5432, compartilhado com outras cópias)
  Anexos ......... ${uploadDir}
  Worker ......... pid ${readPid('worker')}   (log: .balcao/logs/worker.log)
  IA ............. modo ${aiMode}

Contas da seed: admin@balcao.dev / Admin@123 · agente@balcao.dev / Agente@123 · cliente@balcao.dev / Cliente@123
Derrubar esta cópia: node scripts/derrubar.mjs
`)

// ---------- helpers ----------

async function startIfNeeded(name, start) {
  const pid = readPid(name)
  if (pid && isAlive(pid)) {
    log(`  ${name} já está no ar (pid ${pid}), mantido.`)
    return
  }
  await start()
  log(`  ${name} no ar (pid ${readPid(name)}).`)
}

// prisma generate só roda quando o schema mudou. No Windows ele não consegue trocar o
// engine (.dll) enquanto a API ou o worker da cópia estão usando, então rodar à toa quebra a subida.
function ensurePrismaClient() {
  const schema = fs.readFileSync(path.join(API, 'prisma', 'schema.prisma'))
  const hash = crypto.createHash('sha256').update(schema).digest('hex')
  const marker = path.join(API, 'node_modules', '.balcao-prisma-sha256')
  const atual = fs.existsSync(marker) ? fs.readFileSync(marker, 'utf8').trim() : ''
  if (atual === hash) {
    log('  prisma client em dia (schema não mudou).')
    return
  }
  if (isAlive(readPid('api'))) {
    if (atual) fail('o schema do Prisma mudou e a API desta cópia está no ar. Rode node scripts/derrubar.mjs e depois esta subida.')
    log('  aviso: API no ar e sem marcador do client: não regero o Prisma agora (no Windows o engine fica travado). Se mudou o schema, derrube e suba de novo.')
    return
  }
  if (!npmRun(API, ['exec', '--', 'prisma', 'generate'], process.env)) fail('prisma generate falhou.')
  fs.writeFileSync(marker, hash)
}

function installIfNeeded(dir) {
  const lock = fs.readFileSync(path.join(dir, 'package-lock.json'))
  const pkg = fs.readFileSync(path.join(dir, 'package.json'))
  const hash = crypto.createHash('sha256').update(lock).update(pkg).digest('hex')
  const marker = path.join(dir, 'node_modules', '.balcao-lock-sha256')
  const atual = fs.existsSync(marker) ? fs.readFileSync(marker, 'utf8').trim() : ''
  const rel = path.relative(ROOT, dir) || '.'
  if (atual === hash) {
    log(`  ${rel}: dependências em dia.`)
    return
  }
  // npm ci apaga node_modules; com a cópia no ar, o engine do Prisma está travado no Windows
  const noAr = ['api', 'worker', 'web'].some((n) => isAlive(readPid(n)))
  if (noAr) {
    log(`  ${rel}: aviso: o marcador de dependências não bate, mas a cópia está no ar. Mantenho as dependências; derrube e suba de novo para reinstalar.`)
    return
  }
  log(`  ${rel}: npm ci ...`)
  if (!npmRun(dir, ['ci', '--no-audit', '--no-fund', '--loglevel=error'])) fail(`npm ci falhou em ${rel}.`)
  fs.mkdirSync(path.dirname(marker), { recursive: true })
  fs.writeFileSync(marker, hash)
}

function hookPath() {
  const res = spawnSync('git', ['-C', ROOT, 'config', 'core.hooksPath', '.githooks'], { stdio: 'ignore' })
  if (res.status !== 0) fail('não consegui configurar o hook do Git (core.hooksPath).')
  const hook = path.join(ROOT, '.githooks', 'pre-commit')
  if (!WIN && fs.existsSync(hook)) fs.chmodSync(hook, 0o755)
  log('  hook ativo: .githooks/pre-commit (gates de tipo, lint e demais antes de cada commit).')
}

function readEnvValue(file, key) {
  const m = fs.readFileSync(file, 'utf8').match(new RegExp(`^${key}=(.*)$`, 'm'))
  return m ? m[1].trim() : null
}
