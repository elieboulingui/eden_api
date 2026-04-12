// app/services/OtpService.ts
import { DateTime } from 'luxon'
import Otp from '#models/Otp'
import User from '#models/user'
import mail from '@adonisjs/mail/services/main'

export default class OtpService {

  // ✅ Générer un OTP à 6 chiffres
  public static generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString()
  }

  // ✅ Créer un nouvel OTP
  public static async createOtp(
    email: string,
    purpose: string = 'password_reset',
    userId?: string
  ): Promise<Otp> {
    // Désactiver les anciens OTP non utilisés pour cet email et ce purpose
    await Otp.query()
      .where('email', email)
      .where('purpose', purpose)
      .where('is_used', false)
      .update({ is_used: true })

    // Créer le nouvel OTP
    const otp = await Otp.create({
      userId: userId || null,
      email,
      otp: this.generateOtp(),
      purpose,
      expiresAt: DateTime.now().plus({ minutes: 5 }),
      isUsed: false,
      attempts: 0
    })

    return otp
  }

  // ✅ Envoyer l'OTP par email
  public static async sendOtpEmail(
    email: string,
    purpose: string = 'password_reset'
  ): Promise<{ success: boolean; message: string; otp?: Otp }> {
    try {
      // Vérifier si l'utilisateur existe
      const user = await User.findBy('email', email)

      if (purpose === 'password_reset' && !user) {
        return {
          success: false,
          message: 'Aucun compte associé à cet email'
        }
      }

      // Créer l'OTP
      const otp = await this.createOtp(email, purpose, user?.id)

      // Envoyer l'email
      await mail.send((message) => {
        message
          .from('noreply@eden-marketplace.com')
          .to(email)
          .subject(this.getEmailSubject(purpose))
          .html(this.getEmailTemplate(otp.otp, purpose))
      })

      return {
        success: true,
        message: 'OTP envoyé avec succès',
        otp
      }
    } catch (error) {
      console.error('Erreur sendOtpEmail:', error)
      return {
        success: false,
        message: 'Erreur lors de l\'envoi de l\'email'
      }
    }
  }

  // ✅ Vérifier un OTP
  public static async verifyOtp(
    email: string,
    otpCode: string,
    purpose: string = 'password_reset'
  ): Promise<{ valid: boolean; message: string; otp?: Otp }> {
    // Trouver l'OTP le plus récent
    const otp = await Otp.query()
      .where('email', email)
      .where('purpose', purpose)
      .where('is_used', false)
      .orderBy('created_at', 'desc')
      .first()

    if (!otp) {
      return {
        valid: false,
        message: 'Aucun OTP trouvé. Veuillez en demander un nouveau.'
      }
    }

    // Vérifier expiration
    if (otp.isExpired()) {
      await otp.markAsUsed()
      return {
        valid: false,
        message: 'OTP expiré. Veuillez en demander un nouveau.'
      }
    }

    // Vérifier tentatives
    if (otp.attempts >= 5) {
      await otp.markAsUsed()
      return {
        valid: false,
        message: 'Trop de tentatives. Veuillez demander un nouvel OTP.'
      }
    }

    // Vérifier le code
    if (otp.otp !== otpCode) {
      await otp.incrementAttempts()
      const remainingAttempts = 5 - otp.attempts
      return {
        valid: false,
        message: `Code incorrect. Il vous reste ${remainingAttempts} tentative(s).`,
        otp
      }
    }

    // OTP valide - marquer comme utilisé
    await otp.markAsUsed()

    return {
      valid: true,
      message: 'OTP vérifié avec succès',
      otp
    }
  }

  // ✅ Vérifier le rate limit par email
  public static async checkRateLimit(email: string): Promise<boolean> {
    const recentOtps = await Otp.query()
      .where('email', email)
      .where('created_at', '>', DateTime.now().minus({ minutes: 15 }).toSQL())
      .count('* as total')

    return Number(recentOtps[0].$extras.total) < 5
  }

  // ✅ Obtenir le temps restant avant expiration
  public static async getRemainingTime(email: string, purpose: string): Promise<number | null> {
    const otp = await Otp.query()
      .where('email', email)
      .where('purpose', purpose)
      .where('is_used', false)
      .orderBy('created_at', 'desc')
      .first()

    if (!otp) return null

    const now = DateTime.now()
    const diff = otp.expiresAt.diff(now, 'seconds').seconds

    return Math.max(0, Math.floor(diff))
  }

  // ✅ Obtenir le sujet de l'email selon le purpose
  private static getEmailSubject(purpose: string): string {
    const subjects: Record<string, string> = {
      password_reset: '🔐 Code de réinitialisation de votre mot de passe - Eden',
      email_verification: '✅ Vérification de votre adresse email - Eden',
      login: '🔑 Code de connexion sécurisé - Eden',
      transaction: '💳 Code de validation de transaction - Eden'
    }
    return subjects[purpose] || 'Code de vérification - Eden'
  }

  // ✅ Template HTML pour l'email
  private static getEmailTemplate(otp: string, purpose: string): string {
    const purposeText: Record<string, string> = {
      password_reset: 'réinitialiser votre mot de passe',
      email_verification: 'vérifier votre adresse email',
      login: 'vous connecter à votre compte',
      transaction: 'valider votre transaction'
    }

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: 'Segoe UI', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f5f5f5;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 30px 20px;
          }
          .card {
            background: white;
            border-radius: 12px;
            padding: 30px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          }
          .logo {
            text-align: center;
            margin-bottom: 30px;
          }
          .logo h1 {
            color: #0b6f5b;
            margin: 0;
            font-size: 28px;
          }
          .otp-code {
            background: linear-gradient(135deg, #0b6f5b 0%, #0d9488 100%);
            color: white;
            font-size: 42px;
            font-weight: bold;
            text-align: center;
            padding: 25px;
            border-radius: 12px;
            letter-spacing: 12px;
            margin: 30px 0;
            box-shadow: 0 4px 10px rgba(11, 111, 91, 0.3);
          }
          .warning {
            background-color: #fffbeb;
            border-left: 4px solid #f59e0b;
            color: #92400e;
            padding: 15px 20px;
            border-radius: 8px;
            margin: 25px 0;
          }
          .warning strong {
            display: block;
            margin-bottom: 10px;
          }
          .warning ul {
            margin: 10px 0 0;
            padding-left: 20px;
          }
          .warning li {
            margin-bottom: 5px;
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            font-size: 13px;
            color: #6b7280;
            text-align: center;
          }
          .footer a {
            color: #0b6f5b;
            text-decoration: none;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            <div class="logo">
              <h1>🌿 Eden Marketplace</h1>
            </div>

            <p style="font-size: 16px;">Bonjour,</p>

            <p style="font-size: 16px;">
              Vous avez demandé un code de vérification pour
              <strong>${purposeText[purpose]}</strong>.
            </p>

            <div class="otp-code">
              ${otp}
            </div>

            <div class="warning">
              <strong>⚠️ Important :</strong>
              <ul>
                <li>Ce code est valable pendant <strong>5 minutes</strong></li>
                <li>Ne partagez jamais ce code avec qui que ce soit</li>
                <li>Nos équipes ne vous demanderont jamais ce code</li>
                <li>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email</li>
              </ul>
            </div>

            <p style="font-size: 14px; color: #6b7280;">
              Ou copiez ce code manuellement :
              <code style="background: #f3f4f6; padding: 4px 8px; border-radius: 6px; font-size: 16px; margin-left: 5px;">
                ${otp}
              </code>
            </p>

            <div class="footer">
              <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
              <p>
                © ${new Date().getFullYear()} Eden Marketplace. Tous droits réservés.<br>
                <a href="#">Politique de confidentialité</a> ·
                <a href="#">Conditions d'utilisation</a>
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `
  }
}
