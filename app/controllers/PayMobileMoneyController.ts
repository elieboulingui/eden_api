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
import crypto from 'node:crypto'
import MypvitSecretService from '../services/mypvit_secret_service.js'
import MypvitTransactionService from '../services/mypvit_transaction_service.js'
import MypvitKYCService from '../services/mypvit_kyc_service.js'

const CALLBACK_URL_CODE = '9ZOXW'

function generateOrderNumber(): string {
  return `CMD-${Date.now()}-${Math.floor(Math.random() * 1000)}`
}

function generateRandomPassword(): string {
  return crypto.randomBytes(16).toString('hex')
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

  private async getOrCreateUser(payload: {
    customerName: string
    customerEmail: string
    customerPhone: string
  }): Promise<User> {
    const { customerEmail, customerPhone, customerName } = payload
    const email = customerEmail || `guest_${Date.now()}@guest.com`

    let user = await User.findBy('email', email)

    if (user) {
      user.full_name = customerName || user.full_name
      if (!user.phone) user.phone = customerPhone
      await user.save()
      console.log('👤 User existant:', user.id)
    } else {
      user = await User.create({
        id: crypto.randomUUID(),
        email: email,
        full_name: customerName || 'Client',
        phone: customerPhone || '',
        role: 'client',
        password: generateRandomPassword(),
      })
      console.log('👤 User créé:', user.id)
    }

    return user
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

  private async checkStock(items: any[], useCart: boolean, userId?: string): Promise<{
    ok: boolean
    errors: string[]
  }> {
    const errors: string[] = []
    let toCheck: any[] = []

    if (useCart && userId) {
      const cart = await Cart.query().where('user_id', userId).preload('items').first()
      if (cart) toCheck = cart.items.map((i: any) => ({ id: i.product_id, qty: i.quantity }))
    } else if (items?.length > 0) {
      toCheck = items.map((i: any) => ({ id: i.productId || i.id, qty: i.quantity }))
    }

    for (const item of toCheck) {
      if (!item.id) continue
      const p = await Product.findBy('id', item.id)
      if (!p) { errors.push(`Produit ${item.id} introuvable`); continue }
      if (p.isArchived) { errors.push(`${p.name} - Archivé`); continue }
      if (p.stock <= 0) { errors.push(`${p.name} - Rupture de stock`); continue }
      if (p.stock < item.qty) { errors.push(`${p.name}: stock ${p.stock} < ${item.qty}`); continue }
    }

    return { ok: errors.length === 0, errors }
  }

  // ❌ SUPPRIMER - Cette méthode ne doit plus être utilisée ici
  // private async decrementStock(productId: string, qty: number): Promise<void> {
  //   const p = await Product.findBy('id', productId)
  //   if (p) {
  //     p.stock = Math.max(0, p.stock - qty)
  //     if (p.stock === 0) p.isArchived = true
  //     await p.save()
  //   }
  // }

  // ❌ SUPPRIMER - Cette méthode ne doit plus être utilisée ici
  // private async restoreStock(orderId: string): Promise<void> {
  //   const items = await OrderItem.query().where('order_id', orderId)
  //   for (const item of items) {
  //     const p = await Product.findBy('id', item.product_id)
  //     if (p) {
  //       p.stock += item.quantity
  //       if (p.isArchived && p.stock > 0) p.isArchived = false
  //       await p.save()
  //     }
  //   }
  // }

  private async buildItems(order: Order, items: any[], fromCart: boolean, userId?: string): Promise<{ subtotal: number; count: number }> {
    let subtotal = 0
    let count = 0

    const source = fromCart
      ? (await Cart.query().where('user_id', userId!).preload('items').first())?.items || []
      : items

    for (const item of source) {
      const pid = item.productId || item.product_id || item.id
      if (!pid) continue

      const p = await Product.findBy('id', pid)
      if (!p) continue

      const itemTotal = p.price * (item.quantity || 1)
      subtotal += itemTotal

      await OrderItem.create({
        order_id: order.id,
        product_id: p.id,
        product_name: p.name,
        price: p.price,
        quantity: item.quantity || 1,
        subtotal: itemTotal
      })

      // ✅ STOCK N'EST PLUS DÉCRÉMENTÉ ICI
      // Le stock sera décrémenté par le CallbackController après confirmation du paiement
      
      count++
    }

    return { subtotal, count }
  }

  // ==================== MÉTHODE PRINCIPALE ====================
  async pay({ request, response }: HttpContext) {
    console.log('📱 ========== PAIEMENT MOBILE MONEY ==========')

    try {
      const payload = request.only([
        'userId', 'customerAccountNumber', 'shippingAddress', 'deliveryMethod',
        'deliveryPrice', 'customerName', 'customerEmail', 'customerPhone', 'agent', 'items',
      ])

      const phoneNumber = payload.customerAccountNumber || payload.customerPhone
      if (!phoneNumber) {
        return response.status(400).json({
          success: false,
          message: 'Numéro de téléphone requis'
        })
      }

      // 1. Vérification stock (sans décrémenter)
      const useCart = !!payload.userId && (!payload.items || payload.items.length === 0)
      const stock = await this.checkStock(payload.items || [], useCart, payload.userId)
      if (!stock.ok) {
        return response.status(400).json({
          success: false,
          message: 'Stock insuffisant',
          errors: stock.errors
        })
      }

      // 2. KYC et détection opérateur
      const kyc = await this.performKYC(phoneNumber)
      console.log(`📱 Opérateur: ${kyc.operator} | Code: ${kyc.operatorCode} | Compte: ${kyc.accountCode}`)

      // 3. Renouveler le secret
      await this.renewSecretIfNeeded(phoneNumber)

      // 4. User ID
      let userId = payload.userId
      if (!userId) {
        const newUser = await this.getOrCreateUser({
          customerName: payload.customerName || kyc.fullName,
          customerEmail: payload.customerEmail || '',
          customerPhone: phoneNumber,
        })
        userId = newUser.id
      }

      // 5. Création commande (stock non touché)
      const order = await Order.create({
        user_id: userId,
        order_number: generateOrderNumber(),
        status: 'pending',
        total: 0,
        subtotal: 0,
        shipping_cost: payload.deliveryPrice || 1,
        delivery_method: payload.deliveryMethod || 'standard',
        customer_name: payload.customerName || kyc.fullName,
        customer_phone: phoneNumber,
        payment_method: kyc.operator,
        customer_email: payload.customerEmail || 'invite@email.com',
        shipping_address: payload.shippingAddress || 'non renseigné',
        payment_operator_simple: kyc.operator
      })

      // 6. Items (stock non décrémenté)
      const { subtotal, count } = await this.buildItems(order, payload.items || [], useCart, payload.userId)
      const total = subtotal + (payload.deliveryPrice || 1)
      order.subtotal = subtotal
      order.total = total
      await order.save()

      await OrderTracking.create({
        order_id: order.id,
        status: 'pending',
        description: `🛒 Commande initiée - ${kyc.operator} - ${count} articles`,
        tracked_at: DateTime.now(),
      })

      // 7. Paiement
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

      console.log('💳 Résultat:', payment)

      // 8. Traitement résultat
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
        // ✅ Paiement échoué → Pas besoin de restaurer le stock (jamais décrémenté)
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
