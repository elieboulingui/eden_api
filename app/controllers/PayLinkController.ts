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

      if (!cart || !cart.items || cart.items.length === 0) {  // ✅ CORRECTION: .length === 0 au lieu de comparer le tableau
        console.log('[ERROR] ❌ Panier vide')
        return response.badRequest({
          success: false,
          message: 'Panier vide'
        })
      }
      console.log('[STEP 3] ✅ Panier valide, articles:', cart.items.length)

      // 4. Vérification des stocks
      console.log('[STEP 4] Vérification des stocks...')
      const errors: string[] = []
      
      for (const item of cart.items) {
        console.log(`[STOCK] Vérification produit: ${item.product_id}, quantité: ${item.quantity}`)
        const product = await Product.findBy('id', item.product_id)
        
        if (!product) {
          console.log(`[STOCK] ❌ Produit non trouvé: ${item.product_id}`)
          errors.push(`Produit non trouvé`)
          continue
        }
        
        if (product.stock < item.quantity) {
          console.log(`[STOCK] ❌ Stock insuffisant pour ${product.name}: stock=${product.stock}, demandé=${item.quantity}`)
          errors.push(`${product.name}: stock insuffisant (${product.stock} disponible, ${item.quantity} demandé)`)
        } else {
          console.log(`[STOCK] ✅ Stock OK pour ${product.name}`)
        }
      }
      
      if (errors.length > 0) {  // ✅ CORRECTION: .length > 0 au lieu de errors > 0
        console.log('[ERROR] ❌ Erreurs de stock:', errors)
        return response.badRequest({
          success: false,
          message: 'Stock insuffisant',
          errors
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
      
      const shippingCost = Number(payload.deliveryPrice || 1)
      const total = subtotal + shippingCost
      
      console.log('[CALCUL] Subtotal:', subtotal)
      console.log('[CALCUL] Shipping cost:', shippingCost)
      console.log('[CALCUL] TOTAL:', total)

      // 7. Création du lien de paiement (simulé pour l'instant)
      console.log('[STEP 7] Création du lien de paiement...')
      
      const paymentLink = {
        url: `https://payment.mypvit.com/pay/${Date.now()}`,
        reference: `REF_LINK_${Date.now()}`,
        amount: total,
        expires_at: DateTime.now().plus({ hours: 24 }).toISO()
      }
      
      console.log('[PAYMENT_LINK] Lien créé:', paymentLink)
      
      // 8. Création de la commande
      console.log('[STEP 8] Création de la commande...')
      
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
        payment_operator_simple: 'PAYMENT_LINK',
        payment_reference_id: paymentLink.reference
      })
      
      console.log('[ORDER] Commande créée:', order.id, order.order_number)
      
      // 9. Création des items de commande
      console.log('[STEP 9] Création des items de commande...')
      let itemsCount = 0
      
      for (const item of cart.items) {
        const product = await Product.findBy('id', item.product_id)
        if (product) {
          const total = Number(product.price) * Number(item.quantity)
          await OrderItem.create({
            order_id: order.id,
            product_id: product.id,
            product_name: product.name,
            price: product.price,
            quantity: item.quantity,
            subtotal: total
          })
          itemsCount++
          console.log(`  ✅ Item créé: ${product.name} x${item.quantity}`)
        }
      }
      
      console.log('[ITEMS] Nombre d\'items créés:', itemsCount)
      
      // 10. Création du tracking
      console.log('[STEP 10] Création du tracking...')
      await OrderTracking.create({
        order_id: order.id,
        status: 'pending',
        description: 'Lien de paiement généré',
        tracked_at: DateTime.now()
      })
      console.log('[TRACKING] ✅ Tracking créé')
      
      // 11. Vidage du panier
      console.log('[STEP 11] Vidage du panier...')
      const deletedCount = await CartItem.query().where('cart_id', cart.id).delete()
      console.log('[CART] Items supprimés:', deletedCount)
      
      console.log('✅ ========== PAYMENT LINK CREATED ========== ✅')
      console.log('🔗 ================================================\n')
      
      return response.ok({
        success: true,
        paymentLink: paymentLink.url,
        reference: paymentLink.reference,
        orderId: order.id,
        total: total,
        expires_at: paymentLink.expires_at
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
  
  async verifyPayment({ request, response }: HttpContext) {
    console.log('\n')
    console.log('✅ ========== VERIFY PAYMENT START ==========')
    console.log('[TIMESTAMP]', new Date().toISOString())
    
    try {
      const payload = request.only(['reference', 'orderId'])
      console.log('[PAYLOAD]', payload)
      
      const { reference, orderId } = payload
      
      if (!reference && !orderId) {
        return response.badRequest({
          success: false,
          message: 'reference ou orderId requis'
        })
      }
      
      let order: Order | null = null
      
      if (reference) {
        order = await Order.findBy('payment_reference_id', reference)
      } else if (orderId) {
        order = await Order.find(orderId)
      }
      
      if (!order) {
        return response.notFound({
          success: false,
          message: 'Commande non trouvée'
        })
      }
      
      console.log('[ORDER] trouvée:', order.id, 'status:', order.status)
      
      // Simulation de vérification de paiement
      const isPaid = order.status === 'paid' || order.status === 'pending_payment'
      
      return response.ok({
        success: true,
        isPaid: isPaid,
        status: order.status,
        orderId: order.id
      })
      
    } catch (error: any) {
      console.log('[ERROR]', error.message)
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }
  
  async handlePaymentWebhook({ request, response }: HttpContext) {
    console.log('\n')
    console.log('📡 ========== WEBHOOK RECEIVED ==========')
    console.log('[TIMESTAMP]', new Date().toISOString())
    
    try {
      const webhookData = request.all()
      console.log('[WEBHOOK_DATA]', JSON.stringify(webhookData, null, 2))
      
      const { reference_id, status, transaction_id } = webhookData
      
      if (!reference_id) {
        console.log('[ERROR] Pas de reference_id dans le webhook')
        return response.badRequest({
          success: false,
          message: 'reference_id manquant'
        })
      }
      
      const order = await Order.findBy('payment_reference_id', reference_id)
      
      if (!order) {
        console.log('[ERROR] Commande non trouvée pour reference:', reference_id)
        return response.notFound({
          success: false,
          message: 'Commande non trouvée'
        })
      }
      
      console.log('[ORDER] trouvée:', order.id, 'ancien status:', order.status)
      
      // Mise à jour du statut
      if (status === 'SUCCESS' || status === 'COMPLETED') {
        order.status = 'paid' as const
        console.log('[UPDATE] Statut mis à jour: paid')
      } else if (status === 'PENDING') {
        order.status = 'pending_payment' as const
        console.log('[UPDATE] Statut mis à jour: pending_payment')
      } else if (status === 'FAILED') {
        order.status = 'payment_failed' as const
        console.log('[UPDATE] Statut mis à jour: payment_failed')
      }
      
      if (transaction_id) {
        order.payment_transaction_id = transaction_id
      }
      
      await order.save()
      
      // Création du tracking
      await OrderTracking.create({
        order_id: order.id,
        status: order.status,
        description: `Webhook reçu: ${status}`,
        tracked_at: DateTime.now()
      })
      
      console.log('[WEBHOOK] Traité avec succès')
      console.log('📡 ========== WEBHOOK PROCESSED ==========\n')
      
      return response.ok({
        success: true,
        message: 'Webhook traité avec succès'
      })
      
    } catch (error: any) {
      console.log('[ERROR]', error.message)
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }
}
