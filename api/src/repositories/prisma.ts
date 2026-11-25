import { PrismaClient } from '@prisma/client'
import { config } from '../config/env'

if (!config.databaseUrl) {
  throw new Error('DATABASE_URL não definida: rode pelo ./subir ou defina no api/.env')
}

export const prisma = new PrismaClient({
  datasources: { db: { url: config.databaseUrl } },
  log: config.nodeEnv === 'development' ? ['warn', 'error'] : ['error'],
})
