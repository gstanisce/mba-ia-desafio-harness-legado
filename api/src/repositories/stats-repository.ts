import { prisma } from './prisma'

// contagem agrupada: valor da coluna (null quando o chamado não foi triado) e quantidade
type GroupCount = { value: string | null; count: number }

export interface StatsRepository {
  countTickets(): Promise<{ byStatus: GroupCount[]; byCategory: GroupCount[]; byPriority: GroupCount[] }>
}

class PrismaStatsRepository implements StatsRepository {
  async countTickets() {
    const [statusRows, categoryRows, priorityRows] = await Promise.all([
      prisma.ticket.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.ticket.groupBy({ by: ['category'], _count: { _all: true } }),
      prisma.ticket.groupBy({ by: ['priority'], _count: { _all: true } }),
    ])
    return {
      byStatus: statusRows.map((r) => ({ value: r.status, count: r._count._all })),
      byCategory: categoryRows.map((r) => ({ value: r.category, count: r._count._all })),
      byPriority: priorityRows.map((r) => ({ value: r.priority, count: r._count._all })),
    }
  }
}

export const statsRepository = new PrismaStatsRepository()
