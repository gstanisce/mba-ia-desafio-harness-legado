// Biblioteca compartilhada pelo subir/derrubar. Só usa módulos nativos do Node,
// então roda antes de qualquer npm install.
//
// Isolamento entre cópias (worktrees ou clones):
//   - cada cópia pega um "slot" N num registro guardado no .git comum do repositório.
//     Slot 0 usa as portas e o banco padrão (4000, 5173, balcao); slot N usa 4000+N,
//     5173+N e o banco balcao_N. Duas worktrees de um mesmo repo nunca dividem slot.
//   - anexos, PIDs, logs e a configuração da cópia ficam em <cópia>/.balcao/.
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const WIN = process.platform === 'win32'
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
export const STATE_DIR = path.join(ROOT, '.balcao')
export const RUN_DIR = path.join(STATE_DIR, 'run')
export const LOG_DIR = path.join(STATE_DIR, 'logs')
export const INSTANCE_FILE = path.join(STATE_DIR, 'instancia.json')

const PG_USER = 'balcao'
const PG_PASSWORD = 'balcao'
const PG_PORT = 5432

export function log(msg) {
  process.stdout.write(`${msg}\n`)
}

export function fail(msg) {
  process.stderr.write(`\nERRO: ${msg}\n`)
  process.exit(1)
}

export function ensureDirs() {
  for (const d of [STATE_DIR, RUN_DIR, LOG_DIR]) fs.mkdirSync(d, { recursive: true })
}

// ---------- registro de slots (compartilhado entre worktrees) ----------

function gitCommonDir() {
  const res = spawnSync('git', ['-C', ROOT, 'rev-parse', '--path-format=absolute', '--git-common-dir'], { encoding: 'utf8' })
  if (res.status !== 0) return null
  return res.stdout.trim()
}

function slotsDir() {
  const common = gitCommonDir()
  // sem git, o registro fica só nesta pasta (slot 0 sempre)
  return common ? path.join(common, 'balcao-slots') : path.join(STATE_DIR, 'slots')
}

function readSlot(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')).path
  } catch {
    return null
  }
}

export function slotPorts(n) {
  return { api: 4000 + n, web: 5173 + n }
}

export function slotNames(n) {
  return {
    db: n === 0 ? 'balcao' : `balcao_${n}`,
    testDb: n === 0 ? 'balcao_test' : `balcao_test_${n}`,
  }
}

// Escolhe o slot desta cópia: o que ela já tem, ou o menor livre (sem registro vivo e com portas livres).
export async function claimSlot() {
  const dir = slotsDir()
  fs.mkdirSync(dir, { recursive: true })
  const mine = fs.readdirSync(dir).find((f) => readSlot(path.join(dir, f)) === ROOT)
  if (mine) return Number(path.basename(mine, '.json'))

  for (let n = 0; n < 50; n++) {
    const file = path.join(dir, `${n}.json`)
    const dono = fs.existsSync(file) ? readSlot(file) : null
    if (dono && fs.existsSync(dono)) continue // slot ocupado por outra cópia que ainda existe
    const { api, web } = slotPorts(n)
    if (!(await portFree(api)) || !(await portFree(web))) continue
    fs.writeFileSync(file, JSON.stringify({ path: ROOT }, null, 2))
    return n
  }
  fail('não achei slot livre (50 cópias já registradas ou portas ocupadas).')
}

export function writeInstance(info) {
  fs.writeFileSync(INSTANCE_FILE, JSON.stringify(info, null, 2) + '\n')
}

export function readInstance() {
  try {
    return JSON.parse(fs.readFileSync(INSTANCE_FILE, 'utf8'))
  } catch {
    return null
  }
}

// ---------- portas ----------

export function portFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer()
    srv.once('error', () => resolve(false))
    srv.once('listening', () => srv.close(() => resolve(true)))
    srv.listen(port)
  })
}

export async function waitHttp(url, timeoutMs = 60000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url)
      if (res.status < 500) return true
    } catch {
      // ainda não subiu
    }
    await sleep(500)
  }
  return false
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

// ---------- processos ----------

export function pidFile(name) {
  return path.join(RUN_DIR, `${name}.pid`)
}

export function readPid(name) {
  try {
    return Number(fs.readFileSync(pidFile(name), 'utf8').trim()) || null
  } catch {
    return null
  }
}

export function isAlive(pid) {
  if (!pid) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

// Sobe um script JS em segundo plano, direto com o node (sem npm nem shell no meio).
// O PID gravado é o do processo que de fato roda: no Windows, com shell, o PID seria o
// do cmd.exe, que sai antes do servidor e deixaria a cópia sem como ser derrubada.
// No POSIX o processo vira líder do próprio grupo (detached), então derrubar mata a árvore.
export function startNode(name, script, args, { cwd, env }) {
  const out = fs.openSync(path.join(LOG_DIR, `${name}.log`), 'a')
  // detached em todas as plataformas: no POSIX cria o grupo de processos; no Windows tira o
  // filho do console de quem o criou, então ele não morre quando a subida termina.
  const child = spawn(process.execPath, [script, ...args], {
    cwd,
    env,
    detached: true,
    stdio: ['ignore', out, out],
    windowsHide: true,
  })
  child.unref()
  fs.writeFileSync(pidFile(name), String(child.pid))
  return child.pid
}

export async function stopProcess(name) {
  const pid = readPid(name)
  if (!pid || !isAlive(pid)) {
    fs.rmSync(pidFile(name), { force: true })
    return 'já estava parado'
  }
  if (WIN) {
    spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' })
  } else {
    try {
      process.kill(-pid, 'SIGTERM')
    } catch {
      process.kill(pid, 'SIGTERM')
    }
    for (let i = 0; i < 20 && isAlive(pid); i++) await sleep(250)
    if (isAlive(pid)) {
      try {
        process.kill(-pid, 'SIGKILL')
      } catch {
        process.kill(pid, 'SIGKILL')
      }
    }
  }
  fs.rmSync(pidFile(name), { force: true })
  return 'parado'
}

// ---------- comandos ----------

export function npmRun(cwd, args, extraEnv = {}) {
  const res = spawnSync('npm', args, {
    cwd,
    env: { ...process.env, ...extraEnv },
    stdio: 'inherit',
    shell: WIN,
  })
  return res.status === 0
}

export function commandWorks(cmd, args) {
  const res = spawnSync(cmd, args, { stdio: 'ignore', shell: WIN })
  return res.status === 0
}

// ---------- Docker (no Windows, o Docker costuma estar no WSL) ----------

let dockerRunner = null

// Devolve { cmd, args } para chamar docker: direto, ou pelo WSL quando o Docker só existe lá.
export function dockerRunnerCmd() {
  if (dockerRunner) return dockerRunner
  if (commandWorks('docker', ['version'])) {
    dockerRunner = { wsl: false }
  } else if (WIN && commandWorks('wsl', ['--', 'docker', 'version'])) {
    dockerRunner = { wsl: true }
  } else {
    fail('Docker não encontrado. Instale o Docker (no Windows, use o Docker dentro do WSL).')
  }
  return dockerRunner
}

// Caminho como o Docker do WSL enxerga. C:\x\y vira /mnt/c/x/y (montagem padrão do WSL).
export function dockerPath(p) {
  if (!dockerRunnerCmd().wsl) return p
  const m = p.match(/^([A-Za-z]):[\\/]?(.*)$/)
  if (!m) return p
  return `/mnt/${m[1].toLowerCase()}/${m[2].replace(/\\/g, '/')}`
}

export function docker(args, { capture = false, input } = {}) {
  const runner = dockerRunnerCmd()
  const cmd = runner.wsl ? 'wsl' : 'docker'
  const full = runner.wsl ? ['--', 'docker', ...args] : args
  const res = spawnSync(cmd, full, {
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : ['ignore', 'inherit', 'inherit'],
    input,
    shell: false,
  })
  return { ok: res.status === 0, out: (res.stdout || '').trim(), err: (res.stderr || '').trim() }
}

export function composeArgs() {
  const file = dockerPath(path.join(ROOT, 'docker-compose.yml'))
  return ['compose', '-f', file, '--project-directory', dockerPath(ROOT)]
}

export async function waitPostgres(timeoutMs = 90000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const r = docker([...composeArgs(), 'exec', '-T', 'db', 'pg_isready', '-U', PG_USER], { capture: true })
    if (r.ok) return true
    await sleep(1000)
  }
  return false
}

export function ensureDatabase(name) {
  const check = docker(
    [...composeArgs(), 'exec', '-T', 'db', 'psql', '-U', PG_USER, '-d', 'postgres', '-tAc', `SELECT 1 FROM pg_database WHERE datname='${name}'`],
    { capture: true },
  )
  if (check.out === '1') return
  const create = docker([...composeArgs(), 'exec', '-T', 'db', 'psql', '-U', PG_USER, '-d', 'postgres', '-c', `CREATE DATABASE "${name}"`], {
    capture: true,
  })
  if (!create.ok) fail(`não consegui criar o banco ${name}: ${create.err}`)
}

export function databaseUrl(name) {
  return `postgresql://${PG_USER}:${PG_PASSWORD}@localhost:${PG_PORT}/${name}`
}

