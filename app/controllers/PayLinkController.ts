// app/controllers/PayLinkController.ts

import type { HttpContext } from '@adonisjs/core/http'
import Order from '#models/Order'
import OrderItem from '#models/OrderItem'
import OrderTracking from '#models/order_tracking'
import Cart from '#models/Cart'
import CartItem from '#models/CartItem'
import User from '#models/user'
import Product from '#models/Product'
import { DateTime } from 'luxon'

export default class PayLinkController {
  
  async createPaymentLink({ request, response }: HttpContext) {
    console.log('\n')
    console.log('🔗 ========== PAYMENT LINK CREATION START ==========')
    console.log('🔗 ================================================')
    console.log('[TIMESTAMP]', new Date().toISOString())

    try {
      // 1. Récupération du payload
      console.log('[STEP 1] Récupération du payload...')
      const payload = request.only([
        'userId',
        'customerAccountNumber',
        'shippingAddress',
        'deliveryMethod',
        'deliveryPrice',
        'customerName',
        'customerEmail',
        'customerPhone',
        'agent'
      ])

      console.log('[PAYLOAD] Contenu complet:', JSON.stringify(payload, null, 2))

      const userId = payload.userId
      const phoneNumber = payload.customerAccountNumber || payload.customerPhone

      console.log('[STEP 2] Extraction données:')
      console.log('  - userId:', userId)
      console.log('  - phoneNumber (selected):', phoneNumber)

      if (!userId || !phoneNumber) {
        console.log('[ERROR] ❌ userId ou phoneNumber manquant')
        return response.badRequest({
          success: false,
          message: 'userId ou phone manquant'
        })
      }
      console.log('[STEP 2] ✅ userId et phoneNumber présents')

      // 3. Vérification du panier
      console.log('[STEP 3] Vérification du panier...')
      const cart = await Cart.query()
        .where('user_id', userId)
        .preload('items')
        .first()

      console.log('[CART] Panier trouvé:', !!cart)
      if (cart) {
        console.log('[CART] ID panier:', cart.id)
        console.log('[CART] Nombre articles:', cart.items?.length || 0)
      }

      // ✅ CORRECTION ICI - Ligne 510
      // Au lieu de: if (!cart || !cart.items > 0)
      // Utilisez:
      if (!cart || !cart.items || cart.items.length === 0) {
        console.log('[ERROR] ❌ Panier vide')
        return response.badRequest({
          success: false,
          message: 'Panier vide'
        })
      }
      console.log('[STEP 3] ✅ Panier valide, articles:', cart.items.length)

      // 4. Vérification des stocks
      console.log('[STEP 4] Vérification des stocks...')
      const stockErrors: string[] = []
      
      for (const item of cart.items) {
        console.log(`[STOCK] Vérification produit: ${item.product_id}, quantité: ${item.quantity}`)
        const product = await Product.findBy('id', item.product_id)
        
        if (!product) {
          console.log(`[STOCK] ❌ Produit non trouvé: ${item.product_id}`)
          stockErrors.push(`Produit non trouvé`)
          continue
        }
        
        if (product.stock < item.quantity) {
          console.log(`[STOCK] ❌ Stock insuffisant pour ${product.name}: stock=${product.stock}, demandé=${item.quantity}`)
          stockErrors.push(`${product.name}: stock insuffisant (${product.stock} disponible, ${item.quantity} demandé)`)
        } else {
          console.log(`[STOCK] ✅ Stock OK pour ${product.name}`)
        }
      }
      
      // ✅ CORRECTION ICI - utiliser .length
      if (stockErrors.length > 0) {
        console.log('[ERROR] ❌ Erreurs de stock:', stockErrors)
        return response.badRequest({
          success: false,
          message: 'Stock insuffisant',
          errors: stockErrors
        })
      }
      console.log('[STEP 4] ✅ Stocks vérifiés avec succès')

      // 5. Récupération utilisateur
      console.log('[STEP 5] Récupération utilisateur...')
      const user = await User.findBy('id', userId)
      console.log('[USER] Trouvé:', !!user)
      if (user) {
        console.log('[USER] Nom:', user.full_name)
        console.log('[USER] Email:', user.email)
      }

      // 6. Calcul du total
      console.log('[STEP 6] Calcul du total...')
      let subtotal = 0
      
      for (const item of cart.items) {
        const product = await Product.findBy('id', item.product_id)
        if (product) {
          const itemTotal = Number(product.price) * Number(item.quantity)
          console.log(`  - ${product.name}: ${product.price} × ${item.quantity} = ${itemTotal}`)
          subtotal += itemTotal
        }
      }
      
      const shippingCost = Number(payload.deliveryPrice || 0)
      const total = subtotal + shippingCost
      
      console.log('[CALCUL] Subtotal:', subtotal)
      console.log('[CALCUL] Shipping cost:', shippingCost)
      console.log('[CALCUL] TOTAL:', total)

      // 7. Création de la commande
      console.log('[STEP 7] Création de la commande...')
      
      const order = await Order.create({
        user_id: userId,
        order_number: `LINK-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        status: 'pending' as const,
        total: total,
        subtotal: subtotal,
        shipping_cost: shippingCost,
        delivery_method: payload.deliveryMethod || 'standard',
        customer_name: user?.full_name || payload.customerName || 'Client',
        customer_phone: phoneNumber,
        payment_method: 'PAYMENT_LINK',
        payment_operator_simple: 'PAYMENT_LINK'
      })
      
      console.log('[ORDER] Commande créée:', order.id, order.order_number)
      
      // 8. Création des items de commande
      console.log('[STEP 8] Création des items de commande...')
      let itemsCount = 0
      
      for (const item of cart.items) {
        const product = await Product.findBy('id', item.product_id)
        if (product) {
          const totalPrice = Number(product.price) * Number(item.quantity)
          await OrderItem.create({
            order_id: order.id,
            product_id: product.id,
            product_name: product.name,
            price: product.price,
            quantity: item.quantity,
            subtotal: totalPrice
          })
          itemsCount++
          console.log(`  ✅ Item créé: ${product.name} x${item.quantity}`)
        }
      }
      
      console.log('[ITEMS] Nombre d\'items créés:', itemsCount)
      
      // 9. Création du tracking
      console.log('[STEP 9] Création du tracking...')
      await OrderTracking.create({
        order_id: order.id,
        status: 'pending',
        description: 'Lien de paiement généré',
        tracked_at: DateTime.now()
      })
      console.log('[TRACKING] ✅ Tracking créé')
      
      // 10. Vidage du panier
      console.log('[STEP 10] Vidage du panier...')
      const deletedCount = await CartItem.query().where('cart_id', cart.id).delete()
      console.log('[CART] Items supprimés:', deletedCount)
      
      // 11. Génération du lien de paiement (URL simulée)
      const paymentLink = `https://pay.example.com/${order.order_number}`
      
      console.log('✅ ========== PAYMENT LINK CREATED ========== ✅')
      console.log('🔗 ================================================\n')
      
      return response.ok({
        success: true,
        message: 'Lien de paiement créé avec succès',
        data: {
          orderId: order.id,
          orderNumber: order.order_number,
          paymentLink: paymentLink,
          total: total,
          itemsCount: itemsCount
        }
      })
      
    } catch (error: any) {
      console.log('\n')
      console.log('💥 ========== EXCEPTION CATCHED ========== 💥')
      console.log('[ERROR] Message:', error.message)
      console.log('[ERROR] Stack:', error.stack)
      console.log('💥 ======================================== 💥\n')
      
      return response.internalServerError({
        success: false,
        message: 'Erreur lors de la création du lien de paiement',
        error: error.message
      })
    }
  }
}
