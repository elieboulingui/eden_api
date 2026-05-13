// app/controllers/SubscriptionQRController.ts - CORRIGÉ (avec IDs PVIT)
import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import Product from '#models/Product'
import Subscription, { SUBSCRIPTION_PLANS } from '#models/Subscription'
import MypvitSecretService from '../services/mypvit_secret_services.js'
import MypvitQRCodeService from '../services/mypvit_qrcode_service.js'
import PvitStatusService from '../services/pvit_status_service.js'
import { DateTime } from 'luxon'

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

      // ✅ Générer le QR Code EN IMAGE PNG
      const qrResult = await MypvitQRCodeService.generateQRCode({
        accountOperationCode: GIMAC_ACCOUNT,
        terminalId: terminalId,
        callbackUrlCode: SUBSCRIPTION_CALLBACK_URL_CODE,
        amount: planConfig.price,
        reference: reference,
        phoneNumber: phoneNumber,
        returnAsImage: true
      })

      console.log('✅ QR Code généré (image PNG base64)')
      console.log('🔑 QR Result COMPLET:', JSON.stringify(qrResult, null, 2))
      console.log('🔑 Reference ID:', qrResult.reference_id)
      console.log('🔑 Merchant Reference ID:', qrResult.merchant_reference_id)

      // Mettre à jour l'abonnement
      if (qrResult.reference_id) {
        subscription.paymentReferenceId = qrResult.reference_id
        subscription.paymentStatus = 'PENDING'
        await subscription.save()
      }

      // ✅ RÉCUPÉRER LE X-SECRET
      console.log('🔑 Récupération du X-Secret...')
      const xSecret = await MypvitSecretService.getSecret()
      console.log('   X-Secret:', xSecret.substring(0, 15) + '...')

      // ✅ VÉRIFICATION DU STATUT
      console.log('🔍 Vérification statut...')
      
      let paymentStatus = null
      
      if (qrResult.reference_id) {
        try {
          console.log('📤 Envoi requête statut:')
          console.log('   Transaction ID:', qrResult.reference_id)
          console.log('   Compte:', GIMAC_ACCOUNT)
          console.log('   X-Secret:', xSecret.substring(0, 15) + '...')
          
          const statusResult = await PvitStatusService.checkStatus(
            xSecret,
            qrResult.reference_id,
            GIMAC_ACCOUNT
          )
          
          console.log('📥 Résultat statut:', JSON.stringify(statusResult, null, 2))
          
          paymentStatus = {
            checked: true,
            status: statusResult.status,
            data: statusResult.data || null
          }
          
          // ✅ Utiliser DateTime de Luxon
          if (statusResult.status === 'SUCCESS') {
            subscription.paymentStatus = 'COMPLETED'
            
            const now = DateTime.now()
            subscription.status = 'active'
            subscription.startDate = now
            subscription.endDate = now.plus({ days: planConfig.duration })
            
            await subscription.save()
            console.log('✅ Abonnement déjà activé !')
          }
          
        } catch (statusError: any) {
          console.log('⚠️ Erreur vérification statut:', statusError.message)
          paymentStatus = {
            checked: false,
            error: statusError.message
          }
        }
      }

      // ✅ RÉPONSE AVEC X-SECRET, OPÉRATEUR, IDS PVIT ET STATUT
      return response.status(201).json({
        success: true,
        message: `✅ QR Code GIMAC généré pour ${planConfig.name} !`,
        data: {
          subscriptionId: subscription.id,
          type: subscriptionType,
          plan: planConfig.name,
          price: planConfig.price,
          duration: planConfig.duration,
          status: subscription.status,
          customerName: user.full_name || payload.customerName || 'Client',
          paymentMethod: 'qr_code_gimac',
          userId,
          
          // ✅ OPÉRATEUR
          operator: {
            name: 'GIMAC',
            code: 'GIMAC_PAY',
            accountCode: GIMAC_ACCOUNT
          },
          
          // ✅ X-SECRET
          x_secret: xSecret,
          
          // ✅ IDS PVIT
          pvit_reference_id: qrResult.reference_id,                    // ID PVIT (PAY...)
          merchant_reference_id: qrResult.merchant_reference_id,        // Votre REF...
          
          // ✅ QR CODE
          qr_code: {
            data: qrResult.data,
            format: qrResult.format,
            reference_id: qrResult.reference_id,                        // ID PVIT ← Pour le statut
            merchant_reference_id: qrResult.merchant_reference_id,      // Votre REF
            amount: planConfig.price,
            expires_in: 600,
            mime_type: 'image/png'
          },
          
          // ✅ STATUT
          payment_status: paymentStatus
        },
      })

    } catch (error: any) {
      console.error('🔴 Erreur QR Code Abonnement:', error.message)
      console.error('🔴 Stack:', error.stack)
      
      let errorMessage = "Erreur lors de la génération du QR Code"
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message
      } else if (error.message) {
        errorMessage = error.message
      }
      
      return response.status(500).json({
        success: false,
        message: errorMessage,
        error: error.response?.data?.error || error.message
      })
    }
  }
}
