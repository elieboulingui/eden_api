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
import MypvitSecretService from '../services/mypvit_secret_services.js'
import MypvitLinkService from '../services/mypvit_link_service.js'

const CALLBACK_URL_CODE = '9ZOXW'

const LINK_TYPES: Record<string, string> = {
  'web': 'WEB',
  'visa': 'VISA_MASTERCARD',
  'rest': 'RESTLINK'
}

function generateOrderNumber(): string {
  return `CMD-${Date.now()}-${Math.floor(Math.random() * 1000)}`
}

export default class PayLinkController {

  private detectOperatorGabon(phoneNumber?: string): { name: string; code: string; accountCode: string } {
    console.log('[DETECT_OPERATOR] phoneNumber:', phoneNumber)
    
    if (!phoneNumber) {
      return { name: 'GIMAC', code: 'GIMAC_PAY', accountCode: 'ACC_69FE0E1BC34B4' }
    }

    const clean = phoneNumber.replace(/[\s\+\.\-]/g, '')
    let local = clean
    if (clean.startsWith('241')) local = clean.substring(3)
    if (clean.startsWith('+241')) local = clean.substring(4)
    if (local.startsWith('0')) local = local.substring(1)

    // Pour GIMAC, on retourne toujours GIMAC quelque soit le numéro
    console.log('[DETECT_OPERATOR] Utilisation de GIMAC (compte unique)')
    return { name: 'GIMAC', code: 'GIMAC_PAY', accountCode: 'ACC_69FE0E1BC34B4' }
  }

  private async renewSecretIfNeeded(): Promise<void> {
    try {
      console.log('[RENEW_SECRET] Tentative de renouvellement du secret...')
      await MypvitSecretService.renewSecret()
      console.log('[RENEW_SECRET] ✅ Clé renouvelée avec succès')
    } catch (error: any) {
      console.error('[RENEW_SECRET] ⚠️ Erreur:', error.message)
    }
  }

  private async checkStock(userId: string): Promise<{ 
    ok: boolean
    errors: string[]
    cart: Cart | null
  }> {
    const errors: string[] = []
    
    console.log('[STOCK] Récupération du panier pour userId:', userId)
    
    const cart = await Cart.query()
      .where('user_id', userId)
      .preload('items')
      .first()

    if (!cart || !cart.items || cart.items.length === 0) {
      return { ok: false, errors: ['Panier vide'], cart: null }
    }

    console.log('[STOCK] Panier trouvé avec', cart.items.length, 'articles')

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
      console.log('[STOCK] ✅', p.name, 'stock:', p.stock, 'demandé:', item.quantity)
    }

    return { ok: errors.length === 0, errors, cart }
  }

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

      count++
    }

    return { subtotal, count }
  }

  async pay({ request, response }: HttpContext) {
    console.log('\n')
    console.log('🔗 =========================================================')
    console.log('🔗 ========== PAIEMENT PAR LIEN (GIMAC) ==========')
    console.log('🔗 =========================================================')
    console.log('[TIMESTAMP]', new Date().toISOString())

    try {
      const payload = request.only([
        'userId', 'customerAccountNumber', 'shippingAddress',
        'deliveryMethod', 'deliveryPrice', 'customerName',
        'customerEmail', 'customerPhone', 'linkType', 'notes'
      ])

      console.log('[PAYLOAD] Données reçues:', JSON.stringify(payload, null, 2))

      const userId = payload.userId
      const phoneNumber = payload.customerAccountNumber || payload.customerPhone
      const linkType = payload.linkType || 'web'
      const linkTypeCode = LINK_TYPES[linkType] || 'WEB'

      if (!userId) {
        console.log('[ERROR] userId requis')
        return response.status(400).json({
          success: false,
          message: 'userId requis'
        })
      }

      if (!phoneNumber) {
        console.log('[ERROR] Numéro de téléphone requis')
        return response.status(400).json({
          success: false,
          message: 'Numéro de téléphone requis'
        })
      }

      console.log('[INFO] userId:', userId)
      console.log('[INFO] phoneNumber:', phoneNumber)
      console.log('[INFO] linkType:', linkType, '→ code:', linkTypeCode)

      // 1. Vérification du stock
      const { ok, errors, cart } = await this.checkStock(userId)
      
      if (!ok) {
        console.log('[ERROR] Stock insuffisant:', errors)
        return response.status(400).json({
          success: false,
          message: 'Stock insuffisant ou panier vide',
          errors
        })
      }

      if (!cart) {
        console.log('[ERROR] Panier introuvable')
        return response.status(400).json({
          success: false,
          message: 'Panier introuvable'
        })
      }

      console.log(`[CART] Panier trouvé avec ${cart.items.length} articles`)

      // 2. Détection opérateur (toujours GIMAC)
      const operatorInfo = this.detectOperatorGabon(phoneNumber)
      console.log(`[OPERATOR] Compte utilisé: ${operatorInfo.name}`)
      console.log(`[OPERATOR] AccountCode: ${operatorInfo.accountCode}`)

      // 3. Renouvellement du secret
      await this.renewSecretIfNeeded()

      // 4. Récupération utilisateur
      const user = await User.findBy('id', userId)
      console.log('[USER] Utilisateur trouvé:', !!user)

      // 5. Calcul du total
      let subtotal = 0
      for (const item of cart.items) {
        const product = await Product.findBy('id', item.product_id)
        if (product) {
          subtotal += product.price * item.quantity
        }
      }

      const deliveryPrice = Number(payload.deliveryPrice) || 0
      const total = subtotal + deliveryPrice
      const orderNumber = generateOrderNumber()

      console.log('[TOTAL] Subtotal:', subtotal, '| Livraison:', deliveryPrice, '| Total:', total)

      // 6. Création de la commande
      const order = await Order.create({
        user_id: userId,
        order_number: orderNumber,
        status: 'pending',
        total: total,
        subtotal: subtotal,
        shipping_cost: deliveryPrice,
        delivery_method: payload.deliveryMethod || 'standard',
        customer_name: user?.full_name || payload.customerName || 'Client',
        customer_phone: phoneNumber,
        payment_method: `gimac_${linkType}`,
        customer_email: user?.email || payload.customerEmail || 'invite@email.com',
        shipping_address: payload.shippingAddress || 'non renseigné',
        notes: payload.notes || null,
        payment_operator_simple: 'GIMAC'
      })

      console.log('[ORDER] Commande créée:', order.id)

      // 7. Création des OrderItems
      const { count } = await this.buildItemsFromCart(order, cart)
      console.log('[ITEMS] Items créés:', count)

      // 8. Vidage du panier
      await CartItem.query().where('cart_id', cart.id).delete()
      console.log('[CART] Panier vidé')

      // 9. Tracking initial
      await OrderTracking.create({
        order_id: order.id,
        status: 'pending',
        description: `🔗 Lien ${linkTypeCode} - GIMAC - ${count} articles`,
        tracked_at: DateTime.now(),
      })
      console.log('[TRACKING] Tracking créé')

      // 10. Génération du lien de paiement avec MypvitLinkService
      console.log(`[LINK] Génération lien ${linkTypeCode}...`)

      let linkResult
      
      switch (linkTypeCode) {
        case 'WEB':
          linkResult = await MypvitLinkService.generateWebLink({
            amount: total,
            product: orderNumber.substring(0, 15),
            reference: `REF${Date.now()}`.substring(0, 15),
            callback_url_code: CALLBACK_URL_CODE,
            merchant_operation_account_code: operatorInfo.accountCode,
            owner_charge: 'MERCHANT',
            customer_account_number: phoneNumber,
            success_redirection_url_code: 'W0L8C',
            failed_redirection_url_code: 'YTJEI',
          })
          break
          
        case 'VISA_MASTERCARD':
          linkResult = await MypvitLinkService.generateVisaMastercardLink({
            amount: total,
            product: orderNumber.substring(0, 15),
            reference: `REF${Date.now()}`.substring(0, 15),
            callback_url_code: CALLBACK_URL_CODE,
            merchant_operation_account_code: operatorInfo.accountCode,
            owner_charge: 'MERCHANT',
            customer_account_number: phoneNumber,
            success_redirection_url_code: 'W0L8C',
            failed_redirection_url_code: 'YTJEI',
          })
          break
          
        case 'RESTLINK':
          linkResult = await MypvitLinkService.generateRestLink({
            amount: total,
            product: orderNumber.substring(0, 15),
            reference: `REF${Date.now()}`.substring(0, 15),
            callback_url_code: CALLBACK_URL_CODE,
            merchant_operation_account_code: operatorInfo.accountCode,
            owner_charge: 'MERCHANT',
            customer_account_number: phoneNumber,
            success_redirection_url_code: 'W0L8C',
            failed_redirection_url_code: 'YTJEI',
          })
          break
          
        default:
          throw new Error(`Type de lien non supporté: ${linkTypeCode}`)
      }

      console.log('[LINK] ✅ Lien généré:', {
        status: linkResult.status,
        reference_id: linkResult.merchant_reference_id,
        url: linkResult.url
      })

      // 11. Mise à jour de la commande
      if (linkResult.merchant_reference_id) {
        order.payment_reference_id = linkResult.merchant_reference_id
        order.payment_amount = total
        order.payment_initiated_at = DateTime.now()
        order.status = 'pending_payment'
        await order.save()
        console.log('[UPDATE] Commande mise à jour avec reference_id:', linkResult.merchant_reference_id)
      }

      await OrderTracking.create({
        order_id: order.id,
        status: 'pending_payment',
        description: `⏳ Lien ${linkTypeCode} - GIMAC - Réf: ${linkResult.merchant_reference_id || order.order_number}`,
        tracked_at: DateTime.now(),
      })

      await order.load('items')

      console.log('✅ =========================================================')
      console.log('✅ ========== PAIEMENT PAR LIEN GÉNÉRÉ AVEC SUCCÈS ==========')
      console.log('✅ =========================================================\n')

      return response.status(201).json({
        success: true,
        message: `✅ Lien de paiement ${linkTypeCode} généré !`,
        data: {
          orderId: order.id,
          orderNumber: order.order_number,
          total: order.total,
          status: 'pending_payment',
          customerName: order.customer_name,
          paymentMethod: `gimac_${linkType}`,
          itemsCount: count,
          userId,
          operator: {
            name: 'GIMAC',
            code: 'GIMAC_PAY',
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
      console.log('\n')
      console.log('💥 =========================================================')
      console.log('💥 ========== ERREUR ========== 💥')
      console.log('💥 =========================================================')
      console.error('[ERROR] Message:', error.message)
      if (error.response) {
        console.error('[ERROR] Response:', JSON.stringify(error.response.data, null, 2))
        console.error('[ERROR] Status:', error.response.status)
      }
      console.log('💥 =========================================================\n')
      
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la génération du lien de paiement',
        error: error.response?.data?.message || error.message
      })
    }
  }
}
