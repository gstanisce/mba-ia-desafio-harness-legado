import OpenAI from 'openai'
import { config } from '../config/env'
import { TICKET_CATEGORIES, TICKET_PRIORITIES, TicketCategory, TicketPriority } from '../domain/ticket'

export type Classification = {
  category: TicketCategory
  priority: TicketPriority
}

type TicketInput = {
  title: string
  description: string
}

const MODEL = 'gpt-4o-mini'

// único lugar do projeto que importa o pacote openai (G7)

function normalize(text: string) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

function containsAny(text: string, words: string[]) {
  return words.some((w) => text.includes(w))
}

export function classifyFake(ticket: TicketInput): Classification {
  if (ticket.title.toLowerCase().includes('[falha-ia]')) {
    throw new Error('classificacao falhou')
  }
  const text = normalize(`${ticket.title} ${ticket.description}`)

  let category: TicketCategory = 'other'
  if (containsAny(text, ['fatura', 'cobranca', 'boleto', 'pagamento', 'reembolso'])) category = 'billing'
  else if (containsAny(text, ['senha', 'login', 'acesso', 'conta bloqueada'])) category = 'account'
  else if (containsAny(text, ['erro', 'bug', 'falha', 'nao funciona', 'travou'])) category = 'technical'

  let priority: TicketPriority = 'medium'
  if (containsAny(text, ['urgente', 'fora do ar', 'parado'])) priority = 'urgent'
  else if (containsAny(text, ['nao consigo', 'bloquead'])) priority = 'high'
  else if (containsAny(text, ['duvida', 'sugestao'])) priority = 'low'

  return { category, priority }
}

export function suggestReplyFake(input: { customerName: string; title: string }) {
  return `Olá, ${input.customerName}! Recebemos o seu chamado "${input.title}" e a nossa equipe já está analisando.`
}

function openaiClient() {
  return new OpenAI({ apiKey: config.openaiApiKey })
}

async function classifyWithOpenAI(ticket: TicketInput): Promise<Classification> {
  const completion = await openaiClient().chat.completions.create({
    model: MODEL,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'Você classifica chamados de suporte. Responda só com JSON no formato {"category": "...", "priority": "..."}. ' +
          `category: ${TICKET_CATEGORIES.join(', ')}. priority: ${TICKET_PRIORITIES.join(', ')}.`,
      },
      { role: 'user', content: `Título: ${ticket.title}\n\nDescrição: ${ticket.description}` },
    ],
  })
  const data: { category?: unknown; priority?: unknown } = JSON.parse(completion.choices[0].message.content || '{}')
  if (!TICKET_CATEGORIES.includes(data.category as TicketCategory) || !TICKET_PRIORITIES.includes(data.priority as TicketPriority)) {
    throw new Error('resposta da IA fora do formato')
  }
  return { category: data.category as TicketCategory, priority: data.priority as TicketPriority }
}

export async function classifyTicket(ticket: TicketInput): Promise<Classification> {
  if (config.aiMode === 'openai') {
    return classifyWithOpenAI(ticket)
  }
  return classifyFake(ticket)
}

// prompt unificado (o mesmo que a rota de sugestão já usava)
export async function suggestReply(input: { customerName: string; title: string; description: string }): Promise<string | null> {
  if (config.aiMode === 'openai') {
    const completion = await openaiClient().chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: 'Você é um atendente de suporte. Escreva uma resposta curta e educada, em português, para o chamado.',
        },
        { role: 'user', content: `Cliente: ${input.customerName}\nTítulo: ${input.title}\n\n${input.description}` },
      ],
    })
    return completion.choices[0].message.content
  }
  return suggestReplyFake(input)
}
