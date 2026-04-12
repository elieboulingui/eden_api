import type { HttpContext } from '@adonisjs/core/http'

const requestsMap = new Map()

export default class RateLimitMiddleware {
  async handle({ request, response }: HttpContext, next: () => Promise<void>) {
    const ip = request.ip()
    const now = Date.now()

    const windowTime = 60 * 1000 // 1 minute
    const maxRequests = 10

    if (!requestsMap.has(ip)) {
      requestsMap.set(ip, [])
    }

    const timestamps = requestsMap.get(ip).filter((time: number) => {
      return now - time < windowTime
    })

    timestamps.push(now)
    requestsMap.set(ip, timestamps)

    if (timestamps.length > maxRequests) {
      return response.status(429).json({
        message: 'Trop de requêtes, réessaie plus tard'
      })
    }

    await next()
  }
}
