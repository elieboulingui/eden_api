// app/controllers/SubscriptionCallbackController.ts
import type { HttpContext } from '@adonisjs/core/http'
import Subscription, { SubscriptionStatus, SubscriptionType } from '#models/Subscription'
import BoostService from '../services/BoostService.js'
import { DateTime } from 'luxon'

export default class SubscriptionCallbackController {

  // Remplacer checkPaymentStatus (ligne ~380)
async checkPaymentStatus({ params, response }: HttpContext) {
  const subscription = await Subscription.find(params.id)

  if (!subscription) {
    return response.status(404).json({
      success: false,
      message: 'Abonnement introuvable',
    })
  }

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
    const paymentStatus: any = await MypvitTransactionService.checkTransactionStatus(
      subscription.paymentReferenceId,
      `SUB-${subscription.id}`
    )

    const status = paymentStatus?.status || 'PENDING'

    if (status === 'SUCCESS') {
      await subscription.activate()
      subscription.paymentStatus = 'SUCCESS'
      await subscription.save()

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
            productId: subscription.productId,
            remainingDays: subscription.remainingDays,
            startDate: subscription.startDate,
            endDate: subscription.endDate,
          },
        },
      })

    } else if (status === 'FAILED') {
      subscription.status = 'cancelled'
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

// Remplacer addProductToBoost (ligne ~480)
async addProductToBoost({ params, request, response }: HttpContext) {
  const { userId, productId } = request.only(['userId', 'productId'])
  
  const user = await this.getMerchantById(userId, response)
  if (!user) return

  const subscription: any = await Subscription.find(params.id)

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

// Remplacer removeProductFromBoost (ligne ~530)
async removeProductFromBoost({ params, request, response }: HttpContext) {
  const { userId, productId } = request.only(['userId', 'productId'])
  
  const user = await this.getMerchantById(userId, response)
  if (!user) return

  const subscription: any = await Subscription.find(params.id)

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

// Remplacer getHistory (ligne ~560)
async getHistory({ params, response }: HttpContext) {
  const userId = params.userId
  const user = await this.getMerchantById(userId, response)
  if (!user) return
  
  const subscriptions = await Subscription.query()
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
      totalClicks: sub.totalClicks,
    })),
  })
}

// Remplacer getStats (ligne ~660)
async getStats({ params, response }: HttpContext) {
  const userId = params.userId
  const user = await this.getMerchantById(userId, response)
  if (!user) return

  const activeSubscriptions: any[] = await Subscription.query()
    .where('userId', user.id)
    .where('status', 'active')
    .where('endDate', '>', DateTime.now().toSQL())

  const globalSub = activeSubscriptions.find(
    (sub: any) => sub.subscriptionType === 'all_products'
  )

  const productSubs = activeSubscriptions.filter(
    (sub: any) => sub.subscriptionType === 'single_product'
  )

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
        totalClicks: globalSub.totalClicks,
        operator: globalSub.paymentMethod,
      } : null,
      productSubscriptions: productSubs.map((sub: any) => ({
        id: sub.id,
        plan: sub.planName,
        productName: sub.product?.name || 'Produit',
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

  /**
   * Callback Mypvit pour les paiements d'abonnement
   * POST /api/subscriptions/callback
   * 
   * Mypvit envoie automatiquement :
   * {
   *   reference_id: string,
   *   status: 'SUCCESS' | 'FAILED' | 'PENDING',
   *   transaction_id: string,
   *   message: string,
   *   amount: number
   * }
   */
  async handle({ request, response }: HttpContext) {
    console.log('🔔 ========== CALLBACK SUBSCRIPTION REÇU ==========')
    
    try {
      const payload = request.body()
      console.log('📦 Payload reçu:', payload)

      const { 
        reference_id, 
        status, 
        transaction_id, 
        message,
        amount 
      } = payload

      if (!reference_id) {
        console.log('❌ Pas de reference_id dans le callback')
        return response.status(400).json({
          success: false,
          message: 'reference_id manquant',
        })
      }

      // Chercher l'abonnement par reference_id
      const subscription = await Subscription.query()
        .where('paymentReferenceId', reference_id)
        .first()

      if (!subscription) {
        console.log('❌ Aucun abonnement trouvé pour la référence:', reference_id)
        return response.status(404).json({
          success: false,
          message: 'Abonnement introuvable',
        })
      }

      console.log('📋 Abonnement trouvé:', {
        id: subscription.id,
        plan: subscription.planName,
        type: subscription.subscriptionType,
        status: subscription.status,
      })

      // Traiter selon le statut
      switch (status) {
        case 'SUCCESS':
        case 'SUCCESSFUL':
        case 'COMPLETED':
          // ✅ Paiement confirmé
          console.log('✅ Paiement confirmé - Activation de l\'abonnement')
          
          await subscription.activate()
          subscription.paymentStatus = 'SUCCESS'
          subscription.metadata = {
            ...subscription.metadata,
            callbackReceivedAt: DateTime.now().toISO(),
            transactionId: transaction_id,
            callbackStatus: status,
          }
          await subscription.save()

          // Activer le boost selon le type
          if (subscription.subscriptionType === SubscriptionType.ALL_PRODUCTS) {
            console.log('🚀 Activation boost pour TOUS les produits du marchand')
            await BoostService.activateBoostForMerchant(subscription.userId, subscription.id)
          } else if (subscription.subscriptionType === SubscriptionType.SINGLE_PRODUCT && subscription.productId) {
            console.log('🚀 Activation boost pour le produit:', subscription.productId)
            await BoostService.activateBoostForProduct(subscription.productId, subscription)
          }

          console.log('✅ Abonnement activé avec succès')

          return response.json({
            success: true,
            message: 'Abonnement activé',
            data: {
              subscriptionId: subscription.id,
              status: 'ACTIVE',
              remainingDays: subscription.remainingDays,
            },
          })
          break

        case 'FAILED':
        case 'CANCELLED':
        case 'REJECTED':
          // ❌ Paiement échoué
          console.log('❌ Paiement échoué - Annulation de l\'abonnement')
          
          subscription.status = SubscriptionStatus.CANCELLED
          subscription.paymentStatus = 'FAILED'
          subscription.metadata = {
            ...subscription.metadata,
            callbackReceivedAt: DateTime.now().toISO(),
            transactionId: transaction_id,
            callbackStatus: status,
            errorMessage: message,
          }
          await subscription.save()

          console.log('❌ Abonnement annulé')

          return response.json({
            success: true,
            message: 'Abonnement annulé (paiement échoué)',
            data: {
              subscriptionId: subscription.id,
              status: 'CANCELLED',
            },
          })
          break

        case 'PENDING':
        default:
          // ⏳ Toujours en attente
          console.log('⏳ Paiement toujours en attente')
          
          subscription.paymentStatus = 'PENDING'
          subscription.metadata = {
            ...subscription.metadata,
            lastCallbackReceivedAt: DateTime.now().toISO(),
            lastCallbackStatus: status,
          }
          await subscription.save()

          return response.json({
            success: true,
            message: 'Statut en attente enregistré',
            data: {
              subscriptionId: subscription.id,
              status: 'PENDING',
            },
          })
          break
      }

    } catch (error: any) {
      console.error('🔴 Erreur callback subscription:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors du traitement du callback',
        error: error.message,
      })
    }
  }

  /**
   * Callback de test pour simuler Mypvit (développement)
   * POST /api/subscriptions/callback/test
   */
  async test({ request, response }: HttpContext) {
    const { reference_id, status } = request.only(['reference_id', 'status'])

    console.log('🧪 TEST CALLBACK:', { reference_id, status })

    // Simuler le callback
    return this.handle({
      request: {
        body: () => ({
          reference_id,
          status: status || 'SUCCESS',
          transaction_id: 'TEST-' + Date.now(),
          message: 'Test callback',
          amount: 0,
        }),
      },
      response,
    } as any)
  }
}
