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
import MypvitSecretService from '../services/mypvit_secret_service.js'
import axios from 'axios'

const CALLBACK_URL_CODE = '9ZOXW'
const MYPVIT_CODE_URL = 'MTX1MTKQQCULKA3W'

const LINK_TYPES: Record<string, string> = {
  'web': 'WEB',
  'visa': 'VISA_MASTERCARD',
  'rest': 'RESTLINK'
}

export default class PayLinkController {

  private detectOperatorGabon(phoneNumber?: string): { name: string; code: string; accountCode: string } {
    if (!phoneNumber) {
      return { name: 'GIMAC', code: 'GIMAC_PAY', accountCode: 'ACC_69FE0E1BC34B4' }
    }

    const clean = phoneNumber.replace(/[\s\+\.\-]/g, '')
    let local = clean
    if (clean.startsWith('241')) local = clean.substring(3)
    if (clean.startsWith('+241')) local = clean.substring(4)
    if (local.startsWith('0')) local = local.substring(1)

    if (local.startsWith('06') || local.startsWith('6')) {
      return { name: 'MOOV_MONEY', code: 'MOOV_MONEY', accountCode: 'ACC_69EFB143D4F54' }
    }
    
    if (local.startsWith('07') || local.startsWith('7')) {
      return { name: 'AIRTEL_MONEY', code: 'AIRTEL_MONEY', accountCode: 'ACC_69FE0E1BC34B4' }
    }
    
    return { name: 'GIMAC', code: 'GIMAC_PAY', accountCode: 'ACC_69FE0E1BC34B4' }
  }

  private async renewSecretIfNeeded(phoneNumber?: string): Promise<void> {
    try {
      console.log('🔄 Tentative de renouvellement du secret...')
      await MypvitSecretService.renewSecret(phoneNumber)
      console.log('✅ Clé renouvelée avec succès')
    } catch (error: any) {
      console.error('⚠️ Erreur renouvellement secret:', error.message)
    }
  }

  private async generatePaymentLink(
    amount: number,
    reference: string,
    linkTypeCode: string,
    operatorInfo: { name: string; code: string; accountCode: string },
    phoneNumber: string
  ): Promise<any> {
    console.log(`🔑 Génération lien ${linkTypeCode} pour commande:`, reference)

    const linkPayload: any = {
      amount: amount,
      product: reference.substring(0, 15),
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
      linkPayload.customer_account_number = phoneNumber
    } else if (linkTypeCode === 'WEB' && phoneNumber) {
      linkPayload.customer_account_number = phoneNumber
    }

    console.log('📤 Payload Mypvit:', JSON.stringify(linkPayload, null, 2))

    const secret = await MypvitSecretService.getSecret(phoneNumber)
    
    const linkResponse = await axios.post(
      `https://api.mypvit.pro/${MYPVIT_CODE_URL}/link`,
      linkPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Secret': secret,
          'X-Callback-MediaType': 'application/json',
        },
        timeout: 30000
      }
    )

    console.log('✅ Lien généré:', {
      status: linkResponse.data.status,
      reference_id: linkResponse.data.merchant_reference_id,
      url: linkResponse.data.url
    })

    return linkResponse.data
  }

  async createPaymentLink({ request, response }: HttpContext) {
    console.log('\n')
    console.log('🔗 ========== PAYMENT LINK CREATION START ==========')
    console.log('🔗 ================================================')
    console.log('[TIMESTAMP]', new Date().toISOString())

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
        'linkType'
      ])

      console.log('[PAYLOAD] Contenu complet:', JSON.stringify(payload, null, 2))

      const userId = payload.userId
      const phoneNumber = payload.customerAccountNumber || payload.customerPhone
      const linkType = payload.linkType || 'web'
      const linkTypeCode = LINK_TYPES[linkType] || 'WEB'

      if (!userId || !phoneNumber) {
        return response.badRequest({
          success: false,
          message: 'userId ou phone manquant'
        })
      }

      const cart = await Cart.query()
        .where('user_id', userId)
        .preload('items')
        .first()

      if (!cart || !cart.items || cart.items.length === 0) {
        return response.badRequest({
          success: false,
          message: 'Panier vide'
        })
      }

      const stockErrors: string[] = []
      
      for (const item of cart.items) {
        const product = await Product.findBy('id', item.product_id)
        
        if (!product) {
          stockErrors.push(`Produit non trouvé`)
          continue
        }
        
        if (product.stock < item.quantity) {
          stockErrors.push(`${product.name}: stock insuffisant`)
        }
      }
      
      if (stockErrors.length > 0) {
        return response.badRequest({
          success: false,
          message: 'Stock insuffisant',
          errors: stockErrors
        })
      }

      const user = await User.findBy('id', userId)
      
      let subtotal = 0
      
      for (const item of cart.items) {
        const product = await Product.findBy('id', item.product_id)
        if (product) {
          subtotal += Number(product.price) * Number(item.quantity)
        }
      }
      
      const shippingCost = Number(payload.deliveryPrice || 0)
      const total = subtotal + shippingCost

      const operatorInfo = this.detectOperatorGabon(phoneNumber)
      await this.renewSecretIfNeeded(phoneNumber)

      const order = await Order.create({
        user_id: userId,
        order_number: `LINK-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        status: 'pending' as const,
        total: total,
        subtotal: subtotal,
        shipping_cost: shippingCost,
        delivery_method: payload.deliveryMethod || 'standard',
        customer_name: user?.full_name || payload.customerName || 'Client',
        customer_phone: phoneNumber,
        customer_email: payload.customerEmail || user?.email,
        shipping_address: payload.shippingAddress,
        payment_method: `link_${linkType}_${operatorInfo.name.toLowerCase()}`,
        payment_operator_simple: operatorInfo.name
      })
      
      let itemsCount = 0
      
      for (const item of cart.items) {
        const product = await Product.findBy('id', item.product_id)
        if (product) {
          const totalPrice = Number(product.price) * Number(item.quantity)
          await OrderItem.create({
            order_id: order.id,
            product_id: product.id,
            product_name: product.name,
            price: product.price,
            quantity: item.quantity,
            subtotal: totalPrice
          })
          itemsCount++
        }
      }
      
      await OrderTracking.create({
        order_id: order.id,
        status: 'pending',
        description: 'Lien de paiement généré',
        tracked_at: DateTime.now()
      })
      
      const reference = `ORD-${order.id.substring(0, 8)}`

      const linkResult = await this.generatePaymentLink(
        total,
        reference,
        linkTypeCode,
        operatorInfo,
        phoneNumber
      )

      if (linkResult.merchant_reference_id) {
        order.payment_reference_id = linkResult.merchant_reference_id
        order.status = 'pending_payment' as const
        await order.save()
      }
      
      await CartItem.query().where('cart_id', cart.id).delete()
      
      return response.ok({
        success: true,
        message: `✅ Lien de paiement ${linkTypeCode} généré avec succès !`,
        data: {
          orderId: order.id,
          orderNumber: order.order_number,
          total: total,
          itemsCount: itemsCount,
          customerName: order.customer_name,
          paymentMethod: `link_${linkType}_${operatorInfo.name.toLowerCase()}`,
          operator: {
            name: operatorInfo.name,
            code: operatorInfo.code,
            accountCode: operatorInfo.accountCode
          },
          link: {
            payment_url: linkResult.url,
            reference_id: linkResult.merchant_reference_id || reference,
            type: linkTypeCode,
            amount: total,
          },
        }
      })
      
    } catch (error: any) {
      console.log('\n')
      console.log('💥 ========== EXCEPTION CATCHED ========== 💥')
      console.log('[ERROR] Message:', error.message)
      console.log('[ERROR] Stack:', error.stack)
      if (error.response) {
        console.log('[ERROR] Response data:', error.response.data)
        console.log('[ERROR] Response status:', error.response.status)
      }
      console.log('💥 ======================================== 💥\n')
      
      return response.internalServerError({
        success: false,
        message: 'Erreur lors de la création du lien de paiement',
        error: error.response?.data?.message || error.message
      })
    }
  }

  // ==================== MÉTHODE PAY AJOUTÉE ====================
  async pay({ request, response }: HttpContext) {
    console.log('\n')
    console.log('💳 ========== PAYMENT VIA LINK START ==========')
    console.log('💳 ===========================================')
    console.log('[TIMESTAMP]', new Date().toISOString())

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
        'linkType'
      ])

      console.log('[PAYLOAD]', JSON.stringify(payload, null, 2))

      const userId = payload.userId
      const phoneNumber = payload.customerAccountNumber || payload.customerPhone
      const linkType = payload.linkType || 'web'
      const linkTypeCode = LINK_TYPES[linkType] || 'WEB'

      if (!userId || !phoneNumber) {
        return response.badRequest({
          success: false,
          message: 'userId ou phone manquant'
        })
      }

      const cart = await Cart.query()
        .where('user_id', userId)
        .preload('items')
        .first()

      if (!cart || !cart.items || cart.items.length === 0) {
        return response.badRequest({
          success: false,
          message: 'Panier vide'
        })
      }

      const stockErrors: string[] = []
      
      for (const item of cart.items) {
        const product = await Product.findBy('id', item.product_id)
        
        if (!product) {
          stockErrors.push(`Produit non trouvé`)
          continue
        }
        
        if (product.stock < item.quantity) {
          stockErrors.push(`${product.name}: stock insuffisant`)
        }
      }
      
      if (stockErrors.length > 0) {
        return response.badRequest({
          success: false,
          message: 'Stock insuffisant',
          errors: stockErrors
        })
      }

      const user = await User.findBy('id', userId)
      
      let subtotal = 0
      
      for (const item of cart.items) {
        const product = await Product.findBy('id', item.product_id)
        if (product) {
          subtotal += Number(product.price) * Number(item.quantity)
        }
      }
      
      const shippingCost = Number(payload.deliveryPrice || 0)
      const total = subtotal + shippingCost

      const operatorInfo = this.detectOperatorGabon(phoneNumber)
      await this.renewSecretIfNeeded(phoneNumber)

      const order = await Order.create({
        user_id: userId,
        order_number: `PAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        status: 'pending' as const,
        total: total,
        subtotal: subtotal,
        shipping_cost: shippingCost,
        delivery_method: payload.deliveryMethod || 'standard',
        customer_name: user?.full_name || payload.customerName || 'Client',
        customer_phone: phoneNumber,
        customer_email: payload.customerEmail || user?.email,
        shipping_address: payload.shippingAddress,
        payment_method: `link_${linkType}_${operatorInfo.name.toLowerCase()}`,
        payment_operator_simple: operatorInfo.name
      })
      
      let itemsCount = 0
      
      for (const item of cart.items) {
        const product = await Product.findBy('id', item.product_id)
        if (product) {
          const totalPrice = Number(product.price) * Number(item.quantity)
          await OrderItem.create({
            order_id: order.id,
            product_id: product.id,
            product_name: product.name,
            price: product.price,
            quantity: item.quantity,
            subtotal: totalPrice
          })
          itemsCount++
        }
      }
      
      await OrderTracking.create({
        order_id: order.id,
        status: 'pending',
        description: 'Paiement via lien généré',
        tracked_at: DateTime.now()
      })
      
      const reference = `ORD-${order.id.substring(0, 8)}`

      const linkResult = await this.generatePaymentLink(
        total,
        reference,
        linkTypeCode,
        operatorInfo,
        phoneNumber
      )

      if (linkResult.merchant_reference_id) {
        order.payment_reference_id = linkResult.merchant_reference_id
        order.status = 'pending_payment' as const
        await order.save()
      }
      
      await CartItem.query().where('cart_id', cart.id).delete()
      
      return response.ok({
        success: true,
        message: `✅ Paiement via lien ${linkTypeCode} généré avec succès !`,
        data: {
          orderId: order.id,
          orderNumber: order.order_number,
          total: total,
          itemsCount: itemsCount,
          customerName: order.customer_name,
          paymentMethod: `link_${linkType}_${operatorInfo.name.toLowerCase()}`,
          operator: {
            name: operatorInfo.name,
            code: operatorInfo.code,
            accountCode: operatorInfo.accountCode
          },
          link: {
            payment_url: linkResult.url,
            reference_id: linkResult.merchant_reference_id || reference,
            type: linkTypeCode,
            amount: total,
          },
        }
      })
      
    } catch (error: any) {
      console.log('\n')
      console.log('💥 ========== EXCEPTION CATCHED ========== 💥')
      console.log('[ERROR] Message:', error.message)
      console.log('[ERROR] Stack:', error.stack)
      if (error.response) {
        console.log('[ERROR] Response data:', error.response.data)
        console.log('[ERROR] Response status:', error.response.status)
      }
      console.log('💥 ======================================== 💥\n')
      
      return response.internalServerError({
        success: false,
        message: 'Erreur lors du paiement via lien',
        error: error.response?.data?.message || error.message
      })
    }
  }
}
