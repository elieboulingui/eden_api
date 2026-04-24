// app/controllers/PayMobileMoneyController.ts - SANS GuestOrder
import type { HttpContext } from '@adonisjs/core/http'
import Order from '#models/Order'
import OrderItem from '#models/OrderItem'
import OrderTracking from '#models/order_tracking'
import Cart from '#models/Cart'
import CartItem from '#models/CartItem'
import User from '#models/user'
import Product from '#models/Product'
import Wallet from '#models/wallet'
import KYC from '#models/kyc'
import { DateTime } from 'luxon'
import crypto from 'node:crypto'
import MypvitSecretService from '../services/mypvit_secret_service.js'
import MypvitTransactionService from '../services/mypvit_transaction_service.js'
import MypvitKYCService from '../services/mypvit_kyc_service.js'

const ACCOUNT_OPERATION_CODE = 'ACC_69EA59CBC7495'
const CALLBACK_URL_CODE = '9ZOXW'

function generateOrderNumber(): string {
  return `CMD-${Date.now()}-${Math.floor(Math.random() * 1000)}`
}

function generateRandomPassword(): string {
  return crypto.randomBytes(16).toString('hex')
}

export default class PayMobileMoneyController {

  private async renewSecretIfNeeded(): Promise<void> {
    try {
      await MypvitSecretService.renewSecret()
      console.log('🔐 Clé renouvelée')
    } catch (error) {
      console.error('❌ Erreur clé:', error)
      throw error
    }
  }

  private detectOperatorGabon(phoneNumber: string): { name: string; code: string } {
    const clean = phoneNumber.replace(/[\s\+\.\-]/g, '')
    let local = clean
    if (clean.startsWith('241')) local = clean.substring(3)
    if (local.startsWith('0')) local = local.substring(1)
    if (local.startsWith('6')) return { name: 'MOOV_MONEY', code: 'MOOV_MONEY' }
    if (local.startsWith('7')) return { name: 'AIRTEL_MONEY', code: 'AIRTEL_MONEY' }
    return { name: 'AIRTEL_MONEY', code: 'AIRTEL_MONEY' }
  }

  // ==================== CRÉER UN USER SI INVITÉ ====================
  private async getOrCreateGuestUser(payload: {
    customerName: string
    customerEmail: string
    customerPhone: string
  }): Promise<User> {
    const email = payload.customerEmail
    const phone = payload.customerPhone
    const fullName = payload.customerName
    const randomPassword = generateRandomPassword()

    let user = await User.findBy('email', email)

    if (user) {
      console.log('👤 User existant:', user.id, '|', user.email)
      user.full_name = fullName
      if (!user.phone) user.phone = phone
      await user.save()
    } else {
      user = await User.create({
        id: crypto.randomUUID(),
        email: email,
        full_name: fullName,
        phone: phone,
        role: 'client',
        password: randomPassword,
      })
      console.log('👤 User créé:', user.id, '|', user.email, '|', user.full_name)
    }

    return user
  }

  private async performKYC(phoneNumber: string): Promise<{
    operator: string; fullName: string; accountNumber: string; operatorCode: string; isActive: boolean
  }> {
    const detected = this.detectOperatorGabon(phoneNumber)
    let fullName = 'Client'
    try {
      await this.renewSecretIfNeeded()
      const kycData = await MypvitKYCService.getKYCInfo(phoneNumber, detected.code)
      fullName = kycData.firstname || kycData.full_name || 'Client'
    } catch (error) { console.log('🟡 KYC fallback') }
    try {
      const existingKYC = await KYC.findBy('numeroTelephone', phoneNumber)
      if (existingKYC) {
        existingKYC.nomComplet = fullName
        existingKYC.operateur = detected.name
        await existingKYC.save()
      } else {
        await KYC.create({ nomComplet: fullName, numeroTelephone: phoneNumber, operateur: detected.name })
      }
    } catch (dbError) { }
    return { operator: detected.name, fullName, accountNumber: phoneNumber, operatorCode: detected.code, isActive: true }
  }

  private async checkStockAvailability(items: any[], isCart: boolean = false, userId?: string): Promise<{
    available: boolean; outOfStockProducts: string[]; message?: string
  }> {
    const outOfStockProducts: string[] = []
    let productsToCheck: any[] = []

    if (isCart && userId) {
      const cart = await Cart.query().where('user_id', userId).preload('items').first()
      if (cart) productsToCheck = cart.items.map((i: any) => ({ productId: i.product_id, quantity: i.quantity }))
    } else if (items?.length > 0) {
      productsToCheck = items.map((i: any) => ({ productId: i.productId || i.id, quantity: i.quantity }))
    }

    for (const item of productsToCheck) {
      if (!item.productId) continue
      const product = await Product.findBy('id', item.productId)
      if (!product) { outOfStockProducts.push(`Produit ${item.productId} introuvable`); continue }
      if (product.isArchived) { outOfStockProducts.push(`${product.name} - Archivé`); continue }
      if (product.stock <= 0) { outOfStockProducts.push(`${product.name} - RUPTURE DE STOCK`); continue }
      if (product.stock < item.quantity) { outOfStockProducts.push(`${product.name} - Stock: ${product.stock} < ${item.quantity}`); continue }
      console.log(`✅ ${product.name}: stock ${product.stock} ≥ ${item.quantity}`)
    }

    return {
      available: outOfStockProducts.length === 0,
      outOfStockProducts,
      message: outOfStockProducts.length > 0 ? `Indisponible: ${outOfStockProducts.join(' | ')}` : undefined
    }
  }

  private async updateProductStock(productId: string, quantity: number): Promise<void> {
    const product = await Product.findBy('id', productId)
    if (product) {
      product.stock = Math.max(0, product.stock - quantity)
      if (product.stock === 0) product.isArchived = true
      await product.save()
    }
  }

  private async createOrderItems(order: Order, items: any[]): Promise<{ subtotal: number; itemsCount: number }> {
    let subtotal = 0; let itemsCount = 0
    for (const item of items) {
      const productId = item.productId || item.id
      if (!productId) continue
      const product = await Product.findBy('id', productId)
      if (!product) throw new Error(`Produit ${productId} non trouvé`)
      subtotal += item.price * item.quantity
      await OrderItem.create({ order_id: order.id, product_id: product.id, product_name: product.name, price: item.price, quantity: item.quantity, subtotal: item.price * item.quantity })
      await this.updateProductStock(product.id, item.quantity)
      itemsCount++
    }
    return { subtotal, itemsCount }
  }

  private async createOrderItemsFromCart(cart: any, order: Order): Promise<{ subtotal: number; itemsCount: number }> {
    let subtotal = 0; let itemsCount = 0
    for (const cartItem of cart.items) {
      if (!cartItem.product_id) continue
      const product = await Product.findBy('id', cartItem.product_id)
      if (!product) throw new Error(`Produit ${cartItem.product_id} non trouvé`)
      subtotal += product.price * cartItem.quantity
      await OrderItem.create({ order_id: order.id, product_id: product.id, product_name: product.name, price: product.price, quantity: cartItem.quantity, subtotal: product.price * cartItem.quantity })
      await this.updateProductStock(product.id, cartItem.quantity)
      itemsCount++
    }
    return { subtotal, itemsCount }
  }

  async pay({ request, response }: HttpContext) {
    console.log('📱 ========== PAIEMENT MOBILE MONEY ==========')

    try {
      const payload = request.only([
        'userId', 'isGuest', 'customerAccountNumber', 'shippingAddress',
        'deliveryMethod', 'deliveryPrice', 'customerName', 'customerEmail',
        'customerPhone', 'agent', 'items',
      ])

      const isGuest = payload.isGuest === true || !payload.userId || payload.userId === 'guest'

      console.log(`👤 Mode: ${isGuest ? 'INVITÉ' : 'CONNECTÉ'}`)

      if (!payload.customerAccountNumber) {
        return response.status(400).json({ success: false, message: 'customerAccountNumber requis' })
      }

      // Vérification stock
      const useCart = !isGuest && !!payload.userId && (!payload.items || payload.items.length === 0)
      const stockCheck = await this.checkStockAvailability(payload.items || [], useCart, payload.userId)

      if (!stockCheck.available) {
        return response.status(400).json({ success: false, message: 'Produits indisponibles', error: 'STOCK_INSUFFISANT', details: { outOfStockProducts: stockCheck.outOfStockProducts, message: stockCheck.message } })
      }

      console.log('✅ Stock disponible')
      await this.renewSecretIfNeeded()
      const kycInfo = await this.performKYC(payload.customerAccountNumber)

      // ==================== USER ID ====================
      let userId = payload.userId

      if (isGuest || !userId) {
        const guestUser = await this.getOrCreateGuestUser({
          customerName: payload.customerName || kycInfo.fullName || 'Client',
          customerEmail: payload.customerEmail || `guest_${Date.now()}@guest.com`,
          customerPhone: payload.customerPhone || payload.customerAccountNumber || '',
        })
        userId = guestUser.id
      }

      const deliveryPrice = payload.deliveryPrice || 2500
      const orderNumber = generateOrderNumber()

      // ✅ Création commande SANS guestOrderId
      const order = await Order.create({
        user_id: userId,
        order_number: orderNumber,
        status: 'pending', total: 0, subtotal: 0,
        shipping_cost: deliveryPrice,
        delivery_method: payload.deliveryMethod || 'standard',
        customer_name: payload.customerName || kycInfo.fullName,
        customer_phone: kycInfo.accountNumber,
        payment_method: kycInfo.operator,
        customer_email: payload.customerEmail || 'invite@email.com',
        shipping_address: payload.shippingAddress || 'non renseigné',
        notes: payload.notes || null,
      })

      let subtotal = 0; let itemsCount = 0

      if (payload.items?.length > 0) {
        const r = await this.createOrderItems(order, payload.items); subtotal = r.subtotal; itemsCount = r.itemsCount
      } else if (!isGuest && payload.userId) {
        const cart = await Cart.query().where('user_id', payload.userId).preload('items').first()
        if (cart?.items.length > 0) {
          const r = await this.createOrderItemsFromCart(cart, order); subtotal = r.subtotal; itemsCount = r.itemsCount
          await CartItem.query().where('cart_id', cart.id).delete()
        } else {
          return response.status(400).json({ success: false, message: 'Panier vide' })
        }
      } else {
        return response.status(400).json({ success: false, message: 'Aucun article' })
      }

      const total = subtotal + deliveryPrice
      order.subtotal = subtotal; order.total = total
      await order.save()

      await OrderTracking.create({ order_id: order.id, status: 'pending', description: `Commande - ${kycInfo.operator} (${isGuest ? 'Invité' : 'Connecté'})`, tracked_at: DateTime.now() })

      console.log(`💳 Paiement ${kycInfo.operatorCode}...`)
      const paymentResult = await MypvitTransactionService.processPayment({
        agent: payload.agent || 'AGENT_DEFAULT', amount: total,
        reference: `REF${Date.now()}`.substring(0, 15), callback_url_code: CALLBACK_URL_CODE,
        customer_account_number: kycInfo.accountNumber, merchant_operation_account_code: ACCOUNT_OPERATION_CODE,
        owner_charge: 'CUSTOMER', operator_code: kycInfo.operatorCode,
      })

      console.log('📡 Réponse:', paymentResult.status)

      if (paymentResult.status !== 'FAILED' && paymentResult.reference_id) {
        order.payment_reference_id = paymentResult.reference_id
        order.payment_operator_simple = kycInfo.operator
        order.payment_amount = total
        order.payment_initiated_at = DateTime.now()
        order.status = 'pending_payment'
        await order.save()

        await OrderTracking.create({ order_id: order.id, status: 'pending_payment', description: `⏳ En attente - Réf: ${paymentResult.reference_id}`, tracked_at: DateTime.now() })
        await order.load('items')

        return response.status(201).json({
          success: true, message: '⏳ Vérifiez votre téléphone',
          data: { orderId: order.id, orderNumber: order.order_number, total: order.total, status: 'pending_payment', customerName: order.customer_name, paymentMethod: kycInfo.operator, isGuest, itemsCount, userId, payment: { reference_id: paymentResult.reference_id, status: 'PENDING' } },
        })
      } else {
        const orderItems = await OrderItem.query().where('order_id', order.id)
        for (const item of orderItems) {
          const product = await Product.findBy('id', item.product_id)
          if (product) { product.stock += item.quantity; if (product.isArchived && product.stock > 0) product.isArchived = false; await product.save() }
        }
        order.status = 'payment_failed'; order.payment_error_message = paymentResult.message; await order.save()
        await OrderTracking.create({ order_id: order.id, status: 'payment_failed', description: `❌ Échec: ${paymentResult.message}`, tracked_at: DateTime.now() })
        return response.status(400).json({ success: false, message: 'Paiement échoué', error: paymentResult.message })
      }
    } catch (error: any) {
      console.error('🔴 Erreur:', error.message)
      return response.status(500).json({ success: false, message: 'Erreur', error: error.message })
    }
  }
}