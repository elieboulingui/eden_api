// app/middleware/bot_detector_middleware.ts
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import cache from '@adonisjs/cache/services/main'

export default class BotDetectorMiddleware {
  async handle({ request, response }: HttpContext, next: NextFn) {
    const ip = request.ip()
    const userAgent = request.header('User-Agent') || ''

    // Liste des User-Agents de bots connus
    const botPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /curl/i,
      /wget/i,
      /python-requests/i,
      /go-http-client/i,
      /node-fetch/i,
      /axios/i,
      /headless/i,
      /phantom/i,
      /selenium/i,
    ]

    const isBot = botPatterns.some(pattern => pattern.test(userAgent))

    if (isBot) {
      // Bloquer les bots sauf Google/Bing
      const allowedBots = [/googlebot/i, /bingbot/i, /duckduckbot/i]
      const isAllowed = allowedBots.some(pattern => pattern.test(userAgent))

      if (!isAllowed) {
        return response.status(403).json({
          success: false,
          message: 'Accès non autorisé',
          error: 'BOT_DETECTED'
        })
      }
    }

    // Détection de comportement suspect
    const key = `requests:${ip}`
    const count = await cache.increment(key, 1)

    if (count === 1) {
      await cache.expire(key, 10) // 10 secondes
    }

    // Plus de 20 requêtes en 10 secondes = probablement un bot
    if (count > 20) {
      console.warn(`⚠️ Bot détecté - IP: ${ip}, UA: ${userAgent}`)

      // Bloquer l'IP pendant 1 heure
      await cache.set(`blocked:${ip}`, '1', 3600)

      return response.status(403).json({
        success: false,
        message: 'Accès temporairement bloqué',
        error: 'SUSPICIOUS_ACTIVITY'
      })
    }

    return next()
  }
}
