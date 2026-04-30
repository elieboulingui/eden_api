// app/middleware/ip_rate_limit_middleware.ts
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

export default class IpRateLimitMiddleware {
  async handle({ request, response }: HttpContext, next: NextFn) {
    // ✅ Laisse tout passer sans limite
    return next()
  }
}
