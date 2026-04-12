// app/middleware/otp_rate_limit_middleware.ts
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import Otp from '#models/Otp'
import { DateTime } from 'luxon'

export default class OtpRateLimitMiddleware {
  async handle({ request, response }: HttpContext, next: NextFn) {
    const email = request.input('email')

    // Si pas d'email, on passe au controller
    if (!email) {
      return next()
    }

    // Vérifier si l'email est bloqué pour 1 mois
    const oneMonthAgo = DateTime.now().minus({ months: 1 })

    const blockedCheck = await Otp.query()
      .where('email', email)
      .where('created_at', '>', oneMonthAgo.toSQL())
      .where('is_blocked', true)
      .first()

    if (blockedCheck) {
      const blockedAt = blockedCheck.blockedAt || blockedCheck.createdAt
      const unblockDate = DateTime.fromJSDate(blockedAt.toJSDate()).plus({ months: 1 })
      const daysRemaining = Math.ceil(unblockDate.diff(DateTime.now(), 'days').days)

      return response.status(429).json({
        success: false,
        message: `Email bloqué pour sécurité. Réessayez dans ${daysRemaining} jour(s).`,
        error: 'EMAIL_BLOCKED',
        unblockDate: unblockDate.toISO()
      })
    }

    // Compter les OTP envoyés à cet email dans les 15 dernières minutes
    const fifteenMinutesAgo = DateTime.now().minus({ minutes: 15 })

    const recentOtps = await Otp.query()
      .where('email', email)
      .where('created_at', '>', fifteenMinutesAgo.toSQL())
      .count('* as total')

    const total15Min = Number(recentOtps[0].$extras.total)

    // Limite : 5 OTPs par 15 minutes
    if (total15Min >= 5) {
      return response.status(429).json({
        success: false,
        message: 'Trop de demandes. Veuillez réessayer dans 15 minutes.',
        error: 'RATE_LIMIT_EXCEEDED',
        retryAfter: 900 // 15 minutes en secondes
      })
    }

    // Vérifier le nombre total d'OTP dans les dernières 24h
    const twentyFourHoursAgo = DateTime.now().minus({ hours: 24 })

    const totalOtps24h = await Otp.query()
      .where('email', email)
      .where('created_at', '>', twentyFourHoursAgo.toSQL())
      .count('* as total')

    const total24h = Number(totalOtps24h[0].$extras.total)

    // Si plus de 17 OTPs en 24h, bloquer l'email pour 1 mois
    if (total24h >= 17) {
      // Marquer tous les OTP récents comme bloqués
      await Otp.query()
        .where('email', email)
        .where('created_at', '>', twentyFourHoursAgo.toSQL())
        .update({
          is_blocked: true,
          blocked_at: DateTime.now().toSQL(),
          block_reason: 'Trop de tentatives (17+ en 24h)'
        })

      // Créer un OTP spécial pour enregistrer le blocage
      await Otp.create({
        email,
        otp: '000000',
        purpose: 'blocked',
        isUsed: true,
        attempts: 0,
        expiresAt: DateTime.now().plus({ months: 1 }),
        isBlocked: true,
        blockedAt: DateTime.now(),
        blockReason: 'Trop de tentatives (17+ en 24h)'
      })

      return response.status(429).json({
        success: false,
        message: 'Email bloqué pour 1 mois suite à de trop nombreuses tentatives.',
        error: 'EMAIL_BLOCKED_1_MONTH',
        unblockDate: DateTime.now().plus({ months: 1 }).toISO()
      })
    }

    // Avertissement si proche de la limite
    if (total24h >= 12) {
      const remaining = 17 - total24h
      response.header('X-RateLimit-Remaining', String(remaining))
      response.header('X-RateLimit-Limit', '17')
    }

    // Passer au controller
    return next()
  }
}
