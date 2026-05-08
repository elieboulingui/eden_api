// app/controllers/PayQRCodeController.ts - DEBUG
import type { HttpContext } from '@adonisjs/core/http'
import Order from '#models/Order'
import OrderItem from '#models/OrderItem'
import OrderTracking from '#models/order_tracking'
import Cart from '#models/Cart'
import CartItem from '#models/CartItem'
import Product from '#models/Product'
import { DateTime } from 'luxon'
import MypvitSecretService from '../services/mypvit_secret_service.js'
import MypvitQRCodeService from '../services/mypvit_qrcode_service.js'

const CALLBACK_URL_CODE = '9ZOXW'

export default class PayQRCodeController {

  async pay({ request, response }: HttpContext) {
    console.log('📷 ========== START ==========')
    
    try {
      const rawBody = request.body() as Record<string, any>
      console.log('📦 BODY OK')

      const userId = rawBody.userId
      console.log('👤 userId:', userId)

      if (!userId) {
        return response.status(400).json({ success: false, message: 'userId requis' })
      }

      // ÉTAPE 1 : Cart
      console.log('🛒 ÉTAPE 1: Recherche Cart...')
      const cart = await Cart.query().where('user_id', userId).preload('items').first()
      console.log('🛒 Cart trouvé:', cart ? 'OUI' : 'NON')

      if (!cart) {
        return response.status(400).json({ success: false, message: 'Aucun panier' })
      }

      console.log('🛒 Items:', cart.items?.length || 0)

      if (!cart.items || cart.items.length === 0) {
        return response.status(400).json({ success: false, message: 'Panier vide' })
      }

      // ÉTAPE 2 : Produits
      let subtotal = 0
      for (const item of cart.items) {
        console.log('🔍 ÉTAPE 2: Produit', item.product_id)
        const product = await Product.find(item.product_id)
        console.log('🔍 Trouvé:', product ? product.name : 'NON')
        if (product) {
          subtotal += product.price * item.quantity
        }
      }

      console.log('💰 Sous-total:', subtotal)

      // ÉTAPE 3 : Vider panier
      console.log('🗑️ ÉTAPE 3: Vidage panier...')
      await CartItem.query().where('cart_id', cart.id).delete()
      console.log('🗑️ Panier vidé')

      // ÉTAPE 4 : Commande
      console.log('📝 ÉTAPE 4: Création commande...')
      const order = await Order.create({
        user_id: userId,
        order_number: `CMD-${Date.now()}`,
        status: 'pending',
        total: subtotal,
        subtotal,
        shipping_cost: 0,
        delivery_method: 'pickup',
        customer_name: 'Client',
        customer_phone: rawBody.customerPhone || '060000000',
        payment_method: 'qr_code_gimac',
        customer_email: 'invite@email.com',
        shipping_address: 'Retrait en magasin',
        payment_operator_simple: 'GIMAC'
      })
      console.log('📝 Commande:', order.id)

      // ÉTAPE 5 : OrderItems
      console.log('📦 ÉTAPE 5: OrderItems...')
      for (const item of cart.items) {
        const product = await Product.find(item.product_id)
        if (product) {
          await OrderItem.create({
            order_id: order.id,
            product_id: product.id,
            product_name: product.name,
            price: product.price,
            quantity: item.quantity,
            subtotal: product.price * item.quantity
          })
        }
      }
      console.log('📦 OrderItems OK')

      // ÉTAPE 6 : Tracking
      console.log('📊 ÉTAPE 6: Tracking...')
      await OrderTracking.create({
        order_id: order.id,
        status: 'pending',
        description: 'QR Code GIMAC',
        tracked_at: DateTime.now(),
      })
      console.log('📊 Tracking OK')

      // ÉTAPE 7 : QR Code
      console.log('🔑 ÉTAPE 7: QR Code...')
      await MypvitSecretService.forceRenewal('060000000').catch(() => {})
      
      const qrResult = await MypvitQRCodeService.generateQRCode({
        accountOperationCode: 'ACC_69FE0E1BC34B4',
        terminalId: `T${Date.now().toString(36).toUpperCase()}`,
        callbackUrlCode: CALLBACK_URL_CODE,
        amount: subtotal,
        reference: order.order_number,
        phoneNumber: '060000000'
      })
      console.log('🔑 QR Code OK')

      return response.status(201).json({
        success: true,
        message: '✅ OK',
        data: {
          orderId: order.id,
          orderNumber: order.order_number,
          total: subtotal,
          qr_code: { data: qrResult.data, reference_id: qrResult.reference_id, amount: subtotal }
        }
      })

    } catch (error: any) {
      console.error('🔴 ERREUR:', error.message)
      console.error('🔴 STACK:', error.stack)
      return response.status(500).json({
        success: false,
        message: 'Erreur: ' + error.message,
        error: error.message
      })
    }
  }
}
