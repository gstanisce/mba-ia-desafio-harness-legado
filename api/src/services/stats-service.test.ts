import { describe, expect, it } from 'vitest'
import { StatsService } from './stats-service'
import type { StatsRepository } from '../repositories/stats-repository'

describe('StatsService', () => {
  it('monta os totais e manda chamado sem triagem para "untriaged"', async () => {
    const repo: StatsRepository = {
      countTickets: async () => ({
        byStatus: [{ value: 'open', count: 2 }],
        byCategory: [{ value: 'billing', count: 1 }, { value: null, count: 2 }],
        byPriority: [{ value: 'urgent', count: 3 }],
      }),
    }
    const summary = await new StatsService(repo).summary()
    expect(summary.byStatus).toEqual({ open: 2, in_progress: 0, resolved: 0 })
    expect(summary.byCategory).toEqual({ billing: 1, technical: 0, account: 0, other: 0, untriaged: 2 })
    expect(summary.byPriority).toEqual({ low: 0, medium: 0, high: 0, urgent: 3, untriaged: 0 })
  })
})
