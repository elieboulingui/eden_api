// app/services/BoostService.ts
import Subscription from '#models/Subscription'
import Product from '#models/Product'

export default class BoostService {

  static async activateBoostForMerchant(userId: string, subscriptionId: string): Promise<void> {
    const subscription = await Subscription.find(subscriptionId)
    if (!subscription) throw new Error('Abonnement introuvable')

    const products = await Product.query()
      .where('user_id', userId)
      .where('is_archived', false)
      .where('status', 'active')
      .limit(subscription.maxProducts)

    for (const product of products) {
      product.isBoosted = true
      product.boostMultiplier = subscription.boostMultiplier
      product.boostLevel = subscription.boostLevel as any
      product.boostBadge = subscription.badge
      product.boostPriority = subscription.boostMultiplier * 100
      product.boostStartDate = subscription.startDate
      product.boostEndDate = subscription.endDate
      await product.save()
    }

    subscription.boostedProductsCount = products.length
    await subscription.save()
    console.log(`🚀 Boost activé pour ${products.length} produits du marchand ${userId}`)
  }

  static async activateBoostForProduct(productId: string, subscription: Subscription): Promise<void> {
    const product = await Product.find(productId)
    if (!product) throw new Error('Produit introuvable')

    product.isBoosted = true
    product.boostMultiplier = subscription.boostMultiplier
    product.boostLevel = subscription.boostLevel as any
    product.boostBadge = subscription.badge
    product.boostPriority = subscription.boostMultiplier * 100
    product.boostStartDate = subscription.startDate
    product.boostEndDate = subscription.endDate
    await product.save()

    console.log(`🚀 Boost activé pour le produit ${productId}`)
  }

  static async deactivateBoostForMerchant(userId: string): Promise<void> {
    const products = await Product.query()
      .where('user_id', userId)
      .where('is_boosted', true)

    for (const product of products) {
      await product.deactivateBoost()
    }

    console.log(`🛑 Boost désactivé pour ${products.length} produits du marchand ${userId}`)
  }

  static async deactivateBoostForProduct(productId: string): Promise<void> {
    const product = await Product.find(productId)
    if (product) {
      await product.deactivateBoost()
    }
  }
}
