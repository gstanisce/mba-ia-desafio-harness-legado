import { Router } from 'express'
import multer from 'multer'
import { asyncHandler } from '../errors'
import { AuthRequest, requireAuth } from '../middlewares/auth'
import { attachmentService, suggestionService, ticketService } from '../../container'
import type { AttachmentRecord, ReplyRecord, Ticket } from '../../domain/ticket'

const router = Router()
const upload = multer({ storage: multer.memoryStorage() })

function toTicketJson(t: Ticket) {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    category: t.category,
    priority: t.priority,
    triageStatus: t.triageStatus,
    customerId: t.customerId,
    assigneeId: t.assigneeId,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }
}

function toReplyJson(r: ReplyRecord) {
  return {
    id: r.id,
    ticketId: r.ticketId,
    authorId: r.authorId,
    body: r.body,
    createdAt: r.createdAt.toISOString(),
    author: r.author,
  }
}

router.use(requireAuth)

router.get(
  '/',
  asyncHandler<AuthRequest>(async (req, res) => {
    const result = await ticketService.list(req.user, req.query)
    res.json({ ...result, items: result.items.map(toTicketJson) })
  }),
)

router.post(
  '/',
  asyncHandler<AuthRequest>(async (req, res) => {
    const ticket = await ticketService.create(req.user, req.body)
    res.status(201).json(toTicketJson(ticket))
  }),
)

router.get(
  '/:id',
  asyncHandler<AuthRequest>(async (req, res) => {
    const ticket = await ticketService.getDetails(req.user, req.params.id)
    res.json({
      ...toTicketJson(ticket),
      replies: ticket.replies.map(toReplyJson),
      attachments: ticket.attachments,
    })
  }),
)

router.post(
  '/:id/assign',
  asyncHandler<AuthRequest>(async (req, res) => {
    const ticket = await ticketService.assign(req.user, req.params.id)
    res.json(toTicketJson(ticket))
  }),
)

router.post(
  '/:id/resolve',
  asyncHandler<AuthRequest>(async (req, res) => {
    const ticket = await ticketService.resolve(req.user, req.params.id)
    res.json(toTicketJson(ticket))
  }),
)

router.post(
  '/:id/replies',
  asyncHandler<AuthRequest>(async (req, res) => {
    const reply = await ticketService.addReply(req.user, req.params.id, req.body)
    res.status(201).json(toReplyJson(reply))
  }),
)

router.post(
  '/:id/attachments',
  upload.single('file'),
  asyncHandler<AuthRequest>(async (req, res) => {
    const attachment: AttachmentRecord = await attachmentService.upload(req.user, req.params.id, req.file)
    res.status(201).json(attachment)
  }),
)

router.post(
  '/:id/suggest-reply',
  asyncHandler<AuthRequest>(async (req, res) => {
    const suggestion = await suggestionService.suggestReply(req.user, req.params.id)
    res.json({ suggestion })
  }),
)

export default router
