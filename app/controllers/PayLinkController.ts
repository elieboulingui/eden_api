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

  // ✅ Vérification stock SANS décrémenter
  private async checkStock(items: any[], useCart: boolean, userId?: string): Promise<{ 
    ok: boolean
    errors: string[]
    warnings: string[]
    validItems: any[]
  }> {
    const errors: string[] = []
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
        warnings.push(`Produit ${item.id} introuvable - ignoré`)
        continue
      }
      
      if (p.isArchived) {
        warnings.push(`${p.name} - Archivé - ignoré`)
        continue
      }
      
      if (p.stock <= 0) {
        errors.push(`${p.name} - Rupture de stock`)
        continue
      }
      
      if (p.stock < item.qty) {
        errors.push(`${p.name}: stock disponible ${p.stock} < ${item.qty} demandé`)
        continue
      }
      
      validItems.push({
        productId: p.id,
        quantity: item.qty || 1,
        price: p.price,
        name: p.name
      })
    }

    return { 
      ok: errors.length === 0 && validItems.length > 0, 
      errors,
      warnings,
      validItems
    }
  }

  // ✅ Ajout items SANS décrémenter le stock
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
      
      // ❌ PAS DE DÉCRÉMENT ICI - Le callback s'en charge
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

      if (!payload.customerAccountNumber) {
        return response.status(400).json({
          success: false,
          message: 'Numéro de téléphone requis'
        })
      }

      const operatorInfo = this.detectOperatorGabon(payload.customerAccountNumber)
      const linkType = payload.linkType || 'web'
      const linkTypeCode = LINK_TYPES[linkType] || 'WEB'

      console.log(`📱 Opérateur: ${operatorInfo.name} | Compte: ${operatorInfo.accountCode}`)
      console.log(`🔗 Type de lien: ${linkTypeCode}`)

      // Vérification stock (sans décrémenter)
      const useCart = !!payload.userId && (!payload.items || payload.items.length === 0)
      const stock = await this.checkStock(payload.items || [], useCart, payload.userId)
      
      if (!stock.ok) {
        return response.status(400).json({
          success: false,
          message: stock.errors.length > 0 
            ? stock.errors.join(', ') 
            : 'Aucun produit valide dans la commande',
          errors: stock.errors,
          warnings: stock.warnings
        })
      }

      if (stock.warnings.length > 0) {
        console.log('⚠️ Produits ignorés:', stock.warnings)
      }

      // Créer ou récupérer l'utilisateur
      let userId = payload.userId
      if (!userId) {
        const newUser = await this.getOrCreateUser({
          customerName: payload.customerName || 'Client',
          customerEmail: payload.customerEmail || '',
          customerPhone: payload.customerPhone || payload.customerAccountNumber,
        })
        userId = newUser.id
      }

      const deliveryPrice = payload.deliveryPrice || 0
      const orderNumber = generateOrderNumber()

      // ✅ Créer la commande - PAS de stock_reserved
      const order = await Order.create({
        user_id: userId,
        order_number: orderNumber,
        status: 'pending_payment',
        total: 0,
        subtotal: 0,
        shipping_cost: deliveryPrice,
        delivery_method: payload.deliveryMethod || 'standard',
        customer_name: payload.customerName || 'Client',
        customer_phone: payload.customerAccountNumber,
        payment_method: `link_${linkType}_${operatorInfo.name.toLowerCase()}`,
        customer_email: payload.customerEmail || 'invite@email.com',
        shipping_address: payload.shippingAddress || 'non renseigné',
        notes: payload.notes || null,
      })

      // Ajouter les items (sans décrémenter le stock)
      const { subtotal, count } = await this.buildItems(order, stock.validItems)
      const total = subtotal + deliveryPrice
      order.subtotal = subtotal
      order.total = total
      await order.save()

      // Tracking initial
      await OrderTracking.create({
        order_id: order.id,
        status: 'pending_payment',
        description: `🔗 Lien ${linkTypeCode} - ${operatorInfo.name} - ${count} articles en attente de paiement${stock.warnings.length > 0 ? ` (${stock.warnings.length} ignorés)` : ''}`,
        tracked_at: DateTime.now(),
      })

      // Renouveler le secret si nécessaire
      const secret = await MypvitSecretService.getSecret(payload.customerAccountNumber)
      if (!secret) {
        await MypvitSecretService.renewSecret(payload.customerAccountNumber)
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
        linkPayload.customer_account_number = payload.customerAccountNumber
      } else if (linkTypeCode === 'WEB' && payload.customerAccountNumber) {
        linkPayload.customer_account_number = payload.customerAccountNumber
      }

      console.log('📤 Payload Mypvit:', JSON.stringify(linkPayload, null, 2))

      const linkResponse = await axios.post(
        `https://api.mypvit.pro/${MYPVIT_CODE_URL}/link`,
        linkPayload,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Secret': await MypvitSecretService.getSecret(payload.customerAccountNumber),
            'X-Callback-MediaType': 'application/json',
          },
          timeout: 30000
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
        await order.save()
      }

      await OrderTracking.create({
        order_id: order.id,
        status: 'pending_payment',
        description: `🔗 Lien ${linkTypeCode} généré - Réf: ${linkResult.merchant_reference_id || order.order_number} - En attente de callback`,
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
          warnings: stock.warnings.length > 0 ? stock.warnings : undefined,
        },
      })

    } catch (error: any) {
      console.error('🔴 Erreur Lien:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      })
      
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la génération du lien de paiement',
        error: error.response?.data?.message || error.message
      })
    }
  }

  // ==================== CALLBACK MYPVIT ====================
  // ✅ C'est ici que le stock sera décrémenté
  async callback({ request, response }: HttpContext) {
    console.log('📥 ========== CALLBACK MYPVIT ==========')
    
    try {
      const callbackData = request.body()
      console.log('📦 Callback reçu:', JSON.stringify(callbackData, null, 2))

      const referenceId = callbackData.merchant_reference_id || callbackData.reference_id
      
      if (!referenceId) {
        console.error('❌ Référence manquante dans le callback')
        return response.status(400).json({ success: false, message: 'Référence manquante' })
      }

      // Trouver la commande correspondante
      const order = await Order.query()
        .where('payment_reference_id', referenceId)
        .preload('items')
        .first()

      if (!order) {
        console.error('❌ Commande introuvable pour la référence:', referenceId)
        return response.status(404).json({ success: false, message: 'Commande introuvable' })
      }

      console.log('📋 Commande trouvée:', order.order_number, 'Statut actuel:', order.status)

      // Vérifier le statut du paiement
      const isSuccess = callbackData.status === 'SUCCESS' || callbackData.code === '0'
      const isFailed = callbackData.status === 'FAILED' || callbackData.code !== '0'

      if (isSuccess) {
        console.log('✅ Paiement réussi !')
        
        // ✅ DÉCRÉMENTER LE STOCK ICI
        if (order.status === 'pending_payment') {
          console.log('📦 Décrémentation du stock...')
          
          for (const item of order.items) {
            const product = await Product.find(item.product_id)
            if (product) {
              product.stock = Math.max(0, product.stock - item.quantity)
              if (product.stock === 0) {
                product.isArchived = true
              }
              await product.save()
              console.log(`✅ Stock ${product.name}: décrémenté de ${item.quantity}`)
            }
          }
        }

        // ✅ Mettre à jour la commande - utiliser les champs EXISTANTS
        order.status = 'paid' // ✅ Utiliser 'paid' au lieu de 'confirmed'
        order.payment_status = 'paid'
        order.payment_completed_at = DateTime.now() // ✅ payment_completed_at existe déjà
        order.payment_transaction_id = callbackData.transaction_id || callbackData.reference_id
        await order.save()

        // Tracking
        await OrderTracking.create({
          order_id: order.id,
          status: 'paid',
          description: '✅ Paiement confirmé par callback Mypvit - Stock décrémenté',
          tracked_at: DateTime.now(),
        })

        return response.status(200).json({
          success: true,
          message: 'Paiement confirmé et stock mis à jour',
          order_number: order.order_number
        })

      } else if (isFailed) {
        console.log('❌ Paiement échoué')
        
        // ✅ PAS de décrément de stock
        order.status = 'payment_failed'
        order.payment_status = 'failed'
        await order.save()

        await OrderTracking.create({
          order_id: order.id,
          status: 'payment_failed',
          description: `❌ Paiement échoué - ${callbackData.message || 'Aucun détail'}`,
          tracked_at: DateTime.now(),
        })

        return response.status(200).json({
          success: false,
          message: 'Paiement échoué',
          order_number: order.order_number
        })
      }

      // Statut en attente
      return response.status(200).json({
        success: true,
        message: 'Callback reçu, en attente de confirmation finale',
        order_number: order.order_number
      })

    } catch (error) {
      console.error('🔴 Erreur callback:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur traitement callback'
      })
    }
  }
}
