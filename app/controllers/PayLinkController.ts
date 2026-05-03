import type { HttpContext } from '@adonisjs/core/http'
import Order from '#models/Order'
import OrderItem from '#models/OrderItem'
import OrderTracking from '#models/order_tracking'
import Cart from '#models/Cart'
import User from '#models/user'
import Product from '#models/Product'
import { DateTime } from 'luxon'
import crypto from 'node:crypto'
import MypvitSecretService from '../services/mypvit_secret_service.js'
import axios from 'axios'

const CALLBACK_URL_CODE = '9ZOXW'
const MYPVIT_CODE_URL = 'MTX1MTKQQCULKA3W'

const LINK_TYPES: Record<string, string> = {
  'web': 'WEB',
  'visa': 'VISA_MASTERCARD',
  'rest': 'RESTLINK'
}

function generateOrderNumber(): string {
  return `CMD-${Date.now()}-${Math.floor(Math.random() * 1000)}`
}

function generateRandomPassword(): string {
  return crypto.randomBytes(16).toString('hex')
}

export default class PayLinkController {

  private detectOperatorGabon(phoneNumber?: string): { name: string; code: string; accountCode: string } {
    if (!phoneNumber) {
      return { name: 'MOOV_MONEY', code: 'MOOV_MONEY', accountCode: 'ACC_69EFB143D4F54' }
    }

    const clean = phoneNumber.replace(/[\s\+\.\-]/g, '')
    let local = clean
    if (clean.startsWith('241')) local = clean.substring(3)
    if (local.startsWith('0')) local = local.substring(1)

    if (local.startsWith('06') || local.startsWith('6')) {
      return { name: 'MOOV_MONEY', code: 'MOOV_MONEY', accountCode: 'ACC_69EFB143D4F54' }
    }
    if (local.startsWith('07') || local.startsWith('7')) {
      return { name: 'AIRTEL_MONEY', code: 'AIRTEL_MONEY', accountCode: 'ACC_69EFB0E02FCA3' }
    }
    return { name: 'MOOV_MONEY', code: 'MOOV_MONEY', accountCode: 'ACC_69EFB143D4F54' }
  }

  private async getOrCreateUser(payload: {
    customerName: string; customerEmail: string; customerPhone: string
  }): Promise<User> {
    const email = payload.customerEmail || `guest_${Date.now()}@guest.com`
    let user = await User.findBy('email', email)
    if (user) {
      user.full_name = payload.customerName || user.full_name
      if (!user.phone) user.phone = payload.customerPhone
      await user.save()
    } else {
      user = await User.create({
        id: crypto.randomUUID(),
        email,
        full_name: payload.customerName || 'Client',
        phone: payload.customerPhone || '',
        role: 'client',
        password: generateRandomPassword(),
      })
    }
    return user
  }

  private async checkStock(items: any[], useCart: boolean, userId?: string): Promise<{
    validItems: any[]
    warnings: string[]
  }> {
    const warnings: string[] = []
    const validItems: any[] = []
    let toCheck: any[] = []

    if (useCart && userId) {
      const cart = await Cart.query().where('user_id', userId).preload('items').first()
      if (cart) toCheck = cart.items.map((i: any) => ({ id: i.product_id, qty: i.quantity }))
    } else if (items?.length > 0) {
      toCheck = items.map((i: any) => ({ id: i.productId || i.id, qty: i.quantity }))
    }

    for (const item of toCheck) {
      if (!item.id) {
        warnings.push(`Article sans ID ignoré`)
        continue
      }
      
      const p = await Product.findBy('id', item.id)
      
      if (!p) {
        warnings.push(`Produit ${item.id.substring(0, 8)}... introuvable - ignoré`)
        continue
      }
      
      if (p.isArchived) {
        warnings.push(`${p.name} - Archivé - ignoré`)
        continue
      }
      
      if (p.stock <= 0) {
        warnings.push(`${p.name} - Rupture de stock - ignoré`)
        continue
      }
      
      if (p.stock < item.qty) {
        warnings.push(`${p.name}: stock ${p.stock} < ${item.qty} - ignoré`)
        continue
      }
      
      validItems.push({
        productId: p.id,
        quantity: item.qty || 1,
        price: p.price,
        name: p.name
      })
    }

    return { validItems, warnings }
  }

  private async decrementStock(productId: string, qty: number): Promise<void> {
    const p = await Product.findBy('id', productId)
    if (p) {
      p.stock = Math.max(0, p.stock - qty)
      if (p.stock === 0) p.isArchived = true
      await p.save()
    }
  }

  private async buildItems(order: Order, validItems: any[]): Promise<{ subtotal: number; count: number }> {
    let subtotal = 0
    let count = 0

    for (const item of validItems) {
      const p = await Product.findBy('id', item.productId)
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
      
      await this.decrementStock(p.id, item.quantity || 1)
      count++
    }

    return { subtotal, count }
  }

  // ==================== PAIEMENT PAR LIEN ====================
  async pay({ request, response }: HttpContext) {
    console.log('🔗 ========== PAIEMENT PAR LIEN ==========')

    try {
      const payload = request.only([
        'userId', 'customerAccountNumber', 'shippingAddress',
        'deliveryMethod', 'deliveryPrice', 'customerName',
        'customerEmail', 'customerPhone', 'items', 'linkType', 'notes'
      ])

      // ✅ Si pas de numéro, on met un fallback pour que ça passe
      const phone = payload.customerAccountNumber || payload.customerPhone || '060000000'
      
      console.log(`📱 Phone reçu: ${phone}`)

      const operatorInfo = this.detectOperatorGabon(phone)
      const linkType = payload.linkType || 'web'
      const linkTypeCode = LINK_TYPES[linkType] || 'WEB'

      console.log(`📱 Opérateur: ${operatorInfo.name} | Compte: ${operatorInfo.accountCode}`)
      console.log(`🔗 Type de lien: ${linkTypeCode}`)

      // ✅ Vérification stock - on garde juste les valides
      const useCart = !!payload.userId && (!payload.items || payload.items.length === 0)
      const { validItems, warnings } = await this.checkStock(payload.items || [], useCart, payload.userId)
      
      if (warnings.length > 0) {
        console.log('⚠️ Produits ignorés:', warnings)
      }

      // ✅ Si vraiment 0 produit valide ET 0 items envoyés → on crée une commande vide avec frais de livraison
      // Sinon on continue avec ce qu'on a
      const hasItems = validItems.length > 0
      const deliveryPrice = payload.deliveryPrice || 0

      // Créer ou récupérer l'utilisateur
      let userId = payload.userId
      if (!userId) {
        const newUser = await this.getOrCreateUser({
          customerName: payload.customerName || 'Client',
          customerEmail: payload.customerEmail || '',
          customerPhone: payload.customerPhone || phone,
        })
        userId = newUser.id
      }

      const orderNumber = generateOrderNumber()

      // Créer la commande
      const order = await Order.create({
        user_id: userId,
        order_number: orderNumber,
        status: 'pending',
        total: deliveryPrice,
        subtotal: 0,
        shipping_cost: deliveryPrice,
        delivery_method: payload.deliveryMethod || 'standard',
        customer_name: payload.customerName || 'Client',
        customer_phone: phone,
        payment_method: `link_${linkType}_${operatorInfo.name.toLowerCase()}`,
        customer_email: payload.customerEmail || 'invite@email.com',
        shipping_address: payload.shippingAddress || 'non renseigné',
        notes: payload.notes || null,
      })

      let subtotal = 0
      let count = 0

      // ✅ Ajouter les articles valides SEULEMENT s'il y en a
      if (hasItems) {
        const result = await this.buildItems(order, validItems)
        subtotal = result.subtotal
        count = result.count
      }

      const total = subtotal + deliveryPrice
      order.subtotal = subtotal
      order.total = total
      await order.save()

      await OrderTracking.create({
        order_id: order.id,
        status: 'pending',
        description: `🔗 Lien ${linkTypeCode} - ${operatorInfo.name} - ${count} articles${warnings.length > 0 ? ` (${warnings.length} ignorés)` : ''}`,
        tracked_at: DateTime.now(),
      })

      // Renouveler le secret si nécessaire
      const secret = await MypvitSecretService.getSecret(phone)
      if (!secret) {
        await MypvitSecretService.renewSecret(phone)
      }

      // Générer le lien de paiement
      console.log(`🔑 Génération lien ${linkTypeCode}...`)

      const linkPayload: any = {
        amount: total,
        product: orderNumber.substring(0, 15),
        reference: `REF${Date.now()}`.substring(0, 15),
        service: linkTypeCode,
        callback_url_code: CALLBACK_URL_CODE,
        merchant_operation_account_code: operatorInfo.accountCode,
        transaction_type: 'PAYMENT',
        owner_charge: 'MERCHANT',
        success_redirection_url_code: 'W0L8C',
        failed_redirection_url_code: 'YTJEI',
      }

      if (linkTypeCode === 'VISA_MASTERCARD' || linkTypeCode === 'RESTLINK') {
        linkPayload.customer_account_number = phone
      } else if (linkTypeCode === 'WEB' && phone) {
        linkPayload.customer_account_number = phone
      }

      console.log('📤 Payload Mypvit:', JSON.stringify(linkPayload, null, 2))

      const linkResponse = await axios.post(
        `https://api.mypvit.pro/${MYPVIT_CODE_URL}/link`,
        linkPayload,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Secret': await MypvitSecretService.getSecret(phone),
            'X-Callback-MediaType': 'application/json',
          }
        }
      )

      const linkResult = linkResponse.data

      console.log('✅ Lien généré:', {
        status: linkResult.status,
        reference_id: linkResult.merchant_reference_id,
        url: linkResult.url
      })

      if (linkResult.merchant_reference_id) {
        order.payment_reference_id = linkResult.merchant_reference_id
        order.payment_operator_simple = operatorInfo.name
        order.payment_amount = total
        order.payment_initiated_at = DateTime.now()
        order.status = 'pending_payment'
        await order.save()
      }

      await OrderTracking.create({
        order_id: order.id,
        status: 'pending_payment',
        description: `🔗 Lien ${linkTypeCode} - ${operatorInfo.name} - Réf: ${linkResult.merchant_reference_id || order.order_number}`,
        tracked_at: DateTime.now(),
      })

      await order.load('items')

      return response.status(201).json({
        success: true,
        message: `✅ Lien de paiement ${linkTypeCode} généré !`,
        data: {
          orderId: order.id,
          orderNumber: order.order_number,
          total: order.total,
          status: 'pending_payment',
          customerName: order.customer_name,
          paymentMethod: `link_${linkType}_${operatorInfo.name.toLowerCase()}`,
          itemsCount: count,
          userId,
          operator: {
            name: operatorInfo.name,
            code: operatorInfo.code,
            accountCode: operatorInfo.accountCode
          },
          link: {
            payment_url: linkResult.url,
            reference_id: linkResult.merchant_reference_id || order.order_number,
            type: linkTypeCode,
            amount: total,
          },
        },
      })

    } catch (error: any) {
      console.error('🔴 Erreur Lien:', error.response?.data || error.message)
      return response.status(500).json({
        success: false,
        message: 'Erreur lien de paiement',
        error: error.response?.data?.message || error.message
      })
    }
  }
}
