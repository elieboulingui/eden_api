// app/services/ContractService.ts
import { DateTime } from 'luxon'
import User from '#models/user'
import mail from '@adonisjs/mail/services/main'
import env from '#start/env'

export default class ContractService {
  
  // Générer le template HTML du contrat
  static generateContractHTML(merchant: User): string {
    const date = new Date().toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })

    const APP_URL = env.get('APP_URL', 'http://localhost:3333')
    const FRONTEND_URL = env.get('FRONTEND_URL', 'https://eden-azure-one.vercel.app')

    return `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Contrat de Partenariat - EDEN</title>
    <style>
        body {
            font-family: 'Georgia', 'Times New Roman', Times, serif;
            line-height: 1.6;
            color: #1a1a2e;
            background-color: #f5f5f5;
            margin: 0;
            padding: 20px;
        }
        .contract-container {
            max-width: 900px;
            margin: 0 auto;
            background: white;
            box-shadow: 0 10px 40px rgba(0,0,0,0.1);
            border-radius: 8px;
            overflow: hidden;
        }
        .contract-header {
            background: linear-gradient(135deg, #1a472a 0%, #2d6a4f 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-bottom: 4px solid #ffd700;
        }
        .contract-header h1 {
            margin: 0;
            font-size: 28px;
            letter-spacing: 2px;
        }
        .contract-header .eden-logo {
            font-size: 48px;
            margin-bottom: 10px;
        }
        .contract-header .subtitle {
            font-size: 14px;
            opacity: 0.9;
            margin-top: 10px;
        }
        .contract-body {
            padding: 40px;
        }
        .contract-footer {
            background: #f9f9f9;
            padding: 30px;
            border-top: 1px solid #e0e0e0;
            text-align: center;
        }
        .signature-section {
            display: flex;
            justify-content: space-between;
            margin-top: 40px;
            flex-wrap: wrap;
            gap: 30px;
        }
        .signature-box {
            flex: 1;
            min-width: 250px;
            text-align: center;
            border-top: 2px dashed #2d6a4f;
            padding-top: 20px;
            margin-top: 20px;
        }
        .stamp {
            font-family: 'Courier New', monospace;
            font-size: 12px;
            color: #2d6a4f;
            border: 2px solid #2d6a4f;
            border-radius: 50px;
            padding: 8px 16px;
            display: inline-block;
            margin-top: 15px;
            background: rgba(45, 106, 79, 0.05);
        }
        .approval-badge {
            background: #10b981;
            color: white;
            padding: 8px 20px;
            border-radius: 30px;
            display: inline-block;
            font-weight: bold;
            margin: 20px 0;
        }
        .clause {
            margin: 25px 0;
            padding-left: 20px;
            border-left: 3px solid #2d6a4f;
        }
        .clause-title {
            font-weight: bold;
            color: #1a472a;
            margin-bottom: 10px;
        }
        .merchant-info {
            background: #f0fdf4;
            padding: 20px;
            border-radius: 12px;
            margin: 25px 0;
            border: 1px solid #bbf7d0;
        }
        @media (max-width: 600px) {
            .contract-body { padding: 20px; }
            .signature-section { flex-direction: column; }
        }
    </style>
</head>
<body>
    <div class="contract-container">
        <div class="contract-header">
            <div class="eden-logo">🌿</div>
            <h1>CONTRAT DE PARTENARIAT</h1>
            <h2>EDEN × ${merchant.full_name?.toUpperCase() || merchant.email?.toUpperCase()}</h2>
            <div class="subtitle">Entreprise de vente en ligne - Solutions digitales</div>
        </div>

        <div class="contract-body">
            <p style="text-align: center; font-size: 14px; color: #666;">Document valide à compter du ${date}</p>
            
            <div class="approval-badge">✓ LU - EXAMINÉ - APPROUVÉ ✓</div>

            <h3 style="color: #1a472a;">ENTRE LES SOUSSIGNÉS :</h3>

            <div class="merchant-info">
                <p><strong>🏢 PARTIE 1 : EDEN (Société)</strong></p>
                <p>Représentée par : <strong>BOULINGUI MOUNGUENGUI JOSUE</strong> et <strong>SANDUKU ELITE NATHALIE</strong><br>
                Qualité : Co-fondateurs / Directeurs Associés<br>
                Siège social : Libreville, Gabon</p>
                <p>Ci-après dénommée <strong>"EDEN"</strong></p>
            </div>

            <div class="merchant-info">
                <p><strong>🛍️ PARTIE 2 : MARCHAND</strong></p>
                <p><strong>Nom complet :</strong> ${merchant.full_name || 'Non renseigné'}<br>
                <strong>Email :</strong> ${merchant.email}<br>
                <strong>Téléphone :</strong> ${merchant.phone || 'Non renseigné'}<br>
                <strong>Rôle :</strong> Marchand partenaire<br>
                <strong>Boutique :</strong> ${merchant.shop_name || merchant.commercial_name || 'Boutique EDEN'}</p>
                <p>Ci-après dénommé <strong>"LE MARCHAND"</strong></p>
            </div>

            <h3 style="color: #1a472a; margin-top: 30px;">📜 OBJET DU CONTRAT</h3>
            <p>Le présent contrat a pour objet de définir les termes et conditions de la collaboration entre EDEN et LE MARCHAND pour la commercialisation des produits du Marchand sur la plateforme EDEN.</p>

            <div class="clause">
                <div class="clause-title">📌 Article 1 - Durée</div>
                <p>Le présent contrat est conclu pour une durée indéterminée à compter de la date de signature. Chaque partie peut y mettre fin moyennant un préavis de 30 jours.</p>
            </div>

            <div class="clause">
                <div class="clause-title">💰 Article 2 - Commission</div>
                <p>EDEN perçoit une commission de <strong>5%</strong> sur chaque vente réalisée via la plateforme. Cette commission est prélevée automatiquement sur les revenus du Marchand.</p>
            </div>

            <div class="clause">
                <div class="clause-title">📦 Article 3 - Obligations du Marchand</div>
                <p>Le Marchand s'engage à :<br>
                - Tenir ses stocks à jour<br>
                - Traiter les commandes dans un délai maximal de 48h<br>
                - Fournir des photos et descriptions précises des produits<br>
                - Respecter la charte qualité EDEN</p>
            </div>

            <div class="clause">
                <div class="clause-title">🎯 Article 4 - Obligations d'EDEN</div>
                <p>EDEN s'engage à :<br>
                - Mettre à disposition une vitrine en ligne pour les produits<br>
                - Gérer les paiements sécurisés<br>
                - Assurer le support client et les remboursements le cas échéant<br>
                - Promouvoir les produits via des campagnes marketing</p>
            </div>

            <div class="clause">
                <div class="clause-title">⚖️ Article 5 - Litiges</div>
                <p>En cas de litige, les parties s'engagent à rechercher une solution amiable avant toute procédure judiciaire. À défaut, le Tribunal de Libreville sera seul compétent.</p>
            </div>

            <div class="signature-section">
                <div class="signature-box">
                    <p><strong>POUR EDEN</strong></p>
                    <p>BOULINGUI MOUNGUENGUI JOSUE<br>Co-fondateur</p>
                    <div class="stamp">
                        ✍️ Signature & Cachet EDEN<br>
                        ____________________
                    </div>
                </div>

                <div class="signature-box">
                    <p><strong>POUR EDEN</strong></p>
                    <p>SANDUKU ELITE NATHALIE<br>Co-fondatrice</p>
                    <div class="stamp">
                        ✍️ Signature & Cachet EDEN<br>
                        ____________________
                    </div>
                </div>

                <div class="signature-box">
                    <p><strong>POUR LE MARCHAND</strong></p>
                    <p>${merchant.full_name || 'Merchant'}</p>
                    <div class="stamp">
                        ✍️ SIGNATURE DU MARCHAND<br>
                        <span style="font-size: 11px;">Je déclare avoir lu et accepté les conditions</span><br><br>
                        <a href="${APP_URL}/api/merchant/contract/${merchant.id}/sign" 
                           style="background: #2d6a4f; color: white; padding: 8px 20px; text-decoration: none; border-radius: 30px; display: inline-block; margin-top: 10px;">
                           📝 Signer le contrat
                        </a>
                    </div>
                </div>
            </div>

            <div style="text-align: center; margin-top: 30px; font-size: 12px; color: #888;">
                <p>Le présent contrat est régi par la loi applicable. Un exemplaire original signé sera conservé par chaque partie.</p>
                <p>Fait à Libreville, le ${date}</p>
            </div>
        </div>

        <div class="contract-footer">
            <p style="font-size: 12px; color: #888;">EDEN - Solutions Digitales - Libreville, Gabon<br>
            📧 contact@eden-gabon.com</p>
        </div>
    </div>
</body>
</html>
    `
  }

  // Envoyer le contrat par email
  static async sendContractEmail(merchant: User): Promise<{ success: boolean; message: string }> {
    try {
      if (!merchant.is_verified) {
        return {
          success: false,
          message: 'Le marchand n\'est pas encore vérifié'
        }
      }

      const contractHTML = this.generateContractHTML(merchant)

      await mail.send((message) => {
        message
          .from(env.get('SMTP_FROM', 'contrat@eden-gabon.com'))
          .to(merchant.email)
          .subject(`📄 Contrat de partenariat EDEN - ${merchant.full_name || 'Marchand'}`)
          .html(contractHTML)
      })

      merchant.contract_sent_at = DateTime.now()
      await merchant.save()

      return {
        success: true,
        message: `Contrat envoyé avec succès à ${merchant.email}`
      }
    } catch (error) {
      console.error('Erreur envoi contrat:', error)
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
      return {
        success: false,
        message: errorMessage
      }
    }
  }

  // Marquer le contrat comme signé
  static async signContract(merchantId: string, ipAddress?: string): Promise<{ success: boolean; message: string; merchant?: User }> {
    try {
      const merchant = await User.find(merchantId)

      if (!merchant) {
        return {
          success: false,
          message: 'Marchand non trouvé'
        }
      }

      if (merchant.contract_signed) {
        return {
          success: false,
          message: 'Contrat déjà signé'
        }
      }

      merchant.contract_signed_at = DateTime.now()
      merchant.contract_signed = true
      if (ipAddress) {
        // @ts-ignore - La propriété sera ajoutée par migration
        merchant.contract_signature_ip = ipAddress
      }
      await merchant.save()

      await this.sendConfirmationEmail(merchant)

      return {
        success: true,
        message: 'Contrat signé avec succès',
        merchant
      }
    } catch (error) {
      console.error('Erreur signature contrat:', error)
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
      return {
        success: false,
        message: errorMessage
      }
    }
  }

  // Envoyer un email de confirmation après signature
  static async sendConfirmationEmail(merchant: User): Promise<void> {
    const FRONTEND_URL = env.get('FRONTEND_URL', 'https://eden-azure-one.vercel.app')
    
    const confirmationHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Confirmation de signature - EDEN</title>
        <style>
          body { font-family: 'Georgia', serif; line-height: 1.6; color: #333; background-color: #f5f5f5; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 30px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); border: 1px solid #2d6a4f; }
          .logo { text-align: center; margin-bottom: 20px; font-size: 48px; }
          h1 { color: #1a472a; text-align: center; }
          .checkmark { font-size: 64px; text-align: center; margin: 20px 0; }
          .btn { background: #2d6a4f; color: white; padding: 12px 30px; border-radius: 40px; text-decoration: none; display: inline-block; margin-top: 20px; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #888; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">🌿</div>
          <div class="checkmark">✅</div>
          <h1>Contrat signé avec succès !</h1>
          <p>Bonjour ${merchant.full_name},</p>
          <p>Nous avons bien reçu votre signature électronique.<br>Votre contrat de partenariat avec <strong>EDEN</strong> est désormais actif.</p>
          <p style="background: #f0fdf4; padding: 15px; border-radius: 10px; margin: 20px 0;">
            <strong>📋 Récapitulatif :</strong><br>
            - Date de signature : ${DateTime.now().toFormat('dd/MM/yyyy HH:mm')}<br>
            - Contrat valide à compter de ce jour<br>
            - Commission : 5% sur chaque vente
          </p>
          <div style="text-align: center;">
            <a href="${FRONTEND_URL}/dashboard/merchant" class="btn">
              Accéder à mon espace marchand
            </a>
          </div>
          <div class="footer">
            <p>EDEN - Solutions Digitales - Libreville, Gabon</p>
          </div>
        </div>
      </body>
      </html>
    `

    await mail.send((message) => {
      message
        .from(env.get('SMTP_FROM', 'contrat@eden-gabon.com'))
        .to(merchant.email)
        .subject(`✅ Contrat signé - Bienvenue chez EDEN, ${merchant.full_name || 'Marchand'}!`)
        .html(confirmationHTML)
    })
  }

  // Vérifier le statut du contrat
  static async getContractStatus(merchantId: string): Promise<{
    sent: boolean
    sentAt: DateTime | null
    signed: boolean
    signedAt: DateTime | null
    needsSignature: boolean
  }> {
    const merchant = await User.find(merchantId)
    
    if (!merchant) {
      return {
        sent: false,
        sentAt: null,
        signed: false,
        signedAt: null,
        needsSignature: false
      }
    }

    return {
      sent: !!merchant.contract_sent_at,
      sentAt: merchant.contract_sent_at,
      signed: merchant.contract_signed || false,
      signedAt: merchant.contract_signed_at,
      needsSignature: merchant.is_verified && !merchant.contract_signed
    }
  }
}
