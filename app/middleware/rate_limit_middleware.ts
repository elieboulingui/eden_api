import type { HttpContext } from '@adonisjs/core/http'
export default class RateLimitMiddleware {
  async handle({}: HttpContext, next: () => Promise<void>) {
    await next()
  }
}
