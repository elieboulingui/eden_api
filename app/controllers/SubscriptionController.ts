// app/controllers/SubscriptionController.ts
import type { HttpContext } from '@adonisjs/core/http'
import Subscription, { SubscriptionPlan, SUBSCRIPTION_PLANS } from '#models/Subscription'
import User from '#models/user'
import Product from '#models/Product'
import { DateTime } from 'luxon'
import MypvitTransactionService from '../services/mypvit_transaction_service.js'
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
    if (local.startsWith('06') || local.startsWith('6')) return { name: 'LIBERTIS', code: 'LIBERTIS', accountCode: 'ACC_69EA59CBC7495' }
    if (local.startsWith('07') || local.startsWith('7')) return { name: 'AIRTEL_MONEY', code: 'AIRTEL_MONEY', accountCode: 'ACC_69EFB0E02FCA3' }
    return { name: 'MOOV_MONEY', code: 'MOOV_MONEY', accountCode: 'ACC_69EFB143D4F54' }
  }

  async getPlans({ response }: HttpContext) {
    return response.json({ success: true, data: Object.entries(SUBSCRIPTION_PLANS).map(([key, value]: [string, any]) => ({ id: key, ...value })) })
  }

  async getActiveSubscription({ params, response }: HttpContext) {
    const user = await this.getMerchantById(params.userId, response)
    if (!user) return

    const activeSubscriptions: any[] = await Subscription.query()
      .where('userId', user.id).where('status', 'active').where('endDate', '>', DateTime.now().toSQL())
      .preload('product').orderBy('endDate', 'desc')

    const globalSubscription = activeSubscriptions.find((sub: any) => sub.subscriptionType === 'all_products')
    const productSubscriptions = activeSubscriptions.filter((sub: any) => sub.subscriptionType === 'single_product')

    return response.json({
      success: true,
      data: { global: globalSubscription || null, products: productSubscriptions, hasActiveSubscription: activeSubscriptions.length > 0, totalBoostedProducts: productSubscriptions.length },
    })
  }

  async subscribe({ request, response }: HttpContext) {
    const { userId, plan, subscriptionType, productId, customerAccountNumber, autoRenew = false } = request.only(['userId', 'plan', 'subscriptionType', 'productId', 'customerAccountNumber', 'autoRenew'])

    const user = await this.getMerchantById(userId, response)
    if (!user) return

    if (!Object.values(SubscriptionPlan).includes(plan)) {
      return response.status(400).json({ success: false, message: 'Plan invalide' })
    }

    if (subscriptionType === 'single_product') {
      if (!productId) return response.status(400).json({ success: false, message: 'Un produit est requis' })
      const product = await Product.find(productId)
      if (!product) return response.status(404).json({ success: false, message: 'Produit introuvable' })
      if (product.user_id !== user.id) return response.status(403).json({ success: false, message: 'Ce produit ne vous appartient pas' })
      if (product.isArchived || product.status !== 'active') return response.status(400).json({ success: false, message: 'Produit non disponible' })
    }

    if (subscriptionType === 'all_products') {
      const existingGlobal: any = await Subscription.query()
        .where('userId', user.id).where('subscriptionType', 'all_products').where('status', 'active').where('endDate', '>', DateTime.now().toSQL()).first()
      if (existingGlobal) {
        return response.status(400).json({ success: false, message: 'Vous avez déjà un abonnement global actif', data: { remainingDays: existingGlobal.remainingDays } })
      }
    }

    const planConfig: any = SUBSCRIPTION_PLANS[plan]

    try {
      const phoneNumber = customerAccountNumber || user.phone || ''
      const operator = this.detectOperatorGabon(phoneNumber)

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
        metadata: { productName: subscriptionType === 'single_product' ? (await Product.find(productId))?.name : 'Tous les produits', operator: operator.name, operatorCode: operator.code, accountCode: operator.accountCode, phoneNumber: phoneNumber.replace(/\s/g, '') },
      })

      const paymentResult: any = await MypvitTransactionService.processPayment({
        agent: 'AGENT_DEFAULT',
        amount: planConfig.price,
        reference: `SUB-${subscription.id.substring(0, 8)}`,
        callback_url_code: 'T2D7X',
        customer_account_number: phoneNumber.replace(/\s/g, ''),
        merchant_operation_account_code: operator.accountCode,
        operator_code: operator.code,
        owner_charge: 'CUSTOMER',
      })

      if (paymentResult.status === 'FAILED' || !paymentResult.reference_id) {
        subscription.status = 'cancelled'
        subscription.paymentStatus = 'FAILED'
        await subscription.save()
        return response.status(400).json({ success: false, message: 'Paiement échoué', error: paymentResult.message })
      }

      subscription.paymentReferenceId = paymentResult.reference_id
      subscription.paymentStatus = 'PENDING'
      await subscription.save()

      return response.status(201).json({
        success: true,
        message: `⏳ Paiement ${operator.name} initié. Vérifiez votre téléphone.`,
        data: { subscriptionId: subscription.id, type: subscriptionType, plan: planConfig.name, price: planConfig.price, paymentReferenceId: paymentResult.reference_id, operator: { name: operator.name, code: operator.code }, status: 'pending_payment' },
      })
    } catch (error: any) {
      return response.status(500).json({ success: false, message: 'Erreur lors de la souscription', error: error.message })
    }
  }

  async checkPaymentStatus({ params, response }: HttpContext) {
    const subscription: any = await Subscription.find(params.id)
    if (!subscription) return response.status(404).json({ success: false, message: 'Abonnement introuvable' })

    if (subscription.status === 'active') {
      return response.json({ success: true, message: '✅ Abonnement déjà actif', data: { status: 'SUCCESS', subscription: { id: subscription.id, type: subscription.subscriptionType, plan: subscription.planName, remainingDays: subscription.remainingDays } } })
    }

    if (!subscription.paymentReferenceId) {
      return response.json({ success: false, message: 'Aucune référence de paiement', data: { status: 'UNKNOWN' } })
    }

    try {
      const paymentStatus: any = await MypvitTransactionService.checkTransactionStatus(subscription.paymentReferenceId, `SUB-${subscription.id}`)
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

        return response.json({ success: true, message: '✅ Paiement confirmé ! Boost activé.', data: { status: 'SUCCESS', subscription: { id: subscription.id, type: subscription.subscriptionType, plan: subscription.planName, remainingDays: subscription.remainingDays } } })
      } else if (status === 'FAILED') {
        subscription.status = 'cancelled'
        subscription.paymentStatus = 'FAILED'
        await subscription.save()
        return response.json({ success: false, message: '❌ Paiement échoué', data: { status: 'FAILED' } })
      } else {
        return response.json({ success: true, message: '⏳ Paiement en attente', data: { status: 'PENDING' }, is_pending: true })
      }
    } catch (error: any) {
      return response.status(500).json({ success: false, message: 'Erreur de vérification', error: error.message })
    }
  }

  async addProductToBoost({ params, request, response }: HttpContext) {
    const { userId, productId } = request.only(['userId', 'productId'])
    const user = await this.getMerchantById(userId, response)
    if (!user) return

    const subscription: any = await Subscription.find(params.id)
    if (!subscription || subscription.userId !== user.id) return response.status(404).json({ success: false, message: 'Abonnement introuvable' })
    if (!subscription.isActive) return response.status(400).json({ success: false, message: 'Abonnement inactif' })

    const product = await Product.find(productId)
    if (!product || product.user_id !== user.id) return response.status(400).json({ success: false, message: 'Produit invalide' })

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

    return response.json({ success: true, message: '✅ Produit ajouté au boost', data: { boostedCount: subscription.boostedProductsCount, maxProducts: subscription.maxProducts, remaining: subscription.maxProducts - subscription.boostedProductsCount } })
  }

  async removeProductFromBoost({ params, request, response }: HttpContext) {
    const { userId, productId } = request.only(['userId', 'productId'])
    const user = await this.getMerchantById(userId, response)
    if (!user) return

    const subscription: any = await Subscription.find(params.id)
    if (!subscription || subscription.userId !== user.id) return response.status(404).json({ success: false, message: 'Abonnement introuvable' })

    const product = await Product.find(productId)
    if (product) await product.deactivateBoost()

    subscription.boostedProductsCount = Math.max(0, subscription.boostedProductsCount - 1)
    await subscription.save()

    return response.json({ success: true, message: 'Produit retiré du boost', data: { boostedCount: subscription.boostedProductsCount } })
  }

  async getHistory({ params, response }: HttpContext) {
    const user = await this.getMerchantById(params.userId, response)
    if (!user) return

    const subscriptions: any[] = await Subscription.query().where('userId', user.id).orderBy('createdAt', 'desc').limit(50)

    return response.json({
      success: true,
      data: subscriptions.map((sub: any) => ({ id: sub.id, type: sub.subscriptionType, plan: sub.planName, price: sub.price, status: sub.status, productName: sub.product?.name || 'Tous les produits', startDate: sub.startDate, endDate: sub.endDate, remainingDays: sub.remainingDays, totalViews: sub.totalViews, totalClicks: sub.totalClicks })),
    })
  }

  async cancel({ params, request, response }: HttpContext) {
    const { userId } = request.only(['userId'])
    const user = await this.getMerchantById(userId, response)
    if (!user) return

    const subscription: any = await Subscription.find(params.id)
    if (!subscription || subscription.userId !== user.id) return response.status(404).json({ success: false, message: 'Abonnement introuvable' })
    if (!subscription.isActive) return response.status(400).json({ success: false, message: 'Abonnement inactif' })

    await subscription.cancel()
    return response.json({ success: true, message: 'Abonnement annulé' })
  }

  async toggleAutoRenew({ params, request, response }: HttpContext) {
    const { userId } = request.only(['userId'])
    const user = await this.getMerchantById(userId, response)
    if (!user) return

    const subscription: any = await Subscription.find(params.id)
    if (!subscription || subscription.userId !== user.id) return response.status(404).json({ success: false, message: 'Abonnement introuvable' })

    subscription.autoRenew = !subscription.autoRenew
    await subscription.save()
    return response.json({ success: true, message: subscription.autoRenew ? 'Renouvellement automatique activé' : 'Renouvellement automatique désactivé' })
  }

  async getStats({ params, response }: HttpContext) {
    const user = await this.getMerchantById(params.userId, response)
    if (!user) return

    const activeSubscriptions: any[] = await Subscription.query().where('userId', user.id).where('status', 'active').where('endDate', '>', DateTime.now().toSQL())

    const globalSub = activeSubscriptions.find((sub: any) => sub.subscriptionType === 'all_products')
    const productSubs = activeSubscriptions.filter((sub: any) => sub.subscriptionType === 'single_product')
    const totalViews = activeSubscriptions.reduce((sum: number, sub: any) => sum + (sub.totalViews || 0), 0)
    const totalClicks = activeSubscriptions.reduce((sum: number, sub: any) => sum + (sub.totalClicks || 0), 0)

    return response.json({
      success: true,
      data: {
        activeSubscriptionsCount: activeSubscriptions.length,
        globalSubscription: globalSub ? { id: globalSub.id, plan: globalSub.planName, remainingDays: globalSub.remainingDays, boostedProductsCount: globalSub.boostedProductsCount, totalViews: globalSub.totalViews, totalClicks: globalSub.totalClicks } : null,
        productSubscriptions: productSubs.map((sub: any) => ({ id: sub.id, plan: sub.planName, productName: sub.product?.name, remainingDays: sub.remainingDays, totalViews: sub.totalViews, totalClicks: sub.totalClicks })),
        totals: { views: totalViews, clicks: totalClicks, conversionRate: totalViews > 0 ? Math.round((totalClicks / totalViews) * 100) : 0 },
      },
    })
  }
}
