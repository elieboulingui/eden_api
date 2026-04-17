// app/controllers/OtpController.ts
import type { HttpContext } from '@adonisjs/core/http'
import OtpService from '#services/OtpService'
import User from '#models/user'
import env from '#start/env'
import jwt from 'jsonwebtoken'

export default class OtpController {

  // ✅ Envoyer un OTP
  public async send({ request, response }: HttpContext) {
    console.log("➡️ [SEND OTP] Requête reçue")

    try {
      const { email, purpose = 'password_reset' } = request.body()
      console.log("📩 Email:", email)
      console.log("🎯 Purpose:", purpose)

      if (!email) {
        console.log("❌ Email manquant")
        return response.status(400).json({
          success: false,
          message: 'Email requis'
        })
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        console.log("❌ Email invalide")
        return response.status(400).json({
          success: false,
          message: 'Format d\'email invalide'
        })
      }

      console.log("📨 Envoi OTP en cours...")
      const result = await OtpService.sendOtpEmail(email, purpose)
      console.log("📬 Résultat OTP:", result)

      if (!result.success) {
        console.log("❌ Échec envoi OTP")
        return response.status(400).json(result)
      }

      const remainingTime = await OtpService.getRemainingTime(email, purpose)
      console.log("⏳ Temps restant:", remainingTime)

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
      console.error("🔥 ERREUR SEND OTP:", error)
      return response.status(500).json({
        success: false,
        message: 'Erreur serveur'
      })
    }
  }

  // ✅ Vérifier un OTP
  public async verify({ request, response }: HttpContext) {
    console.log("➡️ [VERIFY OTP] Requête reçue")

    try {
      const { email, otp, purpose = 'password_reset' } = request.body()
      console.log("📩 Email:", email)
      console.log("🔢 OTP:", otp)

      if (!email || !otp) {
        console.log("❌ Données manquantes")
        return response.status(400).json({
          success: false,
          message: 'Email et OTP requis'
        })
      }

      if (otp.length !== 6 || !/^\d+$/.test(otp)) {
        console.log("❌ OTP invalide format")
        return response.status(400).json({
          success: false,
          message: 'L\'OTP doit contenir 6 chiffres'
        })
      }

      console.log("🔍 Vérification OTP...")
      const result = await OtpService.verifyOtp(email, otp, purpose)
      console.log("📊 Résultat vérification:", result)

      if (!result.valid) {
        console.log("❌ OTP incorrect")
        return response.status(400).json({
          success: false,
          message: result.message
        })
      }

      const resetToken = this.generateResetJWT(email)
      console.log("🔑 Token généré:", resetToken)

      return response.status(200).json({
        success: true,
        message: 'OTP vérifié avec succès',
        data: {
          verified: true,
          email,
          resetToken,
          expiresIn: 600
        }
      })
    } catch (error) {
      console.error("🔥 ERREUR VERIFY OTP:", error)
      return response.status(500).json({
        success: false,
        message: 'Erreur serveur'
      })
    }
  }

  // ✅ Status OTP
  public async status({ request, response }: HttpContext) {
    console.log("➡️ [STATUS OTP] Requête reçue")

    try {
      const { email, purpose = 'password_reset' } = request.qs()
      console.log("📩 Email:", email)

      if (!email || typeof email !== 'string') {
        console.log("❌ Email manquant")
        return response.status(400).json({
          success: false,
          message: 'Email requis'
        })
      }

      const remainingTime = await OtpService.getRemainingTime(email, purpose)
      console.log("⏳ Temps restant:", remainingTime)

      return response.status(200).json({
        success: true,
        data: {
          exists: remainingTime !== null,
          expiresIn: remainingTime,
          expiresInMinutes: remainingTime ? Math.ceil(remainingTime / 60) : 0
        }
      })
    } catch (error) {
      console.error("🔥 ERREUR STATUS OTP:", error)
      return response.status(500).json({
        success: false,
        message: 'Erreur serveur'
      })
    }
  }

  // ✅ Reset password
  public async resetPassword({ request, response }: HttpContext) {
    console.log("➡️ [RESET PASSWORD] Requête reçue")

    try {
      const { email, resetToken, newPassword, confirmPassword } = request.body()
      console.log("📩 Email:", email)

      if (!email || !resetToken || !newPassword || !confirmPassword) {
        console.log("❌ Champs manquants")
        return response.status(400).json({
          success: false,
          message: 'Tous les champs sont requis'
        })
      }

      const isValidToken = this.verifyResetJWT(email, resetToken)
      console.log("🔐 Token valide ?", isValidToken)

      if (!isValidToken) {
        console.log("❌ Token invalide")
        return response.status(400).json({
          success: false,
          message: 'Token invalide ou expiré'
        })
      }

      if (newPassword !== confirmPassword) {
        console.log("❌ Mots de passe différents")
        return response.status(400).json({
          success: false,
          message: 'Les mots de passe ne correspondent pas'
        })
      }

      console.log("🔎 Recherche utilisateur...")
      const user = await User.findBy('email', email)

      if (!user) {
        console.log("❌ Utilisateur non trouvé")
        return response.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé'
        })
      }

      console.log("🔄 Mise à jour du mot de passe...")
      user.password = newPassword
      await user.save()

      console.log("✅ Mot de passe modifié")

      return response.status(200).json({
        success: true,
        message: 'Mot de passe modifié avec succès'
      })
    } catch (error) {
      console.error("🔥 ERREUR RESET PASSWORD:", error)
      return response.status(500).json({
        success: false,
        message: 'Erreur serveur'
      })
    }
  }

  // ✅ Resend OTP
  public async resend({ request, response }: HttpContext) {
    console.log("➡️ [RESEND OTP] Requête reçue")

    try {
      const { email, purpose = 'password_reset' } = request.body()
      console.log("📩 Email:", email)

      if (!email) {
        console.log("❌ Email manquant")
        return response.status(400).json({
          success: false,
          message: 'Email requis'
        })
      }

      console.log("📨 Renvoi OTP...")
      const result = await OtpService.sendOtpEmail(email, purpose)
      console.log("📬 Résultat:", result)

      if (!result.success) {
        console.log("❌ Échec renvoi OTP")
        return response.status(400).json(result)
      }

      const remainingTime = await OtpService.getRemainingTime(email, purpose)
      console.log("⏳ Temps restant:", remainingTime)

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
      console.error("🔥 ERREUR RESEND OTP:", error)
      return response.status(500).json({
        success: false,
        message: 'Erreur serveur'
      })
    }
  }

  private generateResetJWT(email: string): string {
    console.log("🔐 Génération JWT pour:", email)

    const secret = env.get('APP_KEY')

    const payload = {
      email,
      purpose: 'password_reset',
      iat: Math.floor(Date.now() / 1000),
    }

    const token = jwt.sign(payload, Buffer.from(secret), { expiresIn: '10m' })

    console.log("🔑 JWT généré:", token)

    return token
  }

  private verifyResetJWT(email: string, token: string): boolean {
    console.log("🔍 Vérification JWT pour:", email)

    try {
      const secret = env.get('APP_KEY')
      const decoded = jwt.verify(token, Buffer.from(secret)) as { email: string; purpose: string }

      console.log("📦 Décodé:", decoded)

      return decoded.email === email && decoded.purpose === 'password_reset'
    } catch (error) {
      console.error("❌ JWT invalide:", error)
      return false
    }
  }
}
