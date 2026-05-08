// app/controllers/PayQRCodeController.ts - GIMAC UNIQUEMENT
import type { HttpContext } from '@adonisjs/core/http'
import Order from '#models/Order'
import OrderItem from '#models/OrderItem'
import OrderTracking from '#models/order_tracking'
import Cart from '#models/Cart'
import CartItem from '#models/CartItem'
import Product from '#models/Product'
import { DateTime } from 'luxon'
import MypvitSecretService from '../services/mypvit_secret_services.js'
import MypvitQRCodeService from '../services/mypvit_qrcode_service.js'

const CALLBACK_URL_CODE = '9ZOXW'
const GIMAC_ACCOUNT = 'ACC_69FE0E1BC34B4'

export default class PayQRCodeController {

  async pay({ request, response }: HttpContext) {
    console.log('📷 ========== PAIEMENT QR CODE GIMAC ==========')
    
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

      if (!cart || !cart.items || cart.items.length === 0) {
        return response.status(400).json({ success: false, message: 'Panier vide' })
      }

      // Sauvegarder les items avant de vider le panier
      const cartItems = cart.items.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
      }))
      console.log('🛒 Items:', cartItems.length)

      // ÉTAPE 2 : Produits
      let subtotal = 0
      const validProducts: { product: Product; quantity: number }[] = []

      for (const cartItem of cartItems) {
        console.log('🔍 Produit:', cartItem.product_id)
        const product = await Product.find(cartItem.product_id)
        console.log('🔍 Trouvé:', product ? product.name : 'NON')
        
        if (!product) {
          return response.status(400).json({
            success: false,
            message: `Produit ${cartItem.product_id} introuvable`
          })
        }

        subtotal += product.price * cartItem.quantity
        validProducts.push({ product, quantity: cartItem.quantity })
      }

      console.log('💰 Sous-total:', subtotal)

      // ÉTAPE 3 : Commande
      console.log('📝 ÉTAPE 3: Création commande...')
      const order = await Order.create({
        user_id: userId,
        order_number: `CMD-${Date.now()}`,
        status: 'pending',
        total: subtotal,
        subtotal,
        shipping_cost: rawBody.deliveryPrice || 0,
        delivery_method: rawBody.deliveryMethod || 'pickup',
        customer_name: rawBody.customerName || 'Client',
        customer_phone: rawBody.customerPhone || rawBody.customerAccountNumber || '060000000',
        payment_method: 'qr_code_gimac',
        customer_email: rawBody.customerEmail || 'invite@email.com',
        shipping_address: rawBody.shippingAddress || 'Retrait en magasin',
        payment_operator_simple: 'GIMAC'
      })
      console.log('📝 Commande:', order.id)

      // ÉTAPE 4 : OrderItems
      console.log('📦 ÉTAPE 4: OrderItems...')
      for (const item of validProducts) {
        await OrderItem.create({
          order_id: order.id,
          product_id: item.product.id,
          product_name: item.product.name,
          price: item.product.price,
          quantity: item.quantity,
          subtotal: item.product.price * item.quantity
        })
      }
      console.log('📦 OrderItems OK')

      // ÉTAPE 5 : Vider panier (APRÈS les OrderItems !)
      console.log('🗑️ ÉTAPE 5: Vidage panier...')
      await CartItem.query().where('cart_id', cart.id).delete()
      console.log('🗑️ Panier vidé')

      // ÉTAPE 6 : Tracking
      console.log('📊 ÉTAPE 6: Tracking...')
      await OrderTracking.create({
        order_id: order.id,
        status: 'pending',
        description: `QR Code GIMAC - ${validProducts.length} articles`,
        tracked_at: DateTime.now(),
      })
      console.log('📊 Tracking OK')

      // ÉTAPE 7 : QR Code GIMAC
      console.log('🔑 ÉTAPE 7: QR Code GIMAC...')
      await MypvitSecretService.forceRenewal()
      
      const qrResult = await MypvitQRCodeService.generateQRCode({
        accountOperationCode: GIMAC_ACCOUNT,
        terminalId: `T${Date.now().toString(36).toUpperCase()}`,
        callbackUrlCode: CALLBACK_URL_CODE,
        amount: subtotal,
        reference: order.order_number,
        phoneNumber: '060000000'
      })
      console.log('🔑 QR Code OK')

      // ÉTAPE 8 : Sauvegarder la référence
      if (qrResult.reference_id) {
        order.payment_reference_id = qrResult.reference_id
        order.status = 'pending_payment'
        await order.save()
      }

      await OrderTracking.create({
        order_id: order.id,
        status: 'pending_payment',
        description: `QR Code GIMAC - Réf: ${qrResult.reference_id || order.order_number}`,
        tracked_at: DateTime.now(),
      })

      await order.load('items')

      return response.status(201).json({
        success: true,
        message: '✅ QR Code GIMAC généré !',
        data: {
          orderId: order.id,
          orderNumber: order.order_number,
          total: subtotal,
          status: 'pending_payment',
          itemsCount: validProducts.length,
          qr_code: {
            data: qrResult.data,
            reference_id: qrResult.reference_id,
            amount: subtotal,
            expires_in: 600,
          }
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
