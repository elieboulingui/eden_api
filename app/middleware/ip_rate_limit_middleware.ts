// app/middleware/ip_rate_limit_middleware.ts
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import redis from '@adonisjs/redis/services/main'

export default class IpRateLimitMiddleware {
  async handle({ request, response }: HttpContext, next: NextFn) {
    const ip = request.ip()
    const key = `rate_limit:ip:${ip}`

    const current = await redis.get(key)
    const count = current ? parseInt(current) : 0

    if (count >= 60) {
      return response.status(429).json({
        success: false,
        message: 'Trop de requêtes. Réessayez plus tard.',
        error: 'RATE_LIMIT_IP',
        retryAfter: 60
      })
    }

    await redis.multi()
      .incr(key)
      .expire(key, 60)
      .exec()

    response.header('X-RateLimit-Limit', '60')
    response.header('X-RateLimit-Remaining', String(60 - count - 1))

    return next()
  }
}
