import path from 'path'

// Único lugar da API que lê process.env (G5). O resto recebe estes valores por
// parâmetro ou importa `config`. Porta, banco, pasta de anexos e origem do front
// vêm daqui, então duas cópias do projeto só precisam de outro .env / variáveis.
const env = process.env

export const config = {
  port: Number(env.PORT || 4000),
  nodeEnv: env.NODE_ENV || 'development',
  databaseUrl: env.DATABASE_URL,
  jwtSecret: env.JWT_SECRET || 'dev-secret',
  aiMode: env.AI_MODE || 'fake',
  openaiApiKey: env.OPENAI_API_KEY,
  uploadDir: path.resolve(process.cwd(), env.UPLOAD_DIR || '../.balcao/uploads'),
  corsOrigin: env.CORS_ORIGIN || 'http://localhost:5173',
  triageIntervalMs: Number(env.TRIAGE_INTERVAL_MS || 2000),
}
