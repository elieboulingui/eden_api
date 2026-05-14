// app/controllers/SubscriptionController.ts - AVEC X-SECRET ET IDS PVIT COMPLETS
import type { HttpContext } from '@adonisjs/core/http'
import Subscription, { SubscriptionPlan, SUBSCRIPTION_PLANS } from '#models/Subscription'
import User from '#models/user'
import Product from '#models/Product'
import { DateTime } from 'luxon'
import MypvitTransactionService from '../services/mypvit_transaction_service.js'
import MypvitSecretService from '../services/mypvit_secret_service.js'
import BoostService from '../services/BoostService.js'

export default class SubscriptionController {

  private async getMerchantById(userId: string, response: HttpContext['response']): Promise<User | null> {
    if (!userId) { response.status(400).json({ success: false, message: 'ID utilisateur requis' }); return null }
    const user = await User.find(userId)
    if (!user) { response.status(404).json({ success: false, message: 'Utilisateur introuvable' }); return null }
    if (!user.isMerchant) { response.status(403).json({ success: false, message: 'Seuls les marchands peuvent accéder à cette fonctionnalité' }); return null }
    return user
  }

  private detectOperatorGabon(phoneNumber: string): { name: string; code: string; accountCode: string } {
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
    
    return { name: 'GIMAC', code: 'GIMAC_PAY', accountCode: 'ACC_69FE0E1BC34B4' }
  }

  async getPlans({ response }: HttpContext) {
    return response.json({ 
      success: true, 
      data: Object.entries(SUBSCRIPTION_PLANS).map(([key, value]: [string, any]) => ({ 
        id: key, 
        ...value 
      })) 
    })
  }

  async getActiveSubscription({ params, response }: HttpContext) {
    const user = await this.getMerchantById(params.userId, response)
    if (!user) return

    const activeSubscriptions: any[] = await Subscription.query()
      .where('userId', user.id)
      .where('status', 'active')
      .where('endDate', '>', DateTime.now().toSQL())
      .preload('product')
      .orderBy('endDate', 'desc')

    const globalSubscription = activeSubscriptions.find((sub: any) => sub.subscriptionType === 'all_products')
    const productSubscriptions = activeSubscriptions.filter((sub: any) => sub.subscriptionType === 'single_product')

    return response.json({
      success: true,
      data: { 
        global: globalSubscription || null, 
        products: productSubscriptions, 
        hasActiveSubscription: activeSubscriptions.length > 0, 
        totalBoostedProducts: productSubscriptions.length 
      },
    })
  }

  async subscribe({ request, response }: HttpContext) {
    const { userId, plan, subscriptionType, productId, customerAccountNumber, autoRenew = false } = 
      request.only(['userId', 'plan', 'subscriptionType', 'productId', 'customerAccountNumber', 'autoRenew'])

    const user = await this.getMerchantById(userId, response)
    if (!user) return

    // Validation du plan
    if (!Object.values(SubscriptionPlan).includes(plan)) {
      return response.status(400).json({ success: false, message: 'Plan invalide' })
    }

    // Validation produit si single_product
    if (subscriptionType === 'single_product') {
      if (!productId) return response.status(400).json({ success: false, message: 'Un produit est requis' })
      const product = await Product.find(productId)
      if (!product) return response.status(404).json({ success: false, message: 'Produit introuvable' })
      if (product.user_id !== user.id) return response.status(403).json({ success: false, message: 'Ce produit ne vous appartient pas' })
      if (product.isArchived || product.status !== 'active') return response.status(400).json({ success: false, message: 'Produit non disponible' })
    }

    // Vérifier abonnement global existant
    if (subscriptionType === 'all_products') {
      const existingGlobal: any = await Subscription.query()
        .where('userId', user.id)
        .where('subscriptionType', 'all_products')
        .where('status', 'active')
        .where('endDate', '>', DateTime.now().toSQL())
        .first()
        
      if (existingGlobal) {
        return response.status(400).json({ 
          success: false, 
          message: 'Vous avez déjà un abonnement global actif', 
          data: { remainingDays: existingGlobal.remainingDays } 
        })
      }
    }

    const planConfig: any = SUBSCRIPTION_PLANS[plan]

    try {
      const phoneNumber = customerAccountNumber || user.phone || ''
      const operator = this.detectOperatorGabon(phoneNumber)

      // Créer l'abonnement en statut "pending"
      const subscription = await Subscription.create({
        userId: user.id,
        plan,
        subscriptionType,
        productId: subscriptionType === 'single_product' ? productId : null,
        status: 'pending',
        price: planConfig.price,
        boostMultiplier: planConfig.boostMultiplier,
        maxProducts: planConfig.maxProducts,
        paymentMethod: operator.name,
        autoRenew,
        metadata: { 
          productName: subscriptionType === 'single_product' 
            ? (await Product.find(productId))?.name 
            : 'Tous les produits', 
          operator: operator.name, 
          operatorCode: operator.code, 
          accountCode: operator.accountCode, 
          phoneNumber: phoneNumber.replace(/\s/g, '') 
        },
      })

      console.log('💳 [SubscriptionController] Initiation paiement:', {
        subscriptionId: subscription.id,
        plan: planConfig.name,
        amount: planConfig.price,
        operator: operator.name,
        phone: phoneNumber.replace(/\s/g, '')
      })

      // ✅ Appel au service de paiement
      const paymentResult: any = await MypvitTransactionService.processPayment({
        amount: planConfig.price,
        reference: `SUB${subscription.id.substring(0, 8)}`,
        callback_url_code: 'T2D7X',
        customer_account_number: phoneNumber.replace(/\s/g, ''),
        merchant_operation_account_code: operator.accountCode,
        operator_code: operator.code,
        owner_charge: 'CUSTOMER',
      })

      // 🔥 LOG COMPLET DE LA RÉPONSE PVIT
      console.log('💳 Résultat paiement COMPLET:', JSON.stringify(paymentResult, null, 2))
      console.log('🔍 paymentResult.reference_id:', paymentResult.reference_id)
      console.log('🔍 paymentResult.merchant_reference_id:', paymentResult.merchant_reference_id)
      console.log('🔍 paymentResult.status:', paymentResult.status)

      // ✅ RÉCUPÉRER LE X-SECRET
      const xSecret = await MypvitSecretService.getSecret()
      console.log('   X-Secret:', xSecret.substring(0, 15) + '...')

      // Gestion de l'échec
      if (paymentResult.status === 'FAILED' || !paymentResult.reference_id) {
        subscription.status = 'cancelled'
        subscription.paymentStatus = 'FAILED'
        await subscription.save()
        
        return response.status(400).json({ 
          success: false, 
          message: 'Paiement échoué', 
          error: paymentResult.message,
          operator: {
            name: operator.name,
            code: operator.code,
            accountCode: operator.accountCode
          },
          x_secret: xSecret
        })
      }

      // Paiement en attente
      subscription.paymentReferenceId = paymentResult.reference_id
      subscription.paymentStatus = 'PENDING'
      await subscription.save()

      // ✅ RÉPONSE AVEC X-SECRET, OPÉRATEUR ET IDS PVIT
      return response.status(201).json({
        success: true,
        message: `⏳ Paiement ${operator.name} initié. Vérifiez votre téléphone.`,
        data: { 
          subscriptionId: subscription.id, 
          type: subscriptionType, 
          plan: planConfig.name, 
          price: planConfig.price, 
          paymentReferenceId: paymentResult.reference_id,
          status: 'pending_payment',
          
          // ✅ OPÉRATEUR
          operator: { 
            name: operator.name, 
            code: operator.code,
            accountCode: operator.accountCode,
            phoneNumber: phoneNumber.replace(/\s/g, '')
          },
          
          // ✅ X-SECRET
          x_secret: xSecret,
          
          // ✅ IDS PVIT (LES DEUX !)
          pvit_reference_id: paymentResult.reference_id,                    // ID PVIT (PAY...) ← POUR LE STATUS
          merchant_reference_id: paymentResult.merchant_reference_id,        // Votre REF... (SUB-...)
          
          // ✅ PAIEMENT
          payment: {
            reference_id: paymentResult.reference_id,                        // ID PVIT ← POUR checkPvitStatus
            merchant_reference_id: paymentResult.merchant_reference_id,      // Votre REF
            status: paymentResult.status || 'PENDING',
            transaction_id: paymentResult.reference_id
          }
        },
      })
    } catch (error: any) {
      console.error('❌ [SubscriptionController] Erreur souscription:', error)
      return response.status(500).json({ 
        success: false, 
        message: 'Erreur lors de la souscription', 
        error: error.message 
      })
    }
  }

  async checkPaymentStatus({ params, response }: HttpContext) {
    const subscription: any = await Subscription.find(params.id)
    if (!subscription) {
      return response.status(404).json({ success: false, message: 'Abonnement introuvable' })
    }

    // Déjà actif
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

    // Pas de référence de paiement
    if (!subscription.paymentReferenceId) {
      return response.json({ 
        success: false, 
        message: 'Aucune référence de paiement', 
        data: { status: 'UNKNOWN' } 
      })
    }

    try {
      console.log('🔍 [SubscriptionController] Vérification statut:', {
        subscriptionId: subscription.id,
        paymentRef: subscription.paymentReferenceId
      })

      // ✅ Récupérer le X-Secret pour la vérification
      const xSecret = await MypvitSecretService.getSecret()

      // ✅ Vérification du statut
      const paymentStatus: any = await MypvitTransactionService.checkTransactionStatus(
        subscription.paymentReferenceId,
        subscription.metadata?.accountCode || 'ACC_69FE0E1BC34B4'
      )
      
      const status = paymentStatus?.status || 'PENDING'

      console.log('📊 [SubscriptionController] Statut reçu:', status)

      if (status === 'SUCCESS') {
        // Activer l'abonnement
        await subscription.activate()
        subscription.paymentStatus = 'SUCCESS'
        await subscription.save()

        // Activer le boost selon le type
        if (subscription.subscriptionType === 'all_products') {
          await BoostService.activateBoostForMerchant(subscription.userId, subscription.id)
          console.log('🚀 [SubscriptionController] Boost global activé')
        } else if (subscription.subscriptionType === 'single_product' && subscription.productId) {
          await BoostService.activateBoostForProduct(subscription.productId, subscription)
          console.log('🚀 [SubscriptionController] Boost produit activé')
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
            },
            // ✅ X-SECRET et ID PVIT dans la réponse
            x_secret: xSecret,
            pvit_reference_id: subscription.paymentReferenceId
          } 
        })
      } else if (status === 'FAILED') {
        subscription.status = 'cancelled'
        subscription.paymentStatus = 'FAILED'
        await subscription.save()
        
        return response.json({ 
          success: false, 
          message: '❌ Paiement échoué', 
          data: { 
            status: 'FAILED',
            x_secret: xSecret,
            pvit_reference_id: subscription.paymentReferenceId
          } 
        })
      } else if (status === 'AMBIGUOUS') {
        return response.json({ 
          success: true, 
          message: '⚠️ Statut ambigu, veuillez réessayer', 
          data: { 
            status: 'AMBIGUOUS',
            x_secret: xSecret,
            pvit_reference_id: subscription.paymentReferenceId
          }, 
          is_pending: true 
        })
      } else {
        return response.json({ 
          success: true, 
          message: '⏳ Paiement en attente', 
          data: { 
            status: 'PENDING',
            x_secret: xSecret,
            pvit_reference_id: subscription.paymentReferenceId
          }, 
          is_pending: true 
        })
      }
    } catch (error: any) {
      console.error('❌ [SubscriptionController] Erreur vérification:', error)
      return response.status(500).json({ 
        success: false, 
        message: 'Erreur de vérification', 
        error: error.message 
      })
    }
  }

  async addProductToBoost({ params, request, response }: HttpContext) {
    const { userId, productId } = request.only(['userId', 'productId'])
    const user = await this.getMerchantById(userId, response)
    if (!user) return

    const subscription: any = await Subscription.find(params.id)
    if (!subscription || subscription.userId !== user.id) {
      return response.status(404).json({ success: false, message: 'Abonnement introuvable' })
    }
    if (!subscription.isActive) {
      return response.status(400).json({ success: false, message: 'Abonnement inactif' })
    }

    const product = await Product.find(productId)
    if (!product || product.user_id !== user.id) {
      return response.status(400).json({ success: false, message: 'Produit invalide' })
    }

    product.isBoosted = true
    product.boostMultiplier = subscription.boostMultiplier
    product.boostLevel = subscription.boostLevel as any
    product.boostBadge = subscription.badge
    product.boostPriority = subscription.boostMultiplier * 100
    product.boostStartDate = subscription.startDate
    product.boostEndDate = subscription.endDate
    await product.save()

    subscription.boostedProductsCount++
    await subscription.save()

    return response.json({ 
      success: true, 
      message: '✅ Produit ajouté au boost', 
      data: { 
        boostedCount: subscription.boostedProductsCount, 
        maxProducts: subscription.maxProducts, 
        remaining: subscription.maxProducts - subscription.boostedProductsCount 
      } 
    })
  }

  async removeProductFromBoost({ params, request, response }: HttpContext) {
    const { userId, productId } = request.only(['userId', 'productId'])
    const user = await this.getMerchantById(userId, response)
    if (!user) return

    const subscription: any = await Subscription.find(params.id)
    if (!subscription || subscription.userId !== user.id) {
      return response.status(404).json({ success: false, message: 'Abonnement introuvable' })
    }

    const product = await Product.find(productId)
    if (product) await product.deactivateBoost()

    subscription.boostedProductsCount = Math.max(0, subscription.boostedProductsCount - 1)
    await subscription.save()

    return response.json({ 
      success: true, 
      message: 'Produit retiré du boost', 
      data: { boostedCount: subscription.boostedProductsCount } 
    })
  }

  async getHistory({ params, response }: HttpContext) {
    const user = await this.getMerchantById(params.userId, response)
    if (!user) return

    const subscriptions: any[] = await Subscription.query()
      .where('userId', user.id)
      .orderBy('createdAt', 'desc')
      .limit(50)

    return response.json({
      success: true,
      data: subscriptions.map((sub: any) => ({ 
        id: sub.id, 
        type: sub.subscriptionType, 
        plan: sub.planName, 
        price: sub.price, 
        status: sub.status, 
        productName: sub.product?.name || 'Tous les produits', 
        startDate: sub.startDate, 
        endDate: sub.endDate, 
        remainingDays: sub.remainingDays, 
        totalViews: sub.totalViews, 
        totalClicks: sub.totalClicks 
      })),
    })
  }

  async cancel({ params, request, response }: HttpContext) {
    const { userId } = request.only(['userId'])
    const user = await this.getMerchantById(userId, response)
    if (!user) return

    const subscription: any = await Subscription.find(params.id)
    if (!subscription || subscription.userId !== user.id) {
      return response.status(404).json({ success: false, message: 'Abonnement introuvable' })
    }
    if (!subscription.isActive) {
      return response.status(400).json({ success: false, message: 'Abonnement inactif' })
    }

    await subscription.cancel()
    return response.json({ success: true, message: 'Abonnement annulé' })
  }

  async toggleAutoRenew({ params, request, response }: HttpContext) {
    const { userId } = request.only(['userId'])
    const user = await this.getMerchantById(userId, response)
    if (!user) return

    const subscription: any = await Subscription.find(params.id)
    if (!subscription || subscription.userId !== user.id) {
      return response.status(404).json({ success: false, message: 'Abonnement introuvable' })
    }

    subscription.autoRenew = !subscription.autoRenew
    await subscription.save()
    
    return response.json({ 
      success: true, 
      message: subscription.autoRenew 
        ? 'Renouvellement automatique activé' 
        : 'Renouvellement automatique désactivé' 
    })
  }

  async getStats({ params, response }: HttpContext) {
    const user = await this.getMerchantById(params.userId, response)
    if (!user) return

    const activeSubscriptions: any[] = await Subscription.query()
      .where('userId', user.id)
      .where('status', 'active')
      .where('endDate', '>', DateTime.now().toSQL())

    const globalSub = activeSubscriptions.find((sub: any) => sub.subscriptionType === 'all_products')
    const productSubs = activeSubscriptions.filter((sub: any) => sub.subscriptionType === 'single_product')
    const totalViews = activeSubscriptions.reduce((sum: number, sub: any) => sum + (sub.totalViews || 0), 0)
    const totalClicks = activeSubscriptions.reduce((sum: number, sub: any) => sum + (sub.totalClicks || 0), 0)

    return response.json({
      success: true,
      data: {
        activeSubscriptionsCount: activeSubscriptions.length,
        globalSubscription: globalSub ? { 
          id: globalSub.id, 
          plan: globalSub.planName, 
          remainingDays: globalSub.remainingDays, 
          boostedProductsCount: globalSub.boostedProductsCount, 
          totalViews: globalSub.totalViews, 
          totalClicks: globalSub.totalClicks 
        } : null,
        productSubscriptions: productSubs.map((sub: any) => ({ 
          id: sub.id, 
          plan: sub.planName, 
          productName: sub.product?.name, 
          remainingDays: sub.remainingDays, 
          totalViews: sub.totalViews, 
          totalClicks: sub.totalClicks 
        })),
        totals: { 
          views: totalViews, 
          clicks: totalClicks, 
          conversionRate: totalViews > 0 ? Math.round((totalClicks / totalViews) * 100) : 0 
        },
      },
    })
  }
}
