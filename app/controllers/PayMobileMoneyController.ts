```ts
// app/controllers/PayMobileMoneyController.ts
import type { HttpContext } from '@adonisjs/core/http'
import Order from '#models/Order'
import OrderItem from '#models/OrderItem'
import OrderTracking from '#models/order_tracking'
import Cart from '#models/Cart'
import CartItem from '#models/CartItem'
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

    console.log('\n🔑 ===== RENEW SECRET =====')

    try {

      console.log('📱 phoneNumber:', phoneNumber)

      await MypvitSecretService.renewSecret(phoneNumber)

      console.log('✅ Secret renouvelé')

    } catch (error: any) {

      console.error('❌ Erreur renew secret:')
      console.error(error.message)
      console.error(error)
    }
  }

  private detectOperatorGabon(
    phoneNumber: string
  ): { name: string; code: string; accountCode: string } {

    console.log('\n📱 ===== DETECT OPERATOR =====')

    console.log('📞 Numéro reçu:', phoneNumber)

    const clean = phoneNumber.replace(/[\s\+\.\-]/g, '')

    console.log('🧹 Numéro nettoyé:', clean)

    let local = clean

    if (clean.startsWith('+241')) {
      local = clean.substring(4)
    } else if (clean.startsWith('241')) {
      local = clean.substring(3)
    }

    if (local.startsWith('0')) {
      local = local.substring(1)
    }

    console.log('📱 Local:', local)
    console.log('🔢 Premier chiffre:', local.charAt(0))

    if (local.startsWith('06') || local.startsWith('6')) {

      console.log('✅ MOOV détecté')

      return {
        name: 'MOOV_MONEY',
        code: 'MOOV_MONEY',
        accountCode: 'ACC_69EFB143D4F54'
      }
    }

    if (local.startsWith('07') || local.startsWith('7')) {

      console.log('✅ AIRTEL détecté')

      return {
        name: 'AIRTEL_MONEY',
        code: 'AIRTEL_MONEY',
        accountCode: 'ACC_69EFB0E02FCA3'
      }
    }

    console.log('✅ GIMAC détecté')

    return {
      name: 'GIMAC',
      code: 'GIMAC_PAY',
      accountCode: 'ACC_69FE0E1BC34B4'
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

    console.log('\n🆔 ===== PERFORM KYC =====')

    console.log('📱 phoneNumber:', phoneNumber)

    const detected = this.detectOperatorGabon(phoneNumber)

    console.log('📱 detected:', JSON.stringify(detected, null, 2))

    let fullName = 'Client'

    try {

      console.log('🔄 Renouvellement secret...')

      await this.renewSecretIfNeeded(phoneNumber)

      console.log('🔍 Appel KYC API...')

      const kycData = await MypvitKYCService.getKYCInfo(
        phoneNumber,
        detected.code
      )

      console.log('📦 KYC API response:')
      console.log(JSON.stringify(kycData, null, 2))

      fullName =
        kycData.firstname ||
        kycData.full_name ||
        'Client'

      console.log('✅ Nom trouvé:', fullName)

    } catch (error: any) {

      console.error('❌ KYC ERROR:')
      console.error(error.message)
      console.error(error)
    }

    try {

      console.log('💾 Sauvegarde KYC DB...')

      const existingKYC = await KYC.findBy(
        'numeroTelephone',
        phoneNumber
      )

      console.log('📦 existingKYC:', !!existingKYC)

      if (existingKYC) {

        existingKYC.nomComplet = fullName
        existingKYC.operateur = detected.name

        await existingKYC.save()

        console.log('✅ KYC mis à jour')

      } else {

        await KYC.create({
          nomComplet: fullName,
          numeroTelephone: phoneNumber,
          operateur: detected.name
        })

        console.log('✅ Nouveau KYC créé')
      }

    } catch (error: any) {

      console.error('❌ KYC SAVE ERROR:')
      console.error(error.message)
      console.error(error)
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

  private async checkCartStock(userId: string): Promise<{
    ok: boolean
    errors: string[]
    cart: Cart | null
  }> {

    console.log('\n🛒 ===== CHECK CART STOCK =====')

    console.log('👤 userId:', userId)

    const errors: string[] = []

    const cart = await Cart.query()
      .where('user_id', userId)
      .preload('items')
      .first()

    console.log('🛒 cart existe:', !!cart)

    if (cart) {
      console.log('🆔 cart.id:', cart.id)
      console.log('📦 cart.items existe:', !!cart.items)
      console.log('📦 cart.items length:', cart.items?.length)
    }

    if (!cart || !cart.items || cart.items.length === 0) {

      console.log('❌ Panier vide')

      return {
        ok: false,
        errors: ['Panier vide'],
        cart: null
      }
    }

    for (const item of cart.items) {

      console.log('\n📦 ITEM:')
      console.log('🆔 item.id:', item.id)
      console.log('📦 product_id:', item.product_id)
      console.log('🔢 quantity:', item.quantity)

      const p = await Product.findBy('id', item.product_id)

      console.log('📦 Produit trouvé:', !!p)

      if (!p) {
        errors.push(`Produit ${item.product_id} introuvable`)
        continue
      }

      console.log('📛 Produit:', p.name)
      console.log('📦 Stock:', p.stock)
      console.log('📦 isArchived:', p.isArchived)

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

    console.log('📋 Errors:', errors)

    return {
      ok: errors.length === 0,
      errors,
      cart
    }
  }

  private async buildItemsFromCart(
    order: Order,
    cart: Cart
  ): Promise<{ subtotal: number; count: number }> {

    console.log('\n📦 ===== BUILD ORDER ITEMS =====')

    let subtotal = 0
    let count = 0

    for (const item of cart.items) {

      console.log('\n📦 ITEM:')
      console.log('🆔 product_id:', item.product_id)

      const p = await Product.findBy('id', item.product_id)

      console.log('📦 Produit trouvé:', !!p)

      if (!p) continue

      const itemTotal = Number(p.price) * Number(item.quantity)

      console.log('💰 itemTotal:', itemTotal)

      subtotal += itemTotal

      console.log('💰 subtotal actuel:', subtotal)

      const orderItem = await OrderItem.create({
        order_id: order.id,
        product_id: p.id,
        product_name: p.name,
        price: p.price,
        quantity: item.quantity,
        subtotal: itemTotal
      })

      console.log('✅ OrderItem créé:', orderItem.id)

      count++
    }

    console.log('📦 Count:', count)
    console.log('💰 Final subtotal:', subtotal)

    return { subtotal, count }
  }

  // =========================================================
  // ==================== PAY ================================
  // =========================================================

  async pay({ request, response }: HttpContext) {

    console.log('\n')
    console.log('🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀')
    console.log('📱 MOBILE MONEY PAYMENT')
    console.log('🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀')

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
        'linkType',
        'notes'
      ])

      console.log('\n📥 PAYLOAD REÇU:')
      console.log(JSON.stringify(payload, null, 2))

      const userId = payload.userId

      const phoneNumber =
        payload.customerAccountNumber ||
        payload.customerPhone

      console.log('👤 userId:', userId)
      console.log('📱 phoneNumber:', phoneNumber)

      if (!userId) {

        console.log('❌ userId manquant')

        return response.status(400).json({
          success: false,
          message: 'userId requis'
        })
      }

      if (!phoneNumber) {

        console.log('❌ phoneNumber manquant')

        return response.status(400).json({
          success: false,
          message: 'Numéro requis'
        })
      }

      // ======================================================
      // CHECK CART
      // ======================================================

      const { ok, errors, cart } =
        await this.checkCartStock(userId)

      console.log('🛒 Cart OK:', ok)

      if (!ok) {

        console.log('❌ Cart invalid')

        return response.status(400).json({
          success: false,
          message: 'Stock insuffisant',
          errors
        })
      }

      if (!cart) {

        console.log('❌ Cart null')

        return response.status(400).json({
          success: false,
          message: 'Panier introuvable'
        })
      }

      console.log('✅ Cart valide')

      // ======================================================
      // USER
      // ======================================================

      console.log('\n👤 ===== USER =====')

      const user = await User.findBy('id', userId)

      console.log('👤 user trouvé:', !!user)

      if (user) {
        console.log('👤 full_name:', user.full_name)
        console.log('👤 email:', user.email)
      }

      // ======================================================
      // KYC
      // ======================================================

      const kyc = await this.performKYC(phoneNumber)

      console.log('📱 KYC RESULT:')
      console.log(JSON.stringify(kyc, null, 2))

      // ======================================================
      // SECRET
      // ======================================================

      await this.renewSecretIfNeeded(phoneNumber)

      // ======================================================
      // CALCUL TOTAL
      // ======================================================

      console.log('\n💰 ===== CALCUL TOTAL =====')

      let subtotal = 0

      for (const item of cart.items) {

        const product = await Product.findBy(
          'id',
          item.product_id
        )

        if (product) {

          console.log('📦 Produit:', product.name)
          console.log('💰 price:', product.price)
          console.log('🔢 quantity:', item.quantity)

          subtotal +=
            Number(product.price) *
            Number(item.quantity)
        }
      }

      console.log('💰 subtotal:', subtotal)

      const shippingCost = Number(
        payload.deliveryPrice || 1
      )

      console.log('🚚 shippingCost:', shippingCost)

      const total =
        Number(subtotal) +
        Number(shippingCost)

      console.log('💵 total:', total)

      console.log('\n🧪 TYPES:')
      console.log(typeof subtotal)
      console.log(typeof shippingCost)
      console.log(typeof total)

      // ======================================================
      // CREATE ORDER
      // ======================================================

      console.log('\n📦 ===== CREATE ORDER =====')

      const orderPayload = {
        user_id: userId,
        order_number: generateOrderNumber(),
        status: 'pending',
        total,
        subtotal,
        shipping_cost: shippingCost,
        delivery_method:
          payload.deliveryMethod || 'standard',
        customer_name:
          user?.full_name ||
          payload.customerName ||
          kyc.fullName,
        customer_phone: phoneNumber,
        payment_method: kyc.operator,
        customer_email:
          user?.email ||
          payload.customerEmail ||
          '',
        shipping_address:
          payload.shippingAddress ||
          'non renseigné',
        payment_operator_simple: kyc.operator
      }

      console.log(JSON.stringify(orderPayload, null, 2))

      const order = await Order.create(orderPayload)

      console.log('✅ Order créée')
      console.log('🆔 order.id:', order.id)

      // ======================================================
      // ORDER ITEMS
      // ======================================================

      const { count } =
        await this.buildItemsFromCart(order, cart)

      console.log('📦 Items count:', count)

      // ======================================================
      // TRACKING
      // ======================================================

      console.log('\n📝 CREATE TRACKING')

      await OrderTracking.create({
        order_id: order.id,
        status: 'pending',
        description:
          `🛒 Commande initiée - ${kyc.operator}`,
        tracked_at: DateTime.now(),
      })

      console.log('✅ Tracking créé')

      // ======================================================
      // PAYMENT
      // ======================================================

      console.log('\n💳 ===== PAYMENT =====')

      const paymentPayload = {
        agent: payload.agent || 'AGENT_DEFAULT',
        amount: total,
        reference:
          `REF${Date.now()}`.substring(0, 15),
        callback_url_code: CALLBACK_URL_CODE,
        customer_account_number:
          kyc.accountNumber,
        merchant_operation_account_code:
          kyc.accountCode,
        owner_charge: 'CUSTOMER',
        operator_code: kyc.operatorCode,
      }

      console.log('📤 Payment payload:')
      console.log(JSON.stringify(paymentPayload, null, 2))

      const payment =
        await MypvitTransactionService.processPayment(
          paymentPayload
        )

      console.log('\n📥 PAYMENT RESPONSE:')
      console.log(JSON.stringify(payment, null, 2))

      if (!payment) {
        throw new Error('Payment NULL')
      }

      console.log('📌 payment.status:', payment.status)
      console.log('📌 payment.reference_id:', payment.reference_id)

      // ======================================================
      // X SECRET
      // ======================================================

      console.log('\n🔑 ===== GET X SECRET =====')

      const xSecret =
        await MypvitSecretService.getSecret()

      console.log('🔑 xSecret existe:', !!xSecret)

      if (!xSecret) {
        throw new Error('X-Secret introuvable')
      }

      console.log(
        '🔑 X-Secret:',
        xSecret.substring(0, 15) + '...'
      )

      // ======================================================
      // SUCCESS PAYMENT INIT
      // ======================================================

      if (
        payment.status !== 'FAILED' &&
        payment.reference_id
      ) {

        console.log('✅ Paiement initié')

        order.payment_reference_id =
          payment.reference_id

        order.payment_operator_simple =
          kyc.operator

        order.payment_amount = total

        order.payment_initiated_at =
          DateTime.now()

        order.status = 'pending_payment'

        await order.save()

        console.log('✅ Order update save')

        await OrderTracking.create({
          order_id: order.id,
          status: 'pending_payment',
          description:
            `⏳ Réf ${payment.reference_id}`,
          tracked_at: DateTime.now(),
        })

        console.log('✅ Tracking pending créé')

        await order.load('items')

        console.log('📦 order.items loaded')

        // ==================================================
        // CLEAR CART
        // ==================================================

        console.log('\n🗑️ CLEAR CART')

        await CartItem.query()
          .where('cart_id', cart.id)
          .delete()

        console.log('✅ Cart vidé')

        return response.status(201).json({
          success: true,
          message:
            '⏳ Vérifiez votre téléphone',
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
              accountCode: kyc.accountCode,
              phoneNumber: phoneNumber
            },

            x_secret: xSecret,

            merchant_reference_id:
              payment.merchant_reference_id,

            pvit_reference_id:
              payment.reference_id,

            payment: {
              reference_id:
                payment.reference_id,

              merchant_reference_id:
                payment.merchant_reference_id,

              status:
                payment.status || 'PENDING',

              transaction_id:
                payment.reference_id
            },
          },
        })
      }

      // ======================================================
      // PAYMENT FAILED
      // ======================================================

      console.log('❌ Paiement échoué')

      order.status = 'payment_failed'

      order.payment_error_message =
        payment.message ||
        'Erreur inconnue'

      await order.save()

      await OrderTracking.create({
        order_id: order.id,
        status: 'payment_failed',
        description:
          `❌ ${payment.message}`,
        tracked_at: DateTime.now(),
      })

      return response.status(400).json({
        success: false,
        message: 'Paiement échoué',
        error: payment.message
      })

    } catch (error: any) {

      console.error('\n💥💥💥💥💥💥💥💥💥💥💥💥')
      console.error('💥 ERREUR PAY MOBILE MONEY')
      console.error('💥💥💥💥💥💥💥💥💥💥💥💥')

      console.error('❌ error.message:')
      console.error(error.message)

      console.error('\n❌ FULL ERROR:')
      console.error(error)

      console.error('\n❌ STACK:')
      console.error(error.stack)

      if (error.response) {

        console.error('\n❌ AXIOS RESPONSE:')

        console.error('📌 STATUS:')
        console.error(error.response.status)

        console.error('📌 DATA:')
        console.error(
          JSON.stringify(
            error.response.data,
            null,
            2
          )
        )
      }

      return response.status(500).json({
        success: false,
        message: 'Erreur paiement',
        error: error.message,
        details: error.response?.data || null
      })
    }
  }
}
```
