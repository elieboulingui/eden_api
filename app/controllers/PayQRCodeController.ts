// app/controllers/PayQRCodeController.ts - GIMAC UNIQUEMENT
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

  // 🏦 GIMAC uniquement
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
        items
      } = rawBody

      const phoneNumber = customerAccountNumber || customerPhone || '060000000'
      const operatorInfo = this.getOperatorInfo()
      const hasDirectItems = items && Array.isArray(items) && items.length > 0

      console.log(`📱 Téléphone: ${phoneNumber}`)
      console.log(`🏦 Opérateur: ${operatorInfo.name}`)
      console.log(`📦 Items: ${hasDirectItems ? items.length : 'NON'}`)

      // ============================================================
      // VALIDATION DES PRODUITS
      // ============================================================
      let subtotal = 0
      let validProducts: any[] = []

      if (hasDirectItems) {
        console.log('📦 Mode: ITEMS DIRECTS')

        for (const item of items) {
          const productId = item.productId || item.id
          const qty = item.quantity || 1

          if (!productId) {
            return response.status(400).json({
              success: false,
              message: 'Item sans ID produit',
              error: 'INVALID_ITEM'
            })
          }

          const product = await Product.findBy('id', productId)

          console.log(`🔍 Produit ${productId}:`, product ? {
            name: product.name,
            stock: product.stock,
            isArchived: product.isArchived
          } : 'INTROUVABLE')

          if (!product) {
            return response.status(400).json({
              success: false,
              message: 'Produit introuvable',
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
          if (product.stock < qty) {
            return response.status(400).json({
              success: false,
              message: `Stock insuffisant pour ${product.name}: ${product.stock} disponible(s), ${qty} demandé(s)`,
              error: 'INSUFFICIENT_STOCK'
            })
          }

          subtotal += product.price * qty
          validProducts.push({ productId, quantity: qty, product })
          console.log(`✅ ${product.name}: OK (stock: ${product.stock})`)
        }

      } else if (userId) {
        console.log('🛒 Mode: PANIER pour userId:', userId)

        const cart = await Cart.query()
          .where('user_id', userId)
          .preload('items')
          .first()

        if (!cart || !cart.items || cart.items.length === 0) {
          return response.status(400).json({
            success: false,
            message: 'Votre panier est vide',
            error: 'EMPTY_CART'
          })
        }

        for (const cartItem of cart.items) {
          const product = await Product.findBy('id', cartItem.product_id)

          if (!product || product.isArchived || product.stock < cartItem.quantity) {
            return response.status(400).json({
              success: false,
              message: 'Produit indisponible',
              error: 'PRODUCT_UNAVAILABLE'
            })
          }

          subtotal += product.price * cartItem.quantity
          validProducts.push({ productId: cartItem.product_id, quantity: cartItem.quantity, product })
        }

        await CartItem.query().where('cart_id', cart.id).delete()
        console.log('🛒 Panier vidé')

      } else {
        return response.status(400).json({
          success: false,
          message: 'Aucun article à commander',
          error: 'NO_ITEMS'
        })
      }

      console.log(`✅ ${validProducts.length} produits validés, Sous-total: ${subtotal} FCFA`)

      // ============================================================
      // GÉRER L'UTILISATEUR
      // ============================================================
      let finalUserId = userId

      if (!finalUserId) {
        const email = customerEmail || `guest_${Date.now()}@guest.com`
        let user = await User.findBy('email', email)
        if (!user) {
          user = await User.create({
            id: crypto.randomUUID(),
            email,
            full_name: customerName || 'Client',
            phone: phoneNumber,
            role: 'client',
            password: generateRandomPassword(),
          })
        }
        finalUserId = user.id
      }

      // ============================================================
      // CRÉER LA COMMANDE
      // ============================================================
      const shippingCost = deliveryPrice || 0
      const total = subtotal + shippingCost
      const orderNumber = generateOrderNumber()

      const order = await Order.create({
        user_id: finalUserId,
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
      for (const item of validProducts) {
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
      // TRACKING
      // ============================================================
      await OrderTracking.create({
        order_id: order.id,
        status: 'pending',
        description: `📷 QR Code GIMAC - ${validProducts.length} articles`,
        tracked_at: DateTime.now(),
      })

      // ============================================================
      // GÉNÉRER LE QR CODE
      // ============================================================
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
          itemsCount: validProducts.length,
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
