import { NextFunction, Request, Response } from 'express'
import { HttpError } from '../domain/errors'

export { HttpError }

// handler assíncrono: qualquer rejeição vai para o errorHandler. O tipo R diz qual
// requisição a rota recebe (AuthRequest nas rotas protegidas por requireAuth).
export function asyncHandler<R extends Request = Request>(fn: (req: R, res: Response, next: NextFunction) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req as R, res, next).catch(next)
  }
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: 'not_found', message: 'Rota não encontrada' })
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.code, message: err.message })
  }
  if (err instanceof Error && err.name === 'MulterError') {
    return res.status(422).json({ error: 'validation_error', message: err.message })
  }
  if (typeof err === 'object' && err !== null && 'type' in err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'bad_request', message: 'JSON inválido' })
  }
  console.log('erro inesperado', err)
  res.status(500).json({ error: 'internal_error', message: 'Erro interno' })
}
