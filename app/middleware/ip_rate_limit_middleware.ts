// app/middleware/ip_rate_limit_middleware.ts
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

export default class IpRateLimitMiddleware {
  async handle(_ctx: HttpContext, next: NextFn) {
    return next()
  }
}
