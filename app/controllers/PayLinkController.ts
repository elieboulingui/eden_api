// app/controllers/PayMobileMoneyController.ts

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
import MypvitTransactionService from '../services/mypvit_transaction_service.js'

const CALLBACK_URL_CODE = '9ZOXW'

function generateOrderNumber(): string {
  const value = `CMD-${Date.now()}-${Math.floor(Math.random() * 1000)}`
  console.log('[ORDER_NUMBER]', value)
  return value
}

export default class PayMobileMoneyController {

  private async renewSecretIfNeeded(phoneNumber?: string): Promise<void> {
    console.log('[SECRET] ========== DEBUT RENOUVELLEMENT ==========')
    console.log('[SECRET] phoneNumber:', phoneNumber)

    try {
      console.log('[SECRET] Appel de MypvitSecretService.renewSecret()...')
      await MypvitSecretService.renewSecret(phoneNumber)
      console.log('[SECRET] ✅ Renouvellement réussi')
    } catch (error: any) {
      console.log('[SECRET] ❌ Erreur renouvellement:', error.message)
      console.log('[SECRET] Stack:', error.stack)
    }
    console.log('[SECRET] ========== FIN RENOUVELLEMENT ==========')
  }

  private detectOperatorGabon(phoneNumber: string) {
    console.log('[OPERATOR] ========== DETECTION OPERATEUR ==========')
    console.log('[OPERATOR] phoneNumber original:', phoneNumber)

    const clean = phoneNumber.replace(/[\s\+\.\-]/g, '')
    console.log('[OPERATOR] clean (sans espaces/symboles):', clean)
    
    let local = clean

    if (clean.startsWith('241')) {
      local = clean.substring(3)
      console.log('[OPERATOR] Retiré préfixe 241 →', local)
    }
    if (clean.startsWith('+241')) {
      local = clean.substring(4)
      console.log('[OPERATOR] Retiré préfixe +241 →', local)
    }
    if (local.startsWith('0')) {
      local = local.substring(1)
      console.log('[OPERATOR] Retiré 0 initial →', local)
    }

    console.log('[OPERATOR] Numéro local final:', local)

    if (local.startsWith('06') || local.startsWith('6')) {
      console.log('[OPERATOR] ✅ Opérateur détecté: MOOV_MONEY')
      return {
        name: 'MOOV_MONEY',
        code: 'MOOV_MONEY',
        accountCode: 'ACC_69EFB143D4F54'
      }
    }

    if (local.startsWith('07') || local.startsWith('7')) {
      console.log('[OPERATOR] ✅ Opérateur détecté: AIRTEL_MONEY')
      return {
        name: 'AIRTEL_MONEY',
        code: 'AIRTEL_MONEY',
        accountCode: 'ACC_69EFB0E02FCA3'
      }
    }

    console.log('[OPERATOR] ⚠️ Opérateur non détecté, fallback sur GIMAC')
    return {
      name: 'GIMAC',
      code: 'GIMAC_PAY',
      accountCode: 'ACC_69FE0E1BC34B4'
    }
  }

  private async checkCartStock(userId: string) {
    console.log('[CART] ========== VERIFICATION STOCK ==========')
    console.log('[CART] userId:', userId)

    const errors: string[] = []

    console.log('[CART] Recherche du panier...')
    const cart = await Cart.query()
      .where('user_id', userId)
      .preload('items')
      .first()

    console.log('[CART] Panier trouvé:', !!cart)
    if (cart) {
      console.log('[CART] ID panier:', cart.id)
      console.log('[CART] Nombre articles:', cart.items?.length || 0)
    }

    if (!cart || !cart.items?.length) {
      console.log('[CART] ❌ Panier vide ou inexistant')
      return { ok: false, errors: ['Panier vide'], cart: null }
    }

    console.log('[CART] Vérification des stocks...')
    for (const item of cart.items) {
      console.log(`[CART] Article: product_id=${item.product_id}, quantity=${item.quantity}`)
      const product = await Product.findBy('id', item.product_id)

      if (!product) {
        console.log(`[CART] ❌ Produit non trouvé: ${item.product_id}`)
        errors.push('Produit introuvable')
        continue
      }

      console.log(`[CART] Produit: ${product.name}, stock=${product.stock}, demandé=${item.quantity}`)
      if (product.stock < item.quantity) {
        console.log(`[CART] ❌ Stock insuffisant pour ${product.name}`)
        errors.push(`${product.name} stock insuffisant`)
      } else {
        console.log(`[CART] ✅ Stock OK pour ${product.name}`)
      }
    }

    console.log('[CART] Résultat:', errors.length === 0 ? '✅ OK' : '❌ ERREURS')
    console.log('[CART] Erreurs:', errors)
    console.log('[CART] ========== FIN VERIFICATION ==========')
    
    return { ok: errors.length === 0, errors, cart }
  }

  private async buildItems(order: Order, cart: Cart) {
    console.log('[ITEMS] ========== CREATION ITEMS COMMANDE ==========')
    console.log('[ITEMS] order_id:', order.id)
    console.log('[ITEMS] Nombre articles panier:', cart.items.length)

    let subtotal = 0
    let count = 0

    for (const item of cart.items) {
      console.log(`[ITEMS] Traitement article ${count + 1}: product_id=${item.product_id}`)
      const product = await Product.findBy('id', item.product_id)

      if (!product) {
        console.log(`[ITEMS] ❌ Produit non trouvé, skip`)
        continue
      }

      const total = Number(product.price) * Number(item.quantity)
      console.log(`[ITEMS] Produit: ${product.name}, prix=${product.price}, qty=${item.quantity}, total=${total}`)

      subtotal += total

      await OrderItem.create({
        order_id: order.id,
        product_id: product.id,
        product_name: product.name,
        price: product.price,
        quantity: item.quantity,
        subtotal: total
      })
      
      console.log(`[ITEMS] ✅ OrderItem créé`)

      count++
    }

    console.log('[ITEMS] Résultat: subtotal=', subtotal, 'count=', count)
    console.log('[ITEMS] ========== FIN CREATION ITEMS ==========')
    
    return { subtotal, count }
  }

  async pay({ request, response }: HttpContext) {

    console.log('\n')
    console.log('🚀 ========================================')
    console.log('🚀 ========== PAYMENT START ==========')
    console.log('🚀 ========================================')
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
      console.log('  - customerAccountNumber:', payload.customerAccountNumber)
      console.log('  - customerPhone:', payload.customerPhone)

      if (!userId || !phoneNumber) {
        console.log('[ERROR] ❌ userId ou phoneNumber manquant')
        return response.badRequest({
          success: false,
          message: 'userId ou phone manquant'
        })
      }
      console.log('[STEP 2] ✅ userId et phoneNumber présents')

      // 3. Vérification du stock
      console.log('[STEP 3] Vérification du stock...')
      const { ok, errors, cart } = await this.checkCartStock(userId)

      if (!ok || !cart) {
        console.log('[ERROR] ❌ Panier invalide:', errors)
        return response.badRequest({
          success: false,
          message: 'Panier invalide',
          errors
        })
      }
      console.log('[STEP 3] ✅ Stock vérifié avec succès')

      // 4. Récupération utilisateur
      console.log('[STEP 4] Récupération utilisateur...')
      const user = await User.findBy('id', userId)
      console.log('[USER] Trouvé:', !!user)
      if (user) {
        console.log('[USER] Nom:', user.full_name)
        console.log('[USER] Email:', user.email)
      }

      // 5. Détection opérateur
      console.log('[STEP 5] Détection opérateur...')
      const kyc = this.detectOperatorGabon(phoneNumber)
      console.log('[KYC] Résultat:', JSON.stringify(kyc, null, 2))

      // 6. Renouvellement secret
      console.log('[STEP 6] Renouvellement secret...')
      await this.renewSecretIfNeeded(phoneNumber)

      // 7. Calcul du total
      console.log('[STEP 7] Calcul du total...')
      let subtotal = 0

      console.log('[CALCUL] Parcours des articles du panier...')
      for (const item of cart.items) {
        const product = await Product.findBy('id', item.product_id)
        if (product) {
          const itemTotal = Number(product.price) * Number(item.quantity)
          console.log(`  - ${product.name}: ${product.price} × ${item.quantity} = ${itemTotal}`)
          subtotal += itemTotal
        }
      }

      const shippingCost = Number(payload.deliveryPrice || 1)
      const total = Number(subtotal) + Number(shippingCost)

      console.log('[CALCUL] Résultat final:')
      console.log('  - Subtotal:', subtotal)
      console.log('  - Shipping cost:', shippingCost)
      console.log('  - TOTAL:', total)

      // 8. Création commande - CORRIGÉ avec 'as const' pour le status
      console.log('[STEP 8] Création de la commande...')
      
      const deliveryMethod = payload.deliveryMethod || 'standard'
      console.log('[ORDER] delivery_method utilisé:', deliveryMethod)
      
      const order = await Order.create({
        user_id: userId,
        order_number: generateOrderNumber(),
        status: 'pending' as const,  // <-- CORRECTION: 'as const'
        total,
        subtotal,
        shipping_cost: shippingCost,
        delivery_method: deliveryMethod,
        customer_name: user?.full_name || payload.customerName || 'Client',
        customer_phone: phoneNumber,
        payment_method: kyc.name,
        payment_operator_simple: kyc.name
      })

      console.log('[ORDER] Commande créée avec succès:')
      console.log('  - ID:', order.id)
      console.log('  - Order number:', order.order_number)
      console.log('  - Total:', order.total)
      console.log('  - Delivery method:', order.delivery_method)

      // 9. Création des items
      console.log('[STEP 9] Création des items de commande...')
      const { count } = await this.buildItems(order, cart)
      console.log('[ITEMS] Nombre d\'items créés:', count)

      // 10. Tracking
      console.log('[STEP 10] Création du tracking...')
      await OrderTracking.create({
        order_id: order.id,
        status: 'pending',
        description: 'Commande créée',
        tracked_at: DateTime.now()
      })
      console.log('[TRACKING] ✅ Tracking créé')

      // 11. Préparation paiement
      console.log('[STEP 11] Préparation payload paiement Mypvit...')
      const paymentPayload = {
        agent: payload.agent || 'AGENT_DEFAULT',
        amount: total,
        reference: `REF${Date.now()}`,
        callback_url_code: CALLBACK_URL_CODE,
        customer_account_number: phoneNumber,
        merchant_operation_account_code: kyc.accountCode,
        owner_charge: 'CUSTOMER' as const,
        operator_code: kyc.code
      }

      console.log('[PAYMENT_PAYLOAD]', JSON.stringify(paymentPayload, null, 2))

      // 12. Appel service paiement
      console.log('[STEP 12] Appel à MypvitTransactionService.processPayment()...')
      console.log('[API_CALL] Tentative de paiement...')
      
      let payment
      try {
        payment = await MypvitTransactionService.processPayment(paymentPayload)
        console.log('[API_RESPONSE] Réponse reçue:', JSON.stringify(payment, null, 2))
      } catch (apiError: any) {
        console.log('[API_ERROR] ❌ Erreur lors de l\'appel API:')
        console.log('  - Message:', apiError.message)
        console.log('  - Stack:', apiError.stack)
        throw new Error(`Erreur API Mypvit: ${apiError.message}`)
      }

      if (!payment) {
        console.log('[ERROR] ❌ Payment est null')
        throw new Error('Payment null')
      }

      // 13. Récupération secret
      console.log('[STEP 13] Récupération du secret...')
      let xSecret
      try {
        xSecret = await MypvitSecretService.getSecret()
        console.log('[SECRET] Secret récupéré:', xSecret ? '✅ OUI' : '❌ NON')
      } catch (secretError: any) {
        console.log('[SECRET_ERROR] ❌ Erreur récupération secret:', secretError.message)
        throw new Error(`Erreur récupération secret: ${secretError.message}`)
      }

      if (!xSecret) {
        console.log('[ERROR] ❌ XSecret missing')
        throw new Error('XSecret missing')
      }

      // 14. Traitement réponse paiement
      console.log('[STEP 14] Traitement réponse paiement...')
      console.log('[PAYMENT_STATUS] Status:', payment.status)
      console.log('[PAYMENT_REFERENCE] Reference ID:', payment.reference_id)

      if (payment.status !== 'FAILED' && payment.reference_id) {
        console.log('[SUCCESS] ✅ Paiement initié avec succès')
        
        order.payment_reference_id = payment.reference_id
        order.status = 'pending_payment'  // <-- Ceci est déjà un type valide
        order.payment_initiated_at = DateTime.now()

        await order.save()
        console.log('[ORDER] Commande mise à jour avec reference_id:', payment.reference_id)

        // 15. Vidage panier
        console.log('[STEP 15] Vidage du panier...')
        const deleted = await CartItem.query().where('cart_id', cart.id).delete()
        console.log('[CART] Items supprimés:', deleted)

        console.log('✅ ========== PAYMENT SUCCESS ========== ✅')
        console.log('🚀 ========================================\n')

        return response.ok({
          success: true,
          orderId: order.id,
          total,
          itemsCount: count,
          payment
        })
      }

      console.log('[FAILURE] ❌ Paiement échoué - status:', payment.status)
      order.status = 'payment_failed'  // <-- Ceci est déjà un type valide
      await order.save()

      console.log('❌ ========== PAYMENT FAILED ========== ❌')
      
      return response.badRequest({
        success: false,
        message: 'Paiement échoué',
        paymentStatus: payment.status
      })

    } catch (error: any) {
      console.log('\n')
      console.log('💥 ========== EXCEPTION CATCHED ========== 💥')
      console.log('[ERROR] Message:', error.message)
      console.log('[ERROR] Stack:', error.stack)
      console.log('[ERROR] Name:', error.name)
      
      if (error.code) console.log('[ERROR] Code:', error.code)
      if (error.status) console.log('[ERROR] Status:', error.status)
      
      console.log('💥 ======================================== 💥\n')

      return response.internalServerError({
        success: false,
        message: 'Erreur serveur',
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    }
  }
}
