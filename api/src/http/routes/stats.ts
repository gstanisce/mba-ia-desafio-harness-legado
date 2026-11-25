import { Router } from 'express'
import { statsService } from '../../container'
import { requireAuth, requireRole } from '../middlewares/auth'

const router = Router()

router.get('/', requireAuth, requireRole('admin'), async (_req, res, next) => {
  try {
    res.json(await statsService.summary())
  } catch (err) {
    next(err)
  }
})

export default router
