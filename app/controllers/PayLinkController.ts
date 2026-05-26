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
  renewCodeUrl: '6JN5J6U0NBJGKDAQ',  // Pour /renew-secret
  linkCodeUrl: 'MTX1MTKQQCULKA3W'      // Pour /link
}

export default class PayLinkController {

  private async generatePaymentLink(
    amount: number,
    reference: string,
    phoneNumber: string
  ): Promise<any> {
    console.log('[GENERATE_LINK] ==========================================')
    console.log('[GENERATE_LINK] ========== DEBUT GENERATION LIEN ==========')
    console.log('[GENERATE_LINK] ==========================================')
    console.log('[GENERATE_LINK] amount:', amount)
    console.log('[GENERATE_LINK] reference:', reference)
    console.log('[GENERATE_LINK] phoneNumber:', phoneNumber)
    console.log('[GENERATE_LINK] phoneNumber type:', typeof phoneNumber)

    const service = 'WEB'
    console.log(`[GENERATE_LINK] Service utilisé: ${service}`)

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

    console.log('[GENERATE_LINK] Payload complet:', JSON.stringify(linkPayload, null, 2))

    console.log('[GENERATE_LINK] Appel de MypvitSecretService.getSecret()...')
    const secret = await MypvitSecretService.getSecret()
    console.log('[GENERATE_LINK] Secret récupéré, longueur:', secret?.length || 0)
    
    const apiUrl = `https://api.mypvit.pro/${GIMAC_CONFIG.linkCodeUrl}/link`
    console.log(`[GENERATE_LINK] URL API: ${apiUrl}`)
    console.log('[GENERATE_LINK] Headers:', {
      'Content-Type': 'application/json',
      'X-Secret': secret ? '***' : 'null',
      'X-Callback-MediaType': 'application/json',
    })
    
    console.log('[GENERATE_LINK] Envoi de la requête POST...')
    
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

    console.log('[GENERATE_LINK] ✅ Réponse reçue avec succès')
    console.log('[GENERATE_LINK] Status:', linkResponse.status)
    console.log('[GENERATE_LINK] Status text:', linkResponse.statusText)
    console.log('[GENERATE_LINK] Data:', JSON.stringify(linkResponse.data, null, 2))
    console.log('[GENERATE_LINK] URL générée:', linkResponse.data.url)
    console.log('[GENERATE_LINK] Reference ID:', linkResponse.data.merchant_reference_id)
    console.log('[GENERATE_LINK] ==========================================')
    console.log('[GENERATE_LINK] ========== FIN GENERATION LIEN ==========')
    console.log('[GENERATE_LINK] ==========================================')

    return linkResponse.data
  }

  async pay({ request, response }: HttpContext) {
    console.log('\n')
    console.log('💳 =========================================================')
    console.log('💳 ========== PAYMENT VIA LINK START (GIMAC) ==========')
    console.log('💳 =========================================================')
    console.log('[TIMESTAMP]', new Date().toISOString())
    console.log('[REQUEST] Method:', request.method())
    console.log('[REQUEST] URL:', request.url())
    console.log('[REQUEST] Headers:', JSON.stringify(request.headers(), null, 2))

    try {
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
      console.log('[PAYLOAD] userId:', payload.userId)
      console.log('[PAYLOAD] customerAccountNumber:', payload.customerAccountNumber)
      console.log('[PAYLOAD] customerPhone:', payload.customerPhone)
      console.log('[PAYLOAD] deliveryPrice:', payload.deliveryPrice)

      const userId = payload.userId
      const phoneNumber = payload.customerAccountNumber || payload.customerPhone

      console.log('[STEP 2] Données extraites:')
      console.log('  - userId:', userId)
      console.log('  - userId type:', typeof userId)
      console.log('  - phoneNumber:', phoneNumber)
      console.log('  - phoneNumber type:', typeof phoneNumber)

      if (!userId || !phoneNumber) {
        console.log('[ERROR] ❌ userId ou phoneNumber manquant')
        return response.badRequest({
          success: false,
          message: 'userId ou phone manquant'
        })
      }
      console.log('[STEP 2] ✅ userId et phoneNumber présents')

      console.log('[STEP 3] Configuration GIMAC:')
      console.log('  - Account Code:', GIMAC_CONFIG.accountCode)
      console.log('  - Renew Code URL:', GIMAC_CONFIG.renewCodeUrl)
      console.log('  - Link Code URL:', GIMAC_CONFIG.linkCodeUrl)

      console.log('[STEP 4] Vérification du panier...')
      console.log('[CART] Recherche du panier pour userId:', userId)
      const cart = await Cart.query()
        .where('user_id', userId)
        .preload('items')
        .first()

      console.log('[CART] Panier trouvé:', !!cart)
      if (cart) {
        console.log('[CART] ID:', cart.id)
        console.log('[CART] Nombre articles:', cart.items?.length || 0)
        if (cart.items && cart.items.length > 0) {
          console.log('[CART] Liste des articles:')
          cart.items.forEach((item, idx) => {
            console.log(`  [${idx + 1}] product_id: ${item.product_id}, quantity: ${item.quantity}`)
          })
        }
      } else {
        console.log('[CART] ❌ Aucun panier trouvé')
      }

      if (!cart || !cart.items || cart.items.length === 0) {
        console.log('[ERROR] ❌ Panier vide')
        return response.badRequest({
          success: false,
          message: 'Panier vide'
        })
      }
      console.log('[STEP 4] ✅ Panier valide')

      console.log('[STEP 5] Vérification des stocks...')
      for (const item of cart.items) {
        console.log(`[STOCK] Vérification produit ID: ${item.product_id}, quantité demandée: ${item.quantity}`)
        const product = await Product.findBy('id', item.product_id)
        
        if (!product) {
          console.log(`[STOCK] ❌ Produit non trouvé: ${item.product_id}`)
          return response.badRequest({
            success: false,
            message: `Produit non trouvé`
          })
        }
        
        console.log(`[STOCK] Produit: ${product.name}, stock disponible: ${product.stock}`)
        if (product.stock < item.quantity) {
          console.log(`[STOCK] ❌ Stock insuffisant pour ${product.name}`)
          return response.badRequest({
            success: false,
            message: `${product.name}: stock insuffisant`
          })
        }
        console.log(`[STOCK] ✅ Stock OK pour ${product.name}`)
      }
      console.log('[STEP 5] ✅ Stocks vérifiés')

      console.log('[STEP 6] Récupération utilisateur...')
      console.log('[USER] Recherche utilisateur ID:', userId)
      const user = await User.findBy('id', userId)
      console.log('[USER] Trouvé:', !!user)
      if (user) {
        console.log('[USER] ID:', user.id)
        console.log('[USER] Nom:', user.full_name)
        console.log('[USER] Email:', user.email)
        console.log('[USER] Téléphone:', user.phone)
      }

      console.log('[STEP 7] Calcul du total...')
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

      console.log('[STEP 8] Création de la commande...')
      const orderData = {
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
      }
      
      console.log('[ORDER] Données:', JSON.stringify(orderData, null, 2))
      
      const order = await Order.create(orderData)
      
      console.log('[ORDER] Commande créée avec succès:')
      console.log('  - ID:', order.id)
      console.log('  - Order number:', order.order_number)
      console.log('  - Total:', order.total)
      console.log('  - Status:', order.status)

      console.log('[STEP 9] Création des items de commande...')
      let itemsCount = 0
      
      for (const item of cart.items) {
        const product = await Product.findBy('id', item.product_id)
        if (product) {
          const totalPrice = Number(product.price) * Number(item.quantity)
          console.log(`[ITEM] Création: ${product.name} x${item.quantity} = ${totalPrice}`)
          await OrderItem.create({
            order_id: order.id,
            product_id: product.id,
            product_name: product.name,
            price: product.price,
            quantity: item.quantity,
            subtotal: totalPrice
          })
          itemsCount++
          console.log(`[ITEM] ✅ Item créé pour ${product.name}`)
        }
      }
      
      console.log('[ITEMS] Total items créés:', itemsCount)

      console.log('[STEP 10] Création du tracking...')
      const trackingData = {
        order_id: order.id,
        status: 'pending',
        description: 'Paiement via lien GIMAC généré',
        tracked_at: DateTime.now()
      }
      console.log('[TRACKING] Données:', JSON.stringify(trackingData, null, 2))
      
      await OrderTracking.create(trackingData)
      console.log('[TRACKING] ✅ Tracking créé')

      console.log('[STEP 11] Génération du lien de paiement...')
      const reference = `ORD-${order.id.substring(0, 8)}`
      console.log('[REFERENCE] Générée:', reference)

      const linkResult = await this.generatePaymentLink(
        total,
        reference,
        phoneNumber
      )

      console.log('[STEP 12] Mise à jour de la commande...')
      if (linkResult.merchant_reference_id) {
        console.log('[UPDATE] payment_reference_id:', linkResult.merchant_reference_id)
        order.payment_reference_id = linkResult.merchant_reference_id
        order.status = 'pending_payment' as const
        await order.save()
        console.log('[UPDATE] ✅ Commande mise à jour')
      } else {
        console.log('[UPDATE] ⚠️ Pas de merchant_reference_id reçu')
      }

      console.log('[STEP 13] Vidage du panier...')
      const deletedCount = await CartItem.query().where('cart_id', cart.id).delete()
      console.log('[CART] Items supprimés:', deletedCount)

      console.log('✅ =========================================================')
      console.log('✅ ========== PAYMENT LINK GENERATED SUCCESSFULLY ==========')
      console.log('✅ =========================================================\n')

      const responseData = {
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
      }
      
      console.log('[RESPONSE] Envoi de la réponse:', JSON.stringify(responseData, null, 2))
      
      return response.ok(responseData)
      
    } catch (error: any) {
      console.log('\n')
      console.log('💥 =========================================================')
      console.log('💥 ========== EXCEPTION CATCHED ========== 💥')
      console.log('💥 =========================================================')
      console.log('[ERROR] Message:', error.message)
      console.log('[ERROR] Stack:', error.stack)
      console.log('[ERROR] Name:', error.name)
      if (error.code) console.log('[ERROR] Code:', error.code)
      if (error.status) console.log('[ERROR] Status:', error.status)
      if (error.response) {
        console.log('[ERROR] Response data:', JSON.stringify(error.response.data, null, 2))
        console.log('[ERROR] Response status:', error.response.status)
        console.log('[ERROR] Response headers:', error.response.headers)
      }
      console.log('💥 =========================================================\n')
      
      return response.internalServerError({
        success: false,
        message: 'Erreur lors du paiement via lien',
        error: error.response?.data?.message || error.message
      })
    }
  }
}
