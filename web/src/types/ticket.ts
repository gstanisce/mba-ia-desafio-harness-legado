// Tipos do chamado usados pelo front. Espelham api/src/domain/ticket.ts: o front não
// importa arquivos da API (G8); se o domínio mudar, atualize este arquivo também.
export type TicketStatus = 'open' | 'in_progress' | 'resolved'
export type TicketCategory = 'billing' | 'technical' | 'account' | 'other'
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent'
export type TriageStatus = 'pending' | 'done' | 'failed'
