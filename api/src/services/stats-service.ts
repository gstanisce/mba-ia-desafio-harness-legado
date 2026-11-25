import type { StatsRepository } from '../repositories/stats-repository'

export class StatsService {
  constructor(private stats: StatsRepository) {}

  async summary() {
    const { byStatus: statusRows, byCategory: categoryRows, byPriority: priorityRows } = await this.stats.countTickets()

    const byStatus: Record<string, number> = { open: 0, in_progress: 0, resolved: 0 }
    statusRows.forEach((row) => {
      byStatus[row.value ?? 'untriaged'] = row.count
    })

    const byCategory: Record<string, number> = { billing: 0, technical: 0, account: 0, other: 0, untriaged: 0 }
    categoryRows.forEach((row) => {
      byCategory[row.value || 'untriaged'] = row.count
    })

    const byPriority: Record<string, number> = { low: 0, medium: 0, high: 0, urgent: 0, untriaged: 0 }
    priorityRows.forEach((row) => {
      byPriority[row.value || 'untriaged'] = row.count
    })

    return { byStatus, byCategory, byPriority }
  }
}
