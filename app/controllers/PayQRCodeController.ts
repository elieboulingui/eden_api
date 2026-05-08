// app/controllers/PayQRCodeController.ts - PANIER UNIQUEMENT
import type { HttpContext } from '@adonisjs/core/http'
import Order from '#models/Order'
import OrderItem from '#models/OrderItem'
import OrderTracking from '#models/order_tracking'
import Cart from '#models/Cart'
import CartItem from '#models/CartItem'
import User from '#models/user'
import Product from '#models/Product'
import { DateTime } from 'luxon'
import crypto from 'node:crypto'
import MypvitSecretService from '../services/mypvit_secret_service.js'
import MypvitQRCodeService from '../services/mypvit_qrcode_service.js'

const CALLBACK_URL_CODE = '9ZOXW'

function generateOrderNumber(): string {
  return `CMD-${Date.now()}-${Math.floor(Math.random() * 1000)}`
}

function generateRandomPassword(): string {
  return crypto.randomBytes(16).toString('hex')
}

export default class PayQRCodeController {

  private getOperatorInfo(): { name: string; code: string; accountCode: string } {
    return { name: 'GIMAC', code: 'GIMAC_PAY', accountCode: 'ACC_69FE0E1BC34B4' }
  }

  async pay({ request, response }: HttpContext) {
    console.log('📷 ========== PAIEMENT QR CODE ==========')

    try {
      const rawBody = request.body() as Record<string, any>
      console.log('📦 BODY:', JSON.stringify(rawBody, null, 2))

      const {
        userId,
        customerAccountNumber,
        customerPhone,
        customerName,
        customerEmail,
        shippingAddress,
        deliveryMethod,
        deliveryPrice,
      } = rawBody

      // ❌ IGNORE complètement rawBody.items
      const phoneNumber = customerAccountNumber || customerPhone || '060000000'
      const operatorInfo = this.getOperatorInfo()

      console.log(`📱 Téléphone: ${phoneNumber}`)
      console.log(`👤 userId: ${userId || 'NON'}`)

      // ============================================================
      // 🛒 TOUJOURS CHERCHER DANS LE PANIER
      // ============================================================
      if (!userId) {
        return response.status(400).json({
          success: false,
          message: 'userId requis pour récupérer le panier',
          error: 'USER_ID_REQUIRED'
        })
      }

      console.log('🛒 Recherche du panier pour userId:', userId)

      const cart = await Cart.query()
        .where('user_id', userId)
        .preload('items')
        .first()

      if (!cart || !cart.items || cart.items.length === 0) {
        return response.status(400).json({
          success: false,
          message: 'Votre panier est vide. Ajoutez des articles avant de payer.',
          error: 'EMPTY_CART'
        })
      }

      console.log(`🛒 Panier trouvé avec ${cart.items.length} articles`)

      // ============================================================
      // VALIDER LES PRODUITS DU PANIER
      // ============================================================
      let subtotal = 0
      const productsToOrder: { productId: string; quantity: number; product: Product }[] = []

      for (const cartItem of cart.items) {
        const product = await Product.findBy('id', cartItem.product_id)

        console.log(`🔍 ${cartItem.product_id}:`, product ? `${product.name} (stock: ${product.stock})` : 'INTROUVABLE')

        if (!product) {
          return response.status(400).json({
            success: false,
            message: `Produit ${cartItem.product_id} introuvable`,
            error: 'PRODUCT_NOT_FOUND'
          })
        }
        if (product.isArchived) {
          return response.status(400).json({
            success: false,
            message: `${product.name} n'est plus disponible`,
            error: 'PRODUCT_ARCHIVED'
          })
        }
        if (product.stock < cartItem.quantity) {
          return response.status(400).json({
            success: false,
            message: `Stock insuffisant pour ${product.name}: ${product.stock} < ${cartItem.quantity}`,
            error: 'INSUFFICIENT_STOCK'
          })
        }

        subtotal += product.price * cartItem.quantity
        productsToOrder.push({ productId: cartItem.product_id, quantity: cartItem.quantity, product })
        console.log(`✅ ${product.name}: OK`)
      }

      console.log(`✅ ${productsToOrder.length} produits validés, Sous-total: ${subtotal} FCFA`)

      // ============================================================
      // VIDER LE PANIER
      // ============================================================
      await CartItem.query().where('cart_id', cart.id).delete()
      console.log('🛒 Panier vidé')

      // ============================================================
      // CRÉER LA COMMANDE
      // ============================================================
      const shippingCost = deliveryPrice || 0
      const total = subtotal + shippingCost
      const orderNumber = generateOrderNumber()

      const order = await Order.create({
        user_id: userId,
        order_number: orderNumber,
        status: 'pending',
        total,
        subtotal,
        shipping_cost: shippingCost,
        delivery_method: deliveryMethod || 'pickup',
        customer_name: customerName || 'Client',
        customer_phone: phoneNumber,
        payment_method: 'qr_code_gimac',
        customer_email: customerEmail || 'invite@email.com',
        shipping_address: shippingAddress || 'Retrait en magasin',
        payment_operator_simple: 'GIMAC'
      })

      console.log('✅ Commande créée:', order.id)

      // ============================================================
      // CRÉER LES ORDER ITEMS
      // ============================================================
      for (const item of productsToOrder) {
        await OrderItem.create({
          order_id: order.id,
          product_id: item.productId,
          product_name: item.product.name,
          price: item.product.price,
          quantity: item.quantity,
          subtotal: item.product.price * item.quantity
        })
      }

      // ============================================================
      // TRACKING + QR CODE
      // ============================================================
      await OrderTracking.create({
        order_id: order.id,
        status: 'pending',
        description: `📷 QR Code GIMAC - ${productsToOrder.length} articles`,
        tracked_at: DateTime.now(),
      })

      const terminalId = `T${Date.now().toString(36).toUpperCase()}`

      try {
        await MypvitSecretService.forceRenewal(phoneNumber)
        await new Promise(resolve => setTimeout(resolve, 1000))
      } catch (e: any) {
        console.error('⚠️ Erreur secret:', e.message)
      }

      const qrResult = await MypvitQRCodeService.generateQRCode({
        accountOperationCode: operatorInfo.accountCode,
        terminalId,
        callbackUrlCode: CALLBACK_URL_CODE,
        amount: total,
        reference: order.order_number,
        phoneNumber
      })

      if (qrResult.reference_id) {
        order.payment_reference_id = qrResult.reference_id
        order.status = 'pending_payment'
        await order.save()
      }

      await OrderTracking.create({
        order_id: order.id,
        status: 'pending_payment',
        description: `📱 QR Code GIMAC - Réf: ${qrResult.reference_id || order.order_number}`,
        tracked_at: DateTime.now(),
      })

      await order.load('items')

      return response.status(201).json({
        success: true,
        message: '✅ QR Code GIMAC généré !',
        data: {
          orderId: order.id,
          orderNumber: order.order_number,
          total,
          status: 'pending_payment',
          itemsCount: productsToOrder.length,
          qr_code: {
            data: qrResult.data,
            reference_id: qrResult.reference_id,
            amount: total,
          }
        }
      })

    } catch (error: any) {
      console.error('🔴 ERREUR:', error.message)
      return response.status(500).json({
        success: false,
        message: 'Erreur interne',
        error: error.message
      })
    }
  }
}
