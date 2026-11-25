import { describe, expect, it } from 'vitest'
import { SuggestionService } from './suggestion-service'
import type { TicketService } from './ticket-service'
import type { UserRepository } from '../repositories/user-repository'
import { HttpError } from '../domain/errors'

const ticket = { id: 't1', title: 'Erro no login', description: 'Não consigo entrar na conta', customerId: 'c1' }

function fakeTickets() {
  return {
    getById: async () => ticket,
  } as unknown as TicketService
}

const users = {
  findById: async (id: string) => (id === 'c1' ? { id: 'c1', name: 'Maria' } : null),
} as unknown as UserRepository

describe('SuggestionService', () => {
  it('não deixa cliente pedir sugestão', async () => {
    const service = new SuggestionService(fakeTickets(), users, async () => 'x')
    await expect(service.suggestReply({ id: 'c1', role: 'customer' }, 't1')).rejects.toMatchObject({ status: 403 })
    await expect(service.suggestReply({ id: 'c1', role: 'customer' }, 't1')).rejects.toBeInstanceOf(HttpError)
  })

  it('pede a sugestão com o nome do cliente e os dados do chamado', async () => {
    const seen: unknown[] = []
    const service = new SuggestionService(fakeTickets(), users, async (input) => {
      seen.push(input)
      return 'resposta'
    })
    expect(await service.suggestReply({ id: 'a1', role: 'agent' }, 't1')).toBe('resposta')
    expect(seen).toEqual([{ customerName: 'Maria', title: 'Erro no login', description: 'Não consigo entrar na conta' }])
  })

  it('usa "cliente" quando o autor do chamado não existe mais', async () => {
    const seen: unknown[] = []
    const noUsers = { findById: async () => null } as unknown as UserRepository
    const service = new SuggestionService(fakeTickets(), noUsers, async (input) => {
      seen.push(input)
      return null
    })
    await service.suggestReply({ id: 'a1', role: 'admin' }, 't1')
    expect(seen[0]).toMatchObject({ customerName: 'cliente' })
  })
})
