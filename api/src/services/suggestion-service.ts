import { HttpError } from '../domain/errors'
import { CurrentUser } from '../domain/ticket'
import type { UserRepository } from '../repositories/user-repository'
import type { TicketService } from './ticket-service'

// a sugestão em si (fake ou OpenAI) é injetada: o service não conhece a integração de IA
export type SuggestFn = (input: { customerName: string; title: string; description: string }) => Promise<string | null>

export class SuggestionService {
  constructor(
    private tickets: TicketService,
    private users: UserRepository,
    private suggest: SuggestFn,
  ) {}

  async suggestReply(user: CurrentUser, ticketId: string) {
    if (user.role === 'customer') {
      throw new HttpError(403, 'forbidden', 'Só atendentes e admins podem pedir sugestão')
    }
    const ticket = await this.tickets.getById(user, ticketId)
    const customer = await this.users.findById(ticket.customerId)
    const customerName = customer ? customer.name : 'cliente'
    return this.suggest({ customerName, title: ticket.title, description: ticket.description })
  }
}
