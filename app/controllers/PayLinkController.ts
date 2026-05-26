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
    console.log('[CART] userId type:', typeof userId)

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
      if (cart.items && cart.items.length > 0) {
        console.log('[CART] Détail des articles:')
        cart.items.forEach((item, idx) => {
          console.log(`  [${idx + 1}] product_id: ${item.product_id}, quantity: ${item.quantity}`)
        })
      }
    } else {
      console.log('[CART] ❌ Aucun panier trouvé pour userId:', userId)
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
    console.log('[REQUEST] Method:', request.method())
    console.log('[REQUEST] URL:', request.url())
    console.log('[REQUEST] Headers:', JSON.stringify(request.headers(), null, 2))
    
    // Afficher TOUTES les données brutes reçues
    const rawBody = request.all()
    console.log('[RAW_BODY] Données brutes reçues:', JSON.stringify(rawBody, null, 2))
    console.log('[RAW_BODY] Clés reçues:', Object.keys(rawBody))

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

      console.log('[PAYLOAD] Contenu filtré:', JSON.stringify(payload, null, 2))
      console.log('[PAYLOAD] userId:', payload.userId, 'type:', typeof payload.userId)
      console.log('[PAYLOAD] customerAccountNumber:', payload.customerAccountNumber)
      console.log('[PAYLOAD] customerPhone:', payload.customerPhone)
      console.log('[PAYLOAD] shippingAddress:', payload.shippingAddress)
      console.log('[PAYLOAD] deliveryMethod:', payload.deliveryMethod)
      console.log('[PAYLOAD] deliveryPrice:', payload.deliveryPrice)
      console.log('[PAYLOAD] customerName:', payload.customerName)
      console.log('[PAYLOAD] customerEmail:', payload.customerEmail)
      console.log('[PAYLOAD] agent:', payload.agent)

      // 2. Extraction avec conversion explicite
      console.log('[STEP 2] Extraction des données...')
      const userId = payload.userId ? String(payload.userId) : null
      const phoneNumber = payload.customerAccountNumber || payload.customerPhone
      
      console.log('[EXTRACTED] userId (converti en string):', userId, 'type:', typeof userId)
      console.log('[EXTRACTED] phoneNumber:', phoneNumber, 'type:', typeof phoneNumber)
      console.log('[EXTRACTED] shippingAddress:', payload.shippingAddress)
      console.log('[EXTRACTED] deliveryMethod:', payload.deliveryMethod)
      console.log('[EXTRACTED] deliveryPrice:', payload.deliveryPrice)

      // Validation stricte
      console.log('[STEP 2b] Validation des champs obligatoires...')
      if (!userId) {
        console.log('[ERROR] ❌ userId manquant ou vide')
        console.log('[ERROR] userId reçu:', payload.userId)
        console.log('[ERROR] Toutes les clés reçues:', Object.keys(rawBody))
        return response.badRequest({
          success: false,
          message: 'userId manquant ou invalide',
          receivedUserId: payload.userId,
          receivedFields: Object.keys(rawBody),
          requiredFields: ['userId', 'customerAccountNumber ou customerPhone']
        })
      }
      
      if (!phoneNumber) {
        console.log('[ERROR] ❌ phoneNumber manquant')
        console.log('[ERROR] customerAccountNumber:', payload.customerAccountNumber)
        console.log('[ERROR] customerPhone:', payload.customerPhone)
        return response.badRequest({
          success: false,
          message: 'Numéro de téléphone manquant. Veuillez fournir customerAccountNumber ou customerPhone',
          receivedCustomerAccountNumber: payload.customerAccountNumber,
          receivedCustomerPhone: payload.customerPhone
        })
      }
      
      console.log('[STEP 2] ✅ userId et phoneNumber présents et valides')

      // 3. Vérification du stock
      console.log('[STEP 3] Début vérification stock...')
      console.log('[STEP 3] Appel checkCartStock avec userId:', userId)
      const stockResult = await this.checkCartStock(userId)
      console.log('[STEP 3] Résultat checkCartStock - ok:', stockResult.ok)
      console.log('[STEP 3] Résultat checkCartStock - errors:', stockResult.errors)
      console.log('[STEP 3] Résultat checkCartStock - cart exists:', !!stockResult.cart)
      
      const { ok, errors, cart } = stockResult

      if (!ok || !cart) {
        console.log('[ERROR] ❌ Panier invalide:', errors)
        return response.badRequest({
          success: false,
          message: 'Panier invalide',
          errors: errors,
          userId: userId
        })
      }
      console.log('[STEP 3] ✅ Stock vérifié avec succès')
      console.log('[STEP 3] Cart ID:', cart.id)
      console.log('[STEP 3] Cart items count:', cart.items.length)

      // 4. Récupération utilisateur
      console.log('[STEP 4] Récupération utilisateur...')
      console.log('[STEP 4] Recherche User avec id:', userId)
      const user = await User.findBy('id', userId)
      console.log('[USER] Trouvé:', !!user)
      if (user) {
        console.log('[USER] ID:', user.id)
        console.log('[USER] Nom:', user.full_name)
        console.log('[USER] Email:', user.email)
        console.log('[USER] Phone:', user.phone)
      } else {
        console.log('[USER] ❌ Utilisateur non trouvé pour ID:', userId)
      }

      // 5. Détection opérateur
      console.log('[STEP 5] Détection opérateur...')
      console.log('[STEP 5] Appel detectOperatorGabon avec phoneNumber:', phoneNumber)
      const kyc = this.detectOperatorGabon(phoneNumber)
      console.log('[KYC] Résultat complet:', JSON.stringify(kyc, null, 2))
      console.log('[KYC] name:', kyc.name)
      console.log('[KYC] code:', kyc.code)
      console.log('[KYC] accountCode:', kyc.accountCode)

      // 6. Renouvellement secret
      console.log('[STEP 6] Renouvellement secret...')
      console.log('[STEP 6] Appel renewSecretIfNeeded avec phoneNumber:', phoneNumber)
      await this.renewSecretIfNeeded(phoneNumber)
      console.log('[STEP 6] ✅ Secret renouvelé (ou tentative faite)')

      // 7. Calcul du total
      console.log('[STEP 7] Calcul du total...')
      console.log('[STEP 7] Cart items à parcourir:', cart.items.length)
      let subtotal = 0

      for (let i = 0; i < cart.items.length; i++) {
        const item = cart.items[i]
        console.log(`[CALCUL] Item ${i+1}/${cart.items.length}: product_id=${item.product_id}, quantity=${item.quantity}`)
        const product = await Product.findBy('id', item.product_id)
        if (product) {
          const itemTotal = Number(product.price) * Number(item.quantity)
          console.log(`[CALCUL]   - ${product.name}: ${product.price} × ${item.quantity} = ${itemTotal}`)
          subtotal += itemTotal
        } else {
          console.log(`[CALCUL]   - ⚠️ Produit non trouvé pour id: ${item.product_id}`)
        }
      }

      const shippingCostRaw = payload.deliveryPrice
      console.log('[CALCUL] shippingCost raw:', shippingCostRaw, 'type:', typeof shippingCostRaw)
      const shippingCost = Number(payload.deliveryPrice || 0)
      const total = Number(subtotal) + Number(shippingCost)

      console.log('[CALCUL] Résultat final:')
      console.log('  - Subtotal:', subtotal, 'type:', typeof subtotal)
      console.log('  - Shipping cost:', shippingCost, 'type:', typeof shippingCost)
      console.log('  - TOTAL:', total, 'type:', typeof total)

      // 8. Création commande
      console.log('[STEP 8] Création de la commande...')
      
      const deliveryMethod = payload.deliveryMethod || 'standard'
      console.log('[ORDER] delivery_method utilisé:', deliveryMethod)
      console.log('[ORDER] customer_name:', user?.full_name || payload.customerName || 'Client')
      console.log('[ORDER] customer_phone:', phoneNumber)
      console.log('[ORDER] payment_method:', kyc.name)
      
      const orderData = {
        user_id: userId,
        order_number: generateOrderNumber(),
        status: 'pending' as const,
        total: total,
        subtotal: subtotal,
        shipping_cost: shippingCost,
        delivery_method: deliveryMethod,
        customer_name: user?.full_name || payload.customerName || 'Client',
        customer_phone: phoneNumber,
        payment_method: kyc.name,
        payment_operator_simple: kyc.name
      }
      
      console.log('[ORDER] Données à créer:', JSON.stringify(orderData, null, 2))
      
      const order = await Order.create(orderData)

      console.log('[ORDER] Commande créée avec succès:')
      console.log('  - ID:', order.id)
      console.log('  - Order number:', order.order_number)
      console.log('  - Total:', order.total)
      console.log('  - Delivery method:', order.delivery_method)
      console.log('  - Status:', order.status)

      // 9. Création des items
      console.log('[STEP 9] Création des items de commande...')
      console.log('[STEP 9] Appel buildItems avec order.id:', order.id)
      const buildResult = await this.buildItems(order, cart)
      const { count } = buildResult
      console.log('[ITEMS] Nombre d\'items créés:', count)
      console.log('[ITEMS] Subtotal calculé par buildItems:', buildResult.subtotal)

      // 10. Tracking
      console.log('[STEP 10] Création du tracking...')
      const trackingData = {
        order_id: order.id,
        status: 'pending',
        description: 'Commande créée',
        tracked_at: DateTime.now()
      }
      console.log('[TRACKING] Données:', JSON.stringify(trackingData, null, 2))
      
      await OrderTracking.create(trackingData)
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

      console.log('[PAYMENT_PAYLOAD] Contenu complet:', JSON.stringify(paymentPayload, null, 2))
      console.log('[PAYMENT_PAYLOAD] amount:', paymentPayload.amount)
      console.log('[PAYMENT_PAYLOAD] callback_url_code:', paymentPayload.callback_url_code)
      console.log('[PAYMENT_PAYLOAD] customer_account_number:', paymentPayload.customer_account_number)
      console.log('[PAYMENT_PAYLOAD] merchant_operation_account_code:', paymentPayload.merchant_operation_account_code)
      console.log('[PAYMENT_PAYLOAD] operator_code:', paymentPayload.operator_code)

      // 12. Appel service paiement
      console.log('[STEP 12] Appel à MypvitTransactionService.processPayment()...')
      console.log('[API_CALL] Début appel API Mypvit...')
      
      let payment
      try {
        payment = await MypvitTransactionService.processPayment(paymentPayload)
        console.log('[API_RESPONSE] ✅ Réponse reçue')
        console.log('[API_RESPONSE] Contenu complet:', JSON.stringify(payment, null, 2))
        console.log('[API_RESPONSE] status:', payment?.status)
        console.log('[API_RESPONSE] reference_id:', payment?.reference_id)
      } catch (apiError: any) {
        console.log('[API_ERROR] ❌ Erreur lors de l\'appel API:')
        console.log('[API_ERROR] Message:', apiError.message)
        console.log('[API_ERROR] Stack:', apiError.stack)
        if (apiError.response) {
          console.log('[API_ERROR] Response data:', apiError.response.data)
          console.log('[API_ERROR] Response status:', apiError.response.status)
        }
        throw new Error(`Erreur API Mypvit: ${apiError.message}`)
      }

      if (!payment) {
        console.log('[ERROR] ❌ Payment est null ou undefined')
        throw new Error('Payment null - pas de réponse de l\'API Mypvit')
      }
      console.log('[STEP 12] ✅ Payment object valide')

      // 13. Récupération secret
      console.log('[STEP 13] Récupération du secret...')
      let xSecret
      try {
        xSecret = await MypvitSecretService.getSecret()
        console.log('[SECRET] Secret récupéré:', xSecret ? '✅ OUI' : '❌ NON')
        if (xSecret) {
          console.log('[SECRET] Longueur du secret:', xSecret.length)
        }
      } catch (secretError: any) {
        console.log('[SECRET_ERROR] ❌ Erreur récupération secret:', secretError.message)
        console.log('[SECRET_ERROR] Stack:', secretError.stack)
        throw new Error(`Erreur récupération secret: ${secretError.message}`)
      }

      if (!xSecret) {
        console.log('[ERROR] ❌ XSecret missing - pas de secret disponible')
        throw new Error('XSecret missing - impossible de continuer le paiement')
      }
      console.log('[STEP 13] ✅ Secret valide')

      // 14. Traitement réponse paiement
      console.log('[STEP 14] Traitement réponse paiement...')
      console.log('[PAYMENT_STATUS] Status:', payment.status)
      console.log('[PAYMENT_REFERENCE] Reference ID:', payment.reference_id)
      console.log('[PAYMENT] Payment complet:', JSON.stringify(payment, null, 2))

      if (payment.status !== 'FAILED' && payment.reference_id) {
        console.log('[SUCCESS] ✅ Paiement initié avec succès')
        console.log('[SUCCESS] Mise à jour de la commande...')
        
        order.payment_reference_id = payment.reference_id
        order.status = 'pending_payment' as const
        order.payment_initiated_at = DateTime.now()

        console.log('[ORDER] Avant save:', {
          id: order.id,
          payment_reference_id: order.payment_reference_id,
          status: order.status,
          payment_initiated_at: order.payment_initiated_at
        })
        
        await order.save()
        console.log('[ORDER] ✅ Commande mise à jour avec reference_id:', payment.reference_id)
        console.log('[ORDER] Après save - status:', order.status)

        // 15. Vidage panier
        console.log('[STEP 15] Vidage du panier...')
        console.log('[CART] Cart ID:', cart.id)
        console.log('[CART] Suppression des CartItems...')
        
        const deleted = await CartItem.query().where('cart_id', cart.id).delete()
        console.log('[CART] Items supprimés:', deleted)
        
        if (deleted > 0) {
          console.log('[CART] ✅ Panier vidé avec succès')
        } else {
          console.log('[CART] ⚠️ Aucun item supprimé ou panier déjà vide')
        }

        console.log('✅ ========== PAYMENT SUCCESS ========== ✅')
        console.log('🚀 ========================================\n')

        const successResponse = {
          success: true,
          orderId: order.id,
          total: total,
          itemsCount: count,
          payment: payment
        }
        console.log('[RESPONSE] Envoi réponse succès:', JSON.stringify(successResponse, null, 2))
        
        return response.ok(successResponse)
      }

      console.log('[FAILURE] ❌ Paiement échoué - status:', payment.status)
      console.log('[FAILURE] reference_id:', payment.reference_id)
      console.log('[FAILURE] Payment complet:', JSON.stringify(payment, null, 2))
      
      order.status = 'payment_failed' as const
      await order.save()
      console.log('[ORDER] Status mis à jour: payment_failed')

      console.log('❌ ========== PAYMENT FAILED ========== ❌')
      
      const failureResponse = {
        success: false,
        message: 'Paiement échoué',
        paymentStatus: payment.status
      }
      console.log('[RESPONSE] Envoi réponse échec:', JSON.stringify(failureResponse, null, 2))
      
      return response.badRequest(failureResponse)

    } catch (error: any) {
      console.log('\n')
      console.log('💥 ========== EXCEPTION CATCHED ========== 💥')
      console.log('[ERROR] Message:', error.message)
      console.log('[ERROR] Stack:', error.stack)
      console.log('[ERROR] Name:', error.name)
      console.log('[ERROR] Code:', error.code)
      console.log('[ERROR] Status:', error.status)
      
      if (error.response) {
        console.log('[ERROR] Response data:', error.response.data)
        console.log('[ERROR] Response status:', error.response.status)
        console.log('[ERROR] Response headers:', JSON.stringify(error.response.headers, null, 2))
      }
      
      if (error.request) {
        console.log('[ERROR] Request was made but no response received')
        console.log('[ERROR] Request:', error.request)
      }
      
      console.log('💥 ======================================== 💥\n')

      const errorResponse = {
        success: false,
        message: 'Erreur serveur',
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
      
      console.log('[RESPONSE] Envoi erreur 500:', JSON.stringify(errorResponse, null, 2))
      
      return response.internalServerError(errorResponse)
    }
  }
}
