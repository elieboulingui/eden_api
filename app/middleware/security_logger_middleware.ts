// app/middleware/security_logger_middleware.ts
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

export default class SecurityLoggerMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    // ✅ Laisse tout passer sans rien faire
    await next()
  }
}
