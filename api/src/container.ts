// Composição da API: liga cada service aos seus repositórios e integrações.
// As rotas (http/) importam daqui, nunca dos repositórios direto (G4).
import { config } from './config/env'
import { suggestReply } from './integrations/ai-client'
import { attachmentRepository } from './repositories/attachment-repository'
import { healthRepository } from './repositories/health-repository'
import { replyRepository } from './repositories/reply-repository'
import { statsRepository } from './repositories/stats-repository'
import { ticketRepository } from './repositories/ticket-repository'
import { userRepository } from './repositories/user-repository'
import { AttachmentService } from './services/attachment-service'
import { AuthService } from './services/auth-service'
import { HealthService } from './services/health-service'
import { StatsService } from './services/stats-service'
import { SuggestionService } from './services/suggestion-service'
import { TicketService } from './services/ticket-service'

export const ticketService = new TicketService(ticketRepository, replyRepository)
export const attachmentService = new AttachmentService(attachmentRepository, ticketService, config.uploadDir)
export const authService = new AuthService(userRepository)
export const statsService = new StatsService(statsRepository)
export const healthService = new HealthService(healthRepository)
export const suggestionService = new SuggestionService(ticketService, userRepository, suggestReply)
