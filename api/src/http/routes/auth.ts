import { Router } from 'express'
import { asyncHandler, HttpError } from '../errors'
import { AuthRequest, requireAuth, signToken } from '../middlewares/auth'
import { authService } from '../../container'
import { EmailTakenError, InvalidCredentialsError, loginSchema, registerSchema } from '../../services/auth-service'

const router = Router()

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const parsed = registerSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new HttpError(422, 'validation_error', parsed.error.issues[0].message)
    }
    try {
      const user = await authService.register(parsed.data)
      res.status(201).json(user)
    } catch (err) {
      if (err instanceof EmailTakenError) throw new HttpError(409, 'email_taken', err.message)
      throw err
    }
  }),
)

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new HttpError(422, 'validation_error', parsed.error.issues[0].message)
    }
    try {
      const user = await authService.login(parsed.data)
      res.json({ token: signToken(user), user })
    } catch (err) {
      if (err instanceof InvalidCredentialsError) throw new HttpError(401, 'invalid_credentials', err.message)
      throw err
    }
  }),
)

router.get(
  '/me',
  requireAuth,
  asyncHandler<AuthRequest>(async (req, res) => {
    res.json(await authService.me(req.user.id))
  }),
)

export default router
