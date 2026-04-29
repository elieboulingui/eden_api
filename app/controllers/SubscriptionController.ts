// app/controllers/SubscriptionController.ts
import type { HttpContext } from '@adonisjs/core/http'
import Subscription, { 
  SubscriptionPlan, 
  SubscriptionStatus, 
  SubscriptionType,
  SUBSCRIPTION_PLANS 
} from '#models/Subscription'
import User from '#models/user'
import Product from '#models/Product'
import { DateTime } from 'luxon'
import MypvitTransactionService from '../services/mypvit_transaction_service.js'
import BoostService from '../services/BoostService.js'

export default class SubscriptionController {

  /**
   * 🔑 Récupérer le marchand par son ID passé en paramètre
   */
  private async getMerchantById(
    userId: string, 
    response: HttpContext['response']
  ): Promise<User | null> {
    if (!userId) {
      response.status(400).json({
        success: false,
        message: 'ID utilisateur requis',
      })
      return null
    }

    const user = await User.find(userId)
    
    if (!user) {
      response.status(404).json({
        success: false,
        message: 'Utilisateur introuvable',
      })
      return null
    }

    if (!user.isMerchant) {
      response.status(403).json({
        success: false,
        message: 'Seuls les marchands peuvent accéder à cette fonctionnalité',
      })
      return null
    }

    return user
  }

  /**
   * 🎯 Détecter l'opérateur gabonais selon le numéro de téléphone
   * 06 → LIBERTIS (ACC_69EA59CBC7495)
   * 07 → AIRTEL_MONEY (ACC_69EFB0E02FCA3)
   * Autres → MOOV_MONEY (ACC_69EFB143D4F54)
   */
  private detectOperatorGabon(phoneNumber: string): { 
    name: string
    code: string
    accountCode: string 
  } {
    const clean = phoneNumber.replace(/[\s\+\.\-]/g, '')
    let local = clean
    if (clean.startsWith('241')) local = clean.substring(3)
    if (local.startsWith('0')) local = local.substring(1)

    // 06 → LIBERTIS
    if (local.startsWith('06') || local.startsWith('6')) {
      return {
        name: 'LIBERTIS',
        code: 'LIBERTIS',
        accountCode: 'ACC_69EA59CBC7495'
      }
    }
    
    // 07 → AIRTEL_MONEY
    if (local.startsWith('07') || local.startsWith('7')) {
      return {
        name: 'AIRTEL_MONEY',
        code: 'AIRTEL_MONEY',
        accountCode: 'ACC_69EFB0E02FCA3'
      }
    }
    
    // Par défaut → MOOV_MONEY
    return {
      name: 'MOOV_MONEY',
      code: 'MOOV_MONEY',
      accountCode: 'ACC_69EFB143D4F54'
    }
  }

  // ============================================================
  // 🟢 ROUTES
  // ============================================================

  /**
   * Récupérer tous les plans disponibles
   * GET /api/subscriptions/plans
   */
  async getPlans({ response }: HttpContext) {
    return response.json({
      success: true,
      data: Object.entries(SUBSCRIPTION_PLANS).map(([key, value]) => ({
        id: key,
        ...value,
      })),
    })
  }

  /**
   * Récupérer l'abonnement actif du marchand
   * GET /api/subscriptions/active/:userId
   */
  async getActiveSubscription({ params, response }: HttpContext) {
    const userId = params.userId
    const user = await this.getMerchantById(userId, response)
    if (!user) return

    const activeSubscriptions = await Subscription.query()
      .where('userId', user.id)
      .where('status', SubscriptionStatus.ACTIVE)
      .where('endDate', '>', DateTime.now().toSQL())
      .preload('product')
      .orderBy('endDate', 'desc')

    const globalSubscription = activeSubscriptions.find(
      sub => sub.subscriptionType === SubscriptionType.ALL_PRODUCTS
    )
    
    const productSubscriptions = activeSubscriptions.filter(
      sub => sub.subscriptionType === SubscriptionType.SINGLE_PRODUCT
    )

    return response.json({
      success: true,
      data: {
        global: globalSubscription || null,
        products: productSubscriptions,
        hasActiveSubscription: activeSubscriptions.length > 0,
        totalBoostedProducts: productSubscriptions.length,
      },
    })
  }

  /**
   * Souscrire à un abonnement (tous les produits OU un produit)
   * POST /api/subscriptions/subscribe
   * Body: { userId, plan, subscriptionType, productId?, paymentMethod, customerAccountNumber, autoRenew? }
   */
  async subscribe({ request, response }: HttpContext) {
    const { 
      userId,
      plan, 
      subscriptionType,
      productId,
      customerAccountNumber,
      autoRenew = false,
    } = request.only([
      'userId',
      'plan', 
      'subscriptionType', 
      'productId', 
      'customerAccountNumber',
      'autoRenew',
    ])

    // Récupérer le marchand
    const user = await this.getMerchantById(userId, response)
    if (!user) return

    // 1. Valider le plan
    if (!Object.values(SubscriptionPlan).includes(plan)) {
      return response.status(400).json({
        success: false,
        message: 'Plan invalide',
        validPlans: Object.values(SubscriptionPlan),
      })
    }

    // 2. Valider le type d'abonnement
    if (!Object.values(SubscriptionType).includes(subscriptionType)) {
      return response.status(400).json({
        success: false,
        message: 'Type d\'abonnement invalide',
        validTypes: Object.values(SubscriptionType),
      })
    }

    // 3. Si single_product, valider le produit
    if (subscriptionType === SubscriptionType.SINGLE_PRODUCT) {
      if (!productId) {
        return response.status(400).json({
          success: false,
          message: 'Un produit est requis pour un abonnement par produit',
        })
      }

      const product = await Product.find(productId)
      if (!product) {
        return response.status(404).json({
          success: false,
          message: 'Produit introuvable',
        })
      }

      if (product.user_id !== user.id) {
        return response.status(403).json({
          success: false,
          message: 'Ce produit ne vous appartient pas',
        })
      }

      if (product.is_archived || product.status !== 'active') {
        return response.status(400).json({
          success: false,
          message: 'Ce produit n\'est pas disponible pour le boost',
        })
      }

      // Vérifier si ce produit est déjà boosté
      const existingBoost = await Subscription.getActiveSubscriptionForProduct(productId)
      if (existingBoost) {
        return response.status(400).json({
          success: false,
          message: 'Ce produit est déjà boosté',
          data: {
            currentSubscription: existingBoost,
            remainingDays: existingBoost.remainingDays,
          },
        })
      }
    }

    // 4. Si all_products, vérifier si un abonnement global existe déjà
    if (subscriptionType === SubscriptionType.ALL_PRODUCTS) {
      const existingGlobal = await Subscription.query()
        .where('userId', user.id)
        .where('subscriptionType', SubscriptionType.ALL_PRODUCTS)
        .where('status', SubscriptionStatus.ACTIVE)
        .where('endDate', '>', DateTime.now().toSQL())
        .first()

      if (existingGlobal) {
        return response.status(400).json({
          success: false,
          message: 'Vous avez déjà un abonnement global actif',
          data: {
            currentSubscription: existingGlobal,
            remainingDays: existingGlobal.remainingDays,
            plan: existingGlobal.planName,
          },
        })
      }
    }

    const planConfig = SUBSCRIPTION_PLANS[plan]

    try {
      // 🎯 Détecter automatiquement l'opérateur selon le numéro
      const phoneNumber = customerAccountNumber || user.phone || ''
      const operator = this.detectOperatorGabon(phoneNumber)
      
      console.log('📱 Opérateur détecté:', {
        phone: phoneNumber,
        operator: operator.name,
        code: operator.code,
        accountCode: operator.accountCode,
      })

      // 5. Créer l'abonnement en attente
      const subscription = await Subscription.create({
        userId: user.id,
        plan: plan as SubscriptionPlan,
        subscriptionType: subscriptionType as SubscriptionType,
        productId: subscriptionType === SubscriptionType.SINGLE_PRODUCT ? productId : null,
        status: SubscriptionStatus.PENDING,
        price: planConfig.price,
        boostMultiplier: planConfig.boostMultiplier,
        maxProducts: planConfig.maxProducts,
        paymentMethod: operator.name, // LIBERTIS, AIRTEL_MONEY, MOOV_MONEY
        autoRenew,
        metadata: {
          productName: subscriptionType === SubscriptionType.SINGLE_PRODUCT ? 
            (await Product.find(productId))?.name : 'Tous les produits',
          operator: operator.name,
          operatorCode: operator.code,
          accountCode: operator.accountCode,
          phoneNumber: phoneNumber.replace(/\s/g, ''),
        },
      })

      // 6. Paiement avec le bon compte opérateur Mypvit
      const paymentResult = await MypvitTransactionService.processPayment({
        agent: 'AGENT_DEFAULT',
        amount: planConfig.price,
        reference: `SUB-${subscription.id.substring(0, 8)}`,
        callback_url_code: 'T2D7X',
        customer_account_number: phoneNumber.replace(/\s/g, ''),
        merchant_operation_account_code: operator.accountCode,
        operator_code: operator.code,
        owner_charge: 'CUSTOMER',
      })

      // 7. Vérifier si le paiement a échoué
      if (paymentResult.status === 'FAILED' || !paymentResult.reference_id) {
        subscription.status = SubscriptionStatus.CANCELLED
        subscription.paymentStatus = 'FAILED'
        await subscription.save()

        return response.status(400).json({
          success: false,
          message: 'Paiement échoué',
          error: paymentResult.message,
        })
      }

      // 8. Paiement initié avec succès
      subscription.paymentReferenceId = paymentResult.reference_id
      subscription.paymentStatus = 'PENDING'
      await subscription.save()

      const message = subscriptionType === SubscriptionType.ALL_PRODUCTS
        ? `⏳ Paiement ${operator.name} initié. Vérifiez votre téléphone pour confirmer.`
        : `⏳ Paiement ${operator.name} initié. Le produit "${subscription.metadata?.productName}" sera boosté après confirmation.`

      return response.status(201).json({
        success: true,
        message,
        data: {
          subscriptionId: subscription.id,
          type: subscriptionType,
          plan: subscription.planName,
          price: subscription.price,
          productName: subscription.metadata?.productName || null,
          paymentReferenceId: paymentResult.reference_id,
          operator: {
            name: operator.name,
            code: operator.code,
            accountCode: operator.accountCode,
          },
          status: 'pending_payment',
        },
      })

    } catch (error: any) {
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la souscription',
        error: error.message,
      })
    }
  }

  /**
   * Vérifier le statut du paiement d'un abonnement
   * GET /api/subscriptions/:id/payment-status
   */
  async checkPaymentStatus({ params, response }: HttpContext) {
    const subscription = await Subscription.find(params.id)

    if (!subscription) {
      return response.status(404).json({
        success: false,
        message: 'Abonnement introuvable',
      })
    }

    // Si déjà actif
    if (subscription.status === SubscriptionStatus.ACTIVE) {
      return response.json({
        success: true,
        message: '✅ Abonnement déjà actif',
        data: {
          status: 'SUCCESS',
          subscription: {
            id: subscription.id,
            type: subscription.subscriptionType,
            plan: subscription.planName,
            remainingDays: subscription.remainingDays,
            boostedProducts: subscription.boostedProductsCount,
          },
        },
      })
    }

    // Vérifier le paiement
    if (!subscription.paymentReferenceId) {
      return response.json({
        success: false,
        message: 'Aucune référence de paiement',
        data: { status: 'UNKNOWN' },
      })
    }

    try {
      const paymentStatus = await MypvitTransactionService.checkTransactionStatus({
        reference_id: subscription.paymentReferenceId,
        order_number: `SUB-${subscription.id}`,
      })

      const status = paymentStatus?.status || paymentStatus?.transaction_status

      if (status === 'SUCCESS' || status === 'SUCCESSFUL' || status === 'COMPLETED') {
        // ✅ Paiement confirmé → Activer l'abonnement
        await subscription.activate()
        subscription.paymentStatus = 'SUCCESS'
        await subscription.save()

        // 🎯 Activer le boost selon le type
        if (subscription.subscriptionType === SubscriptionType.ALL_PRODUCTS) {
          await BoostService.activateBoostForMerchant(subscription.userId, subscription.id)
        } else if (subscription.subscriptionType === SubscriptionType.SINGLE_PRODUCT && subscription.productId) {
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
              productId: subscription.productId,
              remainingDays: subscription.remainingDays,
              startDate: subscription.startDate,
              endDate: subscription.endDate,
            },
          },
        })

      } else if (status === 'FAILED' || status === 'CANCELLED' || status === 'REJECTED') {
        // ❌ Paiement échoué
        subscription.status = SubscriptionStatus.CANCELLED
        subscription.paymentStatus = 'FAILED'
        await subscription.save()

        return response.json({
          success: false,
          message: '❌ Paiement échoué',
          data: { status: 'FAILED', subscription },
        })

      } else {
        // ⏳ Toujours en attente
        return response.json({
          success: true,
          message: '⏳ Paiement en attente de confirmation',
          data: { status: 'PENDING', subscription },
          is_pending: true,
        })
      }

    } catch (error: any) {
      return response.status(500).json({
        success: false,
        message: 'Erreur de vérification',
        error: error.message,
      })
    }
  }

  /**
   * Ajouter un produit au boost (pour les plans qui le permettent)
   * POST /api/subscriptions/:id/add-product
   * Body: { userId, productId }
   */
  async addProductToBoost({ params, request, response }: HttpContext) {
    const { userId, productId } = request.only(['userId', 'productId'])
    
    const user = await this.getMerchantById(userId, response)
    if (!user) return

    const subscription = await Subscription.find(params.id)

    if (!subscription || subscription.userId !== user.id) {
      return response.status(404).json({
        success: false,
        message: 'Abonnement introuvable',
      })
    }

    if (!subscription.isActive) {
      return response.status(400).json({
        success: false,
        message: 'Cet abonnement n\'est plus actif',
      })
    }

    if (subscription.subscriptionType !== SubscriptionType.ALL_PRODUCTS) {
      return response.status(400).json({
        success: false,
        message: 'Cet abonnement ne permet pas d\'ajouter des produits individuellement',
      })
    }

    try {
      await subscription.addProductToBoost(productId)

      return response.json({
        success: true,
        message: '✅ Produit ajouté au boost',
        data: {
          boostedCount: subscription.boostedProductsCount,
          maxProducts: subscription.maxProducts,
          remaining: subscription.maxProducts - subscription.boostedProductsCount,
        },
      })
    } catch (error: any) {
      return response.status(400).json({
        success: false,
        message: error.message,
      })
    }
  }

  /**
   * Retirer un produit du boost
   * POST /api/subscriptions/:id/remove-product
   * Body: { userId, productId }
   */
  async removeProductFromBoost({ params, request, response }: HttpContext) {
    const { userId, productId } = request.only(['userId', 'productId'])
    
    const user = await this.getMerchantById(userId, response)
    if (!user) return

    const subscription = await Subscription.find(params.id)

    if (!subscription || subscription.userId !== user.id) {
      return response.status(404).json({
        success: false,
        message: 'Abonnement introuvable',
      })
    }

    try {
      await subscription.removeProductFromBoost(productId)

      return response.json({
        success: true,
        message: 'Produit retiré du boost',
        data: { boostedCount: subscription.boostedProductsCount },
      })
    } catch (error: any) {
      return response.status(400).json({
        success: false,
        message: error.message,
      })
    }
  }

  /**
   * Récupérer l'historique des abonnements
   * GET /api/subscriptions/history/:userId
   */
  async getHistory({ params, response }: HttpContext) {
    const userId = params.userId
    const user = await this.getMerchantById(userId, response)
    if (!user) return
    
    const subscriptions = await Subscription.query()
      .where('userId', user.id)
      .preload('product')
      .orderBy('createdAt', 'desc')
      .limit(50)

    return response.json({
      success: true,
      data: subscriptions.map(sub => ({
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
        totalClicks: sub.totalClicks,
        operator: sub.paymentMethod,
      })),
    })
  }

  /**
   * Annuler l'abonnement
   * POST /api/subscriptions/:id/cancel
   * Body: { userId }
   */
  async cancel({ params, request, response }: HttpContext) {
    const { userId } = request.only(['userId'])
    
    const user = await this.getMerchantById(userId, response)
    if (!user) return

    const subscription = await Subscription.find(params.id)

    if (!subscription || subscription.userId !== user.id) {
      return response.status(404).json({
        success: false,
        message: 'Abonnement introuvable',
      })
    }

    if (!subscription.isActive) {
      return response.status(400).json({
        success: false,
        message: 'Cet abonnement n\'est plus actif',
      })
    }

    await subscription.cancel()

    return response.json({
      success: true,
      message: 'Abonnement annulé avec succès',
      data: subscription,
    })
  }

  /**
   * Activer/désactiver le renouvellement automatique
   * POST /api/subscriptions/:id/auto-renew
   * Body: { userId }
   */
  async toggleAutoRenew({ params, request, response }: HttpContext) {
    const { userId } = request.only(['userId'])
    
    const user = await this.getMerchantById(userId, response)
    if (!user) return

    const subscription = await Subscription.find(params.id)

    if (!subscription || subscription.userId !== user.id) {
      return response.status(404).json({
        success: false,
        message: 'Abonnement introuvable',
      })
    }

    subscription.autoRenew = !subscription.autoRenew
    await subscription.save()

    return response.json({
      success: true,
      message: subscription.autoRenew 
        ? 'Renouvellement automatique activé' 
        : 'Renouvellement automatique désactivé',
      data: subscription,
    })
  }

  /**
   * Récupérer les statistiques de boost
   * GET /api/subscriptions/stats/:userId
   */
  async getStats({ params, response }: HttpContext) {
    const userId = params.userId
    const user = await this.getMerchantById(userId, response)
    if (!user) return

    const activeSubscriptions = await Subscription.query()
      .where('userId', user.id)
      .where('status', SubscriptionStatus.ACTIVE)
      .where('endDate', '>', DateTime.now().toSQL())
      .preload('product')

    const globalSub = activeSubscriptions.find(
      sub => sub.subscriptionType === SubscriptionType.ALL_PRODUCTS
    )

    const productSubs = activeSubscriptions.filter(
      sub => sub.subscriptionType === SubscriptionType.SINGLE_PRODUCT
    )

    const totalViews = activeSubscriptions.reduce((sum, sub) => sum + sub.totalViews, 0)
    const totalClicks = activeSubscriptions.reduce((sum, sub) => sum + sub.totalClicks, 0)

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
          totalClicks: globalSub.totalClicks,
          operator: globalSub.paymentMethod,
        } : null,
        productSubscriptions: productSubs.map(sub => ({
          id: sub.id,
          plan: sub.planName,
          productName: sub.product?.name,
          remainingDays: sub.remainingDays,
          totalViews: sub.totalViews,
          totalClicks: sub.totalClicks,
          operator: sub.paymentMethod,
        })),
        totals: {
          views: totalViews,
          clicks: totalClicks,
          conversionRate: totalViews > 0 ? Math.round((totalClicks / totalViews) * 100) : 0,
        },
      },
    })
  }
}
