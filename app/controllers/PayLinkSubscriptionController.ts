// app/controllers/PayLinkSubscriptionController.ts
import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import Product from '#models/Product'
import Subscription, { SUBSCRIPTION_PLANS } from '#models/Subscription'
import MypvitSecretService from '../services/mypvit_secret_service.js'
import axios from 'axios'

const SUBSCRIPTION_CALLBACK_URL_CODE = 'T2D7X'  // ✅ Callback pour abonnements
const MYPVIT_CODE_URL = 'MTX1MTKQQCULKA3W'

const LINK_TYPES: Record<string, string> = {
  'web': 'WEB',
  'visa': 'VISA_MASTERCARD',
  'rest': 'RESTLINK'
}

export default class PayLinkSubscriptionController {

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

  private async generatePaymentLink(
    amount: number,
    reference: string,
    linkTypeCode: string,
    operatorInfo: { name: string; code: string; accountCode: string },
    phoneNumber: string
  ): Promise<any> {
    console.log(`🔑 Génération lien ${linkTypeCode} pour:`, reference)

    const linkPayload: any = {
      amount: amount,
      product: reference.substring(0, 15),
      reference: `REF${Date.now()}`.substring(0, 15),
      service: linkTypeCode,
      callback_url_code: SUBSCRIPTION_CALLBACK_URL_CODE,  // ✅ T2D7X
      merchant_operation_account_code: operatorInfo.accountCode,
      transaction_type: 'PAYMENT',
      owner_charge: 'MERCHANT',
      success_redirection_url_code: 'W0L8C',
      failed_redirection_url_code: 'YTJEI',
    }

    if (linkTypeCode === 'VISA_MASTERCARD' || linkTypeCode === 'RESTLINK') {
      linkPayload.customer_account_number = phoneNumber
    } else if (linkTypeCode === 'WEB' && phoneNumber) {
      linkPayload.customer_account_number = phoneNumber
    }

    console.log('📤 Payload Mypvit:', JSON.stringify(linkPayload, null, 2))

    const secret = await MypvitSecretService.getSecret(phoneNumber)
    
    const linkResponse = await axios.post(
      `https://api.mypvit.pro/${MYPVIT_CODE_URL}/link`,
      linkPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Secret': secret,
          'X-Callback-MediaType': 'application/json',
        },
        timeout: 30000
      }
    )

    console.log('✅ Lien généré:', {
      status: linkResponse.data.status,
      reference_id: linkResponse.data.merchant_reference_id,
      url: linkResponse.data.url
    })

    return linkResponse.data
  }

  // ==================== PAIEMENT ABONNEMENT PAR LIEN ====================
  async paySubscription({ request, response }: HttpContext) {
    console.log('💎 ========== PAIEMENT ABONNEMENT PAR LIEN ==========')

    try {
      const payload = request.only([
        'userId', 'plan', 'subscriptionType', 'productId',
        'customerAccountNumber', 'customerName', 'customerEmail',
        'customerPhone', 'linkType', 'autoRenew'
      ])

      console.log('📦 Données abonnement reçues:', payload)

      const userId = payload.userId
      const phoneNumber = payload.customerAccountNumber || payload.customerPhone
      const plan = payload.plan
      const linkType = payload.linkType || 'web'
      const linkTypeCode = LINK_TYPES[linkType] || 'WEB'

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
      if (!Object.values(SUBSCRIPTION_PLANS).includes(plan)) {
        return response.status(400).json({
          success: false,
          message: 'Plan invalide'
        })
      }

      const planConfig: any = SUBSCRIPTION_PLANS[plan]

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
      if (payload.subscriptionType === 'all_products') {
        const existingGlobal: any = await Subscription.query()
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
      console.log(`🔗 Type de lien: ${linkTypeCode}`)

      // Renouveler le secret
      await this.renewSecretIfNeeded(phoneNumber)

      // Préparer le nom du produit pour les métadonnées
      let productName = 'Tous les produits'
      if (payload.subscriptionType === 'single_product' && payload.productId) {
        const product = await Product.find(payload.productId)
        productName = product?.name || 'Produit'
      }

      // Créer l'abonnement en statut "pending"
      const subscription = await Subscription.create({
        userId: user.id,
        plan,
        subscriptionType: payload.subscriptionType || 'all_products',
        productId: payload.subscriptionType === 'single_product' ? payload.productId : null,
        status: 'pending',
        price: planConfig.price,
        boostMultiplier: planConfig.boostMultiplier,
        maxProducts: planConfig.maxProducts,
        paymentMethod: `link_${linkType}_${operatorInfo.name.toLowerCase()}`,
        autoRenew: payload.autoRenew || false,
        metadata: {
          productName,
          operator: operatorInfo.name,
          operatorCode: operatorInfo.code,
          accountCode: operatorInfo.accountCode,
          phoneNumber: phoneNumber.replace(/\s/g, ''),
          linkType: linkTypeCode
        }
      })

      console.log('💎 Abonnement créé:', subscription.id)

      // Générer le lien de paiement
      const reference = `SUB-${subscription.id.substring(0, 8)}`

      const linkResult = await this.generatePaymentLink(
        planConfig.price,
        reference,
        linkTypeCode,
        operatorInfo,
        phoneNumber
      )

      // Mettre à jour l'abonnement avec la référence de paiement
      if (linkResult.merchant_reference_id) {
        subscription.paymentReferenceId = linkResult.merchant_reference_id
        subscription.paymentStatus = 'PENDING'
        await subscription.save()
      }

      console.log('✅ Lien abonnement généré avec succès:', {
        subscriptionId: subscription.id,
        plan: planConfig.name,
        amount: planConfig.price,
        reference_id: linkResult.merchant_reference_id,
        url: linkResult.url
      })

      return response.status(201).json({
        success: true,
        message: `✅ Lien de paiement ${linkTypeCode} généré pour l'abonnement ${planConfig.name} !`,
        data: {
          subscriptionId: subscription.id,
          type: payload.subscriptionType || 'all_products',
          plan: planConfig.name,
          price: planConfig.price,
          duration: planConfig.duration,
          status: 'pending_payment',
          customerName: user.full_name || payload.customerName || 'Client',
          paymentMethod: `link_${linkType}_${operatorInfo.name.toLowerCase()}`,
          userId,
          operator: {
            name: operatorInfo.name,
            code: operatorInfo.code,
            accountCode: operatorInfo.accountCode
          },
          link: {
            payment_url: linkResult.url,
            reference_id: linkResult.merchant_reference_id || reference,
            type: linkTypeCode,
            amount: planConfig.price,
          },
        },
      })

    } catch (error: any) {
      console.error('🔴 Erreur Lien Abonnement:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      })
      
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la génération du lien de paiement pour l\'abonnement',
        error: error.response?.data?.message || error.message
      })
    }
  }

  // ==================== VÉRIFIER STATUT PAIEMENT ABONNEMENT ====================
  async checkPaymentStatus({ params, response }: HttpContext) {
    console.log('🔍 Vérification statut paiement abonnement:', params.id)

    try {
      const subscription: any = await Subscription.find(params.id)
      
      if (!subscription) {
        return response.status(404).json({
          success: false,
          message: 'Abonnement introuvable'
        })
      }

      // Si déjà actif
      if (subscription.status === 'active') {
        return response.json({
          success: true,
          message: '✅ Abonnement déjà actif',
          data: {
            status: 'SUCCESS',
            subscription: {
              id: subscription.id,
              type: subscription.subscriptionType,
              plan: subscription.planName,
              remainingDays: subscription.remainingDays
            }
          }
        })
      }

      // Si pas de référence de paiement
      if (!subscription.paymentReferenceId) {
        return response.json({
          success: false,
          message: 'Aucune référence de paiement',
          data: { status: 'UNKNOWN' }
        })
      }

      // Vérifier via Mypvit
      const MypvitTransactionService = (await import('../services/mypvit_transaction_service.js')).default
      
      const paymentStatus = await MypvitTransactionService.checkTransactionStatus(
        subscription.paymentReferenceId,
        subscription.metadata?.accountCode || 'ACC_69EFB0E02FCA3'
      )

      const status = paymentStatus?.status || 'PENDING'

      console.log('📊 Statut paiement:', status)

      if (status === 'SUCCESS') {
        // Activer l'abonnement
        await subscription.activate()
        subscription.paymentStatus = 'SUCCESS'
        await subscription.save()

        // Activer le boost
        const BoostService = (await import('../services/BoostService.js')).default

        if (subscription.subscriptionType === 'all_products') {
          await BoostService.activateBoostForMerchant(subscription.userId, subscription.id)
        } else if (subscription.subscriptionType === 'single_product' && subscription.productId) {
          await BoostService.activateBoostForProduct(subscription.productId, subscription)
        }

        return response.json({
          success: true,
          message: '✅ Paiement confirmé ! Boost activé.',
          data: {
            status: 'SUCCESS',
            subscription: {
              id: subscription.id,
              type: subscription.subscriptionType,
              plan: subscription.planName,
              remainingDays: subscription.remainingDays
            }
          }
        })
      } else if (status === 'FAILED') {
        subscription.status = 'cancelled'
        subscription.paymentStatus = 'FAILED'
        await subscription.save()

        return response.json({
          success: false,
          message: '❌ Paiement échoué',
          data: { status: 'FAILED' }
        })
      }

      // En attente
      return response.json({
        success: true,
        message: '⏳ Paiement en attente',
        data: { status: 'PENDING' },
        is_pending: true
      })

    } catch (error: any) {
      console.error('❌ Erreur vérification:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur de vérification',
        error: error.message
      })
    }
  }
}
