// app/middleware/block_unauthorized_origin_middleware.ts
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import app from '@adonisjs/core/services/app'

export default class BlockUnauthorizedOriginMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const origin = ctx.request.header('origin')

    // Origines autorisées
    const allowedOrigins = app.inDev
      ? ['http://localhost:3333', 'http://localhost:3000', 'http://127.0.0.1:3333']
      : ['https://paradis-alimentaires.vercel.app']

    // Si une origine est présente et n'est pas autorisée
    if (origin && !allowedOrigins.includes(origin)) {
      return ctx.response.status(403).json({
        error: 'Accès refusé : origine non autorisée'
      })
    }

    // Continuer vers la route
    await next()
  }
}