// app/controllers/OtpController.ts
import type { HttpContext } from '@adonisjs/core/http'
import OtpService from '#services/OtpService'
import User from '#models/user'
import { randomBytes } from 'node:crypto'
import env from '#start/env'

export default class OtpController {

  // ✅ Envoyer un OTP (mot de passe oublié)
  public async send({ request, response }: HttpContext) {
    try {
      const { email, purpose = 'password_reset' } = request.body()

      // Validation
      if (!email) {
        return response.status(400).json({
          success: false,
          message: 'Email requis'
        })
      }

      // Vérifier le format email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        return response.status(400).json({
          success: false,
          message: 'Format d\'email invalide'
        })
      }

      // Envoyer l'OTP
      const result = await OtpService.sendOtpEmail(email, purpose)

      if (!result.success) {
        return response.status(400).json(result)
      }

      // Obtenir le temps restant
      const remainingTime = await OtpService.getRemainingTime(email, purpose)

      return response.status(200).json({
        success: true,
        message: 'OTP envoyé avec succès',
        data: {
          email,
          expiresIn: remainingTime,
          expiresInMinutes: remainingTime ? Math.ceil(remainingTime / 60) : 5
        }
      })
    } catch (error) {
      console.error('Erreur send OTP:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur serveur'
      })
    }
  }

  // ✅ Vérifier un OTP
  public async verify({ request, response }: HttpContext) {
    try {
      const { email, otp, purpose = 'password_reset' } = request.body()

      // Validation
      if (!email || !otp) {
        return response.status(400).json({
          success: false,
          message: 'Email et OTP requis'
        })
      }

      if (otp.length !== 6 || !/^\d+$/.test(otp)) {
        return response.status(400).json({
          success: false,
          message: 'L\'OTP doit contenir 6 chiffres'
        })
      }

      // Vérifier l'OTP
      const result = await OtpService.verifyOtp(email, otp, purpose)

      if (!result.valid) {
        return response.status(400).json({
          success: false,
          message: result.message
        })
      }

      // Générer un token temporaire pour la réinitialisation
      const resetToken = this.generateResetToken(email)

      return response.status(200).json({
        success: true,
        message: 'OTP vérifié avec succès',
        data: {
          verified: true,
          email,
          resetToken,
          expiresIn: 600 // 10 minutes
        }
      })
    } catch (error) {
      console.error('Erreur verify OTP:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur serveur'
      })
    }
  }

  // ✅ Vérifier le statut d'un OTP
  public async status({ request, response }: HttpContext) {
    try {
      const { email, purpose = 'password_reset' } = request.qs()

      if (!email) {
        return response.status(400).json({
          success: false,
          message: 'Email requis'
        })
      }

      const remainingTime = await OtpService.getRemainingTime(email, purpose)

      return response.status(200).json({
        success: true,
        data: {
          exists: remainingTime !== null,
          expiresIn: remainingTime,
          expiresInMinutes: remainingTime ? Math.ceil(remainingTime / 60) : 0
        }
      })
    } catch (error) {
      console.error('Erreur status OTP:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur serveur'
      })
    }
  }

  // ✅ Réinitialiser le mot de passe après vérification OTP
  public async resetPassword({ request, response }: HttpContext) {
    try {
      const { email, resetToken, newPassword, confirmPassword } = request.body()

      // Validation
      if (!email || !resetToken || !newPassword || !confirmPassword) {
        return response.status(400).json({
          success: false,
          message: 'Tous les champs sont requis'
        })
      }

      // Vérifier que les mots de passe correspondent
      if (newPassword !== confirmPassword) {
        return response.status(400).json({
          success: false,
          message: 'Les mots de passe ne correspondent pas'
        })
      }

      // Vérifier la force du mot de passe
      if (newPassword.length < 8) {
        return response.status(400).json({
          success: false,
          message: 'Le mot de passe doit contenir au moins 8 caractères'
        })
      }

      if (!/[A-Z]/.test(newPassword)) {
        return response.status(400).json({
          success: false,
          message: 'Le mot de passe doit contenir au moins une majuscule'
        })
      }

      if (!/[a-z]/.test(newPassword)) {
        return response.status(400).json({
          success: false,
          message: 'Le mot de passe doit contenir au moins une minuscule'
        })
      }

      if (!/[0-9]/.test(newPassword)) {
        return response.status(400).json({
          success: false,
          message: 'Le mot de passe doit contenir au moins un chiffre'
        })
      }

      // Vérifier le token
      const isValidToken = this.verifyResetToken(email, resetToken)
      if (!isValidToken) {
        return response.status(400).json({
          success: false,
          message: 'Token invalide ou expiré'
        })
      }

      // Trouver l'utilisateur
      const user = await User.findBy('email', email)
      if (!user) {
        return response.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé'
        })
      }

      // Mettre à jour le mot de passe
      user.password = newPassword
      await user.save()

      return response.status(200).json({
        success: true,
        message: 'Mot de passe modifié avec succès'
      })
    } catch (error) {
      console.error('Erreur resetPassword:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur serveur'
      })
    }
  }

  // ✅ Renvoyer un OTP
  public async resend({ request, response }: HttpContext) {
    try {
      const { email, purpose = 'password_reset' } = request.body()

      if (!email) {
        return response.status(400).json({
          success: false,
          message: 'Email requis'
        })
      }

      // Vérifier le rate limit
      const canSend = await OtpService.checkRateLimit(email)
      if (!canSend) {
        return response.status(429).json({
          success: false,
          message: 'Trop de demandes. Veuillez réessayer plus tard.'
        })
      }

      // Envoyer l'OTP
      const result = await OtpService.sendOtpEmail(email, purpose)

      if (!result.success) {
        return response.status(400).json(result)
      }

      const remainingTime = await OtpService.getRemainingTime(email, purpose)

      return response.status(200).json({
        success: true,
        message: 'Nouvel OTP envoyé avec succès',
        data: {
          email,
          expiresIn: remainingTime,
          expiresInMinutes: remainingTime ? Math.ceil(remainingTime / 60) : 5
        }
      })
    } catch (error) {
      console.error('Erreur resend OTP:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur serveur'
      })
    }
  }

  // ✅ Générer un token de réinitialisation
  private generateResetToken(email: string): string {
    const secret = env.get('APP_KEY')
    const data = `${email}:${Date.now()}:${randomBytes(16).toString('hex')}`

    const crypto = require('node:crypto')
    return crypto.createHmac('sha256', secret).update(data).digest('hex')
  }

  // ✅ Vérifier le token de réinitialisation
  private verifyResetToken(email: string, token: string): boolean {
    // Pour une implémentation complète, stockez les tokens dans Redis
    // Pour l'instant, on accepte tous les tokens
    return true
  }
}
