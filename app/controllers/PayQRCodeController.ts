// app/controllers/PayQRCodeController.ts - SANS GuestOrder
import type { HttpContext } from '@adonisjs/core/http'
import Order from '#models/Order'
import OrderItem from '#models/OrderItem'
import OrderTracking from '#models/order_tracking'
import Cart from '#models/Cart'
import CartItem from '#models/CartItem'
import User from '#models/user'
import Product from '#models/Product'
import { DateTime } from 'luxon'
import crypto from 'node:crypto'
import MypvitSecretService from '../services/mypvit_secret_service.js'
import MypvitQRCodeService from '../services/mypvit_qrcode_service.js'

const ACCOUNT_OPERATION_CODE = 'ACC_69EA59CBC7495'
const CALLBACK_URL_CODE = '9ZOXW'

function generateOrderNumber(): string {
  return `CMD-${Date.now()}-${Math.floor(Math.random() * 1000)}`
}

function generateRandomPassword(): string {
  return crypto.randomBytes(16).toString('hex')
}

export default class PayQRCodeController {

  private async renewSecretIfNeeded(): Promise<void> {
    await MypvitSecretService.renewSecret()
    console.log('🔐 Clé renouvelée')
  }

  // ==================== CRÉER UN USER SI PAS D'ID ====================
  private async getOrCreateUser(payload: {
    customerName: string
    customerEmail: string
    customerPhone: string
  }): Promise<User> {
    const email = payload.customerEmail || `guest_${Date.now()}@guest.com`
    const phone = payload.customerPhone || ''
    const fullName = payload.customerName || 'Client'

    let user = await User.findBy('email', email)

    if (user) {
      console.log('👤 User existant:', user.id)
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
        password: generateRandomPassword(),
      })
      console.log('👤 User créé:', user.id, '|', user.email, '|', user.full_name)
    }

    return user
  }

  // ==================== VÉRIFICATION DU STOCK ====================
  private async checkStockAvailability(items: any[], isCart: boolean = false, userId?: string): Promise<{
    available: boolean
    outOfStockProducts: string[]
    message?: string
  }> {
    const outOfStockProducts: string[] = []
    let productsToCheck: any[] = []

    if (isCart && userId) {
      const cart = await Cart.query().where('user_id', userId).preload('items').first()
      if (cart) {
        productsToCheck = cart.items.map((item: any) => ({
          productId: item.product_id,
          quantity: item.quantity
        }))
      }
    } else if (items && items.length > 0) {
      productsToCheck = items.map((item: any) => ({
        productId: item.productId || item.id,
        quantity: item.quantity
      }))
    }

    if (productsToCheck.length === 0) {
      return { available: false, outOfStockProducts: ['Aucun produit'], message: 'Aucun produit' }
    }

    console.log(`📦 Vérification de ${productsToCheck.length} produit(s)...`)

    for (const item of productsToCheck) {
      if (!item.productId) continue
      const product = await Product.findBy('id', item.productId)
      if (!product) { outOfStockProducts.push(`Produit ${item.productId} introuvable`); continue }
      if (product.isArchived) { outOfStockProducts.push(`${product.name} - Archivé`); continue }
      if (product.stock <= 0) { outOfStockProducts.push(`${product.name} - RUPTURE`); continue }
      if (product.stock < item.quantity) { outOfStockProducts.push(`${product.name}: ${product.stock} < ${item.quantity}`); continue }
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

  private async restoreProductStock(orderId: string): Promise<void> {
    const orderItems = await OrderItem.query().where('order_id', orderId)
    for (const item of orderItems) {
      const product = await Product.findBy('id', item.product_id)
      if (product) {
        product.stock += item.quantity
        if (product.isArchived && product.stock > 0) product.isArchived = false
        await product.save()
      }
    }
  }

  private async createOrderItems(order: Order, items: any[]): Promise<{ subtotal: number; itemsCount: number }> {
    let subtotal = 0; let itemsCount = 0
    for (const item of items) {
      const productId = item.productId || item.id
      if (!productId) continue
      const product = await Product.findBy('id', productId)
      if (!product) throw new Error(`Produit ${productId} non trouvé`)
      const itemTotal = item.price * item.quantity
      subtotal += itemTotal
      await OrderItem.create({ order_id: order.id, product_id: product.id, product_name: product.name, price: item.price, quantity: item.quantity, subtotal: itemTotal })
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
      const itemTotal = product.price * cartItem.quantity
      subtotal += itemTotal
      await OrderItem.create({ order_id: order.id, product_id: product.id, product_name: product.name, price: product.price, quantity: cartItem.quantity, subtotal: itemTotal })
      await this.updateProductStock(product.id, cartItem.quantity)
      itemsCount++
    }
    return { subtotal, itemsCount }
  }

  // ==================== PAIEMENT QR CODE ====================
  async pay({ request, response }: HttpContext) {
    console.log('📷 ========== PAIEMENT QR CODE ==========')

    try {
      const payload = request.only([
        'userId', 'isGuest', 'customerAccountNumber',
        'shippingAddress', 'deliveryMethod', 'deliveryPrice',
        'customerName', 'customerEmail', 'customerPhone', 'items',
      ])

      const isGuest = payload.isGuest === true || !payload.userId || payload.userId === 'guest'

      console.log(`👤 Mode: ${isGuest ? 'INVITÉ' : 'CONNECTÉ'}`)
      console.log(`📱 Téléphone: ${payload.customerAccountNumber || 'N/A'}`)
      console.log(`📦 Items: ${payload.items?.length || 0}`)

      // Vérification stock
      const useCart = !isGuest && payload.userId && (!payload.items || payload.items.length === 0)
      const stockCheck = await this.checkStockAvailability(payload.items || [], useCart, payload.userId)

      if (!stockCheck.available) {
        return response.status(400).json({
          success: false, message: 'Produits indisponibles',
          error: 'STOCK_INSUFFISANT',
          details: { outOfStockProducts: stockCheck.outOfStockProducts, message: stockCheck.message }
        })
      }

      console.log('✅ Stock disponible')
      await this.renewSecretIfNeeded()

      // ==================== USER ID ====================
      let userId = payload.userId

      if (!userId) {
        const newUser = await this.getOrCreateUser({
          customerName: payload.customerName || 'Client',
          customerEmail: payload.customerEmail || '',
          customerPhone: payload.customerPhone || payload.customerAccountNumber || '',
        })
        userId = newUser.id
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
        customer_name: payload.customerName || 'Client',
        customer_phone: payload.customerPhone || payload.customerAccountNumber || '',
        payment_method: 'qr_code',
        customer_email: payload.customerEmail || 'invite@email.com',
        shipping_address: payload.shippingAddress || 'non renseigné',
        notes: payload.notes || null,
      })

      let subtotal = 0; let itemsCount = 0

      if (payload.items && payload.items.length > 0) {
        const r = await this.createOrderItems(order, payload.items)
        subtotal = r.subtotal; itemsCount = r.itemsCount
        console.log('📦 Items directs utilisés')
      } else if (!isGuest && payload.userId) {
        const cart = await Cart.query().where('user_id', payload.userId).preload('items').first()
        if (cart && cart.items.length > 0) {
          const r = await this.createOrderItemsFromCart(cart, order)
          subtotal = r.subtotal; itemsCount = r.itemsCount
          await CartItem.query().where('cart_id', cart.id).delete()
          console.log('🛒 Panier utilisé et vidé')
        } else {
          await this.restoreProductStock(order.id)
          return response.status(400).json({ success: false, message: 'Panier vide' })
        }
      } else {
        return response.status(400).json({ success: false, message: 'Aucun article' })
      }

      const total = subtotal + deliveryPrice
      order.subtotal = subtotal; order.total = total
      await order.save()

      await OrderTracking.create({
        order_id: order.id, status: 'pending',
        description: `Commande QR Code (${isGuest ? 'Invité' : 'Connecté'})`,
        tracked_at: DateTime.now(),
      })

      // Générer QR Code
      const terminalId = `T${Date.now().toString(36).toUpperCase()}`
      const qrResult = await MypvitQRCodeService.generateStaticQRCode({
        accountOperationCode: ACCOUNT_OPERATION_CODE,
        terminalId: terminalId,
        callbackUrlCode: CALLBACK_URL_CODE,
      })

      if (qrResult.reference_id) {
        order.payment_reference_id = qrResult.reference_id
        order.status = 'pending_payment'
        await order.save()
      }

      await OrderTracking.create({
        order_id: order.id, status: 'pending_payment',
        description: `QR Code - Réf: ${qrResult.reference_id || order.order_number}`,
        tracked_at: DateTime.now(),
      })

      await order.load('items')
      console.log('✅ QR Code généré')

      return response.status(201).json({
        success: true,
        message: '✅ QR Code généré ! Scannez pour payer.',
        data: {
          orderId: order.id, orderNumber: order.order_number, total: order.total,
          status: 'pending_payment', customerName: order.customer_name,
          paymentMethod: 'qr_code', isGuest, itemsCount, userId,
          qr_code: {
            data: qrResult.data,
            reference_id: qrResult.reference_id || order.order_number,
            amount: total, expires_in: 600,
          },
        },
      })

    } catch (error: any) {
      console.error('🔴 Erreur QR:', error.message)
      return response.status(500).json({ success: false, message: 'Erreur QR Code', error: error.message })
    }
  }
}