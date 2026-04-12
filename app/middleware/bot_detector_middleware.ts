// app/middleware/bot_detector_middleware.ts
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

// Stockage en mémoire pour la détection de comportement suspect
const ipRequests = new Map<string, { count: number; firstRequest: number; blockedUntil: number | null }>()

export default class BotDetectorMiddleware {
  async handle({ request, response }: HttpContext, next: NextFn) {
    const ip = request.ip()
    const userAgent = request.header('User-Agent') || ''
    const now = Date.now()

    // Vérifier si l'IP est bloquée
    const ipData = ipRequests.get(ip)
    if (ipData?.blockedUntil && ipData.blockedUntil > now) {
      const remainingMinutes = Math.ceil((ipData.blockedUntil - now) / 60000)
      return response.status(403).json({
        success: false,
        message: `IP bloquée. Réessayez dans ${remainingMinutes} minute(s).`,
        error: 'IP_BLOCKED'
      })
    }

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
      // Autoriser uniquement les bons bots (Google, Bing, DuckDuckGo)
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

    // Détection de comportement suspect (rate limiting sur 10 secondes)
    if (!ipData || ipData.firstRequest < now - 10000) {
      // Nouvelle fenêtre de 10 secondes
      ipRequests.set(ip, { count: 1, firstRequest: now, blockedUntil: null })
    } else {
      // Incrémenter dans la fenêtre existante
      ipData.count += 1

      // Plus de 20 requêtes en 10 secondes = probablement un bot
      if (ipData.count > 20) {
        // Bloquer l'IP pendant 1 heure
        ipData.blockedUntil = now + 3600000
        ipRequests.set(ip, ipData)

        console.warn(`⚠️ Bot détecté et bloqué - IP: ${ip}, UA: ${userAgent}`)

        return response.status(403).json({
          success: false,
          message: 'Accès bloqué pour activité suspecte (1 heure)',
          error: 'SUSPICIOUS_ACTIVITY'
        })
      }

      ipRequests.set(ip, ipData)
    }

    // Nettoyer périodiquement les anciennes entrées (toutes les 100 requêtes)
    if (Math.random() < 0.01) {
      const oneHourAgo = now - 3600000
      for (const [key, value] of ipRequests.entries()) {
        if (value.firstRequest < oneHourAgo && !value.blockedUntil) {
          ipRequests.delete(key)
        }
      }
    }

    return next()
  }
}
