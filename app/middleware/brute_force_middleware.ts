// app/middleware/brute_force_middleware.ts
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

// Stockage en mémoire (simple Map)
const ipRequests = new Map<string, { count: number; resetAt: number }>()

export default class BruteForceMiddleware {
  async handle({ request, response }: HttpContext, next: NextFn) {
    const ip = request.ip()
    const now = Date.now()
    const windowMs = 15 * 60 * 1000 // 15 minutes

    // Nettoyer les anciennes entrées
    const record = ipRequests.get(ip)

    if (record && record.resetAt < now) {
      ipRequests.delete(ip)
    }

    // Obtenir ou créer l'enregistrement
    const current = ipRequests.get(ip) || { count: 0, resetAt: now + windowMs }

    // Incrémenter le compteur
    current.count += 1
    ipRequests.set(ip, current)

    // Blocage après 100 requêtes
    if (current.count > 100) {
      return response.status(429).json({
        success: false,
        message: 'Trop de requêtes. IP temporairement bloquée.',
        error: 'IP_BLOCKED',
        retryAfter: Math.ceil((current.resetAt - now) / 1000)
      })
    }

    // Ralentir après 50 requêtes (ajouter 500ms de délai)
    if (current.count > 50) {
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    // Ajouter des headers de rate limit
    response.header('X-RateLimit-Limit', '100')
    response.header('X-RateLimit-Remaining', String(100 - current.count))
    response.header('X-RateLimit-Reset', String(Math.ceil(current.resetAt / 1000)))

    return next()
  }
}
