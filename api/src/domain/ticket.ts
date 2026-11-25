type Role = 'customer' | 'agent' | 'admin'

export type TicketStatus = 'open' | 'in_progress' | 'resolved'

export type TicketCategory = 'billing' | 'technical' | 'account' | 'other'

export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent'

type TriageStatus = 'pending' | 'done' | 'failed'

export const TICKET_STATUSES: TicketStatus[] = ['open', 'in_progress', 'resolved']
export const TICKET_CATEGORIES: TicketCategory[] = ['billing', 'technical', 'account', 'other']
export const TICKET_PRIORITIES: TicketPriority[] = ['low', 'medium', 'high', 'urgent']

export interface Ticket {
  id: string
  title: string
  description: string
  status: TicketStatus
  category: TicketCategory | null
  priority: TicketPriority | null
  triageStatus: TriageStatus
  customerId: string
  assigneeId: string | null
  createdAt: Date
  updatedAt: Date
}

export interface CurrentUser {
  id: string
  role: Role
}

export interface UserRecord {
  id: string
  name: string
  email: string
  passwordHash: string
  role: Role
  createdAt: Date
}

export interface ReplyRecord {
  id: string
  ticketId: string
  authorId: string
  body: string
  createdAt: Date
  author: { id: string; name: string; role: Role }
}

export interface AttachmentRecord {
  id: string
  ticketId: string
  uploaderId: string
  originalName: string
  storedName: string
  mimeType: string
  sizeBytes: number
  createdAt: Date
}

export interface TicketDetails extends Ticket {
  replies: ReplyRecord[]
  attachments: AttachmentRecord[]
}

// Arquivo recebido no upload (o que o multer entrega, sem depender do Express)
export interface UploadedFile {
  originalname: string
  mimetype: string
  size: number
  buffer: Buffer
}

export function formatTicketRef(ticket: { id: string; title: string }) {
  return `#${ticket.id.slice(0, 8)} (${ticket.title})`
}
