// app/middleware/brute_force_middleware.ts
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import cache from '@adonisjs/cache/services/main'

export default class BruteForceMiddleware {
  async handle({ request, response }: HttpContext, next: NextFn) {
    const ip = request.ip()
    const path = request.url()

    // Clé pour le rate limiting par IP
    const key = `brute_force:${ip}`

    // Incrémenter le compteur
    const attempts = await cache.increment(key, 1)

    // Définir l'expiration à 15 minutes
    if (attempts === 1) {
      await cache.expire(key, 900)
    }

    // Blocage après 100 requêtes
    if (attempts > 100) {
      return response.status(429).json({
        success: false,
        message: 'Trop de requêtes. IP temporairement bloquée.',
        error: 'IP_BLOCKED'
      })
    }

    // Ralentir après 50 requêtes
    if (attempts > 50) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    return next()
  }
}
