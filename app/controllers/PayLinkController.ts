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
const GIMAC_CODE_URL = 'MTX1MTKQQCULKA3W'
const GIMAC_ACCOUNT_CODE = 'ACC_69FE0E1BC34B4'

// Supprimé car plus utilisé - GIMAC utilise uniquement WEB
// const LINK_TYPES: Record<string, string> = {
//   'web': 'WEB',
//   'visa': 'VISA_MASTERCARD',
//   'rest': 'RESTLINK'
// }

export default class PayLinkController {

  private getGimacConfig() {
    console.log('[GET_GIMAC_CONFIG] ========== DEBUT ==========')
    console.log('[GET_GIMAC_CONFIG] name: GIMAC')
    console.log('[GET_GIMAC_CONFIG] code: GIMAC_PAY')
    console.log('[GET_GIMAC_CONFIG] accountCode:', GIMAC_ACCOUNT_CODE)
    console.log('[GET_GIMAC_CONFIG] codeUrl:', GIMAC_CODE_URL)
    console.log('[GET_GIMAC_CONFIG] ========== FIN ==========')
    
    return {
      name: 'GIMAC',
      code: 'GIMAC_PAY',
      accountCode: GIMAC_ACCOUNT_CODE,
      codeUrl: GIMAC_CODE_URL
    }
  }

  private async renewSecretIfNeeded(): Promise<void> {
    console.log('[RENEW_SECRET] ========== DEBUT ==========')
    console.log('[RENEW_SECRET] Tentative de renouvellement du secret GIMAC...')
    
    try {
      console.log('[RENEW_SECRET] Appel de MypvitSecretService.renewSecret()...')
      await MypvitSecretService.renewSecret()
      console.log('[RENEW_SECRET] ✅ Secret renouvelé avec succès')
    } catch (error: any) {
      console.log('[RENEW_SECRET] ❌ Erreur renouvellement:', error.message)
    }
    console.log('[RENEW_SECRET] ========== FIN ==========')
  }

  private async generatePaymentLink(
    amount: number,
    reference: string,
    phoneNumber: string
  ): Promise<any> {
    console.log('[GENERATE_LINK] ========== DEBUT ==========')
    console.log('[GENERATE_LINK] Paramètres reçus:')
    console.log('[GENERATE_LINK]   - amount:', amount)
    console.log('[GENERATE_LINK]   - reference:', reference)
    console.log('[GENERATE_LINK]   - phoneNumber:', phoneNumber)

    const gimacConfig = this.getGimacConfig()
    
    // GIMAC supporte uniquement WEB
    const finalService = 'WEB'
    console.log(`[GENERATE_LINK] 🔑 Service: ${finalService}`)

    const linkPayload: any = {
      amount: amount,
      product: reference.substring(0, 15),
      reference: `REF${Date.now()}`.substring(0, 15),
      service: finalService,
      callback_url_code: CALLBACK_URL_CODE,
      merchant_operation_account_code: gimacConfig.accountCode,
      transaction_type: 'PAYMENT',
      owner_charge: 'CUSTOMER',
      success_redirection_url_code: 'W0L8C',
      failed_redirection_url_code: 'YTJEI',
    }

    // Pour WEB, customer_account_number est optionnel mais peut être fourni
    if (phoneNumber) {
      linkPayload.customer_account_number = phoneNumber
      console.log('[GENERATE_LINK] ✅ Téléphone ajouté')
    }

    console.log('[GENERATE_LINK] 📤 Payload:', JSON.stringify(linkPayload, null, 2))

    console.log('[GENERATE_LINK] Appel de MypvitSecretService.getSecret()...')
    const secret = await MypvitSecretService.getSecret()
    console.log('[GENERATE_LINK] ✅ Secret récupéré')
    
    const apiUrl = `https://api.mypvit.pro/${gimacConfig.codeUrl}/link`
    console.log(`[GENERATE_LINK] 🔗 URL: ${apiUrl}`)
    
    console.log('[GENERATE_LINK] Envoi de la requête POST...')
    
    try {
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

      console.log('[GENERATE_LINK] ✅ Réponse reçue')
      console.log('[GENERATE_LINK] Status:', linkResponse.status)
      console.log('[GENERATE_LINK] Data:', JSON.stringify(linkResponse.data, null, 2))
      console.log('[GENERATE_LINK] ✅ Lien généré:', linkResponse.data.url)
      
      console.log('[GENERATE_LINK] ========== FIN ==========')
      return linkResponse.data
      
    } catch (error: any) {
      console.log('[GENERATE_LINK] ❌ Erreur API:')
      console.log('[GENERATE_LINK] Message:', error.message)
      if (error.response) {
        console.log('[GENERATE_LINK] Response status:', error.response.status)
        console.log('[GENERATE_LINK] Response data:', JSON.stringify(error.response.data, null, 2))
      }
      console.log('[GENERATE_LINK] ========== FIN (ERREUR) ==========')
      throw error
    }
  }

  async pay({ request, response }: HttpContext) {
    console.log('\n')
    console.log('💳 ========== PAYMENT VIA LINK START (GIMAC) ==========')
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
        'agent',
        'linkType'
      ])

      console.log('[PAYLOAD]', JSON.stringify(payload, null, 2))

      const userId = payload.userId
      const phoneNumber = payload.customerAccountNumber || payload.customerPhone
      const linkType = payload.linkType || 'web'

      if (!userId || !phoneNumber) {
        console.log('[ERROR] ❌ userId ou phoneNumber manquant')
        return response.badRequest({
          success: false,
          message: 'userId ou phone manquant'
        })
      }

      console.log(`[LINK_TYPE] Type demandé par frontend: ${linkType}`)
      console.log(`[LINK_TYPE] ⚠️ GIMAC utilise uniquement WEB`)

      const cart = await Cart.query()
        .where('user_id', userId)
        .preload('items')
        .first()

      if (!cart || !cart.items || cart.items.length === 0) {
        console.log('[ERROR] ❌ Panier vide')
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

      await this.renewSecretIfNeeded()

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
        payment_method: `gimac_${linkType}`,
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
        description: `Paiement via lien GIMAC (type demandé: ${linkType}, type réel: WEB)`,
        tracked_at: DateTime.now()
      })
      
      const reference = `ORD-${order.id.substring(0, 8)}`

      // Génération du lien - GIMAC utilise uniquement WEB
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
      console.log('[CART] Vidé')
      
      return response.ok({
        success: true,
        message: `✅ Lien de paiement GIMAC généré avec succès !`,
        data: {
          orderId: order.id,
          orderNumber: order.order_number,
          total: total,
          itemsCount: itemsCount,
          customerName: order.customer_name,
          paymentMethod: `gimac_${linkType}`,
          operator: {
            name: 'GIMAC',
            code: 'GIMAC_PAY',
            accountCode: GIMAC_ACCOUNT_CODE
          },
          link: {
            payment_url: linkResult.url,
            reference_id: linkResult.merchant_reference_id || reference,
            type: 'WEB',
            requested_type: linkType,
            amount: total,
          },
        }
      })
      
    } catch (error: any) {
      console.error('[ERROR]', error.message)
      if (error.response) {
        console.error('[ERROR] Response:', error.response.data)
      }
      
      return response.internalServerError({
        success: false,
        message: 'Erreur lors du paiement via lien',
        error: error.response?.data?.message || error.message
      })
    }
  }
}
