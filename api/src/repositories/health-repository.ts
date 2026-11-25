import { prisma } from './prisma'

export interface HealthRepository {
  ping(): Promise<void>
}

class PrismaHealthRepository implements HealthRepository {
  async ping() {
    await prisma.$queryRaw`SELECT 1`
  }
}

export const healthRepository = new PrismaHealthRepository()
