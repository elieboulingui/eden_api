// app/middleware/security_logger_middleware.ts
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'

export default class SecurityLoggerMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const { request, response } = ctx
    const start = Date.now()

    // Continuer la requête
    await next()

    const duration = Date.now() - start
    const status = response.getStatus()

    // Logger les erreurs 4xx et 5xx
    if (status >= 400) {
      try {
        await db.table('security_logs').insert({
          id: crypto.randomUUID(),
          ip: request.ip(),
          method: request.method(),
          url: request.url(),
          status_code: status,
          user_agent: request.header('User-Agent') || null,
          referer: request.header('Referer') || null,
          duration: duration,
          created_at: new Date()
        })
      } catch (dbError) {
        console.error('Erreur insertion security_logs:', dbError)
      }

      // Alerte pour les erreurs 5xx
      if (status >= 500) {
        logger.error(`⚠️ Erreur serveur - ${request.method()} ${request.url()} - Status: ${status}`)
      }

      // Alerte pour les 403/429 répétés
      if (status === 403 || status === 429) {
        try {
          const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)

          const recentBlocks = await db
            .from('security_logs')
            .where('ip', request.ip())
            .where('status_code', status)
            .where('created_at', '>', tenMinutesAgo)
            .count('* as total')

          const total = Number(recentBlocks[0]?.total || 0)

          if (total >= 5) {
            logger.warn(`🚨 IP suspecte: ${request.ip()} - ${total} blocages en 10 minutes`)
          }
        } catch (queryError) {
          console.error('Erreur requête security_logs:', queryError)
        }
      }
    }
  }
}
