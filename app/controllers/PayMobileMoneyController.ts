// app/controllers/PayMobileMoneyController.ts - CORRIGÉ FINAL
import type { HttpContext } from '@adonisjs/core/http'
import Order from '#models/Order'
import OrderItem from '#models/OrderItem'
import OrderTracking from '#models/order_tracking'
import Cart from '#models/Cart'
import User from '#models/user'
import Product from '#models/Product'
import KYC from '#models/kyc'
import { DateTime } from 'luxon'
import MypvitSecretService from '../services/mypvit_secret_service.js'
import MypvitTransactionService from '../services/mypvit_transaction_service.js'
import MypvitKYCService from '../services/mypvit_kyc_service.js'

const CALLBACK_URL_CODE = '9ZOXW'

function generateOrderNumber(): string {
  return `CMD-${Date.now()}-${Math.floor(Math.random() * 1000)}`
}

export default class PayMobileMoneyController {

  private async renewSecretIfNeeded(phoneNumber?: string): Promise<void> {
    try {
      console.log('🔄 Tentative de renouvellement du secret...')
      await MypvitSecretService.renewSecret(phoneNumber)
      console.log('✅ Clé renouvelée avec succès')
    } catch (error: any) {
      console.error('⚠️ Erreur renouvellement secret:', error.message)
    }
  }

  private detectOperatorGabon(phoneNumber: string): { name: string; code: string; accountCode: string } {
    console.log('🔍 Détection opérateur pour:', phoneNumber)
    
    const clean = phoneNumber.replace(/[\s\+\.\-]/g, '')
    let local = clean
    
    if (clean.startsWith('+241')) local = clean.substring(4)
    else if (clean.startsWith('241')) local = clean.substring(3)
    
    if (local.startsWith('0')) local = local.substring(1)
    
    console.log('📱 Numéro nettoyé:', local)
    console.log('🔢 Premier chiffre:', local.charAt(0))

    if (local.startsWith('7')) {
      console.log('✅ AIRTEL_MONEY détecté')
      return {
        name: 'AIRTEL_MONEY',
        code: 'AIRTEL_MONEY',
        accountCode: 'ACC_69EFB0E02FCA3'
      }
    }
    
    console.log('✅ MOOV_MONEY détecté')
    return {
      name: 'MOOV_MONEY',
      code: 'MOOV_MONEY',
      accountCode: 'ACC_69EFB143D4F54'
    }
  }

  private async performKYC(phoneNumber: string): Promise<{
    operator: string
    fullName: string
    accountNumber: string
    operatorCode: string
    accountCode: string
    isActive: boolean
  }> {
    console.log('🆔 Démarrage KYC pour:', phoneNumber)
    
    const detected = this.detectOperatorGabon(phoneNumber)
    let fullName = 'Client'

    try {
      await this.renewSecretIfNeeded(phoneNumber)
      const kycData = await MypvitKYCService.getKYCInfo(phoneNumber, detected.code)
      fullName = kycData.firstname || kycData.full_name || 'Client'
      console.log('✅ KYC réussi, nom:', fullName)
    } catch (error: any) {
      console.log('🟡 KYC fallback:', error.message)
    }

    try {
      const existingKYC = await KYC.findBy('numeroTelephone', phoneNumber)
      if (existingKYC) {
        existingKYC.nomComplet = fullName
        existingKYC.operateur = detected.name
        await existingKYC.save()
      } else {
        await KYC.create({
          nomComplet: fullName,
          numeroTelephone: phoneNumber,
          operateur: detected.name
        })
      }
    } catch (error: any) {
      console.log('🟡 KYC save error:', error.message)
    }

    return {
      operator: detected.name,
      fullName,
      accountNumber: phoneNumber,
      operatorCode: detected.code,
      accountCode: detected.accountCode,
      isActive: true
    }
  }

  // ✅ Vérifie le stock du panier
  private async checkCartStock(userId: string): Promise<{
    ok: boolean
    errors: string[]
    cart: Cart | null
  }> {
    const errors: string[] = []
    
    const cart = await Cart.query()
      .where('user_id', userId)
      .preload('items')
      .first()

    if (!cart || !cart.items || cart.items.length === 0) {
      return { ok: false, errors: ['Panier vide'], cart: null }
    }

    for (const item of cart.items) {
      const p = await Product.findBy('id', item.product_id)
      if (!p) { 
        errors.push(`Produit ${item.product_id} introuvable`)
        continue 
      }
      if (p.isArchived) { 
        errors.push(`${p.name} - Archivé`)
        continue 
      }
      if (p.stock <= 0) { 
        errors.push(`${p.name} - Rupture de stock`)
        continue 
      }
      if (p.stock < item.quantity) { 
        errors.push(`${p.name}: stock ${p.stock} < ${item.quantity}`)
        continue 
      }
    }

    return { ok: errors.length === 0, errors, cart }
  }

  // ✅ Crée les OrderItems à partir du panier
  private async buildItemsFromCart(order: Order, cart: Cart): Promise<{ subtotal: number; count: number }> {
    let subtotal = 0
    let count = 0

    for (const item of cart.items) {
      const p = await Product.findBy('id', item.product_id)
      if (!p) continue

      const itemTotal = p.price * item.quantity
      subtotal += itemTotal

      await OrderItem.create({
        order_id: order.id,
        product_id: p.id,
        product_name: p.name,
        price: p.price,
        quantity: item.quantity,
        subtotal: itemTotal
      })

      // ✅ Stock NON décrémenté ici - sera fait par le CallbackController après confirmation
      count++
    }

    return { subtotal, count }
  }

  // ==================== MÉTHODE PRINCIPALE ====================
  async pay({ request, response }: HttpContext) {
    console.log('📱 ========== PAIEMENT MOBILE MONEY ==========')

    try {
      // Récupérer toutes les données envoyées
      const payload = request.only([
        'userId', 'customerAccountNumber', 'shippingAddress', 'deliveryMethod',
        'deliveryPrice', 'customerName', 'customerEmail', 'customerPhone', 'agent', 'linkType', 'notes'
      ])

      console.log('📦 Données reçues:', payload)

      const userId = payload.userId
      const phoneNumber = payload.customerAccountNumber || payload.customerPhone

      if (!userId) {
        return response.status(400).json({
          success: false,
          message: 'userId requis'
        })
      }

      if (!phoneNumber) {
        return response.status(400).json({
          success: false,
          message: 'Numéro de téléphone requis'
        })
      }

      // ✅ 1. RÉCUPÉRER LE PANIER DE L'UTILISATEUR
      console.log('🛒 Récupération du panier pour userId:', userId)
      
      const { ok, errors, cart } = await this.checkCartStock(userId)
      
      if (!ok) {
        return response.status(400).json({
          success: false,
          message: 'Stock insuffisant ou panier vide',
          errors
        })
      }

      if (!cart) {
        return response.status(400).json({
          success: false,
          message: 'Panier introuvable'
        })
      }

      console.log(`🛒 Panier trouvé avec ${cart.items.length} articles`)

      // 2. KYC et détection opérateur
      const kyc = await this.performKYC(phoneNumber)
      console.log(`📱 Opérateur: ${kyc.operator} | Code: ${kyc.operatorCode} | Compte: ${kyc.accountCode}`)

      // 3. Renouveler le secret
      await this.renewSecretIfNeeded(phoneNumber)

      // 4. Récupérer l'utilisateur (pour son nom/email)
      const user = await User.findBy('id', userId)

      // 5. Calculer le total depuis le panier
      let subtotal = 0
      for (const item of cart.items) {
        const product = await Product.findBy('id', item.product_id)
        if (product) {
          subtotal += product.price * item.quantity
        }
      }

      const shippingCost = payload.deliveryPrice || 1
      const total = subtotal + shippingCost

      console.log('💰 Subtotal:', subtotal, '| Livraison:', shippingCost, '| Total:', total)

      // 6. Création commande
      const order = await Order.create({
        user_id: userId,
        order_number: generateOrderNumber(),
        status: 'pending',
        total: total,
        subtotal: subtotal,
        shipping_cost: shippingCost,
        delivery_method: payload.deliveryMethod || 'standard',
        customer_name: user?.full_name || payload.customerName || kyc.fullName,
        customer_phone: phoneNumber,
        payment_method: kyc.operator,
        customer_email: user?.email || payload.customerEmail || '',
        shipping_address: payload.shippingAddress || 'non renseigné',
        payment_operator_simple: kyc.operator
      })

      // 7. Créer les OrderItems à partir du panier
      const { count } = await this.buildItemsFromCart(order, cart)

      // 8. Tracking initial
      await OrderTracking.create({
        order_id: order.id,
        status: 'pending',
        description: `🛒 Commande initiée - ${kyc.operator} - ${count} articles`,
        tracked_at: DateTime.now(),
      })

      // 9. PAIEMENT
      console.log(`💳 Paiement ${kyc.operator} via compte ${kyc.accountCode}...`)

      const payment = await MypvitTransactionService.processPayment({
        agent: payload.agent || 'AGENT_DEFAULT',
        amount: total,
        reference: `REF${Date.now()}`.substring(0, 15),
        callback_url_code: CALLBACK_URL_CODE,
        customer_account_number: kyc.accountNumber,
        merchant_operation_account_code: kyc.accountCode,
        owner_charge: 'CUSTOMER',
        operator_code: kyc.operatorCode,
      })

      console.log('💳 Résultat paiement:', payment)

      // 10. Traitement résultat
      if (payment.status !== 'FAILED' && payment.reference_id) {
        order.payment_reference_id = payment.reference_id
        order.payment_operator_simple = kyc.operator
        order.payment_amount = total
        order.payment_initiated_at = DateTime.now()
        order.status = 'pending_payment'
        await order.save()

        await OrderTracking.create({
          order_id: order.id,
          status: 'pending_payment',
          description: `⏳ En attente - ${kyc.operator} - Réf: ${payment.reference_id}`,
          tracked_at: DateTime.now(),
        })

        await order.load('items')

        return response.status(201).json({
          success: true,
          message: '⏳ Vérifiez votre téléphone pour confirmer le paiement',
          data: {
            orderId: order.id,
            orderNumber: order.order_number,
            total: order.total,
            status: 'pending_payment',
            customerName: order.customer_name,
            paymentMethod: kyc.operator,
            itemsCount: count,
            userId,
            operator: {
              name: kyc.operator,
              code: kyc.operatorCode,
              accountCode: kyc.accountCode
            },
            payment: {
              reference_id: payment.reference_id,
              status: 'PENDING'
            },
          },
        })
      } else {
        // Paiement échoué → Pas de restauration de stock nécessaire
        order.status = 'payment_failed'
        order.payment_error_message = payment.message || 'Erreur inconnue'
        await order.save()

        await OrderTracking.create({
          order_id: order.id,
          status: 'payment_failed',
          description: `❌ Échec ${kyc.operator}: ${payment.message}`,
          tracked_at: DateTime.now(),
        })

        return response.status(400).json({
          success: false,
          message: 'Paiement échoué',
          error: payment.message,
          operator: kyc.operator
        })
      }
    } catch (error: any) {
      console.error('🔴 Erreur paiement:', error.message)
      
      if (error.response) {
        console.error('🔴 Status:', error.response.status)
        console.error('🔴 Data:', JSON.stringify(error.response.data))
      }
      
      return response.status(500).json({
        success: false,
        message: 'Erreur lors du paiement',
        error: error.message,
        details: error.response?.data || null
      })
    }
  }
}
