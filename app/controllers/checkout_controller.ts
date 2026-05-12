// app/controllers/checkout_controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import Cart from '#models/Cart'
import Product from '#models/Product'
import User from '#models/user'

export default class CheckoutController {
  
  async getCheckoutData({ params, request, response }: HttpContext) {
    try {
      const userId = params.userId
      const deliveryZone = request.input('quartier') || request.input('deliveryZone') || ''

      // 1. PANIER
      const cart = await Cart.query()
        .where('user_id', userId)
        .preload('items')
        .first()

      if (!cart || !cart.items?.length) {
        return response.json({ success: true, data: { items: [], marchands: [], subtotal: 0, totalLivraison: 0, total: 0 } })
      }

      // 2. PRODUITS + MARCHANDS
      let subtotal = 0
      const marchands: Record<string, any> = {}
      const items: any[] = []

      for (const item of cart.items) {
        const product = await Product.query()
          .where('id', item.product_id)
          .preload('user')
          .first()

        if (!product) continue

        const lineTotal = product.price * item.quantity
        subtotal += lineTotal
        const mid = product.user_id
        const mName = product.user?.full_name || 'Marchand'

        items.push({
          cartItemId: item.id, productId: product.id, name: product.name,
          price: product.price, quantity: item.quantity, subtotal: lineTotal,
          image: product.image_url || null, marchandId: mid, marchandName: mName
        })

        if (mid) {
          if (!marchands[mid]) marchands[mid] = { marchandId: mid, marchandName: mName, produits: [], fraisLivraison: 0 }
          marchands[mid].produits.push({ productId: product.id, name: product.name, price: product.price, quantity: item.quantity })
        }
      }

      // 3. FRAIS LIVRAISON
      let totalLivraison = 0
      if (deliveryZone) {
        for (const mid of Object.keys(marchands)) {
          const user = await User.find(mid)
          if (user?.delivery_zones) {
            const fee = user.getDeliveryFee(deliveryZone)
            marchands[mid].fraisLivraison = fee
            totalLivraison += fee
          }
        }
      }

      return response.json({
        success: true,
        data: {
          cartId: cart.id,
          items,
          marchands: Object.values(marchands),
          subtotal,
          totalLivraison,
          total: subtotal + totalLivraison
        }
      })

    } catch (error) {
      return response.status(500).json({ success: false, message: error.message })
    }
  }
}
