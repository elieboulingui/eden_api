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
  const value = `CMD-${Date.now()}-${Math.floor(Math.random() * 1000)}`
  console.log('generateOrderNumber:', value)
  return value
}

export default class PayMobileMoneyController {

  private async renewSecretIfNeeded(phoneNumber?: string): Promise<void> {
    console.log('[SECRET] renewSecretIfNeeded start', phoneNumber)

    try {
      await MypvitSecretService.renewSecret(phoneNumber)
      console.log('[SECRET] renewed OK')
    } catch (error: any) {
      console.log('[SECRET] error', error.message)
    }
  }

  private detectOperatorGabon(phoneNumber: string) {
    console.log('[OPERATOR] detect start:', phoneNumber)

    const clean = phoneNumber.replace(/[\s\+\.\-]/g, '')
    let local = clean

    if (clean.startsWith('241')) local = clean.substring(3)
    if (clean.startsWith('+241')) local = clean.substring(4)
    if (local.startsWith('0')) local = local.substring(1)

    console.log('[OPERATOR] cleaned:', local)

    if (local.startsWith('06') || local.startsWith('6')) {
      console.log('[OPERATOR] MOOV')
      return {
        name: 'MOOV_MONEY',
        code: 'MOOV_MONEY',
        accountCode: 'ACC_69EFB143D4F54'
      }
    }

    if (local.startsWith('07') || local.startsWith('7')) {
      console.log('[OPERATOR] AIRTEL')
      return {
        name: 'AIRTEL_MONEY',
        code: 'AIRTEL_MONEY',
        accountCode: 'ACC_69EFB0E02FCA3'
      }
    }

    console.log('[OPERATOR] GIMAC default')
    return {
      name: 'GIMAC',
      code: 'GIMAC_PAY',
      accountCode: 'ACC_69FE0E1BC34B4'
    }
  }

  private async checkCartStock(userId: string) {
    console.log('[CART] check start', userId)

    const errors: string[] = []

    const cart = await Cart.query()
      .where('user_id', userId)
      .preload('items')
      .first()

    console.log('[CART] exists:', !!cart)

    if (!cart || !cart.items?.length) {
      return { ok: false, errors: ['Panier vide'], cart: null }
    }

    for (const item of cart.items) {
      console.log('[CART ITEM]', item.product_id, item.quantity)

      const product = await Product.findBy('id', item.product_id)

      if (!product) {
        errors.push('Produit introuvable')
        continue
      }

      if (product.stock < item.quantity) {
        errors.push(`${product.name} stock insuffisant`)
      }
    }

    return { ok: errors.length === 0, errors, cart }
  }

  private async buildItems(order: Order, cart: Cart) {
    console.log('[ORDER ITEMS] build start')

    let subtotal = 0
    let count = 0

    for (const item of cart.items) {
      const product = await Product.findBy('id', item.product_id)

      if (!product) continue

      const total = Number(product.price) * Number(item.quantity)

      console.log('[ITEM]', product.name, total)

      subtotal += total

      await OrderItem.create({
        order_id: order.id,
        product_id: product.id,
        product_name: product.name,
        price: product.price,
        quantity: item.quantity,
        subtotal: total
      })

      count++
    }

    console.log('[ORDER ITEMS] subtotal:', subtotal, 'count:', count)

    return { subtotal, count }
  }

  async pay({ request, response }: HttpContext) {
    console.log('================ PAYMENT START ================')

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

      console.log('[PAYLOAD]', payload)

      const userId = payload.userId
      const phoneNumber = payload.customerAccountNumber || payload.customerPhone

      console.log('[USER]', userId)
      console.log('[PHONE]', phoneNumber)

      if (!userId || !phoneNumber) {
        return response.badRequest({
          success: false,
          message: 'userId ou phone manquant'
        })
      }

      const { ok, errors, cart } = await this.checkCartStock(userId)

      if (!ok || !cart) {
        console.log('[CART] invalid', errors)
        return response.badRequest({ success: false, errors })
      }

      const user = await User.findBy('id', userId)

      const kyc = this.detectOperatorGabon(phoneNumber)

      await this.renewSecretIfNeeded(phoneNumber)

      let subtotal = 0

      for (const item of cart.items) {
        const product = await Product.findBy('id', item.product_id)
        if (product) {
          subtotal += Number(product.price) * Number(item.quantity)
        }
      }

      const shipping = Number(payload.deliveryPrice || 1)
      const total = Number(subtotal) + Number(shipping)

      console.log('[TOTAL]', { subtotal, shipping, total })

      const order = await Order.create({
        user_id: userId,
        order_number: generateOrderNumber(),
        status: 'pending',
        total,
        subtotal,
        shipping_cost: shipping,
        customer_name: user?.full_name || payload.customerName || 'Client',
        customer_phone: phoneNumber,
        payment_method: kyc.operator,
        payment_operator_simple: kyc.operator
      })

      console.log('[ORDER CREATED]', order.id)

      const { count } = await this.buildItems(order, cart)

      await OrderTracking.create({
        order_id: order.id,
        status: 'pending',
        description: 'Commande créée',
        tracked_at: DateTime.now()
      })

      console.log('[TRACKING CREATED]')

      const paymentPayload = {
        agent: payload.agent || 'AGENT_DEFAULT',
        amount: total,
        reference: `REF${Date.now()}`,
        callback_url_code: CALLBACK_URL_CODE,
        customer_account_number: phoneNumber,
        merchant_operation_account_code: kyc.accountCode,
        owner_charge: 'CUSTOMER',
        operator_code: kyc.code
      }

      console.log('[PAYMENT PAYLOAD]', paymentPayload)

      const payment = await MypvitTransactionService.processPayment(paymentPayload)

      console.log('[PAYMENT RESPONSE]', payment)

      if (!payment) {
        throw new Error('Payment null')
      }

      const xSecret = await MypvitSecretService.getSecret()

      console.log('[XSECRET]', xSecret ? 'OK' : 'NULL')

      if (!xSecret) {
        throw new Error('XSecret missing')
      }

      if (payment.status !== 'FAILED' && payment.reference_id) {
        order.payment_reference_id = payment.reference_id
        order.status = 'pending_payment'
        order.payment_initiated_at = DateTime.now()

        await order.save()

        await CartItem.query().where('cart_id', cart.id).delete()

        console.log('[CART CLEARED]')

        return response.ok({
          success: true,
          orderId: order.id,
          total,
          itemsCount: count,
          payment
        })
      }

      console.log('[PAYMENT FAILED]')

      order.status = 'payment_failed'
      await order.save()

      return response.badRequest({
        success: false,
        message: 'Paiement échoué'
      })

    } catch (error: any) {
      console.log('[ERROR]', error.message)
      console.log(error)

      return response.internalServerError({
        success: false,
        message: 'Erreur serveur',
        error: error.message
      })
    }
  }
}
