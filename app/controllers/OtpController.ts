// app/controllers/OtpController.ts
import type { HttpContext } from '@adonisjs/core/http'
import OtpService from '#services/OtpService'
import User from '#models/User'
import env from '#start/env'
import jwt from 'jsonwebtoken'

export default class OtpController {

  // ✅ Envoyer un OTP
  public async send({ request, response }: HttpContext) {
    try {
      const { email, purpose = 'password_reset' } = request.body()

      if (!email) {
        return response.status(400).json({
          success: false,
          message: 'Email requis'
        })
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        return response.status(400).json({
          success: false,
          message: 'Format d\'email invalide'
        })
      }

      const result = await OtpService.sendOtpEmail(email, purpose)

      if (!result.success) {
        return response.status(400).json(result)
      }

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

      const result = await OtpService.verifyOtp(email, otp, purpose)

      if (!result.valid) {
        return response.status(400).json({
          success: false,
          message: result.message
        })
      }

      // ✅ Générer un JWT pour la réinitialisation (valide 10 minutes)
      const resetToken = this.generateResetJWT(email)

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

  // ✅ Réinitialiser le mot de passe avec vérification JWT
  public async resetPassword({ request, response }: HttpContext) {
    try {
      const { email, resetToken, newPassword, confirmPassword } = request.body()

      if (!email || !resetToken || !newPassword || !confirmPassword) {
        return response.status(400).json({
          success: false,
          message: 'Tous les champs sont requis'
        })
      }

      // ✅ Vérifier le JWT
      const isValidToken = this.verifyResetJWT(email, resetToken)
      if (!isValidToken) {
        return response.status(400).json({
          success: false,
          message: 'Token invalide ou expiré'
        })
      }

      if (newPassword !== confirmPassword) {
        return response.status(400).json({
          success: false,
          message: 'Les mots de passe ne correspondent pas'
        })
      }

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

      const user = await User.findBy('email', email)
      if (!user) {
        return response.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé'
        })
      }

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

  // ✅ Générer un JWT pour la réinitialisation (valide 10 minutes)
  private generateResetJWT(email: string): string {
    const secret = env.get('APP_KEY')
    const payload = {
      email,
      purpose: 'password_reset',
      iat: Math.floor(Date.now() / 1000),
    }

    return jwt.sign(payload, secret, { expiresIn: '10m' })
  }

  // ✅ Vérifier le JWT de réinitialisation
  private verifyResetJWT(email: string, token: string): boolean {
    try {
      const secret = env.get('APP_KEY')
      const decoded = jwt.verify(token, secret) as { email: string; purpose: string }

      // Vérifier que l'email correspond
      return decoded.email === email && decoded.purpose === 'password_reset'
    } catch (error) {
      console.error('Erreur vérification JWT:', error)
      return false
    }
  }
}
