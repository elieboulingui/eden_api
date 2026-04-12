// app/middleware/ip_rate_limit_middleware.ts
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

// Stockage en mémoire pour le rate limiting par IP
const ipRateLimit = new Map<string, { count: number; resetAt: number }>()

export default class IpRateLimitMiddleware {
  async handle({ request, response }: HttpContext, next: NextFn) {
    const ip = request.ip()
    const now = Date.now()
    const windowMs = 60 * 1000 // 1 minute
    const maxRequests = 60 // 60 requêtes par minute

    // Nettoyer les anciennes entrées
    const record = ipRateLimit.get(ip)
    if (record && record.resetAt < now) {
      ipRateLimit.delete(ip)
    }

    // Obtenir ou créer l'enregistrement
    const current = ipRateLimit.get(ip) || { count: 0, resetAt: now + windowMs }

    // Vérifier la limite
    if (current.count >= maxRequests) {
      const retryAfter = Math.ceil((current.resetAt - now) / 1000)

      return response.status(429).json({
        success: false,
        message: 'Trop de requêtes. Réessayez plus tard.',
        error: 'RATE_LIMIT_IP',
        retryAfter
      })
    }

    // Incrémenter le compteur
    current.count += 1
    ipRateLimit.set(ip, current)

    // Ajouter des headers de rate limit
    response.header('X-RateLimit-Limit', String(maxRequests))
    response.header('X-RateLimit-Remaining', String(maxRequests - current.count))
    response.header('X-RateLimit-Reset', String(Math.ceil(current.resetAt / 1000)))

    // Nettoyage périodique (1% des requêtes)
    if (Math.random() < 0.01) {
      const cleanup = Date.now() - 300000 // 5 minutes
      for (const [key, value] of ipRateLimit.entries()) {
        if (value.resetAt < cleanup) {
          ipRateLimit.delete(key)
        }
      }
    }

    return next()
  }
}
