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
   * Souscrire à un abonnement
   * POST /api/subscriptions/subscribe
   * Body: { userId, plan, subscriptionType, productId?, paymentMethod, customerAccountNumber, autoRenew? }
   */
  async subscribe({ request, response }: HttpContext) {
    const { 
      userId,
      plan, 
      subscriptionType,
      productId,
      paymentMethod, 
      customerAccountNumber,
      autoRenew = false,
    } = request.only([
      'userId',
      'plan', 
      'subscriptionType', 
      'productId', 
      'paymentMethod', 
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
      const subscription = await Subscription.create({
        userId: user.id,
        plan: plan as SubscriptionPlan,
        subscriptionType: subscriptionType as SubscriptionType,
        productId: subscriptionType === SubscriptionType.SINGLE_PRODUCT ? productId : null,
        status: SubscriptionStatus.PENDING,
        price: planConfig.price,
        boostMultiplier: planConfig.boostMultiplier,
        maxProducts: planConfig.maxProducts,
        paymentMethod: paymentMethod || 'mobile_money',
        autoRenew,
        metadata: {
          productName: subscriptionType === SubscriptionType.SINGLE_PRODUCT ? 
            (await Product.find(productId))?.name : 'Tous les produits',
        },
      })

      const paymentResult = await MypvitTransactionService.processPayment({
        agent: 'AGENT_DEFAULT',
        amount: planConfig.price,
        reference: `SUB-${subscription.id.substring(0, 8)}`,
        callback_url_code: '9ZOXW',
        customer_account_number: customerAccountNumber || user.phone,
        operator_code: paymentMethod === 'airtel_money' ? 'AIRTEL_MONEY' : 'MOOV_MONEY',
      })

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

      subscription.paymentReferenceId = paymentResult.reference_id
      subscription.paymentStatus = 'PENDING'
      await subscription.save()

      const message = subscriptionType === SubscriptionType.ALL_PRODUCTS
        ? '⏳ Paiement initié. Tous vos produits seront boostés après confirmation.'
        : `⏳ Paiement initié. Le produit "${subscription.metadata?.productName}" sera boosté après confirmation.`

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
        await subscription.activate()
        subscription.paymentStatus = 'SUCCESS'
        await subscription.save()

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
        subscription.status = SubscriptionStatus.CANCELLED
        subscription.paymentStatus = 'FAILED'
        await subscription.save()

        return response.json({
          success: false,
          message: '❌ Paiement échoué',
          data: { status: 'FAILED', subscription },
        })

      } else {
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
   * Ajouter un produit au boost
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
        } : null,
        productSubscriptions: productSubs.map(sub => ({
          id: sub.id,
          plan: sub.planName,
          productName: sub.product?.name,
          remainingDays: sub.remainingDays,
          totalViews: sub.totalViews,
          totalClicks: sub.totalClicks,
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
