import { PrismaClient, Role, TicketStatus, TicketCategory, TicketPriority, TriageStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// Seed idempotente: pode rodar quantas vezes for preciso. Usuários são identificados
// pelo e-mail e chamados pelo título do cliente; o que já existe não é duplicado.
async function ensureUser(name: string, email: string, password: string, role: Role) {
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return existing
  return prisma.user.create({
    data: { name, email, passwordHash: await bcrypt.hash(password, 10), role },
  })
}

async function ensureTicket(
  title: string,
  customerId: string,
  data: {
    description: string
    status?: TicketStatus
    category?: TicketCategory
    priority?: TicketPriority
    triageStatus?: TriageStatus
    assigneeId?: string
    replies?: { authorId: string; body: string }[]
  },
) {
  const existing = await prisma.ticket.findFirst({ where: { title, customerId } })
  if (existing) return existing
  return prisma.ticket.create({
    data: {
      title,
      description: data.description,
      status: data.status,
      category: data.category,
      priority: data.priority,
      triageStatus: data.triageStatus,
      customerId,
      assigneeId: data.assigneeId,
      replies: data.replies ? { create: data.replies } : undefined,
    },
  })
}

async function main() {
  const admin = await ensureUser('Admin', 'admin@balcao.dev', 'Admin@123', 'admin')
  const agent = await ensureUser('Ana Atendente', 'agente@balcao.dev', 'Agente@123', 'agent')
  const customer = await ensureUser('Carlos Cliente', 'cliente@balcao.dev', 'Cliente@123', 'customer')

  await ensureTicket('Não consigo emitir a segunda via do boleto', customer.id, {
    description: 'Quando clico em segunda via aparece uma tela em branco. Preciso pagar até sexta.',
  })

  await ensureTicket('Erro ao salvar o perfil', customer.id, {
    description: 'Ao alterar o telefone no perfil aparece a mensagem "erro inesperado".',
    status: 'in_progress',
    category: 'technical',
    priority: 'medium',
    triageStatus: 'done',
    assigneeId: agent.id,
    replies: [{ authorId: agent.id, body: 'Oi, Carlos! Já estamos olhando o problema.' }],
  })

  await ensureTicket('Dúvida sobre troca de senha', customer.id, {
    description: 'Qual o tamanho mínimo de senha que o sistema aceita?',
    status: 'resolved',
    category: 'account',
    priority: 'low',
    triageStatus: 'done',
    assigneeId: agent.id,
    replies: [
      { authorId: agent.id, body: 'A senha precisa ter pelo menos 8 caracteres.' },
      { authorId: customer.id, body: 'Obrigado!' },
    ],
  })

  console.log(`seed ok: ${admin.email}, ${agent.email}, ${customer.email}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
