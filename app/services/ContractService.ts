// app/services/ContractService.ts
import { DateTime } from 'luxon'
import User from '#models/user'
import mail from '@adonisjs/mail/services/main'
import env from '#start/env'

export default class ContractService {
  
  // Envoyer l'email de félicitations avec le lien vers le contrat
  static async sendContractEmail(merchant: User): Promise<{ success: boolean; message: string }> {
    try {
      if (!merchant.is_verified) {
        return {
          success: false,
          message: 'Le marchand n\'est pas encore vérifié'
        }
      }

      const FRONTEND_URL = env.get('FRONTEND_URL', 'https://eden-azure-one.vercel.app')
      const contractSlug = (merchant.full_name || merchant.email).toLowerCase().replace(/\s+/g, '-')
      const contractUrl = `${FRONTEND_URL}/contrat/${contractSlug}`

      const emailHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
            .container { max-width: 500px; margin: 0 auto; background: white; border-radius: 16px; padding: 40px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
            .emoji { font-size: 64px; }
            h1 { color: #166534; }
            p { color: #15803d; font-size: 16px; }
            .btn { display: inline-block; background: #1a472a; color: white; padding: 16px 40px; border-radius: 50px; text-decoration: none; font-size: 18px; font-weight: bold; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="emoji">🎉</div>
            <h1>Félicitations ${merchant.full_name} !</h1>
            <p>Votre compte marchand a été vérifié avec succès.<br>Vous faites maintenant partie de la famille EDEN.</p>
            <a href="${contractUrl}" class="btn">📝 Cliquez ici pour signer votre contrat</a>
          </div>
        </body>
        </html>
      `

      await mail.send((message) => {
        message
          .from(env.get('SMTP_FROM', 'contrat@eden-gabon.com'))
          .to(merchant.email)
          .subject(`🎉 Félicitations ${merchant.full_name} - Signez votre contrat EDEN`)
          .html(emailHTML)
      })

      merchant.contract_sent_at = DateTime.now()
      await merchant.save()

      return {
        success: true,
        message: `Email envoyé à ${merchant.email}`
      }
    } catch (error) {
      console.error('Erreur envoi email:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur inconnue'
      }
    }
  }

  // Signer le contrat
  static async signContract(merchantId: string): Promise<{ success: boolean; message: string; merchant?: User }> {
    try {
      const merchant = await User.find(merchantId)

      if (!merchant) {
        return { success: false, message: 'Marchand non trouvé' }
      }

      if (merchant.contract_signed) {
        return { success: false, message: 'Contrat déjà signé' }
      }

      merchant.contract_signed = true
      merchant.contract_signed_at = DateTime.now()
      await merchant.save()

      return {
        success: true,
        message: 'Contrat signé avec succès',
        merchant
      }
    } catch (error) {
      console.error('Erreur signature contrat:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur inconnue'
      }
    }
  }

  // Vérifier le statut du contrat
  static async getContractStatus(merchantId: string): Promise<{
    sent: boolean
    sentAt: DateTime | null
    signed: boolean
    signedAt: DateTime | null
    needsSignature: boolean
    contractUrl?: string
  }> {
    const merchant = await User.find(merchantId)
    const FRONTEND_URL = env.get('FRONTEND_URL', 'https://eden-azure-one.vercel.app')

    if (!merchant) {
      return {
        sent: false,
        sentAt: null,
        signed: false,
        signedAt: null,
        needsSignature: false
      }
    }

    const userName = (merchant.full_name || merchant.email).toLowerCase().replace(/\s+/g, '-')
    const contractUrl = `${FRONTEND_URL}/contrat/${userName}`

    return {
      sent: !!merchant.contract_sent_at,
      sentAt: merchant.contract_sent_at,
      signed: merchant.contract_signed || false,
      signedAt: merchant.contract_signed_at,
      needsSignature: merchant.is_verified && !merchant.contract_signed,
      contractUrl
    }
  }
}
