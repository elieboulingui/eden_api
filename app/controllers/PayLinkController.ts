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
import MypvitSecretService from '../services/mypvit_secret_services.js'
import axios from 'axios'

const CALLBACK_URL_CODE = '9ZOXW'

// Configuration GIMAC
const GIMAC_CONFIG = {
  name: 'GIMAC',
  accountCode: 'ACC_69FE0E1BC34B4',
  // ⚠️ Attention: code différent pour renew-secret et link
  renewCodeUrl: '6JN5J6U0NBJGKDAQ',  // Pour /renew-secret
  linkCodeUrl: 'MTX1MTKQQCULKA3W'      // Pour /link
}

export default class PayLinkController {

  private async generatePaymentLink(
    amount: number,
    reference: string,
    phoneNumber: string
  ): Promise<any> {
    console.log('[GENERATE_LINK] ========== DEBUT ==========')
    console.log('[GENERATE_LINK] amount:', amount)
    console.log('[GENERATE_LINK] reference:', reference)
    console.log('[GENERATE_LINK] phoneNumber:', phoneNumber)

    // GIMAC utilise le service WEB
    const service = 'WEB'
    console.log(`[GENERATE_LINK] Service: ${service}`)

    const linkPayload = {
      amount: amount,
      product: reference.substring(0, 15),
      reference: `REF${Date.now()}`.substring(0, 15),
      service: service,
      callback_url_code: CALLBACK_URL_CODE,
      merchant_operation_account_code: GIMAC_CONFIG.accountCode,
      transaction_type: 'PAYMENT',
      owner_charge: 'CUSTOMER',
      success_redirection_url_code: 'W0L8C',
      failed_redirection_url_code: 'YTJEI',
      customer_account_number: phoneNumber
    }

    console.log('[GENERATE_LINK] Payload:', JSON.stringify(linkPayload, null, 2))

    const secret = await MypvitSecretService.getSecret()
    console.log('[GENERATE_LINK] Secret récupéré')
    
    // Utilisation du BON code URL pour link (MTX1MTKQQCULKA3W)
    const apiUrl = `https://api.mypvit.pro/${GIMAC_CONFIG.linkCodeUrl}/link`
    console.log(`[GENERATE_LINK] URL: ${apiUrl}`)
    
    const linkResponse = await axios.post(
      apiUrl,
      linkPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Secret': secret,
          'X-Callback-MediaType': 'application/json',
        },
        timeout: 30000
      }
    )

    console.log('[GENERATE_LINK] Réponse:', JSON.stringify(linkResponse.data, null, 2))
    console.log('[GENERATE_LINK] ========== FIN ==========')

    return linkResponse.data
  }

  async pay({ request, response }: HttpContext) {
    console.log('\n')
    console.log('💳 ========== PAYMENT VIA LINK (GIMAC) ==========')
    console.log('[TIMESTAMP]', new Date().toISOString())

    try {
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

      console.log('[PAYLOAD]', JSON.stringify(payload, null, 2))

      const userId = payload.userId
      const phoneNumber = payload.customerAccountNumber || payload.customerPhone

      if (!userId || !phoneNumber) {
        return response.badRequest({
          success: false,
          message: 'userId ou phone manquant'
        })
      }

      console.log('[GIMAC] Account Code:', GIMAC_CONFIG.accountCode)
      console.log('[GIMAC] Link Code URL:', GIMAC_CONFIG.linkCodeUrl)

      const cart = await Cart.query()
        .where('user_id', userId)
        .preload('items')
        .first()

      if (!cart || !cart.items || cart.items.length === 0) {
        return response.badRequest({
          success: false,
          message: 'Panier vide'
        })
      }

      // Vérification des stocks
      for (const item of cart.items) {
        const product = await Product.findBy('id', item.product_id)
        if (!product) {
          return response.badRequest({
            success: false,
            message: `Produit non trouvé`
          })
        }
        if (product.stock < item.quantity) {
          return response.badRequest({
            success: false,
            message: `${product.name}: stock insuffisant`
          })
        }
      }

      const user = await User.findBy('id', userId)
      
      let subtotal = 0
      for (const item of cart.items) {
        const product = await Product.findBy('id', item.product_id)
        if (product) {
          subtotal += Number(product.price) * Number(item.quantity)
        }
      }
      
      const shippingCost = Number(payload.deliveryPrice || 0)
      const total = subtotal + shippingCost

      console.log('[TOTAL]', total)

      // Création de la commande
      const order = await Order.create({
        user_id: userId,
        order_number: `PAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        status: 'pending' as const,
        total: total,
        subtotal: subtotal,
        shipping_cost: shippingCost,
        delivery_method: payload.deliveryMethod || 'standard',
        customer_name: user?.full_name || payload.customerName || 'Client',
        customer_phone: phoneNumber,
        customer_email: payload.customerEmail || user?.email,
        shipping_address: payload.shippingAddress,
        payment_method: 'gimac_web',
        payment_operator_simple: 'GIMAC'
      })
      
      console.log('[ORDER] Créée:', order.id)

      // Création des items
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
        }
      }
      
      console.log('[ITEMS] Créés:', itemsCount)

      await OrderTracking.create({
        order_id: order.id,
        status: 'pending',
        description: 'Paiement via lien GIMAC généré',
        tracked_at: DateTime.now()
      })
      
      const reference = `ORD-${order.id.substring(0, 8)}`

      // Génération du lien
      const linkResult = await this.generatePaymentLink(
        total,
        reference,
        phoneNumber
      )

      if (linkResult.merchant_reference_id) {
        order.payment_reference_id = linkResult.merchant_reference_id
        order.status = 'pending_payment' as const
        await order.save()
        console.log('[UPDATE] Reference_id:', linkResult.merchant_reference_id)
      }
      
      await CartItem.query().where('cart_id', cart.id).delete()
      
      return response.ok({
        success: true,
        message: `✅ Lien de paiement GIMAC généré avec succès !`,
        data: {
          orderId: order.id,
          orderNumber: order.order_number,
          total: total,
          itemsCount: itemsCount,
          customerName: order.customer_name,
          paymentMethod: 'gimac_web',
          operator: {
            name: 'GIMAC',
            accountCode: GIMAC_CONFIG.accountCode
          },
          link: {
            payment_url: linkResult.url,
            reference_id: linkResult.merchant_reference_id || reference,
            type: 'WEB',
            amount: total,
          },
        }
      })
      
    } catch (error: any) {
      console.error('[ERROR]', error.message)
      if (error.response) {
        console.error('[ERROR] Response:', JSON.stringify(error.response.data, null, 2))
        console.error('[ERROR] Status:', error.response.status)
      }
      
      return response.internalServerError({
        success: false,
        message: 'Erreur lors du paiement via lien',
        error: error.response?.data?.message || error.message
      })
    }
  }
}
