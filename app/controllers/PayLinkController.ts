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
import MypvitSecretService from '../services/mypvit_secret_service.js'
import axios from 'axios'

const CALLBACK_URL_CODE = '9ZOXW'
const GIMAC_CODE_URL = 'MTX1MTKQQCULKA3W'
const GIMAC_ACCOUNT_CODE = 'ACC_69FE0E1BC34B4'

const LINK_TYPES: Record<string, string> = {
  'web': 'WEB',
  'visa': 'VISA_MASTERCARD',
  'rest': 'RESTLINK'
}

export default class PayLinkController {

  // Configuration GIMAC uniquement
  private getGimacConfig() {
    console.log('[GIMAC_CONFIG] ========== DEBUT ==========')
    console.log('[GIMAC_CONFIG] name: GIMAC')
    console.log('[GIMAC_CONFIG] code: GIMAC_PAY')
    console.log('[GIMAC_CONFIG] accountCode:', GIMAC_ACCOUNT_CODE)
    console.log('[GIMAC_CONFIG] codeUrl:', GIMAC_CODE_URL)
    console.log('[GIMAC_CONFIG] ========== FIN ==========')
    
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
      console.log('[RENEW_SECRET] ✅ Clé GIMAC renouvelée avec succès')
    } catch (error: any) {
      console.log('[RENEW_SECRET] ❌ Erreur renouvellement secret GIMAC:', error.message)
      console.error('[RENEW_SECRET] Stack:', error.stack)
    }
    console.log('[RENEW_SECRET] ========== FIN ==========')
  }

  private async generatePaymentLink(
    amount: number,
    reference: string,
    linkTypeCode: string,
    phoneNumber: string
  ): Promise<any> {
    console.log('[GENERATE_LINK] ========== DEBUT ==========')
    console.log('[GENERATE_LINK] amount:', amount)
    console.log('[GENERATE_LINK] reference:', reference)
    console.log('[GENERATE_LINK] linkTypeCode:', linkTypeCode)
    console.log('[GENERATE_LINK] phoneNumber:', phoneNumber)
    console.log(`[GENERATE_LINK] 🔑 Génération lien GIMAC ${linkTypeCode} pour commande:`, reference)

    const gimacConfig = this.getGimacConfig()

    const linkPayload: any = {
      amount: amount,
      product: reference.substring(0, 15),
      reference: `REF${Date.now()}`.substring(0, 15),
      service: linkTypeCode,
      callback_url_code: CALLBACK_URL_CODE,
      merchant_operation_account_code: gimacConfig.accountCode,
      transaction_type: 'PAYMENT',
      owner_charge: 'MERCHANT',
      success_redirection_url_code: 'W0L8C',
      failed_redirection_url_code: 'YTJEI',
    }

    console.log('[GENERATE_LINK] Payload avant ajout téléphone:', JSON.stringify(linkPayload, null, 2))

    // Ajouter le numéro de téléphone pour tous les types
    if (phoneNumber) {
      linkPayload.customer_account_number = phoneNumber
      console.log('[GENERATE_LINK] ✅ Téléphone ajouté au payload:', phoneNumber)
    } else {
      console.log('[GENERATE_LINK] ⚠️ Pas de numéro de téléphone fourni')
    }

    console.log('[GENERATE_LINK] 📤 Payload Mypvit final:', JSON.stringify(linkPayload, null, 2))

    console.log('[GENERATE_LINK] Appel de MypvitSecretService.getSecret()...')
    const secret = await MypvitSecretService.getSecret()
    console.log('[GENERATE_LINK] ✅ Secret récupéré:', secret ? 'OUI (longueur: ' + secret.length + ')' : 'NON')
    
    // Utiliser le codeUrl GIMAC
    const apiUrl = `https://api.mypvit.pro/${gimacConfig.codeUrl}/link`
    console.log(`[GENERATE_LINK] 🔗 URL API GIMAC: ${apiUrl}`)
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

    console.log('[GENERATE_LINK] ✅ Réponse reçue')
    console.log('[GENERATE_LINK] Status:', linkResponse.status)
    console.log('[GENERATE_LINK] Status text:', linkResponse.statusText)
    console.log('[GENERATE_LINK] Data:', JSON.stringify(linkResponse.data, null, 2))
    console.log('[GENERATE_LINK] ✅ Lien GIMAC généré:', {
      status: linkResponse.data.status,
      reference_id: linkResponse.data.merchant_reference_id,
      url: linkResponse.data.url
    })
    console.log('[GENERATE_LINK] ========== FIN ==========')

    return linkResponse.data
  }

  async createPaymentLink({ request, response }: HttpContext) {
    console.log('\n')
    console.log('🔗 =========================================================')
    console.log('🔗 ========== PAYMENT LINK CREATION START (GIMAC) ==========')
    console.log('🔗 =========================================================')
    console.log('[TIMESTAMP]', new Date().toISOString())
    console.log('[REQUEST] Method:', request.method())
    console.log('[REQUEST] URL:', request.url())
    console.log('[REQUEST] Headers:', JSON.stringify(request.headers(), null, 2))

    try {
      // Récupération du payload
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
        'agent',
        'linkType'
      ])

      console.log('[PAYLOAD] Contenu complet:', JSON.stringify(payload, null, 2))
      console.log('[PAYLOAD] userId:', payload.userId)
      console.log('[PAYLOAD] customerAccountNumber:', payload.customerAccountNumber)
      console.log('[PAYLOAD] customerPhone:', payload.customerPhone)
      console.log('[PAYLOAD] linkType:', payload.linkType)

      const userId = payload.userId
      const phoneNumber = payload.customerAccountNumber || payload.customerPhone
      const linkType = payload.linkType || 'web'
      let linkTypeCode = LINK_TYPES[linkType] || 'WEB'

      console.log('[STEP 2] Données extraites:')
      console.log('  - userId:', userId)
      console.log('  - phoneNumber:', phoneNumber)
      console.log('  - linkType:', linkType)
      console.log('  - linkTypeCode:', linkTypeCode)

      if (!userId || !phoneNumber) {
        console.log('[ERROR] ❌ userId ou phoneNumber manquant')
        return response.badRequest({
          success: false,
          message: 'userId ou phone manquant'
        })
      }
      console.log('[STEP 2] ✅ userId et phoneNumber présents')

      // Vérification du panier
      console.log('[STEP 3] Vérification du panier...')
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
          console.log('[CART] Articles:')
          cart.items.forEach((item, idx) => {
            console.log(`  [${idx + 1}] product_id: ${item.product_id}, quantity: ${item.quantity}`)
          })
        }
      }

      if (!cart || !cart.items || cart.items.length === 0) {
        console.log('[ERROR] ❌ Panier vide')
        return response.badRequest({
          success: false,
          message: 'Panier vide'
        })
      }
      console.log('[STEP 3] ✅ Panier valide, articles:', cart.items.length)

      // Vérification des stocks
      console.log('[STEP 4] Vérification des stocks...')
      const stockErrors: string[] = []
      
      for (const item of cart.items) {
        console.log(`[STOCK] Vérification produit ID: ${item.product_id}, quantité demandée: ${item.quantity}`)
        const product = await Product.findBy('id', item.product_id)
        
        if (!product) {
          console.log(`[STOCK] ❌ Produit non trouvé: ${item.product_id}`)
          stockErrors.push(`Produit non trouvé`)
          continue
        }
        
        console.log(`[STOCK] Produit: ${product.name}, stock disponible: ${product.stock}`)
        if (product.stock < item.quantity) {
          console.log(`[STOCK] ❌ Stock insuffisant pour ${product.name}`)
          stockErrors.push(`${product.name}: stock insuffisant`)
        } else {
          console.log(`[STOCK] ✅ Stock OK pour ${product.name}`)
        }
      }
      
      if (stockErrors.length > 0) {
        console.log('[ERROR] ❌ Erreurs de stock:', stockErrors)
        return response.badRequest({
          success: false,
          message: 'Stock insuffisant',
          errors: stockErrors
        })
      }
      console.log('[STEP 4] ✅ Stocks vérifiés avec succès')

      // Récupération utilisateur
      console.log('[STEP 5] Récupération utilisateur...')
      console.log('[USER] Recherche utilisateur ID:', userId)
      const user = await User.findBy('id', userId)
      console.log('[USER] Trouvé:', !!user)
      if (user) {
        console.log('[USER] ID:', user.id)
        console.log('[USER] Nom:', user.full_name)
        console.log('[USER] Email:', user.email)
        console.log('[USER] Téléphone:', user.phone)
      }

      // Calcul du total
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

      // Renouvellement secret
      console.log('[STEP 7] Renouvellement du secret...')
      await this.renewSecretIfNeeded()

      // Création de la commande
      console.log('[STEP 8] Création de la commande...')
      const orderData = {
        user_id: userId,
        order_number: `LINK-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
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
      }
      
      console.log('[ORDER] Données:', JSON.stringify(orderData, null, 2))
      
      const order = await Order.create(orderData)
      
      console.log('[ORDER] Commande créée avec succès:')
      console.log('  - ID:', order.id)
      console.log('  - Order number:', order.order_number)
      console.log('  - Total:', order.total)
      console.log('  - Status:', order.status)

      // Création des items de commande
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

      // Création du tracking
      console.log('[STEP 10] Création du tracking...')
      const trackingData = {
        order_id: order.id,
        status: 'pending',
        description: 'Lien de paiement GIMAC généré',
        tracked_at: DateTime.now()
      }
      console.log('[TRACKING] Données:', JSON.stringify(trackingData, null, 2))
      
      await OrderTracking.create(trackingData)
      console.log('[TRACKING] ✅ Tracking créé')

      // Génération du lien de paiement
      console.log('[STEP 11] Génération du lien de paiement...')
      const reference = `ORD-${order.id.substring(0, 8)}`
      console.log('[REFERENCE] Générée:', reference)

      const linkResult = await this.generatePaymentLink(
        total,
        reference,
        linkTypeCode,
        phoneNumber
      )

      // Mise à jour de la commande
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

      // Vidage du panier
      console.log('[STEP 13] Vidage du panier...')
      const deletedCount = await CartItem.query().where('cart_id', cart.id).delete()
      console.log('[CART] Items supprimés:', deletedCount)

      console.log('✅ =========================================================')
      console.log('✅ ========== PAYMENT LINK CREATED SUCCESSFULLY ==========')
      console.log('✅ =========================================================\n')

      const responseData = {
        success: true,
        message: `✅ Lien de paiement GIMAC ${linkTypeCode} généré avec succès !`,
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
            type: linkTypeCode,
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
        console.log('[ERROR] Response data:', error.response.data)
        console.log('[ERROR] Response status:', error.response.status)
        console.log('[ERROR] Response headers:', error.response.headers)
      }
      console.log('💥 =========================================================\n')
      
      return response.internalServerError({
        success: false,
        message: 'Erreur lors de la création du lien de paiement GIMAC',
        error: error.response?.data?.message || error.message
      })
    }
  }

  // ==================== MÉTHODE PAY ====================
  async pay({ request, response }: HttpContext) {
    console.log('\n')
    console.log('💳 =================================================')
    console.log('💳 ========== PAYMENT VIA LINK START (GIMAC) ==========')
    console.log('💳 =================================================')
    console.log('[TIMESTAMP]', new Date().toISOString())
    console.log('[REQUEST] Method:', request.method())
    console.log('[REQUEST] URL:', request.url())

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
        'agent',
        'linkType'
      ])

      console.log('[PAYLOAD]', JSON.stringify(payload, null, 2))

      const userId = payload.userId
      const phoneNumber = payload.customerAccountNumber || payload.customerPhone
      const linkType = payload.linkType || 'web'
      let linkTypeCode = LINK_TYPES[linkType] || 'WEB'

      console.log('[STEP 2] Données extraites:')
      console.log('  - userId:', userId)
      console.log('  - phoneNumber:', phoneNumber)
      console.log('  - linkType:', linkType)
      console.log('  - linkTypeCode:', linkTypeCode)

      if (!userId || !phoneNumber) {
        console.log('[ERROR] ❌ userId ou phoneNumber manquant')
        return response.badRequest({
          success: false,
          message: 'userId ou phone manquant'
        })
      }
      console.log('[STEP 2] ✅ userId et phoneNumber présents')

      console.log('[STEP 3] Vérification du panier...')
      const cart = await Cart.query()
        .where('user_id', userId)
        .preload('items')
        .first()

      console.log('[CART] Panier trouvé:', !!cart)
      if (cart) {
        console.log('[CART] ID:', cart.id)
        console.log('[CART] Nombre articles:', cart.items?.length || 0)
      }

      if (!cart || !cart.items || cart.items.length === 0) {
        console.log('[ERROR] ❌ Panier vide')
        return response.badRequest({
          success: false,
          message: 'Panier vide'
        })
      }
      console.log('[STEP 3] ✅ Panier valide')

      console.log('[STEP 4] Vérification des stocks...')
      const stockErrors: string[] = []
      
      for (const item of cart.items) {
        const product = await Product.findBy('id', item.product_id)
        
        if (!product) {
          stockErrors.push(`Produit non trouvé`)
          continue
        }
        
        if (product.stock < item.quantity) {
          stockErrors.push(`${product.name}: stock insuffisant`)
        }
      }
      
      if (stockErrors.length > 0) {
        console.log('[ERROR] ❌ Erreurs de stock:', stockErrors)
        return response.badRequest({
          success: false,
          message: 'Stock insuffisant',
          errors: stockErrors
        })
      }
      console.log('[STEP 4] ✅ Stocks vérifiés')

      console.log('[STEP 5] Récupération utilisateur...')
      const user = await User.findBy('id', userId)
      console.log('[USER] Trouvé:', !!user)

      console.log('[STEP 6] Calcul du total...')
      let subtotal = 0
      
      for (const item of cart.items) {
        const product = await Product.findBy('id', item.product_id)
        if (product) {
          subtotal += Number(product.price) * Number(item.quantity)
        }
      }
      
      const shippingCost = Number(payload.deliveryPrice || 0)
      const total = subtotal + shippingCost
      
      console.log('[CALCUL] TOTAL:', total)

      console.log('[STEP 7] Renouvellement secret...')
      await this.renewSecretIfNeeded()

      console.log('[STEP 8] Création de la commande...')
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

      console.log('[STEP 9] Création des items...')
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

      console.log('[STEP 10] Création tracking...')
      await OrderTracking.create({
        order_id: order.id,
        status: 'pending',
        description: 'Paiement via lien GIMAC généré',
        tracked_at: DateTime.now()
      })
      console.log('[TRACKING] ✅ Créé')

      console.log('[STEP 11] Génération lien...')
      const reference = `ORD-${order.id.substring(0, 8)}`

      const linkResult = await this.generatePaymentLink(
        total,
        reference,
        linkTypeCode,
        phoneNumber
      )

      console.log('[STEP 12] Mise à jour commande...')
      if (linkResult.merchant_reference_id) {
        order.payment_reference_id = linkResult.merchant_reference_id
        order.status = 'pending_payment' as const
        await order.save()
        console.log('[UPDATE] ✅ Mise à jour OK')
      }

      console.log('[STEP 13] Vidage panier...')
      await CartItem.query().where('cart_id', cart.id).delete()
      console.log('[CART] ✅ Vidé')

      console.log('✅ =================================================')
      console.log('✅ ========== PAYMENT LINK GENERATED ==========')
      console.log('✅ =================================================\n')
      
      return response.ok({
        success: true,
        message: `✅ Paiement via lien GIMAC ${linkTypeCode} généré avec succès !`,
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
            type: linkTypeCode,
            amount: total,
          },
        }
      })
      
    } catch (error: any) {
      console.log('\n')
      console.log('💥 =================================================')
      console.log('💥 ========== EXCEPTION CATCHED ========== 💥')
      console.log('💥 =================================================')
      console.log('[ERROR] Message:', error.message)
      console.log('[ERROR] Stack:', error.stack)
      if (error.response) {
        console.log('[ERROR] Response data:', error.response.data)
        console.log('[ERROR] Response status:', error.response.status)
      }
      console.log('💥 =================================================\n')
      
      return response.internalServerError({
        success: false,
        message: 'Erreur lors du paiement via lien GIMAC',
        error: error.response?.data?.message || error.message
      })
    }
  }
}
