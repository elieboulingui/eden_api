// app/controllers/SubscriptionQRController.ts - GIMAC UNIQUEMENT
import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import Product from '#models/Product'
import Subscription, { SUBSCRIPTION_PLANS } from '#models/Subscription'
import MypvitSecretService from '../services/mypvit_secret_services.js'
import MypvitQRCodeService from '../services/mypvit_qrcode_service.js'

const SUBSCRIPTION_CALLBACK_URL_CODE = 'T2D7X'
const GIMAC_ACCOUNT = 'ACC_69FE0E1BC34B4'

export default class SubscriptionQRController {

  async pay({ request, response }: HttpContext) {
    console.log('💎📱 ========== PAIEMENT ABONNEMENT QR CODE GIMAC ==========')

    try {
      const payload = request.only([
        'userId', 'plan', 'subscriptionType', 'productId',
        'customerAccountNumber', 'customerName', 'customerEmail',
        'customerPhone', 'autoRenew'
      ])

      console.log('📦 Données abonnement QR reçues:', payload)

      const userId = payload.userId
      const phoneNumber = payload.customerAccountNumber || payload.customerPhone || '060000000'
      const plan = payload.plan

      // Validations
      if (!userId) {
        return response.status(400).json({ success: false, message: 'userId requis' })
      }

      if (!plan) {
        return response.status(400).json({ success: false, message: "Plan d'abonnement requis" })
      }

      // Vérifier le plan
      const planConfig = SUBSCRIPTION_PLANS[plan as keyof typeof SUBSCRIPTION_PLANS]
      if (!planConfig) {
        return response.status(400).json({ success: false, message: 'Plan invalide' })
      }

      // Vérifier l'utilisateur
      const user = await User.findBy('id', userId)
      if (!user) {
        return response.status(404).json({ success: false, message: 'Utilisateur introuvable' })
      }

      if (!user.isMerchant) {
        return response.status(403).json({ success: false, message: 'Seuls les marchands peuvent souscrire' })
      }

      // Vérifier le produit si single_product
      const subscriptionType = payload.subscriptionType || 'all_products'
      
      if (subscriptionType === 'single_product') {
        if (!payload.productId) {
          return response.status(400).json({ success: false, message: "Un produit est requis" })
        }
        const product = await Product.find(payload.productId)
        if (!product) {
          return response.status(404).json({ success: false, message: 'Produit introuvable' })
        }
        if (product.user_id !== user.id) {
          return response.status(403).json({ success: false, message: 'Ce produit ne vous appartient pas' })
        }
      }

      // Vérifier abonnement global existant
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
            data: { remainingDays: existingGlobal.remainingDays }
          })
        }
      }

      console.log(`🏦 GIMAC | Compte: ${GIMAC_ACCOUNT}`)
      console.log(`💎 Plan: ${planConfig.name} | Prix: ${planConfig.price} FCFA | Durée: ${planConfig.duration} jours`)

      // Préparer le nom du produit
      let productName = 'Tous les produits'
      if (subscriptionType === 'single_product' && payload.productId) {
        const product = await Product.find(payload.productId)
        productName = product?.name || 'Produit'
      }

      // Créer l'abonnement
      const subscription = await Subscription.create({
        userId: user.id,
        plan,
        subscriptionType,
        productId: subscriptionType === 'single_product' ? payload.productId : null,
        status: 'pending',
        price: planConfig.price,
        boostMultiplier: planConfig.boostMultiplier,
        maxProducts: planConfig.maxProducts,
        paymentMethod: 'qr_code_gimac',
        autoRenew: payload.autoRenew || false,
        metadata: {
          productName,
          operator: 'GIMAC',
          operatorCode: 'GIMAC_PAY',
          accountCode: GIMAC_ACCOUNT,
          phoneNumber: phoneNumber.replace(/\s/g, '')
        }
      })

      console.log('💎 Abonnement créé:', subscription.id)

      // Générer le QR Code
      const terminalId = `T${Date.now().toString(36).toUpperCase()}SUB`
      const reference = `SUB-${subscription.id.substring(0, 8)}`

      console.log('🔑 Génération QR Code GIMAC...')

      // ✅ Renouvellement secret GIMAC
      await MypvitSecretService.forceRenewal()
      await new Promise(resolve => setTimeout(resolve, 1000))

      const qrResult = await MypvitQRCodeService.generateQRCode({
        accountOperationCode: GIMAC_ACCOUNT,
        terminalId: terminalId,
        callbackUrlCode: SUBSCRIPTION_CALLBACK_URL_CODE,
        amount: planConfig.price,
        reference: reference,
        phoneNumber: phoneNumber
      })

      console.log('✅ QR Code généré:', qrResult.reference_id)

      // Mettre à jour l'abonnement
      if (qrResult.reference_id) {
        subscription.paymentReferenceId = qrResult.reference_id
        subscription.paymentStatus = 'PENDING'
        await subscription.save()
      }

      return response.status(201).json({
        success: true,
        message: `✅ QR Code GIMAC généré pour ${planConfig.name} !`,
        data: {
          subscriptionId: subscription.id,
          type: subscriptionType,
          plan: planConfig.name,
          price: planConfig.price,
          duration: planConfig.duration,
          status: 'pending_payment',
          customerName: user.full_name || payload.customerName || 'Client',
          paymentMethod: 'qr_code_gimac',
          userId,
          operator: { name: 'GIMAC', code: 'GIMAC_PAY', accountCode: GIMAC_ACCOUNT },
          qr_code: {
            data: qrResult.data,
            reference_id: qrResult.reference_id || reference,
            amount: planConfig.price,
            expires_in: 600,
          },
        },
      })

    } catch (error: any) {
      console.error('🔴 Erreur QR Code Abonnement:', error.message)
      return response.status(500).json({
        success: false,
        message: "Erreur lors de la génération du QR Code",
        error: error.response?.data?.message || error.message
      })
    }
  }
}
