import { describe, expect, it } from 'vitest'
import { AttachmentService } from './attachment-service'
import type { TicketService } from './ticket-service'
import { HttpError } from '../domain/errors'
import { AttachmentRecord, CurrentUser, Ticket } from '../domain/ticket'
import type { AttachmentRepository } from '../repositories/attachment-repository'

function fakeTicketService(ticket: Pick<Ticket, 'id' | 'customerId'>) {
  return {
    getById: async (user: CurrentUser, id: string) => {
      if (id !== ticket.id || (user.role === 'customer' && user.id !== ticket.customerId)) {
        throw new HttpError(404, 'not_found', 'Chamado não encontrado')
      }
      return ticket
    },
  } as unknown as TicketService
}

const fakeAttachments: AttachmentRepository = {
  create: async (data): Promise<AttachmentRecord> => ({ id: 'att1', createdAt: new Date(), ...data }),
  findById: async () => null,
}

const ticket = { id: 't1', customerId: 'c1' }
const customer: CurrentUser = { id: 'c1', role: 'customer' }

describe('AttachmentService', () => {
  const service = new AttachmentService(fakeAttachments, fakeTicketService(ticket), '/nao-usado-nos-testes')

  it('exige arquivo', async () => {
    await expect(service.upload(customer, 't1', undefined)).rejects.toMatchObject({ status: 422 })
  })

  it('recusa arquivo maior que 5 MB', async () => {
    const file = { size: 5 * 1024 * 1024 + 1, mimetype: 'text/plain', originalname: 'a.txt', buffer: Buffer.from('') }
    await expect(service.upload(customer, 't1', file)).rejects.toMatchObject({ status: 413, code: 'file_too_large' })
  })

  it('recusa tipo não suportado', async () => {
    const file = { size: 10, mimetype: 'image/gif', originalname: 'a.gif', buffer: Buffer.from('') }
    await expect(service.upload(customer, 't1', file)).rejects.toMatchObject({ status: 415, code: 'unsupported_type' })
  })

  it('não deixa outro cliente enviar', async () => {
    const file = { size: 10, mimetype: 'text/plain', originalname: 'a.txt', buffer: Buffer.from('') }
    await expect(service.upload({ id: 'c2', role: 'customer' }, 't1', file)).rejects.toMatchObject({ status: 404 })
  })
})
