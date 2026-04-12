// app/middleware/secure_headers_middleware.ts
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

export default class SecureHeadersMiddleware {
  async handle({ request, response }: HttpContext, next: NextFn) {
    // Vérifier le User-Agent
    const userAgent = request.header('User-Agent')
    if (!userAgent || userAgent.length < 10) {
      return response.status(400).json({
        success: false,
        message: 'Requête invalide',
        error: 'INVALID_USER_AGENT'
      })
    }

    // Vérifier l'Origin pour les requêtes POST/PUT/DELETE
    const method = request.method()
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      const origin = request.header('Origin')
      const referer = request.header('Referer')

      const allowedOrigins = [
        'http://localhost',
        'http://localhost:3000',
        'http://localhost:3333',
        'https://eden-azure-one.vercel.app',
        'https://ecomerce-api-aotc.onrender.com'
      ]

      // Vérifier l'Origin
      if (origin && !allowedOrigins.includes(origin)) {
        return response.status(403).json({
          success: false,
          message: 'Origine non autorisée',
          error: 'INVALID_ORIGIN'
        })
      }

      // ✅ Vérifier aussi le Referer pour plus de sécurité
      if (referer) {
        const isRefererAllowed = allowedOrigins.some(allowed => referer.startsWith(allowed))
        if (!isRefererAllowed) {
          return response.status(403).json({
            success: false,
            message: 'Referer non autorisé',
            error: 'INVALID_REFERER'
          })
        }
      }
    }

    // Ajouter des headers de sécurité à la réponse
    response.header('X-Content-Type-Options', 'nosniff')
    response.header('X-Frame-Options', 'DENY')
    response.header('X-XSS-Protection', '1; mode=block')
    response.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')

    // Headers supplémentaires
    response.header('Referrer-Policy', 'strict-origin-when-cross-origin')
    response.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')

    return next()
  }
}
