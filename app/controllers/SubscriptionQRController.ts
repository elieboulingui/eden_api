// app/controllers/SubscriptionQRController.ts
import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import Product from '#models/Product'
import Subscription, { SUBSCRIPTION_PLANS } from '#models/Subscription'
import MypvitSecretService from '../services/mypvit_secret_service.js'
import MypvitQRCodeService from '../services/mypvit_qrcode_service.js'

const SUBSCRIPTION_CALLBACK_URL_CODE = 'T2D7X'

export default class SubscriptionQRController {

  private detectOperatorGabon(phoneNumber?: string): { name: string; code: string; accountCode: string } {
    if (!phoneNumber) {
      return { name: 'MOOV_MONEY', code: 'MOOV_MONEY', accountCode: 'ACC_69EFB143D4F54' }
    }

    const clean = phoneNumber.replace(/[\s\+\.\-]/g, '')
    let local = clean
    if (clean.startsWith('241')) local = clean.substring(3)
    if (local.startsWith('0')) local = local.substring(1)

    if (local.startsWith('06') || local.startsWith('6')) {
      return { name: 'MOOV_MONEY', code: 'MOOV_MONEY', accountCode: 'ACC_69EFB143D4F54' }
    }
    if (local.startsWith('07') || local.startsWith('7')) {
      return { name: 'AIRTEL_MONEY', code: 'AIRTEL_MONEY', accountCode: 'ACC_69EFB0E02FCA3' }
    }
    return { name: 'MOOV_MONEY', code: 'MOOV_MONEY', accountCode: 'ACC_69EFB143D4F54' }
  }

  private async renewSecretIfNeeded(phoneNumber?: string): Promise<void> {
    try {
      console.log('🔄 Tentative de renouvellement du secret...')
      await MypvitSecretService.renewSecret(phoneNumber)
      console.log('✅ Clé renouvelée avec succès')
    } catch (error: any) {
      console.error('⚠️ Erreur renouvellement secret:', error.message)
    }
  }

  // ==================== PAIEMENT ABONNEMENT PAR QR CODE ====================
  async pay({ request, response }: HttpContext) {
    console.log('💎📱 ========== PAIEMENT ABONNEMENT PAR QR CODE ==========')

    try {
      const payload = request.only([
        'userId', 'plan', 'subscriptionType', 'productId',
        'customerAccountNumber', 'customerName', 'customerEmail',
        'customerPhone', 'autoRenew'
      ])

      console.log('📦 Données abonnement QR reçues:', payload)

      const userId = payload.userId
      const phoneNumber = payload.customerAccountNumber || payload.customerPhone
      const plan = payload.plan

      // Validations
      if (!userId) {
        return response.status(400).json({
          success: false,
          message: 'userId requis'
        })
      }

      if (!phoneNumber) {
        return response.status(400).json({
          success: false,
          message: 'Numéro de téléphone requis'
        })
      }

      if (!plan) {
        return response.status(400).json({
          success: false,
          message: 'Plan d\'abonnement requis'
        })
      }

      // Vérifier le plan
      const planConfig = SUBSCRIPTION_PLANS[plan as keyof typeof SUBSCRIPTION_PLANS]
      if (!planConfig) {
        return response.status(400).json({
          success: false,
          message: 'Plan invalide'
        })
      }

      // Vérifier l'utilisateur
      const user = await User.findBy('id', userId)
      if (!user) {
        return response.status(404).json({
          success: false,
          message: 'Utilisateur introuvable'
        })
      }

      // Vérifier si l'utilisateur est un marchand
      if (!user.isMerchant) {
        return response.status(403).json({
          success: false,
          message: 'Seuls les marchands peuvent souscrire à un abonnement'
        })
      }

      // Vérifier le produit si single_product
      if (payload.subscriptionType === 'single_product') {
        if (!payload.productId) {
          return response.status(400).json({
            success: false,
            message: 'Un produit est requis pour ce type d\'abonnement'
          })
        }
        const product = await Product.find(payload.productId)
        if (!product) {
          return response.status(404).json({
            success: false,
            message: 'Produit introuvable'
          })
        }
        if (product.user_id !== user.id) {
          return response.status(403).json({
            success: false,
            message: 'Ce produit ne vous appartient pas'
          })
        }
      }

      // Vérifier abonnement global existant
      const subscriptionType = payload.subscriptionType || 'all_products'
      if (subscriptionType === 'all_products') {
        const existingGlobal = await Subscription.query()
          .where('userId', user.id)
          .where('subscriptionType', 'all_products')
          .where('status', 'active')
          .where('endDate', '>', new Date().toISOString())
          .first()

        if (existingGlobal) {
          return response.status(400).json({
            success: false,
            message: 'Vous avez déjà un abonnement global actif',
            data: {
              remainingDays: existingGlobal.remainingDays
            }
          })
        }
      }

      // Détecter l'opérateur
      const operatorInfo = this.detectOperatorGabon(phoneNumber)

      console.log(`📱 Opérateur: ${operatorInfo.name} | Compte: ${operatorInfo.accountCode}`)
      console.log(`💎 Plan: ${planConfig.name} | Prix: ${planConfig.price} FCFA | Durée: ${planConfig.duration} jours`)

      // Renouveler le secret
      await this.renewSecretIfNeeded(phoneNumber)

      // Préparer le nom du produit pour les métadonnées
      let productName = 'Tous les produits'
      if (subscriptionType === 'single_product' && payload.productId) {
        const product = await Product.find(payload.productId)
        productName = product?.name || 'Produit'
      }

      // Créer l'abonnement en statut "pending"
      const subscription = await Subscription.create({
        userId: user.id,  // ✅ userId (pas user_id)
        plan,
        subscriptionType,
        productId: subscriptionType === 'single_product' ? payload.productId : null,
        status: 'pending',
        price: planConfig.price,
        boostMultiplier: planConfig.boostMultiplier,
        maxProducts: planConfig.maxProducts,
        paymentMethod: `qr_code_${operatorInfo.name.toLowerCase()}`,
        autoRenew: payload.autoRenew || false,
        metadata: {
          productName,
          operator: operatorInfo.name,
          operatorCode: operatorInfo.code,
          accountCode: operatorInfo.accountCode,
          phoneNumber: phoneNumber.replace(/\s/g, '')
        }
      })

      console.log('💎 Abonnement créé:', subscription.id)

      // Générer le QR Code
      const terminalId = `T${Date.now().toString(36).toUpperCase()}SUB`
      const reference = `SUB-${subscription.id.substring(0, 8)}`

      console.log('🔑 Génération QR Code abonnement...')
      console.log(`🏷️ Terminal ID: ${terminalId}`)
      console.log(`💰 Montant: ${planConfig.price}`)

      // ✅ Renouvellement forcé du secret avant QR Code
      try {
        await MypvitSecretService.forceRenewal(phoneNumber)
        console.log('✅ Secret frais obtenu pour QR Code')
        await new Promise(resolve => setTimeout(resolve, 1000))
      } catch (secretError: any) {
        console.error('⚠️ Erreur renouvellement secret QR:', secretError.message)
      }

      const qrResult = await MypvitQRCodeService.generateQRCode({
        accountOperationCode: operatorInfo.accountCode,
        terminalId: terminalId,
        callbackUrlCode: SUBSCRIPTION_CALLBACK_URL_CODE,  // ✅ T2D7X
        amount: planConfig.price,
        reference: reference,
        phoneNumber: phoneNumber
      })

      console.log('✅ QR Code généré avec succès')

      // Mettre à jour l'abonnement avec la référence de paiement
      if (qrResult.reference_id) {
        subscription.paymentReferenceId = qrResult.reference_id  // ✅ paymentReferenceId
        subscription.paymentStatus = 'PENDING'
        await subscription.save()
      }

      console.log('✅ QR Code abonnement généré avec succès:', {
        subscriptionId: subscription.id,
        plan: planConfig.name,
        amount: planConfig.price,
        reference_id: qrResult.reference_id
      })

      return response.status(201).json({
        success: true,
        message: `✅ QR Code généré pour l'abonnement ${planConfig.name} ! Scannez pour payer.`,
        data: {
          subscriptionId: subscription.id,
          type: subscriptionType,
          plan: planConfig.name,  // ✅ planName → planConfig.name
          price: planConfig.price,
          duration: planConfig.duration,
          status: 'pending_payment',
          customerName: user.full_name || payload.customerName || 'Client',
          paymentMethod: `qr_code_${operatorInfo.name.toLowerCase()}`,
          userId,
          operator: {
            name: operatorInfo.name,
            code: operatorInfo.code,
            accountCode: operatorInfo.accountCode
          },
          qr_code: {
            data: qrResult.data,
            reference_id: qrResult.reference_id || reference,
            amount: planConfig.price,
            expires_in: 600,
          },
        },
      })

    } catch (error: any) {
      console.error('🔴 Erreur QR Code Abonnement:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      })

      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la génération du QR Code pour l\'abonnement',
        error: error.response?.data?.message || error.message
      })
    }
  }
}
